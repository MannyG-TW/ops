import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
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
    // null / "all" / <=0 → all-time (default for the canonical lifetime snapshot).
    const raw = body?.months;
    const months = raw == null || raw === "all" || Number(raw) <= 0 ? null : Number(raw);
    const result = await syncOrders({ months });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
