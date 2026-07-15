import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import {
  INDEX_CDR_TELLISIM,
  INDEX_CDR_UCL,
  INDEX_CDR_ESIM_ARCHIVE,
  INDEX_DAILY_CONSUMPTION,
} from "@/lib/opensearch-indices";

/**
 * Get CDR data for an ICCID or IMEI.
 * Queries the correct index based on product type:
 *   - TelliSIM eSIM → tellisim-cdr-read (ICCID, TOTAL_QTY, USAGE_DATE_UTC)
 *   - MANX/VFNL eSIM → esim-archive-cdr_* (SubscriberReference, Narrative, ConnectTime)
 *   - Rental/Sapphire → ucl-sim-cdr-* (IMEI-based)
 *
 * POST body: {
 *   iccid?: string,
 *   imei?: string,
 *   productSku?: string,  // e.g. "TW_eSIM_Tellisim", "TW_eSIM_MANX", or "TW_eSIM_VFNL"
 *   credentials: { url, username, password },
 *   size?: number,
 *   from?: string (ISO date),
 *   to?: string (ISO date)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { iccid, imei, productSku, size = 500, from, to } = body;
    const credentials = resolveOpenSearchCredentials(body);
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }

    if (!iccid && !imei) {
      return NextResponse.json({ ok: false, error: "ICCID or IMEI required" }, { status: 400 });
    }

    const skuUpper = productSku?.toUpperCase() || "";
    const isLegacyEsim = skuUpper.includes("MANX") || skuUpper.includes("VFNL");
    const results: Record<string, unknown> = {};

    // USAGE_DATE_UTC format is yyyy-MM-dd'T'HH:mm:ss (no timezone, no millis)
    const cleanDate = (d?: string) => d ? d.replace(/\.\d{3}Z$/, "").replace("Z", "") : undefined;
    const cleanFrom = cleanDate(from);
    const cleanTo = cleanDate(to);

    // ─── TelliSIM CDR (standard eSIM) ───
    if (iccid && !isLegacyEsim) {
      try {
        const query: Record<string, unknown> = {
          size,
          query: {
            bool: {
              must: [{
                bool: {
                  should: [
                    { term: { ICCID: iccid } },
                    { term: { "ICCID.keyword": iccid } },
                    { match: { ICCID: { query: iccid, operator: "and" } } },
                  ],
                  minimum_should_match: 1,
                },
              }],
              ...(cleanFrom || cleanTo ? {
                filter: [{
                  range: {
                    USAGE_DATE_UTC: {
                      ...(cleanFrom ? { gte: cleanFrom } : {}),
                      ...(cleanTo ? { lte: cleanTo } : {}),
                    },
                  },
                }],
              } : {}),
            },
          },
          sort: [{ USAGE_DATE_UTC: { order: "desc" } }],
          _source: ["ICCID", "IMSI", "USAGE_DATE_UTC", "TOTAL_QTY", "ROUNDED_DATA_VOLUME", "iso2", "COUNTRY", "CUSTO_CHARGE", "PREPAID_PACKAGE_IDS", "@timestamp"],
        };

        const result = await queryOS(credentials, INDEX_CDR_TELLISIM, query);
        results.tellisim = {
          total: result.hits?.total?.value || 0,
          records: (result.hits?.hits || []).map((h: Record<string, unknown>) => ({
            id: h._id,
            ...h._source as Record<string, unknown>,
          })),
        };
      } catch (e) {
        results.tellisim = { total: 0, records: [], error: `TelliSIM CDR error: ${(e as Error).message}` };
      }
    }

    // ─── MANX/VFNL Archive CDR (legacy eSIM) ───
    if (iccid && isLegacyEsim) {
      try {
        const query: Record<string, unknown> = {
          size,
          query: {
            bool: {
              must: [{ term: { "SubscriberReference.keyword": iccid } }],
              ...(from || to ? {
                filter: [{
                  range: {
                    "ConnectTime.keyword": {
                      ...(from ? { gte: from.split("T")[0] } : {}),
                      ...(to ? { lte: to.split("T")[0] } : {}),
                    },
                  },
                }],
              } : {}),
            },
          },
          sort: [{ "ConnectTime.keyword": { order: "desc" } }],
          _source: ["SubscriberReference", "ConnectTime", "Narrative", "@timestamp"],
        };

        const result = await queryOS(credentials, INDEX_CDR_ESIM_ARCHIVE, query, { ignore_unavailable: "true", allow_no_indices: "true" });
        const records = (result.hits?.hits || []).map((h: Record<string, unknown>) => {
          const src = h._source as Record<string, unknown>;
          // Parse Narrative to extract MB: "Data: 1.23 MB used"
          const narrative = (src.Narrative || "") as string;
          const mbMatch = narrative.match(/([\d.]+)\s*MB/i);
          const gbMatch = narrative.match(/([\d.]+)\s*GB/i);
          let bytes = 0;
          if (gbMatch) bytes = parseFloat(gbMatch[1]) * 1_073_741_824;
          else if (mbMatch) bytes = parseFloat(mbMatch[1]) * 1_048_576;

          return {
            id: h._id,
            ICCID: src.SubscriberReference,
            USAGE_DATE_UTC: src.ConnectTime,
            TOTAL_QTY: bytes,
            ROUNDED_DATA_VOLUME: bytes,
            Narrative: narrative,
            "@timestamp": src["@timestamp"] || src.ConnectTime,
          };
        });

        results.tellisim = {
          total: result.hits?.total?.value || 0,
          records,
          source: "esim-archive-cdr",
        };
      } catch (e) {
        results.tellisim = { total: 0, records: [], error: `Archive CDR error: ${(e as Error).message}` };
      }
    }

    // ─── Also try TelliSIM CDR for legacy eSIM as fallback ───
    if (iccid && isLegacyEsim) {
      try {
        const query: Record<string, unknown> = {
          size: 10,
          query: { bool: { must: [{ term: { ICCID: iccid } }] } },
          _source: ["ICCID", "USAGE_DATE_UTC", "TOTAL_QTY", "ROUNDED_DATA_VOLUME", "iso2", "@timestamp"],
        };
        const result = await queryOS(credentials, INDEX_CDR_TELLISIM, query);
        if ((result.hits?.total?.value || 0) > 0) {
          results.tellisimFallback = {
            total: result.hits.total.value,
            records: (result.hits.hits || []).map((h: Record<string, unknown>) => ({
              id: h._id,
              ...h._source as Record<string, unknown>,
            })),
          };
        }
      } catch { /* ignore fallback failure */ }
    }

    // ─── Device CDR (Rental/Sapphire by IMEI) ───
    // Primary index is `logstash-cdr*` with `imei.keyword` + `flowsize` (proven pattern from
    // the BWifi usage analyzer). Fall back to `ucl-sim-cdr-*` if nothing is found, since a
    // handful of older records may still live there.
    if (imei) {
      const imeiQuery = (index: string) => queryOS(credentials, index, {
        size,
        query: {
          bool: {
            must: [{ term: { "imei.keyword": imei } }],
            ...(from || to ? {
              filter: [{ range: { "@timestamp": { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } }],
            } : {}),
          },
        },
        sort: [{ "@timestamp": { order: "desc" } }],
      }, { ignore_unavailable: "true", allow_no_indices: "true" });

      try {
        const primary = await imeiQuery("logstash-cdr*");
        const primaryTotal = primary.hits?.total?.value || 0;
        let records = (primary.hits?.hits || []).map((h: Record<string, unknown>) => {
          const src = h._source as Record<string, unknown>;
          // Normalise field names so the UI's aggregator finds bytes
          const bytes = Number(src.flowsize || src.TOTAL_QTY || src.data_volume || 0);
          return { id: h._id, ...src, TOTAL_QTY: bytes, USAGE_DATE_UTC: src["@timestamp"] || src.USAGE_DATE_UTC };
        });
        let total = primaryTotal;

        if (total === 0) {
          // Legacy fallback
          try {
            const legacy = await imeiQuery(INDEX_CDR_UCL);
            total = legacy.hits?.total?.value || 0;
            records = (legacy.hits?.hits || []).map((h: Record<string, unknown>) => {
              const src = h._source as Record<string, unknown>;
              const bytes = Number(src.flowsize || src.TOTAL_QTY || src.data_volume || 0);
              return { id: h._id, ...src, TOTAL_QTY: bytes, USAGE_DATE_UTC: src["@timestamp"] || src.USAGE_DATE_UTC };
            });
          } catch { /* ignore */ }
        }

        results.ucl = { total, records, index: total > 0 && primaryTotal > 0 ? "logstash-cdr*" : INDEX_CDR_UCL };
      } catch (e) {
        results.ucl = { total: 0, records: [], error: `Device CDR error: ${(e as Error).message}` };
      }
    }

    // ─── Daily Data Consumption (Rental/Sapphire by IMEI) ───
    if (imei) {
      try {
        const query: Record<string, unknown> = {
          size,
          query: {
            bool: {
              must: [{ term: { "imei.keyword": imei } }],
              ...(from || to ? {
                filter: [{ range: { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } }],
              } : {}),
            },
          },
          sort: [{ date: { order: "desc" } }],
        };

        const result = await queryOS(credentials, INDEX_DAILY_CONSUMPTION, query);
        results.dailyConsumption = {
          total: result.hits?.total?.value || 0,
          records: (result.hits?.hits || []).map((h: Record<string, unknown>) => ({
            id: h._id,
            ...h._source as Record<string, unknown>,
          })),
        };
      } catch {
        results.dailyConsumption = { total: 0, records: [], error: "Daily consumption index not available" };
      }
    }

    return NextResponse.json({ ok: true, cdr: results });
  } catch (err) {
    return sanitizeError(err, "OpenSearch");
  }
}
