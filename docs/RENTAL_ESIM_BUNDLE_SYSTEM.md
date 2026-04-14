# Rental & eSIM Bundle System Documentation

**Created:** 2025-12-06
**Purpose:** Detailed technical documentation of how rental devices, eSIM bundles, and data consumption tracking work in the TravelWifi system.

---

## Connection Endpoints (CRITICAL - Use These Exactly)

### RDS MySQL (Rental Database)
```yaml
# From config.yaml - DO NOT USE OTHER ENDPOINTS
host: dhi-ue1-rds-b2b-rd-p-003.cq5nv2yqkwlq.us-east-1.rds.amazonaws.com
port: 3306
database: rental
username: manny
password: Houston2025C0nnect
```

### OpenSearch (CDR Data)
```yaml
# From config.yaml - DO NOT USE OTHER ENDPOINTS
host: vpc-dhi-ue1-es-cdr-rd-p-001-ldezvy67i45lg65vseq5b4v2w4.us-east-1.es.amazonaws.com
port: 443
username: admin
password: Houston!TWcdrPRD2021
```

### Indices for CDR Data
| Index Pattern | Purpose |
|---------------|---------|
| `esim-archive-cdr_*` | eSIM CDR data (MANX/VFNL) - query by ICCID |
| `ucl-sim-cdr-*` | Sapphire/uCloudlink CDR - query by IMEI |
| `orders-*` | Order data |

---

## Overview

TravelWifi rentals use the **S2GLOCALMERENT** product SKU with data plans from the **Escape/Voyage/Adventure** tiers. These rental devices can operate in two modes:

1. **With eSIM Bundle** - Device paired with an eSIM card (ICCID) from MANX or VFNL provider
2. **Without eSIM (Sapphire Data)** - Device uses uCloudlink's native network directly

---

## Product & Package Structure

### Product SKU (What Customer Rents)
```
S2GLOCALMERENT - The physical MiFi rental device
```

### Package SKUs (Data Plans)
```
DHI_{REGION}_DP{DATA}GB_{TIER}

Examples:
- DHI_Europe_DP10GB_Voyage    → Europe, 10GB, Premium tier
- DHI_US_DP5GB_Escape         → United States, 5GB, Standard tier
- DHI_FR_DP1GB_Adventure      → France, 1GB, Budget tier
```

### Data Plan Tiers
| Tier | Data | Target |
|------|------|--------|
| **Voyage** | 10GB | Premium customers |
| **Escape** | 5GB | Standard customers |
| **Adventure** | 1GB | Budget customers |

---

## Database Schema

### Key Tables for Rental Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER FLOW                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  orders                                                          │
│    ├── id, number, system, status, created_at                   │
│    │                                                             │
│    └── order_details                                             │
│          ├── id, order_id, product_id, trip_start, trip_end     │
│          ├── package_data (JSON with SKU info)                  │
│          │                                                       │
│          └── order_detail_serials                                │
│                └── businesses_has_device_id ─────────────────┐   │
│                                                               │   │
└───────────────────────────────────────────────────────────────┼───┘
                                                                │
