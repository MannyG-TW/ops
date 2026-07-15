import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { db } from "@/lib/db";
import { marketingCustomerSegments as MCS } from "@/lib/db/schema";
import { buildMatcher } from "@/lib/marketing/exclusions";
import { nameTokens, expandVariants } from "@/lib/marketing/names";
import { marketingForbidden } from "@/lib/marketing/guard";

/**
 * POST /api/marketing/exclusions/name-preview { value, variants }
 * For the exclude modal: shows the variant expansion that WILL be matched and
 * how many current customers the rule catches (with a sample), before saving.
 */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  try {
    const { value, variants = true } = await req.json();
    const raw = String(value || "").trim();
    if (!raw) return NextResponse.json({ ok: true, isEmail: false, words: [], count: 0, sample: [] });

    const isEmail = raw.includes("@");
    // Per-word variant expansion (only meaningful for names with variants on).
    const words = isEmail || !variants
      ? []
      : nameTokens(raw).map((w) => ({ word: w, expansions: [...expandVariants(w)].filter((v) => v !== w).sort() }));

    const matcher = buildMatcher([], [{ name: raw, variants }]);
    const rows = db.selectDistinct({ email: MCS.email, name: MCS.name }).from(MCS).all();
    const matched: { email: string; name: string }[] = [];
    for (const r of rows) {
      if (matcher.reason(r.email, r.name)) matched.push({ email: r.email, name: r.name });
    }
    return NextResponse.json({ ok: true, isEmail, words, count: matched.length, sample: matched.slice(0, 25) });
  } catch (err) {
    return sanitizeError(err, "Request");
  }
}
