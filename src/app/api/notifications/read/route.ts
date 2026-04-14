import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

/** PATCH /api/notifications/read — mark notifications as read */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { userId, notificationIds, markAll } = body;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "userId required" }, { status: 400 });
  }

  if (markAll) {
    db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .run();
  } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
    db.update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, notificationIds)))
      .run();
  } else {
    return NextResponse.json({ ok: false, error: "Provide notificationIds or markAll" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
