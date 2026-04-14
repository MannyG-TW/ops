import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
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
 *   - MANX eSIM → esim-archive-cdr_* (SubscriberReference, Narrative, ConnectTime)
 *   - Rental/Sapphire → ucl-sim-cdr-* (IMEI-based)
 *
 * POST body: {
 *   iccid?: string,
 *   imei?: string,
 *   productSku?: string,  // e.g. "TW_eSIM_Tellisim" or "TW_eSIM_MANX"
 *   credentials: { url, username, password },
 *   size?: number,
 *   from?: string (ISO date),
 *   to?: string (ISO date)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { iccid, imei, productSku, credentials, size = 500, from, to } = await req.json();

    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "Credentials required" }, { status: 400 });
    }

    if (!iccid && !imei) {
      return NextResponse.json({ ok: false, error: "ICCID or IMEI required" }, { status: 400 });
    }

    const isManx = productSku?.toUpperCase()?.includes("MANX");
    const results: Record<string, unknown> = {};

    // USAGE_DATE_UTC format is yyyy-MM-dd'T'HH:mm:ss (no timezone, no millis)
    const cleanDate = (d?: string) => d ? d.replace(/\.\d{3}Z$/, "").replace("Z", "") : undefined;
    const cleanFrom = cleanDate(from);
    const cleanTo = cleanDate(to);

    // ─── TelliSIM CDR (standard eSIM) ───
    if (iccid && !isManx) {
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

    // ─── MANX/Archive CDR (legacy eSIM) ───
    if (iccid && isManx) {
      try {
        const query: Record<string, unknown> = {
          size,
          query: {
            bool: {
              must: [{ term: { "SubscriberReference.keyword": iccid } }],
              ...(from || to ? {
                filter: [{
                  range: {
                    ConnectTime: {
                      ...(from ? { gte: from.split("T")[0] } : {}),
                      ...(to ? { lte: to.split("T")[0] } : {}),
                    },
                  },
                }],
              } : {}),
            },
          },
          sort: [{ ConnectTime: { order: "desc" } }],
          _source: ["SubscriberReference", "ConnectTime", "Narrative", "@timestamp"],
        };

        const result = await queryOS(credentials, INDEX_CDR_ESIM_ARCHIVE, query);
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
      } catch {
        results.tellisim = { total: 0, records: [], error: "Archive CDR index not available" };
      }
    }

    // ─── Also try TelliSIM CDR for MANX as fallback ───
    if (iccid && isManx) {
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

    // ─── UCL CDR (Rental/Sapphire by IMEI) ───
    if (imei) {
      try {
        const query: Record<string, unknown> = {
          size,
          query: {
            bool: {
              must: [{
                bool: {
                  should: [
                    { match: { user_code: imei } },
                    { term: { "imei.keyword": imei } },
                  ],
                  minimum_should_match: 1,
                },
              }],
              ...(from || to ? {
                filter: [{ range: { "@timestamp": { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } }],
              } : {}),
            },
          },
          sort: [{ "@timestamp": { order: "desc" } }],
        };

        const result = await queryOS(credentials, INDEX_CDR_UCL, query);
        results.ucl = {
          total: result.hits?.total?.value || 0,
          records: (result.hits?.hits || []).map((h: Record<string, unknown>) => ({
            id: h._id,
            ...h._source as Record<string, unknown>,
          })),
        };
      } catch {
        results.ucl = { total: 0, records: [], error: "UCL CDR index not available" };
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
