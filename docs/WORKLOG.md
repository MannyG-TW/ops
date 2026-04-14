# Smart Pricing - Work Log & Task Tracker

**Last Updated**: 2025-12-04 (OpenSearch vs RDS Data Gap Analysis)
**Purpose**: Track completed work, pending tasks, and next steps for organized development.

---

## Session: Dec 4, 2025 - OpenSearch vs RDS Data Gap Analysis

### What Was Done

#### 1. Comprehensive Field Comparison Across All 3 Order Types

Compared OpenSearch order data against RDS `orders` and `order_details` tables for all product types:

| Order Type | Order Tested | Status |
|------------|--------------|--------|
| eSIM | TWUS-66113 | ✅ Compared |
| Rental | TWUS-65658 | ✅ Compared |
| Sapphire Data | TWUS-70521 | ✅ Compared |

#### 2. Key Technical Findings

**Order Number Format Mismatch:**
- OpenSearch: `"TWUS-65658"` (full string with prefix)
- RDS: `65658` in `number` column + `"TWUS"` in `system` column
- **Fix**: Parse with `order_num.split('-')[-1]` and match `system` column

**Reserved Word Issue:**
- `system` is a MySQL reserved word
- **Fix**: Use backticks: `` SELECT `system` FROM orders ``

#### 3. Missing Fields Summary

##### ORDER LEVEL (orders table)

| Field | Description | Use Case |
|-------|-------------|----------|
| `coupon_id` | Foreign key to coupons table | Promo tracking |
| `coupon_code` | The actual code used | Promo analytics |
| `factor_type` | percentage/amount/promotion | Discount type analysis |
| `factor_value` | Discount value applied | Revenue impact |
| `shipping_total` | **What customer paid for shipping** | Revenue analysis |

##### ORDER_DETAILS LEVEL (order_details table)

| Field | Description | Use Case |
|-------|-------------|----------|
| `price` | Line item price | Per-item pricing analysis |
| `discount` | Line item discount amount | Item-level promo impact |
| `status` | Line item status | Fulfillment tracking |
| `status_code` | Status code (e.g., "200") | Status categorization |
| `shipping_cost` | **Our actual shipping cost** | GP% calculation |
| `shipping_details` | JSON with carrier/tracking | Shipping provider analysis |
| `from_recommendation` | Boolean | Recommendation engine ROI |
| `coupon_id` | Line-level coupon | Per-item promo tracking |
| `external_id` | External system reference | Integration tracking |

##### RENTAL-SPECIFIC (package_data JSON)

| Field | Description | Use Case |
|-------|-------------|----------|
| `unit_price` | Price per unit | Package pricing analysis |
| `duration` | Duration in days | Trip length analysis |
| `flow_size` | Data amount (e.g., "1 GB") | Data plan breakdown |
| `package_type` | Package category | Product categorization |
| `destination` | Country destination | Geo analysis |

##### RENTAL-SPECIFIC (return_data JSON)

| Field | Description | Use Case |
|-------|-------------|----------|
| `return_type` | How device returned | Return logistics |

##### DEVICE/eSIM LINKAGE (order_detail_serials)

| Field | Description | Use Case |
|-------|-------------|----------|
| `businesses_has_device_id` | Links to device/eSIM assignment | Utilization tracking |
| eSIM fields: `IMSI`, `MSISDN`, `ICCID` | eSIM identifiers | CDR correlation |

#### 4. Shipping Cost Analysis (Two Components)

| Field | Table | Meaning | Current in OpenSearch |
|-------|-------|---------|----------------------|
| `shipping_total` | orders | Customer pays | ❌ MISSING |
| `shipping_cost` | order_details | Our actual cost | ❌ MISSING |
| `shipping_details` | order_details | Carrier/tracking JSON | ❌ MISSING |

**GP% Impact**: Missing shipping cost means we can't calculate true GP% for shipped orders (Rental, Sapphire Data).

#### 5. Decision Required

Two approaches to fill the data gap:

| Approach | Pros | Cons |
|----------|------|------|
| **Update OpenSearch Sync** | One-time fix, all data in one place | Requires pipeline changes |
| **Query RDS On-Demand** | Immediate access, always current | Slower queries, two data sources |

### Files Updated

| File | Change |
|------|--------|
| `WORKLOG.md` | Added this session |

### Next Steps

1. **Decision Point**: Choose sync approach (OpenSearch update vs RDS on-demand)
2. If OpenSearch update: Identify the sync pipeline and add missing fields
3. If RDS on-demand: Create utility functions in `opensearch_data_manager.py` to enrich orders

---

## Session: Dec 3, 2025 (Night) - Bundle Utilization Investigation

### What Was Done

#### 1. Provider Pricing Structure Documented

Investigated the `provider_pricings` table structure:

| Field | Description |
|-------|-------------|
| `esim_providers_id` | 1=MANX (5,086 records), 2=VFNL (6,049 records) |
| `countries_id` | Links to countries table |
| `raw_cost` | Cost per unit (decimal 12,8 precision) |
| `raw_flow_size` | Unit type: MB, GB, KB |
| `payment_type` | `pay_as_you_go` |
| `price_sheet_key` | Version identifier |

**Key Findings:**
- **Price Sheets**: `DHI_DEFAULT` (base) + monthly sheets like `115 DHI GROUP LIMITED 2025-02-01`
- **Multiple rates per country**: Different networks = different costs (e.g., NZ has 4 rates: £0.001-0.021/MB)
- **Currency**: GBP for MANX provider

#### 2. Bundle Utilization Analysis (IMEI 869680026962802)

Completed full investigation of device bundle period:

