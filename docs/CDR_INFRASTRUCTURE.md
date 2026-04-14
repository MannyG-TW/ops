# CDR Infrastructure — Tellisim CDR Collector

**Source**: [TravelWifi/tellisim_collector](https://github.com/TravelWifi/tellisim_collector)

## Overview

CDR (Call Detail Records) are collected from Google Cloud Storage every 15 minutes by the Tellisim CDR Collector and indexed into OpenSearch. This data tracks all eSIM data usage at the session level.

## OpenSearch CDR Indices

| Property | Value |
|----------|-------|
| **Index pattern** | `tellisim-cdr-{YYYY}` (e.g., `tellisim-cdr-2025`, `tellisim-cdr-2026`) |
| **Read alias** | `tellisim-cdr-read` (spans all years) |
| **Write alias** | `tellisim-cdr-write` (current year) |
| **Refresh** | Every 15 minutes (scheduler interval) |
| **Dedup key** | `hash(SESSION_ID)` as document `_id` |
| **Source** | GCS bucket `gs://travelwifi_cdr` → CSV files → OpenSearch |

## CDR Schema (28 Fields)

| # | Field | Type | Description | Invoice Relevance |
|---|-------|------|-------------|-------------------|
| 1 | `USAGE_DATE_UTC` | datetime | Timestamp of usage (required) | Billing period matching |
| 2 | `SESSION_ID` | keyword | Unique session identifier (required) | Dedup key |
| 3 | `MCC` | keyword | Mobile Country Code (3 digits) | Network identification |
| 4 | `MNC` | keyword | Mobile Network Code (2-3 digits) | Network identification |
| 5 | `TOTAL_QTY` | long | Total quantity (**bytes**) | **Core: actual data consumed** |
| 6 | `USAGE_TYPE_ID` | keyword | Usage type identifier | — |
| 7 | `USAGE_TYPE` | keyword | Usage type (33=Data) | Filter data sessions |
| 8 | `DEST_PHONE_NUMBER` | keyword | Destination phone | — |
| 9 | `SUBS_RESELLER_NAME` | keyword | Reseller name | Verify it's TravelWifi |
| 10 | `CUSTO_ACCOUNT_NAME` | keyword | Customer account name | — |
| 11 | `SUBS_ACCOUNT_NAME` | keyword | Subscriber account name | — |
| 12 | `SUBSCRIBER_ID` | keyword | Subscriber ID | — |
| 13 | `IMSI` | keyword | International Mobile Subscriber Identity (15 digits, required) | SIM identification |
| 14 | `ICCID` | keyword | SIM card ID (19-20 digits) | **Core: matches invoice line items** |
| 15 | `SUBS_PHONE_NUMBER` | keyword | Subscriber phone | — |
| 16 | `PREPAID_PACKAGE_IDS` | keyword | Package IDs | **Links to plan/SKU** |
| 17 | `PREPAID_PACKAGE_QTYS` | long | Package quantities | Data allocation |
| 18 | `TOLL_FREE` | boolean | Is toll free | — |
| 19 | `CUSTO_ACCOUNT_ID` | keyword | Customer account ID | — |
| 20 | `CUSTO_CHARGE` | double | Customer charge amount | **Vendor charge validation** |
| 21 | `SUBS_ACCOUNT_ID` | keyword | Subscriber account ID | — |
| 22 | `SUBS_CHARGE` | double | Subscriber charge | — |
| 23 | `APN` | keyword | Access Point Name | — |
| 24 | `RAT` | keyword | Radio Access Technology | — |
| 25 | `IMEI` | keyword | Device ID | Device tracking |
| 26 | `DOWN_BITRATE` | long | Download bitrate (bps) | — |
| 27 | `UP_BITRATE` | long | Upload bitrate (bps) | — |
| 28 | `iso2` | keyword | Country code (2 chars) | **Core: country-level cost matching** |

## Key Fields for Invoice Validation

| Purpose | CDR Field | Notes |
|---------|-----------|-------|
| **Match SIM to invoice** | `ICCID` | 19-20 digit SIM card identifier |
| **Actual data consumed** | `TOTAL_QTY` | In **bytes** — divide by 1,073,741,824 for GB |
| **Country of usage** | `iso2` | ISO 2-letter code, matches vendor pricing sheet |
| **Billing period** | `USAGE_DATE_UTC` | Filter by invoice date range |
| **Plan linkage** | `PREPAID_PACKAGE_IDS` | Maps to product/SKU |
| **Vendor charge** | `CUSTO_CHARGE` | What vendor says they charged |
| **Network used** | `MCC` + `MNC` | Verify roaming partner |

## Querying CDR Data

```python
# Example: Get total data consumed by ICCID in a date range
from opensearchpy import OpenSearch

client = OpenSearch(
    hosts=[{'host': 'vpc-dhi-ue1-es-cdr-rd-p-001-...', 'port': 443}],
    http_auth=('admin', '...'),
    use_ssl=True,
    verify_certs=True,
)

# Aggregate data by ICCID for a billing period
query = {
    "size": 0,
    "query": {
        "bool": {
            "filter": [
                {"range": {"USAGE_DATE_UTC": {"gte": "2026-03-01", "lt": "2026-04-01"}}},
                {"term": {"USAGE_TYPE": "33"}}  # Data sessions only
            ]
        }
    },
    "aggs": {
        "by_iccid": {
            "terms": {"field": "ICCID", "size": 10000},
            "aggs": {
                "total_bytes": {"sum": {"field": "TOTAL_QTY"}},
                "countries": {"terms": {"field": "iso2", "size": 200}},
                "sessions": {"value_count": {"field": "SESSION_ID"}}
            }
        }
    }
}

result = client.search(index="tellisim-cdr-read", body=query)
```

## Data Pipeline

```
Vendor CDR System → GCS (gs://travelwifi_cdr) → Tellisim Collector (every 15min) → OpenSearch
```

| Stage | System | Frequency |
|-------|--------|-----------|
| CDR generation | Vendor (TelliSIM) | Real-time |
| File drop to GCS | Vendor pipeline | ~15 min batches |
| Collection & indexing | Tellisim Collector | Every 15 minutes |
| Retention cleanup | Collector | Files deleted after 48h (verified) |

## Collector Dashboards

| Environment | URL |
|-------------|-----|
| Staging | https://collector9ts.stg.navimo.io/ |
| Production | https://collector9ts.mynavimo.com/ |

## Known Issues (2026-03-21)

### Collector State Desync — 114K records reported, 5 in OpenSearch

The Tellisim CDR Collector dashboard reports 114,906 records indexed but OpenSearch only has 5 records. Root cause identified:

1. `raise_on_error=False` in `opensearch_client.py:159` swallows bulk indexing failures
2. `tellisim-cdr-read` alias never created by `create_index()` — verification fails silently
3. Files marked "processed" regardless of verification result (`orchestrator.py:282`)
4. State file prevents re-processing — files skipped forever

**Fix**: Apply 5 patches to the collector repo, then reset `state/collector_state.json` to re-process all files. See collector repo issues for implementation details.

**Impact on Invoice Validation**: CDR-dependent features (volume reconciliation, ICCID matching, gap detection) are blocked until the collector is fixed. Rate validation, order matching, and GP computation work independently.

### Legacy CDR Indices

The cluster has CDR data in multiple index patterns:
- `logstash-cdr{YYYY.MM.DD}` — Sapphire device CDR (old pipeline, different field schema)
- `logstash-cdr-esim{YYYY.MM.DD}` — Manx eSIM CDR (XML format)
- `tellisim-cdr-{YYYY}` — Tellisim CDR (correct schema, collector needs fix)

Only `tellisim-cdr-*` matches the CDR schema documented above.

## Related Systems

- **Orders index**: `orders` (same OpenSearch cluster) — order details, pricing, customer info
- **Vendor pricing sheets**: `vendor_coverage` table in PostgreSQL — cost per GB by country
- **Production vendor**: `vendors` table, `is_default=1` — active vendor for plan generation
