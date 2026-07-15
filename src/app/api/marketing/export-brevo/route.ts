import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { buildBrevoCsv } from "@/lib/marketing/brevo";
import { marketingForbidden } from "@/lib/marketing/guard";

// Scans the full purchaser + Omnisend snapshot (~230k rows) and serializes a CSV.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** POST /api/marketing/export-brevo — canonical Noomi contact list → UTF-8 CSV download.
 *  Body: { runDate?: "YYYY-MM-DD" } (drives RECENCY_BUCKET; defaults to today).
 *  The reconciliation summary rides back in the X-Brevo-Summary header (URL-encoded JSON). */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as { runDate?: string };
    const parsed = body?.runDate ? new Date(body.runDate) : new Date();
    const runDate = isNaN(parsed.getTime()) ? new Date() : parsed;

    const { csv, summary } = buildBrevoCsv({ runDate });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="noomi-brevo-contacts-${summary.runDate}.csv"`,
        "X-Brevo-Summary": encodeURIComponent(JSON.stringify(summary)),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