| Metric | Value |
|--------|-------|
| **Bundle Period** | Oct 17, 2024 → Nov 21, 2025 (13 months) |
| **Total Rentals** | **1 order only** |
| **Order Number** | TWUS-101268 |
| **Order Total** | $237.59 |
| **Destination** | New Zealand |
| **Trip Dates** | Dec 9-31, 2024 (22 days) |
| **Data Allowance** | 22 GB (1GB/day × 22 days) |
| **Data Consumed** | 9.33 GB (42% utilization) |
| **CDR Sessions** | 76 records |

**Business Insight**: Device was bundled with eSIM for 13 months but only generated revenue from 1 rental. This represents a potential inventory optimization opportunity - identifying underutilized bundled devices.

#### 3. CDR Data Consumption Analysis

Queried OpenSearch CDR indices for consumption data:

**Indices Used:**
- `esim-archive-cdr_2024-12`

**Query Method:**
```python
# Search by IMSI (from eSIM record)
{"term": {"imsi": "234588564110732"}}
```

**Results:**
- 76 CDR sessions found
- Total: 9,556.06 MB (9.33 GB)
- All usage in New Zealand
- Usage period: Dec 10-31, 2024

#### 4. Rental Business Model Clarified

**Key Understanding from User:**
- Rentals use **XGB per day** model (not total GB)
- Daily cap = max speed, then throttled to 256 kbps
- Data still counts after throttling
- Order tracking: by IMEI
- Data tracking: by ICCID/IMSI in CDR

#### 5. Documentation Updated

| File | Changes |
|------|---------|
| `cache/rds_schema_discovery.json` | Added provider_pricings_structure, cdr_data_tracking, rental_business_model, bundle_utilization_investigation |
| `MAP_FLOW.md` | Added Provider Pricing, CDR Data Tracking, Rental Business Model sections |
| `WORKLOG.md` | Added this session |

#### 6. User Tracking for Bundle Operations - NOT AVAILABLE

**Finding**: Bundle create/delete operations are **not tracked** in the database:
- `business_device_has_devices` table has no `created_by`/`deleted_by` columns
- `activity_log` table has no entries for bundle operations
- Only timestamp tracking available: `created_at`, `deleted_at`

---

## Session: Dec 3, 2025 (Evening) - RDS Database Discovery

### What Was Done

#### 1. AWS RDS Production Database Connected
**Host**: `dhi-ue1-rds-b2b-rd-p-003.cq5nv2yqkwlq.us-east-1.rds.amazonaws.com`
**Database**: `rental` (main B2B/Connect database)

Successfully connected and discovered the full database structure:

| Statistic | Value |
|-----------|-------|
| Total Tables | 200 |
| Orders | 255,468 |
| Order Details | 257,707 |
| Products | 8,293 |
| eSIM Packages | 5,368 |
| Customers | 84,047 |
| Coupons | 105 |
| Countries | 260 |
| Tenant Databases | 20+ |

#### 2. Order Volume by System Discovered
| System | Orders | Revenue USD | Description |
|--------|--------|-------------|-------------|
| **TWUS** | 138,337 | $161.3M | TravelWifi US |
| **TWEU** | 66,807 | $7.7M | TravelWifi EU |
| bc | 11,862 | $7.7M | Business Channel |
| TWSG | 5,527 | $5.5M | TravelWifi Singapore |
| QRO | 4,664 | $42.0M | QRO System |
| B2C | 1,556 | $17.5M | B2C Direct |
| B2B | 285 | $562K | B2B Channel |

#### 3. Key Tables Identified for Pricing Integration

**Pricing Tables:**
- `products` - Product catalog with SKUs (8,293 products)
- `product_prices` - Product prices by currency
- `current_product_price` - Current active prices
- `location_product_prices` - Location-specific pricing WITH COST
- `special_prices` - Time-bound special pricing
- `provider_pricings` - Wholesale costs per country ($/MB)

**eSIM Tables:**
- `esim_packages` - Package definitions (5,368 packages)
- `esim_package_has_countries` - Package country coverage
- `esim_providers` - Providers (MANX primary)

**Promo Tables:**
- `coupons` - Promo codes (factor_type: percentage/amount/promotion)
- `coupons_has_products` - Coupon product eligibility

#### 4. Wholesale Costs Discovered (provider_pricings)
Real-time wholesale costs in $/MB from `provider_pricings` table:

| Country | Cost/MB | Notes |
|---------|---------|-------|
| Cuba (CU) | $0.80 | Highest - excluded from regional |
| San Marino (SM) | $0.73 | |
| Libya (LY) | $0.43 | |
| Sierra Leone (SL) | $0.38 | |
| Monaco (MC) | $0.28 | |
| US (typical) | $0.0025 | Low cost |

**Insight**: Can replace static Excel price lists with live database queries!

#### 5. Multi-Tenant Architecture Discovered
White-label partners have separate databases:

| Tenant | System | Database |
|--------|--------|----------|
| CMR Puntos | CMRPUNTOS | tenant_5810 |
| TransVIP | TRANSVIP | tenant_5812 |
| TravelersWifi | WIFIO | tenant_5813 |
| Aerolineas Argentinas | AA | tenant_5817 |
| Fazaa (UAE) | FAZAA | tenant_5818 |
| TravelersWifi France | TVWFR | tenant_5819 |
| Wifivox Spain | TVWES | tenant_5820 |

Each tenant has 163 tables (subset of main rental DB structure).

#### 6. Files Created/Modified

| File | Change |
|------|--------|
| `config.yaml` | Added RDS connection settings |
| `cache/rds_schema_discovery.json` | Full schema documentation |

**Config.yaml Addition:**
```yaml
rds:
  host: dhi-ue1-rds-b2b-rd-p-003.cq5nv2yqkwlq.us-east-1.rds.amazonaws.com
  port: 3306
  username: manny
  password: <credentials in config.yaml>
  database: rental
```

#### 7. Integration Opportunities Identified

| Opportunity | Current | Future |
|-------------|---------|--------|
| Wholesale Costs | Static Excel files | Live from `provider_pricings` |
| Promo Codes | Manual creation | Sync to `coupons` table |
| Pricing Updates | Export JSON files | Direct to `product_prices` |
| Order Analytics | OpenSearch (cached) | Can also use RDS `orders` |

