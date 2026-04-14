/**
 * ISO2 → Country Flag (Unicode regional indicator)
 * Uses Unicode regional indicator symbols to render flags natively.
 * Works in all modern browsers without images.
 */

export function getCountryFlag(iso2?: string | null): string {
  if (!iso2 || iso2.length < 2) return "";
  const code = iso2.toUpperCase().slice(0, 2);
  // Regional indicators: convert A-Z to regional indicator symbols (U+1F1E6 to U+1F1FF)
  const first = 0x1f1e6 + (code.charCodeAt(0) - 65);
  const second = 0x1f1e6 + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}
