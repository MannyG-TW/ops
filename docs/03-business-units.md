# Business Units, Brands, Currencies & Coupons

**Audience:** Customer-support portal reps.
**Goal:** Understand that we operate multiple brands under one roof — each with different storefronts, currencies, coupon systems, and customer populations — so you can triage tickets correctly.

**TL;DR:** When a ticket comes in, the three things you need to know before anything else are:

1. **Which brand?** — look at the `system` field or the `order_number` prefix (`TWUS-...`, `NVCL-...`, etc.)
2. **Which currency?** — look at `currency_iso` (not every order is in USD)
3. **Is a coupon involved?** — and if yes, is it **CMRPuntos** (partner-billed, Chile) or a **TW/NV percentage** discount (real revenue loss)?

Get those three right and 80% of support confusion disappears.

---

## 1. Brand Enumeration

We operate under **two umbrella businesses** — TravelWifi (TW*) and Nomad/Navimo (NV*) — plus several partner/marketplace integrations. Every order in OpenSearch carries a `system` keyword field that identifies the brand.

### 1.1 Known `system` values

Evidence sources:
- `filters.yaml:4-5` — curated default include list (`TWUS`, `TWEU`)
- `docs/technical/INITIALIZATION_CHECKLIST.md:132` — full production list
- `docs/technical/PROJECT_ANALYSIS.md:175` — same list repeated
- `ga_config_tracker.py:20` (TW family) and `:60` (NV family)
- `api/services/order_performance_service.py:59-60` — channel-category mapping
- `CHANGELOG.md:657` — "11 systems included in filters"
- `cache/rds_schema_discovery.json:27-28` — aggregate counts for top 2 brands
- `README.md:260-261` — same aggregates

| `system` value | Brand / Full name | Umbrella | Primary market | Order prefix | Channel category (`order_performance_service.py:59`) |
|---|---|---|---|---|---|
| `TWUS` | TravelWifi US | TravelWifi | United States | `TWUS-*` | **TW Direct** |
| `TWEU` | TravelWifi Europe | TravelWifi | Europe | `TWEU-*` | **TW Direct** |
| `TWLOCAL` | TravelWifi Local | TravelWifi | Multi-market | `TWLOCAL-*` | **TW Direct** |
| `TWCL` | TravelWifi Chile | TravelWifi | Chile | `TWCL-*` | **TW Direct** |
| `TWCH` | TravelWifi Switzerland | TravelWifi | Switzerland | `TWCH-*` | TW Direct |
| `TWSG` | TravelWifi Singapore | TravelWifi | Singapore | `TWSG-*` | TW Direct |
| `TWFR` | TravelWifi France | TravelWifi | France | `TWFR-*` | TW Direct |
| `TWID` | TravelWifi Indonesia | TravelWifi | Indonesia | `TWID-*` | TW Direct |
| `TWFIUS` | TravelWifi FI/US | TravelWifi | (legacy) | `TWFIUS-*` | TW Direct |
| `TWCHL` | TravelWifi Chile (legacy) | TravelWifi | Chile (legacy) | `TWCHL-*` | TW Direct |
| `TW` | TravelWifi (generic) | TravelWifi | catch-all legacy | `TW-*` | TW Direct |
| `NVUS` | Navimo/Nomad US | Navimo | United States | `NVUS-*` | **Partners** |
| `NVEU` | Navimo/Nomad Europe | Navimo | Europe | `NVEU-*` | Partners |
| `NVLOCAL` | Navimo/Nomad Local | Navimo | Multi-market | `NVLOCAL-*` | Partners |
| `NVCL` | Navimo/Nomad Chile | Navimo | Chile | `NVCL-*` | Partners |
| `BC` | Business Channel (legacy) | Partners | B2B | `BC-*` | Partners |
| `B2B` | Business-to-Business | Partners | Corporate | `B2B-*` | Partners |
| `B2C` | Business-to-Consumer | Partners | Direct-sale partner | `B2C-*` | Partners |
| `QRO` | QRO partner | Partners | Mexico | `QRO-*` | Partners |
| `FBLLCL` | FBLL Chile (marketplace) | Marketplace | Chile | `FBLLCL-*` | **Marketplace** |
| `DSPCL` | DSP Chile (marketplace) | Marketplace | Chile | `DSPCL-*` | Marketplace |
| `CMRPUNTOSCL` | CMR Puntos Chile (partner loyalty) | Marketplace | Chile | `CMRPUNTOSCL-*` or `CMR-*` | Marketplace |

