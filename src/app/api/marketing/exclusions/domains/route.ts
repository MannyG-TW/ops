import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { excludedDomains } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getExclusions } from "@/lib/marketing/exclusions";
import { marketingForbidden } from "@/lib/marketing/guard";

/** GET — list excluded domains (seeds from JSON on first call). */
export async function GET(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  const { domains } = getExclusions();
  return NextResponse.json({ ok: true, domains });
}

/** POST { domain, note?, createdBy? } — add an excluded domain. */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const { domain, note, createdBy } = await req.json();
    const clean = String(domain || "").toLowerCase().trim().replace(/^@/, "");
    if (!clean || !clean.includes(".")) {
      return NextResponse.json({ ok: false, error: "Enter a valid domain (e.g. example.com)" }, { status: 400 });
    }
    db.insert(excludedDomains)
      .values({ id: randomUUID(), domain: clean, note: note ?? null, createdAt: new Date(), createdBy: createdBy ?? null })
      .onConflictDoNothing()
      .run();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}

/** DELETE ?id=… — remove an excluded domain. */
export async function DELETE(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  db.delete(excludedDomains).where(eq(excludedDomains.id, id)).run();
  return NextResponse.json({ ok: true });
}
