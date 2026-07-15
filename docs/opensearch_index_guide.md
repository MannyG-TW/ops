# OpenSearch `orders` Index – Implementation Guide

> **Scope**
> 
> This document is the canonical reference for the `orders` index used by the pricing system.  
> Codex / agents should use this to:
> - Understand field names and types  
> - Interpret systems and sales channels  
> - Interpret products vs packages (eSIM, data plans, rentals, device sales)  
> - Normalize multi-currency totals into USD  

---

## 1. Index & Document Shape

### 1.1 Index

- **Index name:** `orders`
- **Document type:** `_doc`

Typical document (simplified):

```json
{
  "_index": "orders",
  "_type": "_doc",
  "_id": "TW:252307",
  "_source": {
    "order_number": "TWEU-252307",
    "system": "TWEU",
    "number": 252307,
    "balance": 0.0,
    "total": 3.49,
    "threshold_date": 1763257556,
    "return_threshold_date": 0,
    "delivery_address": "Digital",
    "return_address": "",
    "created_at": 1762825556,
    "customer_name": "Aldean Cassanova",
    "customer_email": "aldean.cassanova@yahoo.com",
    "customer_phone": "+1  4782136411",
    "company_name": "",
    "product_sku": [
      "TW_eSIM_VFNL",
      "EUR_1GB_7D"
    ],
    "status": "Completed",
    "warehouse": [],
    "serials": [
      "8944538532012895904"
    ],
    "shipping_methods": [],
    "shipping_methods_key": [],
    "sales_chanel": "TravelWifi",
    "sales_order_id": "TWEU-252307",
    "tracking_information": [],
    "tenant_id": "TW",
    "order_usd_rate_exchange": "1.000000",
    "currency_iso": "USD",
    "order_details_data": [
      {
        "product_sku": "TW_eSIM_VFNL",
        "trip_end": "2025-11-18",
        "trip_start": "2025-11-12",
        "package_sku": "EUR_1GB_7D",
        "qty": 1
      }
    ]
  }
}
2. Mapping Overview
2.1 Core Root Fields
From the index mapping:

json
Copy code
// NOTE: order_number, customer_email, and serials are `text` with a `.keyword`
// sub-field (NOT bare keyword). Exact/prefix/wildcard queries must target the
// `.keyword` sub-field (e.g. `order_number.keyword`) — see search route.
"properties": {
  "order_number":           { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
  "system":                 { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "number":                 { "type": "long" },
  "balance":                { "type": "float" },
  "total":                  { "type": "float" },
  "threshold_date":         { "type": "long" },
  "return_threshold_date":  { "type": "long" },
  "delivery_address":       { "type": "text" },
  "return_address":         { "type": "text" },
  "created_at":             { "type": "long" },
  "customer_name":          { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "customer_email":         { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
  "customer_phone":         { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "company_name":           { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "product_sku":            { "type": "keyword" },
  "status":                 { "type": "keyword" },
  "warehouse":              { "type": "keyword" },
  "serials":                { "type": "text", "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } } },
  "shipping_methods":       { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "shipping_methods_key":   { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "sales_chanel":           { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "sales_order_id":         { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "tenant_id":              { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
  "order_usd_rate_exchange": {
    "type": "text",
    "fields": { "keyword": { "type": "keyword" } }
  },
  "currency_iso": {
    "type": "text",
    "fields": { "keyword": { "type": "keyword" } }
  },
  "order_details_data": { "properties": { /* see below */ } },
  "tracking_information": { "properties": { /* see below */ } }
}
Important:

created_at, threshold_date, return_threshold_date are UNIX epoch seconds (10-digit long), not milliseconds.

product_sku at the root is an array of keywords.

status is already a keyword (no .keyword suffix required in queries).

2.2 order_details_data (Line Items)
json
Copy code
"order_details_data": {
  "properties": {
    "product_sku": {
      "type": "text",
      "fields": { "keyword": { "type": "keyword" } }
    },
    "package_sku": {
      "type": "text",
      "fields": { "keyword": { "type": "keyword" } }
    },
    "qty":        { "type": "long" },
    "trip_start": { "type": "date" },
    "trip_end":   { "type": "date" }
  }
}
Semantics:

order_details_data.product_sku
– The SKU for the product (eSIM, rental device, physical SIM, hardware device, etc.).

order_details_data.package_sku
– The SKU for the plan/package (GB, days, region, DHI vs local).

trip_start, trip_end
– ISO dates (YYYY-MM-DD) for when the service or rental is intended to run.

In most orders there’s one element in order_details_data, but the structure allows multiple line items.

2.3 tracking_information
json
Copy code
"tracking_information": {
  "properties": {
    "device_serial":            { "type": "long" },
    "fulfillment_id":           { "type": "long" },
    "shipping_carrier":         { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
    "shipping_tracking_number": { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
    "return_carrier":           { "type": "text", "fields": { "keyword": { "type": "keyword" } } },
    "return_tracking_number":   { "type": "text", "fields": { "keyword": { "type": "keyword" } } }
  }
}
3. Systems & Sales Channels
3.1 system – Source System
system indicates the internal system where the order was created. Common values:

Value	Meaning
TWUS	TravelWifi US storefront / backend
TWEU	TravelWifi Europe storefront / backend
TWCL	TravelWifi LATAM / Chile stack (exact region naming may vary)
QRO	Quick Rental Orders – internal agent/POS module; employees create orders for customers (any SKU)

Key points:

QRO is not limited to rentals. Through QRO, employees can create rentals, eSIMs, data plans, SIM cards, hardware sales, etc.

Do not infer “rental vs non-rental” purely from system. Use SKUs for product type.

3.2 sales_chanel – Sales Channel
Field is intentionally misspelled as sales_chanel.

Typical values:

TravelWifi – main web channel

POS – point-of-sale / in-store

Other partner/reseller channels may appear

You should treat system and sales_chanel as separate dimensions in aggregations and filters.

4. Currency & USD Normalization
4.1 Currency Fields
At order level:

total – order total in original payment currency.

currency_iso – ISO currency code ("USD", "EUR", "CHF", "CLP", etc.).

order_usd_rate_exchange – string representation of the exchange rate used that day.

Semantics:

order_usd_rate_exchange = amount of local currency per 1 USD.

Therefore, to convert total into USD:

text
Copy code
normalized_total_usd = total / order_usd_rate_exchange
Examples:

currency_iso = "USD", total = 19.99, order_usd_rate_exchange = "1.000000"
→ normalized_total_usd = 19.99 / 1 = 19.99

currency_iso = "EUR", total = 45.29, order_usd_rate_exchange = "0.847202"
→ normalized_total_usd ≈ 45.29 / 0.847202 ≈ 53.45

currency_iso = "CHF", total = 11.87, order_usd_rate_exchange = "0.792170"
→ normalized_total_usd ≈ 11.87 / 0.792170 ≈ 14.98

4.2 Runtime USD Field
Define a runtime field for normalized USD totals:

json
Copy code
"runtime_mappings": {
  "normalized_total_usd": {
    "type": "double",
    "script": """
      if (doc['order_usd_rate_exchange.keyword'].size() > 0 &&
          !doc['order_usd_rate_exchange.keyword'].value.isEmpty()) {
        double rate = Double.parseDouble(doc['order_usd_rate_exchange.keyword'].value);
        if (rate != 0) {
          emit(doc['total'].value / rate);
        }
      }
    """
  }
}
Use normalized_total_usd in aggregations for cross-currency reporting.

5. Product vs Package SKUs
There are two layers of SKUs:

Product SKU

At root: product_sku (array)

In line items: order_details_data.product_sku

→ Identifies what is being sold (eSIM, SIM card, rental device, Sapphire device, insurance, etc.).

Package SKU

order_details_data.package_sku

→ Identifies the plan / data bundle / validity (GB, days, region, product family).

5.1 eSIM Products
Product SKUs that indicate an eSIM:

TW_eSIM – generic TravelWifi eSIM (any network)

TW_eSIM_VFNL – VFNL network eSIM

TW_eSIM_MANX – MANX network eSIM

TW_FLEX_ESIM_MANX – flexible MANX eSIM

Global_eSIMCard – physical/global eSIM SIM card

If any of these appear in product_sku, the order is eSIM-based.
The exact country/GB/duration is taken from order_details_data.package_sku.

5.2 Rental Devices
Rental device product SKU:

S2GLOCALMERENT

This is a rental hotspot device (Go Local Me / Sapphire style rental).

When this appears in product_sku (root or order_details_data):

The device itself is a rental, not a sale.

It is paired with a data plan in order_details_data.package_sku, typically one of the DHI_* packages (see below).

Rental duration is determined by trip_start / trip_end.

5.3 Device Sales (Sapphire Hardware)
Sapphire hotspot devices that are sold outright:

TRWDEV808

TRWDEV809

TRWDEV810

TRWDEV811

These SKUs represent hardware sales (devices), not rentals.

The customer buys and keeps the device.

Data plans for these devices are represented by separate package SKUs (DHI_* etc.).

Do not apply rental-day pricing to TRWDEV* orders.

5.4 Data Plan / Package SKUs
The plan (GB, days, region) is encoded in order_details_data.package_sku.

Common patterns:

5.4.1 Local / Country Packages
Pattern:

text
Copy code
{COUNTRY_CODE}_{DATA}GB_{DAYS}D
{COUNTRY_CODE}_{DAYS}D_Unlimited
Examples:

FR_5GB_3D

FR_30GB_30D

US_1GB_7D, US_5GB_30D, US_30D_Unlimited

EUR_1GB_7D, EUR_30GB_30D, EUR_30D_Unlimited

PL_30GB_30D

ES_7D_Unlimited, etc.

5.4.2 DHI “FLOW” Plans
Pattern:

text
Copy code
DHI_{COUNTRY}_FLOW{DATA}{DAYS}_{YYYYMMDD}
Examples:

DHI_PL_FLOW30GB15DAYS_20230525

DHI_KW_FLOW200GB30DAYS_20250528

DHI_US_FLOW12GB30DAYS_20230525

DHI_RO_FLOW50GB30DAYS_20220101

These are often attached to Sapphire devices or rentals, but also eSIMs, depending on context.

5.4.3 DHI “DP” Plans (Adventure/Escape/Voyage)
Pattern:

text
Copy code
DHI_{COUNTRY}_DP{XGB}_{Adventure|Escape|Voyage}
Examples:

DHI_MX_DP1GB_Adventure

DHI_Europe_DP5GB_Escape

DHI_US_DP10GB_Voyage

DHI_FR_DP5GB_Escape

DHI_CA_DP10GB_Voyage

These can be paired with eSIMs, rental devices, or sold devices.

5.4.4 Regional/Global Packages
Examples:

DHI_EU28_40GB_FP_30days_20220101

DHI_EU28_10GB_FP_30days_20220101

DHI_GL_FLOW3GB30DAYS_20220101

DHI_GL_FLOW10GB30DAYS_20220101

6. Trip Dates & Behavior
In order_details_data:

trip_start – start date of service / rental (date mapping, ISO string).

trip_end – end date of service / rental.

Interpretation:

For eSIM/data plans, trip_start/trip_end often match the plan’s marketed validity window (e.g. 7, 15, 20, 30 days).

For rental devices (S2GLOCALMERENT), these define the rental period.

For rentals, use:

text
Copy code
rental_days = (trip_end - trip_start) + 1  // inclusive
If either date is invalid/missing, default to rental_days = 1 for safety and flag in QA reports.

7. Recommended Filters for Pricing & Analytics
7.1 Status
For normal revenue / demand analysis:

Default to status = "Completed".

You can allow additional statuses via configuration, but “Completed” is the safe default for “real” orders.

7.2 Systems
Use system.keyword. Example default set:

["TWUS", "TWEU", "TWCL", "QRO"]

These can be configured via filters.yaml or through a UI.

7.3 Sales Channels
Use sales_chanel.keyword. Examples:

["TravelWifi", "POS"]

Again, configurable via external filters.

7.4 Product Type Guardrails
Use SKU patterns:

eSIM / eSIM-based

Any of: TW_eSIM, TW_eSIM_VFNL, TW_eSIM_MANX, TW_FLEX_ESIM_MANX, Global_eSIMCard

Rental devices

S2GLOCALMERENT

Hardware sales (Sapphire)

TRWDEV808, TRWDEV809, TRWDEV810, TRWDEV811

Insurance / add-ons

INSURANCE (usually excluded from connectivity revenue optimizations)

8. Example Queries
8.1 Distinct Systems, Statuses, Sales Channels
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "systems": {
      "terms": {
        "field": "system.keyword",
        "size": 50
      }
    },
    "statuses": {
      "terms": {
        "field": "status",
        "size": 50
      }
    },
    "sales_channels": {
      "terms": {
        "field": "sales_chanel.keyword",
        "size": 50
      }
    }
  }
}
8.2 Top Product SKUs
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "product_skus": {
      "terms": {
        "field": "product_sku",
        "size": 200
      }
    }
  }
}
8.3 Top Package SKUs
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "package_skus": {
      "terms": {
        "field": "order_details_data.package_sku.keyword",
        "size": 200
      }
    }
  }
}
8.4 Latest Orders for a System
json
Copy code
GET orders/_search
{
  "size": 5,
  "query": {
    "term": {
      "system.keyword": "TWEU"
    }
  },
  "sort": [
    { "created_at": { "order": "desc" } }
  ]
}
Remember: created_at is a numeric epoch seconds field, so this is a numeric sort.

8.5 Runtime Fields: created_at_date and normalized_total_usd
json
Copy code
GET orders/_search
{
  "size": 0,
  "runtime_mappings": {
    "created_at_date": {
      "type": "date",
      "script": "emit(doc['created_at'].value * 1000L);"
    },
    "normalized_total_usd": {
      "type": "double",
      "script": """
        if (doc['order_usd_rate_exchange.keyword'].size() > 0 &&
            !doc['order_usd_rate_exchange.keyword'].value.isEmpty()) {
          double rate = Double.parseDouble(doc['order_usd_rate_exchange.keyword'].value);
          if (rate != 0) {
            emit(doc['total'].value / rate);
          }
        }
      """
    }
  },
  "query": {
    "bool": {
      "filter": [
        { "term":  { "status": "Completed" } },
        { "terms": { "system.keyword": ["TWUS", "TWEU", "TWCL", "QRO"] } }
      ]
    }
  },
  "aggs": {
    "revenue_by_month": {
      "date_histogram": {
        "field": "created_at_date",
        "calendar_interval": "month"
      },
      "aggs": {
        "usd_revenue": {
          "sum": { "field": "normalized_total_usd" }
        }
      }
    }
  }
}
8.6 Product-Type Split (eSIM vs Rental vs Device Sale)
json
Copy code
GET orders/_search
{
  "size": 0,
  "runtime_mappings": {
    "normalized_total_usd": {
      "type": "double",
      "script": """
        if (doc['order_usd_rate_exchange.keyword'].size() > 0 &&
            !doc['order_usd_rate_exchange.keyword'].value.isEmpty()) {
          double rate = Double.parseDouble(doc['order_usd_rate_exchange.keyword'].value);
          if (rate != 0) {
            emit(doc['total'].value / rate);
          }
        }
      """
    }
  },
  "query": {
    "term": { "status": "Completed" }
  },
  "aggs": {
    "by_product_type": {
      "filters": {
        "filters": {
          "esim": {
            "bool": {
              "should": [
                { "wildcard": { "product_sku": "TW_eSIM*" } },
                { "term": { "product_sku": "Global_eSIMCard" } }
              ]
            }
          },
          "rental_device": {
            "bool": {
              "should": [
                { "term": { "product_sku": "S2GLOCALMERENT" } }
              ]
            }
          },
          "device_sale": {
            "bool": {
              "should": [
                { "wildcard": { "product_sku": "TRWDEV8*" } }
              ]
            }
          }
        }
      },
      "aggs": {
        "usd_revenue": {
          "sum": {
            "field": "normalized_total_usd"
          }
        }
      }
    }
  }
}
9. Summary for Agents
Use system, sales_chanel, and status to define the dataset slice (configured via filters).

Use product_sku to determine product type:

eSIM vs rental device vs hardware sale vs insurance.

Use order_details_data.package_sku to understand country/region, GB, days, and plan family.

Always normalize totals to USD with:

normalized_total_usd = total / order_usd_rate_exchange.

Remember that created_at, threshold_date, and return_threshold_date are epoch seconds:

Sort on them directly.

When using date_histogram, create a runtime date: created_at * 1000L.

Rental devices are identified by S2GLOCALMERENT and use trip_start/trip_end to determine rental days.
Sapphire devices (TRWDEV808–811) are sold devices, not rentals.

go
Copy code

---

## Part 2 – Cheat Sheet (separate doc for Codex, e.g. `OPENSEARCH_CHEATSHEET.md`)

> ⬇️ **Create a new file** (for example `OPENSEARCH_CHEATSHEET.md` or `.claude/opensearch_orders_cheatsheet.md`) and paste this.

```markdown
# OpenSearch `orders` – Codex Cheat Sheet

