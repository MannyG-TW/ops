import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { opensearchConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** GET — return the saved OpenSearch config (password redacted). */
export async function GET() {
  const row = db.select().from(opensearchConfig).where(eq(opensearchConfig.id, "default")).get();
  if (!row) {
    return NextResponse.json({ ok: true, config: null });
  }
  return NextResponse.json({
    ok: true,
    config: {
      url: row.url,
      username: row.username,
      hasPassword: !!row.password,
      updatedAt: row.updatedAt,
    },
  });
}

/** PUT — upsert the singleton config row. Accepts full {url, username, password}. */
export async function PUT(req: NextRequest) {
  const { url, username, password } = await req.json();
  if (!url || !username) {
    return NextResponse.json({ ok: false, error: "url and username are required" }, { status: 400 });
  }
  const now = new Date();
  const existing = db.select().from(opensearchConfig).where(eq(opensearchConfig.id, "default")).get();
  if (existing) {
    // Only replace the password if a non-empty one was provided — preserves it across UI saves
    // where the operator hasn't re-entered it.
    db.update(opensearchConfig)
      .set({ url, username, ...(password ? { password } : {}), updatedAt: now })
      .where(eq(opensearchConfig.id, "default"))
      .run();
  } else {
    db.insert(opensearchConfig)
      .values({ id: "default", url, username, password: password || "", updatedAt: now })
      .run();
  }
  return NextResponse.json({ ok: true });
}
