import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
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
    const body = await req.json().catch(() => ({}));
    const credentials = resolveOpenSearchCredentials(body);
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
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
