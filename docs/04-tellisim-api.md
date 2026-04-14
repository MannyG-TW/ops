# TelliSIM v3 API — Support Reference

Smart-pricing only wraps **one** TelliSIM endpoint today (`GET /v3/subscriptions/{iccid}/plan-attachments`). Everything in this document is grounded in the code at `api/services/tellisim_client.py` and its single production caller `api/services/lifecycle_enrichment_service.py`. If a field or endpoint is not listed here, **it is not implemented in our codebase** — do not assume it exists.

> **Known documentation gap:** we do not have the official TelliSIM v3 API reference checked into this repo. The contract below is reverse-engineered from our client and the fields we read. Support should confirm edge cases (status enum values, activation timing, topup package shape) with TelliSIM directly before relying on them for customer-facing SLAs.

---

## 1. At a glance — which tool for which question

| Support question | Primary source | Why |
|---|---|---|
| "Is my SIM active right now?" | **TelliSIM lifecycle** (`get_plan_attachments`) | Live `esim_state` field |
| "When does my plan expire?" | **TelliSIM lifecycle** | `expiration_at` (exposed as `expires_at`) |
| "How much data do I have left?" | **TelliSIM lifecycle** | `plan_data_mb - used_allowance.dataBytes` |
| "How much have I used this month / overall?" | **OpenSearch `tellisim-cdr-read`** | CDR has per-session history; TelliSIM only shows the current attachment's counter |
| "Where did I use data on day X?" | **OpenSearch CDR** | Only CDR has per-session country + timestamp |
| "Am I being throttled / hit FUP?" | **TelliSIM lifecycle** for state + **CDR** daily histogram to pinpoint the burn day | Lifecycle tells you *what* state; CDR tells you *when* it changed |
| "I topped up and it's not working" | **TelliSIM lifecycle** (does a newer plan attachment exist?) + OS `orders` (did the topup order actually write?) | Lifecycle picks the most recent attachment — see §4 |
| "Did my SIM ever activate?" | **TelliSIM lifecycle** `activation_at` + CDR (any sessions at all?) | An `ACTIVE` state with no CDR sessions = dead / never-used SIM |
| "Is my SIM lost/suspended?" | **TelliSIM lifecycle** `esim_state` | See state enum in §5 |
| "Revenue / cost / GP / how much did this SIM earn us?" | **OS `orders`** and **OS CDR** — NEVER TelliSIM | Per `CLAUDE.md`: *"tellisim_client.py — TelliSIM v3 API async client (lifecycle enrichment, NOT for cost/GP)."* |

**Rule of thumb:** TelliSIM answers *"what is this SIM doing right now"*; OpenSearch CDR answers *"what has this SIM ever done"*; OS `orders` answers *"what did the customer pay for"*.

---

## 2. Identity & configuration

- **Client class:** `TelliSimClient` — `api/services/tellisim_client.py:17`
- **Base URL:** `https://api.tellisim.com` — `api/services/tellisim_client.py:27` (fallback) and `config.yaml:52`
- **API version:** `v3` — hardcoded in the URL template at `api/services/tellisim_client.py:36`
- **Authentication:** query-string API key (`?key=...`) — `api/services/tellisim_client.py:39`
- **API key source:** `config.yaml → tellisim.api_key` — loaded via `config_loader.load_config()` at `api/services/tellisim_client.py:25-28`. Value is read as `cfg.get("tellisim", {}).get("api_key", "")`. There is **no env-var fallback in code** — if `config.yaml` is missing the key, the client silently degrades (see §7).
- **Org ID:** `config.yaml:54` contains `tellisim.org_id`, but the client does **not** send this header — it is unused by our code today.
- **Staging vs production:** no staging base URL is configured in the repo. Only one `base_url` exists in `config.yaml`.

> **Never paste the real API key into support docs, tickets, or screenshots.** Refer to it as `${TELLISIM_API_KEY}` or `config.yaml → tellisim.api_key`.

---

## 3. The one endpoint we call

### `GET /v3/subscriptions/{iccid}/plan-attachments`

- **Purpose:** list every plan (initial + any topups) attached to a single ICCID, including the current usage counter on each plan.
- **Call site:** `api/services/tellisim_client.py:36-39`
- **Auth:** `?key=${TELLISIM_API_KEY}` query parameter
- **Timeout:** `5.0s` per request — `api/services/tellisim_client.py:38`
- **Expected success:** HTTP 200 with JSON body shaped `{"data": [PlanAttachment, ...], "error": null}`
- **Our handling:**
  1. Any non-200 → return `None` (graceful) — `tellisim_client.py:40-41`
  2. `body["error"]` truthy or `body["data"]` empty → return `None` — `tellisim_client.py:43-44`
  3. Otherwise pick the **most recent** attachment by `created_at` — `tellisim_client.py:47-50`
  4. Flatten via `_normalize()` — `tellisim_client.py:86-107`
  5. Any exception (network, JSON parse, key error) → log at DEBUG and return `None` — `tellisim_client.py:53-55`

