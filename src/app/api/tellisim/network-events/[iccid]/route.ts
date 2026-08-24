import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sanitizeError } from "@/lib/api-errors";
import {
  getNetworkEvents,
  getPlanAttachments,
  getCoverageProfile,
} from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";
import { analyzeNetworkEvents, recentWindow, resolveIso2 } from "@/lib/network-events";
import type { NormalizedNetworkEvent } from "@/lib/network-events";
import { db } from "@/lib/db";
import { networkIntentEvents } from "@/lib/db/schema";

// TelliSIM shapes vary; raw records are read defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 7; // TelliSIM counts both endpoints

/** Most recent plan attachment by created_at — the one the customer is travelling on. */
function latestAttachment(planAttachments: AnyRecord | null): AnyRecord | null {
  const rows = (planAttachments?.data ?? planAttachments) as AnyRecord[] | undefined;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    const ta = new Date(a?.created_at ?? 0).getTime() || 0;
    const tb = new Date(b?.created_at ?? 0).getTime() || 0;
    return tb - ta;
  })[0];
}

/**
 * Covered ISO2 codes from a coverage profile.
 *
 * Falls back to the country name when `iso2` is absent: a country missing from
 * this set reads as "uncovered", which would fabricate a demand signal for a
 * country we actually sell. Erring toward a larger covered set is the safe
 * direction — a missed finding costs less than an invented one.
 */
function coveredIso2From(coverageProfile: AnyRecord | null): string[] {
  const profile = (coverageProfile?.data ?? coverageProfile) as AnyRecord | undefined;
  const countries = (profile?.countries ?? []) as AnyRecord[];
  if (!Array.isArray(countries)) return [];
  return countries
    .map((c) => resolveIso2(c?.iso2, c?.name))
    .filter((c): c is string => !!c);
}

/**
 * Validate the requested period against TelliSIM's constraints before spending
 * a call: max 7 days inclusive, and start strictly before end.
 */
function resolvePeriod(body: AnyRecord): { start: string; end: string } | { error: string } {
  const start = typeof body?.start === "string" ? body.start : null;
  const end = typeof body?.end === "string" ? body.end : null;
  if (!start && !end) return recentWindow(MAX_SPAN_DAYS);
  if (!start || !end) return { error: "Both start and end are required" };
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) {
    return { error: "start and end must be YYYY-MM-DD" };
  }
  const ts = Date.parse(`${start}T00:00:00Z`);
  const te = Date.parse(`${end}T00:00:00Z`);
  if (isNaN(ts) || isNaN(te)) return { error: "start and end must be valid dates" };
  if (ts >= te) return { error: "start must come before end" };
  const spanDays = (te - ts) / 86_400_000 + 1; // inclusive of both endpoints
  if (spanDays > MAX_SPAN_DAYS) {
    return { error: `Period must be ${MAX_SPAN_DAYS} days or fewer (got ${spanDays})` };
  }
  return { start, end };
}

