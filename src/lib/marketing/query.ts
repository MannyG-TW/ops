/**
 * Query layer for the marketing console — all reads hit local SQLite
 * (marketing_customer_segments ⋈ marketing_contacts), never OpenSearch.
 *
 *   searchCustomers — name/email search with variant matching
 *   getFacets       — distinct segments / systems / destinations for filters
 *   runCriteria     — criteria → sendable / unsubscribed / excluded buckets
 */

import { db } from "@/lib/db";
import { marketingCustomerSegments as MCS, marketingContacts as MC } from "@/lib/db/schema";
import { and, or, eq, gte, lte, like, inArray, sql } from "drizzle-orm";
import { nameMatches, expandVariants, nameTokens } from "./names";
import { getExclusions, buildMatcher } from "./exclusions";

const isoDate = (sec: number | null | undefined) =>
  sec ? new Date(Number(sec) * 1000).toISOString().slice(0, 10) : "";

function buildMatcherFromDb() {
  const { domains, names } = getExclusions();
  return buildMatcher(domains, names);
}

/* ─────────────────────────── SEARCH ─────────────────────────── */

export interface CustomerHit {
  email: string; name: string; firstName: string; phone: string; system: string;
  segments: string[]; orders: number; totalSpentUsd: number; lastPurchase: string;
  destinations: string; inOmnisend: boolean; emailStatus: string; excludedReason: string;
}

export function searchCustomers(query: string, opts: { variants?: boolean; limit?: number } = {}): CustomerHit[] {
  const q = (query || "").trim();
  if (!q) return [];
  const variants = opts.variants !== false;
  const limit = opts.limit ?? 200;

  // Broad SQL prefilter: email substring OR name LIKE any variant of any token.
  const conds = [like(MC.email, `%${q.toLowerCase()}%`)];
  for (const tok of nameTokens(q)) {
    const variantSet = variants ? expandVariants(tok) : new Set([tok]);
    for (const v of variantSet) conds.push(like(MCS.name, `%${v}%`));
  }

  const rows = db
    .select({
      email: MCS.email, name: MCS.name, firstName: MCS.firstName, phone: MCS.phone,
      system: MCS.system, segment: MCS.segment, orders: MCS.orders,
      totalSpentUsd: MCS.totalSpentUsd, lastPurchase: MCS.lastPurchase, destinations: MCS.destinations,
      emailStatus: MC.emailStatus,
    })
    .from(MCS)
    .leftJoin(MC, eq(MCS.email, MC.email))
    .where(or(...conds))
    .all();

  const matcher = buildMatcherFromDb();

  const byEmail = new Map<string, CustomerHit>();
  for (const r of rows) {
    if (!nameMatches(`${r.name} ${r.email}`, q, variants)) continue;
    let hit = byEmail.get(r.email);
    if (!hit) {
      hit = {
        email: r.email, name: r.name, firstName: r.firstName, phone: r.phone, system: r.system,
        segments: [], orders: 0, totalSpentUsd: 0, lastPurchase: "", destinations: "",
        inOmnisend: r.emailStatus != null, emailStatus: r.emailStatus || "Not in Omnisend",
        excludedReason: matcher.reason(r.email, [r.name, r.firstName].filter(Boolean).join(" ")),
      };
      byEmail.set(r.email, hit);
    }
    if (!hit.segments.includes(r.segment)) hit.segments.push(r.segment);
    hit.orders += r.orders;
    hit.totalSpentUsd += r.totalSpentUsd;
    const d = isoDate(r.lastPurchase);
    if (d > hit.lastPurchase) hit.lastPurchase = d;
    const destSet = new Set([...hit.destinations.split(", "), ...r.destinations.split(", ")].filter(Boolean));
    hit.destinations = [...destSet].sort().join(", ");
  }

  return [...byEmail.values()]
    .map((h) => ({ ...h, totalSpentUsd: Math.round(h.totalSpentUsd * 100) / 100, segments: h.segments.sort() }))
    .sort((a, b) => b.lastPurchase.localeCompare(a.lastPurchase) || b.totalSpentUsd - a.totalSpentUsd)
    .slice(0, limit);
}

/* ─────────────────────────── FACETS ─────────────────────────── */

export function getFacets(): { segments: string[]; systems: string[]; destinations: string[] } {
  const segRows = db.selectDistinct({ segment: MCS.segment }).from(MCS).all();
  const sysRows = db.selectDistinct({ system: MCS.system }).from(MCS).all();
  const destRows = db.select({ destinations: MCS.destinations }).from(MCS).all();

  const destSet = new Set<string>();
  for (const r of destRows) for (const d of r.destinations.split(", ")) if (d) destSet.add(d);

  return {
    segments: segRows.map((r) => r.segment).filter(Boolean).sort(),
    systems: sysRows.map((r) => r.system).filter(Boolean).sort(),
    destinations: [...destSet].sort(),
  };
}

/* ─────────────────────────── CRITERIA ─────────────────────────── */

export interface Criteria {
  segments?: string[];
  destination?: string;
  monthsBack?: number | null;
  systems?: string[];
  subscription?: "any" | "exclude_unsub" | "subscribed_only";
  minSpend?: number | null;
  maxSpend?: number | null;
}

