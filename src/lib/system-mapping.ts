/**
 * System/Tenant → Brand Name mapping
 * Configurable from Settings. Stored in localStorage.
 * Eliminates raw system codes (TWUS, NVCL, etc.) from the UI.
 */

const STORAGE_KEY = "travelwifi_ops_system_mapping";

export interface SystemMapping {
  code: string;
  name: string;
  color?: string;
}

// Default mappings — user can override in Settings
const DEFAULT_MAPPINGS: SystemMapping[] = [
  { code: "TWUS", name: "TravelWifi US" },
  { code: "TWEU", name: "TravelWifi EU" },
  { code: "TWCL", name: "TravelWifi Chile" },
  { code: "NVUS", name: "Navimo US" },
  { code: "NVCL", name: "Navimo Chile" },
  { code: "NVMX", name: "Navimo Mexico" },
  { code: "NVAR", name: "Navimo Argentina" },
  { code: "CMRP", name: "CMR Puntos" },
];

export function getSystemMappings(): SystemMapping[] {
  if (typeof window === "undefined") return DEFAULT_MAPPINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_MAPPINGS;
}

export function saveSystemMappings(mappings: SystemMapping[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
}

export function getSystemName(code?: string): string {
  if (!code) return "Unknown";
  const mappings = getSystemMappings();
  const found = mappings.find((m) => m.code.toUpperCase() === code.toUpperCase());
  return found?.name || code;
}