┌───────────────────────────────────────────────────────────────┼───┐
│                    DEVICE TRACKING                            │   │
├───────────────────────────────────────────────────────────────┼───┤
│                                                               │   │
│  businesses_has_devices ◄─────────────────────────────────────┘   │
│    ├── id                                                         │
│    ├── modelable_type = 'App\Models\Device'                      │
│    ├── modelable_id → devices.id                                 │
│    │                                                              │
│    └── devices                                                    │
│          ├── id                                                   │
│          └── imei (e.g., 869680026962802)                        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────┐
│                    eSIM BUNDLE ASSOCIATION                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  For devices WITH eSIM bundle:                                    │
│                                                                   │
│  devices (IMEI)                                                   │
│    └── businesses_has_devices (modelable_type='App\Models\Device')│
│          └── business_device_has_devices (BUNDLE LINK TABLE)     │
│                ├── id                                             │
│                ├── business_has_device_id (device side)          │
│                ├── device_id (eSIM side - links to bhd.id)       │
│                ├── created_at (bundled timestamp)                │
│                └── deleted_at (unbundled timestamp, NULL=active) │
│                      │                                            │
│                      └── businesses_has_devices                   │
│                            ├── modelable_type='App\Models\Esim'  │
│                            └── modelable_id → esims.id           │
│                                  │                                │
│                                  └── esims                        │
│                                        ├── id                     │
│                                        ├── iccid (eSIM ID)       │
│                                        ├── imsi                   │
│                                        ├── msisdn                 │
│                                        └── esim_provider_id      │
│                                              │                    │
│                                              └── esim_providers   │
│                                                    ├── id         │
│                                                    └── name       │
│                                                        (MANX/VFNL)│
└───────────────────────────────────────────────────────────────────┘
```

### Table Details

#### `orders`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| number | int | Order number (e.g., 65658) |
| system | varchar | System prefix (TWUS, TWEU, etc.) |
| status | varchar | Order status |
| created_at | timestamp | Order creation time |

#### `order_details`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| order_id | bigint | FK to orders |
| product_id | bigint | FK to products |
| package_data | JSON | Contains package SKU and details |
| trip_start | date | Rental start date |
| trip_end | date | Rental end date |

**package_data JSON example:**
```json
{
  "sku": "DHI_US_DP1GB_Adventure",
  "name": "United States - Adventure plan",
  "data_size": 1024,
  "country": "United States"
}
```

#### `order_detail_serials`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| order_detail_id | bigint | FK to order_details |
| businesses_has_device_id | bigint | FK to businesses_has_devices |

#### `businesses_has_devices`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| modelable_type | varchar | 'App\Models\Device' or 'App\Models\Esim' |
| modelable_id | bigint | FK to devices or esims |

#### `devices`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| imei | varchar | Device IMEI (15 digits) |
| status | varchar | Device status |

#### `business_device_has_devices` (BUNDLE LINK TABLE)
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| business_has_device_id | bigint | Device side (bhd.id for Device) |
| device_id | bigint | eSIM side (bhd.id for Esim) |
| created_at | timestamp | When bundle was created |
| deleted_at | timestamp | When bundle was removed (NULL = active) |

#### `esims`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| iccid | varchar | eSIM card ID (19-20 digits) |
| imsi | varchar | International Mobile Subscriber Identity |
| msisdn | varchar | Phone number |
| esim_provider_id | bigint | FK to esim_providers |

#### `esim_providers`
| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| name | varchar | Provider name (MANX, VFNL) |

---

## SQL Queries

### 1. Find Rental Orders with IMEIs
```sql
SELECT DISTINCT
    ods.businesses_has_device_id as bhd_id
FROM orders o
JOIN order_details od ON od.order_id = o.id
JOIN products p ON p.id = od.product_id
JOIN order_detail_serials ods ON ods.order_detail_id = od.id
WHERE p.sku = 'S2GLOCALMERENT'
  AND o.status != 'cancelled'
  AND od.package_data IS NOT NULL
  AND (od.package_data LIKE '%Escape%'
       OR od.package_data LIKE '%Voyage%'
       OR od.package_data LIKE '%Adventure%')
  AND ods.businesses_has_device_id IS NOT NULL
```

### 2. Get IMEI from businesses_has_device_id
```sql
SELECT
    bhd.id as bhd_id,
    d.imei
FROM businesses_has_devices bhd
JOIN devices d ON bhd.modelable_type = 'App\\Models\\Device'
              AND bhd.modelable_id = d.id
WHERE bhd.id IN (?, ?, ...)
  AND d.imei IS NOT NULL
```

### 3. Find eSIM Bundle by IMEI
```sql
SELECT
    d.imei,
    bdbd.id as bundle_id,
    bdbd.created_at as bundled_at,
    bdbd.deleted_at as unbundled_at,
    e.iccid,
    e.imsi,
    ep.name as esim_provider
FROM devices d
JOIN businesses_has_devices bhd
    ON bhd.modelable_type = 'App\\Models\\Device'
    AND bhd.modelable_id = d.id
JOIN business_device_has_devices bdbd
    ON bdbd.business_has_device_id = bhd.id
JOIN businesses_has_devices bhd2
    ON bhd2.id = bdbd.device_id
JOIN esims e
    ON bhd2.modelable_type = 'App\\Models\\Esim'
    AND bhd2.modelable_id = e.id
LEFT JOIN esim_providers ep
    ON ep.id = e.esim_provider_id
