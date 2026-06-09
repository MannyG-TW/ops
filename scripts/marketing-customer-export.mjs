/**
 * marketing-customer-export.mjs
 *
 * Builds a marketing campaign customer list from the OpenSearch `orders` index.
 *
 * Output: an .xlsx workbook with one tab per product segment (eSIM, Rental,
 * Sapphire, Other), a Combined tab, and a Summary tab.
 *
 * Granularity: one row per (customer email × product segment). A customer who
 * bought both an eSIM and a rental appears once on each tab; their "Also bought"
 * column lists the other segments.
 *
 * Scope:
 *   - Last 24 months (created_at >= cutoff)        --months=N to change
 *   - "Real buyer" statuses only                   (see EXCLUDE_STATUSES in core)
 *   - Consumer brands only                         (see EXCLUDE_SYSTEMS in core)
 *
 * Usage:  node scripts/marketing-customer-export.mjs
 *         node scripts/marketing-customer-export.mjs --months=12 --out=delme/list.xlsx
 *
 * Output contains PII (names/emails/phones) — written to delme/, never committed.
 */

import path from "path";
import * as XLSX from "xlsx";
import {
  extractPurchasers, isoDate, TYPE_LABEL, EXCLUDE_STATUSES, EXCLUDE_SYSTEMS,
} from "./lib/marketing-core.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
  })
);

const MONTHS = Number(args.months ?? 24);
const stamp = new Date().toISOString().slice(0, 10);
const OUT_PATH = args.out ?? path.join("delme", `marketing-customers-${stamp}.xlsx`);

const { customers, totalMatched, processed, kept, skippedNoEmail, cutoffSec } =
  await extractPurchasers({ months: MONTHS });

/* ─────────────────────────── BUILD ROWS ─────────────────────────── */

const HEADERS = [
  "First Name", "Customer Name", "Email", "Phone", "System",
  "Product Segment", "Also Bought",
  "First Purchase", "Last Purchase", "Orders (segment)", "Total Spent USD", "Destinations",
];

const rowsByType = { esim: [], rental: [], sapphire: [], unknown: [] };
const combined = [];

for (const [email, byType] of customers) {
  const typesPresent = [...byType.keys()].map((t) => TYPE_LABEL[t]).sort();
  for (const [type, agg] of byType) {
    const row = {
      "First Name": agg.firstName,
      "Customer Name": agg.name,
      "Email": email,
      "Phone": agg.phone,
      "System": agg.system,
      "Product Segment": TYPE_LABEL[type],
      "Also Bought": typesPresent.filter((l) => l !== TYPE_LABEL[type]).join(", "),
      "First Purchase": isoDate(agg.firstTs === Infinity ? 0 : agg.firstTs),
      "Last Purchase": isoDate(agg.lastTs),
      "Orders (segment)": agg.orders,
      "Total Spent USD": Math.round(agg.totalUsd * 100) / 100,
      "Destinations": [...agg.destinations].filter(Boolean).sort().join(", "),
    };
    rowsByType[type].push(row);
    combined.push(row);
  }
}

const byRecency = (a, b) =>
  b["Last Purchase"].localeCompare(a["Last Purchase"]) ||
  (b["Total Spent USD"] - a["Total Spent USD"]);
for (const t of Object.keys(rowsByType)) rowsByType[t].sort(byRecency);
combined.sort(byRecency);

/* ─────────────────────────── WRITE XLSX ─────────────────────────── */

const wb = XLSX.utils.book_new();
const COLW = [
  { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 10 },
  { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 15 }, { wch: 40 },
];

function addSheet(name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  ws["!cols"] = COLW;
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: HEADERS.length - 1, r: Math.max(rows.length, 1) } }),
  };
  XLSX.utils.book_append_sheet(wb, ws, name);
}

const summary = [
  ["Marketing Customer Export", ""],
  ["Generated", new Date().toISOString()],
  ["Source index", "orders (OpenSearch)"],
  ["Date window", `${isoDate(cutoffSec)} → ${stamp} (last ${MONTHS} months)`],
  ["Status filter", `Real buyers — excluded: ${EXCLUDE_STATUSES.join(", ")}`],
  ["System filter", `Consumer brands — excluded: ${EXCLUDE_SYSTEMS.join(", ")}`],
  ["", ""],
  ["Orders matched (in OS)", totalMatched],
  ["Orders processed", processed],
  ["Orders kept (had email)", kept],
  ["Orders skipped (no email)", skippedNoEmail],
  ["Unique customers", customers.size],
  ["", ""],
  ["Segment", "Rows (customers in segment)"],
  ["eSIM", rowsByType.esim.length],
  ["Rental", rowsByType.rental.length],
  ["Sapphire", rowsByType.sapphire.length],
  ["Other / Unknown", rowsByType.unknown.length],
  ["Combined (all rows)", combined.length],
];
const wsSum = XLSX.utils.aoa_to_sheet(summary);
wsSum["!cols"] = [{ wch: 28 }, { wch: 70 }];
XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

addSheet("eSIM", rowsByType.esim);
addSheet("Rental", rowsByType.rental);
addSheet("Sapphire", rowsByType.sapphire);
if (rowsByType.unknown.length) addSheet("Other", rowsByType.unknown);
addSheet("Combined", combined);

XLSX.writeFile(wb, OUT_PATH);

console.log(`\nWrote ${OUT_PATH}`);
console.log(`  eSIM: ${rowsByType.esim.length.toLocaleString()} | Rental: ${rowsByType.rental.length.toLocaleString()} | Sapphire: ${rowsByType.sapphire.length.toLocaleString()} | Other: ${rowsByType.unknown.length.toLocaleString()}`);
console.log(`  Combined rows: ${combined.length.toLocaleString()}`);
