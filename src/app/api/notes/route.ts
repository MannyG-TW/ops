import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalNotes, notifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/notes?customerId=xxx */
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "customerId required" }, { status: 400 });
  }

  const notes = db
    .select()
    .from(internalNotes)
    .where(eq(internalNotes.customerId, customerId))
    .orderBy(desc(internalNotes.createdAt))
    .all();

  return NextResponse.json({ ok: true, notes });
}

/** POST /api/notes */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, authorId, authorName, body: noteBody, mentions } = body;

  if (!customerId || !authorId || !authorName || !noteBody) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const noteId = randomUUID();
  const note = {
    id: noteId,
    customerId,
    authorId,
    authorName,
    body: noteBody,
    mentions: JSON.stringify(mentions ?? []),
    createdAt: new Date(),
  };

  db.insert(internalNotes).values(note).run();

  // Create notifications for each mentioned user (skip self-mentions)
  const mentionList: string[] = mentions ?? [];
  for (const mentionedUserId of mentionList) {
    if (mentionedUserId === authorId) continue;
    db.insert(notifications)
      .values({
        id: randomUUID(),
        userId: mentionedUserId,
        type: "mention",
        title: "You were mentioned in a note",
        message: noteBody.length > 120 ? noteBody.slice(0, 120) + "..." : noteBody,
        link: `/customers/${encodeURIComponent(customerId)}`,
        sourceType: "note",
        sourceId: noteId,
        actorId: authorId,
        actorName: authorName,
        readAt: null,
        createdAt: new Date(),
      })
      .run();
  }

  return NextResponse.json({ ok: true, note: { ...note, mentions: mentionList } });
}
