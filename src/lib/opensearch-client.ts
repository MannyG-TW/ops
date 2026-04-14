/**
 * Server-side OpenSearch client utilities.
 * Used by API routes — receives credentials from the request body.
 */

export interface OSCredentials {
  url: string;
  username: string;
  password: string;
}

/**
 * Execute a query against OpenSearch.
 */
export async function queryOS(
  creds: OSCredentials,
  index: string,
  body: Record<string, unknown>,
  params: Record<string, string> = {},
  timeoutMs: number = 15000
) {
  const cleanUrl = creds.url.replace(/\/$/, "");
  const queryString = new URLSearchParams(params).toString();
  const url = `${cleanUrl}/${index}/_search${queryString ? `?${queryString}` : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (creds.username && creds.password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenSearch ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Get a document by ID from OpenSearch.
 */
export async function getDocOS(
  creds: OSCredentials,
  index: string,
  docId: string
) {
  const cleanUrl = creds.url.replace(/\/$/, "");
  const url = `${cleanUrl}/${index}/_doc/${docId}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (creds.username && creds.password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
  }

  const res = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenSearch ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Multi-search across multiple indices.
 */
export async function msearchOS(
  creds: OSCredentials,
  searches: Array<{ index: string; body: Record<string, unknown> }>
) {
  const cleanUrl = creds.url.replace(/\/$/, "");
  const url = `${cleanUrl}/_msearch`;

  const headers: Record<string, string> = {
    "Content-Type": "application/x-ndjson",
  };

  if (creds.username && creds.password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
  }

  // Build NDJSON body
  const ndjson = searches
    .map((s) => `${JSON.stringify({ index: s.index })}\n${JSON.stringify(s.body)}`)
    .join("\n") + "\n";

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: ndjson,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenSearch msearch ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
}
