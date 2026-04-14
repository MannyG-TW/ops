/**
 * Plan Catalog Utility
 * Provides lookup functions for plan pricing, countries, and metadata.
 * Data source: CRM JSON files stored in localStorage (uploaded via Settings).
 * Fallback: static files from src/data/ at build time.
 */

const STORAGE_KEY_LOCAL = "travelwifi_catalog_local";
const STORAGE_KEY_REGIONAL = "travelwifi_catalog_regional";
const STORAGE_KEY_GLOBAL = "travelwifi_catalog_global";
const STORAGE_KEY_ACTIVE = "travelwifi_catalog_active_versions";

// ─── Types ───

export interface CatalogMeta {
  plan_type: string;
  plan_id: string;
  version: number;
  currency: string;
  exported_at: string;
  source_updated_at: string;
  source?: {
    vendor_name?: string;
    sheet_version?: string;
    valid_from?: string;
  };
}

export interface SeasonSchedule {
  peak: { months: number[]; multiplier: number };
  high: { months: number[]; multiplier: number };
  shoulder: { months: number[]; multiplier: number };
  low: { months: number[]; multiplier: number };
}

export interface LocalProduct {
  sku: string;
  plan_type: string;
  country: string;
  data_gb: number;
  validity_days: number;
  prices: { peak: number; high: number; shoulder: number; low: number };
  pricing_mode: string;
  RL?: number;
  PS?: number;
  CT?: number;
}

export interface TierPackage {
  sku: string;
  data_gb: number;
  validity_days: number;
  price_usd: number;
}

export interface Tier {
  tier_name: string;
  tier_type: string;
  country_count: number;
  countries: string[];
  packages: TierPackage[];
  monitored?: boolean;
  tracking_id?: string;
}

export interface RegionalRegion {
  region_name: string;
  countries: string[];
  country_count: number;
  tiers: Tier[];
  monitored?: boolean;
}

export interface CatalogSummary {
  planType: string;
  planId: string;
  version: number;
  exportedAt: string;
  currency: string;
  vendorName: string;
  sheetVersion: string;
  totalProducts: number;
  totalCountries: number;
  storageKey: string;
  loaded: boolean;
}

// ─── Season Detection ───

export function getSeason(date: Date, schedule: SeasonSchedule): "peak" | "high" | "shoulder" | "low" {
  const month = date.getMonth() + 1;
  if (schedule.peak.months.includes(month)) return "peak";
  if (schedule.high.months.includes(month)) return "high";
  if (schedule.shoulder.months.includes(month)) return "shoulder";
  return "low";
}

// ─── Storage ───

function getStorageKey(planType: string): string {
  if (planType === "local") return STORAGE_KEY_LOCAL;
  if (planType === "regional") return STORAGE_KEY_REGIONAL;
  if (planType === "global") return STORAGE_KEY_GLOBAL;
  return STORAGE_KEY_LOCAL;
}

export function saveCatalog(planType: string, data: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getStorageKey(planType), JSON.stringify(data));
  // Update active versions
  const versions = getActiveVersions();
  versions[planType] = {
    plan_id: data.plan_id as string,
    version: data.version as number,
    exported_at: data.exported_at as string,
    uploaded_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY_ACTIVE, JSON.stringify(versions));
}

export function loadCatalog(planType: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(getStorageKey(planType));
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return null;
}

export function getActiveVersions(): Record<string, { plan_id: string; version: number; exported_at: string; uploaded_at: string }> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY_ACTIVE);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {};
}

// ─── Validation ───

export interface ValidationResult {
  valid: boolean;
  planType: string | null;
  planId: string | null;
  version: number | null;
  errors: string[];
  stats: {
    products: number;
    countries: number;
    regions?: number;
    tiers?: number;
  };
}

export function validateCatalog(data: unknown): ValidationResult {
  const errors: string[] = [];
  const result: ValidationResult = {
    valid: false,
    planType: null,
    planId: null,
    version: null,
    errors,
    stats: { products: 0, countries: 0 },
  };

  if (!data || typeof data !== "object") {
    errors.push("Invalid JSON: not an object");
    return result;
  }

  const obj = data as Record<string, unknown>;

  // Check required root fields
  if (!obj.export_type || obj.export_type !== "connect_pricing") {
    errors.push("Missing or invalid export_type (expected 'connect_pricing')");
  }
  if (!obj.plan_type || !["local", "regional", "global"].includes(obj.plan_type as string)) {
    errors.push("Missing or invalid plan_type (expected 'local', 'regional', or 'global')");
  }
  if (!obj.plan_id) errors.push("Missing plan_id");
  if (typeof obj.version !== "number") errors.push("Missing or invalid version (must be a number)");
  if (!obj.currency) errors.push("Missing currency");
  if (!obj.season_schedule) errors.push("Missing season_schedule");

  result.planType = (obj.plan_type as string) || null;
  result.planId = (obj.plan_id as string) || null;
  result.version = (obj.version as number) ?? null;

  if (errors.length > 0) return result;

  const countries = new Set<string>();
  let productCount = 0;

  if (obj.plan_type === "local") {
    const products = obj.products as LocalProduct[] | undefined;
    if (!Array.isArray(products) || products.length === 0) {
      errors.push("Local plan missing products array");
    } else {
      productCount = products.length;
      for (const p of products) {
        if (!p.sku) errors.push(`Product missing sku`);
        if (!p.prices) errors.push(`Product ${p.sku} missing prices`);
        if (p.country) countries.add(p.country);
      }
    }
  } else if (obj.plan_type === "regional") {
    const regions = obj.regions as Record<string, RegionalRegion> | undefined;
    if (!regions || typeof regions !== "object") {
      errors.push("Regional plan missing regions object");
    } else {
      result.stats.regions = Object.keys(regions).length;
      let tierCount = 0;
      for (const [, region] of Object.entries(regions)) {
        if (region.countries) region.countries.forEach((c: string) => countries.add(c));
        if (region.tiers) {
          tierCount += region.tiers.length;
          for (const tier of region.tiers) {
            productCount += tier.packages?.length || 0;
          }
        }
      }
      result.stats.tiers = tierCount;
    }
  } else if (obj.plan_type === "global") {
    const tiers = obj.tiers as Tier[] | undefined;
    if (!Array.isArray(tiers) || tiers.length === 0) {
      errors.push("Global plan missing tiers array");
    } else {
      result.stats.tiers = tiers.length;
      for (const tier of tiers) {
        if (tier.countries) tier.countries.forEach((c: string) => countries.add(c));
        productCount += tier.packages?.length || 0;
      }
    }
  }

  result.stats.products = productCount;
  result.stats.countries = countries.size;
  result.valid = errors.length === 0;
  return result;
}

