import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { runCriteria, type Criteria } from "@/lib/marketing/query";
import { marketingForbidden } from "@/lib/marketing/guard";

/** POST /api/marketing/preview — criteria → counts + a capped sample of sendable rows. */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const criteria = (await req.json()) as Criteria;
    const { sendable, unsubscribed, excluded, counts } = runCriteria(criteria);
    return NextResponse.json({
      ok: true,
      counts,
      sample: sendable.slice(0, 100),
      unsubscribedSample: unsubscribed.slice(0, 25),
      excludedSample: excluded.slice(0, 25),
    });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
