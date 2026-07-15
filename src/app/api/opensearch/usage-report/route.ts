import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";

/**
 * Generate BWifi usage report from logstash-cdr* indices.
 *
 * Aggregates `flowsize` per IMEI per day across logstash-cdr{YYYY.MM.DD} indices.
 * Handles batching of IMEIs to avoid overloading OpenSearch.
 *
 * Each "day" is counted noon-to-noon (12:00 UTC to 12:00 UTC next day).
 * For example, "March 1" = March 1 12:00 UTC → March 2 12:00 UTC.
 *
 * POST body: {
 *   imeis: string[],
 *   from: string (YYYY-MM-DD),
 *   to: string (YYYY-MM-DD),
 *   noonToNoon?: boolean (default true),
 *   credentials: { url, username, password }
 * }
 *
 * Response: {
 *   ok: true,
 *   data: { [imei: string]: { [date: string]: number } },
 *   dates: string[],  // sorted list of all dates in range
 *   totalImeis: number,
 *   summary: { totalBytes, avgDaysWithUsage, avgDaysWithoutUsage }
 * }
 */

const BATCH_SIZE = 100;

/**
 * Generate logstash-cdr index pattern for a date range.
 * When noonToNoon is true, we need +1 extra day at the end because
 * the last "day" (e.g. Apr 4) runs from Apr 4 12:00 → Apr 5 12:00,
 * so data lives in the Apr 5 index too.
 */