> **Note on "CMR":** The `system` value **starts with `CMRPUNTOS`** (case-insensitive). See `api/services/coupon_utils.py:90`:
> ```python
> if system.upper().startswith("CMRPUNTOS"):
>     return "cmrpuntos"
> ```
> Any variant (`CMRPUNTOSCL`, future `CMRPUNTOSPE`, etc.) is treated as CMR Puntos.

### 1.2 Volume at a glance (from `cache/rds_schema_discovery.json:27-28`)

| Brand | Orders (lifetime) | Revenue USD (lifetime) |
|---|---:|---:|
| **TWUS** | 138,337 | $161.3M |
| **TWEU** | 66,807 | $7.7M |

TWUS + TWEU together account for the overwhelming majority of volume. All other brands are comparatively small — assume any random ticket is most likely TWUS unless the prefix says otherwise.

### 1.3 Channel-category rollup

Evidence: `api/services/order_performance_service.py:59-60`

```python
"TWUS": "TW Direct", "TWEU": "TW Direct", "TWLOCAL": "TW Direct", "TWCL": "TW Direct",
"FBLLCL": "Marketplace", "DSPCL": "Marketplace", "CMRPUNTOSCL": "Marketplace",
```

For dashboards and support reporting, the three rollup buckets are:

| Rollup bucket | Contains |
|---|---|
| **TW Direct** | All `TW*` systems (TravelWifi branded storefronts) |
| **Partners** | All `NV*` systems, plus `BC`, `B2B`, `B2C`, `QRO` |
| **Marketplace** | `FBLLCL`, `DSPCL`, `CMRPUNTOSCL` |

---

## 2. Currency & Exchange Rates

### 2.1 The two fields

Every order has two currency-related fields in OpenSearch:

| Field | Type | Example | Meaning |
|---|---|---|---|
| `currency_iso` | keyword | `"USD"`, `"CLP"`, `"EUR"`, `"SGD"` | ISO-4217 currency of the `total` field |
| `order_usd_rate_exchange` | number | `1.0`, `950.0`, `0.92` | **Local currency units per 1 USD** at order time |

### 2.2 The conversion formula

Evidence: `api/services/invoice_order_service.py:237-244`

```python
# total is in local currency (CLP, SGD, EUR, etc.)
# order_usd_rate_exchange = local currency units per 1 USD
order_total = float(src.get("total") or 0)
usd_rate = float(src.get("order_usd_rate_exchange") or 1)
if usd_rate <= 0:
    usd_rate = 1  # Safety: treat as USD if rate invalid
price_usd = order_total / usd_rate if order_total > 0 else 0
```

**The math you need to remember:**

```
total_usd = total / order_usd_rate_exchange
```

**Worked example — a Chilean CLP order:**
- `total = 24000` (CLP)
- `order_usd_rate_exchange = 950` (CLP per USD)
- `total_usd = 24000 / 950 = $25.26`

**Worked example — a USD order:**
- `total = 29.99` (USD)
- `order_usd_rate_exchange = 1.0`
- `total_usd = 29.99 / 1.0 = $29.99`

### 2.3 Currency edge cases

| Situation | What the code does (`invoice_order_service.py:242-244`) | What it means for you |
|---|---|---|
| `order_usd_rate_exchange` is `0` or negative | Forces rate to `1` | The order is treated **as if it were already USD**. If the customer actually paid CLP, the USD number will be wildly wrong — flag to engineering. |
| `order_usd_rate_exchange` is missing (`None`) | Falls back to `1` via `or 1` | Same as above. |
| `currency_iso` missing | Defaults to `"USD"` (`:265`) | Assume USD. Usually correct for TWUS orders. |
| `total` is `0` | `price_usd = 0` | Comp order, pending payment, or a CMRPuntos-covered order — check coupons. |

### 2.4 Known currencies in the wild

Seen in OpenSearch `currency_iso` and CSV exports (`Report from 2026-03-01 To 2026-03-24.csv`):

