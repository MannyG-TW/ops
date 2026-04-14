/**
 * SKU parser for TravelWifi products
 * Handles eSIM product SKUs (TW_eSIM_Tellisim) and plan SKUs (DE_20GB_30D)
 */

import { getCountryName } from "./countries";

export interface ParsedPlanSku {
  countryCode: string;
  countryName: string;
  dataGB: number;
  days: number;
  raw: string;
}

// Pattern: XX_##GB_##D (e.g., DE_20GB_30D, US_5GB_15D)
const PLAN_SKU_PATTERN = /^([A-Z]{2,6})_(\d+)GB_(\d+)D$/;

// Pattern: XX_##GB_##Days or XX_##GB_FP_##days (e.g., DHI_KW+EU28_45GB_FP_30days)
const PLAN_SKU_ALT = /(\d+)GB.*?(\d+)[Dd]ays?/;

/**
 * Parse a plan SKU into structured data.
 * Examples:
 *   DE_20GB_30D → { countryCode: "DE", countryName: "Germany", dataGB: 20, days: 30 }
 *   US_5GB_15D → { countryCode: "US", countryName: "United States", dataGB: 5, days: 15 }
 */
export function parsePlanSku(sku: string): ParsedPlanSku | null {
  if (!sku) return null;

  const match = sku.match(PLAN_SKU_PATTERN);
  if (match) {
    const countryCode = match[1];
    return {
      countryCode,
      countryName: getCountryName(countryCode),
      dataGB: parseInt(match[2], 10),
      days: parseInt(match[3], 10),
      raw: sku,
    };
  }

  // Try alternative pattern for complex SKUs
  const altMatch = sku.match(PLAN_SKU_ALT);
  if (altMatch) {
    // Extract country from first segment
    const parts = sku.split("_");
    const countryCode = parts[0] === "DHI" ? (parts[1] || "").split("+")[0] : parts[0];
    return {
      countryCode,
      countryName: getCountryName(countryCode),
      dataGB: parseInt(altMatch[1], 10),
      days: parseInt(altMatch[2], 10),
      raw: sku,
    };
  }

  return null;
}

/**
 * Format a plan SKU for display.
 * DE_20GB_30D → "Germany — 20 GB, 30 Days"
 */
export function formatPlanDisplay(planSku: string): string {
  const parsed = parsePlanSku(planSku);
  if (!parsed) return planSku;
  return `${parsed.countryName} — ${parsed.dataGB} GB, ${parsed.days} Days`;
}

/**
 * Detect product type from an array of SKUs.
 */
export function detectProductType(skus: string[]): "esim" | "rental" | "sapphire" | "unknown" {
  for (const sku of skus) {
    const upper = sku.toUpperCase();
    if (upper.includes("ESIM") || upper.includes("TELLISIM")) return "esim";
    if (upper.includes("S2GLOCALMERENT") || upper.includes("RENT")) return "rental";
    if (upper.includes("FLOW") || upper.includes("SAPPHIRE")) return "sapphire";
  }
  // Check for plan-style SKU (XX_##GB_##D) which indicates eSIM
  for (const sku of skus) {
    if (PLAN_SKU_PATTERN.test(sku)) return "esim";
  }
  return "unknown";
}

/**
 * Find the plan SKU from an array of SKUs (the one with country_data_days pattern).
 */
export function findPlanSku(skus: string[]): string | null {
  for (const sku of skus) {
    if (parsePlanSku(sku)) return sku;
  }
  return null;
}
