# uCloudlink VSIM CDR Description

CDR (Call Detail Records) for DHI SIM card usage. Download CDR files via SFTP.

## Business Context

This VSIM CDR tracks **SIM-level consumption** for Sapphire Data Plans used by:
- **S2Glocalmerent** (Rentals)
- Sapphire data plan products

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  SIM Pool (uCloudlink VSIM)                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ SIM #1  │  │ SIM #2  │  │ SIM #3  │  ...                │
│  │ 100 GB  │  │ 100 GB  │  │ 100 GB  │                     │
│  └────┬────┘  └────┬────┘  └─────────┘                     │
│       │            │                                        │
│       ▼            ▼                                        │
│  ┌─────────────────────────────────────┐                   │
│  │  Sapphire Data Plans (Customer)     │                   │
│  │  10GB, 10GB, 10GB, 10GB... → depletes SIM #1            │
│  │  then auto-moves to SIM #2                              │
│  └─────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### CDR Types

| CDR Source | Level | Purpose |
|------------|-------|---------|
| **This VSIM CDR (uCloudlink SFTP)** | SIM-level | Raw SIM consumption - use for cost calculations |
| OpenSearch CDR (not eSIM) | Plan-level | Customer-purchased plan usage |

### Why SIM-Level CDR Matters

The VSIM CDR is critical for cost analysis because:
1. Each SIM has a fixed monthly allocation (e.g., 100 GB)
2. Multiple customer plans draw from the same SIM pool
3. When one SIM depletes, system moves to next SIM
4. SIM-level data = actual wholesale cost basis

## SFTP Connection

| Parameter | Value |
|-----------|-------|
| Server | 13.228.222.204 |
| Port | 31100 |
| Username | DHI |
| Password | nFM8nJuLvMNRWdPs |

```bash
sftp -P 31100 DHI@13.228.222.204
```

## File Structure

### File Path

```
/YYYYMMDD/VSIM_HD_{MVNO_CODE}_{TIMESTAMP}{SEQ}.txt
```

Date folders are at SFTP root (`/`). Each folder contains CDR files for that day.

**Note:** Documentation mentioned `/ftphome/HD/DHI/downfiles` but actual structure uses root-level date folders.

### File Naming Convention

```
VSIM_HD_{MVNO_CODE}_{YYYYMMDDHHMMSS}{SEQUENCE}.txt
```

Example: `VSIM_HD_CMMIA_2015040209541200001.txt`

## CDR File Format

Columns separated by `|`, rows separated by `\n`

| # | Field | Description | Notes |
|---|-------|-------------|-------|
| 1 | ID | Record ID | Unique identifier |
| 2 | IMSI | IMSI | 15 digits |
| 3 | StartTime | Session start | Unix timestamp (ms) |
| 4 | EndTime | Session end | Unix timestamp (ms) |
| 5 | IMEI | Device IMEI | 15 digits |
| 6 | UserCode | User identifier | |
| 7 | VisitMcc | MCC code | e.g., 460 = China |
| 8 | FlowSize | Data volume | Bytes |
| 9 | VisitCountry | Country code | ISO 2-letter |

### Example Record

```
1|4601101234567891|1463402341068|1463402341068|862238037488940|987654321@default.g2|460|52736000|CN
```

## Operational Notes

1. **Generation frequency**: One `.txt` file per 30 minutes, one folder per day (~48 files/day)
2. **Time lag**: ~2.5-3.0 hours from session to file availability
3. **Timestamps in filenames**: GMT+0 (file creation time)
4. **Data aggregation**: Multiple records per VSIM if any of ~24 aggregation terms differ
5. **Retention**: ~8 months available (251 folders as of Dec 2025, back to April 2025)

---

## Data Sources Summary

| Source | Location | Data Type | Granularity |
|--------|----------|-----------|-------------|
| **SFTP CDR** | uCloudlink SFTP (/) | Raw SIM consumption | Per-session, per-IMEI, per-country |
| **Excel Contracts** | `ucl_sim_contracts/*.xlsx` | SIM inventory + monthly aggregates | Per-country/provider totals |
| **RDS** | MySQL database | Device/SIM inventory | Bundle associations |
| **OpenSearch** | CDR indices | Plan-level consumption | Customer usage |

### Excel Contract File

Located at: `ucl_sim_contracts/Sim Cost-Usage as of 13NOV2025.xlsx`

Sheet: **Current Cloud Sims** (14 columns):
- Pymt Company, Country, Provider
- Current Term Expiration (MTM or date)
- # of Sims, Gb per Sim, Total Gb
- Currency, Cost per Sim, USD Cost per Sim, USD Monthly Cost (no tax)
- AUG/SEP/OCT 2025 Consumption GB

---

## What CDR Data Can Be Used For

