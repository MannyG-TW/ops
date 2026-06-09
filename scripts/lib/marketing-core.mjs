/**
 * marketing-core.mjs — shared logic for the marketing export scripts.
 *
 * Used by:
 *   - scripts/marketing-customer-export.mjs   (OpenSearch-only segmented list)
 *   - scripts/marketing-customer-merge.mjs    (OpenSearch + Omnisend merge)
 *
 * Keeps OpenSearch access, product-type classification (mirrors
 * src/lib/sku-parser.ts), destination derivation, and the per-(email × segment)
 * aggregation in ONE place so the two scripts can't drift apart.
 *
 * Run scripts from the repo root — paths resolve against process.cwd().
 */

import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";

/* ─────────────────────────── FILTERS ─────────────────────────── */

// Statuses that DO NOT count as a completed purchase (denylist; everything else
// — Completed*, Paid, Fulfilled, Waiting*, Returned, partial refunds — is kept).
export const EXCLUDE_STATUSES = [
  "Pending Payment", "Pending", "Payment Pending",
  "Canceled - Refunded", "Cancel",
  "Fraud", "Fraud - Refunded",
  "Decline",
  "Completed - Refunded", "Completed - Pending for Refund",
  "User Closed", "Close - Updated",
];

// Non-consumer / test systems to exclude.
export const EXCLUDE_SYSTEMS = ["TWTEST", "ARITESTORDER", "B2B", "B2P", "KIOSK"];

export const TYPE_LABEL = { esim: "eSIM", rental: "Rental", sapphire: "Sapphire", unknown: "Other" };

/* ─────────────────────────── CREDS ─────────────────────────── */

