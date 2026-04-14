import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Get all orders for a customer by email.
 * POST body: { email: string, credentials: { url, username, password }, size?: number }
 */
export async function POST(req: NextRequest) {
  try {
    const { email, credentials, size = 50 } = await req.json();

    if (!email || !credentials?.url) {
      return NextResponse.json({ ok: false, error: "Email and credentials required" }, { status: 400 });
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

    // Extract customer info from the first order
    const firstOrder = orders[0];
    const customer = firstOrder
      ? {
          email: firstOrder.customer_email,
          firstName: firstOrder.customer_first_name,
          lastName: firstOrder.customer_last_name,
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
