/**
 * Canonical Noomi marketing-contact export (Brevo CSV).
 *
 * ONE row per lowercased email — the FULL deduped union of:
 *   Source A — OpenSearch purchasers   (marketing_customer_segments)
 *   Source B — Omnisend contacts       (marketing_contacts)
 *
 * Includes purchasers, non-purchaser prospects, AND unsubscribed contacts
 * (never dropped — they must be present so they can be suppressed downstream).
 * Re-runnable / idempotent: same email → same row shape. RUN DATE is a parameter
 * (drives RECENCY_BUCKET). Strict CSV per the destination schema; see buildBrevoCsv.
 *
 * Spec lives with the operator; this module is the single implementation.
 */

import { db } from "@/lib/db";
import { marketingCustomerSegments as MCS, marketingContacts as MC } from "@/lib/db/schema";
import { ISO2_TO_COUNTRY } from "@/lib/countries";
import { getExclusions, buildMatcher } from "./exclusions";

/* ── Exact destination headers, in order (Brevo drops unrecognized columns). ── */
export const BREVO_HEADERS = [
  "EMAIL", "FIRSTNAME", "LASTNAME", "CONTACT_TYPE", "SOURCE_PRODUCT", "RECENCY_BUCKET",
  "COUNTRY_ISO", "LAST_PURCHASE_DATE", "LAST_TRIP_AT", "DEST_COUNTRY", "LAST_OPEN_AT",
  "LAST_CLICK_AT", "LEGACY_ENGAGEMENT_SCORE", "LIFETIME_RENTALS", "LTV_CENTS",
  "CUSTOMER_SINCE", "EMAIL_OPTIN", "MARKETING_STATUS", "BLOCKED", "LEGACY_SOURCE",
  "LAUNCH_WAVE", "HOLDOUT",
] as const;

export interface BrevoSummary {
  total: number;
  byContactType: Record<string, number>;
  byMarketingStatus: Record<string, number>;
  byLegacySource: Record<string, number>;
  country: { us: number; nonUs: number; unknown: number };
  droppedInvalidEmails: number;
  droppedExcluded: number;
  runDate: string;
}

/* ───────────────────────────── helpers ───────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGION_CODES = new Set(["EU", "EU28", "AS", "AF2", "SA2"]);

const isoDate = (sec: number | null | undefined): string =>
  sec ? new Date(Number(sec) * 1000).toISOString().slice(0, 10) : "";

/** ISO alpha-2 from a storefront `system` suffix (US/MX/CL/SG/CH…); "" if not a country. */
export function systemIso(system: string | null | undefined): string {
  const s = (system || "").trim().toUpperCase();
  if (!s || /LOCAL$/.test(s) || s === "B2C" || s === "B2B" || s === "B2P" || s === "GNG") return "";
  if (s === "QRO") return "MX"; // Querétaro storefront — doesn't follow the suffix rule
  const suffix = s.slice(-2);
  if (REGION_CODES.has(suffix)) return ""; // "EU" etc. is a region, not a country
  return ISO2_TO_COUNTRY[suffix] ? suffix : "";
}

/** Omnisend country NAME → ISO alpha-2 (best-effort); "" for unknown/dirty values. */
const NAME_TO_ISO: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [code, name] of Object.entries(ISO2_TO_COUNTRY)) {
    if (REGION_CODES.has(code)) continue;
    m[name.toLowerCase()] = code;
  }
  Object.assign(m, {
    "usa": "US", "u.s.": "US", "u.s.a.": "US", "united states of america": "US", "america": "US",
    "uk": "GB", "u.k.": "GB", "england": "GB", "scotland": "GB", "wales": "GB", "great britain": "GB",
    "south korea": "KR", "korea": "KR", "russia": "RU", "vietnam": "VN", "uae": "AE",
    "czechia": "CZ", "the netherlands": "NL", "hong kong sar": "HK",
  });
  return m;
})();
export function countryNameToIso(name: string | null | undefined): string {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "";
  if (NAME_TO_ISO[n]) return NAME_TO_ISO[n];
  return /^[a-z]{2}$/.test(n) && ISO2_TO_COUNTRY[n.toUpperCase()] ? n.toUpperCase() : "";
}

/** Split a full name into {first,last}, handling "Last, First" and "First Last". */
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const s = (full || "").trim();
  if (!s) return { first: "", last: "" };
  if (s.includes(",")) {
    const [last, first] = s.split(",").map((x) => x.trim());
    return { first: first || "", last: last || "" };
  }
  const toks = s.split(/\s+/);
  if (toks.length === 1) return { first: toks[0], last: "" };
  return { first: toks[0], last: toks.slice(1).join(" ") };
}