export interface ExportRow {
  firstName: string; customerName: string; email: string; phone: string; system: string;
  segment: string; alsoBought: string; firstPurchase: string; lastPurchase: string;
  orders: number; totalSpentUsd: number; destinations: string;
  inOmnisend: string; emailStatus: string; emailConsent: string; optIn: string; smsStatus: string;
  city: string; state: string; country: string; tags: string;
  reason?: string;
}

export interface CriteriaResult {
  sendable: ExportRow[];
  unsubscribed: ExportRow[];
  excluded: ExportRow[];
  counts: { matched: number; sendable: number; unsubscribed: number; excluded: number; uniqueEmails: number };
}

export function runCriteria(criteria: Criteria): CriteriaResult {
  const where = [];
  if (criteria.segments?.length) where.push(inArray(MCS.segment, criteria.segments));
  if (criteria.systems?.length) where.push(inArray(MCS.system, criteria.systems));
  if (criteria.destination) where.push(like(MCS.destinations, `%${criteria.destination}%`));
  if (criteria.minSpend != null) where.push(gte(MCS.totalSpentUsd, criteria.minSpend));
  if (criteria.maxSpend != null) where.push(lte(MCS.totalSpentUsd, criteria.maxSpend));
  if (criteria.monthsBack != null) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - criteria.monthsBack);
    where.push(gte(MCS.lastPurchase, Math.floor(cutoff.getTime() / 1000)));
  }

  const joined = db
    .select({
      email: MCS.email, name: MCS.name, firstName: MCS.firstName, phone: MCS.phone, system: MCS.system,
      segment: MCS.segment, firstPurchase: MCS.firstPurchase, lastPurchase: MCS.lastPurchase,
      orders: MCS.orders, totalSpentUsd: MCS.totalSpentUsd, destinations: MCS.destinations,
      cFirst: MC.firstName, cLast: MC.lastName, cPhone: MC.phone, emailStatus: MC.emailStatus,
      emailConsent: MC.emailConsent, optIn: MC.optIn, smsStatus: MC.smsStatus,
      city: MC.city, state: MC.state, country: MC.country, tags: MC.tags,
    })
    .from(MCS)
    .leftJoin(MC, eq(MCS.email, MC.email))
    .where(where.length ? and(...where) : sql`1=1`)
    .all();

  // "Also bought" needs each email's FULL segment set (not just matched segments).
  const allSegs = db.select({ email: MCS.email, segment: MCS.segment }).from(MCS).all();
  const segsByEmail = new Map<string, Set<string>>();
  for (const r of allSegs) {
    if (!segsByEmail.has(r.email)) segsByEmail.set(r.email, new Set());
    segsByEmail.get(r.email)!.add(r.segment);
  }

  const matcher = buildMatcherFromDb();
  const sub = criteria.subscription ?? "any";

  const sendable: ExportRow[] = [], unsubscribed: ExportRow[] = [], excluded: ExportRow[] = [];
  const emails = new Set<string>();

  for (const r of joined) {
    emails.add(r.email);
    const inOmni = r.emailStatus != null;
    const customerName = r.name || [r.cFirst, r.cLast].filter(Boolean).join(" ");
    const row: ExportRow = {
      firstName: r.firstName || "",
      customerName,
      email: r.email,
      phone: r.phone || r.cPhone || "",
      system: r.system,
      segment: r.segment,
      alsoBought: [...(segsByEmail.get(r.email) ?? [])].filter((s) => s !== r.segment).sort().join(", "),
      firstPurchase: isoDate(r.firstPurchase),
      lastPurchase: isoDate(r.lastPurchase),
      orders: r.orders,
      totalSpentUsd: r.totalSpentUsd,
      destinations: r.destinations,
      inOmnisend: inOmni ? "yes" : "no",
      emailStatus: inOmni ? (r.emailStatus || "") : "Not in Omnisend",
      emailConsent: r.emailConsent || "",
      optIn: r.optIn || "",
      smsStatus: r.smsStatus || "",
      city: r.city || "", state: r.state || "", country: r.country || "", tags: r.tags || "",
    };

    // Feed the matcher EVERY available name signal (segment name, derived first
    // name, and Omnisend first/last) so a blank/partial r.name can't let an
    // excluded name slip into sendable. (Codex review, false-negative hardening.)
    const nameForMatch = [r.name, r.firstName, r.cFirst, r.cLast].filter(Boolean).join(" ") || customerName;
    const reason = matcher.reason(r.email, nameForMatch);
    if (reason) { excluded.push({ ...row, reason }); continue; }
    if (inOmni && r.emailStatus === "Unsubscribed") { unsubscribed.push(row); continue; }
    if (sub === "subscribed_only" && r.emailStatus !== "Subscribed") continue;
    if (sub === "exclude_unsub" && r.emailStatus === "Unsubscribed") continue;
    sendable.push(row);
  }

  const byRecency = (a: ExportRow, b: ExportRow) =>
    b.lastPurchase.localeCompare(a.lastPurchase) || b.totalSpentUsd - a.totalSpentUsd;
  sendable.sort(byRecency); unsubscribed.sort(byRecency);
  excluded.sort((a, b) => (a.reason || "").localeCompare(b.reason || "") || byRecency(a, b));

  return {
    sendable, unsubscribed, excluded,
    counts: {
      matched: joined.length, sendable: sendable.length,
      unsubscribed: unsubscribed.length, excluded: excluded.length, uniqueEmails: emails.size,
    },
  };
}
