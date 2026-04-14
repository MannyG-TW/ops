# UCL CDR Pull Program - Complete Technical Specification

**Purpose:** This document provides a complete specification for building a program that pulls CDR (Call Detail Records) from uCloudlink's SFTP server and imports them into OpenSearch.

**Current Implementation:** `/Users/manny/smart-pricing/ucl_sim_analyzer.py`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Data Flow Architecture](#2-data-flow-architecture)
3. [SFTP Source Details](#3-sftp-source-details)
4. [CDR File Format](#4-cdr-file-format)
5. [Local Cache Structure](#5-local-cache-structure)
6. [OpenSearch Integration](#6-opensearch-integration)
7. [Complete Data Pipeline](#7-complete-data-pipeline)
8. [Python Implementation Details](#8-python-implementation-details)
9. [Safety Features](#9-safety-features)
10. [Configuration](#10-configuration)

---

## 1. Overview

### What This Program Does

1. **Connects to uCloudlink SFTP server** - Downloads raw CDR files
2. **Caches files locally** - Organized by date folders
3. **Parses CDR records** - Converts pipe-delimited text to structured data
4. **Transforms data** - Adds derived fields (GB, duration, ISO dates)
5. **Bulk imports to OpenSearch** - Yearly indices with deduplication

### Business Context

- **CDR = Call Detail Records** for VSIM (Virtual SIM) usage
- Tracks SIM-level data consumption for Sapphire devices
- Used for wholesale cost analysis and vendor negotiations
- Each record represents one data session

---

## 2. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: SFTP SOURCE                                                │
│  ─────────────────────────────────────────────────────────────────  │
│  Server: 13.228.222.204:31100                                       │
│  User: DHI                                                          │
│  Structure: /YYYYMMDD/VSIM_HD_DHI_*.txt                            │
│  ~48 files per day (every 30 minutes)                               │
│  ~8 months history available                                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ SFTP Download (paramiko)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: LOCAL CACHE (Staging)                                      │
│  ─────────────────────────────────────────────────────────────────  │
│  Path: cache/ucl_sim/cdr_files/                                     │
│  Structure:                                                         │
│    └── YYYYMMDD/                                                    │
│        └── VSIM_HD_DHI_YYYYMMDDHHMMSS00001.txt                     │
│                                                                     │
│  Features:                                                          │
│    - Checkpoint file for resume capability                          │
│    - Skip already-downloaded files                                  │
│    - Track sync progress                                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            │ Parse + Transform
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: OPENSEARCH (Analysis Target)                               │
│  ─────────────────────────────────────────────────────────────────  │
│  Index Pattern: ucl-sim-cdr-YYYY                                    │
│  Examples:                                                          │
│    - ucl-sim-cdr-2025 (~45M records, ~10GB)                        │
│    - ucl-sim-cdr-2024                                               │
│                                                                     │
│  Features:                                                          │
│    - Yearly partitioning                                            │
│    - Deduplication via record_id                                    │
│    - Bulk import (1000 records/batch)                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. SFTP Source Details

### Connection Parameters

```python
SFTP_HOST = "13.228.222.204"
SFTP_PORT = 31100
SFTP_USER = "DHI"
SFTP_PASS = "nFM8nJuLvMNRWdPs"
REMOTE_PATH = "/"  # Date folders are at root level
```

### Directory Structure on SFTP

```
/
├── 20250401/
│   ├── VSIM_HD_DHI_2025040100000000001.txt
│   ├── VSIM_HD_DHI_2025040100300000001.txt
│   ├── VSIM_HD_DHI_2025040101000000001.txt
│   └── ... (48 files per day, every 30 minutes)
├── 20250402/
├── 20250403/
└── ... (~250 days available, ~8 months)
```

### File Naming Convention

```
VSIM_HD_{MVNO_CODE}_{YYYYMMDDHHMMSS}{SEQUENCE}.txt

Example: VSIM_HD_DHI_2025101700300000001.txt
         ├────────┘ │   │  │  │  │    │
         │          │   │  │  │  │    └── Sequence number
         │          │   │  │  │  └────── Seconds (00)
         │          │   │  │  └───────── Minutes (30)
         │          │   │  └──────────── Hour (00-23)
         │          │   └─────────────── Day
         │          └─────────────────── Month
         └────────────────────────────── MVNO Code (DHI)
```

### File Generation Frequency

- One `.txt` file every **30 minutes**
- 48 files per day
- ~2.5-3 hour lag from session to file availability
- Timestamps in filenames are **GMT+0**

---

## 4. CDR File Format

### Structure

- **Delimiter:** Pipe character `|`
- **Row separator:** Newline `\n`
- **Encoding:** UTF-8
- **No header row**

### Field Positions

| Position | Field Name | Type | Description | Example |
|----------|-----------|------|-------------|---------|
| 0 | record_id | string | Unique UUID | `84cef6c5-8153-4ff5-961b-cfdecba3e805` |
| 1 | imsi | string | SIM IMSI (15 digits) | `419031019575563` |
| 2 | start_time | long | Session start (Unix ms) | `1752769816846` |
| 3 | end_time | long | Session end (Unix ms) | `1752771498625` |
| 4 | imei | string | Device IMEI (15 digits) | `353186190005256` |
| 5 | user_code | string | User identifier | `user@email.com` |
| 6 | visit_mcc | string | Mobile Country Code | `419` |
| 7 | flow_size | long | Data consumed (bytes) | `5158522` |
| 8 | visit_country | string | ISO 2-letter country | `KW` |

### Example Raw Record

```
84cef6c5-8153-4ff5-961b-cfdecba3e805|419031019575563|1752769816846|1752771498625|353186190005256|user@email.com|419|5158522|KW
```

### Parsing Logic (Python)

```python
def parse_cdr_line(line: str) -> dict:
    parts = line.strip().split('|')
    if len(parts) >= 9:
        return {
            'record_id': parts[0],
            'imsi': parts[1],
            'start_time': int(parts[2]) if parts[2] else 0,
            'end_time': int(parts[3]) if parts[3] else 0,
            'imei': parts[4],
            'user_code': parts[5],
            'visit_mcc': parts[6],
            'flow_size': int(parts[7]) if parts[7] else 0,
            'visit_country': parts[8]
        }
    return None
```

---

## 5. Local Cache Structure

### Directory Layout

```
cache/ucl_sim/
├── cdr_files/                          # CDR files from SFTP
│   ├── .gitkeep
│   ├── .sync_checkpoint.json           # Resume checkpoint
│   ├── 20251001/
│   │   ├── VSIM_HD_DHI_2025100100000000001.txt
│   │   ├── VSIM_HD_DHI_2025100100300000001.txt
│   │   └── ... (48 files)
│   ├── 20251002/
│   └── ...
├── .opensearch_sync_state.json         # OpenSearch import tracking
├── contracts/                          # Excel contract data (cached)
├── reports/                            # Generated analysis reports
└── snapshots/                          # Point-in-time snapshots
```

### Checkpoint File (`.sync_checkpoint.json`)

Used for resume capability when SFTP download is interrupted:

```json
{
  "started_at": "2025-12-16T10:30:00",
  "last_updated": "2025-12-16T10:45:00",
  "missing_dates": ["20251001", "20251002", "20251003"],
  "completed_dates": ["20251001"],
  "total_files": 48
}
```

### OpenSearch Sync State (`.opensearch_sync_state.json`)

Tracks which files have been imported to OpenSearch:

```json
{
  "imported_files": [
    "cache/ucl_sim/cdr_files/20251001/VSIM_HD_DHI_2025100100000000001.txt",
    "cache/ucl_sim/cdr_files/20251001/VSIM_HD_DHI_2025100100300000001.txt"
  ],
  "last_sync": "2025-12-16T12:00:00"
}
```

---

## 6. OpenSearch Integration

### Index Naming Convention

```
ucl-sim-cdr-{YEAR}

Examples:
  - ucl-sim-cdr-2025
  - ucl-sim-cdr-2024
  - ucl-sim-cdr-2023
```

### Index Settings

```python
INDEX_SETTINGS = {
    "number_of_shards": 1,      # Single shard for ~10GB index
    "number_of_replicas": 1,    # One replica for durability
    "refresh_interval": "30s",  # Batch-friendly refresh
}
```

### Index Mappings

```python
INDEX_MAPPINGS = {
    "properties": {
        # Original fields from CDR
        "record_id": {"type": "keyword"},
        "imsi": {"type": "keyword"},
        "imei": {"type": "keyword"},
        "user_code": {"type": "keyword"},
        "visit_mcc": {"type": "keyword"},
        "visit_country": {"type": "keyword"},
        "flow_size": {"type": "long"},           # Bytes
        "start_time": {"type": "long"},          # Unix ms
        "end_time": {"type": "long"},            # Unix ms

        # Derived fields (added during import)
        "flow_size_gb": {"type": "float"},       # Bytes → GB
        "flow_size_mb": {"type": "float"},       # Bytes → MB
        "start_time_iso": {"type": "date"},      # ISO 8601
        "end_time_iso": {"type": "date"},        # ISO 8601
        "duration_seconds": {"type": "integer"}, # End - Start
        "date": {"type": "date", "format": "yyyy-MM-dd"},
        "year": {"type": "integer"},
        "month": {"type": "integer"},

        # Metadata
        "source_file": {"type": "keyword"},      # Original filename
        "imported_at": {"type": "date"},         # When imported
    }
}
```

### Document Transformation

When importing, each raw CDR record is transformed:

```python
def transform_cdr_record(record: dict, source_file: str) -> dict:
    start_dt = datetime.fromtimestamp(record['start_time'] / 1000)
    end_dt = datetime.fromtimestamp(record['end_time'] / 1000)
    duration = (record['end_time'] - record['start_time']) // 1000

    return {
        # Original fields
        "record_id": record['record_id'],
        "imsi": record['imsi'],
        "imei": record['imei'],
        "user_code": record['user_code'],
        "visit_mcc": record['visit_mcc'],
        "visit_country": record['visit_country'],
        "flow_size": record['flow_size'],
        "start_time": record['start_time'],
        "end_time": record['end_time'],

        # Derived fields
        "flow_size_gb": record['flow_size'] / (1024 ** 3),
        "flow_size_mb": record['flow_size'] / (1024 ** 2),
        "start_time_iso": start_dt.isoformat(),
        "end_time_iso": end_dt.isoformat(),
        "duration_seconds": duration,
        "date": start_dt.strftime("%Y-%m-%d"),
        "year": start_dt.year,
        "month": start_dt.month,

        # Metadata
        "source_file": source_file,
        "imported_at": datetime.now().isoformat(),
    }
```

### Bulk Import Process

```python
def bulk_import(records: list, index_name: str, batch_size: int = 1000):
    """
    Import records in batches of 1000.
    Uses record_id as document _id for deduplication.
    """
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]

        bulk_body = []
        for record in batch:
            action = {
                "index": {
                    "_index": index_name,
                    "_id": record['record_id']  # Deduplication key
                }
            }
            bulk_body.append(action)
            bulk_body.append(record)

        client.bulk(body=bulk_body, refresh=False)
```

---

## 7. Complete Data Pipeline

### Step-by-Step Process

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1: DETECT GAPS                                              │
├──────────────────────────────────────────────────────────────────┤
│ 1. Connect to SFTP                                               │
│ 2. List all date folders on SFTP                                 │
│ 3. List all date folders in local cache                          │
│ 4. Calculate: missing = sftp_dates - local_dates                 │
│ 5. Return list of missing date folders                           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2: DOWNLOAD MISSING FILES (Smart Sync)                     │
├──────────────────────────────────────────────────────────────────┤
│ For each missing date folder:                                    │
│   1. List files in remote folder                                 │
│   2. Create local folder if not exists                           │
│   3. For each VSIM_*.txt file:                                   │
│      - Skip if already exists locally                            │
│      - Download via SFTP                                         │
│   4. Save checkpoint after each folder (crash-safe)              │
│   5. Show progress percentage                                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3: PARSE CDR FILES                                          │
├──────────────────────────────────────────────────────────────────┤
│ For each local CDR file:                                         │
│   1. Open file, read line by line                                │
│   2. Split each line by '|'                                      │
│   3. Extract 9 fields into CDRRecord object                      │
│   4. Collect all records                                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 4: TRANSFORM RECORDS                                        │
├──────────────────────────────────────────────────────────────────┤
│ For each CDRRecord:                                              │
│   1. Convert flow_size bytes → GB, MB                            │
│   2. Convert Unix timestamps → ISO 8601                          │
│   3. Calculate duration_seconds                                  │
│   4. Extract date, year, month                                   │
│   5. Add source_file and imported_at metadata                    │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5: ROUTE TO YEARLY INDEX                                    │
├──────────────────────────────────────────────────────────────────┤
│ 1. Group records by year (from start_time)                       │
│ 2. For each year:                                                │
│    - Determine index name: ucl-sim-cdr-{year}                    │
│    - Create index if not exists                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 6: BULK IMPORT TO OPENSEARCH                                │
├──────────────────────────────────────────────────────────────────┤
│ For each batch of 1000 records:                                  │
│   1. Build bulk request body                                     │
│   2. Use record_id as document _id (deduplication)               │
│   3. Send bulk request                                           │
│   4. Count successes/failures                                    │
│   5. Track imported file in sync state                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8. Python Implementation Details

### Required Libraries

```python
# requirements.txt
paramiko>=3.0.0        # SFTP client
opensearch-py>=2.0.0   # OpenSearch client
pandas>=2.0.0          # Excel reading (optional)
rich>=13.0.0           # Console output formatting
PyYAML>=6.0.0          # Config file parsing
```

### Class Structure

```python
# Main classes in ucl_sim_analyzer.py

@dataclass
class CDRRecord:
    """Single CDR record from uCloudlink SFTP files."""
    record_id: str
    imsi: str
    start_time: int      # Unix timestamp (ms)
    end_time: int
    imei: str
    user_code: str
    visit_mcc: str
    flow_size: int       # Bytes
    visit_country: str


class UCLSFTPClient:
    """SFTP client for downloading CDR files."""

    def connect(self) -> bool
    def disconnect(self)
    def list_cdr_files(self, days_back: int) -> List[Tuple[str, str]]
    def download_cdr_files(self, file_list, days_back, force) -> int
    def parse_cdr_file(self, filepath: Path) -> List[CDRRecord]
    def get_sftp_availability(self) -> Dict
    def get_local_cache_status(self) -> Dict
    def detect_gaps(self) -> Dict
    def smart_sync(self, max_days, resume) -> int


class UCLOpenSearchClient:
    """OpenSearch client for CDR data import."""

    def connect(self) -> bool
    def create_index_if_not_exists(self, year: int) -> bool
    def transform_cdr_record(self, record: CDRRecord) -> Dict
    def bulk_import(self, records, source_file, batch_size) -> Dict
    def full_backfill(self, dry_run, batch_size) -> Dict
    def incremental_sync(self, dry_run, batch_size) -> Dict
    def show_sync_status(self)
```

### Key Method Implementations

#### SFTP Connection

```python
def connect(self) -> bool:
    """Establish SFTP connection using paramiko."""
    try:
        self.transport = paramiko.Transport((self.SFTP_HOST, self.SFTP_PORT))
        self.transport.connect(username=self.SFTP_USER, password=self.SFTP_PASS)
        self.sftp = paramiko.SFTPClient.from_transport(self.transport)
        return True
    except Exception as e:
        print(f"SFTP connection failed: {e}")
        return False
```

#### Smart Sync with Resume

```python
def smart_sync(self, max_days: int = None, resume: bool = True) -> int:
    """
    Smart sync - only download missing dates with checkpoint/resume.
    """
    # 1. Detect gaps
    gap_info = self.detect_gaps()
    missing = gap_info['missing_dates']

    if not missing:
        print("Already fully synced")
        return 0

    # 2. Check for existing checkpoint
    checkpoint = self._load_checkpoint()
    if resume and checkpoint:
        completed = set(checkpoint.get('completed_dates', []))
        missing = [d for d in missing if d not in completed]

    # 3. Download each missing date folder
    downloaded = 0
    for date_folder in missing:
        files = self.sftp.listdir(f"/{date_folder}")

        for filename in files:
            if filename.startswith('VSIM_') and filename.endswith('.txt'):
                local_path = self.local_cache / date_folder / filename
                local_path.parent.mkdir(parents=True, exist_ok=True)

                if not local_path.exists():
                    self.sftp.get(f"/{date_folder}/{filename}", str(local_path))
                    downloaded += 1

        # Save checkpoint after each folder
        checkpoint['completed_dates'].append(date_folder)
        self._save_checkpoint(checkpoint)

    return downloaded
```

---

## 9. Safety Features

### Index Name Validation

```python
ALLOWED_INDEX_PREFIX = "ucl-sim-cdr-"

def _validate_index_name(self, index_name: str) -> bool:
    """Only allow operations on ucl-sim-cdr-* indices."""
    if not index_name.startswith(self.ALLOWED_INDEX_PREFIX):
        print(f"SAFETY VIOLATION: Refusing to operate on '{index_name}'")
        return False
    return True
```

### Deduplication

- Uses `record_id` (UUID) as document `_id` in OpenSearch
- OpenSearch automatically handles upserts
- Re-importing same file won't create duplicates

### Crash Recovery

- Checkpoint saved after each date folder download
- Sync state saved after each file import
- Resume from last successful point on restart

### Read-Only Safety

- All index listing methods are read-only
- Explicit separation between read and write operations
- Dry-run mode for testing without changes

---

## 10. Configuration

### Config File (`config/config.yaml`)

```yaml
opensearch:
  host: search-xxx.region.es.amazonaws.com
  port: 443
  username: admin
  password: your-password
```

### Loading Configuration

```python
from config_loader import load_config

config = load_config()
os_config = config['opensearch']

# Use in OpenSearch client
client = OpenSearch(
    hosts=[{
        'host': os_config['host'],
        'port': os_config.get('port', 443)
    }],
    http_auth=(os_config['username'], os_config['password']),
    use_ssl=True,
    verify_certs=True,
    timeout=60
)
```

---

## Summary: Building a Separate Program

To build a standalone CDR pull program, implement these components:

1. **SFTP Client** - Connect, list folders, download files
2. **CDR Parser** - Parse pipe-delimited records
3. **Transformer** - Add derived fields (GB, duration, ISO dates)
4. **OpenSearch Client** - Create indices, bulk import
5. **State Management** - Checkpoint files for resume capability
6. **Gap Detection** - Compare SFTP vs local vs OpenSearch

Key principles:
- **Yearly indices** for manageable size (~10GB each)
- **Batch imports** of 1000 records for efficiency
- **Deduplication** via record_id as document _id
- **Resume capability** via checkpoint files
- **Safety guards** on index name prefix
