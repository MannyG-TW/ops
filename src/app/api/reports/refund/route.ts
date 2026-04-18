import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundReports, connectivityReports } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = [
  "connectivity_issues", "customer_request", "duplicate_order",
  "late_delivery", "device_malfunction", "billing_error", "other",
];

/** GET /api/reports/refund — list recent refund reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));
  const reason = req.nextUrl.searchParams.get("reason");

  const results = reason
    ? db.select().from(refundReports).where(eq(refundReports.reason, reason)).orderBy(desc(refundReports.createdAt)).limit(limit).all()
    : db.select().from(refundReports).orderBy(desc(refundReports.createdAt)).limit(limit).all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/refund — create a refund report. If reason is connectivity_issues, also creates a connectivity report. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    orderId, orderNumber, customerEmail, type, amount, currency,
    reason, country, notes, processedBy, processedById,
    telliSimData,
  } = body;

  if (!orderId || !orderNumber || !customerEmail || !type || amount == null || !currency || !reason || !processedBy || !processedById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` }, { status: 400 });
  }

  if (!["full", "partial"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Type must be 'full' or 'partial'" }, { status: 400 });
  }

  if (reason === "connectivity_issues" && !country) {
    return NextResponse.json({ ok: false, error: "Country required for connectivity issues" }, { status: 400 });
  }

  const now = new Date();

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerEmail,
    type,
    amount: Math.round(amount * 100),
    currency,
    reason,
    country: country || null,
    notes: notes || null,
    processedBy,
    processedById,
    status: "pending",
    createdAt: now,
  };

  db.insert(refundReports).values(report).run();

  // Also create a connectivity report if reason is connectivity_issues
  let connectivityReport = null;
  if (reason === "connectivity_issues" && country) {
    connectivityReport = {
      id: randomUUID(),
      orderId,
      orderNumber,
      customerEmail,
      country: country.toUpperCase(),
      reason: "no_data",
      notes: notes ? `[From refund] ${notes}` : "[Created from refund report]",
      telliSimData: telliSimData ? JSON.stringify(telliSimData) : null,
      reportedBy: processedBy,
      reportedById: processedById,
      createdAt: now,
    };
    db.insert(connectivityReports).values(connectivityReport).run();
  }

  return NextResponse.json({ ok: true, report, connectivityReport });
}
