import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/notifications?userId=xxx — fetch notifications for a user */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });
  }

  const unreadOnly = req.nextUrl.searchParams.get("unreadOnly") === "true";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "50"), 100);

  const conditions = unreadOnly
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt))
    : eq(notifications.userId, userId);

  const results = db
    .select()
    .from(notifications)
    .where(conditions)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .all();

  const unreadCount = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .all().length;

  return NextResponse.json({ ok: true, notifications: results, unreadCount });
}

/** POST /api/notifications — create a notification */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, type, title, message, link, sourceType, sourceId, actorId, actorName } = body;

  if (!userId || !type || !title || !message) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const notification = {
    id: randomUUID(),
    userId,
    type,
    title,
    message,
    link: link ?? null,
    sourceType: sourceType ?? null,
    sourceId: sourceId ?? null,
    actorId: actorId ?? null,
    actorName: actorName ?? null,
    readAt: null,
    createdAt: new Date(),
  };

  db.insert(notifications).values(notification).run();

  return NextResponse.json({ ok: true, notification });
}
