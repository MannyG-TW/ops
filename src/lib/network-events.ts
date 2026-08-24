/**
 * TelliSIM network-events normalization and intent analysis.
 *
 * Source: `POST /v3/subscriptions/{iccid}/network-events` — see
 * docs/TelliSIM_API_v3_Complete_Documentation.md § Get Network Events.
 *
 * Two things this module exists to absorb:
 *
 * 1. **Casing.** TelliSIM's published schema is snake_case (`event_time`,
 *    `country_alpha_2`, `request_type`) with a real boolean `oper_allowed` and
 *    UTC `Z` timestamps. The sample payload their support team ships uses
 *    camelCase (`eventTime`, `countryAlpha2`, `requestType`), a **string**
 *    `"true"` for `oper_allowed`, and local-offset timestamps. Neither has been
 *    confirmed as the live shape, so every reader here accepts both.
 *
 * 2. **Intent.** An attach attempt in a country the plan does not cover is the
 *    signal we actually care about: the customer physically travelled somewhere
 *    we did not sell them. That is demand evidence, not a support failure.
 */

import { ISO2_TO_COUNTRY } from "./countries";

// TelliSIM shapes vary; raw records are read defensively.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/** Which array an event came from. `DATA` is a data-session event, not an attach. */
export type EventKind = "2G_3G" | "4G_5G" | "DATA";

export interface NormalizedNetworkEvent {
  kind: EventKind;
  /** ISO-8601 as returned by TelliSIM; may carry a local offset instead of `Z`. */
  eventTime: string | null;
  countryName: string | null;
  /** Uppercased ISO 3166-1 alpha-2. TelliSIM returns lowercase. */
  countryAlpha2: string | null;
  operator: string | null;
  /** `Init` | `Update` | `Term` — data-session events only. */
  requestType: string | null;
  /**
   * Attach succeeded (`result === "ok"` / `oper_allowed` truthy) or the data
   * session succeeded (`result === "success"`).
   */
  succeeded: boolean;
}

export type NetworkVerdict =
  | "no_events"
  | "no_attach"
  | "attach_rejected"
  | "attach_ok_no_data"
  | "data_failed"
  | "ok";

export interface CountryIntent {
  countryAlpha2: string;
  countryName: string | null;
  operators: string[];
  attempts: number;
  attachAttempts: number;
  /** True if any attach in this country was accepted by the operator. */
  attachSucceeded: boolean;
  /** True if any data session in this country succeeded. */
  dataSucceeded: boolean;
  firstSeen: string | null;
  lastSeen: string | null;
}

export interface NetworkEventsAnalysis {
  events: NormalizedNetworkEvent[];
  attaches: NormalizedNetworkEvent[];
  dataSessions: NormalizedNetworkEvent[];
  attachedOk: boolean;
  dataOk: boolean;
  verdict: NetworkVerdict;
  /** Every country seen in the window, uppercase ISO2. */
  countries: string[];
  /**
   * Countries seen that the plan's coverage profile does not include — the
   * intent signal. Empty when the covered set is unknown (we never guess).
   */
  outOfCoverage: CountryIntent[];
  /** False when no coverage profile was resolvable, so `outOfCoverage` is not trustworthy. */
  coverageKnown: boolean;
}

/** Read the first present value across snake_case / camelCase spellings. */
function pick(rec: AnyRecord, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = rec?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * `oper_allowed` arrives as a real boolean in the schema and as the string
 * `"true"` in TelliSIM's own sample. Treat both — and only both — as success.
 */
function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function upperIso2(v: unknown): string | null {
  const s = str(v);
  return s ? s.toUpperCase() : null;
}

/** Loose key for country-name matching: lowercased, punctuation and spacing stripped. */
function nameKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

/** Country name → ISO2, built once from the canonical map. */
const NAME_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(ISO2_TO_COUNTRY).map(([iso2, name]) => [nameKey(name), iso2])
);

