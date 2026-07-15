import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Fetch all orders that share a given ICCID.
 * Used for plan-to-order matching and fraud/reuse detection.
 * POST body: { iccid: string, credentials: { url, username, password } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { iccid } = body;
    const credentials = resolveOpenSearchCredentials(body);
    if (!iccid) {
      return NextResponse.json({ ok: false, error: "iccid required" }, { status: 400 });
    }
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }

    const searchBody = {
      size: 50,
      query: { term: { "serials.keyword": iccid } },
      sort: [{ created_at: { order: "asc" } }],
      _source: [
        "order_number", "customer_email", "customer_name", "status",
        "created_at", "order_details_data", "product_sku", "system",
        "total", "currency_iso", "coupons",
      ],
    };

    const result = await queryOS(credentials, INDEX_ORDERS, searchBody);

    const orders = (result.hits?.hits || []).map((hit: Record<string, unknown>) => ({
      id: hit._id,
      ...hit._source as Record<string, unknown>,
    }));

    return NextResponse.json({
      ok: true,
      orders,
      total: result.hits?.total?.value || 0,
    });
  } catch (err) {
    return sanitizeError(err, "OpenSearch");
  }
}
