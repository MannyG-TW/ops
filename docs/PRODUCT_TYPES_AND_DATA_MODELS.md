# Product Types and Data Models Reference

> **Last Updated:** January 2026
> **Status:** Canonical Reference
> **Supersedes:** Parts of PRODUCT_SKU_REFERENCE.md, SAPPHIRE_PRODUCT_CATEGORIZATION.md

This document is the authoritative reference for TravelWifi's three product types, their data models, SKU patterns, and OpenSearch indices.

---

## Table of Contents

1. [Product Types Overview](#product-types-overview)
2. [Data Models: TOTAL_DATA vs DAILY_DATA](#data-models)
3. [eSIM Products](#esim-products)
4. [Rental Products](#rental-products)
5. [Sapphire Data Products](#sapphire-data-products)
6. [OpenSearch Indices](#opensearch-indices)
7. [SKU Validation Rules](#sku-validation-rules)
8. [Pricing Calculations](#pricing-calculations)

---

## Product Types Overview

TravelWifi has **three distinct product types**, each with different data models:

| Product Type | Target Customer | Data Model | Primary SKU Pattern |
|--------------|-----------------|------------|---------------------|
| **eSIM** | Travelers with eSIM-capable phones | TOTAL_DATA | `{COUNTRY}_{GB}GB_{DAYS}D` |
| **Rental** | Travelers renting a Sapphire device | DAILY_DATA | `S2GLOCALMERENT` + `DHI_*_{TIER}` |
| **Sapphire Data** | Customers who OWN a Sapphire device | TOTAL_DATA | `DHI_*_FLOW*` |

### Order Volume Distribution (as of Jan 2026)

| Product Type | Orders | % of Total |
|--------------|--------|------------|
| eSIM | ~72,000 | ~29% |
| Rental | ~82,000 | ~33% |
| Sapphire Data | ~95,000 | ~38% |

---

## Data Models

### TOTAL_DATA Model (eSIM & Sapphire Data)

**How it works:**
- Customer purchases a fixed total GB pool for a validity period
- Example: 10GB for 30 days
- Customer can use all data at any time during the validity period
- **Plan ends when:** Data is exhausted OR validity period expires (whichever comes first)

```
┌─────────────────────────────────────────────────────────────┐
│ TOTAL_DATA Model                                            │
│                                                             │
│ Purchase: 10GB for 30 days                                  │
│                                                             │
│ Day 1: Use 3GB  → 7GB remaining                            │
│ Day 2: Use 5GB  → 2GB remaining                            │
│ Day 3: Use 2GB  → 0GB remaining → PLAN ENDS                │
│                                                             │
│ OR if customer uses only 1GB/day:                          │
│ Day 30: Time expires → PLAN ENDS (with unused data)        │
└─────────────────────────────────────────────────────────────┘
```

### DAILY_DATA Model (Rental Only)

**How it works:**
- Customer rents a device for X days and selects a data tier (Adventure/Escape/Voyage/Unlimited)
- Each tier provides a **daily data allowance** at full speed
- Daily allowance **resets at midnight** (00:00:00 to 23:59:59)
- If daily allowance is exceeded before midnight, **FUP (Fair Usage Policy)** kicks in:
  - Speed is reduced but data continues
  - Resets with fresh allowance at midnight
- **Plan ends when:** Rental end date is reached

```
┌─────────────────────────────────────────────────────────────┐
│ DAILY_DATA Model (Rental with Escape tier = 5GB/day)       │
│                                                             │
│ 10-day rental:                                              │
│                                                             │
│ Day 1 (00:00-23:59): 5GB at full speed                     │
│   → If 5GB used by 3PM: FUP (reduced speed until midnight) │
│   → At midnight: RESET                                      │
│                                                             │
│ Day 2 (00:00-23:59): Fresh 5GB at full speed               │
│   → Cycle repeats...                                        │
│                                                             │
│ Day 10 (23:59): Rental ends                                │
│                                                             │
│ Total potential data: 5GB/day × 10 days = 50GB             │
└─────────────────────────────────────────────────────────────┘
```

### Key Difference Summary

| Aspect | TOTAL_DATA | DAILY_DATA |
|--------|------------|------------|
| Data pool | Fixed total (e.g., 10GB) | Daily allowance × days |
| Resets | Never | Every midnight |
| FUP | No (plan ends when depleted) | Yes (speed reduced, data continues) |
| Used by | eSIM, Sapphire Data | Rental only |
| Calculation | Simple: X GB total | Complex: daily_allowance × rental_days |

---

## eSIM Products

### Description
Digital eSIM data plans for travelers with eSIM-capable smartphones. Activated instantly via QR code. No physical device required.

### Data Model
**TOTAL_DATA** - Customer buys X GB for Y days. Whichever ends first (data or time) terminates the plan.

### SKU Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| `{COUNTRY}_{GB}GB_{DAYS}D` | `US_5GB_30D` | Standard plan: 5GB in USA for 30 days |
| `{COUNTRY}_{DAYS}D_Unlimited` | `ES_7D_Unlimited` | Unlimited plan: 7 days in Spain |

### Active Product SKUs (in `product_sku` field)
- `TW_eSIM` - Generic TravelWifi eSIM
- `TW_eSIM_VFNL` - Vodafone network eSIM
- `TW_eSIM_MANX` - MANX network eSIM

### Discontinued SKUs (exclude from analysis)
- `TW_FLEX_ESIM_MANX` - Failed product
- `Global_eSIMCard` - Discontinued

### OpenSearch Query
```json
{
  "bool": {
    "should": [
      {"wildcard": {"product_sku.keyword": "TW_eSIM*"}}
    ],
    "must_not": [
      {"term": {"product_sku.keyword": "TW_FLEX_ESIM_MANX"}},
      {"term": {"product_sku.keyword": "Global_eSIMCard"}}
    ]
  }
}
```

### SKU Validation (Python)
```python
def is_esim_sku(sku: str) -> bool:
    """Check if SKU is an eSIM product."""
    if '_' not in sku:
        return False
    parts = sku.split('_')
    # Pattern: {COUNTRY}_{GB}GB_{DAYS}D or {COUNTRY}_{DAYS}D_Unlimited
    if len(parts[0]) == 2 and parts[0].isupper() and parts[0].isalpha():
        if parts[0] not in ['TW', 'S2']:  # Exclude TW_eSIM and S2G
            return True
    return False
```

---

## Rental Products

### Description
Physical Sapphire hotspot device rentals with **daily data tier plans**. A rental ALWAYS includes:
1. **Device SKU**: `S2GLOCALMERENT` (or S2G* variant)
2. **Data Plan SKU**: `DHI_*` with tier suffix (Adventure/Escape/Voyage/Unlimited)

The device and data plan are **paired** - you cannot have one without the other.

### Data Model
**DAILY_DATA** - Customer gets X GB/day at full speed. Resets at midnight. FUP if exceeded.

### Data Tiers

| Tier | Daily Allowance | Description | Example (10-day rental) |
|------|-----------------|-------------|------------------------|
| **Adventure** | Smallest | Entry tier for light users | ~20-30GB total |
| **Escape** | 5GB/day | Mid tier for moderate users | 50GB total |
| **Voyage** | Larger | Higher tier for heavy users | ~100GB total |
| **Unlimited** | No limit | Top tier, no FUP | Unlimited |

### FUP (Fair Usage Policy)
- Applies when daily allowance is exceeded before midnight
- Speed is **reduced** (not cut off) - customer still has data
- **Resets at midnight** with fresh daily allowance

### SKU Patterns

**Device SKUs:**
| SKU | Description |
|-----|-------------|
| `S2GLOCALMERENT` | Main rental device (99% of rentals) |
| `S2GLOCALMEBLACKMATTE` | Black matte variant |
| `S2GLOCALMEBLACKGLOSSY` | Black glossy variant |
| `S2GLOCALMEGREEN` | Green variant |
| `S2GLOCALMEMAGENTA` | Magenta variant |
| `S2GLOCALMEBLUE` | Blue variant |

**Data Plan SKUs:**
| Pattern | Example | Description |
|---------|---------|-------------|
| `DHI_{COUNTRY}_DP{GB}GB_{TIER}` | `DHI_Europe_DP5GB_Adventure` | Europe, 5GB plan, Adventure tier |
| `DHI_{COUNTRY}_DP{GB}GB_{TIER}` | `DHI_FR_DP10GB_Escape` | France, 10GB plan, Escape tier |
| `DHI_{COUNTRY}_DP{GB}GB_{TIER}` | `DHI_US_DP10GB_Voyage` | USA, 10GB plan, Voyage tier |
| `DHI_{COUNTRY}_DPUNLIMITED` | `DHI_PL_DPUNLIMITED` | Poland, Unlimited tier |
| `DHI_{COUNTRY}_DPUNLIMITED{DAYS}DAYS` | `DHI_KW_DPUNLIMITED30DAYS` | Kuwait, Unlimited, 30 days |

### Validation Rules
1. Device SKU must be `S2GLOCALMERENT` (or `S2G*` variant)
2. Data plan SKU must be `DHI_*` AND contain one of: `_Adventure`, `_Escape`, `_Voyage`, or `UNLIMITED`
3. A valid rental order should have BOTH device and data plan SKUs

### SKU Validation (Python)
```python
VALID_RENTAL_TIERS = ['_Adventure', '_Escape', '_Voyage', 'UNLIMITED']

def is_rental_device(sku: str) -> bool:
    """Check if SKU is a rental device."""
    return sku.startswith('S2G')

def is_rental_tier_plan(sku: str) -> bool:
    """Check if DHI_* SKU is a rental tier plan."""
    if not sku.startswith('DHI_'):
        return False
    sku_upper = sku.upper()
    return any(tier.upper() in sku_upper for tier in VALID_RENTAL_TIERS)
```

### Pricing Calculation
```
Total Potential Data = daily_allowance × rental_days

Example:
  Escape tier (5GB/day) × 10 days = 50GB total potential

Cost calculation must consider:
  - Number of rental days (from order)
  - Daily data tier selected
  - Country/region pricing
```

---

## Sapphire Data Products

### Description
Data plans for customers who **already OWN** a Sapphire device (not renting). These are FLOW plans that provide connectivity for existing device owners.

### Data Model
**TOTAL_DATA** - Same as eSIM. Customer buys X GB for Y days. Whichever ends first terminates the plan.

### SKU Patterns

| Pattern | Example | Description |
|---------|---------|-------------|
| `DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS_{DATE}` | `DHI_PL_FLOW30GB15DAYS_20230525` | Poland, 30GB, 15 days |
| `DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS` | `DHI_PL_FLOW75GB30DAYS` | Poland, 75GB, 30 days |
| `DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS{V}_{DATE}` | `DHI_US_FLOW2GB7DAYS2_20220101` | USA, 2GB, 7 days, v2 |

### Key Identifier
- Must start with `DHI_`
- Must contain `FLOW` in the SKU
- Does NOT have tier suffixes (Adventure/Escape/Voyage/Unlimited)

### SKU Validation (Python)
```python
def is_sapphire_flow_plan(sku: str) -> bool:
    """Check if DHI_* SKU is a Sapphire Data FLOW plan (for device owners)."""
    if not sku.startswith('DHI_'):
        return False
    return 'FLOW' in sku.upper()
```

### Important Distinction
| If SKU has... | It's a... | For... |
|---------------|-----------|--------|
| `FLOW` | Sapphire Data | Device OWNERS |
| `_Adventure/_Escape/_Voyage/UNLIMITED` | Rental Data Plan | Device RENTERS |

---

## OpenSearch Indices

### Index Overview

| Index | Description | Products | Refresh |
|-------|-------------|----------|---------|
| `orders` | All product orders | eSIM, Rental, Sapphire Data | Real-time |
| `daily_data_consumption_*` | Daily data usage | All | Daily |
| `esim-archive-cdr_*` | eSIM CDR archives (monthly) | eSIM only | Monthly |
| `logstash-cdr-esim*` | eSIM CDR logs (daily) | eSIM only | Daily |
| `logstash-cdr*` | Device CDR logs (daily) | Rental, Sapphire Data | Daily |

### Index → Product Mapping

```
┌─────────────────────────────┬─────────┬─────────┬───────────────┐
│ Index                       │ eSIM    │ Rental  │ Sapphire Data │
├─────────────────────────────┼─────────┼─────────┼───────────────┤
│ orders                      │   ✓     │   ✓     │      ✓        │
│ daily_data_consumption_*    │   ✓     │   ✓     │      ✓        │
│ esim-archive-cdr_*          │   ✓     │   ✗     │      ✗        │
│ logstash-cdr-esim*          │   ✓     │   ✗     │      ✗        │
│ logstash-cdr*               │   ✗     │   ✓     │      ✓        │
└─────────────────────────────┴─────────┴─────────┴───────────────┘
```

### Index Patterns

| Index Group | Pattern | Doc Count | Purpose |
|-------------|---------|-----------|---------|
| Orders | `orders` | ~235K | Order history, demand analysis |
| Data Consumption | `daily_data_consumption_*` | ~230K | Utilization tracking |
| eSIM CDR Archives | `esim-archive-cdr_YYYY-MM` | ~3.8M | Monthly eSIM usage records |
| eSIM CDR Daily | `logstash-cdr-esimYYYY.MM.DD` | Varies | Real-time eSIM usage |
| Device CDR Daily | `logstash-cdrYYYY.MM.DD` | ~200K-700K/day | Real-time device usage |

---

## SKU Validation Rules

### Complete Classification Logic

```python
VALID_RENTAL_TIERS = ['_Adventure', '_Escape', '_Voyage', 'UNLIMITED']

def classify_sku(sku: str) -> str:
    """
    Classify a SKU into product type.

    Returns: 'esim', 'rental_device', 'rental_plan', 'sapphire_data', or 'unknown'
    """
    if not sku:
        return 'unknown'

    # 1. Rental Device: S2G*
    if sku.startswith('S2G'):
        return 'rental_device'

    # 2. DHI_* plans - either Rental tier or Sapphire Data FLOW
    if sku.startswith('DHI_'):
        sku_upper = sku.upper()

        # Rental tier plan: has Adventure/Escape/Voyage/Unlimited
        if any(tier.upper() in sku_upper for tier in VALID_RENTAL_TIERS):
            return 'rental_plan'

        # Sapphire Data FLOW plan: has FLOW
        if 'FLOW' in sku_upper:
            return 'sapphire_data'

        # Other DHI (legacy) - count as Sapphire Data
        return 'sapphire_data'

    # 3. eSIM: {COUNTRY}_* pattern
    if '_' in sku:
        parts = sku.split('_')
        if len(parts[0]) == 2 and parts[0].isupper() and parts[0].isalpha():
            if parts[0] not in ['TW', 'S2']:  # Exclude TW_eSIM, S2G
                return 'esim'

    return 'unknown'
```

### Validation Summary Table

| Check | eSIM | Rental Device | Rental Plan | Sapphire Data |
|-------|------|---------------|-------------|---------------|
| Starts with `S2G` | ✗ | ✓ | ✗ | ✗ |
| Starts with `DHI_` | ✗ | ✗ | ✓ | ✓ |
| Contains tier suffix | ✗ | ✗ | ✓ | ✗ |
| Contains `FLOW` | ✗ | ✗ | ✗ | ✓ |
| 2-letter country start | ✓ | ✗ | ✗ | ✗ |

---

## Pricing Calculations

### eSIM Pricing
```
Price = base_cost × (1 + margin)
Where:
  - base_cost = vendor cost per GB × total GB
  - margin = target GP margin (min 56%)
  - Result rounded to .99
```

### Sapphire Data Pricing
Same as eSIM (TOTAL_DATA model).

### Rental Pricing
```
Price = device_rental_per_day × days + data_plan_cost
Where:
  - device_rental_per_day = S2GLOCALMERENT daily rate
  - days = rental duration
  - data_plan_cost = tier_daily_cost × days

Total potential data = daily_allowance × days
Example: Escape (5GB/day) × 10 days = 50GB potential
```

### Key Pricing Differences

| Aspect | eSIM / Sapphire Data | Rental |
|--------|---------------------|--------|
| Data calculation | Fixed: X GB | Variable: X GB/day × days |
| Time component | Validity period | Rental duration |
| Pricing unit | Per GB | Per day + tier |
| FUP consideration | No | Yes (speed reduction) |

---

## References

- **API Implementation:** `api/routes/opensearch_stats.py`
- **Web UI:** `web/app/settings/opensearch/page.tsx`
- **Related Docs:**
  - `docs/technical/opensearch_index_guide.md` - Index field mappings
  - `docs/technical/PRODUCT_SKU_REFERENCE.md` - Legacy SKU reference
  - `docs/RENTAL_ANALYSIS_METHODOLOGY.md` - Rental analysis details

---

## Changelog

| Date | Change |
|------|--------|
| Jan 2026 | Created comprehensive reference combining product types, data models, and indices |
| Jan 2026 | Added DAILY_DATA vs TOTAL_DATA model documentation |
| Jan 2026 | Added FUP policy explanation for rentals |
| Jan 2026 | Added daily tier reset behavior for rentals |