### Raw plan attachment shape (what TelliSIM returns)

Fields we actually read:

| Path | Read at | Type | Meaning |
|---|---|---|---|
| `data[].created_at` | `tellisim_client.py:50` | ISO-8601 string | Sorting key to pick "most recent" attachment |
| `data[].state` | `tellisim_client.py:100` | string enum (see §5) | Current lifecycle state of this plan attachment |
| `data[].activation_at` | `tellisim_client.py:101` | ISO-8601 string, nullable | When the eSIM was first activated on this plan |
| `data[].expiration_at` | `tellisim_client.py:102` | ISO-8601 string, nullable | When this plan attachment expires |
| `data[].plan.name` | `tellisim_client.py:105` | string | TelliSIM's plan name — does NOT match our internal SKUs (see §8) |
| `data[].plan.data_mega_bytes` | `tellisim_client.py:93-96` | string → int, nullable | Plan capacity in MB. Comes as a **string** from TelliSIM and we coerce to int defensively |
| `data[].plan.region_code` | `tellisim_client.py:106` | string | TelliSIM's region identifier (not our ISO2) |
| `data[].used_allowance.dataBytes` | `tellisim_client.py:103` | int | Total bytes consumed against this attachment |

**Fields we do NOT read** (may exist in the response but are not accessed by our code — do not rely on them without confirming with TelliSIM): `plan.price`, `plan.currency`, `subscription_id`, `order_id`, any cost fields.

### Normalized shape (what the rest of smart-pricing sees)

Returned by `TelliSimClient._normalize()` at `api/services/tellisim_client.py:99-107`:

```python
{
  "esim_state":   "ACTIVE",              # raw state string from TelliSIM
  "activated_at": "2026-03-01T12:00:00Z",
  "expires_at":   "2026-03-31T12:00:00Z",
  "used_bytes":   1_234_567_890,          # int, bytes
  "plan_data_mb": 10240,                   # int, megabytes
  "plan_name":    "Europe 10GB 30D",
  "region_code":  "EU",
}
```

---

## 4. Batch enrichment

`TelliSimClient.enrich_iccids(iccids, concurrency=10)` — `api/services/tellisim_client.py:57-84`

