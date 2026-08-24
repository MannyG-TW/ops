/**
 * Server-side TelliSIM v3 API client utilities.
 * Auth: query string ?key=<api_key>
 * Docs: TelliSIM_API_v3_Complete_Documentation.md
 */

export interface TelliSIMCredentials {
  baseUrl: string;
  apiKey: string;
  orgId?: string;
}

/** Strip the `?key=…` secret from any string before it can reach a client. */
function redactKey(s: string): string {
  return s.replace(/key=[^&\s"']+/gi, "key=***");
}

/**
 * Default per-request timeout.
 *
 * Measured Aug 2026: most v3 endpoints answer in 0.3–2.2s, but
 * `/subscriptions/{iccid}/location` consistently takes 7.6–7.7s. The previous
 * 10s ceiling left that endpoint ~2s of headroom and it failed intermittently,
 * surfacing to operators as a bare "TelliSIM request failed" on the Location
 * panel.
 */
const DEFAULT_TIMEOUT_MS = 20_000;

/** Network events scans event logs and routinely exceeds the default. */
const NETWORK_EVENTS_TIMEOUT_MS = 30_000;

async function telliSIMFetch(
  creds: TelliSIMCredentials,
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
) {
  const cleanUrl = (creds.baseUrl || "https://api.tellisim.com").replace(/\/$/, "");
  // Validate the base URL up front: otherwise an invalid URL makes fetch throw
  // a TypeError whose message embeds the full URL — including ?key=<apiKey>.
  try {
    new URL(cleanUrl);
  } catch {
    throw new Error("TelliSIM base URL is invalid — fix it in Settings");
  }
  const separator = path.includes("?") ? "&" : "?";
  const url = `${cleanUrl}${path}${separator}key=${encodeURIComponent(creds.apiKey)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Never let a network/parse error surface the key-bearing URL
    const msg = err instanceof Error ? err.message : String(err);
    const wrapped = new Error(`TelliSIM request failed: ${redactKey(msg)}`);
    // Carry the timeout signal across the wrapper. sanitizeError branches on
    // err.name to return a 504 "request timed out"; a plain `new Error` resets
    // the name to "Error", making that branch unreachable and reporting every
    // timeout as a generic failure with no hint that it was a latency problem.
    if (err instanceof Error && err.name === "TimeoutError") {
      wrapped.name = "TimeoutError";
    }
    throw wrapped;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TelliSIM ${res.status}: ${redactKey(text.slice(0, 300))}`);
  }

  try {
    return await res.json();
  } catch (err) {
    // A 200 with a non-JSON body throws a SyntaxError that can echo the body;
    // keep the key-bearing URL out of it.
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`TelliSIM response parse failed: ${redactKey(msg)}`);
  }
}

/**
 * Get subscription details for an ICCID.
 * GET /v3/subscriptions/{iccid}
 */
export async function getSubscription(creds: TelliSIMCredentials, iccid: string) {
  return telliSIMFetch(creds, `/v3/subscriptions/${iccid}`);
}

/**
 * Get plan attachments for an ICCID (all attachments, not just latest).
 * GET /v3/subscriptions/{iccid}/plan-attachments
 */
export async function getPlanAttachments(creds: TelliSIMCredentials, iccid: string) {
  return telliSIMFetch(creds, `/v3/subscriptions/${iccid}/plan-attachments`);
}

/**
 * List subscriptions with optional filters.
 * GET /v3/subscriptions
 */
export async function listSubscriptions(
  creds: TelliSIMCredentials,
  params: { limit?: number; offset?: number; state?: string } = {}
) {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.state) query.set("state", params.state);
  const qs = query.toString();
  return telliSIMFetch(creds, `/v3/subscriptions${qs ? `?${qs}` : ""}`);
}

/**
 * Get coverage profiles.
 * GET /v3/coverage-profiles
 */
export async function getCoverageProfiles(creds: TelliSIMCredentials) {
  return telliSIMFetch(creds, "/v3/coverage-profiles");
}

/**
 * Get plans available for a coverage profile.
 * GET /v3/coverage-profiles/{id}/plans
 */
export async function getPlans(creds: TelliSIMCredentials, coverageProfileId: string) {
  return telliSIMFetch(creds, `/v3/coverage-profiles/${coverageProfileId}/plans`);
}

/**
 * Send SMS to a subscription.
 * POST /v3/subscriptions/{iccid}/send-sms
 */
