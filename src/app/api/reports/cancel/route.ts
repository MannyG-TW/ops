import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cancelReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = ["customer_request", "duplicate_order", "fraud", "other"];

/** GET /api/reports/cancel — list recent cancel reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));

  const results = db
    .select()
    .from(cancelReports)
    .orderBy(desc(cancelReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/cancel — create a cancel report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerEmail, reason, notes, cancelledBy, cancelledById } = body;

  if (!orderId || !orderNumber || !customerEmail || !reason || !cancelledBy || !cancelledById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerEmail,
    reason,
    notes: notes || null,
    cancelledBy,
    cancelledById,
    status: "pending",
    createdAt: new Date(),
  };

  db.insert(cancelReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
