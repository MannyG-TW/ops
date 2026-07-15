import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { excludedNames } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getExclusions } from "@/lib/marketing/exclusions";
import { marketingForbidden } from "@/lib/marketing/guard";

/** GET — list excluded names. */
export async function GET(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  const { names } = getExclusions();
  return NextResponse.json({ ok: true, names });
}

/** POST { name, note?, createdBy? } — add an excluded name. */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const { name, note, createdBy, variants } = await req.json();
    const clean = String(name || "").trim();
    if (!clean) return NextResponse.json({ ok: false, error: "Name required" }, { status: 400 });
    db.insert(excludedNames)
      .values({
        id: randomUUID(), name: clean, variants: variants !== false,
        note: note ?? null, createdAt: new Date(), createdBy: createdBy ?? null,
      })
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}

/** DELETE ?id=… — remove an excluded name. */
export async function DELETE(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.delete(excludedNames).where(eq(excludedNames.id, id)).run();
  return NextResponse.json({ ok: true });
}