function osCreds() {
  const DB_PATH = path.join(process.cwd(), "data", "ops.sqlite");
  const raw = execFileSync(
    "sqlite3",
    ["-readonly", "-separator", "\t", DB_PATH,
     "SELECT url, username, password FROM opensearch_config WHERE id = 'default';"],
    { encoding: "utf8" }
  ).trim();
  const [url, user, pass] = raw.split("\t");
  if (!url) throw new Error("No OpenSearch credentials in data/ops.sqlite");
  return { base: url.replace(/\/$/, ""), auth: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") };
}

/* ──────────────────── PRODUCT TYPE DETECTION ──────────────────── */
// Mirrors detectProductType() in src/lib/sku-parser.ts.

const PLAN_SKU_PATTERN = /^([A-Z]{2,6})_(\d+)GB_(\d+)D$/;
const RENTAL_TIER = /(_ADVENTURE|_ESCAPE|_VOYAGE|UNLIMITED)/;

export function detectProductType(productSkus, packageSkus = []) {
  const productUpper = productSkus.map((s) => String(s).toUpperCase());
  const packageUpper = packageSkus.map((s) => String(s).toUpperCase());
  const all = [...productUpper, ...packageUpper];

  if (productUpper.some((s) => s.includes("S2GLOCALMERENT") || s.startsWith("S2G"))) return "rental";
  if (productUpper.some((s) => s.includes("ESIM") || s.includes("TELLISIM"))) return "esim";
  if (
    all.some((s) => s.startsWith("DHI_") || s.includes("FLOW") || s.includes("SAPPHIRE")) ||
    all.some((s) => RENTAL_TIER.test(s))
  ) return "sapphire";
  if ([...productSkus, ...packageSkus].some((sku) => PLAN_SKU_PATTERN.test(String(sku)))) return "esim";
  return "unknown";
}

function orderSkus(o) {
  const product = [];
  if (Array.isArray(o.product_sku)) product.push(...o.product_sku);
  else if (o.product_sku) product.push(o.product_sku);
  const pkg = [];
  for (const d of o.order_details_data ?? []) {
    if (d?.product_sku) product.push(d.product_sku);
    if (d?.package_sku) pkg.push(d.package_sku);
  }
  return { product: product.filter(Boolean), pkg: pkg.filter(Boolean) };
}

/* ──────────────── DESTINATION (derived from plan SKU) ──────────────── */
// `destination_country` does not exist on the order docs — the destination is
// encoded in the plan SKU (e.g. DHI_JO_FLOW… → Jordan, DE_20GB_30D → Germany).
// Reuse the repo's ISO2→country map (single source of truth).
function loadCountryMap() {
  const txt = readFileSync(path.join(process.cwd(), "src", "lib", "countries.ts"), "utf8");
  const start = txt.indexOf("{", txt.indexOf("ISO2_TO_COUNTRY"));
  let depth = 0, end = -1;
  for (let i = start; i < txt.length; i++) {
    if (txt[i] === "{") depth++;
    else if (txt[i] === "}" && --depth === 0) { end = i; break; }
  }
  // eslint-disable-next-line no-new-func
  const map = new Function("return " + txt.slice(start, end + 1))();
  if (!map || Object.keys(map).length < 50) throw new Error("country map load failed");
  return map;
}
const ISO2_TO_COUNTRY = loadCountryMap();
const REGION_NAMES = {
  EUROPE: "Europe", EUR: "Europe", EU: "Europe", SEASIA: "Southeast Asia",
  SEASI: "Southeast Asia", CHILE: "Chile", ASIA: "Asia", AFRICA: "Africa",
  AMERICAS: "Americas", GLOBAL: "Global",
};

function skuCountry(sku) {
  const s = String(sku);
  const m = s.match(/^([A-Z]{2,6})_(?:\d+GB_\d+D|\d+D_Unlimited)$/i);
  if (m) return m[1].toUpperCase();
  if (/^DHI_/i.test(s)) {
    const tok = (s.split("_")[1] || "").replace(/\+.*$/, "");
    return ((tok.match(/^[A-Za-z]+/) || [""])[0]).toUpperCase();
  }
  return "";
}

function destinationName(code) {
  if (!code) return "";
  if (REGION_NAMES[code]) return REGION_NAMES[code];
  if (/^[A-Z]{2}$/.test(code) && ISO2_TO_COUNTRY[code]) return ISO2_TO_COUNTRY[code];
  return code;
}

function deriveDestinations(productSkus, packageSkus) {
  const out = new Set();
  for (const sku of [...productSkus, ...packageSkus]) {
    const name = destinationName(skuCountry(sku));
    if (name) out.add(name);
  }
  return out;
}

/* ─────────────────────────── HELPERS ─────────────────────────── */

export const cleanPhone = (p) => (p ? String(p).replace(/\s+/g, " ").trim() : "");
export const isoDate = (sec) => (sec ? new Date(Number(sec) * 1000).toISOString().slice(0, 10) : "");

// First name for personalization, from a full "customer_name".
//   "JOHN SMITH" → "John"      "Smith, John" → "John"
export function firstNameOf(full) {
  if (!full) return "";
  const s = String(full).trim();
  const base = s.includes(",") ? s.split(",")[1] : s;
  const tok = base.trim().split(/\s+/)[0] || "";
  return tok ? tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase() : "";
}

// total is in currency_iso; order_usd_rate_exchange is "{currency}/USD".
export function toUsd(total, rate) {
  const t = Number(total) || 0;
  const r = parseFloat(rate);
  return r > 0 ? t / r : t;
}

/* ─────────────────────────── EXTRACT ─────────────────────────── */

/**
 * Scroll the orders index and aggregate into one entry per (email × product type).
 *
 * @param {object}   opts
 * @param {number}   opts.months  lookback window (default 24)
 * @param {function} opts.log     progress logger (default console.log)
 * @returns {{customers: Map<string, Map<string, object>>, totalMatched, processed,
 *            kept, skippedNoEmail, cutoffSec, months}}
 *
 * Each agg: { name, firstName, phone, system, firstTs, lastTs, orders, totalUsd, destinations:Set }
 */
export async function extractPurchasers({ months = 24, log = console.log } = {}) {
  const { base, auth } = osCreds();
  const SCROLL_TTL = "2m";
  const SCROLL_SIZE = 2000;

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);
  const cutoffSec = Math.floor(cutoffDate.getTime() / 1000);

  async function osFetch(pathPart, body) {
    const res = await fetch(`${base}${pathPart}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`OS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json();
  }

  const query = {
    bool: {
      filter: [{ range: { created_at: { gte: cutoffSec } } }],
      must_not: [
        { terms: { "status.keyword": EXCLUDE_STATUSES } },
        { terms: { "system.keyword": EXCLUDE_SYSTEMS } },
      ],
    },
  };
  const SOURCE = [
    "customer_email", "customer_name", "customer_phone",
    "system", "status", "created_at", "total", "currency_iso", "order_usd_rate_exchange",
    "product_sku", "order_details_data",
  ];

  const customers = new Map();
  let processed = 0, kept = 0, skippedNoEmail = 0;

  const ingest = (hit) => {
    const o = hit._source;
    processed++;
    const email = (o.customer_email || "").trim().toLowerCase();
    if (!email) { skippedNoEmail++; return; }

    const { product, pkg } = orderSkus(o);
    const type = detectProductType(product, pkg);
    const ts = Number(o.created_at) || 0;

    if (!customers.has(email)) customers.set(email, new Map());
    const byType = customers.get(email);
    if (!byType.has(type)) {
      byType.set(type, {
        name: "", firstName: "", phone: "", system: "",
        nameTs: -1, phoneTs: -1, sysTs: -1,
        firstTs: Infinity, lastTs: 0, orders: 0, totalUsd: 0, destinations: new Set(),
      });
    }
    const agg = byType.get(type);
    agg.orders++;
    agg.totalUsd += toUsd(o.total, o.order_usd_rate_exchange);
    if (ts && ts < agg.firstTs) agg.firstTs = ts;
    if (ts > agg.lastTs) agg.lastTs = ts;
    for (const d of deriveDestinations(product, pkg)) agg.destinations.add(d);

    if (ts >= agg.nameTs && o.customer_name) {
      agg.name = String(o.customer_name).trim();
      agg.firstName = firstNameOf(o.customer_name);
      agg.nameTs = ts;
    }
    const ph = cleanPhone(o.customer_phone);
    if (ts >= agg.phoneTs && ph) { agg.phone = ph; agg.phoneTs = ts; }
    if (ts >= agg.sysTs && o.system) { agg.system = String(o.system).trim(); agg.sysTs = ts; }
    kept++;
  };

  log(`Cutoff: ${isoDate(cutoffSec)} (last ${months} months) — scrolling orders…`);
  let resp = await osFetch(`/orders/_search?scroll=${SCROLL_TTL}`, {
    size: SCROLL_SIZE, query, _source: SOURCE, sort: ["_doc"],
  });
  let scrollId = resp._scroll_id;
  let hits = resp.hits?.hits ?? [];
  const totalMatched = resp.hits?.total?.value ?? 0;
  log(`Matched ${totalMatched.toLocaleString()} orders.`);

  while (hits.length) {
    for (const h of hits) ingest(h);
    if (processed % 20000 < SCROLL_SIZE) log(`  …processed ${processed.toLocaleString()}`);
    resp = await osFetch(`/_search/scroll`, { scroll: SCROLL_TTL, scroll_id: scrollId });
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

  log(`Done. processed=${processed.toLocaleString()} kept=${kept.toLocaleString()} skippedNoEmail=${skippedNoEmail.toLocaleString()}`);
  log(`Unique customers: ${customers.size.toLocaleString()}`);

  return { customers, totalMatched, processed, kept, skippedNoEmail, cutoffSec, months };
}
