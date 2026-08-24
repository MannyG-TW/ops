import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkIntentEvents } from "@/lib/db/schema";
import { sanitizeError } from "@/lib/api-errors";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import { queryOS } from "@/lib/opensearch-client";
import {
  NETWORK_INTENT_INDEX,
  syncIntentToOpenSearch,
  pendingIntentCount,
} from "@/lib/network-intent-store";

/** One bucket of the country leaderboard aggregation. */
interface CountryBucket {
  key: string;
  doc_count: number;
  sims?: { value?: number };
  name?: { buckets?: Array<{ key: string }> };
  last_seen?: { value_as_string?: string };
  operators?: { buckets?: Array<{ key: string }> };
}

/**
 * Read back captured out-of-coverage intent — customers who tried to connect
 * from a country their plan did not cover.
 *
 * Reads OpenSearch, not SQLite: OpenSearch is the durable store of record and
 * holds captures from every operator, while the local SQLite table is only
 * this instance's replay buffer. Falls back to SQLite when OpenSearch is
 * unreachable and labels which source answered, so a partial local view is
 * never mistaken for the whole dataset.
 *
 * `GET /api/tellisim/network-events`          → country demand leaderboard
 * `GET /api/tellisim/network-events?iccid=…`  → events for one ICCID
 * `?days=30`                                  → limit to the last N days of events
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const iccid = sp.get("iccid")?.trim();
    const days = parseInt(sp.get("days") || "0", 10);
    const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "100", 10)));
    const pending = pendingIntentCount();

    const creds = resolveOpenSearchCredentials();
    if (!creds?.url) return localFallback(iccid, limit, pending, "OpenSearch not configured");

    try {
      const filters: Record<string, unknown>[] = [];
      if (iccid) filters.push({ term: { iccid } });
      if (days > 0) filters.push({ range: { event_time: { gte: `now-${days}d` } } });
      const query = filters.length > 0 ? { bool: { filter: filters } } : { match_all: {} };

      if (iccid) {
        const res = await queryOS(creds, NETWORK_INTENT_INDEX, {
          size: limit,
          query,
          sort: [{ event_time: "desc" }],
        });
        const events = (res.hits?.hits ?? []).map((h: Record<string, unknown>) => h._source);
        return NextResponse.json({ ok: true, source: "opensearch", iccid, pending, events });
      }

      // Distinct SIMs matter more than raw event volume: one device retrying in
      // the same country emits many events for a single traveller.
      const res = await queryOS(creds, NETWORK_INTENT_INDEX, {
        size: 0,
        query,
        aggs: {
          by_country: {
            terms: { field: "country_alpha_2", size: limit, order: { sims: "desc" } },
            aggs: {
              sims: { cardinality: { field: "iccid" } },
              name: { terms: { field: "country_name", size: 1 } },
              last_seen: { max: { field: "event_time" } },
              operators: { terms: { field: "operator", size: 5 } },
            },
          },
        },
      });

      const countries = (res.aggregations?.by_country?.buckets ?? []).map(
        (b: CountryBucket) => ({
          countryAlpha2: b.key,
          countryName: b.name?.buckets?.[0]?.key ?? null,
          events: b.doc_count,
          sims: b.sims?.value ?? 0,
          lastSeen: b.last_seen?.value_as_string ?? null,
          operators: (b.operators?.buckets ?? []).map((o: { key: string }) => o.key),
        })
      );

      return NextResponse.json({ ok: true, source: "opensearch", pending, countries });
    } catch (e) {
      // Fall through to the local buffer, but say so — a leaderboard built from
      // one instance's rows is not the full picture.
      const reason = e instanceof Error ? e.message : "OpenSearch unavailable";
      return localFallback(iccid, limit, pending, reason);
    }
  } catch (err) {
    return sanitizeError(err, "Network intent");
  }
}

/** Local SQLite view — this instance's captures only. */
function localFallback(
  iccid: string | undefined,
  limit: number,
  pending: number,
  reason: string
): NextResponse {
  const rows = db
    .select()
    .from(networkIntentEvents)
    .where(iccid ? eq(networkIntentEvents.iccid, iccid) : undefined)
    .orderBy(desc(networkIntentEvents.eventTime))
    .limit(limit)
    .all();

  if (iccid) {
    return NextResponse.json({
      ok: true,
      source: "sqlite",
      partial: true,
      reason,
      iccid,
      pending,
      events: rows,
    });
  }

  const byCountry = new Map<
    string,
    {
      countryAlpha2: string;
      countryName: string | null;
      events: number;
      sims: Set<string>;
      lastSeen: string | null;
    }
  >();
  for (const r of rows) {
    const e = byCountry.get(r.countryAlpha2) ?? {
      countryAlpha2: r.countryAlpha2,
      countryName: r.countryName,
      events: 0,
      sims: new Set<string>(),
      lastSeen: null,
    };
    e.events += 1;
    e.sims.add(r.iccid);
    if (!e.lastSeen || r.eventTime > e.lastSeen) e.lastSeen = r.eventTime;
    byCountry.set(r.countryAlpha2, e);
  }

  const countries = Array.from(byCountry.values())
    .map((c) => ({ ...c, sims: c.sims.size }))
    .sort((a, b) => b.sims - a.sims || b.events - a.events);

  return NextResponse.json({
    ok: true,
    source: "sqlite",
    partial: true,
    reason,
    pending,
    countries,
  });
}

/**
 * Force a sync of everything still pending. The capture path already syncs on
 * every lookup, so this exists to drain a backlog after an OpenSearch outage
 * without waiting for the next ICCID to be looked up.
 */
export async function POST() {
  try {
    const result = await syncIntentToOpenSearch(resolveOpenSearchCredentials());
    return NextResponse.json({ ok: true, ...result, pending: pendingIntentCount() });
  } catch (err) {
    return sanitizeError(err, "Network intent");
  }
}
