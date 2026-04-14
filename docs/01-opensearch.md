# OpenSearch Reference — Support Portal
**Target path:** `docs/support-portal/01-opensearch.md`
**Audience:** Junior support reps and ops staff using the support portal. No coding experience required.
**Last verified:** 2026-04-08 against codebase commit `00d56ed`

---

## Table of Contents

1. [Connection Details](#1-connection-details)
2. [Index Inventory](#2-index-inventory)
3. [Orders Index — Complete Field Reference](#3-orders-index--complete-field-reference)
4. [tellisim-cdr-read — Field Reference](#4-tellisim-cdr-read--field-reference)
5. [esim-archive-cdr_* — Legacy CDR](#5-esim-archive-cdr_--legacy-cdr)
6. [Query Recipes for the Support Portal](#6-query-recipes-for-the-support-portal)
7. [Gotchas](#7-gotchas)
8. [Fraud and Risk Signal Fields](#8-fraud-and-risk-signal-fields)

---

## 1. Connection Details

### Where credentials live

Credentials are stored in `config.yaml` at the repo root (never committed — see `config.yaml.example` for the key names). The support portal backend reads this file automatically. You do **not** need to touch it unless you are setting up a new environment.

```yaml
# config.yaml.example — structure only, no real values
opensearch:
  host: "your-opensearch-host.us-east-1.es.amazonaws.com"
  port: 443
  username: "your-username"
  password: "your-password"
```

### Python client constructor (canonical pattern)

Every service in the codebase uses this exact constructor. Copy it when writing one-off scripts or debugging outside the portal. Replace the placeholder strings with values from `config.yaml`.

```python
from opensearchpy import OpenSearch

client = OpenSearch(
    hosts=[{
        "host": "<opensearch.host from config.yaml>",
        "port": 443,                   # opensearch.port, always 443 in production
    }],
    http_auth=(
        "<opensearch.username>",       # opensearch.username
        "<opensearch.password>",       # opensearch.password — never hardcode
    ),
    use_ssl=True,
    verify_certs=True,
    ssl_show_warn=False,
    timeout=120,                       # 30 for interactive queries; 120 for aggregations
)
```

Source: `api/services/cdr_query_service.py` lines 59–72 and `api/routes/admin.py` lines 657–661.

### VPN requirement

The cluster is hosted on AWS. You **must be on VPN** to reach it. If you get a `Connection refused` or timeout error, check VPN first before escalating to engineering.

### Quick connectivity test

```python
health = client.cluster.health(request_timeout=5)
print(health["status"])   # "green", "yellow", or "red"
```

---

## 2. Index Inventory

| Alias / Index pattern | Purpose | Retention | Approx doc count |
|---|---|---|---|
| `orders` | All customer orders (eSIM, rental, Sapphire Data) | Indefinite | See note below |
| `tellisim-cdr-read` | **Alias** spanning per-year CDR indices from TelliSIM network | 24+ months rolling | See note below |
| `esim-archive-cdr_*` | **Wildcard** for older CDR data (MANX/VFNL/logstash pipeline) | Historical | See note below |

> **Note on doc counts:** Doc counts change daily. To get a live count run:
> ```python
> client.count(index="orders")["count"]
> client.count(index="tellisim-cdr-read")["count"]
> ```
> The validator service itself calls this during prerequisites checks (`api/services/opensearch_validator.py` line 327).

---

### 2.1 `orders` index

**Purpose:** One document per customer order. Every eSIM activation, rental, Sapphire Data (device owner) plan, topup, and bundle order lands here. This is the primary source of truth for revenue, customer identity, and SIM allocation.

**Key facts:**
- Searched by `serials.keyword` to find orders by ICCID (see [Gotchas §7.1](#71-serials-vs-serialskeyword)).
- `created_at` is a Unix epoch integer in **seconds** (not milliseconds — see [Gotchas §7.2](#72-created_at-epoch-units)).
- Does not contain phone numbers (see [Query Recipes §6.5](#65-phone-number-lookup)).
- Multi-ICCID orders (bundles) have multiple entries in `serials[]`.
- Hardware bundle orders (Sapphire device + eSIM) have both hardware and eSIM lines in `order_details_data[]`.

---

### 2.2 `tellisim-cdr-read` alias

**Purpose:** Per-session data usage records from the TelliSIM network. Each document is one network session for one ICCID. This is the source of truth for how much data a SIM actually consumed.

**What "alias spanning yearly indices" means:** The alias `tellisim-cdr-read` points to multiple physical indices named by year (e.g. `tellisim-cdr-2024`, `tellisim-cdr-2025`). You always query the alias — OpenSearch routes to the right shards automatically. You should never need to query a year-specific index directly.

**Key facts:**
- `TOTAL_QTY` is in **bytes**. Divide by `1024³` (= 1,073,741,824) to convert to GB.
- `ICCID` is a **text** field (not keyword). Use `{"term": {"ICCID": "..."}}` for exact match; use `ICCID.keyword` only when the consumption analytics service needs terms aggregation (see `consumption_analytics_service.py` line 261).
- `iso2` is a **keyword** field — safe for terms aggregations.
- `USAGE_DATE_UTC` is an ISO datetime string (`"2025-03-15T14:22:00"`).
- Sessions do **not** have a direct foreign key to an order. They are linked by matching the ICCID in a session to `serials[]` in orders.

**Date boundary buffer:** When the invoice validator queries CDR for a billing period it adds a ±2 day buffer on both ends (source: `cdr_query_service.py` lines 82–95). This buffer is for shard routing only — a second strict filter ensures only sessions within the real billing period are counted. If you are writing a one-off query, use the strict dates you actually care about without a buffer unless you have a reason to search for late-arriving records.

---

### 2.3 `esim-archive-cdr_*` wildcard

**Purpose:** Legacy CDR records from older network providers (MANX, VFNL, logstash pipeline). These predate the TelliSIM pipeline. The schema is different from `tellisim-cdr-read`.

**Key differences from `tellisim-cdr-read`:**

| Field | tellisim-cdr-read | esim-archive-cdr_* |
|---|---|---|
| SIM identifier | `ICCID` | `SubscriberReference` (keyword) |
| Usage date | `USAGE_DATE_UTC` | `ConnectTime` (keyword string `YYYY-MM-DD`) |
| Data volume | `TOTAL_QTY` (bytes) | Embedded in `Narrative` text field (e.g. `"1.23 MB used"`) — must be parsed with regex |

**When to use it:** Only needed for orders that predate the TelliSIM migration. The consumption analytics service (`consumption_analytics_service.py` lines 311–338) falls back to this index automatically. Support reps should not need to query it directly — the portal's consumption view handles the fallback.

---

## 3. Orders Index — Complete Field Reference

This table documents every field that the codebase reads from an orders document. Field names were extracted from `api/services/invoice_order_service.py` and `api/routes/admin.py`.

### 3.1 Identity and navigation fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `order_number` | keyword | `"TWUS-269396"` | Human-readable order ID shown to customers and in the UI | Primary lookup field for order ID searches. Always try `order_number.keyword` first. |
| `order_id` | keyword | `"TWUS-269396"` | Alternate order ID field | Some older orders use this instead of `order_number`. The code falls back: `src.get("order_number") or src.get("order_id") or hit["_id"]` |
| `number` | integer | `269396` | Numeric-only order number | Used as a fallback when the search value is all digits. |
| `_id` | string | `"abc123xyz"` | OpenSearch internal document ID | Last-resort fallback if both `order_number` and `order_id` are missing. |

### 3.2 Customer identity fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `customer_email` | text + keyword | `"jane.doe@gmail.com"` | Customer email address | Case varies in production. Always search both original case and `.lower()`. Use `customer_email.keyword` for exact match, `customer_email` (text) for match fallback. See [Gotchas §7.3](#73-customer_email-case-sensitivity). |
| `customer_name` | text | `"Jane Doe"` | Customer full name | Not indexed as keyword in most queries. Use for display only, not lookup. |

> **Phone number:** Phone numbers are **not stored** in the `orders` index and are not present in any other OpenSearch index. There is no phone-number lookup path. See [Query Recipes §6.5](#65-phone-number-lookup).

### 3.3 SIM / ICCID fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `serials` | array of text | `["8948010000094652641"]` | List of ICCIDs assigned to this order | The raw text field. **Cannot** be used for terms aggregations or exact-match filters. |
| `serials.keyword` | array of keyword | `["8948010000094652641"]` | Keyword sub-field of `serials` | **Always use this** for ICCID lookups (`{"terms": {"serials.keyword": [...]}}` or `{"term": {"serials.keyword": "..."}}`). See [Gotchas §7.1](#71-serials-vs-serialskeyword). |

### 3.4 Product and SKU fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `product_sku` | array of keyword | `["TW_eSIM_Tellisim", "DE_10GB_30D"]` | List of SKUs on the order | Index 0 is often a vendor tag (`TW_eSIM_Tellisim`). Index 1 is usually the package SKU. Not all orders have this tag — topups often only have the package SKU. |
| `order_details_data` | array of objects | see below | Line-item detail for each product in the order | Nested array. Each element is an object. See §3.4.1. |

#### 3.4.1 `order_details_data[]` object structure

Each element of `order_details_data` represents one line item. eSIM lines have `package_sku`; hardware lines do not.

| Sub-field | Type | Example | Meaning |
|---|---|---|---|
| `package_sku` | string | `"DE_10GB_30D"` | The data package SKU for eSIM lines. `null` or absent on hardware lines (devices). |
| `qty` | integer | `1` | Quantity of this line item. Multi-eSIM orders have `qty > 1` or multiple lines. |
| `trip_start` | string | `"2025-06-01"` | Customer's intended trip start date (entered at checkout). |
| `trip_end` | string | `"2025-06-14"` | Customer's intended trip end date. |
| `product_sku` | string | `"S2GLOCALMERENT"` | Hardware device SKU (rental device). Present on hardware lines only. |

**Multi-ICCID positional mapping:** When an order has multiple eSIM lines with different packages (e.g. `IN_20GB_30D` + `SG_5GB_15D`), the system maps each ICCID to its package positionally: expand each line by `qty`, then zip with `serials[]` in order. This only works cleanly when counts align. When they do not, the system falls back to the first SKU and marks the mapping as `"ambiguous"`.

### 3.5 Pricing and currency fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `total` | float | `49900.0` | Order total in the **local currency** of the customer | For Chilean customers this is CLP (e.g. 49,900 CLP ≈ $54 USD). **Do not treat as USD.** |
| `order_usd_rate_exchange` | float | `921.5` | Exchange rate: local currency units per 1 USD | Divide `total` by this to get USD. If `0` or missing, treat `total` as USD. |
| `currency_iso` | keyword | `"CLP"` | ISO 4217 currency code for `total` | `"USD"` for US orders. |
| `total_usd` | — | — | **Not stored in OS.** Computed at read time: `total / order_usd_rate_exchange`. | See [Gotchas §7.5](#75-total-vs-total_usd-vs-order_usd_rate_exchange). |

**USD conversion formula (from `invoice_order_service.py` lines 240–244):**
```python
order_total = float(src.get("total") or 0)
usd_rate    = float(src.get("order_usd_rate_exchange") or 1)
if usd_rate <= 0:
    usd_rate = 1
price_usd = order_total / usd_rate if order_total > 0 else 0
```

### 3.6 Status and lifecycle fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `status` | text + keyword | `"Completed"` | Current order status | Use `status.keyword` for exact filtering. See full status list below. |
| `created_at` | integer | `1741910400` | Order creation timestamp as **Unix epoch seconds** | Divide by 1 (not 1000) to get seconds. Convert to date: `datetime.fromtimestamp(ts, tz=timezone.utc)`. See [Gotchas §7.2](#72-created_at-epoch-units). |
| `threshold_date` | integer | `1742515200` | Return/refund deadline as Unix epoch seconds | The date after which a refund is no longer valid per policy. If CDR consumption exists after this date, it is a potential fraud/abuse signal. |

**Full status value list** (source: `invoice_order_service.py` lines 113–125):

| Status | Meaning | ICCID still active? |
|---|---|---|
| `Completed` | Order fulfilled, SIM active | Yes |
| `Pending Payment` | Order placed, not yet paid | No — SIM not provisioned |
| `Fraud` | Flagged as fraud **after** fulfillment | Yes — SIM was activated, data was consumed, vendor will bill us |
| `Fraud - Refunded` | Fraud + refund issued | Depends |
| `Canceled - Refunded` | Cancelled with refund | No |
| `Canceled` | Cancelled without refund | No |
| `Cancel` | Alternate spelling, same meaning | No |
| `Returned` | Device returned | No |
| `Returned - Damaged` | Device returned damaged | No |
| `Returned - Pending for Inspection` | Device returned, under inspection | No |
| `Decline` | Payment declined before fulfillment | No |
| `Completed - Refunded` | Completed then refunded | No |
| `Completed - Pending for Refund` | Refund in progress | No |
| `Partial Refund - 10%` | Partial refund applied | Yes |
| `User Closed` | Customer closed account | No |

> **Important for fraud detection:** The ICCID-to-order matcher does **not** exclude `Fraud` or `Fraud - Refunded` from results. These orders had their SIM activated and data consumed — the vendor bills us regardless. The portal surfaces them with a red FRAUD badge. Excluding them would cause false "unmatched ICCID" alerts.

### 3.7 Sales and routing fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `sales_chanel` | keyword | `"web"` | Sales channel | **Misspelled in OS** (missing second `n`). Always use `sales_chanel` not `sales_channel`. See [Gotchas §7.4](#74-misspelled-sales_chanel-field). |
| `system` | keyword | `"TWUS"` | Brand/system identifier | `TWUS` = TravelWifi US, `TWEU` = TravelWifi Europe, `NV` = Nomad Ventures, etc. |
| `destination_country` | keyword | `"DE"` | Destination country ISO2 | Used for demand aggregations. Not always present on topup orders. |

### 3.8 Coupon and discount fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `coupons` | array | `[{"code": "CMR12345", "discount": 40000}]` | Coupon codes applied to the order | Two types: CMRPuntos (fixed CLP amount, partner-billed) and TW/NV percentage discounts. Added to OS in March 2026 — only ~14 orders have this field as of 2026-04-08. Older orders do not have it. |

---

## 4. `tellisim-cdr-read` — Field Reference

Each document is one network data session for one SIM card.

### 4.1 Core fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `ICCID` | text | `"8948010000094652641"` | SIM card identifier | Text field — use `{"term": {"ICCID": "..."}}` for exact match. For aggregations use `ICCID.keyword`. |
| `IMSI` | text | `"310410123456789"` | International Mobile Subscriber Identity | Identifies the subscriber profile on the SIM. Different from ICCID. Not always present on non-data sessions. |
| `USAGE_DATE_UTC` | datetime | `"2025-03-15T14:22:00"` | When this session occurred (UTC) | ISO datetime string. Use range queries with full ISO format: `"gte": "2025-03-01T00:00:00"`. |
| `TOTAL_QTY` | long | `1073741824` | Data consumed in this session, in **bytes** | Divide by `1024 * 1024 * 1024` (= 1,073,741,824) to convert to GB. Example: 1,073,741,824 bytes = 1.000 GB. |
| `CUSTO_CHARGE` | float | `0.0342` | Cost charged by the upstream carrier for this session in USD | This is our wholesale cost, not the customer price. |
| `SUBS_CHARGE` | float | `0.00` | Subscriber charge (usually 0 for prepaid plans) | Rarely populated. |

### 4.2 Network location fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `iso2` | keyword | `"DE"` | Country where this session occurred | Keyword — safe for terms aggregations and exact filters. Use `{"term": {"iso2": "DE"}}`. |
| `MCC` | keyword | `"262"` | Mobile Country Code | 3-digit ITU code identifying the country of the serving network. |
| `MNC` | keyword | `"02"` | Mobile Network Code | Identifies the carrier within the country. MCC+MNC together identify the exact network operator. |

### 4.3 Session detail fields

| Field | Type | Example value | Meaning | Notes |
|---|---|---|---|---|
| `SESSION_ID` | keyword | `"SID-20250315-001"` | Unique session identifier | Use for deduplication if you see the same data appearing twice. |
| `USAGE_TYPE` | text | `"Data"` | Type of session | All records in `tellisim-cdr-read` are data sessions. The value `"Data"` (or `"33"` in some older records) indicates a data session. Not always populated. |
| `USAGE_TYPE_ID` | integer | `33` | Numeric usage type code | `33` = data. |
| `APN` | keyword | `"travelwifi.com"` | Access Point Name used in the session | Identifies which data service profile was used. |
| `RAT` | keyword | `"LTE"` | Radio Access Technology | `LTE`, `5G`, `3G`, `2G`. Indicates the network generation. |
| `DOWN_BITRATE` | long | `52428800` | Downlink speed in bps during the session | Divide by 1,000,000 for Mbps. Not always populated. |
| `UP_BITRATE` | long | `10485760` | Uplink speed in bps during the session | Divide by 1,000,000 for Mbps. Not always populated. |
| `PREPAID_PACKAGE_IDS` | keyword | `"PKG-DE-10GB"` | The prepaid package ID this session was charged against | Links the session to a specific data package purchased. |
| `PREPAID_PACKAGE_QTYS` | keyword | `"1024"` | Quantity (bytes) remaining in the package after this session | Not always populated. |

### 4.4 TOTAL_QTY unit conversion reference

```
1 KB  = 1,024 bytes
1 MB  = 1,048,576 bytes        (1,024²)
1 GB  = 1,073,741,824 bytes    (1,024³)   ← what TOTAL_QTY uses

TOTAL_QTY = 536,870,912  →  0.500 GB  (512 MB)
TOTAL_QTY = 1,073,741,824 → 1.000 GB
TOTAL_QTY = 5,368,709,120 → 5.000 GB
TOTAL_QTY = 10,737,418,240 → 10.000 GB
```

Python one-liner: `round(total_qty / (1024**3), 4)`

### 4.5 How CDR sessions relate to orders

There is no foreign key between CDR sessions and orders. The linkage is:

```
CDR session.ICCID  →  (match)  →  orders.serials[] containing that ICCID
```

One ICCID can appear in multiple orders over time (cancelled order → SIM returned → resold to new customer). The invoice validator resolves this by choosing the order whose `created_at` is the **latest value on or before the date of the first CDR session** for that ICCID. This ensures consumption is attributed to the correct customer even when a SIM has been reused.

### 4.6 Date boundary buffer (±2 days)

When querying CDR for invoice reconciliation, the system applies a ±2 day buffer on the date range for shard routing efficiency, then applies a second strict filter for the actual billing period (source: `cdr_query_service.py` lines 76–95):

```python
# Wide filter — helps OS choose the right yearly index shards
buffered_start = period_start - timedelta(days=2)
buffered_end   = period_end   + timedelta(days=2)

# Strict filter — enforces actual billing period
# (Both filters are in the same bool.filter[] array)
```

For ad-hoc support queries you do not need the buffer — just use the exact date range you want.

---

## 5. `esim-archive-cdr_*` — Legacy CDR

This wildcard matches all older CDR indices (e.g. `esim-archive-cdr_2023`, `esim-archive-cdr_2024`). These come from the MANX/VFNL network and a logstash pipeline that predates TelliSIM.

**Schema summary:**

| Field | Type | Meaning |
|---|---|---|
| `SubscriberReference` | keyword | ICCID equivalent in this index |
| `ConnectTime` | keyword | Date string `"YYYY-MM-DD"` |
| `Narrative` | text | Free-text field containing MB consumed, e.g. `"Data: 1.23 MB used"` |

**When to use:** Only for historical orders where `tellisim-cdr-read` returns no results. The portal handles this automatically. Direct queries are rarely needed for day-to-day support.

---

## 6. Query Recipes for the Support Portal

All queries below are copy-paste ready for use with the Python `opensearchpy` client. Replace placeholder values (shown in `<angle brackets>`) with real data.

---

### 6.1 Lookup by ICCID

**Use case:** Customer contacts support saying their SIM is not working. You have the ICCID from their account or SIM card.

**Step A — Find the order:**
```python
response = client.search(
    index="orders",
    body={
        "size": 10,
        "query": {"term": {"serials.keyword": "<ICCID>"}},
        "sort": [{"created_at": {"order": "desc"}}],
    }
)
for hit in response["hits"]["hits"]:
    src = hit["_source"]
    print(src.get("order_number"), src.get("status"), src.get("customer_email"))
```

**Step B — Find CDR sessions (total consumption + per-country split):**
```python
# Aggregation — true totals across ALL sessions (no page limit)
agg_response = client.search(
    index="tellisim-cdr-read",
    body={
        "size": 0,
        "query": {"term": {"ICCID": "<ICCID>"}},
        "aggs": {
            "total_bytes": {"sum": {"field": "TOTAL_QTY"}},
            "by_country": {
                "terms": {"field": "iso2", "size": 50},
                "aggs": {"country_bytes": {"sum": {"field": "TOTAL_QTY"}}},
            },
        },
    }
)
aggs = agg_response["aggregations"]
total_gb = aggs["total_bytes"]["value"] / (1024**3)
print(f"Total consumed: {total_gb:.4f} GB")
for bucket in aggs["by_country"]["buckets"]:
    gb = bucket["country_bytes"]["value"] / (1024**3)
    print(f"  {bucket['key']}: {gb:.4f} GB")
```

**Step C — Fetch the 25 most recent CDR sessions (for display):**
```python
session_response = client.search(
    index="tellisim-cdr-read",
    body={
        "size": 25,
        "query": {"term": {"ICCID": "<ICCID>"}},
        "sort": [{"USAGE_DATE_UTC": {"order": "desc"}}],
    }
)
for hit in session_response["hits"]["hits"]:
    src = hit["_source"]
    gb = (src.get("TOTAL_QTY") or 0) / (1024**3)
    print(src.get("USAGE_DATE_UTC"), src.get("iso2"), f"{gb:.4f} GB")
```

> **Tip:** The support portal's OS Explorer (Settings → OS Explorer) does Steps A–C automatically. Use the Python queries above only if you need to go deeper than the UI allows.

---

### 6.2 Lookup by Order ID

**Use case:** Customer provides their order number (e.g. `TWUS-269396`).

```python
order_id_value = "<ORDER_ID>"   # e.g. "TWUS-269396"

# Try both original case and uppercase; also try numeric if all digits
should_clauses = [
    {"term": {"order_number.keyword": order_id_value}},
    {"term": {"order_number.keyword": order_id_value.upper()}},
]
if order_id_value.isdigit():
    should_clauses.append({"term": {"number": int(order_id_value)}})

response = client.search(
    index="orders",
    body={
        "size": 10,
        "query": {"bool": {"should": should_clauses, "minimum_should_match": 1}},
        "sort": [{"created_at": {"order": "desc"}}],
    }
)
for hit in response["hits"]["hits"]:
    src = hit["_source"]
    print(src.get("order_number"), src.get("status"),
          src.get("customer_email"), src.get("serials"))
```

---

### 6.3 Lookup by Customer Email

**Use case:** Customer calls in and you only have their email address.

```python
email_value = "<customer@example.com>"

response = client.search(
    index="orders",
    body={
        "size": 50,
        "query": {
            "bool": {
                "should": [
                    {"term": {"customer_email.keyword": email_value}},
                    {"term": {"customer_email.keyword": email_value.lower()}},
                    {"match": {"customer_email": email_value}},
                ],
                "minimum_should_match": 1,
            }
        },
        "sort": [{"created_at": {"order": "desc"}}],
    }
)
for hit in response["hits"]["hits"]:
    src = hit["_source"]
    from datetime import datetime, timezone
    ts = src.get("created_at", 0)
    date_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d") if ts else "?"
    print(date_str, src.get("order_number"), src.get("status"),
          src.get("system"), src.get("total"), src.get("currency_iso"))
```

> **Why three clauses?** Email case is inconsistent in production. Some records stored the email as-typed (mixed case); others were lowercased. The three-clause approach catches all variants without missing records.

---

### 6.4 Lookup by IMEI

**Use case:** Device IMEI is provided (usually for rental/hardware orders).

```python
# IMEI is not a top-level indexed field in 'orders'.
# It may appear inside order_details_data[] as a sub-field.
# The most reliable approach is to search by customer email first,
# then filter the returned orders by IMEI in application code.
#
# Direct OS query (may not match if IMEI is not indexed):
response = client.search(
    index="orders",
    body={
        "size": 25,
        "query": {"match": {"order_details_data.imei": "<IMEI>"}},
        "sort": [{"created_at": {"order": "desc"}}],
    }
)
```

> **Warning:** IMEI is not a reliably indexed top-level field. If the above returns nothing, look up the customer by email (§6.3) and inspect `order_details_data[]` manually. IMEI also appears in CDR sessions as `IMSI` (not the same thing — IMSI identifies the subscriber profile, not the physical device). True IMEI-to-order matching may require checking the device management system, not OpenSearch.

---

### 6.5 Phone Number Lookup

**Phone numbers are not stored in OpenSearch.** Neither the `orders` index nor any CDR index contains a phone number field. There is no phone-number lookup path through OpenSearch.

If a customer contacts support with only a phone number, ask them for their order number or registered email address instead.

---

### 6.6 Show All Orders for a Customer Across All Brands

**Use case:** Customer may have ordered under TWUS, TWEU, NV, or other brands. You want the full picture.

```python
email_value = "<customer@example.com>"

response = client.search(
    index="orders",
    body={
        "size": 200,   # Increase if customer has many orders
        "query": {
            "bool": {
                "should": [
                    {"term": {"customer_email.keyword": email_value}},
                    {"term": {"customer_email.keyword": email_value.lower()}},
                    {"match": {"customer_email": email_value}},
                ],
                "minimum_should_match": 1,
            }
        },
        "sort": [{"created_at": {"order": "desc"}}],
        "_source": [
            "order_number", "status", "system", "created_at",
            "total", "currency_iso", "order_usd_rate_exchange",
            "serials", "product_sku", "sales_chanel",
            "threshold_date", "destination_country"
        ],
    }
)

from datetime import datetime, timezone
for hit in response["hits"]["hits"]:
    src = hit["_source"]
    ts = src.get("created_at", 0)
    date_str = datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d") if ts else "?"
    total = src.get("total", 0)
    rate = src.get("order_usd_rate_exchange") or 1
    usd = round(total / rate, 2) if total and rate > 0 else 0
    print(
        date_str,
        src.get("system", "?"),
        src.get("order_number"),
        src.get("status"),
        f"${usd} USD",
        src.get("serials", [])
    )
```

---

### 6.7 CDR Consumption for an ICCID with Daily Histogram

**Use case:** You need to see day-by-day data usage for a SIM — useful for investigating over-consumption claims or checking when a SIM was last active.

This is the `CDRQueryService.daily_breakdown_for_iccids` pattern from `api/services/cdr_query_service.py` lines 365–455.

```python
from datetime import date

iccid = "<ICCID>"
period_start = date(2025, 3, 1)   # adjust to your window
period_end   = date(2025, 3, 31)

response = client.search(
    index="tellisim-cdr-read",
    body={
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"range": {"USAGE_DATE_UTC": {
                        "gte": f"{period_start.isoformat()}T00:00:00",
                        "lte": f"{period_end.isoformat()}T23:59:59",
                    }}},
                    {"term": {"ICCID": iccid}},
                ]
            }
        },
        "aggs": {
            "by_day": {
                "date_histogram": {
                    "field": "USAGE_DATE_UTC",
                    "calendar_interval": "day",
                    "format": "yyyy-MM-dd",
                },
                "aggs": {
                    "bytes": {"sum": {"field": "TOTAL_QTY"}},
                    "by_country": {
                        "terms": {"field": "iso2", "size": 10},
                        "aggs": {"country_bytes": {"sum": {"field": "TOTAL_QTY"}}},
                    },
                },
            }
        },
    }
)

_BPG = 1024 ** 3
for bucket in response["aggregations"]["by_day"]["buckets"]:
    day_gb = (bucket.get("bytes", {}).get("value") or 0) / _BPG
    if not day_gb:
        continue
    countries = [
        f"{cb['key']}:{cb['country_bytes']['value']/_BPG:.3f}GB"
        for cb in bucket["by_country"]["buckets"]
    ]
    print(bucket["key_as_string"], f"{day_gb:.4f} GB", ", ".join(countries))
```

---

### 6.8 Find Orders with Post-Deadline Refund / Carryover Consumption

**Use case:** Identify orders where the customer was refunded but CDR shows the SIM continued consuming data after the `threshold_date`. This is a primary fraud/abuse signal.

**Step A — Find Canceled-Refunded orders with a threshold date:**
```python
from datetime import datetime, timezone

response = client.search(
    index="orders",
    body={
        "size": 100,
        "query": {
            "bool": {
                "filter": [
                    {"terms": {"status.keyword": [
                        "Canceled - Refunded",
                        "Completed - Refunded",
                        "Completed - Pending for Refund",
                    ]}},
                    {"exists": {"field": "threshold_date"}},
                ]
            }
        },
        "sort": [{"created_at": {"order": "desc"}}],
        "_source": ["order_number", "status", "customer_email",
                    "serials", "threshold_date", "created_at",
                    "total", "currency_iso", "order_usd_rate_exchange"],
    }
)

for hit in response["hits"]["hits"]:
    src = hit["_source"]
    threshold_ts = src.get("threshold_date")
    if threshold_ts:
        threshold_dt = datetime.fromtimestamp(int(threshold_ts), tz=timezone.utc)
        print(src.get("order_number"), src.get("customer_email"),
              f"threshold: {threshold_dt.date()}", src.get("serials"))
```

**Step B — For each suspicious order, check CDR after the threshold date:**
```python
# For each ICCID in the order, check if any CDR sessions exist AFTER threshold_date
threshold_date_obj = threshold_dt.date()   # from Step A

cdr_check = client.search(
    index="tellisim-cdr-read",
    body={
        "size": 0,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"ICCID": "<ICCID_FROM_SERIALS>"}},
                    {"range": {"USAGE_DATE_UTC": {
                        "gt": f"{threshold_date_obj.isoformat()}T23:59:59"
                    }}},
                ]
            }
        },
        "aggs": {"post_threshold_bytes": {"sum": {"field": "TOTAL_QTY"}}},
    }
)
post_gb = (
    cdr_check["aggregations"]["post_threshold_bytes"]["value"] or 0
) / (1024**3)
if post_gb > 0:
    print(f"ALERT: {post_gb:.4f} GB consumed AFTER refund threshold")
```

> **What this means:** If CDR shows consumption after `threshold_date`, the customer used the SIM after the refund was processed. This is a `REFUND_FRAUD_CARRYOVER` signal. The invoice validator detects this automatically and surfaces it in the billing dashboard, but you can use this query for one-off investigations.

---

## 7. Gotchas

### 7.1 `serials` vs `serials.keyword`

`serials` is a text field. Text fields in OpenSearch are analyzed (tokenized) by default, which means you **cannot** do exact-match term queries on them. You will get incorrect or empty results.

Always use `serials.keyword` for ICCID lookups:

```python
# CORRECT
{"term": {"serials.keyword": "8948010000094652641"}}
{"terms": {"serials.keyword": ["8948010000094652641", "8948010000094652642"]}}

# WRONG — will not return correct results
{"term": {"serials": "8948010000094652641"}}
```

Source: `invoice_order_service.py` line 154 and `admin.py` line 682.

---

### 7.2 `created_at` epoch units

`created_at` in the `orders` index is stored as **Unix epoch seconds** (e.g. `1741910400`), not milliseconds.

```python
from datetime import datetime, timezone

# CORRECT — divide by nothing, it's already seconds
ts = src.get("created_at")   # e.g. 1741910400
dt = datetime.fromtimestamp(ts, tz=timezone.utc)  # 2025-03-14

# WRONG — treating as milliseconds gives year ~56000
dt_wrong = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
```

CDR fields (`USAGE_DATE_UTC`) are stored as ISO datetime strings, not epoch integers. When the `cdr_query_service` reads min/max aggregation results it explicitly divides by 1000 (`first_ms / 1000`) because aggregations on date fields return epoch milliseconds. This is a known inconsistency between how the two indices store timestamps.

---

### 7.3 `customer_email` case sensitivity

Email addresses in `orders` are stored with inconsistent casing. Some are lowercase, some are mixed-case as entered by the customer. The `customer_email.keyword` sub-field is case-sensitive.

Always search for both the original value and its `.lower()` variant:

```python
{"bool": {
    "should": [
        {"term": {"customer_email.keyword": email}},
        {"term": {"customer_email.keyword": email.lower()}},
        {"match": {"customer_email": email}},   # analyzed fallback
    ],
    "minimum_should_match": 1,
}}
```

In application code, customer emails are always normalized to lowercase before comparison:
```python
"customer_email": (src.get("customer_email") or "").strip().lower()
```

Source: `invoice_order_service.py` lines 336 and 415.

---

### 7.4 Misspelled `sales_chanel` field

The sales channel field in the `orders` index is stored as `sales_chanel` (one `n`, missing the second `n` in "channel"). This is a known data entry error that cannot be fixed without reindexing all orders.

```python
# CORRECT
src.get("sales_chanel")

# WRONG — returns None for all documents
src.get("sales_channel")
```

Source: `invoice_order_service.py` line 330 (comment reads: `# Note: misspelled in OS`).

---

### 7.5 `total` vs `total_usd` vs `order_usd_rate_exchange`

- `total` — stored in OS, but **in local currency** (CLP, SGD, EUR, etc.)
- `total_usd` — **not stored in OS**; computed at read time
- `order_usd_rate_exchange` — stored in OS; local currency units per 1 USD

To get USD: `price_usd = total / order_usd_rate_exchange`

Special cases:
- If `order_usd_rate_exchange` is `0` or missing, treat `total` as USD.
- Hardware bundle orders set `price_usd = 0` to force a catalog price lookup, because `total` includes the device price which should not be attributed to the eSIM.
- Multi-eSIM orders divide the total by the number of eSIM lines: `price_usd = total_usd / esim_count`.

Source: `invoice_order_service.py` lines 240–257 and `order_performance_service.py` lines 197–200.

---

### 7.6 `order_details_data` and `esim_details` — nested arrays

`order_details_data` is a JSON array stored as a nested field. Each element is a line item object. Rules:

- eSIM lines: have `package_sku` set (e.g. `"DE_10GB_30D"`)
- Hardware lines: `package_sku` is null or absent; have `product_sku` set (e.g. `"S2GLOCALMERENT"`)
- You must iterate the array and filter by `package_sku` presence to separate eSIM from hardware
- The first eSIM line's `package_sku` is the default SKU for single-eSIM orders
- For multi-eSIM orders with different packages, use positional mapping (expand by `qty`, zip with `serials[]`)

---

### 7.7 Bundle orders with multiple ICCIDs on one order_id

Some orders contain multiple SIM cards (e.g. a family buying three country plans). These orders have:
- Multiple entries in `serials[]`
- Multiple entries in `order_details_data[]`
- A single `total` that covers all SIMs

When attributing revenue per ICCID for such orders, the system divides `total_usd` by the number of eSIM lines (`esim_count`). If the packages differ per ICCID (positional mapping), it falls back to catalog price per ICCID.

---

### 7.8 Orders with no SIM (Pending Payment)

Orders with `status = "Pending Payment"` have not been paid and have no provisioned SIM. Their `serials[]` array is typically empty. CDR will show no activity for these. Do not flag them as fraud — they are normal pre-payment states.

---

### 7.9 ICCID field type inconsistency between indices

| Index | Field | Type | Query to use |
|---|---|---|---|
| `orders` | `serials` | text (use `.keyword`) | `{"term": {"serials.keyword": "..."}}` |
| `tellisim-cdr-read` | `ICCID` | text (also has `.keyword`) | `{"term": {"ICCID": "..."}}` for row queries; `{"terms": {"ICCID.keyword": [...]}}` for aggregations |
| `esim-archive-cdr_*` | `SubscriberReference` | keyword | `{"term": {"SubscriberReference.keyword": "..."}}` |

---

## 8. Fraud and Risk Signal Fields

This section describes the fields and patterns that support staff should watch for when investigating fraud, abuse, or refund manipulation.

### 8.1 Status-based signals

| Status | Risk signal | Action |
|---|---|---|
| `Fraud` | Order was flagged as fraud after SIM was activated | Check CDR — SIM was likely used. Check if customer is attempting a chargeback. |
| `Fraud - Refunded` | Fraud flag + refund issued | Verify refund was within `threshold_date`. Check CDR for post-refund consumption. |
| `Canceled - Refunded` | Refund processed | Cross-check `threshold_date` against CDR. Post-threshold CDR = `REFUND_FRAUD_CARRYOVER`. |
| `Completed - Refunded` | Completed order then refunded | Same as above. High-value orders with heavy CDR usage before refund are suspicious. |

---

### 8.2 `threshold_date` vs actual refund date

`threshold_date` (Unix epoch seconds in `orders`) is the policy deadline after which a refund should not have been issued OR the SIM should not be usable. It is set at order creation.

**Fraud pattern:** CDR sessions on an ICCID with dates **after** `threshold_date` on an order with `status = "Canceled - Refunded"` indicate the customer used the SIM after claiming a refund. The invoice validator calls this `REFUND_FRAUD_CARRYOVER`. See Query Recipe §6.8 for the detection query.

---

### 8.3 ICCID reuse across customers

Because SIM cards can be physically returned and resold, an ICCID can appear in orders for different customers. The invoice validator handles this through the "shadow query" mechanism — it queries excluded (cancelled/returned) orders for the same ICCID and attaches them as `_excluded_candidates`.

**Fraud pattern:** If ICCID appears in:
1. A `Canceled - Refunded` order for Customer A
2. A `Completed` order for Customer B
3. CDR shows heavy usage after Customer A's `threshold_date` but before Customer B's order date

...then Customer A may have kept using the SIM after getting a refund. The SIM was then reassigned but the prior-owner consumption was billed to us.

---

### 8.4 Customer email domain patterns

There is no automated domain blacklist in OpenSearch. However, if investigating a wave of fraud orders, you can aggregate by email domain:

```python
response = client.search(
    index="orders",
    body={
        "size": 0,
        "query": {"terms": {"status.keyword": ["Fraud", "Fraud - Refunded"]}},
        "aggs": {
            "by_email_domain": {
                "terms": {
                    "field": "customer_email.keyword",
                    "size": 100,
                    "include": ".*@.*",
                }
            }
        },
    }
)
```

Note: Aggregating on `customer_email.keyword` returns full email addresses. You will need to extract domains in application code.

---

### 8.5 High consumption on cancelled orders

If an order is cancelled/refunded but CDR shows many GB consumed, this is a cost-exposure event — the vendor will bill TravelWifi for that consumption regardless of the refund.

Quick check: For a given ICCID, compare:
- `data_gb` from the SKU (e.g. `DE_10GB_30D` = 10 GB allocated)
- `total_gb` from CDR aggregation (actual bytes consumed ÷ 1024³)

If `total_gb > data_gb` on a cancelled order, the customer over-consumed beyond their plan allocation, possibly while the refund was being processed or after.

---

### 8.6 `Pending Payment` orders with long age

Orders that remain in `Pending Payment` for more than 48–72 hours typically indicate a failed payment or abandoned checkout. These are low fraud risk by themselves but can indicate card-testing behavior if the same customer email has many `Pending Payment` orders with no `Completed` ones.

```python
import time
cutoff_ts = int(time.time()) - (72 * 3600)
response = client.search(
    index="orders",
    body={
        "size": 50,
        "query": {
            "bool": {
                "filter": [
                    {"term": {"status.keyword": "Pending Payment"}},
                    {"range": {"created_at": {"lte": cutoff_ts}}},
                ]
            }
        },
        "sort": [{"created_at": {"order": "asc"}}],
        "_source": ["order_number", "customer_email", "created_at",
                    "total", "currency_iso", "system"],
    }
)
```

---

### 8.7 Summary — Quick signal reference table

| Signal | Field to check | How to detect |
|---|---|---|
| Post-refund SIM use | `threshold_date` + CDR `USAGE_DATE_UTC` | CDR sessions after `threshold_date` on a refunded order |
| Fraud-flagged order with real CDR | `status = "Fraud"` | ICCID present in CDR with non-zero `TOTAL_QTY` |
| SIM reuse across customers | `serials.keyword` in multiple orders | Multiple orders for same ICCID, different `customer_email` |
| Over-consumption | `data_gb` from SKU vs CDR `total_gb` | CDR `total_gb > data_gb` from plan |
| Card testing / mass pending | `status = "Pending Payment"` + email | Same email, many `Pending Payment`, no `Completed` |
| Deep-discount abuse | `total` very low + CDR heavy | `price_usd < 1.00` on `Completed` order with high CDR consumption |
| Missing SIM on completed order | `serials[]` empty + `status = "Completed"` | Provisioning failure — escalate to ops |

---

*Document generated from codebase evidence. Source files: `api/services/cdr_query_service.py`, `api/services/invoice_order_service.py`, `api/services/opensearch_client.py`, `api/services/consumption_analytics_service.py`, `api/services/opensearch_validator.py`, `api/routes/admin.py`, `config.yaml.example`.*