### With 7 days of CDR:
1. **Real-time usage snapshot** - Which SIMs/countries are active NOW
2. **Validate Excel data** - Compare CDR consumption to monthly Excel figures
3. **Hourly/daily patterns** - When does usage peak?
4. **Device-level tracking** - IMEI consumption breakdown
5. **Cost per GB** - Calculate actual $/GB from CDR + contract costs

### Pulling More History:
```
Days back [7]: 7     # Last week (default)
Days back [7]: 30    # Last month
Days back [7]: 60    # Last 2 months
Days back [7]: 90    # Last 3 months
Days back [7]: 250   # Everything available (~8 months)
```

### CDR vs Excel Comparison

| Aspect | CDR (SFTP) | Excel (Contracts) |
|--------|------------|-------------------|
| **Purpose** | Raw session data | Monthly reporting |
| **Granularity** | Per-session, per-IMEI | Per-provider monthly |
| **Timeliness** | ~3 hour lag | Monthly snapshot |
| **Use case** | Real-time analysis, validation | Cost tracking, contracts |

CDR gives the **details** behind the Excel summaries.

---

## Menu Access

From main menu: **UCL SIM Analysis**

| Option | Description |
|--------|-------------|
| **SFTP Operations** | |
| Pull SFTP CDR Data | Download CDR files from UCL (staging to local) |
| View Cached CDR Files | Show downloaded files by date |
| **OpenSearch Operations** | |
| Full Backfill to OpenSearch | Import all cached files (first time) |
| Incremental Sync to OpenSearch | Import only new files |
| Show OpenSearch Sync Status | View import progress and counts |
| Delete UCL CDR Indices | Remove ucl-sim-cdr-* indices (careful!) |
| **Analysis (from OpenSearch)** | |
| CDR Analysis by Country | Aggregate CDR data by country |
| SIM Inventory Dashboard | Excel data with utilization % |
| RDS Device/SIM Summary | Database device counts |
| Bundle Lookup by IMEI | Device-specific bundle history |
| Full Analysis | Combine all data sources |

---

## Local Cache Structure

```
cache/ucl_sim/
├── cdr_files/           # SFTP CDR files (STAGING ONLY - by date folder)
│   ├── 20251127/
│   │   └── VSIM_HD_DHI_*.txt
│   └── 20251128/
├── contracts/           # Cached Excel data
├── reports/             # Generated analysis reports (JSON)
└── snapshots/           # Point-in-time analysis snapshots
```

**IMPORTANT:** Local cache is STAGING ONLY. All analysis should query OpenSearch.

**Note:** CDR txt files are in `.gitignore` (too large). Reports/snapshots are tracked.

---

## OpenSearch Integration (Dec 2025)