/** Days-since-last-purchase → recency bucket; "all-time" when no purchase or >24mo. */
function recencyBucket(runMs: number, lastSec: number): string {
  if (!lastSec) return "all-time";
  const days = Math.floor((runMs - lastSec * 1000) / 86_400_000);
  if (days <= 90) return "0-90d";
  if (days <= 180) return "91-180d";
  if (days <= 365) return "181-365d";
  if (days <= 730) return "13-24mo";
  return "all-time";
}

/** RFC-4180 cell: quote when the value contains a comma, quote, or newline. */
function csvCell(v: string | number): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* ─────────────────────────── purchaser aggregate ─────────────────────────── */

interface PurchAgg {
  segments: Set<string>;
  name: string; firstName: string; nameTs: number;
  system: string; sysTs: number;
  firstPurchase: number; lastPurchase: number;
  orders: number; rentalOrders: number; spendUsd: number;
  lastTrip: number; lastDest: string; lastDestAt: number;
  destinations: Set<string>;
}

function newPurchAgg(): PurchAgg {
  return {
    segments: new Set(), name: "", firstName: "", nameTs: -1, system: "", sysTs: -1,
    firstPurchase: 0, lastPurchase: 0, orders: 0, rentalOrders: 0, spendUsd: 0,
    lastTrip: 0, lastDest: "", lastDestAt: 0, destinations: new Set(),
  };
}

/* ───────────────────────────── main builder ───────────────────────────── */