/**
 * Pull network events for an ICCID, classify them against the plan's coverage
 * profile, and persist every event that happened in an uncovered country.
 *
 * Coverage is resolved server-side on purpose: taking a caller-supplied list of
 * covered countries would let any client mark arbitrary countries as
 * "uncovered" and poison the demand dataset.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const body = (await req.json().catch(() => ({}))) as AnyRecord;
    const credentials = resolveTelliSIMCredentials(body);

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const period = resolvePeriod(body);
    if ("error" in period) {
      return NextResponse.json({ ok: false, error: period.error }, { status: 400 });
    }

    // Both only need the ICCID, so they overlap. Coverage depends on the
    // attachment, so it has to wait for that leg.
    const [eventsRes, attachRes] = await Promise.allSettled([
      getNetworkEvents(credentials, iccid, period.start, period.end),
      getPlanAttachments(credentials, iccid),
    ]);

    if (eventsRes.status === "rejected") {
      return NextResponse.json(
        {
          ok: false,
          error: eventsRes.reason?.message || "Failed to fetch network events",
        },
        { status: 502 }
      );
    }

    const attachment =
      attachRes.status === "fulfilled" ? latestAttachment(attachRes.value) : null;
    const plan = (attachment?.plan ?? {}) as AnyRecord;
    const coverageId = plan?.coverage_id ? String(plan.coverage_id) : null;

    let covered: string[] = [];
    let coverageError: string | null = null;
    if (coverageId) {
      try {
        covered = coveredIso2From(await getCoverageProfile(credentials, coverageId));
        if (covered.length === 0) coverageError = "Coverage profile returned no countries";
      } catch (e) {
        coverageError = e instanceof Error ? e.message : "Coverage lookup failed";
      }
    } else {
      coverageError =
        attachRes.status === "rejected"
          ? "Plan attachments lookup failed — coverage unknown"
          : "No coverage ID on the plan — coverage unknown";
    }

    const analysis = analyzeNetworkEvents(eventsRes.value, covered);

    // Persist the intent signal. Never let a write failure take down the
    // support answer the agent is waiting on.
    let saved = 0;
    let saveError: string | null = null;
    if (analysis.outOfCoverage.length > 0) {
      try {
        saved = saveIntentEvents(analysis.events, covered, {
          iccid,
          coverageId,
          planName: plan?.name ? String(plan.name) : null,
          regionCode: plan?.region_code ? String(plan.region_code) : null,
          orderNumber: typeof body?.orderNumber === "string" ? body.orderNumber : null,
          customerEmail: typeof body?.customerEmail === "string" ? body.customerEmail : null,
        });
      } catch (e) {
        saveError = e instanceof Error ? e.message : "Failed to save intent events";
      }
    }

    return NextResponse.json({
      ok: true,
      period,
      verdict: analysis.verdict,
      attachedOk: analysis.attachedOk,
      dataOk: analysis.dataOk,
      countries: analysis.countries,
      coverageKnown: analysis.coverageKnown,
      coverageError,
      coveredCountries: covered,
      outOfCoverage: analysis.outOfCoverage,
      attaches: analysis.attaches,
      dataSessions: analysis.dataSessions,
      plan: {
        coverageId,
        name: plan?.name ? String(plan.name) : null,
        regionCode: plan?.region_code ? String(plan.region_code) : null,
      },
      saved,
      saveError,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}

interface IntentContext {
  iccid: string;
  coverageId: string | null;
  planName: string | null;
  regionCode: string | null;
  orderNumber: string | null;
  customerEmail: string | null;
}

/**
 * Insert one row per event that occurred outside the plan's coverage.
 * The unique index on (iccid, country, event_time, kind) makes repeat lookups
 * of an overlapping window a no-op rather than a double count.
 */
function saveIntentEvents(
  events: NormalizedNetworkEvent[],
  covered: string[],
  ctx: IntentContext
): number {
  const coveredSet = new Set(covered);
  const coveredJson = JSON.stringify(covered);
  const detectedAt = new Date();

  const rows = events
    .filter((e) => e.countryAlpha2 && e.eventTime && !coveredSet.has(e.countryAlpha2))
    .map((e) => ({
      id: randomUUID(),
      iccid: ctx.iccid,
      countryAlpha2: e.countryAlpha2 as string,
      countryName: e.countryName,
      operator: e.operator,
      kind: e.kind,
      requestType: e.requestType,
      eventTime: e.eventTime as string,
      succeeded: e.succeeded,
      coverageId: ctx.coverageId,
      planName: ctx.planName,
      regionCode: ctx.regionCode,
      coveredCountries: coveredJson,
      orderNumber: ctx.orderNumber,
      customerEmail: ctx.customerEmail,
      detectedAt,
    }));

  if (rows.length === 0) return 0;

  return db.transaction((tx) => {
    let n = 0;
    for (const row of rows) {
      const res = tx.insert(networkIntentEvents).values(row).onConflictDoNothing().run();
      n += res.changes;
    }
    return n;
  });
}
