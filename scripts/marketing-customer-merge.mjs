/**
 * marketing-customer-merge.mjs
 *
 * Produces a SINGLE merged marketing workbook so the team doesn't have to cross-
 * reference multiple files. Spine = our OpenSearch purchasers (one row per
 * customer × product segment); each row is enriched with the matching Omnisend
 * contact's subscription status, consent, phone and location (joined on email).
 *
 * Routing:
 *   - Excluded domains / names (scripts/marketing-export-exclusions.json)
 *       → "Excluded" tab, with a Reason column.
 *   - Omnisend status = Unsubscribed
 *       → "Unsubscribed" tab (kept, but out of the sendable product tabs).
 *   - Everyone else → product tabs (eSIM / Rental / Sapphire / Other) + Combined.
 *
 * Leaves the existing single-source exports untouched — writes a new file.
 *
 * Usage:
 *   node scripts/marketing-customer-merge.mjs
 *   node scripts/marketing-customer-merge.mjs --omnisend=delme/contacts_export_X.csv \
 *        --exclusions=scripts/marketing-export-exclusions.json --months=24 --out=delme/merged.xlsx
 *
 * Output contains PII — written to delme/, never committed.
 */

import { readFileSync, readdirSync } from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { extractPurchasers, isoDate, cleanPhone, firstNameOf, TYPE_LABEL } from "./lib/marketing-core.mjs";

/* ─────────────────────────── ARGS ─────────────────────────── */

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  })
);
const MONTHS = Number(args.months ?? 24);
const stamp = new Date().toISOString().slice(0, 10);
const OUT_PATH = args.out ?? path.join("delme", `marketing-customers-merged-${stamp}.xlsx`);
const EXCL_PATH = args.exclusions ?? path.join("scripts", "marketing-export-exclusions.json");

// Locate the Omnisend CSV: explicit --omnisend, else newest contacts_export_*.csv in delme/.
function findOmnisendCsv() {
  if (args.omnisend && typeof args.omnisend === "string") return args.omnisend;
  const dir = "delme";
  const matches = readdirSync(dir)
    .filter((f) => /^contacts_export_.*\.csv$/i.test(f))
    .sort();
  if (!matches.length) throw new Error(`No contacts_export_*.csv found in ${dir}/ (pass --omnisend=path)`);
  return path.join(dir, matches[matches.length - 1]);
}

/* ─────────────────────────── EXCLUSIONS ─────────────────────────── */

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

// Source of truth is now the DB (managed by the /marketing console). Read the
// excluded_domains / excluded_names tables via the sqlite3 CLI (avoids the
// better-sqlite3 native module). Fall back to the JSON file if the tables are
// empty or unavailable (e.g. a fresh checkout that hasn't synced yet).
function loadExclusions() {
  const dbPath = path.join(process.cwd(), "data", "ops.sqlite");
  try {
    const q = (sql) => execFileSync("sqlite3", ["-readonly", dbPath, sql], { encoding: "utf8" })
      .split("\n").map((s) => s.trim()).filter(Boolean);
    const domains = q("SELECT domain FROM excluded_domains;");
    const names = q("SELECT name FROM excluded_names;");
    if (domains.length || names.length) {
      console.log(`Exclusions from DB: ${domains.length} domains, ${names.length} names`);
      return { domains, names };
    }
  } catch { /* tables missing → fall back to JSON */ }
  const cfg = JSON.parse(readFileSync(EXCL_PATH, "utf8"));
  console.log(`Exclusions from JSON fallback (${EXCL_PATH})`);
  return { domains: cfg.domains ?? [], names: cfg.names ?? [] };
}

const _excl = loadExclusions();
const EXCLUDED_DOMAINS = new Set(_excl.domains.map((d) => d.toLowerCase().trim()));
// Each excluded name → tokens that must ALL appear among the contact's name/handle words.
const EXCLUDED_NAMES = _excl.names.map((n) => ({ label: n, tokens: norm(n).split(" ").filter(Boolean) }));

// Returns a reason string if the contact should be excluded, else "".
function exclusionReason(email, ...nameParts) {
  const domain = (email.split("@")[1] || "").toLowerCase();
  if (EXCLUDED_DOMAINS.has(domain)) return `domain: ${domain}`;
  const local = (email.split("@")[0] || "").replace(/[._\-+]+/g, " ");
  const haystack = new Set(norm([...nameParts, local].join(" ")).split(" ").filter(Boolean));
  for (const { label, tokens } of EXCLUDED_NAMES) {
    if (tokens.length && tokens.every((t) => haystack.has(t))) return `name: ${label}`;
  }
  return "";
}

