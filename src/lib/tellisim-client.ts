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

async function telliSIMFetch(
  creds: TelliSIMCredentials,
  path: string,
  method: string = "GET",
  body?: Record<string, unknown>
) {
  const cleanUrl = (creds.baseUrl || "https://api.tellisim.com").replace(/\/$/, "");
  const separator = path.includes("?") ? "&" : "?";
  const url = `${cleanUrl}${path}${separator}key=${encodeURIComponent(creds.apiKey)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`TelliSIM ${res.status}: ${text.slice(0, 300)}`);
  }

  return res.json();
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
