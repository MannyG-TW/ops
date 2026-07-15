/**
 * Client-side settings helper.
 *
 * Credentials are the server's source of truth (SQLite via /api/settings/*).
 * We keep a localStorage cache for two reasons only:
 *   1. Transparent one-time migration from the old localStorage-only design.
 *   2. Offline fallback if the settings API is unreachable.
 * `fetchOS` / `fetchTelliSIM` no longer pass credentials — the server reads
 * them from the DB via `resolveOpenSearchCredentials` / `resolveTelliSIMCredentials`.
 */

const STORAGE_KEY = "travelwifi_ops_settings";
const MIGRATED_KEY = "travelwifi_ops_settings_migrated";

export interface OpenSearchCredentials {
  url: string;
  username: string;
  password: string;
}

export interface TelliSIMCredentials {
  baseUrl: string;
  apiKey: string;
  orgId: string;
}

export interface AppSettings {
  opensearch: OpenSearchCredentials;
  tellisim: TelliSIMCredentials;
  fraudWatch: {
    scanInterval: string;
    enabled: boolean;
  };
}

export function getSettings(): AppSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

export function getOpenSearchCredentials(): OpenSearchCredentials | null {
  const s = getSettings();
  if (!s?.opensearch?.url) return null;
  return s.opensearch;
}

export function getTelliSIMCredentials(): TelliSIMCredentials | null {
  const s = getSettings();
  if (!s?.tellisim?.apiKey) return null;
  return s.tellisim;
}

/**
 * One-time migration: push any legacy localStorage settings into the DB-backed
 * settings API. Safe to call repeatedly — runs at most once per browser (guarded
 * by `MIGRATED_KEY`). Silently no-ops when localStorage is empty.
 */
export async function migrateSettingsToServer(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_KEY)) return;
  const legacy = getSettings();
  if (!legacy) {
    localStorage.setItem(MIGRATED_KEY, "1");
    return;
  }
  try {
    if (legacy.opensearch?.url && legacy.opensearch.username) {
      await fetch("/api/settings/opensearch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legacy.opensearch),
      });
    }
    if (legacy.tellisim?.apiKey) {
      await fetch("/api/settings/tellisim", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(legacy.tellisim),
      });
    }
    localStorage.setItem(MIGRATED_KEY, "1");
  } catch {
    // If migration fails (e.g. dev server down), leave the flag unset so we retry
  }
}

/**
 * POST wrapper used for all OpenSearch-backed endpoints. Credentials are now
 * resolved server-side from SQLite (see lib/server-credentials.ts), so this no
 * longer needs to attach them. Kept as a thin wrapper so existing call-sites
 * don't change shape.
 */
export async function fetchOS(endpoint: string, body: Record<string, unknown> = {}, signal?: AbortSignal) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return res.json();
}

/** POST wrapper for TelliSIM endpoints. Credentials resolved server-side. */
export async function fetchTelliSIM(endpoint: string, body: Record<string, unknown> = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return res.json();
}
