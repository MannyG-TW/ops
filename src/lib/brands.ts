/**
 * Customer-facing brand resolution.
 *
 * The ops tool serves several brands. Every order belongs to a brand identified
 * by the leading letters of its order number / system code, regardless of the
 * country suffix — e.g. NVUS-1900, NVCL-..., NVMX-... are all "Navimo".
 *
 * Keep this in sync with the brands you sell under. The 2-letter prefix is the
 * brand; the next two letters are the country (US, EU, CL, MX, AR, ...).
 */

const BRAND_BY_PREFIX: Record<string, string> = {
  TW: "TravelWifi",
  NV: "Navimo",
  CM: "CMR Puntos", // system code CMRP
};

/** Parent/default brand used when a prefix isn't recognised. */
export const DEFAULT_BRAND = "TravelWifi";

/**
 * Resolve the customer-facing brand name from an order number or system code.
 * Examples: "NVUS-1900" -> "Navimo", "TWEU-42" -> "TravelWifi", "CMRP-7" -> "CMR Puntos".
 */
export function resolveBrandName(orderNumberOrSystem?: string | null): string {
  if (!orderNumberOrSystem) return DEFAULT_BRAND;
  const code = orderNumberOrSystem.trim().toUpperCase();
  return BRAND_BY_PREFIX[code.slice(0, 2)] || DEFAULT_BRAND;
}