/* ─────────────────────────── OMNISEND CSV ─────────────────────────── */

// Quote-aware CSV parse over the whole file (handles commas + newlines inside
// quoted fields, and "" escapes). Invokes onRecord(fieldsArray) per record.
function parseCsv(text, onRecord) {
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); onRecord(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); onRecord(row); }
}

function loadOmnisend(csvPath) {
  console.log(`Reading Omnisend CSV: ${csvPath}`);
  const text = readFileSync(csvPath, "utf8");
  const byEmail = new Map();
  let header = null; const idx = {}; let rows = 0;
  const get = (r, name) => (idx[name] != null ? (r[idx[name]] || "").trim() : "");

  parseCsv(text, (r) => {
    if (!header) {
      header = r.map((h) => h.trim());
      header.forEach((h, i) => { idx[h] = i; });
      return;
    }
    const email = get(r, "Email").toLowerCase();
    if (!email || !email.includes("@")) return;
    rows++;
    const rec = {
      firstName: get(r, "First name"),
      lastName: get(r, "Last name"),
      phone: get(r, "Phone number"),
      emailStatus: get(r, "Email subscription status"),
      emailConsent: get(r, "Email consent"),
      optIn: get(r, "Email opt-in date"),
      smsStatus: get(r, "SMS subscription status"),
      city: get(r, "City"),
      state: get(r, "State"),
      country: get(r, "Country"),
      tags: get(r, "Tags"),
      segments: get(r, "Segments"),
    };
    const prev = byEmail.get(email);
    if (!prev) { byEmail.set(email, rec); return; }
    // Duplicate email: keep the more conservative status (Unsubscribed wins), fill blanks.
    if (rec.emailStatus === "Unsubscribed") prev.emailStatus = "Unsubscribed";
    for (const k of Object.keys(rec)) if (!prev[k] && rec[k]) prev[k] = rec[k];
  });

  console.log(`Omnisend contacts with email: ${byEmail.size.toLocaleString()} (from ${rows.toLocaleString()} rows)`);
  return byEmail;
}

/* ─────────────────────────── RUN ─────────────────────────── */

const omni = loadOmnisend(findOmnisendCsv());
const { customers, totalMatched, cutoffSec } = await extractPurchasers({ months: MONTHS });

/* ─────────────────────────── BUILD ROWS ─────────────────────────── */

const BASE_HEADERS = [
  "First Name", "Customer Name", "Email", "Phone", "System",
  "Product Segment", "Also Bought",
  "First Purchase", "Last Purchase", "Orders (segment)", "Total Spent USD", "Destinations",
  "In Omnisend", "Email Status", "Email Consent", "Email Opt-in", "SMS Status",
  "City", "State", "Country", "Omnisend Tags", "Omnisend Segments",
];
const EXCLUDED_HEADERS = ["Reason", ...BASE_HEADERS];

const rowsByType = { esim: [], rental: [], sapphire: [], unknown: [] };
const combined = [];
const unsubscribed = [];
const excluded = [];

let matchedInOmni = 0, totalRows = 0;

for (const [email, byType] of customers) {
  const o = omni.get(email);
  if (o) matchedInOmni++;
  const typesPresent = [...byType.keys()].map((t) => TYPE_LABEL[t]).sort();

  for (const [type, agg] of byType) {
    totalRows++;
    const customerName = agg.name || [o?.firstName, o?.lastName].filter(Boolean).join(" ");
    const row = {
      "First Name": agg.firstName || firstNameOf([o?.firstName, o?.lastName].filter(Boolean).join(" ")),
      "Customer Name": customerName,
      "Email": email,
      "Phone": agg.phone || cleanPhone(o?.phone),
      "System": agg.system,
      "Product Segment": TYPE_LABEL[type],
      "Also Bought": typesPresent.filter((l) => l !== TYPE_LABEL[type]).join(", "),
      "First Purchase": isoDate(agg.firstTs === Infinity ? 0 : agg.firstTs),
      "Last Purchase": isoDate(agg.lastTs),
      "Orders (segment)": agg.orders,
      "Total Spent USD": Math.round(agg.totalUsd * 100) / 100,
      "Destinations": [...agg.destinations].filter(Boolean).sort().join(", "),
      "In Omnisend": o ? "yes" : "no",
      "Email Status": o ? o.emailStatus : "Not in Omnisend",
      "Email Consent": o?.emailConsent || "",
      "Email Opt-in": o?.optIn || "",
      "SMS Status": o?.smsStatus || "",
      "City": o?.city || "",
      "State": o?.state || "",
      "Country": o?.country || "",
      "Omnisend Tags": o?.tags || "",
      "Omnisend Segments": o?.segments || "",
    };

    const reason = exclusionReason(email, customerName, o?.firstName, o?.lastName);
    if (reason) { excluded.push({ Reason: reason, ...row }); continue; }
    if (o && o.emailStatus === "Unsubscribed") { unsubscribed.push(row); continue; }
    rowsByType[type].push(row);
    combined.push(row);
  }
}

