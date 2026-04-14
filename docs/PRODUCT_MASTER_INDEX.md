# Product Documentation Master Index

## Overview
This index provides Claude Code with a complete understanding of TravelWifi's product ecosystem, covering 8,293 SKUs across data plans, hardware, accessories, and services.

## Documentation Files

### 📚 Main Documentation
1. **[COMPLETE_PRODUCT_STRUCTURE.md](./COMPLETE_PRODUCT_STRUCTURE.md)**
   - Comprehensive product catalog structure
   - All product types and categories
   - Database model classifications
   - Country extraction logic
   - Business rules by category

2. **[PRODUCT_COMPLETE_GUIDE.md](./PRODUCT_COMPLETE_GUIDE.md)**
   - Quick reference for all products
   - Decision trees and lookups
   - Margin references
   - API response structures
   - Common scenarios

### 📊 Data Files (Source)
- **FinancePlanExport_4.csv** - Financial and pricing data (4,682 products)
- **Products.csv** - Complete product catalog (8,293 products)

---

## Key Product Categories Summary

### Core Data Products (Revenue Drivers)
| Category | SKU Pattern | Example | Margin | Count |
|----------|------------|---------|--------|-------|
| **eSIM** | `COUNTRY_##GB_##D` | `FR_10GB_7D` | 20-30% | 2,366 |
| **Sapphire** | `DHI_*_FLOW*` | `DHI_US_FLOW50GB30DAYS_C` | 15-25% | 490 |
| **Rental Plans** | `DHI_*_DP##GB_Tier` | `DHI_FR_DP10GB_Voyage` | 15-45% | 578 |

### Physical Products
| Category | Type | Margin | Inventory |
|----------|------|--------|-----------|
| **Devices** | Rental & Sale | 30-60% | Physical |
| **SIM Cards** | Traditional plastic | 10-20% | Physical |
| **Accessories** | Cases, chargers, etc. | 50-70% | Physical |

---

## Critical Implementation Notes for Claude Code

### 1. Product Identification
```python
# Primary identification flow
def identify_product(sku):
    # 1. Check for physical products first (SIM, Device, Accessory)
    # 2. Then check for rental tiers (Voyage/Escape/Adventure)
    # 3. Then check for Sapphire (DHI_ with FLOW)
    # 4. Then check for eSIM patterns
    # 5. Finally check legacy patterns
```

### 2. Country Extraction (MANDATORY)
```python
# Every financial analysis MUST extract country
def get_country(sku):
    # Country position varies by product type
    # eSIM: First part
    # Sapphire/Rental: Second part after DHI_
    # Regional combos: May have multiple (KW+EU28)
```

### 3. Active Status
```python
# NEVER assume active/inactive from SKU pattern
def check_status(sku):
    # Legacy products may still be active
    # New products may not be live yet
    # Always verify with OpenSearch
```

### 4. Rental Device + Plan Relationship
```python
# Rental devices ALWAYS need rental data plans
if device_sku == 'S2GLOCALMERENT':
    available_plans = ['Adventure', 'Escape', 'Voyage']
    # Customer must choose one
```

### 5. Bundle Handling
```python
# Bundles contain multiple components
if 'BUNDLE' in sku:
    # Extract device component
    # Extract data component  
    # Calculate total value and savings
```

---

## Product Lifecycle States

| State | Description | Customer Visible | Sellable |
|-------|-------------|-----------------|----------|
| **Active** | Currently selling | Yes | Yes |
| **Legacy** | Old but may be active | Check OpenSearch | Maybe |
| **Test** | Internal testing | No | No |
| **Discontinued** | No longer sold | No | No |
| **Coming Soon** | Not yet launched | Maybe | No |

---

## Quick Decision Matrix

### "What Product for This Customer?"