### Dependencies Added
```bash
pip install pymysql cryptography
```

### Schema Discovery Saved
Full schema documentation: `cache/rds_schema_discovery.json`

---

#### 8. Device Location Tracking Logic Discovered

**IMEI Lookup Example**: `869680026962802`

**Key Finding**: Device location is tracked via multiple tables, and the **RETURNED location always wins**.

**Table Chain for Current Location:**
```
devices (by IMEI)
  → businesses_has_devices (modelable_type='App\Models\Device', modelable_id=device.id)
    → businesses_has_devices_locations (businesses_has_devices_id)
      → locations (location_id)
```

**Location Status Logic:**
| Status | Meaning |
|--------|---------|
| `Returned` | Device is **currently AT** this location |
| `Ready` | Device was previously at this location |

**Important**: The `imeiSkuModel.warehouse` field shows the **CREATION** location (where device was first registered), NOT the current location.

**Example Device (IMEI 869680026962802):**
| Table | Location | Status |
|-------|----------|--------|
| `imeiSkuModel` | TravelWifi Chile Office | (creation record) |
| `businesses_has_devices_locations` | TravelWifi Chile Office | Ready |
| `businesses_has_devices_locations` | **Houston Warehouse** | **Returned** ✓ |

**Current Location**: Houston Warehouse (because status = 'Returned')

**SQL Query for Current Location:**
```sql
SELECT l.CompanyName, l.City, bhdl.status
FROM devices d
JOIN businesses_has_devices bhd
  ON bhd.modelable_type = 'App\\Models\\Device'
  AND bhd.modelable_id = d.id
JOIN businesses_has_devices_locations bhdl
  ON bhdl.businesses_has_devices_id = bhd.id
JOIN locations l ON l.id = bhdl.location_id
WHERE d.imei = '869680026962802'
ORDER BY CASE WHEN bhdl.status = 'Returned' THEN 0 ELSE 1 END;
```

#### 9. Bundle Association Investigation (Device + eSIM Pairing)

**Question**: For IMEI `869680026962802`, when was the eSIM bundled/unbundled? What ICCID? Which provider?

**Findings**:

| Field | Value |
|-------|-------|
| IMEI | 869680026962802 |
| Bundle ID | 3860 |
| **Bundled At** | 2024-10-17 17:22:32 |
| **Unbundled At** | 2025-11-21 17:05:43 (soft delete) |
| **ICCID** | 8944538532049511326 |
| **Provider** | **MANX** (not VFNL) |
| eSIM ID | 75526 |
| IMSI | 234588564110732 |
| MSISDN | 883200010135442 |

**What is a Bundle?** When a MiFi device (Sapphire) is paired with an eSIM for "Rental with Sapphire Data" products.

**Table Chain for Bundle Tracking:**
```
devices (IMEI)
  → businesses_has_devices (modelable_type='App\Models\Device')
    → business_device_has_devices (bundle link)
      → businesses_has_devices (modelable_type='App\Models\Esim')
        → esims (ICCID, provider)
```

**Key Tables:**
- `business_device_has_devices` - Bundle link table with soft delete (`deleted_at`)
- `esims` - eSIM inventory with ICCID, provider, status

**Soft Delete Logic:**
- `deleted_at = NULL` → Active bundle
- `deleted_at = timestamp` → Bundle removed on that date

---

## Session: Dec 3, 2025 (Earlier)

### What Was Done

#### 1. Smart Mass Approve Display Rework
**Issue**: Display was confusing with "PROMO" and "-0%" that made no sense.

**Before (Confusing)**:
```
│ Event          │ CC │ Action │ Change │ GP% │
│ Holy Week      │ PH │ PROMO  │      - │ 56% │
```

**After (Clear & Actionable)**:
```
│ Event          │ CC │ Strategy   │ Base    │ Promo   │ GP% │ Code     │ Tier           │
│ Holy Week      │ PH │ HOLD PRICE │ $25.99  │ $25.99  │ 56% │ -        │ Tier C: max 5% │
│ Colombia Spring│ CO │ ↓ -10%     │ $115.99 │ $104.99 │ 57% │ TBD      │ Tier B: max 15%│
│ Le Mans        │ FR │ ↓ -15%     │ $23.99  │ $20.99  │ 71% │ TBD      │ Tier A: max 25%│
```

**Key Improvements**:
- Strategy labels: `↓ -10%`, `↑ +5%`, `HOLD PRICE` (not confusing "PROMO")
- Actual prices: Base → Promo (real dollar amounts)
- Tier/Reason column: Explains WHY ("Tier A: max 25% off")
- Promo Code column: Shows code or "TBD" (generated on approval)

**Files Modified**: `grok_opportunity_manager.py:2679-2850`

#### 2. Grok AI Promo Code Generation
**Feature**: Auto-generate marketing promo codes when approving events.

**Format**: `XXXXXX26` (7-10 chars, ends with year 26)

**Prompt sent to Grok**:
```
Generate a marketing promo code for this travel event:
Event: Colombia Spring Tourism Season
Country: CO
City: Medellin

RULES:
1. Code must be 7–10 characters: UPPERCASE letters + 26
2. Must evoke destination, culture, or event vibe
3. Extremely catchy and social-media viral

Examples: SAKURA26, CARNAVAL26, BORA26, OKTOBER26
```

**Output saved to opportunity**:
```json
{
  "promo_code": "CUMBIA26",
  "promo_display_name": "Colombia Spring Fiesta",
  "promo_rationale": "Evokes Colombian dance and music culture",
  "promo_grok_generated": true
}
```

**Files Modified**: `grok_opportunity_manager.py:879-982`

#### 3. Retry Logic for Promo Generation
**Feature**: 3 retries with exponential backoff if Grok fails.

