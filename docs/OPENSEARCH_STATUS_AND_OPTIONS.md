# OpenSearch Data Status & Analysis Options

**Date:** November 14, 2025
**Status:** All scripts updated with correct rental patterns

---

## ✅ Updates Completed

### 1. Product Classification Logic Fixed

**Rental Products Now Detected By:**
- Product SKU: `S2GlocalMeRent` (case insensitive)
- Package SKU patterns:
  - `DHI_*_Voyage` (e.g., `DHI_Europe_DP10GB_Voyage`)
  - `DHI_*_Escape` (e.g., `DHI_FR_DP5GB_Escape`)
  - `DHI_*_Adventure` (e.g., `DHI_SEAsia_DP1GB_Adventure`)

**eSIM Products:**
- Product SKU: `TW_eSIM`
- Package SKU: `{COUNTRY}_{SIZE}_{DURATION}` (e.g., `FR_30GB_30D`)

**Files Updated:**
- ✅ `esim_pricing_agent.py` - Core classification logic
- ✅ `analyze_product_segments.py` - Segment analysis script
- ✅ `discover_opensearch_data.py` - Data discovery tool

### 2. Order Status Filtering Fixed

**Now Correctly Excludes:**
- 'Pending'
- 'Payment Pending'
- 'Pending Payment'
- 'Cancel'
- 'Decline'

**Only Analyzes:**
- 'Completed' (actual revenue)
- 'Waiting to be Pickup' (actual revenue)

---

## 📊 Current OpenSearch Data Status

### What We Found:

```
Total Orders: 1,000
├─ Pending Payment: 987 (❌ excluded)
├─ Completed: 12 (✅ usable)
└─ Waiting to be Pickup: 1 (✅ usable)

Usable Revenue Orders: 13 total
```

### The Problem:

Your OpenSearch currently only has **13 completed orders**, which is too few to do meaningful pricing analysis.

However, your **cached file** (`cache/top_countries_analysis.csv`) shows:
- 29,834 orders analyzed
- Top countries: ES (3,875), TW (3,603), US (2,135), DE (1,801), PL (1,639)

**Question:** Where did this cached data come from?
- Different time period?
- Different OpenSearch index?
- Production data vs test data?

---

## 🎯 Three Options Moving Forward

### Option 1: Use Cached Data (Recommended for now)

**What it is:**
- The file `cache/top_countries_analysis.csv` has 29,834 orders already analyzed
- Shows country-level breakdown with orders and revenue

**Pros:**
- ✅ Large dataset (29,834 orders)
- ✅ Can use for pricing decisions now
- ✅ Shows real demand patterns

**Cons:**
- ❌ Doesn't distinguish eSIM vs Rental
- ❌ Can't re-query for package details
- ❌ Don't know if data is current

**How to use it:**
```python
import pandas as pd
df = pd.read_csv('cache/top_countries_analysis.csv')

# Top countries by volume
print(df.head(20))

# EUR regional plan
eur = df[df['destination'] == 'EUR']
print(f"EUR: {eur['orders'].values[0]} orders, ${eur['total_revenue'].values[0]:,.2f} revenue")
```

**Pricing Decisions You Can Make:**
- Focus on top 20 countries (covers most volume)
- Set competitive prices for ES, TW, US (your top 3)
- EUR regional plan importance (if it appears in the data)

---

### Option 2: Analyze Pending Orders (For Patterns Only)

**What it is:**
- Modify script to include "Pending Payment" orders
- Analyze 987 orders to see eSIM vs Rental demand patterns
- **NOT for revenue projections** (not actual revenue)

**Pros:**
- ✅ Can see eSIM vs Rental split in demand
- ✅ Shows package preferences (Voyage vs Escape vs Adventure)
- ✅ Large enough sample (987 orders)
- ✅ Can segment by destination correctly

**Cons:**
- ❌ Not actual revenue (pending = might cancel)
- ❌ Can't use for financial projections
- ⚠️ Only use for understanding customer preferences

