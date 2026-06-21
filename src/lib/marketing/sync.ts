/**
 * Materialize OpenSearch purchasers into marketing_customer_segments.
 *
 * One row per (email × product segment). Classification reuses the canonical
 * detectProductType() (sku-parser) and getCountryName() (countries) so the
 * console can't drift from the rest of the app. Triggered by /api/marketing/sync.
 */

import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { marketingCustomerSegments, marketingSyncState } from "@/lib/db/schema";
import type { InsertMarketingCustomerSegment } from "@/lib/db/schema";
import { getServerOpenSearchCredentials } from "@/lib/server-credentials";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";
import { detectProductType } from "@/lib/sku-parser";
import { getCountryName } from "@/lib/countries";

// Same denylists the CLI export uses (see scripts/lib/marketing-core.mjs).
const EXCLUDE_STATUSES = [
  "Pending Payment", "Pending", "Payment Pending", "Canceled - Refunded", "Cancel",
  "Fraud", "Fraud - Refunded", "Decline", "Completed - Refunded",
  "Completed - Pending for Refund", "User Closed", "Close - Updated",
];
const EXCLUDE_SYSTEMS = ["TWTEST", "ARITESTORDER", "B2B", "B2P", "KIOSK"];
const TYPE_LABEL: Record<string, string> = { esim: "eSIM", rental: "Rental", sapphire: "Sapphire", unknown: "Other" };

const REGION_NAMES: Record<string, string> = {
  EUROPE: "Europe", EUR: "Europe", EU: "Europe", SEASIA: "Southeast Asia", SEASI: "Southeast Asia",
  CHILE: "Chile", ASIA: "Asia", AFRICA: "Africa", AMERICAS: "Americas", GLOBAL: "Global",
};

function skuCountryCode(sku: string): string {
  const s = String(sku);
  const m = s.match(/^([A-Z]{2,6})_(?:\d+GB_\d+D|\d+D_Unlimited)$/i);
  if (m) return m[1].toUpperCase();
  if (/^DHI_/i.test(s)) {
    const tok = (s.split("_")[1] || "").replace(/\+.*$/, "");
    return (tok.match(/^[A-Za-z]+/)?.[0] || "").toUpperCase();
  }
  return "";
}
function destinationName(code: string): string {
  if (!code) return "";
  if (REGION_NAMES[code]) return REGION_NAMES[code];
  if (/^[A-Z]{2}$/.test(code)) { const n = getCountryName(code); if (n && n !== code) return n; }
  return code;
}

interface OrderSource {
  customer_email?: string; customer_name?: string; customer_phone?: string;
  system?: string; created_at?: number | string; total?: number | string;
  order_usd_rate_exchange?: string; product_sku?: string | string[];
  order_details_data?: Array<{ product_sku?: string; package_sku?: string; trip_start?: string | number; trip_end?: string | number }>;
}

function orderSkus(o: OrderSource): { product: string[]; pkg: string[] } {
  const product: string[] = [];
  if (Array.isArray(o.product_sku)) product.push(...o.product_sku);
  else if (o.product_sku) product.push(o.product_sku);
  const pkg: string[] = [];
  for (const d of o.order_details_data ?? []) {
    if (d?.product_sku) product.push(d.product_sku);
    if (d?.package_sku) pkg.push(d.package_sku);
  }
  return { product: product.filter(Boolean), pkg: pkg.filter(Boolean) };
}

const toUsd = (total: unknown, rate: unknown): number => {
  const t = Number(total) || 0;
  const r = parseFloat(String(rate));
  return r > 0 ? t / r : t;
};
// Coerce a date-ish value (epoch s/ms or date string) to epoch SECONDS; 0 if unparseable.
const toSec = (v: unknown): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : Math.floor(v);
  const s = String(v).trim();
  if (/^\d{9,13}$/.test(s)) { const n = parseInt(s, 10); return n > 1e12 ? Math.floor(n / 1000) : n; }
  const t = Date.parse(s);
  return isNaN(t) ? 0 : Math.floor(t / 1000);
};
const firstNameOf = (full: string): string => {
  if (!full) return "";
  const base = full.includes(",") ? full.split(",")[1] : full;
  const tok = base.trim().split(/\s+/)[0] || "";
  return tok ? tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase() : "";
};

interface Agg {
  name: string; firstName: string; phone: string; system: string;
  nameTs: number; phoneTs: number; sysTs: number;
  firstTs: number; lastTs: number; orders: number; totalUsd: number; destinations: Set<string>;
  lastTrip: number; lastDest: string; lastDestAt: number;
}

export interface SyncResult {
  totalMatched: number; processed: number; segmentRows: number; customers: number;
}

