# Product Categorization - Three Business Models

**Date:** November 14, 2025
**Status:** ✅ All code and queries updated to reflect three distinct business models

---

## Understanding Packages vs Products

**CRITICAL DISTINCTION:**

### What Customers Purchase:
1. **Packages (Data Plans)**: What customers purchase for eSIM, Rental, and Sapphire Data
   - eSIM packages: `FR_30GB_30D`, `US_10GB_30D`, `EUR_30D_Unlimited`
   - Rental packages: `DHI_PL_FLOW30GB15DAYS`, Voyage/Escape/Adventure plans
   - Sapphire Data packages: `DHI_Europe_DP10GB_Voyage`, `DHI_FR_DP5GB_Escape`

2. **Products (Hardware)**: Sapphire devices that customers MUST buy FIRST
   - Sapphire devices: `TRWDEV808` (Sapphire 3), `TRWDEV810` (Sapphire 5G), etc.
   - **You cannot have a Sapphire Data Plan without owning a Sapphire device first**

### Business Flow:
- **eSIM**: Customer → Purchase eSIM package → Use on their own phone
- **Rental**: Customer → Purchase rental package (includes device rental) → Return device
- **Sapphire**: Customer → **1) Buy Sapphire device** → **2) Purchase Sapphire Data packages**

---

## Overview: Three Ways We Sell Data to Customers

### 1. **eSIM** (100% Digital)
**Business Model:** Customers use their own device
**Target:** Individual travelers, personal use, 1-to-1 device

**Identification:**
- Product SKU: `TW_eSIM`, `TW_eSIM_VFNL`, `TW_eSIM_MANX`, `Global_eSIMCard`
- Package SKU: Standard country packages like `FR_30GB_30D`, `US_10GB_30D`, `EUR_30GB_30D`

**Examples:**
```
TW_eSIM + FR_30GB_30D
TW_eSIM_VFNL + ES_7D_Unlimited
Global_eSIMCard + EUR_30D_Unlimited
```

---

### 2. **Rentals** (Rent Device Per Day)
**Business Model:** Customer rents a device per day
**Target:** Short-term travelers who don't own a Sapphire device

**Identification:**
- Product SKU: `S2GLOCALMERENT` (rental product)
- Package SKU: Typically older `DHI_XX_FLOWXXGBXXDAYS` pattern or generic DHI packages

**Examples:**
```
S2GLOCALMERENT + DHI_PL_FLOW30GB15DAYS_20230525
S2GLOCALMERENT + DHI_PL_DPUNLIMITED
S2GLOCALMERENT + DHI_KW_FLOW100GB30DAYS_20220921
```

**Key Distinction:** If `S2GLOCALMERENT` is present, it's a RENTAL (per-day device rental)

---

### 3. **Sapphire Data Plans** (X GB for X Days)
**Business Model:** Customer MUST own a Sapphire device, buys data packages
**Target:** Customers who already purchased a Sapphire hotspot device

**Identification:**
- Product SKU: Usually other products (NOT S2GLOCALMERENT)
- Package SKU: `DHI_XX_DPXXXX` pattern with premium tiers:
  - **Voyage** - Premium tier
  - **Escape** - Mid tier
  - **Adventure** - Budget tier

**Examples:**
```
(Other Product) + DHI_Europe_DP10GB_Voyage
(Other Product) + DHI_FR_DP5GB_Escape
(Other Product) + DHI_SEAsia_DP1GB_Adventure
(Other Product) + DHI_ZA_DP3GB_Voyage
(Other Product) + DHI_Chile_DP5GB_Escape
```

**Key Distinction:** Has Voyage/Escape/Adventure tiers BUT does NOT have S2GLOCALMERENT

---

### 4. **Sapphire Hotspots** (Physical Hardware)
**What they are:** Physical devices that customers BUY (not analyzed in segment analysis)

**Device Models:**
| SKU | Device Name |
|-----|-------------|
| `TRWDEV808` | Sapphire 3 |
| `TRWDEV809` | Sapphire Power |
| `TRWDEV810` | Sapphire 5G |
| `TRWDEV811` | Sapphire Tablet |
| `TRWDEV820` | Sapphire Touch 4 |
| `T2GLOCALMEBLACK` | Sapphire T2 Black |
| `GNGRENTAL` | Additional rental device |

