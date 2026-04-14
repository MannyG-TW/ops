# BWifi Usage Report — Technical Reference

> **Last Updated:** April 2026
> **Feature Location:** `/analyzer` → France Usage Report

---

## Overview

The France Usage Report generates daily data consumption reports for Sapphire devices (identified by IMEI). It queries CDR (Call Detail Records) from OpenSearch and produces a CSV with one row per IMEI and one column per day.

---

## Products That Use This Report

Both Sapphire product types share the **same CDR data source** in OpenSearch. The IMEI is the universal lookup key regardless of product type or SKU.

| Product | SKU Pattern | Description |
|---------|------------|-------------|
| **Sapphire Hotspot** (Data) | `DHI_*_FLOW*` | Customer **owns** a Sapphire device and buys a data plan |
| **Sapphire Rental** | `S2GLOCALMERENT` + `DHI_*_{TIER}` | Customer **rents** a Sapphire device for a trip |

**Key point:** The SKU does not matter for usage lookups. Whether the device is a rental (`S2GLocalmerent`) or a customer-owned hotspot, the data consumption is always queried by **IMEI** from the same OpenSearch index.

---

## Data Source

### OpenSearch Index: `logstash-cdr{YYYY.MM.DD}`

One index per calendar day (e.g., `logstash-cdr2026.03.15`). Each record represents a single data session on a Sapphire device.

**Key fields:**

| Field | Type | Description |
|-------|------|-------------|
| `imei` / `imei.keyword` | string | Device IMEI (15 or 16 digits) — the primary lookup key |
| `@timestamp` | datetime (UTC) | When the CDR session was recorded |
| `flowsize` | long | Bytes consumed in this session |
| `customer` | string | Format: `{IMEI}@bwifi.com` |
| `organization` | string | Always `BVN_B2B_BWIFI` for Sapphire devices |
| `country` | string | ISO country code where data was used (e.g., `FR`) |
| `mcc` | string | Mobile Country Code |

**Important:** A single IMEI can have **multiple CDR records per day** (one per session). The daily total is the **sum of `flowsize`** across all records for that IMEI on that day.

### Why Not `daily_data_consumption_*`?

The `daily_data_consumption_*` index contains pre-aggregated daily usage but was found to only have ICCID-based records in 2026 (not IMEI-based Sapphire data). The `logstash-cdr*` index is the authoritative source for Sapphire device CDR data.

### Why Not `ucl-sim-cdr-*`?

The `ucl-sim-cdr-*` index also contains Sapphire CDR data but with much smaller `flow_size` values (session-level micro records). The `logstash-cdr*` index has the complete data volume per session via the `flowsize` field.

---

## Noon-to-Noon Day Counting

Per the data provider's requirement, each "day" is counted from **noon UTC to noon UTC** (not midnight to midnight).

- **"March 1"** = March 1 at 12:00:00 UTC → March 2 at 11:59:59 UTC
- **"March 2"** = March 2 at 12:00:00 UTC → March 3 at 11:59:59 UTC
- etc.

### Implementation

The OpenSearch `date_histogram` aggregation supports this natively via the `offset` parameter:

```json
{
  "date_histogram": {
    "field": "@timestamp",
    "calendar_interval": "day",
    "format": "yyyy-MM-dd",
    "offset": "+12h"
  }
}
```

This shifts all bucket boundaries from midnight to noon. The bucket labeled `"2026-03-01"` covers March 1 12:00 → March 2 12:00 UTC.

**Index coverage:** Because the last report day (e.g., April 4) spans into the next calendar day (April 5 until noon), the query must include `logstash-cdr` indices for **+1 extra calendar day** beyond the report end date.

---

## Report Structure

### Input
- **IMEI list**: Uploaded as `.xlsx`, `.csv`, or `.txt` (one IMEI per row, 15 or 16 digits)
- **Date range**: A month with optional end date extension, or a custom date range
- **Noon-to-noon toggle**: On by default

### Output CSV

Format: `Bifi_Report_{Month}{Year}.csv`

```
imei,2026-03-01,2026-03-02,...,2026-04-04
867079042147732,0,14344259584,...,4533952512
867079040580041,1551337472,4140215296,...,0
```

- First column: IMEI
- Remaining columns: one per day in the date range
- Values: **raw bytes** (not MB/GB) — sum of all `flowsize` values for that IMEI on that day
- Days with no data: `0`

---

## Query Strategy

### Batching

With 3,000+ IMEIs, querying all at once would overload OpenSearch. The API batches queries in groups of **100 IMEIs** per request.

### Aggregation Query

For each batch:

```json
{
  "size": 0,
  "query": {
    "terms": { "imei.keyword": ["IMEI_1", "IMEI_2", "..."] }
  },
  "aggs": {
    "by_imei": {
      "terms": { "field": "imei.keyword", "size": 100 },
      "aggs": {
        "by_date": {
          "date_histogram": {
            "field": "@timestamp",
            "calendar_interval": "day",
            "format": "yyyy-MM-dd",
            "offset": "+12h"
          },
          "aggs": {
            "daily_bytes": { "sum": { "field": "flowsize" } }
          }
        }
      }
    }
  }
}
```

### Timeout

Queries use a **30-second timeout** (vs 15s default) to handle large date ranges across many indices.

### Error Handling

If a batch fails, the report continues with remaining batches. Failed batch IMEIs will show `0` for all days. A warning is displayed to the operator indicating which batch failed.

---

## API Endpoint

**`POST /api/opensearch/usage-report`**

### Request Body

```json
{
  "imeis": ["867079042147732", "867079040580041"],
  "from": "2026-03-01",
  "to": "2026-04-04",
  "noonToNoon": true,
  "credentials": { "url": "...", "username": "...", "password": "..." }
}
```

### Response

```json
{
  "ok": true,
  "data": {
    "867079042147732": { "2026-03-01": 0, "2026-03-02": 14344259584 },
    "867079040580041": { "2026-03-01": 1551337472, "2026-03-02": 4140215296 }
  },
  "dates": ["2026-03-01", "2026-03-02", "..."],
  "totalImeis": 2,
  "duplicatesRemoved": 0,
  "warnings": [],
  "summary": {
    "totalBytes": 20034797056,
    "avgDaysWithUsage": 1.5,
    "avgDaysWithoutUsage": 0.5
  }
}
```

---

## UI Features

- **IMEI upload**: Supports `.xlsx`, `.xls`, `.csv`, `.txt`
- **Validation**: Deduplicates, rejects non-15/16 digit entries
- **Period selection**: Month picker with end date, or custom date range
- **Quick buttons**: "+10 days after month" and "Full month only"
- **Noon-to-noon toggle**: On by default
- **KPI cards**: Total IMEIs, Total Usage, Avg Days w/ Usage, Avg Days w/o Usage
- **Paginated table**: 50 IMEIs per page with IMEI filter/search
- **CSV export**: Raw bytes, matching the original report format

---

## Files

| File | Purpose |
|------|---------|
| `src/app/(app)/analyzer/page.tsx` | UI — France Usage Report component |
| `src/app/api/opensearch/usage-report/route.ts` | API — queries logstash-cdr, aggregates, returns data |
| `src/lib/opensearch-client.ts` | Shared OS query client (configurable timeout) |
| `src/lib/opensearch-indices.ts` | Index name constants |