**Behavior**:
```
Generating promo code for Colombia Spring Tourism Season...
  API timeout (attempt 1)
  Retry 2/3 in 4s...
  → Code: CUMBIA26 (Evokes Colombian dance culture)
```

**Fallback**: If all retries fail, uses city/event name + 26 (e.g., `MEDELLIN26`)

**Error types handled**:
- API timeout
- Network errors
- JSON parse errors
- Invalid code format

#### 4. Manage Opportunities View Fixed
**Issue**: "No pricing data available" even when data was saved.

**Root Cause**: Code checked for `pricing.get('strategy')` but saved data used `pricing_strategy`.

**Fix**: Support both formats, show promo code prominently:
```
💰 Pricing Strategy
  Strategy: PROMO
  Promo Code: CUMBIA26 (Grok AI)
  Rationale: Evokes Colombian dance and music culture
  Recommended SKU: CO_20GB_30D
  Price: $115.99 → $104.99
  Margin: 57% GP | Tier B
  Discount: 10% (max allowed: 15%)
  Expected: 1,080 orders | $22,393 net | 373% ROI
```

**Files Modified**: `esim_pricing_agent.py:9763-9818`

#### 5. Interactive Review Detail View Enhanced
**Feature**: When selecting an event in "Review one by one", now shows clear pricing:

```
💰 PRICING RECOMMENDATION
   Strategy: DISCOUNT -10%
   SKU: CO_20GB_30D
   Base Price: $115.99
   Promo Price: $104.99 (-$11.00)
   GP%: 57%
   Tier: Tier B: max 15% off
   Reason: Tier B: max 15% off - promotional pricing
```

**Files Modified**: `grok_opportunity_manager.py:3133-3184`

---

### Files Modified This Session

| File | Changes |
|------|---------|
| `grok_opportunity_manager.py` | Smart Mass Approve display rework, promo code generation with retry, detail view enhancement |
| `esim_pricing_agent.py` | Manage Opportunities pricing display fix, promo code display |

---

### Country Tier Classification (Used for Discounts)

| Tier | Max Discount | Countries (examples) |
|------|--------------|---------------------|
| A (High Margin) | 25% | FR, DE, GB, ES, IT, PT, NL, GR |
| B (Medium Margin) | 15% | US, AU, NZ, BR, CO, IN, MY, ID |
| C (Low Margin) | 5% | JP, KR, TH, PH, TW, SG, VN, MX |
| D (No Discount) | 0% | (none currently) |

Config file: `config/discount_rules.json`

---

### Test: Colombia Spring Tourism Approved

**Event**: Colombia Spring Tourism Season (Medellin)
**Status**: Approved ✅
**Promo Code**: `MEDELLIN26` (fallback - Grok API timed out)
**Pricing**:
- SKU: CO_20GB_30D
- Base: $115.99 → Promo: $104.99 (10% off)
- GP: 57% | Tier B
- Expected: 1,080 orders | $22,393 net | 373% ROI

---

## Project Context (Read First!)

**What**: TravelWifi eSIM pricing optimization system
**Entry Point**: `python esim_pricing_agent.py`
**Venv**: Auto-detected (`.venv`, `.smart-pricing`, or `.tellisim-pricing`)

### Core Pricing Rules (MUST FOLLOW)
| Rule | Value | Notes |
|------|-------|-------|
| GP Floor | 56% minimum | Configurable per product |
| Ceiling Rule | 1.85× avg cost | Countries above are excluded |
| Market Rule | -10% baseline | But charge MORE if we have coverage advantage |
| Price Format | `.99` ending | All prices end in .99 |
| Currency | USD only | Convert using `order_usd_rate_exchange` |

### Competitors
| Provider | Europe Countries | Asia Countries | Reference |
|----------|-----------------|----------------|-----------|
| Nomad | 35 | 13 | Lite/Standard tiers |
| Airalo | 38 | 14 | Plus tier |

### Utilization Rates (Verified from 1,280 orders)
```
1GB: 57% | 3GB: 54% | 5GB: 43% | 10GB: 46% | 20GB: 32%
```

---

## Session: Dec 1, 2025

### What Was Done

#### 1. Small Region Handling Fix
**Issue**: North America had only 1 country (US) after ceiling rule excluded Canada & Mexico, but system still showed 3 tiers with different prices.

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| 1-country "regional" plan | No minimum country check | Added `MIN_REGIONAL_COUNTRIES = 3` validation |
| Different prices for same country | Coverage premiums applied unconditionally | Made premiums conditional on actual country increase |
| Tier distribution broken for < 10 countries | `max(10, ...)` forced 10 even with fewer | Scaled proportionally for small regions |

**Files Modified**: `regional_plan_builder.py:1003-1089`

**New Logic**:
```python
# Minimum regional validity check
MIN_REGIONAL_COUNTRIES = 3
if tier_count >= 2 and total_included < MIN_REGIONAL_COUNTRIES:
    console.print("⚠️ SMALL REGION WARNING - Converting to SINGLE TIER")
    tier_count = 1

# Conditional coverage premiums (only if MORE countries)
if len(medium_countries) > len(lite_countries):
    medium_cost = medium_base_cost + premium
else:
    medium_cost = medium_base_cost  # Same countries = no premium
```

**Result**: Small regions now show single-tier pricing with warning to consider local plans instead.

#### 2. Small Region User Choice Flow (Updated)
**Issue**: User requested proper options instead of automatic conversion to single tier.

**New Flow**:
```
⚠️  SMALL REGION - CANNOT CREATE TIERED PLAN
Problem: Only 1 of 3 countries remain after ceiling rule.
Reason: 2 countries exceeded the 1.85× cost ceiling ($2.19/GB).

Would include (1): United States
Would exclude (2): Mexico, Canada

OPTIONS:
  1. Skip this region - Don't create a regional plan
     → Consider creating LOCAL plans for Mexico, Canada instead
  2. Include ALL 3 countries (disable ceiling rule)
     → Higher-cost countries included, GP% floor still protected
     → Pricing will be higher to maintain margins

Select option [1]:
```

