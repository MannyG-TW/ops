# Product Quick Reference Guide - Complete Edition

## Product Type Quick Identification

```python
# Quick SKU identification hierarchy
if 'SIMCARD' in sku or 'SIMPLAN' in sku:
    → Physical SIM Card
elif any(x in sku for x in ['S2GLOCALME', 'T2GLOCALME', 'TRWDEV']):
    → Hardware Device (check if RENT for rental)
elif any(x in sku for x in ['BUMPER', 'PROTECTOR', 'CHARGER', 'POUCH']):
    → Accessory
elif 'EPOS' in sku:
    → Point of Sale System
elif 'TEST' in sku or 'DEMO' in sku:
    → Test Product (exclude from customer views)
elif any(tier in sku for tier in ['VOYAGE', 'ESCAPE', 'ADVENTURE']):
    → Rental Data Plan
elif sku.startswith('DHI_'):
    → Check for FLOW (Sapphire) or date (Legacy)
elif matches 'COUNTRY_##GB_##D':
    → eSIM Standard
elif sku.endswith('_Unlimited'):
    → eSIM or Sapphire Unlimited (check prefix)
elif sku.endswith('_FLEX'):
    → FLEX Legacy Product
```

## Complete Product Matrix

### 📱 DATA PLANS (Core Business)

| Type | Pattern | Example | Count | Status |
|------|---------|---------|-------|--------|
| **eSIM Standard** | `COUNTRY_##GB_##D` | `FR_10GB_7D` | 2,281 | Active |
| **eSIM Unlimited** | `COUNTRY_##D_Unlimited` | `ES_30D_Unlimited` | 85 | Active |
| **Sapphire Flow** | `DHI_*_FLOW*` | `DHI_US_FLOW50GB30DAYS_C` | 490 | Active |
| **Sapphire Unlimited** | `DHI_*_DPUNLIMITED` | `DHI_PL_DPUNLIMITED` | Part of 85 | Active |
| **Rental Adventure** | `DHI_*_DP1GB_Adventure*` | `DHI_FR_DP1GB_Adventure2` | 145 | Active |
| **Rental Escape** | `DHI_*_DP5GB_Escape*` | `DHI_US_DP5GB_Escape` | 146 | Active |
| **Rental Voyage** | `DHI_*_DP10GB_Voyage*` | `DHI_EUR_DP10GB_Voyage3` | 419 | Active |
| **Regional Combo** | `DHI_COUNTRY+REGION_*` | `DHI_KW+EU28_45GB_FP_30days` | 24 | Active |
| **FLEX** | `COUNTRY_##GB_FLEX` | `AF_1GB_FLEX` | 712 | Legacy |
| **Speed Tier** | `DHI_*_DP_#GSpeed` | `DHI_Europe_DP_3GSpeed` | 426 | Legacy |

### 🔧 HARDWARE DEVICES

| Type | Pattern | Example | Purpose | Revenue Model |
|------|---------|---------|---------|---------------|
| **Rental Device** | `*RENT` | `S2GLOCALMERENT` | Rental only | Recurring with data |
| **Sapphire 2** | `S2GLOCALME[COLOR]` | `S2GLOCALMEBLACKMATTE` | Sale | One-time |
| **Sapphire 3/5G** | `TRWDEV8##` | `TRWDEV810` (Sapphire 5G) | Sale | One-time |
| **Device Bundle** | `*BUNDLE*` | `S2GLOCALMEBLACKMATTE-BUNDLEUSA-100GB` | Sale | Device + Data |

### 💳 PHYSICAL PRODUCTS

| Type | Pattern | Example | Notes |
|------|---------|---------|-------|
| **SIM Cards** | `SIMCARD*` | `SIMCARDGLOBAL130-30-3GB` | Ships physically |
| **Rechargeable SIM** | `RECH-SIMCARD*` | `RECH-SIMCARDASIA-30-3GB` | Can reload |
| **Accessories** | Various | `T2BUMPERCASE`, `TWCARCHARGER` | High margin |
| **POS Systems** | `EPOS_*` | `EPOS_KIOSK` | Retail locations |

---

## Country Code Extraction Cheat Sheet

```python
# By Product Type
eSIM/FLEX:        country = sku.split('_')[0]         # FR_10GB_7D → FR
Sapphire/Rental:  country = sku.split('_')[1]         # DHI_US_FLOW* → US
Regional Combo:   countries = sku.split('_')[1].split('+')  # DHI_KW+EU28_* → ['KW','EU28']
TW Products:      region = sku.split('_')[3]          # TW_MANX_PostPaid_EUR_* → EUR
MANX Direct:      country = sku.split('_')[4]         # MANX_*_*_*_AF_* → AF
Hardware:         country = 'GLOBAL' or parse from bundle name
SIM Cards:        extract from name (GLOBAL, ASIA, EURO, etc.)
```

---

## Product Selection Decision Tree

