# OpenSearch `orders` – Codex Cheat Sheet

> Short reference for generating queries and interpreting results.  
> For full details, see `opensearch_index_guide.md`.

---

## 1. Core Structure

- **Index:** `orders`
- **One document = one order**
- Line items: `order_details_data[]`
- Tracking info: `tracking_information[]`

### Key Fields

- `order_number` – external order id (e.g. `TWUS-252307`)
- `number` – internal numeric id
- `created_at` – **UNIX epoch seconds** (10-digit `long`)
- `threshold_date`, `return_threshold_date` – also epoch seconds

- `system` (use `system.keyword` for aggregations)
  - `TWUS`, `TWEU`, `TWCL`, etc.
  - `QRO` = **Quick Rental Orders**, internal module for staff-created orders (can be any product type: rentals, eSIMs, data plans, devices, etc.)

- `sales_chanel` (spelled exactly like this; use `sales_chanel.keyword`)
  - `TravelWifi`, `POS`, other partner channels

- `status`
  - Use `Completed` for revenue/demand analysis.

- Customer fields:
  - `customer_email` (keyword)
  - `customer_name` (text)
  - `customer_phone` (keyword)
  - `company_name` (text/keyword)

---

## 2. Money & Currency

Fields:

- `total` – order total in **original payment currency**
- `currency_iso` – `"USD"`, `"EUR"`, `"CHF"`, `"CLP"`, etc.
- `order_usd_rate_exchange` – **string**, meaning:  
  **local currency per 1 USD** (rate captured daily per currency)

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
Use normalized_total_usd for all cross-currency revenue/demand aggregations.

3. Product Modeling
There are two SKU layers:

Product level – product_sku (root + in order_details_data.product_sku)
→ what kind of product (eSIM, rental device, hardware device, insurance, etc.)

Package level – order_details_data.package_sku
→ what plan (GB, days, region, plan family like Adventure/Escape/Voyage)

3.1 Product Types (product_sku)
eSIM products

Presence of any of these ⇒ order is eSIM-based:

TW_eSIM – generic TW eSIM (any carrier)

TW_eSIM_VFNL – VFNL eSIM

TW_eSIM_MANX – MANX eSIM

TW_FLEX_ESIM_MANX – flexible MANX eSIM

Global_eSIMCard – global eSIM/SIM card product

Rental devices

S2GLOCALMERENT – local mobile hotspot rental device

Paired with data plan packages (usually DHI_*) in order_details_data.package_sku

Use trip_start / trip_end for rental duration

Devices for sale (Sapphire hardware)

TRWDEV808, TRWDEV809, TRWDEV810, TRWDEV811, …

Physical Sapphire devices sold outright

Not rentals (no per-day pricing)

Other

INSURANCE – insurance add-on, not connectivity

3.2 Packages (order_details_data.package_sku)
These describe the plan (GB, days, region, product line).

Local / country style

Pattern:

text
Copy code
{CC}_{XGB}_{YD}
{CC}_{YD}_Unlimited
Examples:

FR_5GB_3D, FR_30GB_30D

US_1GB_7D, US_5GB_30D, US_30D_Unlimited

EUR_1GB_7D, EUR_30GB_30D, EUR_30D_Unlimited

PL_30GB_30D, ES_7D_Unlimited, etc.

DHI “FLOW” plans

Pattern:

text
Copy code
DHI_{COUNTRY}_FLOW{DATA}{DAYS}_{YYYYMMDD}
Examples:

DHI_PL_FLOW30GB15DAYS_20230525

DHI_KW_FLOW200GB30DAYS_20250528

DHI_US_FLOW12GB30DAYS_20230525

Many others with country codes: US, PL, RO, KW, IQ, etc.

DHI “DP” plans (Adventure / Escape / Voyage)

Pattern:

text
Copy code
DHI_{COUNTRY}_DP{XGB}_{Adventure|Escape|Voyage}
Examples:

DHI_MX_DP1GB_Adventure

DHI_Europe_DP5GB_Escape

DHI_US_DP10GB_Voyage

DHI_FR_DP5GB_Escape

DHI_CA_DP10GB_Voyage, etc.

Regional / global

Examples:

DHI_EU28_40GB_FP_30days_20220101

DHI_EU28_10GB_FP_30days_20220101

DHI_GL_FLOW3GB30DAYS_20220101

DHI_GL_FLOW10GB30DAYS_20220101

4. Trip Dates (Line Items)
In order_details_data:

trip_start – date service/rental starts (ISO YYYY-MM-DD)

trip_end – date service/rental ends

qty – quantity of that package

For rentals (product_sku includes S2GLOCALMERENT):

text
Copy code
rental_days = (trip_end - trip_start) + 1   // inclusive
For eSIM/data plans:

trip_start/trip_end generally match the plan’s day count (7, 15, 20, 30, etc.).

Product behavior is “days or GBs, whatever expires first” in business logic; OpenSearch stores the intended date window.

5. Dates for Aggregations
created_at is epoch seconds; convert to date via runtime mapping when needed:

json
Copy code
"runtime_mappings": {
  "created_at_date": {
    "type": "date",
    "script": "emit(doc['created_at'].value * 1000L);"
  }
}
Then use created_at_date for:

date_histogram aggregations

calendar-based filtering

6. Typical Filters for Pricing / Analytics
Baseline filter set for most pricing/analytics queries:

json
Copy code
"query": {
  "bool": {
    "must": [
      { "term":  { "status": "Completed" } },
      {
        "terms": {
          "system.keyword": ["TWUS", "TWEU", "TWCL", "QRO"]
        }
      }
    ]
  }
}
Optionally add:

terms on sales_chanel.keyword (e.g. ["TravelWifi", "POS"])

must_not on total = 0 for revenue-focused metrics

7. Handy Aggregation Patterns
7.1 Distinct systems / statuses / channels
json
Copy code
GET orders/_search
{
  "size": 0,
  "aggs": {
    "systems": {
      "terms": { "field": "system.keyword", "size": 20 }
    },
    "statuses": {
      "terms": { "field": "status", "size": 20 }
    },
    "sales_channels": {
      "terms": { "field": "sales_chanel.keyword", "size": 20 }
    }
  }
}
7.2 Top product & package SKUs
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
7.3 Revenue by month (normalized USD)
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
        { "term": { "status": "Completed" } }
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
7.4 Split by product type (eSIM / rental / device sale)
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
8. Mental Model for Codex
Dataset slice = by system, sales_chanel, status (default Completed).

Product type = from product_sku (TW_eSIM*, S2GLOCALMERENT, TRWDEV8xx, INSURANCE, etc.).

Plan details = from order_details_data.package_sku (country/region, GB, days, plan family).

Time = created_at (epoch seconds) → runtime created_at_date for histograms.

Currency = total & currency_iso, always normalized to USD via total / order_usd_rate_exchange.

Use this cheat sheet to quickly build correct, production-safe OpenSearch queries.
