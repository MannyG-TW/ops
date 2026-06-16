/**
 * Sapphire device mapping — translates UCL `terminalType` codes (e.g. "G2", "E1")
 * and IMEI TAC prefixes (first 8 digits) into TravelWifi marketing names like
 * "Sapphire 5G" or "Sapphire Touch 4".
 *
 * Same shape/lifecycle as system-mapping: defaults baked in, overrides persisted
 * to localStorage, mutable from the Settings page.
 *
 * Lookup priority for a device:
 *   1. UCL terminalType (most reliable when the QueryBindingRelationInfo call succeeds)
 *   2. IMEI TAC prefix (works offline; fallback when UCL is unreachable)
 */

const STORAGE_KEY = "travelwifi_ops_sapphire_mapping";

export interface SapphireMapping {
  /** UCL terminalType code (e.g. "G2") OR IMEI TAC prefix (8 digits) */
  code: string;
  /** Marketing display name (e.g. "Sapphire 5G") */
  name: string;
  /** "terminal" if `code` is a UCL terminalType, "tac" if an IMEI prefix */
  kind: "terminal" | "tac";
  /** Optional URL to a product photo (4:3 or 1:1 best). Shown as a 64px thumbnail. */
  imageUrl?: string;
  /** Optional URL to a setup / configuration guide. Opens in a new tab. */
  setupGuideUrl?: string;
  /** Optional URL to a troubleshooting doc. Opens in a new tab. */
  troubleshootingUrl?: string;
  /** Optional notes for the operator (form factor, year, etc.) */
  notes?: string;
}

// Defaults — extend in Settings as new hardware ships.
// terminalType codes are taken from UCL spec §5.6.5; TAC prefixes are placeholders
// pending verification against real device batches.
const DEFAULT_MAPPINGS: SapphireMapping[] = [
  { code: "G2", kind: "terminal", name: "Sapphire G2", notes: "uCloudlink G2 hotspot" },
  { code: "G3", kind: "terminal", name: "Sapphire G3" },
  { code: "G4", kind: "terminal", name: "Sapphire G4" },
  { code: "E1", kind: "terminal", name: "Sapphire E1" },
  { code: "U2", kind: "terminal", name: "Sapphire U2" },
  { code: "U3", kind: "terminal", name: "Sapphire U3" },
  { code: "U3Q19", kind: "terminal", name: "Sapphire U3Q19", notes: "Set marketing name + image in Settings" },
  { code: "U50", kind: "terminal", name: "Sapphire U50", notes: "Set marketing name + image in Settings" },
  // TAC examples — populate from real IMEI batches
  { code: "35570043", kind: "tac", name: "Sapphire (TAC 35570043)", notes: "Verify model from device batch" },
];

export function getSapphireMappings(): SapphireMapping[] {
  if (typeof window === "undefined") return DEFAULT_MAPPINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    /* ignore */
  }
  return DEFAULT_MAPPINGS;
}

export function saveSapphireMappings(mappings: SapphireMapping[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

export interface ResolvedDevice {
  name: string;
  source: "terminal" | "tac" | "fallback";
  code: string;
  imageUrl?: string;
  setupGuideUrl?: string;
  troubleshootingUrl?: string;
  notes?: string;
}

/** Resolve a friendly device name + assets from terminalType + IMEI. */
export function getSapphireDeviceName(opts: {
  terminalType?: string | null;
  imei?: string | null;
}): ResolvedDevice {
  const mappings = getSapphireMappings();
  const term = (opts.terminalType || "").trim().toUpperCase();
  if (term) {
    const found = mappings.find((m) => m.kind === "terminal" && m.code.toUpperCase() === term);
    if (found) {
      return {
        name: found.name, source: "terminal", code: term,
        imageUrl: found.imageUrl, setupGuideUrl: found.setupGuideUrl,
        troubleshootingUrl: found.troubleshootingUrl, notes: found.notes,
      };
    }
  }
  const tac = (opts.imei || "").replace(/\D/g, "").slice(0, 8);
  if (tac.length === 8) {
    const found = mappings.find((m) => m.kind === "tac" && m.code === tac);
    if (found) {
      return {
        name: found.name, source: "tac", code: tac,
        imageUrl: found.imageUrl, setupGuideUrl: found.setupGuideUrl,
        troubleshootingUrl: found.troubleshootingUrl, notes: found.notes,
      };
    }
  }
  // Fallback — surface what we know so the operator can add the mapping
  if (term) return { name: `Sapphire (${term})`, source: "fallback", code: term };
  if (tac) return { name: `Sapphire (TAC ${tac})`, source: "fallback", code: tac };
  return { name: "Sapphire device", source: "fallback", code: "" };
}