function buildIndexPattern(from: string, to: string, noonToNoon: boolean): string {
  const indices: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  if (noonToNoon) {
    end.setUTCDate(end.getUTCDate() + 1);
  }

  const current = new Date(start);
  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    indices.push(`logstash-cdr${y}.${m}.${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return indices.join(",");
}

/** Generate sorted date strings for the range */
function buildDateList(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");

  const current = new Date(start);
  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

async function queryBatch(
  credentials: { url: string; username: string; password: string },
  indexPattern: string,
  imeiBatch: string[],
  noonToNoon: boolean,
  validDates: Set<string>
): Promise<Record<string, Record<string, number>>> {
  const dateHistogramConfig: Record<string, unknown> = {
    field: "@timestamp",
    calendar_interval: "day",
    format: "yyyy-MM-dd",
  };
  // Shift bucket boundaries from midnight to noon
  if (noonToNoon) {
    dateHistogramConfig.offset = "+12h";
  }

  const query = {
    size: 0,
    query: {
      terms: { "imei.keyword": imeiBatch },
    },
    aggs: {
      by_imei: {
        terms: { field: "imei.keyword", size: imeiBatch.length },
        aggs: {
          by_date: {
            date_histogram: dateHistogramConfig,
            aggs: {
              daily_bytes: { sum: { field: "flowsize" } },
            },
          },
        },
      },
    },
  };

  const result = await queryOS(
    credentials,
    indexPattern,
    query,
    { ignore_unavailable: "true", allow_no_indices: "true" },
    30000
  );

  const data: Record<string, Record<string, number>> = {};

  const buckets = result.aggregations?.by_imei?.buckets || [];
  for (const imeiBucket of buckets) {
    const imei = imeiBucket.key as string;
    data[imei] = {};
    for (const dateBucket of imeiBucket.by_date?.buckets || []) {
      const date = dateBucket.key_as_string as string;
      // Filter out buckets outside the requested date range (noon offset can create extras)
      if (!validDates.has(date)) continue;
      data[imei][date] = dateBucket.daily_bytes?.value || 0;
    }
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imeis, from, to, noonToNoon = true } = body;
    const credentials = resolveOpenSearchCredentials(body);

    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }
    if (!imeis || !Array.isArray(imeis) || imeis.length === 0) {
      return NextResponse.json({ ok: false, error: "IMEIs array required" }, { status: 400 });
    }
    // Validate date shape and range before they reach the index-pattern
    // builder — a malformed date yields an empty index pattern (which would
    // fan a query across the whole cluster) and a silently all-zero report.
    const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (typeof from !== "string" || typeof to !== "string" || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return NextResponse.json({ ok: false, error: "from and to must be YYYY-MM-DD dates" }, { status: 400 });
    }
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to}T00:00:00Z`);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      return NextResponse.json({ ok: false, error: "from or to is not a valid date" }, { status: 400 });
    }
    // Reject nonexistent calendar dates: Date.parse("2026-02-30") silently rolls
    // over to Mar 2, which would query dates the caller never asked for.
    if (
      new Date(fromMs).toISOString().slice(0, 10) !== from ||
      new Date(toMs).toISOString().slice(0, 10) !== to
    ) {
      return NextResponse.json({ ok: false, error: "from or to is not a real calendar date" }, { status: 400 });
    }
    if (fromMs > toMs) {
      return NextResponse.json({ ok: false, error: "from must be on or before to" }, { status: 400 });
    }
    const MAX_RANGE_DAYS = 92;
    if ((toMs - fromMs) / 86_400_000 > MAX_RANGE_DAYS) {
      return NextResponse.json({ ok: false, error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
    }

    const dates = buildDateList(from, to);
    const validDates = new Set(dates);
    const indexPattern = buildIndexPattern(from, to, noonToNoon);
    if (!indexPattern) {
      return NextResponse.json({ ok: false, error: "Empty date range" }, { status: 400 });
    }

    // Deduplicate IMEIs (guarding against non-string entries)
    const uniqueImeis = [...new Set(
      imeis.filter((i): i is string => typeof i === "string").map((i) => i.trim()).filter(Boolean)
    )];
    if (uniqueImeis.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid IMEIs provided" }, { status: 400 });
    }

    // Query in batches
    const allData: Record<string, Record<string, number>> = {};
    const warnings: string[] = [];

    // Initialize all IMEIs with empty data
    for (const imei of uniqueImeis) {
      allData[imei] = {};
    }

    const totalBatches = Math.ceil(uniqueImeis.length / BATCH_SIZE);
    for (let i = 0; i < uniqueImeis.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = uniqueImeis.slice(i, i + BATCH_SIZE);
      try {
        const batchData = await queryBatch(credentials, indexPattern, batch, noonToNoon, validDates);
        for (const [imei, dateMap] of Object.entries(batchData)) {
          allData[imei] = dateMap;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`Batch ${batchNum}/${totalBatches} failed:`, msg);
        warnings.push(`Batch ${batchNum}/${totalBatches} failed (${batch.length} IMEIs may show 0): ${msg}`);
      }
    }

    // Calculate summary
    let totalBytes = 0;
    let totalDaysWithUsage = 0;
    let totalDaysWithoutUsage = 0;

    for (const imei of uniqueImeis) {
      const dateMap = allData[imei] || {};
      let daysWithUsage = 0;
      for (const date of dates) {
        const bytes = dateMap[date] || 0;
        totalBytes += bytes;
        if (bytes > 0) {
          daysWithUsage++;
        }
      }
      totalDaysWithUsage += daysWithUsage;
      totalDaysWithoutUsage += dates.length - daysWithUsage;
    }

    const imeiCount = uniqueImeis.length;

    return NextResponse.json({
      ok: true,
      data: allData,
      dates,
      totalImeis: imeiCount,
      duplicatesRemoved: imeis.length - imeiCount,
      ...(warnings.length > 0 ? { warnings } : {}),
      summary: {
        totalBytes,
        avgDaysWithUsage: imeiCount > 0 ? +(totalDaysWithUsage / imeiCount).toFixed(1) : 0,
        avgDaysWithoutUsage: imeiCount > 0 ? +(totalDaysWithoutUsage / imeiCount).toFixed(1) : 0,
      },
    });
  } catch (err) {
    return sanitizeError(err, "OpenSearch");
  }
}