**When to use this:**
- If you want to see: "Are customers ordering more eSIM or Rental?"
- To understand: "Which rental tiers are popular (Voyage/Escape/Adventure)?"
- To know: "What countries have eSIM demand vs Rental demand?"

**I can create this version if you want**

---

### Option 3: Wait for Production Data

**What it is:**
- Wait until you have more "Completed" orders in OpenSearch
- Re-run analysis when you have 100+ completed orders

**Pros:**
- ✅ Real revenue data
- ✅ Accurate eSIM vs Rental segmentation
- ✅ Can trust the numbers for pricing

**Cons:**
- ❌ Have to wait
- ❌ Can't make pricing decisions now

---

## 🤔 My Recommendation

Based on what we know:

**For IMMEDIATE Pricing Decisions:**
1. Use the **cached data** (`cache/top_countries_analysis.csv`)
2. Focus on your top 20 countries
3. Use the competitor pricing we already gathered (117 products)
4. Apply the persona strategies from `CUSTOMER_PERSONA_PRICING_STRATEGY.md`

**For Understanding eSIM vs Rental Split:**
1. Let me create a "demand analysis" version that includes Pending Payment
2. This will show you the **pattern** of what customers want
3. Label it clearly as "DEMAND ANALYSIS (Not Revenue)"
4. Use it to understand if EUR is mostly eSIM or Rental

**For Future (When You Have Production Data):**
1. The scripts are ready
2. When you have 100+ completed orders, run `python analyze_product_segments.py`
3. It will properly segment eSIM vs Rental with real revenue

---

## 📝 What I Need From You

Please answer these questions so I can help you best:

1. **About the cached data:**
   - Where did `cache/top_countries_analysis.csv` come from?
   - Is it from a production OpenSearch export?
   - Should we trust it for pricing decisions?

2. **About EUR regional plan:**
   - You said EUR is very popular
   - Is EUR in the cached data?
   - Do you know if it's mostly eSIM or Rental from your experience?

3. **What to do now:**
   - A) Use cached data for pricing (29K orders, no eSIM/Rental split)
   - B) Analyze pending orders for patterns (987 orders, shows eSIM/Rental split)
   - C) Both - cached for pricing, pending for understanding patterns
   - D) Wait for more completed orders

4. **Rental package details:**
   - You gave examples: `DHI_Europe_DP10GB_Voyage`, `DHI_FR_DP5GB_Escape`
   - Are there more rental tiers beyond Voyage/Escape/Adventure?
   - What's the difference between them (pricing tiers, features)?

---

## 🛠️ Ready Scripts

All scripts are updated and ready:

### Discovery & Status
```bash
# See what's in OpenSearch
python discover_opensearch_data.py

# Check data status
python check_opensearch_data.py
```

### Analysis (When Data Available)
```bash
# Full eSIM vs Rental analysis (needs Completed orders)
python analyze_product_segments.py

# View competitor pricing
python update_competitor_pricing.py --view
```

### What I Can Create Next

If you want Option 2 (analyze pending for patterns), I can create:
```bash
# Demand pattern analysis (includes Pending Payment)
python analyze_demand_patterns.py  # <-- I'll create this if you want
```

---

## 📚 Documentation Available

1. **CUSTOMER_PERSONA_PRICING_STRATEGY.md**
   - eSIM vs Rental customer personas
   - Pricing psychology
   - Regional recommendations
   - A/B testing frameworks

2. **DATA_DRIVEN_COMPETITOR_ANALYSIS.md**
   - Competitor pricing by country
   - Market positioning
   - Pricing recommendations

3. **This file (OPENSEARCH_STATUS_AND_OPTIONS.md)**
   - Current data status
   - Options for analysis
   - What to do next

---

## 🎯 Bottom Line

**You have excellent competitor data** (117 products) and **persona research** (eSIM vs Rental behaviors).

**What you're missing:** Clear segmentation of YOUR actual eSIM vs Rental sales.

**Best path forward:** Tell me which option you prefer (A, B, C, or D above), and I'll help you make data-driven pricing decisions ASAP.