export async function syncOrders({ months = null, onProgress }: { months?: number | null; onProgress?: (n: number) => void } = {}): Promise<SyncResult> {
  const creds = getServerOpenSearchCredentials();
  if (!creds?.url) throw new Error("OpenSearch not configured — save credentials in Settings");
  const base = creds.url.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${creds.username}:${creds.password}`).toString("base64");

  // months = null → all-time (the canonical Noomi list needs lifetime purchase history).
  const filter: Array<Record<string, unknown>> = [];
  if (months != null) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    filter.push({ range: { created_at: { gte: Math.floor(cutoff.getTime() / 1000) } } });
  }

  const query = {
    bool: {
      filter,
      must_not: [
        { terms: { "status.keyword": EXCLUDE_STATUSES } },
        { terms: { "system.keyword": EXCLUDE_SYSTEMS } },
      ],
    },
  };
  const SOURCE = [
    "customer_email", "customer_name", "customer_phone", "system", "created_at",
    "total", "order_usd_rate_exchange", "product_sku", "order_details_data",
  ];

  async function osFetch(pathPart: string, body: unknown) {
    const res = await fetch(`${base}${pathPart}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`OpenSearch ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  // email → segment → agg
  const customers = new Map<string, Map<string, Agg>>();
  let processed = 0;

  const ingest = (src: OrderSource) => {
    processed++;
    const email = (src.customer_email || "").trim().toLowerCase();
    if (!email) return;
    const { product, pkg } = orderSkus(src);
    const type = detectProductType(product, pkg);
    const ts = Number(src.created_at) || 0;

    if (!customers.has(email)) customers.set(email, new Map());
    const byType = customers.get(email)!;
    if (!byType.has(type)) {
      byType.set(type, {
        name: "", firstName: "", phone: "", system: "", nameTs: -1, phoneTs: -1, sysTs: -1,
        firstTs: Infinity, lastTs: 0, orders: 0, totalUsd: 0, destinations: new Set(),
        lastTrip: 0, lastDest: "", lastDestAt: 0,
      });
    }
    const agg = byType.get(type)!;
    agg.orders++;
    agg.totalUsd += toUsd(src.total, src.order_usd_rate_exchange);
    if (ts && ts < agg.firstTs) agg.firstTs = ts;
    if (ts > agg.lastTs) agg.lastTs = ts;
    const orderDests: string[] = [];
    for (const sku of [...product, ...pkg]) {
      const d = destinationName(skuCountryCode(sku));
      if (d) { agg.destinations.add(d); orderDests.push(d); }
    }
    // Most-recent destination (→ DEST_COUNTRY): the destination tied to the latest order.
    if (orderDests.length && ts >= agg.lastDestAt) { agg.lastDest = orderDests[0]; agg.lastDestAt = ts; }
    // Most-recent rental trip-end (→ LAST_TRIP_AT).
    let tripEnd = 0;
    for (const d of src.order_details_data ?? []) { const te = toSec(d?.trip_end); if (te > tripEnd) tripEnd = te; }
    if (tripEnd > agg.lastTrip) agg.lastTrip = tripEnd;
    if (ts >= agg.nameTs && src.customer_name) {
      agg.name = String(src.customer_name).trim();
      agg.firstName = firstNameOf(agg.name);
      agg.nameTs = ts;
    }
    const ph = src.customer_phone ? String(src.customer_phone).replace(/\s+/g, " ").trim() : "";
    if (ts >= agg.phoneTs && ph) { agg.phone = ph; agg.phoneTs = ts; }
    if (ts >= agg.sysTs && src.system) { agg.system = String(src.system).trim(); agg.sysTs = ts; }
  };

  let resp = await osFetch(`/${INDEX_ORDERS}/_search?scroll=2m`, { size: 2000, query, _source: SOURCE, sort: ["_doc"] });
  let scrollId: string = resp._scroll_id;
  let hits = resp.hits?.hits ?? [];
  const totalMatched: number = resp.hits?.total?.value ?? 0;

  while (hits.length) {
    for (const h of hits) ingest(h._source as OrderSource);
    onProgress?.(processed);
    resp = await osFetch(`/_search/scroll`, { scroll: "2m", scroll_id: scrollId });
    scrollId = resp._scroll_id;
    hits = resp.hits?.hits ?? [];
  }
  try {
    await fetch(`${base}/_search/scroll`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ scroll_id: scrollId }),
    });
  } catch { /* non-fatal */ }

  // Flatten to rows
  const now = new Date();
  const rows: InsertMarketingCustomerSegment[] = [];
  for (const [email, byType] of customers) {
    for (const [type, agg] of byType) {
      rows.push({
        id: randomUUID(),
        email,
        name: agg.name,
        firstName: agg.firstName,
        phone: agg.phone,
        system: agg.system,
        segment: TYPE_LABEL[type] ?? "Other",
        firstPurchase: agg.firstTs === Infinity ? null : agg.firstTs,
        lastPurchase: agg.lastTs || null,
        orders: agg.orders,
        totalSpentUsd: Math.round(agg.totalUsd * 100) / 100,
        destinations: [...agg.destinations].filter(Boolean).sort().join(", "),
        lastTrip: agg.lastTrip || null,
        lastDestination: agg.lastDest || "",
        lastDestAt: agg.lastDestAt || null,
        syncedAt: now,
      });
    }
  }

  // Replace the snapshot atomically; chunk inserts to stay under SQLite limits.
  db.transaction((tx) => {
    tx.delete(marketingCustomerSegments).run();
    for (let i = 0; i < rows.length; i += 500) {
      tx.insert(marketingCustomerSegments).values(rows.slice(i, i + 500)).run();
    }
    tx.insert(marketingSyncState)
      .values({ id: "default", osSyncedAt: now, osSegmentRows: rows.length, osCustomers: customers.size })
      .onConflictDoUpdate({
        target: marketingSyncState.id,
        set: { osSyncedAt: now, osSegmentRows: rows.length, osCustomers: customers.size },
      })
      .run();
  });

  return { totalMatched, processed, segmentRows: rows.length, customers: customers.size };
}
