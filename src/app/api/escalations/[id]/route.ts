import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { escalations, escalationNotes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/escalations/[id] — get escalation with notes */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const escalation = db
    .select()
    .from(escalations)
    .where(eq(escalations.id, id))
    .get();

  if (!escalation) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const notes = db
    .select()
    .from(escalationNotes)
    .where(eq(escalationNotes.escalationId, id))
    .orderBy(desc(escalationNotes.createdAt))
    .all();

  return NextResponse.json({ ok: true, escalation, notes });
}

/** PATCH /api/escalations/[id] — update status, add note, resolve */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { status, resolution, resolvedBy, resolvedById, note, authorId, authorName, authorRole } = body;

  const existing = db
    .select()
    .from(escalations)
    .where(eq(escalations.id, id))
    .get();

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const now = new Date();

  // Update escalation fields
  const updates: Record<string, unknown> = { updatedAt: now };

  if (status && ["new", "in_review", "resolved"].includes(status)) {
    updates.status = status;

    if (status === "resolved") {
      updates.resolvedBy = resolvedBy ?? null;
      updates.resolvedById = resolvedById ?? null;
      updates.resolvedAt = now;
      updates.resolution = resolution ?? null;
    }
  }

  db.update(escalations)
    .set(updates)
    .where(eq(escalations.id, id))
    .run();

  // Add a note if provided
  let newNote = null;
  if (note && authorId && authorName && authorRole) {
    newNote = {
      id: randomUUID(),
      escalationId: id,
      authorId,
      authorName,
      authorRole,
      content: note,
      createdAt: now,
    };
    db.insert(escalationNotes).values(newNote).run();
  }

  // Return updated escalation
  const updated = db
    .select()
    .from(escalations)
    .where(eq(escalations.id, id))
    .get();

  return NextResponse.json({ ok: true, escalation: updated, note: newNote });
}
