# UCL SIM → Retail Plan Data Flow Analysis

**Analysis Date**: December 16, 2025

## Executive Summary

This analysis traces how wholesale UCL SIMs (IMSI) connect to retail data plans through device IMEIs. The link between wholesale SIM consumption and retail plan usage is established via the **device IMEI** (serial number).

---

## Data Architecture

### Key OpenSearch Indices

| Index | Records | Purpose |
|-------|---------|---------|
| `ucl-sim-cdr-2025` | 45.2M | UCL/uCloudlink CDR - Wholesale SIM usage |
| `daily_data_consumption_2025` | 147K | Aggregated retail data consumption |
| `orders` | 231K | eSIM orders only (not Rental/Sapphire) |
| `esim-archive-cdr_*` | Varies | eSIM CDR data (separate from UCL) |

### Field Mapping

**UCL SIM CDR (`ucl-sim-cdr-2025`)**
```
imsi        → SIM IMSI (e.g., "505038332439066")
imei        → Device IMEI (links to retail data)
user_code   → Customer identifier (email)
visit_mcc   → Mobile Country Code (where used)
visit_country → Country code (e.g., "AU")
flow_size_gb → Data consumed in GB
date        → Date of usage
```

**Daily Data Consumption (`daily_data_consumption_2025`)**
```
serial      → Device IMEI (links to UCL CDR)
package     → MongoDB ObjectId (plan identifier)
country     → Country of usage
data_consumed → Bytes consumed
date        → Date
```

---

## Australia SIMs Case Study

### 6 Australian Wholesale SIMs

| IMSI | Package | Provider | Capacity |
|------|---------|----------|----------|
| 505038332439066 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |
| 505038332439067 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |
| 505038332439068 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |
| 505038332439069 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |
| 505038332439065 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |
| 505038332439061 | DHI AU Vodafone (GDF)-30GB/Month | Vodafone | 30 GB |

**Total Wholesale Capacity**: 180 GB/month

### All-Time Consumption (2025)

| IMSI | Total GB | Used In |
|------|----------|---------|
| 505038332439068 | 112.52 | AU only |
| 505038332439067 | 81.79 | AU only |
| 505038332439069 | 67.62 | AU only |
| 505038332439066 | 62.97 | AU only |
| 505038332439061 | 58.61 | AU only |
| 505038332439065 | 61.87 | AU only |

**Total All-Time**: 445.38 GB

### October 2025 Detailed Analysis

**Wholesale Side (UCL CDR)**:
- Records: 980
- Consumption: 66.60 GB
- Unique Devices: 12
- Unique Users: 12

**Retail Side (Daily Consumption)**:
- Records: 32
- Consumption: 58.05 GB
- Packages: 10 different

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         WHOLESALE LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  6 AU SIMs (IMSI: 505038332439xxx)                                  │
│  Contract: DHI AU Vodafone 30GB/Month                               │
│  Total Capacity: 180 GB/month                                       │
│                                                                      │
│  Source: Excel (IMSI_ICCID with Contract Info.xlsx)                 │
│  CDR: ucl-sim-cdr-2025                                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │  LINK: IMEI (Device Serial)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DEVICE LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Sapphire Devices (12 unique in October)                            │
│                                                                      │
│  Example: IMEI 358913200053975                                       │
│    - Uses ALL 6 AU SIMs (pooling)                                    │
│    - Consumed 31.3 GB in October                                     │
│                                                                      │
│  Key: Same device uses multiple SIMs for load balancing             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │  LINK: serial = IMEI
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RETAIL LAYER                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Data Plans (MongoDB Package IDs)                                    │
│                                                                      │
│  Package: 61c974c4005b0b2a454e0529 → 35.7 GB                        │
│  Package: 5cdccfe08a124a77da6f4128 →  7.8 GB                        │
│  Package: 61c974c4005b0b2a454e04fd →  7.9 GB                        │
│  (Plan names stored in MongoDB, not OpenSearch)                      │
│                                                                      │
│  CDR: daily_data_consumption_2025                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Findings