**Files Modified**: `regional_plan_builder.py:1015-1058`

**Logic**:
- Option 1: Returns `None`, skips region entirely
- Option 2: Rebuilds `included_countries` with ALL countries, ignores ceiling rule, continues with tiered pricing (GP% floor still enforced)

**Test Results** (Dec 1, 2025):
```
Option 1 (Skip):
  → Returns None
  → Shows: "Skipping North America regional plan"
  → Suggests: "Use Local Plan Builder for individual country plans"

Option 2 (Include All):
  → Includes US, Canada, Mexico
  → Tier distribution: Lite(1), Standard(2), Plus(3) countries
  → Wholesale costs: $8.50 / $9.30 / $10.30 (premiums correctly applied)
  → Pricing table shows differentiated tiers
```

**Files Modified**:
- `regional_plan_builder.py:11` - Added `import click` at module level
- `regional_plan_builder.py:1015-1058` - Small region handling with user choice
- `regional_plan_builder.py:2315` - Removed redundant local `import click`

#### 3. Stale Data Update Fix
**Issue**: "Update stale data now?" prompt wasn't actually fetching data - just marking as updated.

| Source | Before | After |
|--------|--------|-------|
| competitor_local | Just `record_update()` | Now calls `update_local_competitor_prices_menu()` |
| competitor_regional | Just `record_update()` | Now calls `update_competitor_prices_with_firecrawl()` |
| competitor_global | Just `record_update()` | Now calls `update_global_competitor_prices_with_firecrawl()` |
| ml_persona | Wrong function name | Fixed: `run_persona_estimation(force=True)` |

**File Modified**: `esim_pricing_agent.py:425-511`

**Additional Fixes**:
- Firecrawl functions now raise `RuntimeError` instead of silent `return` on missing package
- GA update checks for package before attempting fetch
- Success/failure tracking per source
- Summary shows count: "X sources updated" or "Y failures (X succeeded)"
- `record_update()` only called if update actually succeeds

#### 4. Missing Dependencies Added to requirements.txt
Added missing packages that were noted in TECHNICAL_DEBT.md:

```
# Google APIs
google-analytics-data>=0.18  # GA4 API for seasonality data
google-auth>=2.0  # Google authentication
gspread>=5.0  # Google Sheets integration

# Testing
pytest>=7.0
pytest-asyncio>=0.21
pytest-cov>=4.0

# HTTP
requests>=2.28
```

**File Modified**: `requirements.txt:66-77`

#### 5. Fixed Additional Update Code Paths
**Issue**: Data Sources Dashboard (option 1-8) used separate code that wasn't fixed.

| Location | Line | Fix |
|----------|------|-----|
| Inline force update | 8094-8121 | Added package checks, proper record_update conditions |
| `run_stale_data_updates_single()` | 8130-8155 | Same fixes as above |
| GA tracker | - | Reset incorrect entry (was marked updated without data) |

**Key Changes**:
- GA: Check for `google-analytics-data` package, verify result isn't fallback
- ML: Fixed function name `run_persona_estimation` (was `run_full_estimation`)
- Competitor: Added `record_update` calls that were missing

#### 6. Data Verification & GA Fix
**Issue**: GA update was silently failing because venv path was wrong in earlier runs.

**Root Cause**: Documentation referenced `.smart-pricing/` but actual venv is `.tellisim-pricing/`

**Verification Results** (Dec 1, 2025 12:47):
| Source | Status | Details |
|--------|--------|---------|
| Google Analytics | ✅ Fresh | 13 months of real data from GA4 API |
| competitor_local | ✅ Fresh | 200+ countries via Firecrawl (Dec 1) |
| competitor_global | ✅ Fresh | Airalo (116 countries), Nomad (112 countries) |
| ml_persona | ✅ Fresh | 122,748 customers (Nov 27) |
| competitor_regional | ⚠️ Stale | Never actually fetched (requires interactive input) |
| OpenSearch | ⚠️ Stale | 163,788 orders (Nov 20 - 11 days old) |

**Note**: Regional competitor update requires interactive menu (Firecrawl scraper with competitor selection).

#### 7. Venv Auto-Detection (Machine Agnostic)
**Issue**: Different machines use different venv names (`.smart-pricing` on personal, `.tellisim-pricing` on work).

**Solution**: Auto-detect venv by checking in order: `.venv`, `.smart-pricing`, `.tellisim-pricing`

**Files Modified**:
| File | Change |
|------|--------|
| `quickstart.sh` | Auto-detect existing venv or create `.venv` for new installs |
| `test_strategic_pricing_integration.sh` | Auto-detect venv for activation |
| `esim_pricing_agent.py:1574-1593` | Auto-detect venv for Jupyter launcher |
| `CLAUDE.md` | Updated to show auto-detection |
| `WORKLOG.md` | Updated to show auto-detection |
| `README.md` | Updated setup instructions to use `./quickstart.sh` |

**New Behavior**:
- `./quickstart.sh` checks for existing venv first, uses `.venv` for new installs
- Python code checks all three possible paths before failing
- Docs no longer reference a specific venv name

#### 8. GA Detection Bug Fix
**Issue**: Startup showed "GA:N/A" and "STALE DATA DETECTED" even though GA data was fresh.

**Root Cause**: `detect_ga_freshness()` looked in `cache/ga_data/` but GA data is stored in `cache/ga_seasonality/`

**Fix**: Updated `data_freshness_manager.py:294-325` to check both directories:
```python
ga_dirs = [
    Path('cache/ga_seasonality'),  # New location
    Path('cache/ga_data'),          # Legacy location
]
```

**Result**: GA now correctly detected as fresh on startup.