export async function sendSMS(
  creds: TelliSIMCredentials,
  iccid: string,
  from: string,
  message: string
) {
  return telliSIMFetch(creds, `/v3/subscriptions/${iccid}/send-sms`, "POST", { from, message });
}

/**
 * Get subscription location.
 * GET /v3/subscriptions/{iccid}/location
 */
export async function getSubscriptionLocation(creds: TelliSIMCredentials, iccid: string) {
  return telliSIMFetch(creds, `/v3/subscriptions/${iccid}/location`);
}

/**
 * Get network attach + data session events for an ICCID over a date range.
 * POST /v3/subscriptions/{iccid}/network-events
 *
 * TelliSIM caps a single call at a **7-day window counting both endpoints**
 * (2026-08-15 → 2026-08-21 is the maximum) and rejects a `start` that is not
 * before `end`. Anything longer must be chunked by the caller.
 *
 * Returns `{ error, label, data: { 2g_or_3g_attach[], 4g_or_5g_attach[],
 * data_usage[] } }`. Field casing is inconsistent between TelliSIM's schema and
 * their live payloads — always run the result through `normalizeNetworkEvents()`
 * in `@/lib/network-events` rather than reading keys directly.
 *
 * @param start Inclusive start date, `YYYY-MM-DD`
 * @param end   Inclusive end date, `YYYY-MM-DD`
 */
export async function getNetworkEvents(
  creds: TelliSIMCredentials,
  iccid: string,
  start: string,
  end: string
) {
  return telliSIMFetch(
    creds,
    `/v3/subscriptions/${iccid}/network-events`,
    "POST",
    { period: { start, end } },
    // Measured at ~10.5s for a busy 7-day window (60 attach + 279 data events),
    // which overran the shared 10s default. This endpoint scans event logs
    // rather than reading a record, so it is structurally slower than the rest.
    NETWORK_EVENTS_TIMEOUT_MS
  );
}

/**
 * Get a single coverage profile by ID.
 * GET /v3/coverage-profiles/{coverageId}
 */
export async function getCoverageProfile(creds: TelliSIMCredentials, coverageId: string) {
  return telliSIMFetch(creds, `/v3/coverage-profiles/${coverageId}`);
}

/**
 * Get operators with optional filters.
 * GET /v3/operators
 */
export async function getOperators(
  creds: TelliSIMCredentials,
  params: { label?: string; iso2Codes?: string } = {}
) {
  const query = new URLSearchParams();
  if (params.label) query.set("label", params.label);
  if (params.iso2Codes) query.set("iso2Codes", params.iso2Codes);
  const qs = query.toString();
  return telliSIMFetch(creds, `/v3/operators${qs ? `?${qs}` : ""}`);
}

/**
 * Get SIM details.
 * GET /v3/sims/{iccid}
 */
export async function getSimDetails(creds: TelliSIMCredentials, iccid: string) {
  return telliSIMFetch(creds, `/v3/sims/${iccid}`);
}

/**
 * Get SMDP info — profile installation status and state history.
 * GET /v3/sims/{iccid}/smdp-info
 *
 * Returns state_history with states: "BPP Installation", "Enable", "Disable", "Delete"
 * and current_status field.
 */
export async function getSmdpInfo(creds: TelliSIMCredentials, iccid: string) {
  return telliSIMFetch(creds, `/v3/sims/${iccid}/smdp-info`);
}

/**
 * List SIMs with optional filters and pagination.
 * GET /v3/sims
 */
export async function listSims(
  creds: TelliSIMCredentials,
  params: { pageSize?: number; page?: string; isEsim?: boolean } = {}
) {
  const query = new URLSearchParams();
  if (params.pageSize) query.set("page_size", String(params.pageSize));
  if (params.page) query.set("page", params.page);
  if (params.isEsim !== undefined) query.set("is_esim", String(params.isEsim));
  const qs = query.toString();
  return telliSIMFetch(creds, `/v3/sims${qs ? `?${qs}` : ""}`);
}

/**
 * Suspend a plan attachment (NON-REVERSIBLE).
 * POST /v3/subscriptions/{iccid}/plan-attachments/{planAttachmentId}/suspend
 */
export async function suspendPlanAttachment(
  creds: TelliSIMCredentials,
  iccid: string,
  planAttachmentId: string
) {
  return telliSIMFetch(
    creds,
    `/v3/subscriptions/${iccid}/plan-attachments/${planAttachmentId}/suspend`,
    "POST"
  );
}