| Customer Scenario | Recommended Product | SKU Example |
|------------------|---------------------|-------------|
| **Week in Paris** | eSIM Standard | `FR_10GB_7D` |
| **Europe Tour** | eSIM Regional | `EUR_30GB_30D` |
| **Business Travel** | Rental Voyage | `DHI_EUR_DP10GB_Voyage` |
| **Family Vacation** | Device + Data Bundle | `S2GLOCALMEBLACKMATTE-BUNDLEUSA-50GB` |
| **Incompatible Phone** | Physical SIM | `SIMCARDGLOBAL130-30-3GB` |
| **Enterprise** | Sapphire Wholesale | `DHI_US_FLOW100GB30DAYS_C` |
| **Budget Backpacker** | Rental Adventure | `DHI_EU_DP1GB_Adventure` |

---

## Financial Analysis Requirements

### Essential Metrics by Product
```python
metrics = {
    'sku': 'Unique identifier',
    'product_type': 'Category for margin calc',
    'country': 'MANDATORY - market analysis',
    'revenue': 'Sale price',
    'cost': 'Wholesale/product cost',
    'margin': '(revenue - cost) / revenue',
    'model_type': 'App\Models\* classification',
    'physical': 'Requires shipping?',
    'recurring': 'Rental/subscription?'
}
```

### Margin Targets by Category
- **Premium** (Accessories, Voyage): 35-70%
- **Standard** (eSIM, Escape): 20-30%
- **Volume** (Sapphire, Adventure): 15-25%
- **Physical** (SIM cards): 10-20%

---

## Integration Points

### With OpenSearch
- Verify active/inactive status
- Pull real-time inventory
- Get historical sales data
- Track utilization patterns

### With Pricing Engine
- Apply seasonal multipliers (data plans only)
- Dynamic pricing based on demand
- Bundle discount calculations
- Competitive price monitoring

### With Inventory System
- Physical product stock levels
- Rental device fleet status
- SIM card activation codes
- Shipping timeline impact

---

## Common Pitfalls to Avoid

1. ❌ **Don't assume legacy = inactive**
   - Check OpenSearch for actual status

2. ❌ **Don't forget country extraction**
   - Required for ALL financial analysis

3. ❌ **Don't mix rental devices with standard eSIM**
   - Rental devices need rental plans

4. ❌ **Don't show test products to customers**
   - Filter TEST/DEMO SKUs

5. ❌ **Don't ignore physical shipping**
   - SIM cards and devices need delivery time

6. ❌ **Don't treat version numbers as different products**
   - Voyage, Voyage2, Voyage3 = same product

---

## Product Evolution Timeline

### Current State (2024-2025)
- **Primary**: eSIM digital delivery (60% of revenue)
- **Growing**: Device bundles, Rental programs
- **Stable**: Sapphire B2B, Physical SIM
- **Declining**: Legacy FLEX, Speed-tier plans

### Future Direction
- **Expanding**: Regional combinations (KW+EU28)
- **Developing**: 5G specific products
- **Testing**: IoT/M2M solutions
- **Phasing Out**: Physical SIM cards

---

## Support & Maintenance

### Adding New Products
1. Determine model type (App\Models\*)
2. Follow SKU naming convention
3. Ensure country code included
4. Set margin targets
5. Update OpenSearch
6. Test in staging

### Deprecating Products
1. Mark as legacy in system
2. Stop showing to new customers
3. Support existing users
4. Plan migration path
5. Archive after sunset period

---

## Quick Command Reference

```python
# Get all active eSIM products for France
SELECT * FROM products 
WHERE sku LIKE 'FR_%GB_%D' 
AND active = 1

# Find all rental devices
SELECT * FROM products 
WHERE sku LIKE '%RENT%' 
AND model = 'App\Models\Device'

# Get regional combinations
SELECT * FROM products 
WHERE sku LIKE '%+%'

# Identify high-margin opportunities
SELECT * FROM products 
WHERE margin > 0.35 
ORDER BY revenue DESC
```

---

## Final Notes

This documentation represents the complete TravelWifi product ecosystem. Claude Code should:

1. **Use these patterns** to identify products accurately
2. **Extract country codes** for financial analysis
3. **Check OpenSearch** for active status
4. **Apply business rules** by product type
5. **Consider relationships** (device↔plan, bundle components)
6. **Track margins** by category
7. **Filter appropriately** (no test products for customers)

Last Updated: November 2024
Total Products: 8,293 SKUs
Active Products: Check OpenSearch for current status