#### 9. Small Region Tiering Fix (North America)
**Issue**: When user chose "Include ALL 3 countries" for North America, system still created 3 artificial tiers (1/2/3 countries each).

**Root Cause**: After including all countries, code didn't check if total was still too small for meaningful tiering.

**Fix**: Updated `regional_plan_builder.py:1061-1066` and `1087-1103`:
```python
# After "Include All", check if still too small for tiers
MIN_FOR_TIERED = 6
if total_included < MIN_FOR_TIERED:
    tier_count = 1  # Force single tier

# In tier distribution, respect tier_count = 1
if tier_count == 1:
    lite_count = total_included  # All tiers = all countries
    std_count = total_included
```

**New Behavior**:
- Regions with < 6 countries → Single-tier plan (all countries at same price)
- Regions with 6-9 countries → Scaled tiers (33%/66%/100%)
- Regions with 10+ countries → Standard tiers (25%/60%/100%)

#### 10. Regional Bundle Pricing Bug Fix
**Issue**: North America showed Market price of $54.99 (based on $61 sum of local prices) instead of $26 (actual regional bundle price).

**Root Cause**: When `tier_count == 1`, code assumed "custom plan" and summed LOCAL eSIM prices instead of using actual regional bundle prices.

**Math was wrong**:
```
WRONG: $15 (US) + $25 (CA) + $21 (MX) = $61 → Market $54.99
RIGHT: Nomad regional bundle 10GB = $26.00
```

**Fix**: Updated `regional_plan_builder.py:1533` to only use summed local pricing for ACTUAL custom plans:
```python
# Before (wrong):
if tier_count == 1 and not analysis_df.empty:

# After (correct):
if tier_count == 1 and is_custom_plan and not analysis_df.empty:
```

**Result**:
- Standard regional plans (North America, Europe, etc.) now use regional bundle prices even when single-tier
- Custom plans (user-selected arbitrary countries) still use summed local prices

#### 11. Medium Region Tier Distribution Fix (Latin America)
**Issue**: Latin America (14 countries) showed Standard=14 and Plus=14 (same count).

**Root Cause**: For regions with 10-24 countries, `max(10, ...)` forced Lite to 10+ countries, then `max(lite_count + 5, ...)` required 15+ for Standard (capped to 14 = Plus).

**Old (Broken)**:
```python
# For 14 countries:
lite_count = max(10, int(14 * 0.25))  # = max(10, 3) = 10
std_count = max(10 + 5, int(14 * 0.60))  # = max(15, 8) = 15 → capped to 14
# Result: Lite=10, Standard=14, Plus=14 ⚠️
```

**New Logic** (`regional_plan_builder.py:1089-1113`):
```python
if total_included >= 25:
    # Large regions: maintain minimum of 10 for Lite
    lite_count = max(10, int(total_included * 0.25))
    std_count = max(lite_count + 5, int(total_included * 0.60))
elif total_included >= 10:
    # Medium regions (10-24): pure percentage, ensure proper gaps
    lite_count = max(3, int(total_included * 0.30))  # ~30%
    std_pct = int(total_included * 0.65)
    std_count = max(lite_count + 2, min(total_included - 2, std_pct))
```

**Results**:
| Region | Countries | Lite | Standard | Plus |
|--------|-----------|------|----------|------|
| Latin America | 14 | 4 | 9 | 14 ✓ |
| MEA | 20 | 6 | 13 | 20 ✓ |
| Europe | 41 | 10 | 24 | 41 ✓ |
| Global | 100 | 25 | 60 | 100 ✓ |

#### 12. Global Plan Creation Fix
**Issue**: Global plan (option 4 in Plan Builder) showed simple pricing table and asked "Also run regional analysis?" instead of creating proper Lite/Standard/Plus tiers with JSON export.

**Root Cause**: Global plans were handled differently than Regional - just displayed average cost and offered to run regional analysis separately.

**Old Behavior**:
```
GLOBAL PLAN PRICING STRATEGIES
Pricing based on weighted average cost across all destinations

Global Average Cost: $1.94/GB
[Simple pricing table with Premium/Balanced/Disrupt columns]

Also run regional analysis? [y/N]:  ← Exits if user says No
```

**Fix** (`esim_pricing_agent.py:13902-13933`):
```python
# For global plans, collect ALL countries from ALL defined regions
all_global_countries = set()
for region_key, region_data in regions_config.items():
    if region_key not in ['global', 'custom']:  # Skip meta-regions
        all_global_countries.update(region_data.get('countries', []))

# Also include countries from price list not in a region
if 'country' in price_list_df.columns:
    all_global_countries.update(price_list_df['country'].dropna().unique())

# Create dynamic global region config
agent.config['regions']['global'] = {
    'label': 'Global',
    'countries': sorted(list(all_global_countries)),
    'apply_ceiling': True
}
selected_region = 'global'
```

**New Behavior**:
1. Collects ALL countries from all defined regions (Europe + Asia + Americas + etc.)
2. Also includes any countries in price list not assigned to a region
3. Creates dynamic `global` region configuration
4. Flows through same tiered analysis as Regional plans (Lite/Standard/Plus)
5. Exports to `pricing_exports/global_plan_production.json`

**Files Modified**: `esim_pricing_agent.py:13902-13933` (replaced simple display with tiered analysis flow)

---

## Previous Session (Nov 30, 2025)

### What Was Done

#### 1. Regional Plan Builder Fixes
| Issue | Fix | File |
|-------|-----|------|
| Tier distribution broken (10/11/41) | Changed to percentage-based: 25%/60%/100% | `regional_plan_builder.py:1014-1034` |
| Always undercutting competitors | Added value-differential pricing | `regional_plan_builder.py:1347-1380` |
| `nomad_countries` NameError | Fixed variable reference | `regional_plan_builder.py:1073` |
| `nomad_country_count` UnboundLocalError | Moved definition earlier in function | `regional_plan_builder.py:1046-1048` |

