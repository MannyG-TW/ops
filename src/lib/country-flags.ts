/**
 * ISO2 → Country Flag (Unicode regional indicator)
 * Uses Unicode regional indicator symbols to render flags natively.
 * Works in all modern browsers without images.
 */

// Regional aliases mapped to representative flag emoji (globe fallback when no match)
const REGION_FLAG: Record<string, string> = {
  EUROPE: "🇪🇺",
  EU: "🇪🇺",
  EU28: "🇪🇺",
  EUR: "🇪🇺",
  SEASIA: "🌏",
  ASIA: "🌏",
  AFRICA: "🌍",
  AMERICAS: "🌎",
  GLOBAL: "🌐",
};

export function getCountryFlag(iso2?: string | null): string {
  if (!iso2) return "";
  const upper = iso2.toUpperCase();
  if (REGION_FLAG[upper]) return REGION_FLAG[upper];
  // Only two-letter A-Z codes form valid Unicode regional indicator pairs
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  const first = 0x1f1e6 + (upper.charCodeAt(0) - 65);
  const second = 0x1f1e6 + (upper.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}
