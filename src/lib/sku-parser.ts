/**
 * SKU parser for TravelWifi products.
 *
 * Supported patterns:
 *   eSIM:          DE_20GB_30D, US_5GB_15D, EUR_30D_Unlimited
 *   Sapphire FLOW: DHI_PL_FLOW15GB7DAYS, DHI_PL_FLOW30GB15DAYS_20230525
 *   Sapphire DP:   DHI_FR_DP10GB_Voyage, DHI_Europe_DP5GB_Escape, DHI_US_DP1GB_Adventure
 *   Unlimited:     DHI_PL_DPUNLIMITED, DHI_KW_DPUNLIMITED30DAYS
 */

import { getCountryName } from "./countries";

export interface ParsedPlanSku {
  countryCode: string;     // ISO2 (PL, FR, US) or regional label (Europe, SEAsia, Chile)
  countryName: string;     // Human-readable region name
  dataGB: number;          // 0 for unlimited
  days: number;            // 0 if not specified (validity implied elsewhere)
  unlimited?: boolean;
  tier?: "Adventure" | "Escape" | "Voyage";  // Sapphire Data tier, if applicable
  raw: string;
}

// eSIM: XX_##GB_##D (e.g., DE_20GB_30D)
const PLAN_SKU_PATTERN = /^([A-Z]{2,6})_(\d+)GB_(\d+)D$/;

// eSIM unlimited: XX_##D_Unlimited (e.g., ES_7D_Unlimited)
const PLAN_SKU_UNLIMITED = /^([A-Z]{2,6})_(\d+)D_Unlimited$/i;

// Sapphire FLOW: DHI_{REGION}_FLOW##GB##DAYS[_DATE]
const DHI_FLOW_PATTERN = /^DHI_([A-Za-z0-9+]+)_FLOW(\d+)GB(\d+)DAYS(?:\d*)?(?:_\d+)?$/i;

// Sapphire DP tiered: DHI_{REGION}_DP##GB_{Tier}[_Unlimited]
// When "_Unlimited" suffix is present, the plan is unlimited data (the GB number is ignored).
const DHI_DP_TIER_PATTERN = /^DHI_([A-Za-z0-9+]+)_DP(\d+)GB_(Adventure|Escape|Voyage)(_Unlimited)?$/i;

// Sapphire DP unlimited: DHI_{REGION}_DPUNLIMITED[##DAYS]
const DHI_DP_UNLIMITED_PATTERN = /^DHI_([A-Za-z0-9+]+)_DPUNLIMITED(?:(\d+)DAYS)?$/i;

// Fallback (legacy/regional combinations): capture first ##GB and ##Days wherever they appear
const PLAN_SKU_ALT = /(\d+)GB.*?(\d+)[Dd]ays?/;

// Regional labels embedded in DHI SKUs that are not ISO2 codes
const REGION_NAMES: Record<string, string> = {
  EUROPE: "Europe",
  SEASIA: "Southeast Asia",
  SEASI: "Southeast Asia",
  CHILE: "Chile",
  ASIA: "Asia",
  AFRICA: "Africa",
  AMERICAS: "Americas",
  GLOBAL: "Global",
};

function resolveRegionName(rawCode: string): { code: string; name: string } {
  const upper = rawCode.toUpperCase();
  const stripped = upper.replace(/\+.*$/, ""); // e.g. "KW+EU28" → "KW"
  if (REGION_NAMES[upper]) return { code: upper, name: REGION_NAMES[upper] };
  // ISO2 lookup (two letters)
  if (/^[A-Z]{2}$/.test(stripped)) {
    return { code: stripped, name: getCountryName(stripped) };
  }
  // Fallback: pretty-case raw label
  const pretty = rawCode.charAt(0).toUpperCase() + rawCode.slice(1);
  return { code: upper, name: pretty };
}

/**
 * Parse a plan SKU into structured data across eSIM + Sapphire formats.
 */
