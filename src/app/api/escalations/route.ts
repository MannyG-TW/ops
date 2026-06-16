import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, escalationNotes } from "@/lib/db/schema";
import { eq, desc, sql, and, or, like } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/escalations?status=new|in_review|resolved&page=1&limit=20&q=search */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const search = req.nextUrl.searchParams.get("q")?.trim() || "";
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions = [];

  if (status && ["new", "in_review", "resolved"].includes(status)) {
    conditions.push(eq(escalations.status, status));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(escalations.orderNumber, pattern),
        like(escalations.customerName, pattern),
        like(escalations.customerEmail, pattern),
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Paginated results
  const results = db
    .select()
    .from(escalations)
    .where(where)
    .orderBy(desc(escalations.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  // Total count for current filters (for pagination)
  const totalRow = db
    .select({ count: sql<number>`count(*)` })
    .from(escalations)
    .where(where)
    .get();
  const total = totalRow?.count ?? 0;

  // Count by status for tab badges (always unfiltered by search so tabs show global counts)
  const counts = db
    .select({
      status: escalations.status,
      count: sql<number>`count(*)`,
    })
    .from(escalations)
    .groupBy(escalations.status)
    .all();

  const countMap = { new: 0, in_review: 0, resolved: 0 };
  for (const c of counts) {
    countMap[c.status as keyof typeof countMap] = c.count;
  }

  return NextResponse.json({
    ok: true,
    escalations: results,
    counts: countMap,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** POST /api/escalations — create a new escalation */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    orderId,
    orderNumber,
    customerName,
    customerEmail,
    escalatedBy,
    escalatedById,
    reason,
  } = body;

  if (!orderId || !orderNumber || !customerName || !escalatedBy || !escalatedById || !reason) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const now = new Date();
  const escalationId = randomUUID();

  // Create the escalation record
  const escalation = {
    id: escalationId,
    orderId,
    orderNumber,
    customerName,
    customerEmail: customerEmail ?? "",
    status: "new" as const,
    escalatedBy,
    escalatedById,
    resolvedBy: null,
    resolvedById: null,
    resolvedAt: null,
    resolution: null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(escalations).values(escalation).run();

  // Create the initial note from the agent's reason
  const note = {
    id: randomUUID(),
    escalationId,
    authorId: escalatedById,
    authorName: escalatedBy,
    authorRole: "agent",
    content: reason,
    createdAt: now,
  };

  db.insert(escalationNotes).values(note).run();

  return NextResponse.json({ ok: true, escalation, note });
}
