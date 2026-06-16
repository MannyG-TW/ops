# Dashboard Redesign + Agent Action System

**Date:** 2026-04-18
**Status:** Approved
**Scope:** Dashboard redesign, agent action flows (cancel, refund, connectivity report), supervisor threshold settings

## Problem

The current dashboard uses 100% hardcoded mock data (fraud alerts, shift insights, team activity, quick links). Only the broadcast section fetches real data. Support agents logging in have no visibility into actual system issues, trends, or operational state.

## Solution

Replace the mock dashboard with a data-driven operations center fed by agent actions. Agents report issues (fraud, cancellations, refunds, connectivity) from the customer order page. The dashboard aggregates this data into real-time trends and alerts. Supervisors configure alert thresholds.

## Users

- **Agents**: View dashboard on login, take actions on customer order pages
- **Supervisors**: View dashboard, manage broadcasts, configure alert thresholds
- **Admins**: Full access

## Architecture

**Approach: Domain Tables** — each action type gets its own SQLite table. A single dashboard summary API endpoint aggregates across all tables. Follows the existing pattern (escalations, broadcasts each have their own schema).

---

## Data Model

### `fraud_reports`

Captures structured fraud flag data. Currently fraud flags only send notifications — this table gives the dashboard queryable fraud data.

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUIDv4 |
| orderId | text NOT NULL | OpenSearch order ID |
| orderNumber | text NOT NULL | Denormalized for display |
| customerName | text NOT NULL | Denormalized |
| customerEmail | text NOT NULL | Denormalized |
| notes | text NOT NULL | Agent's fraud description |
| reportedBy | text NOT NULL | Agent name |
| reportedById | text NOT NULL | Agent user ID |
| createdAt | integer (timestamp) NOT NULL | When reported |

**Migration note:** The existing "Report Fraud" button on the order page currently only sends notifications to supervisors. It must be updated to also write to this table, so the dashboard can query structured fraud data.

### `connectivity_reports`

Captures agent reports of country connectivity issues, always tied to an order.

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUIDv4 |
| orderId | text NOT NULL | OpenSearch order ID |
| orderNumber | text NOT NULL | Denormalized for display |
| customerEmail | text NOT NULL | Denormalized |
| country | text NOT NULL | ISO2 country code (e.g., "JP") |
| reason | text NOT NULL | "no_data", "intermittent", "slow_speeds", "cannot_register", "other" |
| notes | text | Optional free text |
| telliSimData | text | JSON blob — ICCID, IMEI, operator, connection status at time of report |
| reportedBy | text NOT NULL | Agent name |
| reportedById | text NOT NULL | Agent user ID |
| createdAt | integer (timestamp) NOT NULL | When reported |

### `refund_reports`

Captures refund/partial refund actions taken by agents.

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUIDv4 |
| orderId | text NOT NULL | OpenSearch order ID |
| orderNumber | text NOT NULL | Denormalized |
| customerEmail | text NOT NULL | Denormalized |
| type | text NOT NULL | "full" or "partial" |
| amount | real NOT NULL | Refund amount (in order currency) |
| currency | text NOT NULL | Currency code |
| reason | text NOT NULL | "connectivity_issues", "customer_request", "duplicate_order", "late_delivery", "device_malfunction", "billing_error", "other" |
| country | text | ISO2 — required when reason is "connectivity_issues" |
| notes | text | Optional |
| processedBy | text NOT NULL | Agent name |
| processedById | text NOT NULL | Agent user ID |
| status | text NOT NULL DEFAULT "pending" | "pending" until actual payment API is wired up |
| createdAt | integer (timestamp) NOT NULL | |

### `cancel_reports`

Captures order cancellation actions.

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | UUIDv4 |
| orderId | text NOT NULL | OpenSearch order ID |
| orderNumber | text NOT NULL | Denormalized |
| customerEmail | text NOT NULL | Denormalized |
| reason | text NOT NULL | "customer_request", "duplicate_order", "fraud", "other" |
| notes | text | Optional |
| cancelledBy | text NOT NULL | Agent name |
| cancelledById | text NOT NULL | Agent user ID |
| status | text NOT NULL DEFAULT "pending" | "pending" until CRM/TelliSIM API is wired up |
| createdAt | integer (timestamp) NOT NULL | |