const byRecency = (a, b) =>
  b["Last Purchase"].localeCompare(a["Last Purchase"]) || (b["Total Spent USD"] - a["Total Spent USD"]);
for (const t of Object.keys(rowsByType)) rowsByType[t].sort(byRecency);
combined.sort(byRecency);
unsubscribed.sort(byRecency);
excluded.sort((a, b) => a.Reason.localeCompare(b.Reason) || byRecency(a, b));

/* ─────────────────────────── WRITE XLSX ─────────────────────────── */

const wb = XLSX.utils.book_new();
const baseWidths = [16, 20, 30, 17, 9, 14, 16, 13, 13, 14, 13, 34, 11, 14, 12, 12, 12, 14, 8, 14, 22, 22];

function addSheet(name, rows, headers = BASE_HEADERS) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  const isExcl = headers === EXCLUDED_HEADERS;
  ws["!cols"] = headers.map((_, i) => ({ wch: isExcl ? (i === 0 ? 20 : baseWidths[i - 1] || 14) : (baseWidths[i] || 14) }));
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: Math.max(rows.length, 1) } }),
  };
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const sendable = combined.length;
const byDomain = excluded.filter((r) => r.Reason.startsWith("domain")).length;
const byName = excluded.filter((r) => r.Reason.startsWith("name")).length;

const summary = [
  ["Merged Marketing Customer List", ""],
  ["Generated", new Date().toISOString()],
  ["Sources", "OpenSearch orders (purchases) + Omnisend contacts (consent/contact)"],
  ["Date window", `${isoDate(cutoffSec)} → ${stamp} (last ${MONTHS} months of purchases)`],
  ["Join key", "email (lowercased)"],
  ["", ""],
  ["Orders matched (OS)", totalMatched],
  ["Unique purchasers", customers.size],
  ["Purchaser × segment rows", totalRows],
  ["Purchasers found in Omnisend", `${matchedInOmni} (${(matchedInOmni / customers.size * 100).toFixed(1)}%)`],
  ["", ""],
  ["Routing", "Rows"],
  ["Sendable — eSIM", rowsByType.esim.length],
  ["Sendable — Rental", rowsByType.rental.length],
  ["Sendable — Sapphire", rowsByType.sapphire.length],
  ["Sendable — Other", rowsByType.unknown.length],
  ["Sendable — Combined (total)", sendable],
  ["Unsubscribed (moved out)", unsubscribed.length],
  ["Excluded — total", excluded.length],
  ["  · by domain", byDomain],
  ["  · by name", byName],
  ["", ""],
  ["Exclusion config", EXCL_PATH],
  ["Excluded domains", [...EXCLUDED_DOMAINS].join(", ")],
  ["Excluded names", EXCLUDED_NAMES.map((n) => n.label).join(", ")],
];
const wsSum = XLSX.utils.aoa_to_sheet(summary);
wsSum["!cols"] = [{ wch: 30 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

addSheet("eSIM", rowsByType.esim);
addSheet("Rental", rowsByType.rental);
addSheet("Sapphire", rowsByType.sapphire);
if (rowsByType.unknown.length) addSheet("Other", rowsByType.unknown);
addSheet("Combined", combined);
addSheet("Unsubscribed", unsubscribed);
addSheet("Excluded", excluded, EXCLUDED_HEADERS);

XLSX.writeFile(wb, OUT_PATH);

console.log(`\nWrote ${OUT_PATH}`);
console.log(`  Sendable: ${sendable.toLocaleString()} (eSIM ${rowsByType.esim.length.toLocaleString()} | Rental ${rowsByType.rental.length.toLocaleString()} | Sapphire ${rowsByType.sapphire.length.toLocaleString()} | Other ${rowsByType.unknown.length.toLocaleString()})`);
console.log(`  Unsubscribed: ${unsubscribed.length.toLocaleString()} | Excluded: ${excluded.length.toLocaleString()} (domain ${byDomain}, name ${byName})`);
console.log(`  Omnisend match rate: ${(matchedInOmni / customers.size * 100).toFixed(1)}%`);