/**
 * Resolve a country to ISO2, falling back to the country name when TelliSIM
 * omits the code. The schema marks `country_alpha_2` required, but dropping an
 * event over a missing code would silently lose an out-of-coverage attempt —
 * exactly the signal this module exists to catch. An unrecognised name still
 * yields null and the event is skipped rather than guessed at.
 */
export function resolveIso2(codeVal: unknown, nameVal: unknown): string | null {
  const code = upperIso2(codeVal);
  if (code) return code;
  const name = str(nameVal);
  return name ? NAME_TO_ISO2[nameKey(name)] ?? null : null;
}

function normalizeOne(rec: AnyRecord, kind: EventKind): NormalizedNetworkEvent {
  const eventTime = str(pick(rec, "event_time", "eventTime"));
  const countryName = str(pick(rec, "country_name", "countryName"));
  const countryAlpha2 = resolveIso2(
    pick(rec, "country_alpha_2", "countryAlpha2", "countryAlpha_2"),
    countryName
  );
  const operator = str(pick(rec, "operator"));
  const requestType = str(pick(rec, "request_type", "requestType"));

  let succeeded: boolean;
  if (kind === "4G_5G") {
    succeeded = truthy(pick(rec, "oper_allowed", "operAllowed"));
  } else if (kind === "2G_3G") {
    succeeded = (str(pick(rec, "result")) || "").toLowerCase() === "ok";
  } else {
    succeeded = (str(pick(rec, "result")) || "").toLowerCase() === "success";
  }

  return { kind, eventTime, countryName, countryAlpha2, operator, requestType, succeeded };
}

function arrayAt(data: AnyRecord, key: string): AnyRecord[] {
  const v = data?.[key];
  return Array.isArray(v) ? (v as AnyRecord[]) : [];
}

/**
 * Flatten a raw `network-events` response into one event list.
 * Tolerates the payload being wrapped in `data` or not.
 */
export function normalizeNetworkEvents(raw: AnyRecord | null | undefined): NormalizedNetworkEvent[] {
  if (!raw) return [];
  const data = (raw.data ?? raw) as AnyRecord;
  return [
    ...arrayAt(data, "2g_or_3g_attach").map((r) => normalizeOne(r, "2G_3G")),
    ...arrayAt(data, "4g_or_5g_attach").map((r) => normalizeOne(r, "4G_5G")),
    ...arrayAt(data, "data_usage").map((r) => normalizeOne(r, "DATA")),
  ];
}

/** Sortable epoch ms; unparseable timestamps sort last. */
function timeMs(v: string | null): number {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return isNaN(t) ? NaN : t;
}

function earliest(a: string | null, b: string | null): string | null {
  const ta = timeMs(a);
  const tb = timeMs(b);
  if (isNaN(ta)) return b;
  if (isNaN(tb)) return a;
  return ta <= tb ? a : b;
}

function latest(a: string | null, b: string | null): string | null {
  const ta = timeMs(a);
  const tb = timeMs(b);
  if (isNaN(ta)) return b;
  if (isNaN(tb)) return a;
  return ta >= tb ? a : b;
}

/**
 * Classify a window of network events and surface out-of-coverage attempts.
 *
 * @param raw          Raw response from `getNetworkEvents`.
 * @param coveredIso2  Country codes the plan's coverage profile includes. Pass
 *                     `null`/empty when unresolved — `outOfCoverage` then stays
 *                     empty and `coverageKnown` is false, so a coverage lookup
 *                     failure can never be misread as "customer went off-plan".
 */
