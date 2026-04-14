/**
 * OpenSearch Index Configuration
 *
 * These indices are fixed in the OpenSearch cluster and mapped to specific
 * product types and data categories. They do not change per environment —
 * only the OS connection credentials (URL, username, password) vary.
 *
 * Source: docs/01-opensearch.md, docs/CDR_INFRASTRUCTURE.md,
 *         docs/ucl_sim_data_flow_analysis.md
 */

// ─── Primary Indices ───

/** All eSIM and TravelWifi orders (231K+ records) */
export const INDEX_ORDERS = "orders";

/** TelliSIM CDR data — the canonical eSIM CDR source */
export const INDEX_CDR_TELLISIM = "tellisim-cdr-read";

// ─── CDR Indices by Product/Vendor ───

/** UCL (uCloudlink) CDR — Sapphire and Rental device sessions */
export const INDEX_CDR_UCL = "ucl-sim-cdr-*";

/** Legacy eSIM CDR — MANX/VFNL XML format (older eSIM archive) */
export const INDEX_CDR_ESIM_ARCHIVE = "esim-archive-cdr_*";

/** Legacy Sapphire/old pipeline CDR */
export const INDEX_CDR_LOGSTASH = "logstash-cdr*";

// ─── Usage / Consumption ───

/** Daily data consumption for Rental/Sapphire devices (by IMEI) */
export const INDEX_DAILY_CONSUMPTION = "daily_data_consumption_*";

// ─── Index-to-Product Mapping ───

export const PRODUCT_INDEX_MAP = {
  esim: {
    orders: INDEX_ORDERS,
    cdr: INDEX_CDR_TELLISIM,
    description: "eSIM orders and TelliSIM CDR data",
  },
  rental: {
    orders: INDEX_ORDERS,
    cdr: [INDEX_CDR_UCL, INDEX_CDR_ESIM_ARCHIVE],
    consumption: INDEX_DAILY_CONSUMPTION,
    description: "Rental orders with UCL CDR (device sessions) and optional eSIM bundle CDR (MANX/VFNL)",
  },
  sapphire: {
    orders: INDEX_ORDERS,
    cdr: INDEX_CDR_UCL,
    consumption: INDEX_DAILY_CONSUMPTION,
    description: "Sapphire hotspot orders with UCL CDR and daily consumption tracking",
  },
} as const;

/** All CDR index patterns for cross-product searches */
export const ALL_CDR_INDICES = [
  INDEX_CDR_TELLISIM,
  INDEX_CDR_UCL,
  INDEX_CDR_ESIM_ARCHIVE,
  INDEX_CDR_LOGSTASH,
];
