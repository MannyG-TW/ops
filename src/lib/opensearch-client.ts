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
  timeoutMs: number = 15000,
  signal?: AbortSignal
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
    // Abandoned client requests cancel the upstream query instead of running
    // a full 15s wildcard scan for nobody
    signal: signal
      ? AbortSignal.any([AbortSignal.timeout(timeoutMs), signal])
      : AbortSignal.timeout(timeoutMs),
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
 * Create an index with the given mapping if it does not already exist.
 *
 * Safe to call on every write path: an existing index returns 400
 * `resource_already_exists_exception`, which is treated as success.
 */
export async function ensureIndexOS(
  creds: OSCredentials,
  index: string,
  body: Record<string, unknown>
): Promise<void> {
  const cleanUrl = creds.url.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (creds.username && creds.password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
  }

  const res = await fetch(`${cleanUrl}/${index}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (res.ok) return;
  const text = await res.text().catch(() => "");
  if (res.status === 400 && /resource_already_exists/.test(text)) return;
  throw new Error(`OpenSearch ${res.status}: ${text.slice(0, 300)}`);
}

/**
 * Bulk-index documents with caller-supplied deterministic IDs.
 *
 * Uses `index` (not `create`), so re-sending the same document ID overwrites
 * rather than erroring or duplicating. Pair that with an ID derived from the
 * document's natural key and repeat writes become idempotent.
 *
 * Returns the IDs successfully written. Partial failure is normal for bulk —
 * per-item errors do not fail the whole request — so callers must treat
 * "absent from the returned set" as "still needs writing" rather than
 * assuming all-or-nothing.
 */
export async function bulkIndexOS(
  creds: OSCredentials,
  index: string,
  docs: Array<{ id: string; doc: Record<string, unknown> }>,
  timeoutMs: number = 30000
): Promise<{ indexed: string[]; errors: Array<{ id: string; reason: string }> }> {
  if (docs.length === 0) return { indexed: [], errors: [] };

  const cleanUrl = creds.url.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/x-ndjson" };
  if (creds.username && creds.password) {
    headers["Authorization"] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString("base64")}`;
  }

  const ndjson =
    docs
      .map(
        (d) =>
          `${JSON.stringify({ index: { _index: index, _id: d.id } })}\n${JSON.stringify(d.doc)}`
      )
      .join("\n") + "\n";

  const res = await fetch(`${cleanUrl}/_bulk`, {
    method: "POST",
    headers,
    body: ndjson,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenSearch ${res.status}: ${text.slice(0, 300)}`);
  }

  const body = (await res.json()) as {
    items?: Array<{ index?: { _id?: string; status?: number; error?: { reason?: string } } }>;
  };

  const indexed: string[] = [];
  const errors: Array<{ id: string; reason: string }> = [];
  for (const item of body.items ?? []) {
    const r = item.index;
    if (!r) continue;
    if (r.error) errors.push({ id: r._id ?? "?", reason: r.error.reason ?? "unknown" });
    else if (r._id) indexed.push(r._id);
  }
  return { indexed, errors };
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