| Currency | Typical brand | Typical market |
|---|---|---|
| `USD` | TWUS, NVUS, most international | Global default |
| `EUR` | TWEU, NVEU | Europe |
| `CLP` | TWCL, NVCL, CMRPUNTOSCL, FBLLCL, DSPCL | Chile |
| `SGD` | TWSG | Singapore |
| `CHF` | TWCH | Switzerland |
| `MXN` | QRO | Mexico |

> **Important:** Even a Chilean customer placing an order through `NVCL` may show `currency_iso: "USD"` if the storefront prices in USD (see CSV lines 3, 5, 15 — all `NVCL-*` orders with `USD` and rate `1.000000`). **Always trust `currency_iso`, not the brand, for currency.**

---

## 3. Coupon Systems

There are **two fundamentally different coupon types** plus a full-comp edge case. The distinction matters because it changes how you compute "real" revenue.

Full reference: `api/services/coupon_utils.py:1-14` (docstring) and `api/services/coupon_revenue.py:4-38`.

### 3.1 Type A — CMRPuntos (partner-billed, Chile)

**What it is:** A loyalty-points integration with CMR (a Chilean retail partner). Customers redeem CMR loyalty points to pay for eSIMs. The customer effectively pays nothing (or very little) out of pocket — **CMR pays TravelWifi the full catalog price at month-end**.

**How to identify:**
1. `system` value starts with `CMRPUNTOS` (e.g. `CMRPUNTOSCL`)
   — evidence: `api/services/coupon_utils.py:90`
2. The `coupons[]` array contains a fixed **CLP amount** coupon (not a percentage)
3. `currency_iso` is `CLP`

**Revenue treatment** (`api/services/coupon_revenue.py:4`, `coupon_utils.py:102-128`):

> **CMRPuntos: Revenue = catalog_price** (partner pays the gap monthly)

```python
if coupon_type == "cmrpuntos":
    # Partner pays the coupon portion — full catalog price is revenue.
    if catalog_price is not None:
        return float(catalog_price)
    return float(order.get("total_usd", 0) or 0)
```

**Why this matters for support:** If a CMR customer says "I paid $0" — they're right. But internally, CMR owes us the full retail price. **Do not issue refunds based on `total = 0` alone**; check for CMRPuntos first.

**Monthly billing:** A dedicated report generator exists at `api/services/cmrpuntos_billing.py` and is exposed via `api/routes/dashboard.py:620-665`. It produces the reconciliation file TravelWifi sends to CMR for invoicing.

### 3.2 Type B — TW / NV Percentage Discounts

**What it is:** Standard marketing promo codes (`WELCOME10`, `WETHRIFTTW`, `RENEWTW20`, etc.) applied at checkout. Customer pays the discounted amount; TravelWifi absorbs the discount as real revenue loss.

**Full registry:** `api/services/coupon_utils.py:20-33`

| Code | Discount | Category | Description |
|---|---|---|---|
| `WELCOME10` | 10% | `tw_promo` | New customer welcome 10% |
| `WELCOME15` | 15% | `tw_promo` | New customer welcome 15% |
| `WELCOME20` | 20% | `tw_promo` | New customer welcome 20% |
| `RENEWTW10` | 10% | `tw_promo` | Renewal loyalty 10% |
| `RENEWTW15` | 15% | `tw_promo` | Renewal loyalty 15% |
| `RENEWTW20` | 20% | `tw_promo` | Renewal loyalty 20% |
| `WETHRIFTTW` / `WETHRIFT` | 10% | `affiliate` | WeThrift affiliate |
| `CLAIRESITCHYFEET` | 15% | `influencer` | Claire's Itchy Feet influencer |
| `10NAVIMO` | 10% | `tw_promo` | Navimo promotion |
| `GTD_RRHH_PERU` | 100% | `partner_comp` | GTD HR Peru full comp |
| `GTD_RRHH` | 100% | `partner_comp` | GTD HR full comp |

**Code resolution order** (`coupon_utils.py:38-69`): exact match → longest-prefix match → trailing-digit extraction (`WELCOME25` → 25%) → `unknown`.

