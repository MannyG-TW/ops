# TravelWifi Ops

Internal customer-support operations console for TravelWifi / Navimo / CMR Puntos.
Support agents use it to look up customers, orders, eSIMs and devices, inspect
connectivity and data usage, run account actions, and share eSIM activation
details — all from a single screen, backed by the same systems the storefront uses.

> Internal tool. Not customer-facing. Handles real customer data and provider
> credentials — see [Security](#security).

---

## URL & Port

- **Dev URL:** http://localhost:5000
- **Port:** **5000** (never 3000 — the dev script enforces this)

```bash
./scripts/start.sh   # kills any existing server, clears .next cache, starts dev on :5000
./scripts/stop.sh    # stops the server, clears .next cache

npm run build        # production build
npm run lint         # eslint
npm run db:push      # apply Drizzle schema to the local SQLite db
```

### Login (2FA)

- **Dev / staging** (`NEXT_PUBLIC_APP_ENV != "production"`): the 2FA code is shown
  on screen.
- **Production** (`NEXT_PUBLIC_APP_ENV=production`): the code is emailed via Mailgun.

---

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** + **shadcn/ui** — design system is Superhuman-inspired (see `design.md`)
- **Drizzle ORM** over **SQLite** (`ops.sqlite`, via `better-sqlite3`) for local
  settings, credentials and materialized data; **pg** available for Postgres
- **recharts** (charts), **jspdf** + **qrcode.react** (eSIM activation PDF/QR), **xlsx** (exports)

---

## Architecture & Logic

This is a thin, secure **proxy + workspace** over several provider systems. The
browser never talks to providers directly; every external call goes through a
Next.js **route handler** under `src/app/api/**`, which attaches credentials
server-side and returns normalized JSON.

```
Browser (client components)
   │  fetch JSON
   ▼
src/app/api/**           ← route handlers (credentials attached server-side)
   │
   ├── TelliSIM    /api/tellisim/*    eSIM subscriptions, SMDP profile/state history,
   │                                  location, coverage, SMS, suspend, search-by-LPA
   ├── OpenSearch  /api/opensearch/*  orders, ICCID/IMEI/email search, CDR usage
   ├── UCL         /api/ucl/*         device info, terminal status, SaaS portal scraping
   └── local       /api/{settings,kb,broadcasts,escalations,notes,marketing,...}
                                      backed by SQLite (Drizzle)
```

**Credential resolution** — `src/lib/server-credentials.ts` reads OpenSearch /
TelliSIM / UCL credentials from SQLite (`ops.sqlite`) so server routes and
scheduled jobs work without the browser. Requests may also pass credentials in
the body (legacy localStorage path); the server prefers the body, then the DB.

**Data sources**
- **OpenSearch** is the system of record for orders and CDRs (Call Detail Records /
  data usage). Index names live in `src/lib/opensearch-indices.ts`.
- **TelliSIM** is the eSIM provider API (subscription state, plan attachments,
  SMDP install history, last-known location, coverage, LPA activation string).
- **UCL** covers rental/Sapphire devices (IMEI-based device info, terminal status).
- **SQLite** holds operator settings, provider credentials, the system→brand
  mapping, and marketing segmentation materializations.

**Brand awareness** — orders belong to a brand identified by the order-number
prefix (`NV`→Navimo, `TW`→TravelWifi, `CM`→CMR Puntos). `src/lib/brands.ts`
resolves the brand; customer-facing artifacts (e.g. the eSIM activation PDF)
are branded accordingly.

**Design rules** (`design.md` / `CLAUDE.md`): border radius only 8px/16px; font
weights 460/540/600/700; brand palette (mysteria, lavender, charcoal, amethyst,
cream, parchment); Lucide icons only; warm-cream primary buttons.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                 # authenticated workspace
│   │   ├── dashboard/         # command center / overview
│   │   ├── search/            # global search + IMEI / ICCID lookup (LPA, QR, usage)
│   │   ├── customers/[id]/    # customer + order detail, eSIM network status, actions
│   │   ├── analyzer/          # usage / connectivity analysis
│   │   ├── marketing/         # customer segmentation console + exports
│   │   ├── knowledge-base/    # support KB
│   │   ├── broadcasts/        # ops broadcast banners
│   │   ├── escalations/       # escalation queue
│   │   ├── fraud/ · admin/    # fraud review · user admin
│   │   └── settings/          # provider credentials, system→brand mapping, etc.
│   └── api/                   # route handlers (tellisim, opensearch, ucl, settings, …)
├── components/
│   ├── ui/                    # shadcn primitives
│   ├── layout/                # topbar, nav, broadcast banner
│   ├── lookup/                # iccid-lookup, imei-lookup (search surfaces)
│   ├── order-actions/ · settings/ · marketing/
├── lib/
│   ├── tellisim-client.ts · opensearch-client.ts · server-credentials.ts
│   ├── settings-client.ts · smdp-labels.ts · brands.ts · esim-pdf.ts
│   ├── plan-catalog.ts · sku-parser.ts · countries.ts · system-mapping.ts · …
│   └── db/                    # Drizzle schema + client
scripts/        # start.sh, stop.sh, data/report utilities
docs/           # internal reference docs
drizzle/        # migrations
```

### Notable feature: eSIM activation sharing

From both the **ICCID lookup** (`/search`) and the **customer/order page**
(eSIM Network Status), an agent can view the **LPA activation string**, copy it,
show a scannable **QR code**, and **Download PDF** — a branded one-page sheet
(QR + plan details + install steps + manual activation code) to send to a
customer who's struggling to install. See `src/lib/esim-pdf.ts`.

---

## Security

- **Never commit secrets.** `ops.sqlite` (holds provider credentials) and
  `docs/UCL_WEB_ACCOUNTS.md` (service-account creds) are git-ignored. Provider
  credentials are entered in **Settings** and stored locally, not in the repo.
- `.env*` files are ignored. Don't hardcode keys or tokens in source.
