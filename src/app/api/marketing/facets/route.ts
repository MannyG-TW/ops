import { NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { marketingSyncState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getFacets } from "@/lib/marketing/query";
import { marketingForbidden } from "@/lib/marketing/guard";

/** GET /api/marketing/facets — filter options + last-sync state for the console. */
export async function GET(req: Request) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const facets = getFacets();
    const state = db.select().from(marketingSyncState).where(eq(marketingSyncState.id, "default")).get() ?? null;
    return NextResponse.json({ ok: true, facets, state });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