WHERE d.imei = ?
```

---

## Sample Data

### Example Rental IMEIs WITH eSIM Bundle
| IMEI | ICCID | Provider | Bundle Status |
|------|-------|----------|---------------|
| 869680026962802 | 8944538532049511326 | MANX | Active |
| 869680026719863 | 8944538532049511565 | MANX | Active |
| 869680026939321 | 8944538532049511714 | MANX | Active |
| 869680026977198 | 8944538532049510310 | MANX | Active |
| 867079040620987 | 8944538532054861970 | VFNL | Unbundled |

### Example Rental IMEIs WITHOUT eSIM (Sapphire Data)
| IMEI | Notes |
|------|-------|
| 869680026902535 | Uses uCloudlink network directly |
| 869680026697747 | No eSIM bundle in database |
| 867079041425428 | Sapphire Data only |
| 867079043047444 | No ICCID association |

---

## Analysis Results (Dec 2025)

### Rental Split Summary
| Category | Count | Percentage |
|----------|-------|------------|
| **Total Rental IMEIs** | 2,776 | 100% |
| With eSIM (ICCID) | 768 | 27.7% |
| Without eSIM (Sapphire) | 2,008 | 72.3% |

### eSIM Provider Breakdown
| Provider | Count | Percentage |
|----------|-------|------------|
| MANX | 474 | 61.7% |
| VFNL | 294 | 38.3% |

### Bundle Status
| Status | Count |
|--------|-------|
| Active bundles | 541 |
| Unbundled | 227 |

---

## Data Consumption Tracking

### For Rentals WITH eSIM
- **OpenSearch Index**: `esim-archive-cdr_*` (e.g., `esim-archive-cdr_2024-12`)
- **Query by**: ICCID or IMSI
- **Key field**: `BuyAmount` (data consumed in MB)

```json
{
  "query": {
    "bool": {
      "must": [
        {"term": {"iccid": "8944538532049511326"}}
      ]
    }
  }
}
```

### For Rentals WITHOUT eSIM (Sapphire Data)
- **OpenSearch Index**: `ucl-sim-cdr-*` (e.g., `ucl-sim-cdr-2025`)
- **Query by**: IMEI or device identifiers
- **Source**: UCL SIM CDR files from SFTP

---

## Key Business Rules

1. **Rental Detection**: `product_sku = 'S2GLOCALMERENT'`

2. **Data Plan Detection**: `package_data` contains Escape, Voyage, or Adventure

3. **eSIM Bundle Detection**:
   - If IMEI exists in `business_device_has_devices` chain → Has eSIM
   - If not → Uses Sapphire Data only

4. **Bundle Status**:
   - `deleted_at IS NULL` → Active bundle
   - `deleted_at IS NOT NULL` → Unbundled

5. **All rentals have**:
   - `trip_start` (rental start date)
   - `trip_end` (rental return date)

---

## Files & Cache

### Generated Analysis File
```
cache/rental_imei_analysis.json
```

Contains:
- `summary`: Total counts and percentages
- `providers`: Provider breakdown
- `imeis_with_esim`: List of IMEIs with ICCID, provider, status
- `imeis_without_esim`: List of IMEIs without eSIM bundle

---

## Common Mistakes to Avoid

1. **Wrong column name**: Use `businesses_has_device_id` (singular) not `businesses_has_devices_id`

2. **Wrong table for package**: Package SKU is in `package_data` JSON, not a separate esim_packages join

3. **Confusing modelable_type**:
   - `App\Models\Device` = MiFi device (has IMEI)
   - `App\Models\Esim` = eSIM card (has ICCID)

4. **Missing escape in SQL**: Use `App\\Models\\Device` (double backslash) in MySQL queries

5. **Assuming all rentals have eSIM**: Only 27.7% have eSIM bundles, majority use Sapphire Data

---

## QA Testing Checklist

- [ ] Verify rental orders query returns S2GLOCALMERENT products
- [ ] Verify package_data contains Escape/Voyage/Adventure
- [ ] Verify IMEI extraction from businesses_has_devices chain
- [ ] Verify eSIM bundle detection via business_device_has_devices
- [ ] Verify provider breakdown (MANX vs VFNL)
- [ ] Test with known sample IMEIs (see above)
- [ ] Confirm trip_start and trip_end dates exist

---

*Last Updated: 2025-12-06*
