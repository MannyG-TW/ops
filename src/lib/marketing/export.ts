/**
 * Build the marketing .xlsx workbook from criteria. Same tab structure as the
 * CLI merge: Summary, per-segment sendable tabs, Combined, Unsubscribed, Excluded.
 */

import * as XLSX from "xlsx";
import { runCriteria, type Criteria, type ExportRow } from "./query";

const HEADERS = [
  "First Name", "Customer Name", "Email", "Phone", "System",
  "Storefront Country", "Likely US",
  "Product Segment", "Also Bought", "First Purchase", "Last Purchase",
  "Orders (segment)", "Total Spent USD", "Destinations",
  "In Omnisend", "Email Status", "Email Consent", "Email Opt-in", "SMS Status",
  "City", "State", "Country", "Omnisend Tags",
];
const EXCLUDED_HEADERS = ["Reason", ...HEADERS];
const WIDTHS = [16, 20, 30, 17, 9, 16, 9, 14, 16, 13, 13, 14, 13, 34, 11, 14, 12, 12, 12, 14, 8, 14, 22];

function toSheetRow(r: ExportRow): Record<string, string | number> {
  return {
    "First Name": r.firstName, "Customer Name": r.customerName, "Email": r.email, "Phone": r.phone,
    "System": r.system, "Storefront Country": r.storefrontCountry, "Likely US": r.likelyUs,
    "Product Segment": r.segment, "Also Bought": r.alsoBought,
    "First Purchase": r.firstPurchase, "Last Purchase": r.lastPurchase,
    "Orders (segment)": r.orders, "Total Spent USD": Math.round(r.totalSpentUsd * 100) / 100,
    "Destinations": r.destinations, "In Omnisend": r.inOmnisend, "Email Status": r.emailStatus,
    "Email Consent": r.emailConsent, "Email Opt-in": r.optIn, "SMS Status": r.smsStatus,
    "City": r.city, "State": r.state, "Country": r.country, "Omnisend Tags": r.tags,
  };
}

export interface BuiltWorkbook {
  buffer: Buffer;
  counts: { matched: number; sendable: number; unsubscribed: number; excluded: number; uniqueEmails: number };
}

export function buildWorkbook(criteria: Criteria, meta: { syncedAt?: string } = {}): BuiltWorkbook {
  const { sendable, unsubscribed, excluded, counts } = runCriteria(criteria);

  const wb = XLSX.utils.book_new();

  const addSheet = (name: string, rows: ExportRow[], headers = HEADERS, withReason = false) => {
    const data = rows.map((r) => (withReason ? { "Reason": r.reason || "", ...toSheetRow(r) } : toSheetRow(r)));
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    ws["!cols"] = headers.map((_, i) => ({ wch: withReason ? (i === 0 ? 20 : WIDTHS[i - 1] || 14) : (WIDTHS[i] || 14) }));
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: headers.length - 1, r: Math.max(rows.length, 1) } }) };
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  // Group sendable by segment for per-segment tabs
  const segmentsPresent = [...new Set(sendable.map((r) => r.segment))];
  const order = ["eSIM", "Rental", "Sapphire", "Other"];
  const segTabs = segmentsPresent.sort((a, b) => order.indexOf(a) - order.indexOf(b));

  const summary: (string | number)[][] = [
    ["Marketing Export", ""],
    ["Generated", new Date().toISOString()],
    ["Data synced", meta.syncedAt || "(unknown)"],
    ["Source", "Local snapshot (OpenSearch orders + Omnisend), exclusions applied"],
    ["", ""],
    ["Criteria", JSON.stringify(criteria)],
    ["", ""],
    ["Matched rows", counts.matched],
    ["Unique customers", counts.uniqueEmails],
    ["Sendable", counts.sendable],
    ["Unsubscribed (moved out)", counts.unsubscribed],
    ["Excluded (domain/name)", counts.excluded],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum["!cols"] = [{ wch: 28 }, { wch: 90 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Summary");

  for (const seg of segTabs) addSheet(seg, sendable.filter((r) => r.segment === seg));
  addSheet("Combined", sendable);
  addSheet("Unsubscribed", unsubscribed);
  addSheet("Excluded", excluded, EXCLUDED_HEADERS, true);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, counts };
}