**CRITICAL:** Customers MUST purchase a Sapphire device BEFORE they can purchase Sapphire Data Plans (#3 above). You cannot have a Sapphire Data Plan without owning a Sapphire device first.

---

## Updated Files

### ✅ Code Files

**1. `opensearch_data_manager.py`**
- Product breakdown now shows FOUR categories:
  - eSIM orders (100% digital, use own device)
  - Rental orders (rent device per day - S2GLOCALMERENT)
  - Sapphire Data Plans (X GB for X days - requires owned device)
  - Sapphire Hotspots (hardware sales)
- Correctly identifies all four categories with clear business model descriptions

**2. `analyze_product_segments.py`**
- Updated to THREE-WAY analysis (eSIM / Rental / Sapphire Data)
- Added `rental_data` dictionary back alongside `esim_data` and `sapphire_data`
- Updated classification function:
  - `is_sapphire_data_order()` → `classify_order_segment()` (returns 'esim', 'rental', or 'sapphire_data')
- Updated output to create THREE CSV files:
  - `esim_destinations_analysis.csv`
  - `rental_destinations_analysis.csv`
  - `sapphire_data_destinations_analysis.csv`
- Updated display panels to show three segments:
  - "eSIM CUSTOMER ANALYSIS" - 100% digital
  - "RENTAL CUSTOMER ANALYSIS" - Rent device per day
  - "SAPPHIRE DATA PLAN CUSTOMER ANALYSIS" - X GB for X days
- Regional comparison table now shows all three segments

**3. `esim_pricing_agent.py`**
- Updated menu descriptions:
  - "Analyze eSIM vs Sapphire Data Plans" → "Analyze Product Segments (eSIM / Rental / Sapphire Data)"
  - Menu group description updated to mention all three segments
- Updated completion messages to reference all three output files
- Updated function docstrings to reflect three-way analysis

---

## Menu Changes

### Review Cached Data (Data Management → Review Cached Data)

**Now Shows Four Categories:**
```
Product Breakdown:
  • eSIM orders: 129,456 (79.0%) - 100% digital, use own device
  • Rental orders: 20,000 (12.2%) - Rent device per day
  • Sapphire Data Plans: 12,805 (7.8%) - X GB for X days, requires Sapphire device
  • Sapphire Device Sales: 1,664 (1.0%) - Hardware purchase

  Unique packages/products:
    • eSIM packages: 523 (data plans customers purchase)
    • Rental packages: 25 (Voyage/Escape/Adventure plans)
    • Sapphire Data packages: 45 (for owned devices)
    • Sapphire Devices: 7 (hardware customers must buy first)
```

**Key Distinction:**
- **Packages** = Data plans that customers purchase (eSIM, Rental, Sapphire Data)
- **Products** = Hardware devices that customers must buy first (Sapphire Devices only)

### Segment Analysis (Competitor & Persona Analysis → Analyze Product Segments)

**Menu Item Updated:**
- **Before:** "Analyze eSIM vs Sapphire Data Plans 📈"
- **After:** "Analyze Product Segments (eSIM / Rental / Sapphire Data) 📈"

**Output Shows Three Business Models:**
```
✓ Scanned 111,470 COMPLETED orders
  • eSIM orders: 88,356
  • Rental orders: 15,234
  • Sapphire Data Plan orders: 7,880
  • Unknown/Skipped: XXX
```

**Output Files (Three CSV files):**
- `cache/esim_destinations_analysis.csv`
- `cache/rental_destinations_analysis.csv`
- `cache/sapphire_data_destinations_analysis.csv`

**Display Panels:**
1. "eSIM CUSTOMER ANALYSIS" - 100% digital • Customers use their own device
2. "RENTAL CUSTOMER ANALYSIS" - Rent device per day • S2GLOCALMERENT product
3. "SAPPHIRE DATA PLAN CUSTOMER ANALYSIS" - X GB for X days • Requires owned Sapphire device

**Regional Comparison Table:**
- Shows all three segments side-by-side
- Columns: Region | eSIM Orders | Rental Orders | Sapphire Data Orders | Dominant

---

## Detection Logic

### Classification Priority (analyze_product_segments.py)

The `classify_order_segment()` function uses this priority order:

```python
def classify_order_segment(product_sku_list, package_sku):
    """Returns: 'rental', 'sapphire_data', or 'esim'"""

    # 1. CHECK FOR RENTAL FIRST (highest priority)
    for sku in product_sku_list:
        if 'S2GLOCALMERENT' in sku.upper():
            return 'rental'  # Rent device per day

    # 2. CHECK FOR SAPPHIRE DATA PLAN
    if package_sku:
        pkg_upper = package_sku.upper()

        # Check for tier names (Voyage/Escape/Adventure)
        if any(tier in pkg_upper for tier in ['VOYAGE', 'ESCAPE', 'ADVENTURE']):
            return 'sapphire_data'  # X GB for X days, owned device

        # Check for DHI_XX_DP pattern
        if 'DHI_' in pkg_upper and '_DP' in pkg_upper:
            return 'sapphire_data'

    # 3. DEFAULT TO eSIM (everything else)
    return 'esim'  # 100% digital, use own device
```

**Key Point:** S2GLOCALMERENT always means RENTAL (per-day device rental), even if the package has Voyage/Escape/Adventure tiers.

### Sapphire Hotspots (opensearch_data_manager.py)

Hardware device detection:

```python
sapphire_devices = [
    'TRWDEV808',  # Sapphire 3
    'TRWDEV809',  # Sapphire Power
    'TRWDEV810',  # Sapphire 5G
    'TRWDEV811',  # Sapphire Tablet
    'TRWDEV820',  # Sapphire Touch 4
    'T2GLOCALMEBLACK',  # Sapphire T2 Black
]

# Check if any product SKU matches
if any(device in sku.upper() for device in sapphire_devices):
    sapphire_device_orders += 1
```

---

## Sample Data from Your System

Based on the OpenSearch data pull (163,925 orders):

### Top eSIM Products (100% digital, use own device)
- `TW_eSIM`: 30,612 orders (18.7%)
- `TW_eSIM_VFNL`: 9,600 orders (5.9%)
- `TW_eSIM_MANX`: 9,181 orders (5.6%)
- `FR_30GB_30D`: 9,344 orders (5.7%)
- `Global_eSIMCard`: 3,785 orders (2.3%)

### Top Rental Packages (S2GLOCALMERENT - rent device per day)
- `S2GLOCALMERENT + DHI_PL_FLOW30GB15DAYS_20230525`: 6,195 orders
- `S2GLOCALMERENT + DHI_PL_DPUNLIMITED`: 4,828 orders
- `S2GLOCALMERENT + DHI_KW_FLOW100GB30DAYS_20220921`: 3,192 orders

**Note:** `S2GLOCALMERENT` appears in ~15,322 orders (9.3%) - these are RENTAL orders

### Top Sapphire Data Plan Packages (requires owned device, Voyage/Escape/Adventure tiers)
- `DHI_Europe_DP5GB_Escape`: 1,193 orders
- `DHI_FR_DP10GB_Voyage`: 887 orders
- `DHI_ES_DP10GB_Voyage`: 787 orders
- `DHI_Europe_DP10GB_Voyage`: ~500 orders
- `DHI_ZA_DP3GB_Voyage`: ~300 orders

### Sapphire Hotspot Device Sales (hardware)
- `TRWDEV808`: 1,364 orders (Sapphire 3)
- `TRWDEV810`: 521 orders (Sapphire 5G)
- `TRWDEV811`: 205 orders (Sapphire Tablet)
- `GNGRENTAL`: 87 orders

**Business Flow:** Customer buys a Sapphire device (above), then purchases Sapphire Data Plans for it.

---

## Verification

To verify the three-way categorization is working:

```bash
python esim_pricing_agent.py --menu
```

**1. Check Product Breakdown (Four Categories):**
   - Data Management → Review Cached Data & Timestamps
   - Should show:
     - eSIM orders (100% digital, use own device)
     - Rental orders (rent device per day)
     - Sapphire Data Plans (X GB for X days, requires owned device)
     - Sapphire Device Sales (hardware)

**2. Run Segment Analysis (Three Business Models):**
   - Competitor & Persona Analysis → Analyze Product Segments (eSIM / Rental / Sapphire Data)
   - Should show THREE separate analysis panels:
     1. eSIM Customer Analysis
     2. Rental Customer Analysis
     3. Sapphire Data Plan Customer Analysis
   - Should create THREE output files:
     ```bash
     ls -lh cache/*destinations_analysis.csv
     # Should show:
     # esim_destinations_analysis.csv
     # rental_destinations_analysis.csv
     # sapphire_data_destinations_analysis.csv
     ```

---

## Summary

### Three Business Models - Correctly Categorized:

1. **eSIM** (100% digital)
   - Customers use their own device (phone/tablet)
   - **Customers purchase PACKAGES**: FR_30GB_30D, US_10GB_30D, EUR_30D_Unlimited, etc.
   - Product identifiers: TW_eSIM, TW_eSIM_VFNL, Global_eSIMCard (for tracking only)

2. **Rentals** (rent device per day)
   - Customer rents a Sapphire device per day
   - **Customers purchase PACKAGES**: DHI_PL_FLOW30GB15DAYS, Voyage/Escape/Adventure plans, etc.
   - Product identifier: S2GLOCALMERENT (rental product, for tracking only)

3. **Sapphire Data Plans** (X GB for X days)
   - Customer MUST own a Sapphire device FIRST (cannot purchase without device)
   - **Customers purchase PACKAGES**: DHI_XX_DPXXXX with Voyage/Escape/Adventure tiers
   - Requires prior **PRODUCT purchase**: Sapphire 3, Sapphire 5G, etc. (hardware devices)

### Package vs Product Distinction:
- **PACKAGES** = Data plans that customers purchase (counted for eSIM, Rental, Sapphire Data)
- **PRODUCTS** = Hardware devices that customers buy (counted only for Sapphire Devices)
- **All three business models sell PACKAGES, only Sapphire requires PRODUCT purchase first**

### Code Changes:
- ✅ `opensearch_data_manager.py` - Shows 4 categories (eSIM, Rental, Sapphire Data, Sapphire Devices)
  - **Updated to count PACKAGES** for eSIM, Rental, and Sapphire Data (what customers purchase)
  - **Counts PRODUCTS only** for Sapphire Devices (hardware customers must buy first)
- ✅ `analyze_product_segments.py` - Three-way analysis with separate tracking for each business model
- ✅ `esim_pricing_agent.py` - Menu updated to "Analyze Product Segments (eSIM / Rental / Sapphire Data)"
- ✅ Classification function: `classify_order_segment()` returns 'esim', 'rental', or 'sapphire_data'
- ✅ Three CSV output files created for destination analysis
- ✅ All display panels, tables, and documentation updated
- ✅ **Package vs Product distinction** implemented across all scripts

**Key Detection Rule:** If S2GLOCALMERENT is present → it's a RENTAL (per-day device rental), NOT Sapphire Data Plan.

**Key Counting Rule:** Count PACKAGES for all data plans (eSIM, Rental, Sapphire Data), count PRODUCTS only for Sapphire Devices.

---

## 📋 Configuration Files (Added 2025-11-17)

### Centralized Product & Classification Configuration

To make product SKUs and classification rules easier to maintain and update manually, all product definitions and business logic are now stored in YAML configuration files:

#### **1. `config/product_skus.yaml`**
- **Purpose:** Central repository for all product SKUs
- **Sections:**
  - eSIM Products (active + discontinued)
  - Rental Products (+ INSURANCE add-on)
  - Sapphire Data Plans (with tier information)
  - Sapphire Hardware (TRWDEV* devices)
  - Other Products (placeholder)

**What's Included:**
```yaml
esim_products:
  active_skus:
    - TW_eSIM (30,612 orders, 18.7%)
    - TW_eSIM_VFNL (9,600 orders, 5.9%)
    - TW_eSIM_MANX (9,181 orders, 5.6%)

  discontinued_skus:
    - TW_FLEX_ESIM_MANX (failed product)
    - Global_eSIMCard (failed product)

rental_products:
  active_skus:
    - S2GLOCALMERENT (main rental, ~20,000 orders)
  add_ons:
    - INSURANCE (optional, per-day fixed price)

sapphire_data_plans:
  package_format: "DHI_{REGION}_DP{DATA}GB_{TIER}"
  tiers: [Voyage, Escape, Adventure]

sapphire_hardware:
  active_skus:
    - TRWDEV808 (Sapphire 3)
    - TRWDEV809 (Sapphire Power)
    - TRWDEV810 (Sapphire 5G)
    - TRWDEV811 (Sapphire Tablet)
    - TRWDEV820 (Sapphire Touch 4)
    - T2GLOCALMEBLACK (Sapphire T2 Black)
    - GNGRENTAL (Additional rental device)
```

**How to Update:**
1. Open `config/product_skus.yaml`
2. Add new SKUs to appropriate section
3. Mark discontinued products as `active: false`
4. Update order volumes when new data available
5. Validate: `python -c "import yaml; yaml.safe_load(open('config/product_skus.yaml'))"`

#### **2. `config/classification_rules.yaml`**
- **Purpose:** Business logic for classifying orders into segments
- **Priority Order:**
  1. Rental (highest priority - check first)
  2. Sapphire Data (second priority)
  3. Sapphire Hardware (third priority)
  4. eSIM (default for most orders)
  5. Unknown (fallback)

**Classification Logic:**
```yaml
rental:
  detection: "product_sku contains 'S2GLOCALMERENT'"
  priority: 1

sapphire_data:
  detection: "package_sku contains 'Voyage/Escape/Adventure'"
  must_not_have: "S2GLOCALMERENT"
  priority: 2

esim:
  detection: "product_sku starts with 'TW_eSIM'"
  excluded: ["TW_FLEX_ESIM_MANX", "Global_eSIMCard"]
  priority: 4
```

**Master Classification Function:**
```python
def classify_order_segment(product_sku_list, package_sku):
    # Priority 1: Rental
    if 'S2GLOCALMERENT' in product_sku_list:
        return 'rental'

    # Priority 2: Sapphire Data
    if package_sku:
        if any(tier in package_sku.upper() for tier in ['VOYAGE', 'ESCAPE', 'ADVENTURE']):
            if 'S2GLOCALMERENT' not in product_sku_list:
                return 'sapphire_data'

    # Priority 3: Sapphire Hardware
    if any(p in str(product_sku_list).upper() for p in ['TRWDEV', 'T2GLOCALMEBLACK', 'GNGRENTAL']):
        return 'sapphire_hardware'

    # Priority 4: eSIM (exclude failed products)
    if 'TW_ESIM' in str(product_sku_list).upper():
        if not any(x in str(product_sku_list).upper() for x in ['TW_FLEX_ESIM_MANX', 'GLOBAL_ESIMCARD']):
            return 'esim'

    # Priority 5: Unknown
    return 'unknown'
```

**How to Update:**
1. Open `config/classification_rules.yaml`
2. Modify priority order if business logic changes
3. Add new classification rules for new product types
4. Update exclusion lists for discontinued products
5. Validate: `python -c "import yaml; yaml.safe_load(open('config/classification_rules.yaml'))"`

---

### Key Clarifications (Added 2025-11-17)

#### **Failed/Discontinued Products:**
- **TW_FLEX_ESIM_MANX** - Failed product, exclude from eSIM analysis
- **Global_eSIMCard** - Failed product, exclude from eSIM analysis
- Both marked as `active: false` in `product_skus.yaml`

#### **INSURANCE Add-On:**
- **Product Type:** Add-on for rental orders ONLY
- **Pricing Model:** Fixed price per day
- **Optional:** Yes, customers can choose to add or not
- **Classification:** NOT counted as separate segment, part of rental revenue
- **Detection:** INSURANCE SKU present in order with S2GLOCALMERENT

#### **Sapphire Hardware Devices:**
- **Purpose:** Physical devices customers BUY (one-time purchase)
- **Prerequisite for:** Sapphire Data Plans (cannot purchase data plan without device)
- **Classification:** Separate from Sapphire Data Plans
- **Not Analyzed in:** Pricing analysis (hardware sales, not data plan pricing)

#### **Package SKU Formats:**
```
eSIM Packages:
  Format: {COUNTRY_CODE}_{DATA}GB_{DAYS}D
  Examples: FR_30GB_30D, US_10GB_30D, EUR_30GB_30D, ES_7D_Unlimited

Sapphire Data Packages:
  Format: DHI_{REGION}_DP{DATA}GB_{TIER}
  Examples:
    - DHI_Europe_DP10GB_Voyage
    - DHI_FR_DP5GB_Escape
    - DHI_SEAsia_DP1GB_Adventure
    - DHI_ZA_DP3GB_Voyage
    - DHI_Chile_DP5GB_Escape
  
  Tiers:
    - Voyage = Premium tier (highest price)
    - Escape = Mid tier (medium price)
    - Adventure = Budget tier (lowest price)
```

---

### Configuration Maintenance Workflow

**For adding new products:**
1. Update `config/product_skus.yaml` with new SKU
2. If new product type, update `config/classification_rules.yaml`
3. Validate YAML syntax
4. Test classification function
5. Update order volumes when data available

**For discontinuing products:**
1. Set `active: false` in `product_skus.yaml`
2. Add to `excluded_skus` in `classification_rules.yaml`
3. Document reason and date

**For changing business logic:**
1. Update priority order in `classification_rules.yaml`
2. Update detection logic
3. Test edge cases
4. Document change in metadata section

---

### References

- **Product SKUs:** `config/product_skus.yaml`
- **Classification Rules:** `config/classification_rules.yaml`
- **Complete SKU Reference:** `PRODUCT_SKU_REFERENCE.md`
- **Strategic Pricing Integration:** `STRATEGIC_PRICING_INTEGRATION.md`

**Last Updated:** 2025-11-17 - Configuration files created for easier manual maintenance