```
Customer Need Assessment:
├── Needs Device?
│   ├── Yes → Rental or Purchase?
│   │   ├── Rental → S2GLOCALMERENT + Rental Plan (Adventure/Escape/Voyage)
│   │   └── Purchase → Sapphire Device + Separate Data or Bundle
│   └── No → Continue to Data Plans
│
├── eSIM Compatible Device?
│   ├── Yes → eSIM Products
│   └── No → Physical SIM Cards
│
├── Coverage Needed?
│   ├── Single Country → Country-specific SKU
│   ├── Multiple in Region → Regional SKU (EUR, ASIA)
│   ├── Country + Region → Combo SKU (KW+EU28)
│   └── Worldwide → GLOBAL SKU
│
├── Data Requirements?
│   ├── Light (1-3GB) → Adventure tier or small eSIM
│   ├── Medium (5-10GB) → Escape tier or standard eSIM
│   ├── Heavy (20-50GB) → Voyage tier or large eSIM
│   └── Unlimited → Unlimited variants
│
└── Customer Type?
    ├── Consumer → eSIM
    ├── Business → Rental Voyage or Sapphire
    └── Enterprise → Sapphire wholesale
```

---

## Margin Quick Reference

| Product Category | Typical Margin | Best Sellers |
|-----------------|----------------|--------------|
| **Accessories** | 50-70% | Screen protectors, Cases |
| **Rental Voyage** | 35-45% | Premium tier |
| **Hardware Sales** | 30-40% | Sapphire devices |
| **eSIM Standard** | 20-30% | 10GB/7D packages |
| **Rental Escape** | 25-30% | Mid tier |
| **Sapphire** | 15-25% | B2B wholesale |
| **Rental Adventure** | 15-20% | Entry tier |
| **Physical SIM** | 10-20% | Higher costs |

---

## Bundle Logic

### Device + Data Bundles
```python
# Bundle Components
bundle_sku = "S2GLOCALMEBLACKMATTE-BUNDLEUSA-100GB"
components = {
    'device': 'S2GLOCALMEBLACKMATTE',  # Sapphire 2 Black Matte
    'data': 'US_100GB_30D',             # 100GB USA Data
    'savings': 0.15,                     # 15% vs separate
}
```

### Rental Package (Device + Plan)
```python
# Rental always includes both
rental_package = {
    'device': 'S2GLOCALMERENT',         # Rental hotspot
    'plans': ['Adventure', 'Escape', 'Voyage'],  # Customer chooses
    'duration': 'trip_length',
    'return_required': True
}
```

---

## Legacy Product Handling

```python
legacy_patterns = {
    'FLEX': 'Still in system, may be active',
    'DHI_*_20220101': 'Date-stamped, check OpenSearch',
    'Speed-tier (3G/4G)': 'Legacy unlimited plans',
    'TW_*': 'Old branding, being phased out',
    'MANX_*': 'Direct provider, legacy structure'
}

# Always check OpenSearch for actual status
# Don't assume inactive based on pattern
```

---

## Special Cases

### Regional Combinations (Country + Region)
- Pattern: `DHI_KW+EU28_45GB_FP_30days`
- Covers: Kuwait PLUS all of Europe
- Pricing: Premium over single region
- Use case: Business travelers with specific + broad needs

### Test/Demo Products
- Pattern: Contains `TEST` or `DEMO`
- EXCLUDE from customer-facing systems
- Internal use only
- May have $0.01 pricing

### Speed-Tiered Unlimited (Legacy)
- 3G Speed: Throttled to 3G speeds after threshold
- 4G Speed: Throttled to 4G speeds after threshold
- Different from hard data caps
- Being phased out

---

## API Response Structure

```json
{
  "product": {
    "sku": "FR_10GB_7D",
    "name": "France 10GB 7 Days",
    "type": "eSIM",
    "subtype": "Standard",
    "country": "FR",
    "data_gb": 10,
    "validity_days": 7,
    "price_usd": 21.99,
    "margin": 0.25,
    "model": "App\\Models\\EsimPackage",
    "requires_shipping": false,
    "digital_delivery": true
  },
  "components": null,  // Or array if bundle
  "alternatives": [...],
  "inventory_status": "unlimited",  // or "in_stock" / "limited"
}
```

---

## Quick Lookups

### Most Common Packages by Destination

| Destination | Light Use | Standard | Heavy Use | Business |
|------------|-----------|----------|-----------|----------|
| **France** | `FR_3GB_7D` | `FR_10GB_7D` | `FR_20GB_15D` | `DHI_FR_DP10GB_Voyage` |
| **Europe** | `EUR_5GB_7D` | `EUR_10GB_15D` | `EUR_30GB_30D` | `DHI_EUR_DP10GB_Voyage` |
| **USA** | `US_5GB_7D` | `US_10GB_15D` | `US_30GB_30D` | `DHI_US_FLOW50GB30DAYS_C` |
| **Global** | `GLOBAL_5GB_15D` | `GLOBAL_10GB_30D` | `GLOBAL_20GB_30D` | `DHI_GL_DP10GB_Voyage` |

### Device Recommendations

| Customer Type | Device Recommendation | Why |
|--------------|----------------------|-----|
| **Tourist** | None (use own phone) | eSIM compatible phones |
| **Business** | Rental + Voyage plan | Premium support, no capex |
| **Digital Nomad** | Sapphire 5G purchase | Long-term value |
| **Family** | Sapphire 2 (hotspot) | Share connection |
| **Enterprise** | Fleet rental program | Managed service |

---

## Remember

1. **Every SKU has a country/region** - Extract it for financial analysis
2. **Model type determines system handling** - App\Models\* classification
3. **Rental devices need rental plans** - They work together
4. **Legacy ≠ Inactive** - Check OpenSearch
5. **Bundles save money** - 15% typical discount
6. **Physical products need shipping** - Add to timeline
7. **Test products are internal only** - Filter from customer views

This is your complete quick reference for ALL product types!