// ─── Lookup Functions ───

/**
 * Get the catalog price for a SKU, considering season at purchase date.
 * Returns USD price or null if not found.
 */
export function getCatalogPrice(sku: string, purchaseDate?: Date): number | null {
  if (!sku) return null;
  const skuUpper = sku.toUpperCase();

  // Try local catalog first (most SKUs are local: XX_NGB_ND)
  const local = loadCatalog("local");
  if (local) {
    const products = local.products as LocalProduct[] | undefined;
    const schedule = local.season_schedule as SeasonSchedule | undefined;
    if (products) {
      const match = products.find(p => p.sku.toUpperCase() === skuUpper);
      if (match && match.prices && schedule) {
        const season = purchaseDate ? getSeason(purchaseDate, schedule) : "shoulder";
        return match.prices[season] ?? null;
      }
    }
  }

  // Try regional
  const regional = loadCatalog("regional");
  if (regional) {
    const regions = regional.regions as Record<string, RegionalRegion> | undefined;
    if (regions) {
      for (const region of Object.values(regions)) {
        for (const tier of region.tiers || []) {
          const match = tier.packages?.find(p => p.sku.toUpperCase() === skuUpper);
          if (match) return match.price_usd;
        }
      }
    }
  }

  // Try global
  const global = loadCatalog("global");
  if (global) {
    const tiers = global.tiers as Tier[] | undefined;
    if (tiers) {
      for (const tier of tiers) {
        const match = tier.packages?.find(p => p.sku.toUpperCase() === skuUpper);
        if (match) return match.price_usd;
      }
    }
  }

  return null;
}

/**
 * Get the countries covered by a plan SKU.
 */
export function getPlanCountries(sku: string): string[] {
  if (!sku) return [];
  const skuUpper = sku.toUpperCase();

  // Local: single country
  const local = loadCatalog("local");
  if (local) {
    const products = local.products as LocalProduct[] | undefined;
    const match = products?.find(p => p.sku.toUpperCase() === skuUpper);
    if (match?.country) return [match.country];
  }

  // Regional
  const regional = loadCatalog("regional");
  if (regional) {
    const regions = regional.regions as Record<string, RegionalRegion> | undefined;
    if (regions) {
      for (const region of Object.values(regions)) {
        for (const tier of region.tiers || []) {
          if (tier.packages?.some(p => p.sku.toUpperCase() === skuUpper)) {
            return tier.countries || region.countries || [];
          }
        }
      }
    }
  }

  // Global
  const global = loadCatalog("global");
  if (global) {
    const tiers = global.tiers as Tier[] | undefined;
    if (tiers) {
      for (const tier of tiers) {
        if (tier.packages?.some(p => p.sku.toUpperCase() === skuUpper)) {
          return tier.countries || [];
        }
      }
    }
  }

  return [];
}

/**
 * Get all catalog summaries for display in Settings.
 */
export function getCatalogSummaries(): CatalogSummary[] {
  const summaries: CatalogSummary[] = [];
  const types = ["local", "regional", "global"] as const;

  for (const t of types) {
    const data = loadCatalog(t);
    if (data) {
      const validation = validateCatalog(data);
      summaries.push({
        planType: t,
        planId: (data.plan_id as string) || "—",
        version: (data.version as number) || 0,
        exportedAt: (data.exported_at as string) || "—",
        currency: (data.currency as string) || "USD",
        vendorName: ((data.source as Record<string, unknown>)?.vendor_name as string) || "—",
        sheetVersion: ((data.source as Record<string, unknown>)?.sheet_version as string) || "—",
        totalProducts: validation.stats.products,
        totalCountries: validation.stats.countries,
        storageKey: getStorageKey(t),
        loaded: true,
      });
    } else {
      summaries.push({
        planType: t,
        planId: "—",
        version: 0,
        exportedAt: "—",
        currency: "—",
        vendorName: "—",
        sheetVersion: "—",
        totalProducts: 0,
        totalCountries: 0,
        storageKey: getStorageKey(t),
        loaded: false,
      });
    }
  }

  return summaries;
}
