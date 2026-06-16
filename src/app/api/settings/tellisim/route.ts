import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tellisimConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET — return saved TelliSIM config (apiKey redacted). */
export async function GET() {
  const row = db.select().from(tellisimConfig).where(eq(tellisimConfig.id, "default")).get();
  if (!row) return NextResponse.json({ ok: true, config: null });
  return NextResponse.json({
    ok: true,
    config: {
      baseUrl: row.baseUrl,
      orgId: row.orgId,
      hasApiKey: !!row.apiKey,
      updatedAt: row.updatedAt,
    },
  });
}

/** PUT — upsert the singleton config row. */
export async function PUT(req: NextRequest) {
  const { baseUrl, apiKey, orgId } = await req.json();
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: "baseUrl is required" }, { status: 400 });
  }
  const now = new Date();
  const existing = db.select().from(tellisimConfig).where(eq(tellisimConfig.id, "default")).get();
  if (existing) {
    db.update(tellisimConfig)
      .set({ baseUrl, orgId: orgId || "", ...(apiKey ? { apiKey } : {}), updatedAt: now })
      .where(eq(tellisimConfig.id, "default"))
      .run();
  } else {
    db.insert(tellisimConfig)
      .values({ id: "default", baseUrl, orgId: orgId || "", apiKey: apiKey || "", updatedAt: now })
      .run();
  }
  return NextResponse.json({ ok: true });
}