export function buildBrevoCsv(opts: { runDate?: Date } = {}): { csv: string; summary: BrevoSummary } {
  const runDate = opts.runDate ?? new Date();
  const runMs = runDate.getTime();

  // Source A — purchasers, aggregated to one PurchAgg per email.
  const segRows = db.select({
    email: MCS.email, name: MCS.name, firstName: MCS.firstName, system: MCS.system,
    segment: MCS.segment, firstPurchase: MCS.firstPurchase, lastPurchase: MCS.lastPurchase,
    orders: MCS.orders, totalSpentUsd: MCS.totalSpentUsd, destinations: MCS.destinations,
    lastTrip: MCS.lastTrip, lastDestination: MCS.lastDestination, lastDestAt: MCS.lastDestAt,
  }).from(MCS).all();

  const purch = new Map<string, PurchAgg>();
  for (const r of segRows) {
    const email = (r.email || "").trim().toLowerCase();
    if (!email) continue;
    let a = purch.get(email);
    if (!a) { a = newPurchAgg(); purch.set(email, a); }
    if (r.segment) a.segments.add(r.segment);
    a.orders += r.orders || 0;
    if (r.segment === "Rental") a.rentalOrders += r.orders || 0;
    a.spendUsd += r.totalSpentUsd || 0;
    if (r.firstPurchase && (a.firstPurchase === 0 || r.firstPurchase < a.firstPurchase)) a.firstPurchase = r.firstPurchase;
    if (r.lastPurchase && r.lastPurchase > a.lastPurchase) a.lastPurchase = r.lastPurchase;
    const ts = r.lastPurchase || 0; // proxy timestamp for "most recent" name/system
    if (ts >= a.nameTs && r.name) { a.name = r.name; a.firstName = r.firstName || ""; a.nameTs = ts; }
    if (ts >= a.sysTs && r.system) { a.system = r.system; a.sysTs = ts; }
    if (r.lastTrip && r.lastTrip > a.lastTrip) a.lastTrip = r.lastTrip;
    if (r.lastDestAt && r.lastDestAt >= a.lastDestAt && r.lastDestination) { a.lastDest = r.lastDestination; a.lastDestAt = r.lastDestAt; }
    for (const d of (r.destinations || "").split(", ")) if (d) a.destinations.add(d);
  }

  // Source B — Omnisend contacts, one row per email.
  const conRows = db.select({
    email: MC.email, firstName: MC.firstName, lastName: MC.lastName,
    emailStatus: MC.emailStatus, country: MC.country,
  }).from(MC).all();
  const contacts = new Map<string, typeof conRows[number]>();
  for (const r of conRows) {
    const email = (r.email || "").trim().toLowerCase();
    if (email) contacts.set(email, r);
  }

  // Exclusion matcher (→ BLOCKED). Built once.
  const { domains, names } = getExclusions();
  const matcher = buildMatcher(domains, names);

  const summary: BrevoSummary = {
    total: 0, byContactType: {}, byMarketingStatus: {}, byLegacySource: {},
    country: { us: 0, nonUs: 0, unknown: 0 }, droppedInvalidEmails: 0, droppedExcluded: 0,
    runDate: isoDate(Math.floor(runMs / 1000)),
  };
  const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] || 0) + 1; };

  const allEmails = new Set<string>([...purch.keys(), ...contacts.keys()]);
  const lines: string[] = [BREVO_HEADERS.map(csvCell).join(",")];

  for (const email of allEmails) {
    if (!EMAIL_RE.test(email)) { summary.droppedInvalidEmails++; continue; }
    const p = purch.get(email);
    const c = contacts.get(email);
    const isPurchaser = !!p;
    const inOmnisend = !!c;

    // Names: Omnisend first, then parsed order name.
    const parsed = splitName(p?.name);
    const firstName = (c?.firstName || p?.firstName || parsed.first || "").trim();
    const lastName = (c?.lastName || parsed.last || "").trim();

    // Exclusions (internal/test domains, fraud/exclusion names) → dropped entirely
    // from the canonical list so they never reach Brevo.
    if (matcher.reason(email, [firstName, lastName].filter(Boolean).join(" "))) { summary.droppedExcluded++; continue; }

    // SOURCE_PRODUCT
    let sourceProduct: string;
    if (!isPurchaser) sourceProduct = "None";
    else if (p!.segments.size >= 2) sourceProduct = "Mixed";
    else sourceProduct = [...p!.segments][0] || "Other";

    // COUNTRY_ISO: purchase-system suffix first, else Omnisend country.
    const countryIso = systemIso(p?.system) || countryNameToIso(c?.country) || "";

    // DEST_COUNTRY: most-recent destination, else the only destination we know.
    let destCountry = p?.lastDest || "";
    if (!destCountry && p && p.destinations.size === 1) destCountry = [...p.destinations][0];

    // Consent — both derive from Omnisend Subscribed/Unsubscribed; consistent.
    const subscribed = c?.emailStatus === "Subscribed";
    const marketingStatus = !inOmnisend ? "unknown" : c!.emailStatus === "Unsubscribed" ? "unsubscribed" : "subscribed";
    const emailOptin = subscribed ? "Yes" : "No";

    const blocked = "No"; // exclusion matches are dropped above; column kept for the fixed schema
    const legacySource = isPurchaser && inOmnisend ? "both" : isPurchaser ? "opensearch" : "omnisend";
    const contactType = isPurchaser ? "purchaser" : "prospect";

    const row: Record<string, string | number> = {
      EMAIL: email,
      FIRSTNAME: firstName,
      LASTNAME: lastName,
      CONTACT_TYPE: contactType,
      SOURCE_PRODUCT: sourceProduct,
      RECENCY_BUCKET: recencyBucket(runMs, p?.lastPurchase || 0),
      COUNTRY_ISO: countryIso,
      LAST_PURCHASE_DATE: isoDate(p?.lastPurchase),
      LAST_TRIP_AT: isoDate(p?.lastTrip),
      DEST_COUNTRY: destCountry,
      LAST_OPEN_AT: "",            // not in our Omnisend import
      LAST_CLICK_AT: "",           // not in our Omnisend import
      LEGACY_ENGAGEMENT_SCORE: "", // not computed
      LIFETIME_RENTALS: p?.rentalOrders || 0,
      LTV_CENTS: p ? Math.round(p.spendUsd * 100) : 0,
      CUSTOMER_SINCE: isoDate(p?.firstPurchase),
      EMAIL_OPTIN: emailOptin,
      MARKETING_STATUS: marketingStatus,
      BLOCKED: blocked,
      LEGACY_SOURCE: legacySource,
      LAUNCH_WAVE: "",
      HOLDOUT: "",
    };

    lines.push(BREVO_HEADERS.map((h) => csvCell(row[h])).join(","));

    summary.total++;
    bump(summary.byContactType, contactType);
    bump(summary.byMarketingStatus, marketingStatus);
    bump(summary.byLegacySource, legacySource);
    if (countryIso === "US") summary.country.us++;
    else if (countryIso) summary.country.nonUs++;
    else summary.country.unknown++;
  }

  // RFC-4180: CRLF line endings, trailing newline. UTF-8, no BOM (callers must not prepend one).
  const csv = lines.join("\r\n") + "\r\n";
  return { csv, summary };
}
