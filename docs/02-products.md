# Product Catalog & SKU Reference (Support Portal)

> **Audience:** Customer support representatives.
> **Purpose:** Given an order, know instantly what product it is, whether the SKU is valid, whether it's a new purchase or top-up, and whether the price/consumption looks normal.
> **Evidence base:** `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md`, `CLAUDE.md`, `api/services/invoice_validation_service.py`, `config/plan_settings.yaml`.

---

## 1. The Three Product Types At A Glance

TravelWifi sells exactly **three** product types. Every order is one of these — there are no others.

| Product | Who buys it | Physical device? | Data model | Primary SKU shape |
|---|---|---|---|---|
| **eSIM** | Traveler with an eSIM-capable phone | No (digital, QR code) | TOTAL_DATA | `US_10GB_30D` |
| **Rental** | Traveler renting a Sapphire hotspot | Yes (we ship device) | DAILY_DATA | `S2GLOCALMERENT` + `DHI_*_Escape` |
| **Sapphire Data** | Customer who **already owns** a Sapphire device | Yes (already owned) | TOTAL_DATA | `DHI_PL_FLOW30GB15DAYS` |

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 28–41.

### Order volume (Jan 2026 reference)

| Product | Orders | Share |
|---|---|---|
| eSIM | ~72,000 | 29% |
| Rental | ~82,000 | 33% |
| Sapphire Data | ~95,000 | 38% |

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 34–40.

---

## 2. Data Models — What "TOTAL_DATA" vs "DAILY_DATA" Means

This is the single most important concept to explain to a customer when they ask "why did my plan stop working?"

### TOTAL_DATA (eSIM + Sapphire Data)

- Customer buys **X GB, good for Y days**.
- They can burn the entire pool on day 1 if they want.
- **Plan ends** the moment **either** the GB pool is empty **or** the validity expires — whichever comes first.
- **No throttling.** When the data runs out, the plan is dead. Customer must buy a top-up.

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 46–67.

**Support talking point:** If a customer on a 10GB/30D eSIM says "my internet stopped working on day 3" — check CDR consumption. If they burned 10GB in 3 days, the plan is simply exhausted. That is **normal behavior**, not a defect.

### DAILY_DATA (Rental only)

- Customer rents a device for X days and picks a tier (Adventure / Escape / Voyage / Unlimited).
- Each tier has a **daily allowance** that resets **at midnight local time**.
- If they exceed the daily allowance, **FUP (Fair Usage Policy)** kicks in: speed is **reduced**, but data **continues**. At midnight they get full speed again.
- **Plan ends** when the rental end date is reached.

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 69–97.

**Support talking point:** If a rental customer says "my speed is slow this afternoon" — they most likely burned through their daily allowance. Tell them "it will reset at midnight." Do **not** refund unless it's a Voyage/Unlimited customer (those are priced to prevent this).

### Side-by-side summary

| Aspect | TOTAL_DATA | DAILY_DATA |
|---|---|---|
| Pool | Fixed total (e.g., 10GB) | Daily allowance × rental days |
| Resets | Never | Every midnight |
| FUP | **No** — plan dies when data gone | **Yes** — speed reduced, data continues |
| Used by | eSIM, Sapphire Data | Rental only |

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 99–107.

---

## 3. Complete SKU Grammar

### 3.1 eSIM SKUs

**Local eSIM** — single country:
```
{COUNTRY_ISO2}_{GB}GB_{DAYS}D
```
Examples: `US_10GB_30D`, `JP_5GB_15D`, `FR_20GB_30D`, `TH_1GB_7D`.

**Local eSIM — Unlimited variant:**
```
{COUNTRY_ISO2}_{DAYS}D_Unlimited
```
Example: `ES_7D_Unlimited`.

**Regional eSIM:**
```
{Region}_{TIER}_{GB}GB_{DAYS}D
```
Example: `Europe_LITE_10GB_30D`.

Tiers (all regional/global plans):

| Tier | Coverage |
|---|---|
| `LITE` | Cheapest 25% of countries in the region |
| `STANDARD` | Cheapest 60% of countries in the region |
| `PLUS` | All 100% of countries in the region |

Source: `CLAUDE.md` "Regional Tier Distribution".

Common regions seen in SKUs: `Europe`, `Asia`, `LATAM`, `Africa`, `MiddleEast`, `NorthAmerica`, `Caribbean`, `Oceania`. Authoritative list lives in `config/plan_settings.yaml`.

