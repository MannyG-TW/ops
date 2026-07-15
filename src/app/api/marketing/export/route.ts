import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { marketingSyncState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildWorkbook } from "@/lib/marketing/export";
import type { Criteria } from "@/lib/marketing/query";
import { marketingForbidden } from "@/lib/marketing/guard";

export const maxDuration = 120;

/** POST /api/marketing/export — criteria → .xlsx download. */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const criteria = (await req.json()) as Criteria;
    const state = db.select().from(marketingSyncState).where(eq(marketingSyncState.id, "default")).get();
    const syncedAt = state?.osSyncedAt ? new Date(state.osSyncedAt).toISOString() : undefined;

    const { buffer } = buildWorkbook(criteria, { syncedAt });
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="marketing-export-${stamp}.xlsx"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
