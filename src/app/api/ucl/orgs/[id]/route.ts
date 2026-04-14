import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uclOrgs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** PATCH /api/ucl/orgs/[id] — Update an org (password, isActive) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = db.select().from(uclOrgs).where(eq(uclOrgs.id, id)).get();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Org not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.password !== undefined) updates.password = body.password;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.orgName !== undefined) updates.orgName = body.orgName;

  db.update(uclOrgs).set(updates).where(eq(uclOrgs.id, id)).run();

  const updated = db.select().from(uclOrgs).where(eq(uclOrgs.id, id)).get();
  return NextResponse.json({ ok: true, org: updated });
}

/** DELETE /api/ucl/orgs/[id] — Remove an org */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const existing = db.select().from(uclOrgs).where(eq(uclOrgs.id, id)).get();
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Org not found" }, { status: 404 });
  }

  db.delete(uclOrgs).where(eq(uclOrgs.id, id)).run();
  return NextResponse.json({ ok: true });
}