**Global eSIM:**
```
GLOBAL_{TIER}_{GB}GB_{DAYS}D
```
Example: `GLOBAL_PLUS_20GB_30D`.

Source: `CLAUDE.md` "SKU Formats" and `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 119–124.

### 3.2 Rental SKUs (always come in a pair)

Every valid rental order has **TWO** SKUs — a device SKU **and** a data tier plan SKU. One without the other is an invalid rental order.

**Device SKUs:**

| SKU | Notes |
|---|---|
| `S2GLOCALMERENT` | Main rental device (99% of rentals) |
| `S2GLOCALMEBLACKMATTE` | Color variant |
| `S2GLOCALMEBLACKGLOSSY` | Color variant |
| `S2GLOCALMEGREEN` | Color variant |
| `S2GLOCALMEMAGENTA` | Color variant |
| `S2GLOCALMEBLUE` | Color variant |

All device SKUs start with `S2G`.

**Data tier plan SKUs:**
```
DHI_{COUNTRY_OR_REGION}_DP{GB}GB_{TIER}
DHI_{COUNTRY}_DPUNLIMITED
DHI_{COUNTRY}_DPUNLIMITED{DAYS}DAYS
```
Examples: `DHI_Europe_DP5GB_Adventure`, `DHI_FR_DP10GB_Escape`, `DHI_US_DP10GB_Voyage`, `DHI_PL_DPUNLIMITED`, `DHI_KW_DPUNLIMITED30DAYS`.

**Tier → daily allowance:**

| Tier | Daily allowance | 10-day total |
|---|---|---|
| Adventure | smallest | ~20–30 GB |
| **Escape** | **5 GB/day** | 50 GB |
| Voyage | larger | ~100 GB |
| Unlimited | no cap, no FUP | unlimited |

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 178–211.

### 3.3 Sapphire Data (FLOW) SKUs — for device OWNERS

```
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS_{DATE}
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS{VERSION}_{DATE}
```
Examples: `DHI_PL_FLOW30GB15DAYS`, `DHI_PL_FLOW75GB30DAYS`, `DHI_US_FLOW2GB7DAYS2_20220101`.

**Key identifiers:** starts with `DHI_` AND contains `FLOW`. Does **NOT** contain Adventure/Escape/Voyage/Unlimited.

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 257–277.

### 3.4 BANNED / LEGACY FORMATS — never accept these

| Bad pattern | Why it's wrong | What to do |
|---|---|---|
| `ESIM-XX-XGB-XXX` | Historical format, never used in current catalog | Treat as invalid; escalate |
| `5GB` (no country, no days) | Partial — missing country and validity | Invalid |
| `[3, 5, 10]` (integers, not strings) | Data entry bug | Invalid |
| `applies_to: "all"` (in a promo) | Promos must list full SKUs, never "all" | Invalid promo |

Source: `CLAUDE.md` "SKU Formats (Enforce Always)" and "Promo SKU Rule".

---

## 4. How to Identify Product Type from an Order

When you open an OpenSearch `orders` document, do this in order:

```
STEP 1. Look at order_details_data[].package_sku
STEP 2. Also look at product_sku[] (cross-check)
STEP 3. Apply the decision tree below
```

### Decision tree

```
START: read package_sku
  │
  ├─ Starts with "S2G" ────────────────────────► RENTAL DEVICE
  │                                               (must be paired with a DHI_*_{tier} plan)
  │
  ├─ Starts with "DHI_"?
  │    │
  │    ├─ Contains "Adventure" / "Escape" /
  │    │  "Voyage" / "UNLIMITED" ──────────────► RENTAL DATA PLAN
  │    │
  │    └─ Contains "FLOW" ─────────────────────► SAPPHIRE DATA (FLOW, device owner)
  │
  └─ Matches {ISO2}_{GB}GB_{DAYS}D
     or {Region}_{TIER}_{GB}GB_{DAYS}D
     or GLOBAL_{TIER}_{GB}GB_{DAYS}D ──────────► eSIM
```

Source: `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 329–368.

### Cross-validation via `product_sku[]`

If `product_sku` contains one of these, you know it's an eSIM even if the `package_sku` looks odd:

| `product_sku` value | Meaning |
|---|---|
| `TW_eSIM` | Generic TravelWifi eSIM |
| `TW_eSIM_VFNL` | Vodafone network eSIM |
| `TW_eSIM_MANX` | MANX network eSIM |

**Discontinued (ignore / flag):** `TW_FLEX_ESIM_MANX`, `Global_eSIMCard`. See `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 131–134.

### Quick recognition cheat sheet

| If SKU contains… | It's a… |
|---|---|
| `FLOW` | Sapphire Data (device owner) |
| `_Adventure` / `_Escape` / `_Voyage` / `UNLIMITED` | Rental data plan |
| `S2G` prefix | Rental device |
| 2-letter country code + `_XGB_XD` | eSIM (local) |
| `Europe_` / `Asia_` / `GLOBAL_` + `_LITE/STANDARD/PLUS_` | Regional or Global eSIM |

---

## 5. New Purchase vs Top-Up vs Bundle

### 5.1 New purchase
A brand-new ICCID appears on this order. No prior orders reference that ICCID.

### 5.2 Top-up (refill on existing eSIM)
The ICCID on this order was already sold on a **prior, non-cancelled, non-refunded** order. The customer is extending or adding data to an eSIM they already own.

### 5.3 Bundle (multi-eSIM single order)
One order contains **multiple** ICCIDs, and each ICCID can have a **different** `package_sku`. Support must map each ICCID to its specific SKU, not assume one SKU for the whole order.

Source: `api/services/invoice_validation_service.py` — commit `f11bbcf fix(invoice-matcher): per-ICCID package mapping for multi-eSIM bundles` (git log).

### 5.4 How the invoice validator detects top-ups

Logic lives in `api/services/invoice_validation_service.py` (topup-aware over-allocation check, lines ~2294–2370 and the allocation ledger it feeds). In plain terms:

1. The validator builds an **allocation ledger** per ICCID: every order that ever sold that ICCID a package, in chronological order.
2. If the same ICCID shows up on more than one non-cancelled, non-refunded order, **the later one is a top-up**.
3. Cancelled/refunded orders are **subtracted** from the over-allocation math (commit `8429582 fix(invoice-validator): subtract cancelled-order consumption from over-allocation`).

### 5.5 What the ledger looks like in evidence JSON

When you open a discrepancy's `evidence` block for a top-up case, you'll see something like:

```json
{
  "iccid": "89...",
  "allocation_ledger": [
    {"order_id": "A-1001", "package_sku": "FR_5GB_30D",  "status": "completed", "gb": 5,  "date": "2026-03-01"},
    {"order_id": "A-1440", "package_sku": "FR_10GB_30D", "status": "completed", "gb": 10, "date": "2026-03-18", "is_topup": true}
  ],
  "total_allocated_gb": 15,
  "total_consumed_gb": 12.3
}
```

The `is_topup: true` flag on the second entry is the support-facing signal: **this is a refill, not a new purchase**.

---

## 6. Pricing Rules Every Support Rep Should Know

These are the rules the pricing engine enforces. If an order's price violates any of these, it is **not normal** — escalate.

### 6.1 GP floor — 56%

Every SKU must clear a **56% gross profit margin** at the price we charge. If an order is selling at less than 56% GP, it's either a promo or a bug.

- Formula: `min_price = actual_cost / (1 - 0.56)`
- **Loss cases (negative GP) are always fraud or vendor issues, never normal pricing.**

Source: `CLAUDE.md` "GP Floor (56%)" and `config/spi_promo_engine.yaml` → `gp_floor_protection.global_default: 0.56`.

### 6.2 Seasonal multipliers

| Season | Months | Multiplier | Price ending |
|---|---|---|---|
| **Peak** | May, Jun, Jul, Aug | ×1.25 | `.99` |
| **High** | Apr, Sep, Oct | ×1.10 | `.99` |
| **Shoulder** | Mar, Nov | ×1.00 | `.49` |
| **Low** | Jan, Feb, Dec | ×0.90 | `.49` |

Source: `CLAUDE.md` "Canonical Seasonal Definitions" and "Price Endings".

### 6.3 Price endings and minimum floors

| Season | Must end in | Minimum price |
|---|---|---|
| Low | `.49` | **$0.99** |
| Shoulder | `.49` | **$1.49** |
| High | `.99` | **$0.99** |
| Peak | `.99` | **$0.99** |

**Never accept $0.49 as a final price.** The floor is always $0.99 minimum.

### 6.4 Performance tracking codes (RL / PS / CT)

Every product in the Connect JSON carries three small integer codes that tell you how that price was set and how risky it is.

**RL — Risk Level** (stress GP if customer uses 100% of data)

| Value | Meaning | GP under stress |
|---|---|---|
| 0 | Low (safe) | ≥ 25% |
| 1 | Medium (watch) | 10–25% |
| 2 | High (near break-even) | 0–10% |
| 3 | Critical (loss at full use) | < 0% |

**PS — Pricing Strategy** (how the price was chosen)

| Value | Strategy |
|---|---|
| 0 | Shoulder (baseline) |
| 1 | 35% GP (conservative) |
| 2 | 50% GP (balanced) |
| 3 | 65% GP (aggressive) |
| 4 | Market (competitor-anchored, 10% undercut) |
| 5 | Auto (recommended) |

**CT — Country Tier** (demand rank)

| Value | Tier | Countries |
|---|---|---|
| 0 | Elite | Top 5 by demand |
| 1 | Prime | Ranks 6–15 |
| 2 | Core | Ranks 16–30 |
| 3 | Growth | Ranks 31–60 |
| 4 | Niche | Ranks 61+ |

Source: `CLAUDE.md` "Performance Tracking Codes" and `CLAUDE.md` "Connect JSON".

### 6.5 Valid discount percentages

Only **10%, 15%, 20%, 25%** are valid promo discounts. Anything else (0%, 5%, 7%, 30%) is either a bug or an unauthorized manual override.

Source: `CLAUDE.md` "Valid Discounts".

---

## 7. Utilization Expectations — What's Normal vs Suspicious

Knowing what a "normal" customer burns helps you spot fraud. These are the **CDR-verified** utilization rates measured across 1,280 real orders, plus the conservative planning rates in `config/plan_settings.yaml`.

| Plan size | Conservative (planning) | CDR-verified (real) |
|---|---|---|
| 1 GB | 90% | ~57% |
| 3 GB | 70% | ~54% |
| 5 GB | 65% | ~43% |
| 10 GB | 55% | ~46% |
| 20 GB | 40% | ~32% |
| 50 GB | 30% | ~61% (anomaly — small sample) |

Source: `CLAUDE.md` "Utilization Rates (Dual System)" and `api/services/utilization_service.py`.

### Red flag: fraud signal

If a **cancelled or refunded** order consumed **>80% of its plan cap** before cancellation, it is almost certainly **friendly fraud**: the customer burned through the data then requested a refund. Flag these and do **not** issue the refund without escalation.

**Example:** `SA_20GB_30D` cancelled-refunded after the customer burned 20 GB in 9 days → friendly fraud.

### Not-a-red-flag: vendor throttle failure

If a **completed** order shows consumption **exceeding the plan cap** (e.g., `BG_20GB_30D` with 24 GB used), that is **not** the customer's fault — it means the vendor failed to enforce the data cap. Do not charge the customer; escalate to vendor operations.

---

## 8. Rental Validation Rule

A rental order is only valid if it has **BOTH**:

1. A **device SKU** (`S2GLOCALMERENT` or `S2G*` variant), **AND**
2. A **data plan SKU** (`DHI_*` with `_Adventure` / `_Escape` / `_Voyage` / `UNLIMITED`).

One without the other is **invalid** — escalate to ops.

**Escape tier quick reference:** 5 GB/day at full speed, resets at midnight, FUP (speed reduced) if exceeded during the day.

Source: `CLAUDE.md` "Rental validation" and `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` lines 213–232.

---

## 9. Worked Examples

### Example 1 — Simple local eSIM new purchase

```
order_id:          A-7781
product_sku:       ["TW_eSIM"]
package_sku:       "US_10GB_30D"
iccid:             89014103211118510720
total_usd:         27.99
order_date:        2026-06-15 (June → peak season)
```

**Read:**
- `TW_eSIM` → **eSIM** product type.
- `US_10GB_30D` → Local eSIM, 10 GB for USA, valid 30 days.
- TOTAL_DATA model: 10 GB pool, dies when gone or at day 30.
- June = peak season → expect price ending in `.99` and ×1.25 multiplier. `$27.99` ends in `.99` ✓.
- ICCID not seen before → **new purchase**.

**Support answer if customer says "my data stopped working":** check CDR — if they burned 10 GB, the plan is exhausted. Offer a top-up.

---

### Example 2 — eSIM top-up

```
order_id:          A-7920
package_sku:       "US_5GB_30D"
iccid:             89014103211118510720   ← same as Example 1
status:            completed
```

**Read:**
- Same ICCID as order A-7781, which was `completed` (not cancelled/refunded).
- Per the allocation ledger, **this is a top-up**, not a new purchase.
- Customer is adding 5 GB to the same US eSIM they bought before.
- The invoice validator will map this ICCID's over-allocation check using both orders summed.

---

### Example 3 — Rental bundle (device + tier plan)

```
order_id:          A-8033
product_sku:       ["TW_Rental"]
package_sku[0]:    "S2GLOCALMERENT"              ← device
package_sku[1]:    "DHI_Europe_DP5GB_Escape"     ← data plan
rental_days:       10
total_usd:         189.99
```

**Read:**
- `S2GLOCALMERENT` → **Rental device**.
- `DHI_Europe_DP5GB_Escape` → Escape tier, Europe, 5 GB/day.
- DAILY_DATA model: 5 GB/day × 10 days = 50 GB total potential. Resets at midnight. FUP if exceeded.
- Both SKUs present → **valid rental** ✓.

**Support answer if customer says "my speed got slow at 6 PM":** they hit the 5 GB daily cap. FUP is active. Speed will restore at midnight. No refund — this is by design for Escape tier.

---

### Example 4 — Sapphire Data (FLOW) for an existing device owner

```
order_id:          A-8155
product_sku:       ["TW_Sapphire"]
package_sku:       "DHI_PL_FLOW30GB15DAYS"
total_usd:         44.99
```

**Read:**
- `DHI_*` + `FLOW` → **Sapphire Data** (device owner, NOT a rental).
- Poland, 30 GB, 15 days.
- TOTAL_DATA model: same behavior as eSIM — dies when 30 GB gone or at day 15.
- No `S2G` device SKU → customer already owns the device. Correct.

**Common confusion:** a new rep might see `DHI_` and assume it's a rental. The `FLOW` keyword is the tell — FLOW = owner, Adventure/Escape/Voyage/Unlimited = renter.

---

### Example 5 — Multi-eSIM bundle with different SKUs per ICCID

```
order_id:          A-8299
product_sku:       ["TW_eSIM"]
order_details_data:
  - iccid: 8901...AAA, package_sku: "FR_5GB_15D"
  - iccid: 8901...BBB, package_sku: "DE_10GB_30D"
  - iccid: 8901...CCC, package_sku: "ES_3GB_7D"