**Revenue treatment:** `total_usd` is the real revenue. No partner reimbursement.

### 3.3 Type C — Full comp (edge case)

**How identified** (`coupon_utils.py:93-96`): coupon present **and** `total == 0` **and** brand is NOT CMRPuntos.

**Revenue treatment:** Zero. This is a comped giveaway (e.g. `GTD_RRHH_PERU` full-comp).

### 3.4 The `coupons[]` field structure

Evidence: `docs/support-portal/01-opensearch.md:247`

```json
"coupons": [
  { "code": "CMR12345", "discount": 40000 }
]
```

- `code` — string, the promo code entered by customer
- `discount` — number, **either** a fixed amount in `currency_iso` units (CMRPuntos, e.g. `40000` CLP) **or** a percentage (TW/NV discounts). Use the code classification to decide which.

### 3.5 The OpenSearch coupon-data gap (CRITICAL)

Evidence: `docs/support-portal/01-opensearch.md:247` and `.claude/memory/coupon_system.md`

> **The `coupons[]` field was added to OpenSearch in March 2026. Only ~14 orders carry the field as of 2026-04-08. Pre-March-2026 orders do not have coupon data in OS at all.**

**What this means for support:**
- For any pre-March-2026 ticket asking "did I use a coupon?", you cannot answer from OpenSearch alone — you need the source-of-truth RDS database or the original email confirmation.
- Historical revenue-erosion analysis via OS is impossible for coupons before this cutoff.
- The revenue-dilution investigation (`.claude/memory/revenue_dilution_finding.md`) debunked a suspected systematic price-erosion issue precisely because of this gap: low `total_usd` values in old orders were CMRPuntos-billed, not discounted.

### 3.6 "Suspected coupon" flag

Evidence: `api/services/invoice_order_service.py:297-298`

```python
if price_source == "order" and price_usd > 0 and price_usd < 1.00:
    price_source = "coupon_suspected"
```

When no `coupons[]` field is present but the USD price is suspiciously low (< $1), the invoice matcher flags the order with `price_source = "coupon_suspected"`. You'll see this in invoice-reconciliation UI as a warning — it almost always means a deep-discount coupon on an old order.

---

## 4. Sales Channels (the `sales_chanel` field — yes, one N)

### 4.1 The misspelling is permanent

Evidence:
- `docs/technical/opensearch_index_guide.md:180-181` — *"Field is intentionally misspelled as `sales_chanel`."*
- `docs/support-portal/01-opensearch.md:768-777` — documented gotcha
- `api/services/invoice_order_service.py:330` — `"sales_channel": src.get("sales_chanel", ""),  # Note: misspelled in OS`
- `opensearch_data_manager.py:126, 168, 981, 1019` — every reader uses `sales_chanel`

**Rule:** When querying OpenSearch, always use `sales_chanel` (and `sales_chanel.keyword` for filtering/aggregation). Never `sales_channel`. Python code internally normalizes to `sales_channel` after reading, but the **OS field name is `sales_chanel`**.

### 4.2 Observed `sales_chanel` values

From the CSV export (`Report from 2026-03-01 To 2026-03-24.csv`) and `README.md:211`, `docs/technical/MAP_FLOW.md:349`:

| Value | Typical customer pattern |
|---|---|
| `TravelWifi` | Default direct-storefront sale (web checkout) |
| `WEB` | Generic web channel (some NV storefronts) |
| `Mail` | Order placed or delivered via email flow |
| `Digital` | Digital-only delivery (no physical hardware) |
| `POS` | Point-of-sale / kiosk (referenced in `opensearch_index_guide.md:828`) |

> The `sales_chanel` field is **orthogonal to `system`**. `system` tells you which brand/storefront took the order; `sales_chanel` tells you how it was placed. A single brand can have multiple channels.
> Evidence: `docs/technical/opensearch_index_guide.md:191`:
> *"You should treat `system` and `sales_chanel` as separate dimensions in aggregations and filters."*

---

## 5. Order-Number Prefixes — Routing Cheatsheet

Every `order_number` follows the pattern `{SYSTEM}-{SEQUENCE}`. Examples from the codebase:

