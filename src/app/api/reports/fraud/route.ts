import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fraudReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/reports/fraud — list recent fraud reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));

  const results = db
    .select()
    .from(fraudReports)
    .orderBy(desc(fraudReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/fraud — create a fraud report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerName, customerEmail, notes, reportedBy, reportedById } = body;

  if (!orderId || !orderNumber || !customerName || !customerEmail || !notes || !reportedBy || !reportedById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerName,
    customerEmail,
    notes,
    reportedBy,
    reportedById,
    createdAt: new Date(),
  };

  db.insert(fraudReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