export function analyzeNetworkEvents(
  raw: AnyRecord | null | undefined,
  coveredIso2: string[] | null | undefined
): NetworkEventsAnalysis {
  const events = normalizeNetworkEvents(raw);
  const attaches = events.filter((e) => e.kind !== "DATA");
  const dataSessions = events.filter((e) => e.kind === "DATA");

  const attachedOk = attaches.some((e) => e.succeeded);
  const dataOk = dataSessions.some((e) => e.succeeded);

  let verdict: NetworkVerdict;
  if (events.length === 0) verdict = "no_events";
  else if (attaches.length === 0) verdict = "no_attach";
  else if (!attachedOk) verdict = "attach_rejected";
  else if (dataSessions.length === 0) verdict = "attach_ok_no_data";
  else if (!dataOk) verdict = "data_failed";
  else verdict = "ok";

  const countries = Array.from(
    new Set(events.map((e) => e.countryAlpha2).filter((c): c is string => !!c))
  ).sort();

  const covered = new Set((coveredIso2 ?? []).map((c) => String(c).toUpperCase()));
  const coverageKnown = covered.size > 0;

  const byCountry = new Map<string, CountryIntent>();
  if (coverageKnown) {
    for (const e of events) {
      if (!e.countryAlpha2 || covered.has(e.countryAlpha2)) continue;
      const existing = byCountry.get(e.countryAlpha2);
      const isAttach = e.kind !== "DATA";
      if (!existing) {
        byCountry.set(e.countryAlpha2, {
          countryAlpha2: e.countryAlpha2,
          countryName: e.countryName,
          operators: e.operator ? [e.operator] : [],
          attempts: 1,
          attachAttempts: isAttach ? 1 : 0,
          attachSucceeded: isAttach && e.succeeded,
          dataSucceeded: !isAttach && e.succeeded,
          firstSeen: e.eventTime,
          lastSeen: e.eventTime,
        });
      } else {
        existing.attempts += 1;
        if (isAttach) existing.attachAttempts += 1;
        if (isAttach && e.succeeded) existing.attachSucceeded = true;
        if (!isAttach && e.succeeded) existing.dataSucceeded = true;
        if (!existing.countryName) existing.countryName = e.countryName;
        if (e.operator && !existing.operators.includes(e.operator)) {
          existing.operators.push(e.operator);
        }
        existing.firstSeen = earliest(existing.firstSeen, e.eventTime);
        existing.lastSeen = latest(existing.lastSeen, e.eventTime);
      }
    }
  }

  const outOfCoverage = Array.from(byCountry.values()).sort(
    (a, b) => b.attempts - a.attempts || a.countryAlpha2.localeCompare(b.countryAlpha2)
  );

  return {
    events,
    attaches,
    dataSessions,
    attachedOk,
    dataOk,
    verdict,
    countries,
    outOfCoverage,
    coverageKnown,
  };
}

/** Human-readable one-liner for a verdict, for the support panel. */
export function verdictLabel(v: NetworkVerdict): { label: string; detail: string } {
  switch (v) {
    case "no_events":
      return {
        label: "No activity",
        detail: "No attach or data events in this window — the eSIM never reached a network.",
      };
    case "no_attach":
      return {
        label: "No attach",
        detail: "Data events only, no attach records. Check the profile is installed and enabled.",
      };
    case "attach_rejected":
      return {
        label: "Attach rejected",
        detail: "The eSIM reached a network but every operator refused it.",
      };
    case "attach_ok_no_data":
      return {
        label: "Attached, no data session",
        detail: "Registered on the network but never opened a data session — usually APN or device config.",
      };
    case "data_failed":
      return {
        label: "Data sessions failing",
        detail: "Attach succeeded but every data session failed — vendor-side, escalate.",
      };
    case "ok":
      return { label: "Working", detail: "Attach and data both succeeded in this window." };
  }
}

/**
 * Inclusive `YYYY-MM-DD` window ending today, at most 7 days wide.
 * TelliSIM counts both endpoints, so `days = 7` spans today minus 6.
 * Clamped to 2..7: the API also rejects `start === end`.
 */
export function recentWindow(days: number = 7): { start: string; end: string } {
  const span = Math.min(Math.max(Math.floor(days), 2), 7);
  const end = new Date();
  const start = new Date(end.getTime() - (span - 1) * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
