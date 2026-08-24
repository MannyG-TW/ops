# TelliSIM Network Events → Travel Intent: Implementation Guide

**Audience:** an engineer or agent implementing out-of-coverage travel-intent capture from scratch, in this repo or another.
**Status:** implemented and verified against production on 2026-08-24. Every response shape, latency figure, and quirk below was observed on live data, not copied from vendor docs — where the vendor docs disagree with reality, that is called out explicitly.

---

## 1. What this does and why it exists

TelliSIM's `network-events` endpoint reports what a SIM did on real networks: which operators it tried to attach to, whether they accepted it, and whether data sessions succeeded.

It supports two different jobs:

| Job | Question | Who cares |
|---|---|---|
| **Support triage** | "Why isn't this customer's eSIM working?" | Support agents, live |
| **Travel intent** | "Where did customers go that we don't sell?" | Pricing, over time |

The second is the valuable one and the reason this system exists. When a customer's device attaches from a country their plan does not cover, the operator refuses it. That refusal is a record of a real person, physically in a country, wanting connectivity we did not sell them. **That is unmet demand, captured as a byproduct of ordinary support work.**

> **The 7-day problem.** TelliSIM retains network events for roughly 7 days. An attach not captured before it ages out is gone permanently — there is no historical re-fetch. This single fact drives most of the architecture below. A dropped write is not an inconvenience; it is unrecoverable data loss.

---

## 2. The upstream API

### Endpoint

```
POST https://api.tellisim.com/v3/subscriptions/{iccid}/network-events?key=<API_KEY>
Content-Type: application/json
```

Auth is a **query-string** `key` parameter, not a header. This is the same for every v3 endpoint and is a security consideration — see §9.

### Request body

```json
{ "period": { "start": "2026-08-18", "end": "2026-08-24" } }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `period.start` | `YYYY-MM-DD` | yes | Must be strictly before `end` |
| `period.end` | `YYYY-MM-DD` | yes | Max 7 days from start, **inclusive of both endpoints** |

### Hard constraints

- **7 days maximum**, counting both endpoints. `2026-08-18` → `2026-08-24` is exactly 7 days and is the largest legal window.
- **`start` must be strictly before `end`.** `start === end` is rejected, so a "one day" query is impossible — the minimum real window is 2 days.
- Violations are rejected with `400`, not silently clamped.
- **To cover more than 7 days, issue multiple calls and merge client-side.** There is no pagination or cursor.

### Working example

```bash
curl -i -X POST \
  "https://api.tellisim.com/v3/subscriptions/8948010000094659307/network-events?key=$TELLISIM_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"period":{"start":"2026-08-18","end":"2026-08-24"}}'
