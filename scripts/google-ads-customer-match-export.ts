/**
 * google-ads-customer-match-export.ts
 *
 * Google Ads Customer Match CSV — the FULL contact universe in one file:
 *   OpenSearch purchasers (marketing_customer_segments) ∪ Omnisend contacts
 *   (marketing_contacts), ONE row per lowercased email.
 *
 * Deliberately includes sendable AND unsubscribed AND non-purchaser prospects.
 * The ONLY rows dropped are (a) exclusion-list matches (excluded_domains /
 * excluded_names — same DB-backed matcher as the marketing console) and
 * (b) syntactically invalid emails Google would reject anyway.
 *
 * Columns follow Google's plain-text Customer Match template exactly:
 *   Email, First Name, Last Name, Country, Zip, Email, Zip, Phone, Phone
 *   - names lowercased / whitespace-collapsed (per Google's guidelines)
 *   - Country: ISO-2 lowercase (storefront system suffix, else Omnisend country)
 *   - Zip: blank — postal codes are not in the marketing snapshot
 *   - Phone 1: order phone · Phone 2: Omnisend phone (when different)
 *     US numbers normalized to E.164 (+1…); "+…" kept; other bare numbers as digits
 *
 * Usage:  npx tsx scripts/google-ads-customer-match-export.ts [--out=delme/foo.csv]
 * Output contains PII — written to delme/, never committed.
 */

import fs from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { marketingCustomerSegments as MCS, marketingContacts as MC } from "../src/lib/db/schema";
import { getExclusions, buildMatcher } from "../src/lib/marketing/exclusions";
import { systemIso, countryNameToIso, splitName } from "../src/lib/marketing/brevo";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  })
);

const stamp = new Date().toISOString().slice(0, 10);
const OUT_PATH = String(args.out ?? path.join("delme", `google-ads-customer-match-${stamp}.csv`));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lowercase, trim, collapse internal whitespace (Google's name/email guideline). */
const clean = (s: string | null | undefined) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();

/** RFC-4180 cell: quote when the value contains a comma, quote, or newline. */
const csvCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * Best-effort phone for Customer Match. "+…"/"00…" numbers are kept as E.164
 * digits; bare US numbers get +1; other bare numbers pass through as digits
 * (Google needs a country code to match them, but they don't break the upload).
 */
function normalizePhone(raw: string | null | undefined, countryIso: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const hasPlus = s.startsWith("+") || s.startsWith("00");
  let d = s.replace(/\D/g, "");
  if (hasPlus) d = d.replace(/^00/, "");
  if (!d || /^0+$/.test(d)) return "";
  if (hasPlus) return d.length >= 8 && d.length <= 15 ? `+${d}` : "";
  if (countryIso === "US") {
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  }
  return d.length >= 8 && d.length <= 15 ? d : "";
}

/* ── Source A: purchasers, latest name/system/phone per email ── */
interface Purch { name: string; firstName: string; system: string; phone: string; ts: number }
const segRows = db.select({
  email: MCS.email, name: MCS.name, firstName: MCS.firstName, phone: MCS.phone,
  system: MCS.system, lastPurchase: MCS.lastPurchase,
}).from(MCS).all();

const purch = new Map<string, Purch>();
for (const r of segRows) {
  const email = clean(r.email);
  if (!email) continue;
  const ts = r.lastPurchase || 0;
  let p = purch.get(email);
  if (!p) { p = { name: "", firstName: "", system: "", phone: "", ts: -1 }; purch.set(email, p); }
  if (ts >= p.ts) {
    if (r.name) { p.name = r.name; p.firstName = r.firstName || p.firstName; }
    if (r.system) p.system = r.system;
    if (r.phone) p.phone = r.phone;
    p.ts = ts;
  } else {
    // Older segment row — only fill gaps.
    if (!p.name && r.name) { p.name = r.name; p.firstName = r.firstName || p.firstName; }
    if (!p.system && r.system) p.system = r.system;
    if (!p.phone && r.phone) p.phone = r.phone;
  }
}

/* ── Source B: Omnisend contacts, one row per email ── */
const conRows = db.select({
  email: MC.email, firstName: MC.firstName, lastName: MC.lastName,
  phone: MC.phone, country: MC.country,
}).from(MC).all();
const contacts = new Map<string, (typeof conRows)[number]>();
for (const r of conRows) {
  const email = clean(r.email);
  if (email) contacts.set(email, r);
}

/* ── Exclusion matcher — the ONLY suppression applied ── */
const { domains, names } = getExclusions();
const matcher = buildMatcher(domains, names);

const HEADERS = ["Email", "First Name", "Last Name", "Country", "Zip", "Email", "Zip", "Phone", "Phone"];
const INSTRUCTIONS = `# Instructions:
# Customer Match data files must follow specific formatting guidelines in order to be accepted. Incorrect formatting can lead to an upload error or a low number of matched records.
#
# Un-hashed (Plain Text) Formatting Guidelines:
# Files must be in the CSV format
# All identifiers for one user record must be comma-separated. Different user records must be separated by a line break. They cannot be separated with a space or semicolon
# Headers must be: Email, Phone, First Name, Last Name, Country, Zip (multiple email, phone, and postal columns are allowed)
# You must provide First Name and Last Name if you want Google Ads to create a Country and Zip match
# The Phone column header name is required to upload phone numbers. The only formatting requirement is to include country code.
#
# Field Specific Guidelines:
# Please reference this help center article for field specific requirements: https://support.google.com/google-ads/answer/7475964
#`;

const allEmails = [...new Set([...purch.keys(), ...contacts.keys()])].sort();
const lines: string[] = [INSTRUCTIONS, HEADERS.join(",")];

const stats = {
  total: 0, purchasers: 0, prospects: 0, both: 0,
  droppedExcluded: 0, droppedInvalidEmail: 0,
  withName: 0, withCountry: 0, withPhone: 0, withTwoPhones: 0,
};

for (const email of allEmails) {
  if (!EMAIL_RE.test(email)) { stats.droppedInvalidEmail++; continue; }
  const p = purch.get(email);
  const c = contacts.get(email);

  const parsed = splitName(p?.name);
  const firstName = clean(c?.firstName || p?.firstName || parsed.first);
  const lastName = clean(c?.lastName || parsed.last);

  // Exclusion list (domains + names/emails) — the only thing that removes a row.
  if (matcher.reason(email, [firstName, lastName].filter(Boolean).join(" "))) {
    stats.droppedExcluded++;
    continue;
  }

  const countryIso = systemIso(p?.system) || countryNameToIso(c?.country) || "";
  const phone1 = normalizePhone(p?.phone, countryIso);
  let phone2 = normalizePhone(c?.phone, countryIso);
  if (phone2 && phone2 === phone1) phone2 = "";
  const phones = phone1 ? [phone1, phone2] : [phone2, ""];

  //           Email  First      Last      Country                    Zip Email Zip Phone      Phone
  const row = [email, firstName, lastName, countryIso.toLowerCase(), "", "",   "", phones[0], phones[1]];
  lines.push(row.map(csvCell).join(","));

  stats.total++;
  if (p && c) stats.both++;
  if (p) stats.purchasers++; else stats.prospects++;
  if (firstName && lastName) stats.withName++;
  if (countryIso) stats.withCountry++;
  if (phones[0]) stats.withPhone++;
  if (phones[0] && phones[1]) stats.withTwoPhones++;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, lines.join("\r\n") + "\r\n", "utf8");

console.log(`Wrote ${OUT_PATH}`);
console.log(JSON.stringify(stats, null, 2));
