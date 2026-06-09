import { NextRequest, NextResponse } from "next/server";
import { searchCustomers } from "@/lib/marketing/query";
import { marketingForbidden } from "@/lib/marketing/guard";

/** GET /api/marketing/customers?q=&variants=true&limit=200 — name/email search. */
export async function GET(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q") ?? "";
    const variants = sp.get("variants") !== "false";
    const limit = Math.min(Number(sp.get("limit") ?? 200) || 200, 1000);
    const results = searchCustomers(q, { variants, limit });
    return NextResponse.json({ ok: true, results, total: results.length });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