- `TWUS-269396` (`web/app/settings/os-explorer/page.tsx:316`)
- `TWEU-271687` (`web/app/settings/os-explorer/page.tsx:317`)
- `NVCL-1767` (CSV line 3)
- `TWUS-101268` (`cache/rds_schema_discovery.json:208`)

**RDS vs OpenSearch quirk** (`cache/rds_schema_discovery.json:262-266`):
- **OpenSearch** stores the full string: `"TWUS-65658"` in `order_number`
- **RDS MySQL** stores them split: `65658` in the `number` column + `"TWUS"` in the `system` column

**Support-portal parsing logic:**

```
prefix = order_number.split("-")[0].upper()
```

Then map `prefix` to the brand team using the table in §1.1.

---

## 6. Authoritative Brand → Region → Currency → Routing Table

| Brand Code | Full Name | Primary Market | Default Currency | Order Prefix | Team / Channel | Notes |
|---|---|---|---|---|---|---|
| `TWUS` | TravelWifi US | USA | USD | `TWUS-*` | TW Direct (US) | Largest volume; most edge cases. |
| `TWEU` | TravelWifi Europe | EU | EUR (often USD) | `TWEU-*` | TW Direct (EU) | Second largest volume. |
| `TWCL` | TravelWifi Chile | Chile | CLP or USD | `TWCL-*` | TW Direct (LATAM) | |
| `TWCH` | TravelWifi Switzerland | Switzerland | CHF / EUR | `TWCH-*` | TW Direct (EU) | |
| `TWSG` | TravelWifi Singapore | Singapore | SGD / USD | `TWSG-*` | TW Direct (APAC) | |
| `TWFR` | TravelWifi France | France | EUR | `TWFR-*` | TW Direct (EU) | |
| `TWID` | TravelWifi Indonesia | Indonesia | USD | `TWID-*` | TW Direct (APAC) | |
| `TWLOCAL` | TravelWifi Local | Multi | USD | `TWLOCAL-*` | TW Direct | |
| `NVUS` | Navimo US | USA | USD | `NVUS-*` | Partners (Navimo) | |
| `NVEU` | Navimo Europe | EU | EUR / USD | `NVEU-*` | Partners (Navimo) | |
| `NVCL` | Navimo Chile | Chile | USD (often) | `NVCL-*` | Partners (Navimo) | Confirmed USD in CSV sample. |
| `NVLOCAL` | Navimo Local | Multi | USD | `NVLOCAL-*` | Partners (Navimo) | |
| `CMRPUNTOSCL` | CMR Puntos Chile | Chile | CLP | `CMR-*` / `CMRPUNTOSCL-*` | Marketplace (CMR team) | **CMRPuntos coupons** — partner-billed monthly. |
| `FBLLCL` | FBLL Chile | Chile | CLP | `FBLLCL-*` | Marketplace | |
| `DSPCL` | DSP Chile | Chile | CLP | `DSPCL-*` | Marketplace | |
| `BC` | Business Channel | Multi | USD | `BC-*` | Partners (B2B legacy) | |
| `B2B` | B2B | Multi | USD | `B2B-*` | Partners (B2B) | |
| `B2C` | B2C partner | Multi | USD | `B2C-*` | Partners (B2C) | |
| `QRO` | QRO Mexico | Mexico | MXN / USD | `QRO-*` | Partners (LATAM) | |

---

## 7. Support Routing Decision Tree

```
Ticket arrives
     │
     ▼
Extract order_number prefix (everything before the first "-")
     │
     ├── starts with "TW"  ──►  TravelWifi team
     │        │
     │        ├── TWUS / TWEU  ──► Main TW support (English)
     │        ├── TWCL / TWCHL ──► LATAM team (Spanish)
     │        ├── TWFR         ──► EU team (French)
     │        ├── TWCH         ──► EU team (German/French/Italian)
     │        └── TWSG / TWID  ──► APAC team
     │
     ├── starts with "NV"  ──►  Navimo/Nomad partner team
     │        │
     │        └── NVCL        ──► LATAM Navimo team (Spanish)
     │
     ├── starts with "CMR" (or system=CMRPUNTOS*)  ──►  CMR Chile desk
     │        │
     │        ├── Check coupons[] — CMRPuntos fixed-CLP?
     │        ├── Currency = CLP (probably)
     │        ├── DO NOT refund based on total=0 — partner pays monthly
     │        └── Escalate billing disputes to CMR partner manager
     │
     ├── starts with "FBLLCL" / "DSPCL"  ──►  Marketplace Chile desk
     │
     ├── starts with "BC" / "B2B" / "B2C" / "QRO"  ──►  B2B / Partners desk
     │
     └── unknown prefix  ──►  Escalate to engineering (possible new brand)
```

