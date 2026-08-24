/**
 * Durable storage for out-of-coverage travel intent.
 *
 * Why two stores. TelliSIM only retains ~7 days of network events, so an
 * uncovered-country attach that is not captured before it ages out is gone for
 * good — there is no re-fetch. That makes a dropped write unrecoverable, not
 * merely inconvenient.
 *
 * So SQLite is written first and always: it is local, synchronous, and cannot
 * fail for network reasons. OpenSearch is the analytical store of record —
 * durable, shared across operators, and sitting next to the CDR indices the
 * demand analysis already joins against. Rows carry `os_indexed_at`; anything
 * still null is a pending write that later calls retry. A brief OpenSearch
 * outage therefore delays the sync rather than losing the event.
 *
 * Idempotency is the same idea in both stores: the natural key
 * (iccid, country, event_time, kind) is a unique index in SQLite and the
 * document `_id` in OpenSearch, so re-pulling an overlapping 7-day window
 * rewrites rather than duplicates.
 */

import { db } from "./db";
import { networkIntentEvents } from "./db/schema";
import type { SelectNetworkIntentEvent } from "./db/schema";
import { isNull, inArray } from "drizzle-orm";
import { bulkIndexOS, ensureIndexOS } from "./opensearch-client";
import type { OSCredentials } from "./opensearch-client";

export const NETWORK_INTENT_INDEX = "tellisim-network-intent";

/**
 * Explicit mapping — without it OpenSearch guesses, and a dynamically mapped
 * `country_alpha_2` becomes `text`, breaking the terms aggregations the demand
 * leaderboard depends on. The CDR indices use bare `keyword` fields with no
 * `.keyword` subfield; this follows that convention.
 */
const NETWORK_INTENT_MAPPING = {
  settings: { number_of_shards: 1, number_of_replicas: 1 },
  mappings: {
    properties: {
      iccid: { type: "keyword" },
      country_alpha_2: { type: "keyword" },
      country_name: { type: "keyword" },
      operator: { type: "keyword" },
      kind: { type: "keyword" },
      request_type: { type: "keyword" },
      event_time: { type: "date" },
      succeeded: { type: "boolean" },
      coverage_id: { type: "keyword" },
      plan_name: { type: "keyword" },
      region_code: { type: "keyword" },
      covered_countries: { type: "keyword" },
      covered_count: { type: "integer" },
      order_number: { type: "keyword" },
      customer_email: { type: "keyword" },
      detected_at: { type: "date" },
    },
  },
} as const;

/**
 * Deterministic document ID from the event's natural key, matching the SQLite
 * unique index. Re-indexing the same event overwrites in place.
 */
export function intentDocId(row: {
  iccid: string;
  countryAlpha2: string;
  eventTime: string;
  kind: string;
}): string {
  return `${row.iccid}:${row.countryAlpha2}:${row.eventTime}:${row.kind}`;
}

function toDoc(row: SelectNetworkIntentEvent): Record<string, unknown> {
  let covered: string[] = [];
  if (row.coveredCountries) {
    try {
      const parsed = JSON.parse(row.coveredCountries);
      if (Array.isArray(parsed)) covered = parsed.map(String);
    } catch {
      // A malformed cache of the covered list must not stop the event itself
      // from reaching OpenSearch — the finding matters more than its context.
      covered = [];
    }
  }

  return {
    iccid: row.iccid,
    country_alpha_2: row.countryAlpha2,
    country_name: row.countryName,
    operator: row.operator,
    kind: row.kind,
    request_type: row.requestType,
    event_time: row.eventTime,
    succeeded: row.succeeded,
    coverage_id: row.coverageId,
    plan_name: row.planName,
    region_code: row.regionCode,
    covered_countries: covered,
    covered_count: covered.length,
    order_number: row.orderNumber,
    customer_email: row.customerEmail,
    detected_at: row.detectedAt instanceof Date ? row.detectedAt.toISOString() : row.detectedAt,
  };
}

export interface SyncResult {
  attempted: number;
  indexed: number;
  failed: number;
  error: string | null;
}

/**
 * Push every SQLite row not yet in OpenSearch and stamp the ones that land.
 * Called after each capture, and safe to call on its own as a backfill —
 * unsynced rows accumulate until an attempt succeeds.
 *
 * Never throws: the caller is a support lookup, and a sync problem must not
 * take down the answer an operator is waiting on. Failures surface in the
 * returned `error` and the rows stay pending for the next attempt.
 */
export async function syncIntentToOpenSearch(
  creds: OSCredentials | null,
  limit: number = 500
): Promise<SyncResult> {
  const empty: SyncResult = { attempted: 0, indexed: 0, failed: 0, error: null };
  if (!creds?.url) return { ...empty, error: "OpenSearch not configured" };

  let pending: SelectNetworkIntentEvent[];
  try {
    pending = db
      .select()
      .from(networkIntentEvents)
      .where(isNull(networkIntentEvents.osIndexedAt))
      .limit(limit)
      .all();
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "Failed to read pending rows" };
  }

  if (pending.length === 0) return empty;

  try {
    await ensureIndexOS(creds, NETWORK_INTENT_INDEX, NETWORK_INTENT_MAPPING);

    const { indexed, errors } = await bulkIndexOS(
      creds,
      NETWORK_INTENT_INDEX,
      pending.map((row) => ({ id: intentDocId(row), doc: toDoc(row) }))
    );

    // Map document IDs back to primary keys: only rows OpenSearch actually
    // accepted get stamped, so a partial bulk failure leaves the rest pending.
    const byDocId = new Map(pending.map((r) => [intentDocId(r), r.id]));
    const stampIds = indexed.map((docId) => byDocId.get(docId)).filter((v): v is string => !!v);

    if (stampIds.length > 0) {
      const now = new Date();
      db.transaction((tx) => {
        tx.update(networkIntentEvents)
          .set({ osIndexedAt: now })
          .where(inArray(networkIntentEvents.id, stampIds))
          .run();
      });
    }

    return {
      attempted: pending.length,
      indexed: stampIds.length,
      failed: pending.length - stampIds.length,
      error: errors.length > 0 ? `${errors.length} rejected: ${errors[0].reason}` : null,
    };
  } catch (e) {
    return {
      attempted: pending.length,
      indexed: 0,
      failed: pending.length,
      error: e instanceof Error ? e.message : "OpenSearch sync failed",
    };
  }
}

/** Count of captured events still awaiting an OpenSearch write. */
export function pendingIntentCount(): number {
  try {
    return db
      .select()
      .from(networkIntentEvents)
      .where(isNull(networkIntentEvents.osIndexedAt))
      .all().length;
  } catch {
    return 0;
  }
}
