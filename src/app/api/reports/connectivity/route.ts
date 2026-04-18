import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connectivityReports } from "@/lib/db/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = ["no_data", "intermittent", "slow_speeds", "cannot_register", "other"];

/** GET /api/reports/connectivity?country=JP&hours=48 — list connectivity reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)));
  const country = req.nextUrl.searchParams.get("country");
  const hours = parseInt(req.nextUrl.searchParams.get("hours") || "0", 10);

  const conditions = [];
  if (country) {
    conditions.push(eq(connectivityReports.country, country.toUpperCase()));
  }
  if (hours > 0) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    conditions.push(gte(connectivityReports.createdAt, since));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = db
    .select()
    .from(connectivityReports)
    .where(where)
    .orderBy(desc(connectivityReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/connectivity — create a connectivity report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerEmail, country, reason, notes, telliSimData, reportedBy, reportedById } = body;

  if (!orderId || !orderNumber || !customerEmail || !country || !reason || !reportedBy || !reportedById) {
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
    country: country.toUpperCase(),
    reason,
    notes: notes || null,
    telliSimData: telliSimData ? JSON.stringify(telliSimData) : null,
    reportedBy,
    reportedById,
    createdAt: new Date(),
  };

  db.insert(connectivityReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
