# Search Page: IMEI & ICCID Lookup Tabs

**Date**: 2026-05-12
**Status**: Approved

## Overview

Extend the existing Search page (`/search`) with two new tabs — IMEI Lookup and ICCID Lookup — to give operators a single-input device investigation tool. Each tab fires all data source queries in parallel and renders results as a card grid.

## Navigation

- Three tabs at the top of the Search page: **Search** | **IMEI Lookup** | **ICCID Lookup**
- URL: `/search?tab=search` (default), `/search?tab=imei`, `/search?tab=iccid`
- Tab state in URL for shareability/bookmarking
- Sidebar "Search" nav item unchanged, highlights for all tabs

## IMEI Lookup Tab

**Input**: Single text field + Lookup button. Validates: 15 digits, numeric only.

On submit, fires 5 requests in parallel:

| Section | Source | API Route | Key Data |
|---------|--------|-----------|----------|
| Terminal Status | UCL scrape | `POST /api/ucl/terminal-status` | Online/offline, country, MCC/MNC, signal (from `network` field), battery (`powerLeft`) |
| Device Info | UCL API | `POST /api/ucl/device-info` | Binding info, org, device type. Resolved to marketing name via `sapphire-mapping.ts` |
| Orders | OpenSearch | `POST /api/opensearch/search` | Order #, status, SKU, date, customer email |
| Active Plans | UCL API | `POST /api/ucl/user-offers` | Plan name, data remaining, expiry |
| Recent Sessions | OpenSearch CDR | `POST /api/opensearch/cdr` | Last N sessions — timestamps, data usage. Table format. |

### Card Layout (desktop: 2-col grid, mobile: 1-col stack)

1. **Terminal Status** (top-left) — status pill: green "Online" / gray "Offline". Key fields: country, MCC/MNC, signal strength (parsed from `network` field format `mcc|mnc|rat|rssi`), battery %.
2. **Device Info** (top-right) — device marketing name (via sapphire-mapping), org, terminal type, software version.
3. **Orders** (mid-left) — list of orders with order #, status pill, SKU, date, customer. "No orders found" if empty.
4. **Active Plans** (mid-right) — plan name, data quota/remaining, validity period.
5. **Recent Sessions** (full-width bottom) — table with columns: timestamp, duration, data up/down, MCC/MNC.

## ICCID Lookup Tab

**Input**: Single text field + Lookup button. Validates: 19-20 digits, starts with `89`.

On submit, fires 5 requests in parallel:

| Section | Source | API Route | Key Data |
|---------|--------|-----------|----------|
| Subscription | TelliSIM API | `GET /api/tellisim/subscription/[iccid]` | Status, plan name, data remaining, expiry |
| Location | TelliSIM API | `GET /api/tellisim/location/[iccid]` | Last known location |
| Orders | OpenSearch | `POST /api/opensearch/search` | Order #, status, SKU, date, customer |
| Coverage | TelliSIM API | `GET /api/tellisim/coverage` | Available networks, countries |
| Recent CDR | OpenSearch CDR | `POST /api/opensearch/cdr` | Recent usage records |

### Card Layout (desktop: 2-col grid, mobile: 1-col stack)

1. **Subscription** (top-left) — status pill: green "Active" / amber "Suspended" / gray "Expired". Plan name, data remaining, expiry date.
2. **Location** (top-right) — last known country/network, timestamp.
3. **Orders** (mid-left) — same format as IMEI tab.
4. **Coverage** (mid-right) — available networks/countries for this SIM.
5. **Recent CDR** (full-width bottom) — table with columns: timestamp, duration, data usage, network.

## UI Patterns

- **Input bar**: Full-width text field, placeholder text ("Enter IMEI..." / "Enter ICCID..."), Warm Cream (#e9e5dd) Lookup button.
- **Cards**: shadcn Card component. Header with section title + optional status Badge.
- **Loading**: Skeleton loaders in each card while fetching.
- **Error**: Muted red text inline within the card, not toasts.
- **Empty**: "No data found" gray text within the card.
- **Border radius**: 8px (cards), per design system.
- **Font weights**: 460 body, 540 display, 600 semi, per design system.

## Files to Modify

- `src/app/(app)/search/page.tsx` — add tab navigation and two new tab panels
- No new page routes needed — tabs live within the existing `/search` page
- No new API routes needed — all endpoints already exist

## Files to Create

- `src/components/lookup/imei-lookup.tsx` — IMEI tab content: input + result cards
- `src/components/lookup/iccid-lookup.tsx` — ICCID tab content: input + result cards
- `src/components/lookup/lookup-card.tsx` — reusable card wrapper with skeleton/error/empty states

## Out of Scope

- Cross-referencing IMEI to ICCID (UCL terminal status doesn't reliably return ICCID)
- Parsing signal strength from the `network` field (noted as follow-up; can add later)
- CDR deep-dive or date range filtering (use Analyzer for that)