- **Concurrency:** bounded by `asyncio.Semaphore(10)` — `tellisim_client.py:69`
- **Empty / no-auth short-circuit:** if `iccids` is empty OR `api_key` is blank, returns `{}` immediately — `tellisim_client.py:65-66`
- **Failure mode:** individual ICCID failures are silently dropped (the dict simply won't contain that key). A top-level gather exception logs a WARNING — `tellisim_client.py:78-81`
- **Success log:** `"TelliSIM enrichment: N/M ICCIDs enriched"` — `tellisim_client.py:83`. Support can grep logs for this string to see hit rate.

### Caching wrapper: `LifecycleEnrichmentService`

`api/services/lifecycle_enrichment_service.py:21` is the production caller. Key behaviors support should know:

- **TTL cache:** 1 hour per ICCID — `lifecycle_enrichment_service.py:24` (`_CACHE_TTL = 3600`). If a customer reports "my status is wrong," a cache flush / 60-minute wait may be needed.
- **On TelliSIM error** (entire batch): every uncached ICCID gets `{"state": "unknown", "error": str(e)}` — `lifecycle_enrichment_service.py:60-63`.
- **Derived fields added** on top of the normalized client payload — `lifecycle_enrichment_service.py:81-89`:
  - `used_gb`, `plan_gb`, `remaining_gb`, `utilization_pct`
- **Derived lifecycle state** (the `state` field in support dashboards — NOT the raw `esim_state`) — `lifecycle_enrichment_service.py:67-120`:

| Derived `state` | Condition | Support meaning |
|---|---|---|
| `pending` | `esim_state` ∈ {`PENDING_FOR_FIRST_USE`, `ASSIGNED`, `PENDING`} | SIM shipped / provisioned but never activated |
| `active_untouched` | `esim_state` ∈ {`ACTIVE`, `ENABLED`} AND `used_bytes == 0` | Activated but has not consumed any data |
| `active_in_use` | active + some usage + remaining_gb ≥ 0.01 | Normal healthy state |
| `active_depleted` | active + `remaining_gb < 0.01` | Customer ran out of data — TopUp opportunity |
| `expired_unused` | expired AND `remaining_gb > 0.5` | Plan window ended before customer could use it — refund/goodwill candidate |
| `expired_partial` | expired AND `0.01 < remaining_gb ≤ 0.5` | Partially used, expired normally |
| `depleted` | expired AND `remaining_gb < 0.01` | Customer used the full plan, it then expired |
| `unknown` | TelliSIM returned nothing, or no `esim_state` | Lookup failed — fall back to CDR to see if the SIM is actually real |

- Expiration is computed on our side by comparing `expires_at` to `datetime.now(timezone.utc)` — `lifecycle_enrichment_service.py:94-99`. TelliSIM may still report `state=ACTIVE` after the expiration timestamp; our classifier overrides that.

---

## 5. State enum reference

These are the raw `esim_state` values the code branches on — `api/services/lifecycle_enrichment_service.py:101,103,110`:

| Raw `esim_state` | Meaning (per our classifier) |
|---|---|
| `PENDING_FOR_FIRST_USE` | Provisioned, awaiting activation |
| `ASSIGNED` | Provisioned, awaiting activation |
| `PENDING` | Provisioned, awaiting activation |
| `ACTIVE` | Live and consuming data |
| `ENABLED` | Live and consuming data |
| `EXPIRED` | Plan window has ended |
| `DISABLED` | Plan terminated (revoked, suspended, etc.) |

Anything else maps to `unknown`. If TelliSIM introduces a new state (`SUSPENDED`, `FRAUD_LOCK`, etc.) we will silently classify it as `unknown` until the classifier is updated — support should escalate unexpected `unknown` rates to engineering.

---

## 6. Support decision tree — "my SIM isn't working"

```
Support asks the rep the ICCID, then:

1. OS orders lookup (by ICCID)
   - No order?           → Not one of our SIMs. Hand off.
   - Order found         → capture order_id, product SKU, country, purchase date

2. TelliSIM lifecycle (TelliSimClient.get_plan_attachments)
   - None / unknown      → Either TelliSIM is down OR ICCID is not provisioned with us.
                            Check tellisim logs for "TelliSIM lookup failed for {iccid}".
   - esim_state=ACTIVE   → SIM is live per TelliSIM → go to step 3
   - esim_state=PENDING* → customer never activated → walk them through activation
   - esim_state=EXPIRED  → plan window ended → upsell new plan / topup
   - esim_state=DISABLED → terminated at vendor level → escalate to carrier ops

3. OS CDR (tellisim-cdr-read) via CDRQueryService.daily_breakdown_for_iccids
   - Zero sessions ever             → SIM never attached to a network.
                                        Root cause is device/APN side, not our plan.
   - Sessions stopped N days ago    → Device moved out of coverage OR hit FUP.
                                        Check remaining_gb from TelliSIM:
                                          - remaining_gb < 0.01 → hit cap, needs topup
                                          - remaining_gb > 0    → coverage / device issue
   - Sessions ongoing               → TelliSIM and CDR agree → customer-perception issue
                                        (speed expectations, wrong country, etc.)

4. Cross-check for discrepancies
   - TelliSIM says ACTIVE but CDR has no sessions for 14+ days
     → "zombie SIM" — likely network registration failure; escalate.
   - TelliSIM says EXPIRED but a topup order exists in OS orders
     → topup never attached on the vendor side; open a TelliSIM ticket.
```

---

## 7. Error handling & rate limits

- **Timeout:** `5.0s` hard — `tellisim_client.py:38`. No retry.
- **Retry logic:** **none.** A failed request returns `None` and moves on.
- **Rate limit:** not documented in code. Our batch concurrency cap is `10` in-flight per batch (`tellisim_client.py:69`) and `LifecycleEnrichmentService` adds a 1-hour TTL cache in front of it — effective QPS is very low.
- **Auth missing:** `enrich_iccids` short-circuits to `{}` when `api_key == ""` — `tellisim_client.py:65`. A blank result with zero API calls is the tell-tale sign of a missing key.
- **Partial batch failure:** `asyncio.gather` exception → WARNING log `"TelliSIM batch enrichment partial failure: %s"` — `tellisim_client.py:81`. Some ICCIDs will succeed; missing ones are absent from the result dict.
- **Lifecycle wrapper failure:** `LifecycleEnrichmentService.enrich_iccids` catches any exception from the client and marks **every uncached ICCID** as `{"state": "unknown", "error": ...}` and logs at ERROR level — `lifecycle_enrichment_service.py:60-63`.

---

## 8. Cross-reference: CDR in OpenSearch

See `docs/support-portal/01-opensearch.md` §4 for the full field reference on `tellisim-cdr-read`. Key points for this document:

- **CDR, not TelliSIM, is the source of truth for consumption totals, country attribution, and session history.**
- **CDR, not TelliSIM, is used in invoice validation** — see `api/services/cdr_query_service.py` and the CLAUDE.md entry: *"cdr_query_service.py — CDR data queries (tellisim-cdr-read, strict date boundaries)"*.
- The helper `CDRQueryService.daily_breakdown_for_iccids` (`api/services/cdr_query_service.py:365`) returns a per-ICCID, per-day usage histogram — use it for the "when did the burn happen" question.

Inline pattern for the support portal:

```python
from api.services.cdr_query_service import CDRQueryService

cdr = CDRQueryService()
daily = cdr.daily_breakdown_for_iccids(
    iccids=["8944..."],
    start_date="2026-03-01",
    end_date="2026-03-31",
)
# → {"8944...": [{"date": "2026-03-01", "bytes": 12345, "country": "FR"}, ...]}
```

Pair this with a TelliSIM lifecycle lookup to answer "SIM isn't working" end-to-end.

---

## 9. Gotchas

1. **`plan_data_mb` arrives as a string.** TelliSIM sends `data_mega_bytes` as a JSON string; `_normalize()` coerces it to `int` and falls back to `None` on parse failure (`tellisim_client.py:92-96`). Code that consumes `plan_gb` / `plan_data_mb` must tolerate `None`.
2. **We only keep the most recent plan attachment.** If a customer has an original plan + a topup, we silently drop every attachment except the newest by `created_at` (`tellisim_client.py:50`). For "I topped up but nothing happened" tickets, the portal needs to either (a) call TelliSIM directly to see the full list or (b) add a new method that returns all attachments.
3. **`plan.name` does not match our internal SKUs.** There is no mapping table in the repo. Do not try to join TelliSIM `plan_name` to `product_skus.yaml` — use the OS order's SKU instead.
4. **`region_code` is TelliSIM's, not ours.** It is not ISO2 and does not match `plan_settings.yaml` region definitions.
5. **`activation_at` and `expiration_at` can be null** for `PENDING*` states. Our classifier handles this (treats null expiry as not-expired), but UI code must not blindly format these.
6. **Cache is in-process, 1 hour.** Each API worker has its own cache. A customer who was helped 30 minutes ago from one worker may still see stale data from another worker. Stale-state complaints within a 1-hour window are expected.
7. **`esim_state=ACTIVE` does not guarantee the SIM has ever transmitted a byte.** Always cross-check CDR before telling a customer "your SIM is working fine" — see §6 step 3.
8. **No retry, short timeout.** A TelliSIM 5xx or a >5s latency spike manifests as `state: unknown`, not as an error the customer sees. Watch the `"TelliSIM enrichment: N/M ICCIDs enriched"` ratio in logs — a drop is the canary.
9. **We do not send `org_id`.** It is present in `config.yaml` but unused. If TelliSIM later scopes keys per org, we may need to add a header — flagged as a forward risk.
10. **Cost, revenue, GP — never from TelliSIM.** This is explicitly called out at the top of `tellisim_client.py:1` and in CLAUDE.md. Any support workflow that tries to compute "how much did this customer pay" from TelliSIM fields is wrong by construction.

---

## 10. References

- `api/services/tellisim_client.py:1` — module header ("informational only, NOT for cost")
- `api/services/tellisim_client.py:17-28` — class + config loading
- `api/services/tellisim_client.py:30-55` — `get_plan_attachments` (the only endpoint)
- `api/services/tellisim_client.py:57-84` — `enrich_iccids` batch + concurrency
- `api/services/tellisim_client.py:86-107` — `_normalize` field mapping
- `api/services/lifecycle_enrichment_service.py:21-65` — caching wrapper + batch error handling
- `api/services/lifecycle_enrichment_service.py:67-120` — derived lifecycle state classifier
- `api/services/lifecycle_enrichment_service.py:122-161` — aggregate stats (topup opportunity counter, per-tier utilization)
- `api/services/cdr_query_service.py:365` — `daily_breakdown_for_iccids` (CDR, not TelliSIM)
- `config.yaml:50-54` — `tellisim.base_url`, `tellisim.api_key`, `tellisim.org_id`
- `CLAUDE.md` — "tellisim_client.py — TelliSIM v3 API async client (lifecycle enrichment, NOT for cost/GP)"
- `docs/support-portal/01-opensearch.md` §4 — CDR field reference (companion doc)
- `tests/api/test_tellisim_client.py` — unit tests exercising the normalizer + error paths