### `dashboard_config`

Singleton row (id = "default") for supervisor-configurable thresholds.

| Column | Type | Description |
|--------|------|-------------|
| id | text PK | Always "default" |
| connectivityThreshold | integer NOT NULL DEFAULT 10 | Number of reports to trigger a country flag |
| connectivityWindowHours | integer NOT NULL DEFAULT 48 | Time window in hours |
| updatedAt | integer (timestamp) | |
| updatedBy | text | Supervisor who last changed it |

---

## Agent Action Flows (Customer Order Page)

Three new action buttons added alongside the existing "Report Fraud" button.

### Cancel Order

1. Agent clicks "Cancel Order" on the order detail page
2. Modal opens with:
   - Order summary (order number, customer name, product, amount) — read-only
   - Reason dropdown: Customer Request, Duplicate Order, Fraud, Other
   - Notes text area (optional)
   - If reason is "Fraud" — note indicating this also files a fraud report
3. Confirmation step: "Are you sure you want to cancel order [ORDER_NUMBER]?" with destructive-styled confirm button
4. On submit: writes to `cancel_reports` with status "pending"
5. Success toast: "Order cancellation recorded. Pending processing."
6. Future: actual CRM/TelliSIM API calls wired up when endpoints are created

### Refund / Partial Refund

1. Agent clicks "Refund" on the order detail page
2. Modal opens with:
   - Order summary — read-only
   - Refund type toggle: Full Refund | Partial Refund
   - If partial: Amount input field (pre-filled with order total, editable)
   - Reason dropdown: Connectivity Issues, Customer Request, Duplicate Order, Late Delivery, Device Malfunction, Billing Error, Other
   - If reason is "Connectivity Issues": Country auto-fills from order destination (editable). Also creates a `connectivity_report` automatically.
   - Notes text area (optional)
3. Confirmation step with refund amount displayed prominently
4. On submit: writes to `refund_reports`. If connectivity reason, also writes to `connectivity_reports`.
5. Status: "pending" until payment API is wired up

### Report Country Connectivity Issue

1. Agent clicks "Report Connectivity" (only visible on eSIM orders with an ICCID)
2. Modal opens and fetches TelliSIM data for the order's ICCID:
   - Read-only panel: ICCID, IMEI, operator, connection status, plan state — pulled live from TelliSIM
   - Country auto-filled from order destination
   - Reason dropdown: No Data, Intermittent Connection, Slow Speeds, Cannot Register on Network, Other
   - Notes text area (optional)
3. On submit: writes to `connectivity_reports` with TelliSIM snapshot stored as JSON
4. Success toast: "Connectivity issue reported for [Country Name]"

### Button Placement & Visibility

All buttons sit in a row on the order detail page, same area as existing fraud button:
- **Report Fraud** (existing) — always visible
- **Cancel Order** — always visible
- **Refund** — always visible
- **Report Connectivity** — only visible when order has an ICCID (eSIM products)

---

## Dashboard Layout

Replaces all mock data. Auto-refreshes every 60 seconds (configurable).

### Header

- Keep existing style
- Remove hardcoded "Shift B"
- Add "Last refreshed: X seconds ago" indicator

### Priority 1 — Broadcast Banner (no changes)

Already implemented in `broadcast-banner.tsx`, sits above the dashboard in the app layout. Shows active supervisor broadcasts with dismiss capability.

### Priority 2 — Country Connectivity Alerts (top of dashboard)

Full-width section at the top — the most operationally urgent info.

- Shows countries that have crossed the supervisor-configured threshold (e.g., 10+ reports in 48h)
- Each card: country flag + name, report count, time window, top reported reasons, latest report timestamp
- Sorted by report count descending
- Severity styling: fraud-red card treatment for flagged countries
- If no countries flagged: single-line "No active connectivity alerts" with green indicator
- Data source: `connectivity_reports` aggregated by country within configured window

### Priority 3 — Trend Cards (row of 4)