### Data Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  UCL SFTP Server                                                │
│  (13.228.222.204:31100)                                         │
│  ~249 days history (Apr - Dec 2025)                             │
└───────────────────┬─────────────────────────────────────────────┘
                    │ Pull CDR Files
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Local Cache (STAGING ONLY)                                     │
│  cache/ucl_sim/cdr_files/YYYYMMDD/*.txt                         │
│  - Temporary storage before OpenSearch push                     │
│  - NOT for analysis                                             │
└───────────────────┬─────────────────────────────────────────────┘
                    │ Parse + Transform + Bulk Import
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenSearch (ANALYSIS TARGET)                                   │
│  Index Pattern: ucl-sim-cdr-YYYY (yearly)                       │
│  - ucl-sim-cdr-2025 (~10GB, ~34M records/year)                  │
│  - ucl-sim-cdr-2024                                             │
│  - ucl-sim-cdr-2023                                             │
│  Safety: Only operates on ucl-sim-cdr-* prefix                  │
└─────────────────────────────────────────────────────────────────┘
```

### Index Strategy

| Aspect | Value | Rationale |
|--------|-------|-----------|
| Pattern | `ucl-sim-cdr-YYYY` | Yearly indices |
| Shard Size | ~10 GB/year | Optimal 10-50GB range |
| Records/Year | ~34 million | ~136K/day × 250 days |
| Safety Prefix | `ucl-sim-cdr-*` | Prevents touching production indices |

### Derived Fields

When importing to OpenSearch, these fields are **automatically calculated**:

| Field | Calculation | Type | Purpose |
|-------|-------------|------|---------|
| `flow_size_gb` | flow_size / (1024³) | float | Human-readable size |
| `flow_size_mb` | flow_size / (1024²) | float | Human-readable size |
| `start_time_iso` | Unix ms → ISO 8601 | date | Queryable timestamp |
| `end_time_iso` | Unix ms → ISO 8601 | date | Queryable timestamp |
| `duration_seconds` | (end_time - start_time) / 1000 | integer | Session duration |
| `date` | start_time → YYYY-MM-DD | date | Daily aggregation |
| `year` | start_time → YYYY | integer | Yearly routing |
| `month` | start_time → MM | integer | Monthly aggregation |

### Sample Document in OpenSearch

```json
{
  "record_id": "20bea1b6-53cf-4501-a801-a2d076d1a791",
  "imsi": "222101648105653",
  "imei": "353116250119291",
  "user_code": "user@example.com",
  "visit_mcc": "262",
  "visit_country": "DE",
  "flow_size": 172827033,
  "start_time": 1764799297623,
  "end_time": 1764800946961,
  "flow_size_gb": 0.161,
  "flow_size_mb": 164.82,
  "start_time_iso": "2025-12-03T16:01:37.623000",
  "end_time_iso": "2025-12-03T16:29:06.961000",
  "duration_seconds": 1649,
  "date": "2025-12-03",
  "year": 2025,
  "month": 12,
  "source_file": "20251203/*.txt",
  "imported_at": "2025-12-04T23:25:42.654989"
}
```

### Workflow Commands

```bash
# Step 1: Pull from SFTP to local cache
# Menu → UCL SIM Analysis → Pull SFTP CDR Data
# Enter days back: 250 (for full history)

# Step 2: Push to OpenSearch
# Menu → UCL SIM Analysis → Full Backfill to OpenSearch (first time)
# Menu → UCL SIM Analysis → Incremental Sync (subsequent runs)

# Check sync status
# Menu → UCL SIM Analysis → Show OpenSearch Sync Status
```

### Safety Features

1. **Prefix Guard**: Only operates on indices matching `ucl-sim-cdr-*`
2. **Deduplication**: Uses `record_id` as document `_id` (OpenSearch handles upserts)
3. **Yearly Routing**: Records auto-route to correct year based on timestamp
4. **Batch Processing**: 1000 records per bulk request (prevents memory issues)

---

## Data Linkage: SIM → Device → Retail Plan (Dec 2025)

### The IMEI Connection

The `daily_data_consumption` index does **NOT** have IMSI/ICCID fields. The link between wholesale SIMs and retail plans is through **IMEI (device serial)**:

```
UCL CDR (imsi + imei)  ←→  Daily Consumption (serial = imei)
```

### Key OpenSearch Indices

| Index | Purpose | Key Fields |
|-------|---------|------------|
| `ucl-sim-cdr-2025` | Wholesale SIM usage | `imsi`, `imei`, `user_code`, `flow_size_gb` |
| `daily_data_consumption_2025` | Retail plan usage | `serial` (=IMEI), `package`, `data_consumed` |
| `orders` | eSIM orders only | `product_sku`, `order_number` |

### Multi-SIM Pooling

A single device (IMEI) can use multiple SIMs. Example from October 2025:
- Device `358913200053975` used all 6 AU SIMs
- Consumed 31.3 GB across the pooled SIMs
- System auto-switches between SIMs for load balancing

### Package IDs

The `package` field in `daily_data_consumption` contains MongoDB ObjectIds (e.g., `61c974c4005b0b2a454e0529`), not human-readable plan names. Plan name mapping requires MongoDB access.

---

## Excel vs CDR Discrepancy (Dec 2025 Analysis)

### Case Study: Australia SIMs - October 2025

| Source | GB | Notes |
|--------|-----|-------|
| **Excel (vendor billing)** | 300.96 | From "Sim Cost-Usage" spreadsheet |
| **UCL CDR (6 AU SIMs)** | 66.60 | IMSI prefix 50503* |
| **UCL CDR (all traffic IN AU)** | 151.25 | Includes UK SIMs roaming |

**Gap: 77.9% difference between Excel and CDR**

### Why the Discrepancy?

| Factor | Explanation |
|--------|-------------|
| **Measurement point** | Excel = vendor billing (network edge); CDR = session data |
| **Protocol overhead** | Vendor may include signaling/headers not in user data |
| **Aggregation method** | Different rounding, timing windows |
| **Data source** | Excel from Vodafone/GDF billing; CDR from uCloudlink platform |

### CDR Files Are Complete

Verified for October 2025:
- All 31 days have CDR data
- 48 files per day (every 30 minutes)
- 1,488 total files for the month

The gap is NOT due to missing files - it's a measurement methodology difference.

### Capacity Utilization

| Metric | Value |
|--------|-------|
| Wholesale capacity | 180 GB/month (6 SIMs × 30 GB) |
| Excel usage | 300.96 GB (167% - **overage!**) |
| CDR usage | 66.60 GB (37%) |

---

## Related Documentation

- **[UCL SIM Data Flow Analysis](../ucl_sim_data_flow_analysis.md)** - Detailed analysis with query examples
- **[SIM Cost-Usage Report](sim_cost_usage_report.md)** - Excel data breakdown