### 7.1 Always-check-first checklist

Before touching any ticket:

1. [ ] Read `system` and `order_number` — confirm they agree
2. [ ] Read `currency_iso` — is it USD or local?
3. [ ] Compute `total_usd = total / order_usd_rate_exchange` (if not already done)
4. [ ] Check `coupons[]` — if populated, classify:
   - Starts with CMRPUNTOS system? → **CMRPuntos, partner-billed**
   - `total == 0` with coupon? → **Full comp**
   - Otherwise → **TW/NV percentage**
5. [ ] Read `sales_chanel` — does it match the expected pattern for the brand?
6. [ ] Only then answer the customer

---

## 8. Known Data-Quality Issues by Brand

| Brand | Issue | Source |
|---|---|---|
| **All brands (pre-March-2026)** | No `coupons[]` field in OpenSearch. Cannot audit discount history from OS. | `docs/support-portal/01-opensearch.md:247`, `.claude/memory/coupon_system.md` |
| **All brands** | `sales_chanel` is misspelled in the index and cannot be fixed without reindexing. Always query `sales_chanel.keyword`. | `docs/technical/opensearch_index_guide.md:180` |
| **All brands** | Some orders have `order_usd_rate_exchange = 0` or missing → code falls back to rate 1, producing inflated USD numbers for non-USD orders. | `api/services/invoice_order_service.py:242-244` |
| **TWUS** | Largest volume → most legacy edge cases (bundle orders, multi-eSIM, hardware rentals). | `cache/rds_schema_discovery.json:27` |
| **TWUS / TWEU** | ~0.9% of eSIM orders are topups that don't match the normal ICCID→order pattern (comment at `api/services/invoice_order_service.py:136`). | `invoice_order_service.py:136` |
| **Hardware bundle orders (any TW brand)** | `total` includes device price, not just eSIM. Code zeros out `price_usd` and falls back to catalog price. Customers may see confusing line-item math. | `api/services/invoice_order_service.py:246-249` |
| **Multi-eSIM bundle orders** | `total` is divided across eSIM count — per-eSIM price is an average, not exact. For mixed-SKU bundles, code uses catalog fallback. | `api/services/invoice_order_service.py:251-262` |
| **CMRPUNTOSCL** | `total` field is in CLP, not USD. Do **not** display it as USD. Use `catalog_price` or converted `total_usd`. | `api/services/coupon_utils.py:5-7` |
| **CMRPUNTOSCL** | Historical gap: CMR partner billing was reconciled manually before March 2026. Cross-check with the CMR partner manager for disputes on old orders. | `.claude/memory/coupon_system.md` (referenced) |
| **NVCL** | CSV sample shows all orders as `USD` with rate `1.000000` — yet the customers are Chilean. Navimo Chile bills in USD despite serving CLP-native users. Confusing when customers reference CLP amounts. | `Report from 2026-03-01 To 2026-03-24.csv` lines 3, 5, 15 |
| **Rental bundles (all TW brands)** | Device + eSIM bundle orders require both DHI device SKU and a tier plan. Missing one side is a known data-quality issue. | `CLAUDE.md` Product Types section |

---

## 9. Head-of-Support Aggregation Queries

These are the three questions the head of support will ask weekly. Here's how to answer each directly from OpenSearch.

### 9.1 "How many orders did brand X do last month, and what was revenue in USD?"

```python
query = {
    "query": {
        "bool": {
            "filter": [
                {"term": {"system.keyword": "TWUS"}},
                {"range": {"created_at": {"gte": "now-1M/M", "lt": "now/M"}}},
                {"term": {"status.keyword": "Completed"}},
            ]
        }
    },
    "aggs": {
        "revenue_local": {"sum": {"field": "total"}},
        "order_count": {"value_count": {"field": "order_number.keyword"}},
    }
}
# Then in post-processing, convert to USD per-order using
# total_usd = total / order_usd_rate_exchange  (per hit, not on the sum!)
```

