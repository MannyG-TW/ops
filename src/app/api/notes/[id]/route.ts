import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { internalNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** PATCH /api/notes/:id — edit note body (author only) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { authorId, body } = await req.json();

  if (!authorId || !body) {
    return NextResponse.json({ ok: false, error: "authorId and body required" }, { status: 400 });
  }

  const existing = db.select().from(internalNotes).where(eq(internalNotes.id, id)).get();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Note not found" }, { status: 404 });
  }

  if (existing.authorId !== authorId) {
    return NextResponse.json({ ok: false, error: "Can only edit your own notes" }, { status: 403 });
  }

  db.update(internalNotes)
    .set({ body, updatedAt: new Date() })
    .where(eq(internalNotes.id, id))
    .run();

  return NextResponse.json({ ok: true });
}

/** DELETE /api/notes/:id — admin can delete any, members only their own */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const role = req.nextUrl.searchParams.get("role") ?? "agent";
  const authorId = req.nextUrl.searchParams.get("authorId") ?? "";

  const existing = db.select().from(internalNotes).where(eq(internalNotes.id, id)).get();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Note not found" }, { status: 404 });
  }

  // Admins can delete any note; others can only delete their own
  if (role !== "admin" && existing.authorId !== authorId) {
    return NextResponse.json({ ok: false, error: "Not authorized to delete this note" }, { status: 403 });
  }

  db.delete(internalNotes).where(eq(internalNotes.id, id)).run();

  return NextResponse.json({ ok: true });
}