#### 2. Value-Differential Pricing Logic
```
MORE countries than competitor  → price HIGHER (premium 5-15%)
FEWER countries than competitor → price LOWER (discount 8-15%)

Example (Asia Pacific):
- Lite (10 vs Nomad 35): 0.85 factor (15% discount)
- Standard (24 vs Nomad 35): 0.92 factor (8% discount)
- Plus (41 vs Airalo 38): 1.03 factor (3% PREMIUM)
```

#### 3. Regional Exports Validated (ALL COMPLETE - Dec 1, 2025)
| Region | Lite | Standard | Plus | Excluded | GP% Min | Status |
|--------|------|----------|------|----------|---------|--------|
| Europe | 10 | 24 | 41 | 5 | 74.3% | ✅ Exported |
| Asia Pacific | 10 | 24 | 41 | 8 | 57.3% | ✅ Exported |
| North America | 3 | 3 | 3 | 0 | 79.8% | ✅ Single-tier |
| Latin America | 4 | 9 | 14 | 6 | 59.6% | ✅ Exported |
| Caribbean | 10 | 15 | 25 | 3 | 50.1%* | ✅ Exported |
| Africa | 11 | 28 | 47 | 7 | 56.1% | ✅ Exported |
| Middle East | 3 | 7 | 12 | 4 | 73.6% | ✅ Exported |
| Oceania | 3 | 7 | 12 | 2 | 63.2% | ✅ Exported |

*Caribbean accepted at 50% GP (high-cost region, marketing value for low-demand countries)

#### 4. JSON Export Structure (Validated)
```
pricing_exports/{region}_plan_production.json
├── plan_id, plan_type, version
├── metadata (excluded_countries, gp_target)
├── executive_summary (total_countries, revenue, orders)
├── competitor_benchmarks (Nomad, Airalo)
├── country_details (46+ countries)
├── tiers (3 tiers with packages)
├── seasonal_promos (wave-based promos)
├── seasonal_pricing (peak/high/shoulder/low multipliers)
├── event_overlays (empty for now)
├── connect_instructions (for cron integration)
├── pricing_audit_log
└── change_history
```

---

## TODO - Next Steps

### ✅ PHASE 1: Plan Exports (COMPLETE)
- [x] Local plan export (all countries)
- [x] Regional plan exports (8 regions: Europe, Asia, NA, LATAM, Caribbean, Africa, MEA, Oceania)
- [x] Global plan export (147 countries after ceiling rule)
- [x] All exports have `seasonal_pricing` multipliers (peak/high/shoulder/low)

### ✅ PHASE 2: Configure Seasonal Promos (COMPLETE)
**Status**: 144 promos configured with data-driven discounts

| Step | Task | Status |
|------|------|--------|
| 2.1 | Set `discount_percent` for each promo | ✅ Done |
| 2.2 | Assign promos to tiers (Lite/Standard/Plus) | ✅ Done |
| 2.3 | Link promos to specific SKUs in exports | ✅ Done |
| 2.4 | Update `seasonal_promos` field in each export JSON | ✅ Done |

**Data-driven discount matrix applied:**
```
Season     | early_bird | standard | last_minute
-----------|------------|----------|-------------
Winter     | 15%        | 20%      | 25%
Spring     | 10%        | 12%      | 15%
Summer     | 0%         | 0%       | 5%
Fall       | 10%        | 12%      | 15%
```

**Tier targeting strategy:**
- Winter last_minute: Lite only (volume play)
- Summer peak: Plus only (margin protection)
- Shoulder seasons: Mixed tiers

### ✅ PHASE 3: Create Event Promos (COMPLETE)
**Status**: 30 events across all regions

| Step | Task | Status |
|------|------|--------|
| 3.1 | Define event calendar (holidays, sports, etc.) | ✅ Done |
| 3.2 | Create event-specific promo codes | ✅ Done |
| 3.3 | Set event pricing overlays in exports | ✅ Done |
| 3.4 | Update `event_overlays` field in each export JSON | ✅ Done |

**Event calendar created:**
- Global (4): Christmas, NYE, Black Friday, Summer Peak
- Europe (5): MWC, Oktoberfest, Winter Olympics, UEFA, Wimbledon
- Asia Pacific (4): Cherry Blossom, Lunar NY, Diwali, Singapore F1
- North America (4): Super Bowl, SXSW, Spring Break, Thanksgiving
- Latin America (3): Carnival, Dia de los Muertos, World Cup 2026
- Caribbean (2): Cruise Season, Trinidad Carnival
- Africa (2): Safari Season, AFCON
- Middle East (3): Dubai Shopping, Ramadan, Qatar F1
- Oceania (3): Australian Open, Sydney NYE, Vivid Sydney

**Files created:**
- `promos/event_calendar.json` - Master event calendar

### ⏳ PHASE 4: Connect Integration (NEXT)
**Status**: Ready to test

- [ ] Test JSON exports with Connect cron
- [ ] Validate seasonal_pricing updates work
- [ ] Validate seasonal_promos creation works
- [ ] Validate event_overlays pricing works
- [ ] Test promo code auto-creation

### 📋 PHASE 5: Testing & Validation
- [ ] Run full test suite
- [ ] Validate GP floors protected across all scenarios
- [ ] Validate ceiling rule exclusions
- [ ] End-to-end test: export → Connect → customer checkout

---

## Understanding: Seasonal Pricing vs Seasonal Promos

