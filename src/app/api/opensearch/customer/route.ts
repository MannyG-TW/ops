import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Get all orders for a customer by email.
 * POST body: { email: string, size?: number }.
 * OpenSearch credentials are read server-side from the DB (never the body).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, size = 200 } = body;
    const credentials = resolveOpenSearchCredentials(body);
    if (!email) {
      return NextResponse.json({ ok: false, error: "email required" }, { status: 400 });
    }
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }

    const searchBody = {
      size,
      query: {
        bool: {
          should: [
            { term: { "customer_email.keyword": email.toLowerCase() } },
            { term: { "customer_email.keyword": email } },
            // Case-insensitive fallback
            { match: { customer_email: { query: email, operator: "and" } } },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ created_at: { order: "desc" } }],
    };

    const result = await queryOS(credentials, INDEX_ORDERS, searchBody);

    const orders = result.hits?.hits?.map((hit: Record<string, unknown>) => ({
      id: hit._id,
      ...hit._source as Record<string, unknown>,
    })) || [];

    // Extract customer info from the first order. The index stores a single
    // customer_name field (no first/last split), so derive both from it.
    const firstOrder = orders[0];
    const rawName = String(firstOrder?.customer_name || "").trim();
    const nameParts = rawName.split(/\s+/).filter(Boolean);
    const customer = firstOrder
      ? {
          email: firstOrder.customer_email,
          name: rawName,
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" "),
          totalOrders: result.hits?.total?.value || 0,
        }
      : null;

    return NextResponse.json({
      ok: true,
      customer,
      orders,
      total: result.hits?.total?.value || 0,
    });
  } catch (err) {
    return sanitizeError(err, "OpenSearch");
  }
}