> **Critical:** Never `SUM(total)` across mixed currencies. You must convert each order individually because `order_usd_rate_exchange` varies per order.
> Reference implementation: `api/services/invoice_order_service.py:237-244`.

### 9.2 "Break down last month's revenue by brand and channel category"

```python
aggs = {
    "by_system": {
        "terms": {"field": "system.keyword", "size": 30},
        "aggs": {
            "by_channel": {
                "terms": {"field": "sales_chanel.keyword", "size": 10}
            }
        }
    }
}
```

Then roll `system` values up into TW Direct / Partners / Marketplace using the mapping in `api/services/order_performance_service.py:59-60`.

### 9.3 "Which orders last month had CMRPuntos coupons, and what does CMR owe us?"

Use the dedicated endpoint instead of hand-rolling:

**Endpoint:** `POST /api/dashboard/cmrpuntos-billing` (see `api/routes/dashboard.py:620-665`)
**Service:** `api/services/cmrpuntos_billing.py` — `generate_cmrpuntos_billing_report()`

It pulls all orders where `system` starts with `CMRPUNTOS` in the target month, looks up catalog prices per SKU, and produces a ready-to-invoice reconciliation.

### 9.4 "Which countries did brand X sell to last month?"

Add a `terms` aggregation on `destination` (or `destination.keyword`) nested under the `system` filter. Example skeleton is in `docs/guides/OPENSEARCH_CHEATSHEET.md:234`.

---

## 10. Quick-Reference Glossary

| Term | Meaning |
|---|---|
| **Brand / System** | A storefront operated by us. Identified by the OS `system` field. 20+ values exist; `TWUS` and `TWEU` dominate. |
| **`sales_chanel`** | HOW the order was placed (web, mail, digital, POS). Misspelled on purpose — never use `sales_channel` when querying OS. |
| **`currency_iso`** | ISO-4217 currency code of the `total` field. Not every order is USD. |
| **`order_usd_rate_exchange`** | Local currency units per 1 USD at order time. `total_usd = total / order_usd_rate_exchange`. |
| **CMRPuntos** | Chilean partner-billed coupon system. Customer pays little or nothing; CMR reimburses TravelWifi monthly. Identified by `system` starting with `CMRPUNTOS`. |
| **TW/NV percentage coupon** | Standard marketing discount. Customer pays the discounted amount; real revenue loss. Registry in `coupon_utils.py:20-33`. |
| **Full comp** | Coupon + `total == 0` + not CMRPuntos → zero revenue, fully comped. |
| **Coupon gap** | Pre-March-2026 orders do not carry `coupons[]` in OpenSearch. Historical coupon data must come from RDS or source systems. |
| **TW Direct / Partners / Marketplace** | Three rollup buckets for dashboard reporting. See `order_performance_service.py:59-60`. |
| **Suspected coupon** | Invoice matcher flag (`price_source = "coupon_suspected"`) for orders with `price_usd < $1.00` and no explicit coupon field. |

---

## 11. Further Reading

- `docs/support-portal/01-opensearch.md` — OpenSearch field-by-field reference (sibling document)
- `docs/support-portal/02-products.md` — Product catalog and SKU rules
- `docs/support-portal/04-tellisim-api.md` — TelliSIM API reference
- `docs/technical/opensearch_index_guide.md` — full index schema
- `docs/guides/OPENSEARCH_CHEATSHEET.md` — example queries
- `api/services/coupon_utils.py` — coupon classification (read this before touching any coupon logic)
- `api/services/coupon_revenue.py` — effective-revenue calculator
- `api/services/cmrpuntos_billing.py` — monthly partner reconciliation
- `api/services/invoice_order_service.py` — canonical currency-conversion reference
- `.claude/memory/coupon_system.md` — historical context on the coupon-field OS gap
- `.claude/memory/revenue_dilution_finding.md` — why low USD amounts are often CMRPuntos, not erosion

---

*Last updated: 2026-04-08. When in doubt, grep the codebase — all claims in this document are traceable to file paths cited inline.*