```
┌─────────────────────────────────────────────────────────────────┐
│ SEASONAL PRICING (in exports)                                   │
│ ─────────────────────────────                                   │
│ • Price MULTIPLIERS by month                                    │
│ • Already configured in all 10 exports                          │
│ • Connect reads & adjusts BASE PRICES automatically             │
│                                                                  │
│ Example: peak (May-Aug) = 1.25x multiplier                      │
│   Base: $18.99 → Peak: $23.99                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ SEASONAL PROMOS (CONFIGURED - Phase 2 Complete)                 │
│ ─────────────────────────────                                   │
│ • 144 promo codes with data-driven discounts                    │
│ • Discounts: 0-25% based on season/wave/elasticity              │
│ • Connect creates promo codes in e-commerce                     │
│                                                                  │
│ Example: Winter last_minute → 25% off Lite tier                 │
│   Summer peak → 0% (maximize margin)                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ EVENT PROMOS (CONFIGURED - Phase 3 Complete)                    │
│ ─────────────────────────────                                   │
│ • 30 events across all regions                                  │
│ • Strategies: price_up (1.10-1.20x) or promo (10-20%)           │
│ • Stored in `event_overlays` section of exports                 │
│                                                                  │
│ Example: XMAS25 → 25% off all tiers, Dec 20-26                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files Modified This Session

| File | Changes |
|------|---------|
| `regional_plan_builder.py` | Tier distribution fix for medium regions (10-24 countries), is_custom_plan fix, small region handling |
| `esim_pricing_agent.py` | Global plan fix (lines 13902-13933), auto-detect venv for Jupyter launcher |
| `data_freshness_manager.py` | GA detection now checks both `cache/ga_seasonality/` and `cache/ga_data/` |
| `quickstart.sh` | Auto-detect venv (.venv, .smart-pricing, .tellisim-pricing) |
| `CLAUDE.md` | Updated tier distribution docs, venv agnostic |
| `README.md` | Added Regional Plan Builder feature section |

---

## Quick Reference

### Run Regional Plan
```bash
python esim_pricing_agent.py
# Menu: Plan Builder → Regional Plan Analyzer → Select Region → Export
```

### Validate JSON Export
```bash
python -c "import json; print(json.load(open('pricing_exports/europe_plan_production.json')).keys())"
```

### Check Tier Distribution
```python
# In code:
lite_count = max(10, int(total_included * 0.25))
std_count = max(lite_count + 5, int(total_included * 0.60))
plus_count = total_included  # 100%
```

### Value-Differential Pricing
```python
# If MORE countries than competitor:
price_factor = min(1.15, 1.0 + (coverage_ratio - 1.0) * 0.40)

# If FEWER countries:
price_factor = max(0.85, 0.90 - (1 - coverage_ratio) * 0.15)
```

---

## Notes for Next Session

1. **Global Plan**: This is the most complex - covers all countries worldwide
2. **Grok Integration**: Started but not complete - see `grok_opportunity_manager.py`
3. **Seasonal Promos**: Europe has promos, Asia Pacific doesn't (expected for now)
4. **Connect Cron**: JSON exports ready but not tested with actual cron job

---

## Why These Fixes Were Made (Context)

### Problem 1: Tier Distribution Was Broken
**User reported**: "Lite: 10, Standard: 11, Plus: 41 - Standard only 1 more than Lite!"
**Root cause**: Standard tier used Nomad's country list filtered to our countries (only 11 overlapped)
**Fix**: Changed to percentage-based (25%/60%/100%) which gives balanced 10/24/41

### Problem 2: Price Factor Was Inverted
**User reported**: "Lite tier was $33.99 when Nomad is $20 - pricing ABOVE market!"
**Root cause**: Formula `max(0.60, ratio * 2.2)` produced 1.69 (169%) instead of 0.65 (65%)
**Fix**: Rewrote formula to properly undercut when FEWER countries, premium when MORE

### Problem 3: Always Undercutting Even When Ahead
**User insight**: "If we have MORE countries than competitors, we can price HIGHER not lower"
**Fix**: Added value-differential pricing - charge premium when coverage > competitor

---

## Grok AI Integration Status ✅ COMPLETE

### All Features Working (Dec 1, 2025)

| Feature | File | Status |
|---------|------|--------|
| **Opportunity Research** | `grok_opportunity_manager.py` | ✅ Events, destinations, trends |
| **Competitor Research** | `grok_competitor_research.py` | ✅ Monthly Airalo vs Nomad analysis |
| **Price Validation** | `competitor_data.py` | ✅ Validates scraped prices with confidence |
| **Promo Names** | `promo_registry.py` | ✅ Marketing-friendly 4-6 char codes |
| **Emotional Scoring** | `promo_registry.py` | ✅ Urgency/shareable/memorable (0-10) |
| **Regional Integration** | `regional_plan_builder.py` | ✅ Event promos in custom plans |

### Grok Validation in Action
```
Europe Regional - Grok Validation:
  Nomad: Valid=True, Confidence=100%, Anomalies=0
  Airalo: Valid=False, Confidence=80%, Anomalies=3 (needs review)
```

### Promo Emotional Scores (Grok-generated)
```python
# Example promo with Grok scoring:
{
  "code": "AURORA",
  "display_name": "Chase the Aurora",
  "grok_generated": True,
  "emotional_score": 9.5,
  "shareability_score": 9.0,
  "memorability_score": 9.2,
  "avg_score": 9.2,
  "why_it_works": "Short and magical, evokes adventure"
}
```

### Key Grok Files
```
grok_opportunity_manager.py   # Event/destination research
grok_competitor_research.py   # Monthly competitor analysis
competitor_data.py            # Price validation functions
promo_registry.py             # Promo names + emotional scoring
```

### Usage
```bash
# Menu: Grok AI Opportunity Research
python esim_pricing_agent.py
# → Option 8 (Grok AI)
# → Research events, destinations, or trends
# → Filter by season, visitor count
# → Approve/reject opportunities
```

---

## Git Commits This Session

```
ca647ee9f - Define nomad/airalo country counts earlier in function
465a651d8 - Fix NameError: nomad_countries not defined
35a37f488 - Fix tier distribution and add value-differential pricing
```

---

*Keep this file updated at end of each session for continuity.*