## 1. Core Fields

- **Index:** `orders`
- **One doc = one order**
- Line items: `order_details_data[]`
- Tracking: `tracking_information[]`

### Identity & Time

- `order_number` – external order id, e.g. `TWUS-252307`
- `number` – internal numeric id
- `created_at` – **UNIX epoch seconds** (long)
- `threshold_date`, `return_threshold_date` – also epoch seconds

### Dimensions

- `system` (use `.keyword` when aggregating)
  - `TWUS`, `TWEU`, `TWCL`, `QRO`, etc.
  - **QRO = Quick Rental Orders** internal agent/POS; can create **any** product type.

- `sales_chanel` (spelled like this; use `.keyword`)
  - `TravelWifi`, `POS`, partners, etc.

- `status`
  - Use `Completed` for standard revenue/demand analysis.

- Customer fields:
  - `customer_email` (keyword)
  - `customer_name` (text)
  - `customer_phone` (keyword)
  - `company_name` (text / keyword)

---

## 2. Money & Currency

Fields:

- `total` – amount charged in `currency_iso`
- `currency_iso` – `"USD"`, `"EUR"`, `"CHF"`, `"CLP"`, etc.
- `order_usd_rate_exchange` – **string**; local currency per 1 USD

**Normalize to USD:**

```text
normalized_total_usd = total / order_usd_rate_exchange
Runtime mapping:

json
Copy code
"runtime_mappings": {
  "normalized_total_usd": {
    "type": "double",
    "script": """
      if (doc['order_usd_rate_exchange.keyword'].size() > 0 &&
          !doc['order_usd_rate_exchange.keyword'].value.isEmpty()) {
        double rate = Double.parseDouble(doc['order_usd_rate_exchange.keyword'].value);
        if (rate != 0) {
          emit(doc['total'].value / rate);
        }
      }
    """
  }
}
3. Product Modeling
3.1 Product Types (product_sku)
eSIM products

TW_eSIM – generic TW eSIM

TW_eSIM_VFNL – VFNL eSIM

TW_eSIM_MANX – MANX eSIM

TW_FLEX_ESIM_MANX – flexible MANX eSIM

Global_eSIMCard – global SIM/eSIM card product

If any of these appear, treat the order as eSIM-based (look at package_sku for plan details).

Rental devices

S2GLOCALMERENT – hotspot / Sapphire rental device product

Uses trip_start / trip_end for rental days.

Combined with a data plan package_sku.

Devices for sale (Sapphire hardware)

TRWDEV808, TRWDEV809, TRWDEV810, TRWDEV811, …

Physical Sapphire devices sold outright.

Not rentals (no per-day pricing).

Other

INSURANCE – insurance add-on (not connectivity).

3.2 Packages (order_details_data.package_sku)
These describe the plan (GB, days, region):

Local / country:

Pattern: {CC}_{XGB}_{YD} or {CC}_{YD}_Unlimited

Examples: FR_5GB_3D, US_5GB_30D, ES_7D_Unlimited, EUR_1GB_7D

DHI “FLOW” plans:

Pattern: DHI_{COUNTRY}_FLOW{DATA}{DAYS}_{YYYYMMDD}

Examples: DHI_PL_FLOW30GB15DAYS_20230525, DHI_KW_FLOW200GB30DAYS_20250528

DHI “DP” plans (Adventure/Escape/Voyage):

Pattern: DHI_{COUNTRY}_DP{XGB}_{Adventure|Escape|Voyage}

Examples: DHI_MX_DP1GB_Adventure, DHI_Europe_DP10GB_Voyage

Regional/global:

DHI_EU28_40GB_FP_30days_20220101

DHI_GL_FLOW3GB30DAYS_20220101

etc.

4. Trip Dates
In order_details_data:

trip_start (date) – usage / rental start

trip_end (date) – usage / rental end

qty – quantity for that package

For rentals (S2GLOCALMERENT):

text
Copy code
rental_days = (trip_end - trip_start) + 1  // inclusive
Use rental_days only where product is a rental.

5. Runtime Date for Histograms
created_at is epoch seconds; convert to date like:

json
Copy code
"runtime_mappings": {
  "created_at_date": {
    "type": "date",
    "script": "emit(doc['created_at'].value * 1000L);"
  }
}
Then use created_at_date in date_histogram aggregations.

6. Typical Filters for Pricing Queries
Start from:

status: Completed

system.keyword: ["TWUS", "TWEU", "TWCL", "QRO"]

sales_chanel.keyword: ["TravelWifi", "POS"] (configurable)

Exclude total = 0 for revenue.

Example:

json
Copy code
"query": {
  "bool": {
    "must": [
      { "term":  { "status": "Completed" } },
      { "terms": { "system.keyword": ["TWUS", "TWEU", "TWCL", "QRO"] } }
    ],
    "must_not": [
      { "term": { "total": 0 } }
    ]
  }
}
7. Handy Aggregations
7.1 Distinct systems / statuses / channels
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "systems":      { "terms": { "field": "system.keyword",           "size": 20 } },
    "statuses":     { "terms": { "field": "status",                  "size": 20 } },
    "sales_channels": { "terms": { "field": "sales_chanel.keyword",  "size": 20 } }
  }
}
7.2 Top product vs package SKUs
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "product_skus": {
      "terms": { "field": "product_sku", "size": 200 }
    },
    "package_skus": {
      "terms": { "field": "order_details_data.package_sku.keyword", "size": 200 }
    }
  }
}
7.3 Split by product type (eSIM / rental / device sale)
json
Copy code
GET orders/_search
{
  "size": 0,
  "runtime_mappings": {
    "normalized_total_usd": {
      "type": "double",
      "script": """
        if (doc['order_usd_rate_exchange.keyword'].size() > 0 &&
            !doc['order_usd_rate_exchange.keyword'].value.isEmpty()) {
          double rate = Double.parseDouble(doc['order_usd_rate_exchange.keyword'].value);
          if (rate != 0) {
            emit(doc['total'].value / rate);
          }
        }
      """
    }
  },
  "query": {
    "term": { "status": "Completed" }
  },
  "aggs": {
    "product_type": {
      "filters": {
        "filters": {
          "esim": {
            "bool": {
              "should": [
                { "wildcard": { "product_sku": "TW_eSIM*" } },
                { "term": { "product_sku": "Global_eSIMCard" } }
              ]
            }
          },
          "rental": {
            "bool": {
              "should": [
                { "term": { "product_sku": "S2GLOCALMERENT" } }
              ]
            }
          },
          "device_sale": {
            "bool": {
              "should": [
                { "wildcard": { "product_sku": "TRWDEV8*" } }
              ]
            }
          }
        }
      },
      "aggs": {
        "usd_revenue": {
          "sum": { "field": "normalized_total_usd" }
        }
      }
    }
  }
}
Mental model for Codex:

Root: one order, with system, sales_chanel, status, total, currency_iso, order_usd_rate_exchange, etc.

product_sku → “what it is” (eSIM / rental device / Sapphire device sale / insurance).

order_details_data.package_sku → “what plan” (GB, days, region, DHI vs local).

Always normalize with total / order_usd_rate_exchange for USD.

Treat S2GLOCALMERENT as rental, TRWDEV8xx as hardware sale, TW_eSIM* as eSIM.