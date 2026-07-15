import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { marketingCustomerSegments as MCS } from "@/lib/db/schema";
import { buildMatcher } from "@/lib/marketing/exclusions";
import { marketingForbidden } from "@/lib/marketing/guard";

/**
 * POST /api/marketing/exclusions/impact { domains?: string[], names?: string[] }
 * Returns how many CURRENT customers the given rule(s) would catch — used to
 * preview a candidate exclusion (or the whole rule set) before trusting it.
 */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const { domains = [], names = [] } = await req.json();
    const matcher = buildMatcher(
      domains.map((d: string) => ({ domain: String(d) })),
      names.map((n: string) => ({ name: String(n) })),
    );
    const rows = db.selectDistinct({ email: MCS.email, name: MCS.name }).from(MCS).all();
    const matched: { email: string; name: string; reason: string }[] = [];
    for (const r of rows) {
      const reason = matcher.reason(r.email, r.name);
      if (reason) matched.push({ email: r.email, name: r.name, reason });
    }
    return NextResponse.json({ ok: true, count: matched.length, sample: matched.slice(0, 50) });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
