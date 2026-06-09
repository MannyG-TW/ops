import { NextRequest, NextResponse } from "next/server";
import { syncOrders } from "@/lib/marketing/sync";
import { marketingForbidden } from "@/lib/marketing/guard";

// Scrolling the full orders index takes ~60s.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST /api/marketing/sync — rebuild the local purchaser snapshot from OpenSearch. */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const months = Number(body?.months ?? 24);
    const result = await syncOrders({ months });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
