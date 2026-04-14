import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Get a single order by order_number or document ID.
 * POST body: { credentials: { url, username, password } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { credentials } = await req.json();

    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "Credentials required" }, { status: 400 });
    }

    const searchBody = {
      size: 1,
      query: {
        bool: {
          should: [
            { term: { "order_number.keyword": id } },
            { term: { _id: id } },
          ],
          minimum_should_match: 1,
        },
      },
    };

    const result = await queryOS(credentials, INDEX_ORDERS, searchBody);
    const hit = result.hits?.hits?.[0];

    if (!hit) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      order: { id: hit._id, ...hit._source },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