total_usd:         68.97
```

**Read:**
- Three separate eSIMs, **three different SKUs**, one order.
- Do **NOT** assume the whole order is one product. Each ICCID has its own package.
- The invoice validator's per-ICCID package mapping (commit `f11bbcf`) ensures CDR usage for `AAA` is judged against FR_5GB_15D, not against the other two.

**Support rule:** when investigating a complaint about "my plan", always ask which ICCID/phone the customer is referring to — one order can cover three devices.

---

### Example 6 — Suspicious refund request

```
order_id:          A-8444
package_sku:       "SA_20GB_30D"
status:            cancelled → refund_requested
days_active:       9
cdr_consumed_gb:   20.1
```

**Read:**
- Customer used **100%+** of their 20 GB plan in 9 days…
- …then requested a refund.
- Conservative utilization for 20 GB = ~40%; CDR-verified = ~32%. This is **2.5× normal**.
- **Friendly fraud signal.** Do not process the refund without escalation.

---

## 10. Reference Links

| What | Where |
|---|---|
| Canonical product types & data models | `docs/technical/PRODUCT_TYPES_AND_DATA_MODELS.md` |
| GP floor, seasonal multipliers, price endings | `CLAUDE.md` §"Non-Negotiable Business Rules" |
| Performance tracking codes (RL/PS/CT) | `CLAUDE.md` §"Connect JSON" |
| Utilization rates | `config/plan_settings.yaml`, `api/services/utilization_service.py` |
| Top-up / allocation ledger logic | `api/services/invoice_validation_service.py` ~lines 2294–2370 |
| Per-ICCID package mapping (bundles) | Commit `f11bbcf` in git history |
| GP floor config | `config/spi_promo_engine.yaml` → `gp_floor_protection.global_default` |
| Discount rules | `config/discount_rules.json` |
