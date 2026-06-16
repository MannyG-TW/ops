import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { broadcasts } from "@/lib/db/schema";
import { desc, sql, and, lte, gte, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/broadcasts?active=true — list broadcasts (active-only by default) */
export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get("active") !== "false";
  const now = new Date();

  const where = activeOnly
    ? and(lte(broadcasts.startsAt, now), gte(broadcasts.endsAt, now))
    : undefined;

  const results = db
    .select()
    .from(broadcasts)
    .where(where)
    .orderBy(desc(broadcasts.createdAt))
    .all();

  return NextResponse.json({ ok: true, broadcasts: results });
}

/** POST /api/broadcasts — create a new broadcast (supervisor only) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, message, authorId, authorName, startsAt, endsAt } = body;

  if (!title || !message || !authorId || !authorName || !startsAt || !endsAt) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields" },
      { status: 400 }
    );
  }

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  if (end <= start) {
    return NextResponse.json(
      { ok: false, error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const now = new Date();
  const broadcast = {
    id: randomUUID(),
    title,
    message,
    authorId,
    authorName,
    startsAt: start,
    endsAt: end,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(broadcasts).values(broadcast).run();

  return NextResponse.json({ ok: true, broadcast });
}

/** PUT /api/broadcasts — update an existing broadcast */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { id, title, message, startsAt, endsAt } = body;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing broadcast id" },
      { status: 400 }
    );
  }

  const existing = db.select().from(broadcasts).where(eq(broadcasts.id, id)).get();
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Broadcast not found" },
      { status: 404 }
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (message !== undefined) updates.message = message;
  if (startsAt !== undefined) updates.startsAt = new Date(startsAt);
  if (endsAt !== undefined) updates.endsAt = new Date(endsAt);

  // Validate times if both provided
  const finalStart = updates.startsAt ?? existing.startsAt;
  const finalEnd = updates.endsAt ?? existing.endsAt;
  if ((finalEnd as Date) <= (finalStart as Date)) {
    return NextResponse.json(
      { ok: false, error: "End time must be after start time" },
      { status: 400 }
    );
  }

  db.update(broadcasts).set(updates).where(eq(broadcasts.id, id)).run();

  const updated = db.select().from(broadcasts).where(eq(broadcasts.id, id)).get();
  return NextResponse.json({ ok: true, broadcast: updated });
}

/** DELETE /api/broadcasts?id=xxx — delete a broadcast */
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Missing broadcast id" },
      { status: 400 }
    );
  }

  const existing = db.select().from(broadcasts).where(eq(broadcasts.id, id)).get();
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "Broadcast not found" },
      { status: 404 }
    );
  }

  db.delete(broadcasts).where(eq(broadcasts.id, id)).run();

  return NextResponse.json({ ok: true });
}