### 1. IMSI/ICCID NOT in daily_data_consumption

The `daily_data_consumption` index does **not** contain IMSI or ICCID fields directly. The only link between wholesale SIMs and retail plans is through the **device IMEI**.

### 2. Multi-SIM Pooling

A single Sapphire device can use multiple SIMs. For example, IMEI `358913200053975` used all 6 AU SIMs in October, suggesting automatic SIM pooling for load balancing or failover.

### 3. Package IDs are MongoDB ObjectIds

The `package` field in `daily_data_consumption` contains MongoDB ObjectIds (e.g., `61c974c4005b0b2a454e0529`), not human-readable plan names. Plan name mapping would require access to MongoDB.

### 4. Rental Orders Not in OpenSearch

The `orders` index only contains eSIM/TravelWifi orders (231K records). Rental and Sapphire orders appear to be managed in a different system (likely MongoDB).

### 5. AU SIMs Only Used in AU

Unlike the "Borrowing" SIMs (UK MCC 234 used internationally), the 6 AU SIMs are only used within Australia. There's no roaming to other countries.

---

## Recommendations

1. **Create Package Name Mapping**: Export MongoDB package collection to map ObjectIds to plan names (e.g., "DHI_AU_10GB", "Voyage", etc.)

2. **Add IMSI to daily_data_consumption**: Consider enriching the daily consumption index with IMSI data for direct wholesale-retail tracing

3. **Rental Order Index**: Consider creating an OpenSearch index for Rental/Sapphire orders to enable comprehensive analytics

4. **Capacity Utilization Tracking**: Monitor 6 AU SIMs' 180GB capacity vs actual consumption (66.6 GB in October = 37% utilization)

---

## Investigation: Devices Missing from daily_data_consumption (December 2025)

### Problem Statement

Of the 12 devices using AU SIMs in October 2025, **5 devices** have UCL CDR data but **NO entries** in `daily_data_consumption`. This is a tracking gap - these devices are consuming SIM data at the wholesale level but not being recorded in the retail consumption tracking.

### Missing Devices Analysis

| IMEI | UCL CDR (Oct) | daily_data_consumption | User Type | Countries Used |
|------|---------------|------------------------|-----------|----------------|
| 867079041700556 | 8.99 GB | 0 GB | RENTAL B2C | AU (211), SG (3) |
| 358913200089532 | 5.78 GB | 0 GB | RENTAL B2C | AU (312), MY (54), ID (1) |
| 867079041497328 | 0.73 GB | 0 GB | RENTAL B2C | AU (52), SG (5) |
| 867079043281472 | 0.09 GB | 0 GB | Sapphire Data | AU only |
| 358913200163550 | 21.42 GB | 0 GB | Device Sale | TR (111), GR (10), HR (7), SG (6), AU (4) |

**Total Missing Consumption**: ~37 GB in October 2025

### User Code Patterns

The `user_code` field in UCL CDR reveals the device type:

1. **Rental Devices** (3 devices)
   - Pattern: `{IMEI}@travelwifib2c.com`
   - Examples:
     - `867079041700556@travelwifib2c.com`
     - `358913200089532@travelwifib2c.com`
     - `867079041497328@travelwifib2c.com`

2. **Sapphire Data / Device Sales** (2 devices)
   - Pattern: Real customer email
   - Examples:
     - `Maharajeddy@gmail.com` (device 867079043281472)
     - `ardnasnet@gmail.com` (device 358913200163550)

### Multi-SIM Usage

All 5 missing devices use multiple SIMs across different providers:

```
Device 867079041700556 (RENTAL):
  - AU SIMs: 505038332439061, 505038332439065, 505038332439066, 505038332439067, 505038332439068, 505038332439069
  - UK SIMs: 234588564111616, 234588564111633, 234588564111634, 234588564111643, 234588564111644, 234588564111645, 234588564111659, 234588564111668, 234588564111669
  - SG SIMs: 525016143174014, 525016143174137

Device 358913200163550 (DEVICE SALE):
  - AU SIMs: 505038332439067
  - UK SIMs: 234588564111615, 234588564111616, 234588564111619, etc.
  - NL SIMs: 204046957296808, 204046957296821, 204046957296854, 204046957296883, 204046957296963, 204046957296989
  - SG SIMs: 525016143174130
  - IT SIMs: 222101648105331, 222101648105400
```

### Root Cause Analysis

The tracking gap exists because:

1. **Different Data Sources**
   - `ucl-sim-cdr-*`: Populated from uCloudlink SFTP (raw SIM session data)
   - `daily_data_consumption_*`: Populated from a different system (likely device management platform)

2. **Missing Enrollment**
   - These devices may not be properly enrolled/registered in the system that generates `daily_data_consumption` data
   - The device management platform may not have visibility into these specific devices

3. **Rental vs Plan Tracking**
   - Rental devices operate under different business logic (per-day rental vs per-GB plan)
   - The consumption tracking system may not capture rental usage the same way as eSIM/Sapphire Data plans

### Data Flow Gap

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ UCL CDR (SFTP)                                                               │
│ ├─ Records ALL SIM sessions                                                   │
│ ├─ Source: uCloudlink network                                                 │
│ └─ ✓ Has data for all 5 missing devices                                       │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   │                                 │
                   ▼                                 ▼
┌─────────────────────────────────┐  ┌─────────────────────────────────┐
│ eSIM CDR                        │  │ daily_data_consumption          │
│ (esim-archive-cdr_*)            │  │ (daily_data_consumption_*)      │
│ ├─ eSIM plan consumption        │  │ ├─ Device plan consumption      │
│ ├─ Source: eSIM platform        │  │ ├─ Source: Device management    │
│ └─ Separate from UCL            │  │ └─ ✗ MISSING 5 devices          │
└─────────────────────────────────┘  └─────────────────────────────────┘
```

### Recommendations

1. **Investigate Device Registration**
   - Check if these 5 devices are properly registered in the device management system
   - Verify enrollment status in MongoDB device collection

2. **Cross-Reference with Orders**
   - Query `orders` index to find order history for these IMEIs
   - Check if rental orders exist for the rental devices

3. **Validate daily_data_consumption Population**
   - Identify the service/job that populates `daily_data_consumption`
   - Check logs for errors or skipped devices

4. **Consider Alternative Tracking**
   - For rental devices specifically, consumption may need to be calculated directly from UCL CDR
   - Create a reconciliation report: UCL CDR vs daily_data_consumption

### Impact Assessment

- **October 2025**: ~37 GB of data consumption not tracked in retail system
- **Business Impact**: Underreporting of rental/device consumption
- **Cost Analysis Impact**: These devices consume wholesale SIM data without corresponding retail tracking

---

## Appendix: Query Examples

### Find All Consumption for a Specific SIM
```python
query = {
    "query": {"term": {"imsi": "505038332439066"}},
    "aggs": {"monthly": {"date_histogram": {"field": "date", "calendar_interval": "month"}}}
}
client.search(index='ucl-sim-cdr-2025', body=query)
```

### Link Device to Retail Plans
```python
# Step 1: Get devices using specific SIMs
query1 = {"query": {"terms": {"imsi": ["505038332439066", ...]}}}
devices = client.search(index='ucl-sim-cdr-2025', body=query1)

# Step 2: Get retail consumption for those devices
device_imeis = [hit['_source']['imei'] for hit in devices['hits']['hits']]
query2 = {"query": {"terms": {"serial.keyword": device_imeis}}}
client.search(index='daily_data_consumption_2025', body=query2)
```