```

### Response

```json
{
  "error": false,
  "label": "Green",
  "data": {
    "2g_or_3g_attach": [
      { "event_time": "2026-08-23T18:13:33Z", "country_name": "Saudi Arabia",
        "country_alpha_2": "sa", "operator": "Mobily Saudi Arabia", "result": "ok" }
    ],
    "4g_or_5g_attach": [
      { "event_time": "2026-08-24T18:04:57Z", "country_name": "Guatemala",
        "country_alpha_2": "gt", "operator": "Claro Guatemala", "oper_allowed": "false" }
    ],
    "data_usage": [
      { "event_time": "2026-08-24T12:27:44Z", "request_type": "Term",
        "country_name": "Saudi Arabia", "country_alpha_2": "sa",
        "operator": "Mobily Saudi Arabia", "result": "success" }
    ]
  }
}
```

Three parallel arrays, each an event list:

| Array | Meaning | Success test |
|---|---|---|
| `2g_or_3g_attach` | 2G/3G registration attempts | `result === "ok"` |
| `4g_or_5g_attach` | 4G/5G registration attempts | `oper_allowed` is truthy |
| `data_usage` | Data sessions once attached | `result === "success"` |

Common fields on every event: `event_time` (ISO-8601 UTC), `country_name`, `country_alpha_2` (**lowercase**), `operator`. `data_usage` adds `request_type` — `Init` (session opens), `Update` (mid-session refresh), `Term` (session closes).

`label` is the plan/SIM label enum (`Green`, `Aqua`, `Blue`, `Voilet` [sic — vendor typo], `Red`, `Grey`, `Orange`). It has no documented meaning on this endpoint; ignore it.

### Error responses

| Status | Cause |
|---|---|
| `400` | Window > 7 days, or `start >= end` |
| `401` | Missing or invalid API key |
| `404` | No subscription for that ICCID |

---

## 3. ⚠️ The casing trap — read this before writing a parser

**The live payload is a hybrid that neither the published schema nor the vendor's own sample predicts.** Getting this wrong produces a system that looks like it works and silently reports every 4G attach as failed.

| | Published schema | Vendor's support sample | **Live reality (verified)** |
|---|---|---|---|
| Key style | `snake_case` | `camelCase` | **`snake_case`** ✅ |
| `oper_allowed` | boolean `true` | string `"true"` | **string `"false"` / `"true"`** ⚠️ |
| Timestamps | UTC `Z` | local offset `+02:00` | **UTC `Z`** ✅ |

So the keys follow the schema, but `oper_allowed` follows the sample. **`oper_allowed === true` is never true in production**, because the value is the *string* `"false"` or `"true"`.

Note that `"false"` is a **truthy JavaScript string**. Both of these are wrong:

```js
if (event.oper_allowed === true)   // ❌ never true — value is a string
if (event.oper_allowed)            // ❌ ALWAYS true — "false" is truthy
```

Parse defensively in both directions:

```ts
function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function pick(rec: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    const v = rec?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const eventTime = pick(rec, "event_time", "eventTime");
const iso2      = pick(rec, "country_alpha_2", "countryAlpha2");
const allowed   = truthy(pick(rec, "oper_allowed", "operAllowed"));
```

Keep the camelCase fallbacks even though live traffic is snake_case. This vendor has shipped inconsistent field names before — the same account returns `lpa` on `/v3/sims`, `esim.lpastring` on `/v3/subscriptions`, while the docs claim `lpa_string`.

**Also: `country_alpha_2` is lowercase (`"gt"`).** Uppercase it before comparing against coverage profiles, which return uppercase (`"GT"`). A case-sensitive comparison marks every country uncovered.

---

## 4. Latency — this endpoint is slow

Measured 2026-08-24, one ICCID, two runs each:

| Endpoint | Latency |
|---|---|
| `GET /v3/subscriptions/{iccid}` | 0.3–0.5s |
| `GET /v3/sims/{iccid}` | 0.3–0.5s |
| `GET /v3/sims/{iccid}/smdp-info` | 1.1–1.4s |
| `GET /v3/subscriptions/{iccid}/plan-attachments` | 1.1–2.2s |
| `GET /v3/subscriptions/{iccid}/location` | **7.6–7.7s** |
| `POST .../network-events` | **~10.5s** (busy 7-day window: 60 attach + 279 data events) |

**Budget at least 30s** for network-events and **20s** for everything else. A 10s blanket timeout — a plausible default — fails on both slow endpoints intermittently.

**Related trap:** if you wrap upstream errors to strip the key-bearing URL from messages (you should — see §9), a plain `new Error(...)` resets `err.name` from `TimeoutError` to `"Error"`. Any downstream logic branching on the name to report "timed out" then becomes unreachable, and every timeout surfaces as a generic failure with no hint that latency was the cause. Preserve the name across the wrapper:

```ts
const wrapped = new Error(`TelliSIM request failed: ${redactKey(msg)}`);
if (err instanceof Error && err.name === "TimeoutError") wrapped.name = "TimeoutError";
throw wrapped;
```

---

## 5. What this API can and cannot tell you

### CAN

- Whether the SIM reached any network at all, per country and operator, with timestamps
- Whether each operator **accepted or refused** the attach
- Whether data sessions succeeded once attached
- Which countries a SIM was physically in during the window — **including countries where it was refused**, which CDR never records because no billable session occurred
- Separate device-side failures from vendor-side ones (see the verdict ladder in §6)

### CANNOT

- **See attempts that never reached TelliSIM's core.** An attach only appears here if the visited network sent an authentication/location-update request over roaming interconnect. In a country where TelliSIM has no interconnect at all, or when the device's PLMN list stops it from even trying, **no event exists**. This is a hard physical limit, not a gap in the implementation. It surfaces as zero events, which cannot be distinguished from "the customer never switched the SIM on."
- **Go back more than ~7 days.** No historical archive, no pagination.
- **Tell you why an operator refused.** You get a boolean-ish flag, not a cause code.
- **Report signal strength, throughput, or data volume.** Use CDR for consumption.
- **Cover a 30-day plan in one call.** Chunk it.

### Not a substitute for CDR

CDR (`tellisim-cdr-read`) records **billable sessions**. Network events record **attempts**. A refused attach appears in network events and never in CDR — which is exactly why network events can see demand that CDR structurally cannot.

---

## 6. Deriving intent: the algorithm

### Step 1 — resolve what the plan actually covers

```
GET /v3/subscriptions/{iccid}/plan-attachments
  → data[] → sort by created_at desc → [0].plan.coverage_id
GET /v3/coverage-profiles/{coverage_id}
  → countries[] → { iso2, name }
```

Build an uppercase `Set<string>` of covered ISO2 codes.

### Step 2 — classify connectivity (support view)

Attach and data are **sequential stages**: a SIM must attach before it can pass data.

| Verdict | Condition | Meaning |
|---|---|---|
| `no_events` | no events at all | Never reached a network — or was somewhere invisible to us |
| `no_attach` | data events but no attach records | Check the profile is installed and enabled |
| `attach_rejected` | attach events exist, none succeeded | Every operator refused |
| `attach_ok_no_data` | attach succeeded, zero data events | Usually APN or device config |
| `data_failed` | attach succeeded, all data sessions failed | Vendor-side — escalate |
| `ok` | attach and data both succeeded | Working |

### Step 3 — extract intent (pricing view)

For every event, uppercase `country_alpha_2` and test membership in the covered set. **Anything not in it is intent.** Group by country.

Three rules that are easy to get wrong:

1. **Do not filter on success.** A *successful* attach in an uncovered country is also intent — it means coverage-profile drift, which is worth knowing. Capture regardless of outcome.
2. **Include `data_usage` events, not just attaches.** A data event in an uncovered country counts.
3. **If the covered set cannot be resolved, produce ZERO findings** and flag coverage as unknown. Never treat an empty covered set as "nothing is covered" — a failed coverage lookup would then fabricate demand for every country the customer legitimately visited.

### Step 4 — country-name fallback, applied asymmetrically

If `country_alpha_2` is missing, fall back to resolving ISO2 from `country_name`. Apply this on **both** sides of the comparison, but understand they fail in opposite directions:

- **Event side:** a missing code silently *drops a real finding*.
- **Covered side:** a missing code *fabricates* one, by making a covered country look uncovered.

Bias toward a larger covered set — a missed finding costs less than an invented one. An unrecognised name must resolve to null and be skipped, never guessed.

---

## 7. Storage architecture

### The problem

TelliSIM's 7-day retention makes a dropped write unrecoverable. A naive "write straight to the analytics store" design loses events whenever that store is briefly unreachable.

### The design: local buffer + durable store

```
capture → SQLite (always, first)  → OpenSearch (durable, retried)
          local, synchronous,        shared across operators,
          cannot fail on network     sits beside CDR indices
```

1. **Write SQLite first, unconditionally.** It is local and synchronous, so it cannot fail for network reasons. The event is safe the moment it lands.
2. **Then sync to OpenSearch**, stamping `os_indexed_at` on rows that land.
3. **Rows with `os_indexed_at IS NULL` are pending** and retried by every subsequent call. An outage delays the sync instead of losing the event.
4. **Sync must never throw.** The caller is a live support lookup; a sync problem must not take down the answer an operator is waiting on. Return the error, leave rows pending.

Do not reverse this order, and do not treat the OpenSearch write as authoritative-on-first-try.

### Why not SQLite alone

A local SQLite file is per-instance. Intent captured on one deployment is invisible to every other, and the dataset fragments. OpenSearch is the store of record; SQLite is only the buffer.

### Idempotency in both stores

The natural key is `(iccid, country_alpha_2, event_time, kind)`.

- **SQLite:** unique index + `onConflictDoNothing()`
- **OpenSearch:** deterministic `_id` = `` `${iccid}:${country}:${event_time}:${kind}` `` and bulk action `index` (not `create`), so a repeat write overwrites in place

This matters because the same 7-day window is re-pulled every time an operator opens that ICCID. **Store at event grain, never as an `attempts` counter** — a counter inflates on every repeat lookup. Country-level demand is a `GROUP BY`, computed at read time.

### OpenSearch mapping — must be explicit

```json
{
  "settings": { "number_of_shards": 1, "number_of_replicas": 1 },
  "mappings": { "properties": {
    "iccid":             { "type": "keyword" },
    "country_alpha_2":   { "type": "keyword" },
    "country_name":      { "type": "keyword" },
    "operator":          { "type": "keyword" },
    "kind":              { "type": "keyword" },
    "request_type":      { "type": "keyword" },
    "event_time":        { "type": "date" },
    "succeeded":         { "type": "boolean" },
    "coverage_id":       { "type": "keyword" },
    "plan_name":         { "type": "keyword" },
    "region_code":       { "type": "keyword" },
    "covered_countries": { "type": "keyword" },
    "covered_count":     { "type": "integer" },
    "order_number":      { "type": "keyword" },
    "customer_email":    { "type": "keyword" },
    "detected_at":       { "type": "date" }
  } }
}
```

**Do not rely on dynamic mapping.** It types `country_alpha_2` as `text`, which breaks the terms aggregation the demand leaderboard depends on — and it breaks silently, returning empty buckets rather than an error. Create the index with `PUT /{index}`; a `400 resource_already_exists_exception` means it is already there and should be treated as success.

Bulk responses report **per-item** errors without failing the request. Map returned `_id`s back to your row IDs and stamp only what actually landed, so a partial failure leaves the rest pending.

---

## 8. Reference implementation in this repo

| Concern | File |
|---|---|
| API call | `getNetworkEvents()` in `src/lib/tellisim-client.ts` |
| Normalizer, verdicts, intent diff | `src/lib/network-events.ts` |
| OpenSearch mapping + sync | `src/lib/network-intent-store.ts` |
| Bulk/index transport | `ensureIndexOS`, `bulkIndexOS` in `src/lib/opensearch-client.ts` |
| Capture route | `POST /api/tellisim/network-events/[iccid]` |
| Read + backfill | `GET`/`POST /api/tellisim/network-events` |
| Table | `networkIntentEvents` in `src/lib/db/schema.ts` |
| UI | "Network Activity" panel, `src/components/lookup/iccid-lookup.tsx` |

### Key exports

```ts
// src/lib/network-events.ts
normalizeNetworkEvents(raw): NormalizedNetworkEvent[]
analyzeNetworkEvents(raw, coveredIso2): NetworkEventsAnalysis
resolveIso2(codeVal, nameVal): string | null
recentWindow(days = 7): { start, end }   // clamped 2..7
verdictLabel(v): { label, detail }

// src/lib/network-intent-store.ts
NETWORK_INTENT_INDEX = "tellisim-network-intent"
intentDocId(row): string
syncIntentToOpenSearch(creds, limit = 500): Promise<SyncResult>  // never throws
pendingIntentCount(): number
```

### Capture route response

```jsonc
{
  "ok": true,
  "period": { "start": "2026-08-18", "end": "2026-08-24" },
  "verdict": "ok",                    // see §6 ladder
  "attachedOk": true,
  "dataOk": true,
  "countries": ["BE", "GT", "SA", "..."],   // every country seen
  "coverageKnown": true,              // false ⇒ outOfCoverage is NOT trustworthy
  "coverageError": null,
  "coveredCountries": ["AD", "AE", "..."],
  "outOfCoverage": [ {
      "countryAlpha2": "GT", "countryName": "Guatemala",
      "operators": ["Claro Guatemala"],
      "attempts": 1, "attachAttempts": 1,
      "attachSucceeded": false, "dataSucceeded": false,
      "firstSeen": "2026-08-24T18:04:57Z", "lastSeen": "2026-08-24T18:04:57Z"
  } ],
  "attaches": [ /* normalized */ ], "dataSessions": [ /* normalized */ ],
  "plan": { "coverageId": "b9533fc1-…", "name": "SIM_Bank_Plan_ONLY", "regionCode": "KWXDZ4" },
  "saved": 1,                         // new SQLite rows (0 on a repeat lookup)
  "saveError": null,
  "osSync": { "attempted": 1, "indexed": 1, "failed": 0, "error": null }
}
```

`GET /api/tellisim/network-events` returns a country leaderboard from OpenSearch, ranked by **distinct SIMs** rather than event count — one device retrying emits many events for a single traveller. It falls back to SQLite when OpenSearch is unreachable and marks the response `"source": "sqlite", "partial": true`, so a one-instance view is never mistaken for the whole dataset. `POST` with no body drains pending rows after an outage.

### SQLite table

`network_intent_events` — one row per uncovered event. Columns mirror the OpenSearch doc, plus `id` (UUID PK) and `os_indexed_at`.

> **Drizzle gotcha:** `integer(..., { mode: "timestamp" })` stores **epoch seconds**, not milliseconds. Query with `datetime(col, 'unixepoch')`. Using `/1000` yields 1970 dates.

---

## 9. Security requirements

1. **The API key is in the URL.** Any error message that echoes the URL leaks it. Redact with `s.replace(/key=[^&\s"']+/gi, "key=***")` on every thrown message, including JSON-parse failures, which can echo the request context.
2. **Validate the base URL before use.** An invalid URL makes `fetch` throw a `TypeError` whose message embeds the full key-bearing URL.
3. **Never accept a caller-supplied covered-country list.** Resolve coverage server-side from the plan attachment. A client-supplied list lets any caller mark arbitrary countries uncovered and poison the demand dataset.
4. **Never accept caller-supplied credentials or base URL** on data routes — that is an SSRF vector. Read them from server-side config only.

---

## 10. Implementation checklist

1. [ ] Client method with a **30s** timeout, `TimeoutError` name preserved through any error wrapper
2. [ ] Normalizer accepting **both** casings; `oper_allowed` via `truthy()`, never `=== true` and never bare truthiness
3. [ ] Uppercase `country_alpha_2` before comparison
4. [ ] Coverage resolved **server-side**: plan-attachments → `coverage_id` → coverage-profile
5. [ ] `coverageKnown === false` ⇒ zero findings, never "everything is uncovered"
6. [ ] Capture regardless of attach success; include `data_usage` events
7. [ ] ISO2 name fallback on both sides, biased toward a larger covered set
8. [ ] SQLite write first, unconditionally; unique index on the natural key
9. [ ] OpenSearch index created explicitly with the mapping above
10. [ ] Deterministic `_id`; bulk `index` not `create`
11. [ ] `os_indexed_at` pending flag + retry; sync never throws
12. [ ] Per-item bulk errors mapped back to rows; only successes stamped
13. [ ] Reads prefer OpenSearch, label the source, mark SQLite fallback `partial`

---

## 11. Verification recipe

**Find test ICCIDs** — multi-country SIMs active in the last 7 days. Note the CDR index uses bare `ICCID` / `iso2` fields with **no `.keyword` suffix**:

```bash
curl -s -u "$OS_USER:$OS_PASS" "$OS_URL/tellisim-cdr-read/_search" \
  -H 'Content-Type: application/json' -d '{
  "size": 0,
  "query": { "range": { "USAGE_DATE_UTC": { "gte": "2026-08-18T00:00:00" } } },
  "aggs": { "by_iccid": {
    "terms": { "field": "ICCID", "size": 12, "order": { "countries": "desc" } },
    "aggs": { "countries": { "cardinality": { "field": "iso2" } } } } } }'
```

`USAGE_DATE_UTC` requires a full timestamp — a bare `YYYY-MM-DD` is rejected by the index's date format.

**Then verify, in this order:**

| # | Check | Expected |
|---|---|---|
| 1 | Parse both casings, and `oper_allowed` as boolean and string | Identical results |
| 2 | Uncovered + refused / allowed / 2G-3G / data-only / missing-alpha2 | All captured |
| 3 | Covered country arriving by name only | **Not** flagged |
| 4 | `coveredIso2 = []` | Zero findings, `coverageKnown: false` |
| 5 | Same window pulled twice | `saved: 0`, OS doc count unchanged |
| 6 | OpenSearch unconfigured, then unreachable | Rows stay pending, `os_indexed_at` null |
| 7 | Backfill `POST` | `pending` drops to 0 |
| 8 | `GET /_mapping` | `keyword`/`date`/`boolean`, no `text` |

**Independent confirmation of a finding** (do not trust your own parser):

```bash
# Raw grep the untouched coverage profile
curl -s ".../v3/coverage-profiles/$COVERAGE_ID?key=$KEY" | grep -i "guatemala"

# Cross-check CDR: a truly uncovered country should have zero sessions
curl -s -u "$OS_USER:$OS_PASS" "$OS_URL/tellisim-cdr-read/_search" \
  -H 'Content-Type: application/json' \
  -d '{"size":0,"query":{"bool":{"must":[
       {"term":{"ICCID":"…"}},{"term":{"iso2":"GT"}}]}}}'
```

---

## 12. Worked example

**ICCID** `8948010000094646551`, plan `SIM_Bank_Plan_ONLY` / `Global_Plan_1` [KWXDZ4], **162 countries covered**, active in **16** countries over 7 days (60 attach + 279 data events).

Result: exactly **one** out-of-coverage finding.

```
GT  Guatemala  1 event  attachOk=false  Claro Guatemala
raw: {"event_time":"2026-08-24T18:04:57Z","country_name":"Guatemala",
      "country_alpha_2":"gt","operator":"Claro Guatemala","oper_allowed":"false"}
```

Confirmed four independent ways:

1. Raw `grep -i guatemala` on the untouched coverage-profile JSON → nothing
2. Every neighbour covered — MX, BZ, SV, HN, NI, CR, PA, CO, JM — **GT alone missing**
3. `oper_allowed: "false"` — Claro Guatemala refused the attach
4. CDR: **0 sessions** ever recorded in GT for this ICCID

Account-wide: of **199 coverage profiles, only 2 include Guatemala** (`latin-america-plus`, and a single-country `Guatemala` profile). All three global tiers exclude it — global-plus (143), global-standard (85), global-lite (35). Any global-plan customer landing in Guatemala is refused.

**This is the output the system exists to produce:** a specific, verifiable, commercially actionable coverage gap, surfaced from a routine support lookup.

> Caveat worth carrying into any analysis: this particular SIM is `SIM_Bank_Plan_ONLY`, likely an internal test SIM. It proves the mechanism; it is not a demand data point. Filter internal plans before drawing pricing conclusions.

---

## 13. Related documents

- `docs/TelliSIM_API_v3_Complete_Documentation.md` — full v3 reference, incl. the `network-events` endpoint contract
- `docs/tellisim_api_v3.md` — condensed endpoint list
- `docs/01-opensearch.md` — CDR index field reference