Summary cards showing last 24h vs prior 24h:

| Card | Source | Display |
|------|--------|---------|
| Connectivity Reports | `connectivity_reports` | Count today vs yesterday, % change |
| Refunds | `refund_reports` | Count + total amount, % change |
| Cancellations | `cancel_reports` | Count, % change |
| Escalations | `escalations` | Open count, new in last 24h |

Trend arrows with severity coloring — red for increases, green for decreases.

### Priority 4 — Two-Column Layout

**Left Column (wide):**

1. **Fraud Alerts** — recent fraud reports from `fraud_reports` table. Shows order number, customer info, agent who flagged, detection time. Replaces hardcoded mock data.
2. **Manager Broadcasts** — already fetches real data from `/api/broadcasts`. Kept below fraud since the banner already shows active broadcasts at the top of every page.

**Right Column (340px sidebar):**

1. **Top Reported Countries** — compact list of all countries with connectivity reports in the time window (not just those above threshold). Country name, count, mini bar chart. Helps agents spot countries approaching the threshold.
2. **Recent Actions Feed** — replaces mock "Team Activity". Pulls from all report tables ordered by timestamp. Shows: agent name, action type, order number, time ago.

---

## API Endpoints

### Dashboard

- `GET /api/dashboard/summary` — aggregated dashboard data. Returns: connectivityAlerts, trends, topCountries, recentActions, fraudReports, config.

### Report Actions

- `POST /api/reports/fraud` — create fraud report (also sends notifications as before)
- `POST /api/reports/connectivity` — create connectivity report
- `POST /api/reports/refund` — create refund report (optionally also creates connectivity report)
- `POST /api/reports/cancel` — create cancel report
- `GET /api/reports/fraud` — query fraud reports
- `GET /api/reports/connectivity?country=JP` — query connectivity reports (drill-down)
- `GET /api/reports/refund?reason=connectivity_issues` — query refund reports

### Supervisor Settings

- `GET /api/dashboard/config` — get current thresholds
- `PUT /api/dashboard/config` — update thresholds (supervisor/admin only)

### Unchanged

- `/api/broadcasts` — no changes
- `/api/escalations` — dashboard summary queries it server-side

---

## Supervisor Settings UI

Added to the existing Settings page as a "Dashboard" section (supervisor+ role required).

- **Connectivity alert threshold** — number of reports to trigger a country flag (default: 10)
- **Alert time window** — hours to look back (default: 48)
- **Auto-refresh interval** — dashboard refresh rate in seconds (default: 60)

---

## Implementation Phases

| Phase | Scope | Rationale |
|-------|-------|-----------|
| 1 | Data model — new schema tables (fraud_reports, connectivity_reports, refund_reports, cancel_reports, dashboard_config) + migration | Everything depends on this |
| 2 | API endpoints — all report CRUD + dashboard summary aggregation | Backend before frontend |
| 3 | Migrate existing fraud flow — update "Report Fraud" button to also write to `fraud_reports` table + new `/api/reports/fraud` endpoint | Proves the pattern, immediate dashboard data |
| 4 | Cancel Order action flow (order page modal + API write) | Simplest new action |
| 5 | Refund action flow (order page modal + API write) | Builds on cancel pattern, adds amount/type |
| 6 | Report Connectivity flow (order page modal + TelliSIM pull + API write) | Most complex — TelliSIM data pull |
| 7 | Dashboard redesign (replace mock data with real aggregations) | Now we have real data flowing |
| 8 | Supervisor threshold settings (Settings page section + API) | Fine-tuning once dashboard is live |

Each phase is independently shippable. The dashboard (phase 6) works with whatever data exists — as more action flows ship, it shows more data.

---

## Design Constraints

- Follow existing design system: border radius 8px/16px, font weights 460/540/600/700, Lucide icons only
- Colors: mysteria, lavender, charcoal, amethyst, cream, parchment, fraud-red, fraud-yellow
- Buttons: Warm Cream primary, destructive styling for cancel/refund confirmation
- All modals follow shadcn/ui Dialog pattern
- Dev server on port 5000
