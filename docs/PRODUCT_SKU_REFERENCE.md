# Complete Product SKU Reference

## ✅ eSIM Products (79% of business)

Customers use their own phone, 100% digital

### All eSIM Product SKUs:

1. **`TW_eSIM`** - Generic TravelWifi eSIM (any carrier)
2. **`TW_eSIM_VFNL`** - VFNL (Vodafone) network eSIM
3. **`TW_eSIM_MANX`** - MANX network eSIM
4. **`TW_FLEX_ESIM_MANX`** - Flexible MANX network eSIM
5. **`Global_eSIMCard`** - Global eSIM/SIM card product

### OpenSearch Query Pattern:

```json
{
    "bool": {
        "should": [
            {"wildcard": {"product_sku.keyword": "TW_eSIM*"}},
            {"wildcard": {"product_sku.keyword": "TW_FLEX_ESIM*"}},
            {"term": {"product_sku.keyword": "Global_eSIMCard"}}
        ],
        "minimum_should_match": 1
    }
}
```

**What this catches:**
- ✅ TW_eSIM
- ✅ TW_eSIM_VFNL
- ✅ TW_eSIM_MANX
- ✅ TW_FLEX_ESIM_MANX
- ✅ Global_eSIMCard

---

## 🔧 Rental Products (12% of business)

Customers rent a physical device

### All Rental Product SKUs:

1. **`S2GLOCALMERENT`** - Local rental device (rent per day)

### OpenSearch Query Pattern:

```json
{"term": {"product_sku.keyword": "S2GLOCALMERENT"}}
```

---

## 💎 Sapphire Data Plans (8% of business)

Customers must own a Sapphire device first

### Package SKU Patterns:

1. **`*VOYAGE*`** - Voyage tier data plans
2. **`*ESCAPE*`** - Escape tier data plans
3. **`*ADVENTURE*`** - Adventure tier data plans

### OpenSearch Query Pattern:

```json
{
    "bool": {
        "should": [
            {"wildcard": {"order_details_data.package_sku.keyword": "*VOYAGE*"}},
            {"wildcard": {"order_details_data.package_sku.keyword": "*ESCAPE*"}},
            {"wildcard": {"order_details_data.package_sku.keyword": "*ADVENTURE*"}}
        ],
        "minimum_should_match": 1,
        "must_not": [
            {"term": {"product_sku.keyword": "S2GLOCALMERENT"}}
        ]
    }
}
```

**Important:** Must exclude `S2GLOCALMERENT` to avoid counting rental orders

---

## 📊 Order Volume Distribution (from SAPPHIRE_PRODUCT_CATEGORIZATION.md)

### eSIM SKUs:
- `TW_eSIM`: 30,612 orders (18.7%)
- `TW_eSIM_VFNL`: 9,600 orders (5.9%)
- `TW_eSIM_MANX`: 9,181 orders (5.6%)
- `Global_eSIMCard`: 3,785 orders (2.3%)
- `TW_FLEX_ESIM_MANX`: (volume TBD)

### Rental SKUs:
- `S2GLOCALMERENT`: ~20,000 orders (12%)

### Sapphire Data SKUs:
- VOYAGE/ESCAPE/ADVENTURE packages: ~13,000 orders (8%)

---

## 🔍 How to Identify Product Type

### From `product_sku` field:

```python
def classify_order_segment(product_sku_list, package_sku):
    # 1. Check for rental first (highest priority)
    if 'S2GLOCALMERENT' in product_sku_list:
        return 'rental'

    # 2. Check for Sapphire Data
    if any(tier in package_sku for tier in ['VOYAGE', 'ESCAPE', 'ADVENTURE']):
        if 'S2GLOCALMERENT' not in product_sku_list:
            return 'sapphire_data'

    # 3. Check for eSIM
    esim_patterns = ['TW_ESIM', 'TW_FLEX_ESIM', 'GLOBAL_ESIMCARD']
    if any(pattern in str(product_sku_list).upper() for pattern in esim_patterns):
        return 'esim'

    # 4. Default to unknown
    return 'unknown'
```

---

## 🎯 Strategic Pricing System Usage

When you select a product type in the Strategic Pricing System:

### Option 1: eSIM
- Queries OpenSearch for orders with ANY of the 5 eSIM product SKUs
- Gets Top N countries by revenue for eSIM orders only
- Fetches competitor pricing for those countries
- Calculates pricing strategies specific to eSIM market

### Option 2: Rental
- Queries OpenSearch for orders with `S2GLOCALMERENT`
- Gets Top N countries by revenue for rental orders only
- Analyzes daily rental rates
- Different pricing model (per-day vs per-GB)

### Option 3: Sapphire Data
- Queries OpenSearch for orders with VOYAGE/ESCAPE/ADVENTURE packages
- Excludes rental orders (S2GLOCALMERENT)
- Gets Top N countries by revenue for Sapphire Data plans only
- Analyzes tiered data plan pricing

---

## ✅ Verification Checklist

Before running analysis, ensure:

- [ ] All 5 eSIM SKUs are included in query (not just TW_eSIM*)
- [ ] Global_eSIMCard is explicitly checked (not caught by wildcard)
- [ ] TW_FLEX_ESIM* pattern is included
- [ ] Rental detection uses exact match: `S2GLOCALMERENT`
- [ ] Sapphire Data excludes rental orders
- [ ] Package SKU is checked for Sapphire tiers

---

## 📚 References

- **Source:** `opensearch_index_guide.md:433`
- **Categorization:** `SAPPHIRE_PRODUCT_CATEGORIZATION.md`
- **Implementation:** `strategic_pricing_analysis.py:223-233`