export function parsePlanSku(sku: string): ParsedPlanSku | null {
  if (!sku) return null;

  // 1. eSIM: XX_##GB_##D
  const esimMatch = sku.match(PLAN_SKU_PATTERN);
  if (esimMatch) {
    const { code, name } = resolveRegionName(esimMatch[1]);
    return {
      countryCode: code,
      countryName: name,
      dataGB: parseInt(esimMatch[2], 10),
      days: parseInt(esimMatch[3], 10),
      raw: sku,
    };
  }

  // 2. eSIM unlimited: XX_##D_Unlimited
  const esimUnlim = sku.match(PLAN_SKU_UNLIMITED);
  if (esimUnlim) {
    const { code, name } = resolveRegionName(esimUnlim[1]);
    return {
      countryCode: code,
      countryName: name,
      dataGB: 0,
      days: parseInt(esimUnlim[2], 10),
      unlimited: true,
      raw: sku,
    };
  }

  // 3. Sapphire FLOW: DHI_{REGION}_FLOW##GB##DAYS
  const flowMatch = sku.match(DHI_FLOW_PATTERN);
  if (flowMatch) {
    const { code, name } = resolveRegionName(flowMatch[1]);
    return {
      countryCode: code,
      countryName: name,
      dataGB: parseInt(flowMatch[2], 10),
      days: parseInt(flowMatch[3], 10),
      raw: sku,
    };
  }

  // 4. Sapphire DP tiered: DHI_{REGION}_DP##GB_{Tier}[_Unlimited]
  const dpTierMatch = sku.match(DHI_DP_TIER_PATTERN);
  if (dpTierMatch) {
    const { code, name } = resolveRegionName(dpTierMatch[1]);
    const tierRaw = dpTierMatch[3].toLowerCase();
    const tier = (tierRaw.charAt(0).toUpperCase() + tierRaw.slice(1)) as
      | "Adventure"
      | "Escape"
      | "Voyage";
    const isUnlimited = !!dpTierMatch[4];
    return {
      countryCode: code,
      countryName: name,
      dataGB: isUnlimited ? 0 : parseInt(dpTierMatch[2], 10),
      days: 0,
      tier,
      unlimited: isUnlimited || undefined,
      raw: sku,
    };
  }

  // 5. Sapphire DP unlimited: DHI_{REGION}_DPUNLIMITED[##DAYS]
  const dpUnlim = sku.match(DHI_DP_UNLIMITED_PATTERN);
  if (dpUnlim) {
    const { code, name } = resolveRegionName(dpUnlim[1]);
    return {
      countryCode: code,
      countryName: name,
      dataGB: 0,
      days: dpUnlim[2] ? parseInt(dpUnlim[2], 10) : 0,
      unlimited: true,
      raw: sku,
    };
  }

  // 6. Fallback: any legacy/complex SKU with GB + Days embedded
  const altMatch = sku.match(PLAN_SKU_ALT);
  if (altMatch) {
    const parts = sku.split("_");
    const rawCode = parts[0] === "DHI" ? (parts[1] || "") : parts[0];
    const { code, name } = resolveRegionName(rawCode);
    return {
      countryCode: code,
      countryName: name,
      dataGB: parseInt(altMatch[1], 10),
      days: parseInt(altMatch[2], 10),
      raw: sku,
    };
  }

  return null;
}

/**
 * Format a plan SKU for customer-support-friendly display.
 *   DE_20GB_30D              → "Germany — 20 GB, 30 Days"
 *   DHI_PL_FLOW15GB7DAYS     → "Poland — 15 GB, 7 Days"
 *   DHI_FR_DP10GB_Voyage     → "France — 10 GB (Voyage tier)"
 *   DHI_PL_DPUNLIMITED30DAYS → "Poland — Unlimited, 30 Days"
 */
export function formatPlanDisplay(planSku: string): string {
  const parsed = parsePlanSku(planSku);
  if (!parsed) return planSku;

  const parts: string[] = [];
  if (parsed.unlimited) parts.push("Unlimited");
  else if (parsed.dataGB > 0) parts.push(`${parsed.dataGB} GB`);
  if (parsed.days > 0) parts.push(`${parsed.days} Days`);

  const body = parts.length > 0 ? parts.join(", ") : "Plan";
  const tier = parsed.tier ? ` (${parsed.tier} tier)` : "";
  return `${parsed.countryName} — ${body}${tier}`;
}

/**
 * Detect product type from product SKUs and (optionally) package SKUs.
 *
 * Classification rules (mirror docs/PRODUCT_TYPES_AND_DATA_MODELS.md):
 *   - rental   : product_sku contains S2GLOCALMERENT (device is being shipped/rented)
 *   - sapphire : DHI_* plan (FLOW or Adventure/Escape/Voyage/UNLIMITED tier)
 *                WITHOUT S2GLOCALMERENT → customer owns the device, this is a
 *                data-plan reload onto an existing IMEI (no trip dates)
 *   - esim     : TW_eSIM*, TelliSIM, or {COUNTRY}_{GB}GB_{DAYS}D pattern
 */
export function detectProductType(
  productSkus: string[],
  packageSkus: string[] = []
): "esim" | "rental" | "sapphire" | "unknown" {
  const productUpper = productSkus.map((s) => s.toUpperCase());
  const packageUpper = packageSkus.map((s) => s.toUpperCase());
  const all = [...productUpper, ...packageUpper];

  // 1. Rental: physical device is part of the order
  if (productUpper.some((s) => s.includes("S2GLOCALMERENT") || s.startsWith("S2G"))) {
    return "rental";
  }

  // 2. eSIM product SKUs
  if (productUpper.some((s) => s.includes("ESIM") || s.includes("TELLISIM"))) {
    return "esim";
  }

  // 3. Sapphire Data: DHI_* plan loaded onto a customer-owned device.
  //    Includes FLOW plans and tiered data plans (Adventure/Escape/Voyage/UNLIMITED)
  //    when S2GLOCALMERENT is NOT present.
  const RENTAL_TIER = /(_ADVENTURE|_ESCAPE|_VOYAGE|UNLIMITED)/;
  if (
    all.some((s) => s.startsWith("DHI_") || s.includes("FLOW") || s.includes("SAPPHIRE")) ||
    all.some((s) => RENTAL_TIER.test(s))
  ) {
    return "sapphire";
  }

  // 4. {COUNTRY}_{GB}GB_{DAYS}D pattern → eSIM
  if ([...productSkus, ...packageSkus].some((sku) => PLAN_SKU_PATTERN.test(sku))) {
    return "esim";
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
