/**
 * Client-side settings helper.
 * Reads credentials from localStorage and passes them to API routes.
 */

const STORAGE_KEY = "travelwifi_ops_settings";

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
 * Fetch wrapper that injects OS credentials from localStorage into the request body.
 */
export async function fetchOS(endpoint: string, body: Record<string, unknown> = {}) {
  const creds = getOpenSearchCredentials();
  if (!creds) throw new Error("OpenSearch not configured. Go to Settings to add credentials.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, credentials: creds }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch wrapper that injects TelliSIM credentials from localStorage.
 */
export async function fetchTelliSIM(endpoint: string, body: Record<string, unknown> = {}) {
  const creds = getTelliSIMCredentials();
  if (!creds) throw new Error("TelliSIM not configured. Go to Settings to add your API key.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, credentials: creds }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return res.json();
}