---

**Last Updated:** 2025-11-17 (after fixing missing TW_FLEX_ESIM_MANX and Global_eSIMCard)

---

## 🔧 Configuration Files (Updated 2025-11-17)

### All Product SKUs and Classification Rules Now in YAML

For easier manual maintenance and updates, all product definitions and business logic have been moved to configuration files:

### **📋 config/product_skus.yaml**

Central repository for all product SKUs with order volumes and metadata.

**Structure:**
```yaml
esim_products:
  active_skus: [TW_eSIM, TW_eSIM_VFNL, TW_eSIM_MANX]
  discontinued_skus: [TW_FLEX_ESIM_MANX, Global_eSIMCard]

rental_products:
  active_skus: [S2GLOCALMERENT]
  add_ons: [INSURANCE]

sapphire_data_plans:
  package_format: "DHI_{REGION}_DP{DATA}GB_{TIER}"
  tiers: [Voyage, Escape, Adventure]

sapphire_hardware:
  active_skus: [TRWDEV808, TRWDEV809, TRWDEV810, ...]
```

**To update:**
1. Open `config/product_skus.yaml`
2. Add/remove SKUs in appropriate section
3. Update order volumes
4. Validate: `python -c "import yaml; yaml.safe_load(open('config/product_skus.yaml'))"`

### **📋 config/classification_rules.yaml**

Business logic for classifying orders into segments with priority rules.

**Structure:**
```yaml
classification_priority:
  1: rental           # Check first
  2: sapphire_data    # Check second
  3: sapphire_hardware
  4: esim             # Default
  5: unknown          # Fallback

rental:
  detection: "product_sku contains S2GLOCALMERENT"
  opensearch_query: {...}

sapphire_data:
  detection: "package_sku contains Voyage/Escape/Adventure"
  must_not_have: "S2GLOCALMERENT"
  opensearch_query: {...}
```

**To update:**
1. Open `config/classification_rules.yaml`
2. Modify priority order or detection logic
3. Add new classification rules
4. Test with: `python -c "from classification_engine import classify_order"`

---

## ⚠️ Important Product Updates (2025-11-17)

### **Failed Products - Do NOT Include in Analysis:**

1. **TW_FLEX_ESIM_MANX**
   - Status: Discontinued/Failed
   - Order Volume: Unknown
   - Action: Excluded from eSIM queries
   - Location: `discontinued_skus` in `product_skus.yaml`

2. **Global_eSIMCard**
   - Status: Discontinued/Failed
   - Order Volume: 3,785 orders (historical)
   - Action: Excluded from eSIM queries
   - Location: `discontinued_skus` in `product_skus.yaml`

### **INSURANCE Add-On:**

- **Type:** Optional add-on for rental orders ONLY
- **Pricing:** Fixed price per day
- **Not a Segment:** Counted as part of rental revenue, not separate
- **Detection:** INSURANCE SKU with S2GLOCALMERENT
- **Location:** `rental_products.add_ons` in `product_skus.yaml`

### **Sapphire Hardware:**

All `TRWDEVXXX` devices are **hardware sales**, not data plans:
- TRWDEV808, TRWDEV809, TRWDEV810, TRWDEV811, TRWDEV820
- T2GLOCALMEBLACK, GNGRENTAL

**Not analyzed in pricing:** These are one-time device purchases, not recurring data plans.

---

## 🔍 Updated Detection Logic

### eSIM (Corrected):

**Active Products ONLY:**
```python
# OLD (incorrect - included failed products)
{"wildcard": {"product_sku.keyword": "TW_eSIM*"}}

# NEW (correct - excludes failed products)
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

**Active eSIM SKUs:**
- ✅ TW_eSIM
- ✅ TW_eSIM_VFNL
- ✅ TW_eSIM_MANX
- ❌ TW_FLEX_ESIM_MANX (failed)
- ❌ Global_eSIMCard (failed)

---

## 📊 Complete Product Hierarchy

```
TravelWifi Products
│
├── 🟢 eSIM Products (79% - 3 active SKUs)
│   ├── TW_eSIM (generic)
│   ├── TW_eSIM_VFNL (Vodafone)
│   ├── TW_eSIM_MANX (MANX)
│   └── Package format: {COUNTRY}_{DATA}GB_{DAYS}D
│
├── 🔧 Rental Products (12% - 1 active SKU)
│   ├── S2GLOCALMERENT (main rental)
│   ├── INSURANCE (optional add-on)
│   └── Pricing: Per day
│
├── 💎 Sapphire Data Plans (8%)
│   ├── Package format: DHI_{REGION}_DP{DATA}GB_{TIER}
│   ├── Tiers: Voyage (premium) / Escape (mid) / Adventure (budget)
│   └── Prerequisite: Must own Sapphire device first
│
├── 🖥️ Sapphire Hardware (Not in pricing analysis)
│   ├── TRWDEV808, 809, 810, 811, 820
│   ├── T2GLOCALMEBLACK
│   ├── GNGRENTAL
│   └── One-time purchases, not recurring data plans
│
└── ❌ Discontinued/Failed Products (Excluded)
    ├── TW_FLEX_ESIM_MANX
    └── Global_eSIMCard
```

---

## 🎯 Validation Checklist

Before running any analysis:

- [ ] Check `config/product_skus.yaml` for latest SKU list
- [ ] Verify failed products are excluded
- [ ] Confirm classification priority in `config/classification_rules.yaml`
- [ ] Validate YAML syntax
- [ ] Test classification function with sample orders

**Last Updated:** 2025-11-17 - Configuration files created, failed products documented

