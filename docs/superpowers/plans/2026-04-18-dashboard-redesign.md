# Dashboard Redesign + Agent Action System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock dashboard with a data-driven operations center fed by agent actions (fraud, cancel, refund, connectivity reports) with supervisor-configurable alert thresholds.

**Architecture:** Domain Tables in SQLite — each action type (fraud, cancel, refund, connectivity) gets its own table. A single `/api/dashboard/summary` endpoint aggregates across all tables. New action modals on the customer order page write to these tables. Follows the existing escalations/broadcasts pattern.

**Tech Stack:** Next.js 15 App Router, TypeScript, Drizzle ORM + better-sqlite3, shadcn/ui, Tailwind CSS, TelliSIM API

**Spec:** `docs/superpowers/specs/2026-04-18-dashboard-redesign-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/api/reports/fraud/route.ts` | CRUD for fraud reports |
| `src/app/api/reports/cancel/route.ts` | CRUD for cancel reports |
| `src/app/api/reports/refund/route.ts` | CRUD for refund reports |
| `src/app/api/reports/connectivity/route.ts` | CRUD for connectivity reports |
| `src/app/api/dashboard/summary/route.ts` | Aggregated dashboard data endpoint |
| `src/app/api/dashboard/config/route.ts` | Supervisor threshold settings CRUD |
| `src/components/order-actions/cancel-dialog.tsx` | Cancel order modal |
| `src/components/order-actions/refund-dialog.tsx` | Refund/partial refund modal |
| `src/components/order-actions/connectivity-dialog.tsx` | Report connectivity issue modal |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/db/schema.ts` | Add 5 new tables: fraud_reports, cancel_reports, refund_reports, connectivity_reports, dashboard_config |
| `src/app/(app)/customers/[id]/page.tsx` | Add Cancel, Refund, Report Connectivity buttons + wire up dialogs. Update existing fraud handler to also write to fraud_reports. |
| `src/app/(app)/dashboard/page.tsx` | Complete rewrite — replace all mock data with real data from `/api/dashboard/summary` |
| `src/app/(app)/settings/page.tsx` | Add "Dashboard" section to nav + threshold settings UI |

---

## Task 1: Schema — Add New Tables

**Files:**
- Modify: `src/lib/db/schema.ts` (append after line 144, before the closing of the file)

- [ ] **Step 1: Add fraud_reports table to schema**

Add to the end of `src/lib/db/schema.ts`:

```typescript
/* ─── Fraud Reports ─── */
export const fraudReports = sqliteTable("fraud_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  notes: text("notes").notNull(),
  reportedBy: text("reported_by").notNull(),
  reportedById: text("reported_by_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertFraudReport = typeof fraudReports.$inferInsert;
export type SelectFraudReport = typeof fraudReports.$inferSelect;
```

- [ ] **Step 2: Add connectivity_reports table to schema**

Append to `src/lib/db/schema.ts`:

```typescript
/* ─── Connectivity Reports ─── */
export const connectivityReports = sqliteTable("connectivity_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  country: text("country").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  telliSimData: text("tellisim_data"),
  reportedBy: text("reported_by").notNull(),
  reportedById: text("reported_by_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertConnectivityReport = typeof connectivityReports.$inferInsert;
export type SelectConnectivityReport = typeof connectivityReports.$inferSelect;
```

- [ ] **Step 3: Add refund_reports table to schema**

Append to `src/lib/db/schema.ts`:

```typescript
/* ─── Refund Reports ─── */
export const refundReports = sqliteTable("refund_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  country: text("country"),
  notes: text("notes"),
  processedBy: text("processed_by").notNull(),
  processedById: text("processed_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertRefundReport = typeof refundReports.$inferInsert;
export type SelectRefundReport = typeof refundReports.$inferSelect;
```

- [ ] **Step 4: Add cancel_reports table to schema**

Append to `src/lib/db/schema.ts`:

```typescript
/* ─── Cancel Reports ─── */
export const cancelReports = sqliteTable("cancel_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  cancelledBy: text("cancelled_by").notNull(),
  cancelledById: text("cancelled_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertCancelReport = typeof cancelReports.$inferInsert;
export type SelectCancelReport = typeof cancelReports.$inferSelect;
```

- [ ] **Step 5: Add dashboard_config table to schema**

Append to `src/lib/db/schema.ts`:

```typescript
/* ─── Dashboard Config ─── */
export const dashboardConfig = sqliteTable("dashboard_config", {
  id: text("id").primaryKey(),
  connectivityThreshold: integer("connectivity_threshold").notNull().default(10),
  connectivityWindowHours: integer("connectivity_window_hours").notNull().default(48),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  updatedBy: text("updated_by"),
});

export type InsertDashboardConfig = typeof dashboardConfig.$inferInsert;
export type SelectDashboardConfig = typeof dashboardConfig.$inferSelect;
```

- [ ] **Step 6: Verify the dev server starts with new schema**

Run: `./scripts/start.sh`

Expected: Dev server starts on port 5000 without errors. Drizzle auto-creates new tables in SQLite on first access.

Note: The project uses `better-sqlite3` with Drizzle ORM. Since there's no migration system in place (tables are created on demand by Drizzle), the schema additions are sufficient. Verify by checking the dev server starts cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "feat(schema): add fraud, connectivity, refund, cancel reports and dashboard config tables"
```

---

## Task 2: API — Report Endpoints (Fraud, Cancel, Refund, Connectivity)

**Files:**
- Create: `src/app/api/reports/fraud/route.ts`
- Create: `src/app/api/reports/cancel/route.ts`
- Create: `src/app/api/reports/refund/route.ts`
- Create: `src/app/api/reports/connectivity/route.ts`

- [ ] **Step 1: Create fraud reports API**

Create `src/app/api/reports/fraud/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fraudReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/reports/fraud — list recent fraud reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));

  const results = db
    .select()
    .from(fraudReports)
    .orderBy(desc(fraudReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/fraud — create a fraud report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerName, customerEmail, notes, reportedBy, reportedById } = body;

  if (!orderId || !orderNumber || !customerName || !customerEmail || !notes || !reportedBy || !reportedById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerName,
    customerEmail,
    notes,
    reportedBy,
    reportedById,
    createdAt: new Date(),
  };

  db.insert(fraudReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
```

- [ ] **Step 2: Create cancel reports API**

Create `src/app/api/reports/cancel/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cancelReports } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = ["customer_request", "duplicate_order", "fraud", "other"];

/** GET /api/reports/cancel — list recent cancel reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));

  const results = db
    .select()
    .from(cancelReports)
    .orderBy(desc(cancelReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/cancel — create a cancel report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerEmail, reason, notes, cancelledBy, cancelledById } = body;

  if (!orderId || !orderNumber || !customerEmail || !reason || !cancelledBy || !cancelledById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerEmail,
    reason,
    notes: notes || null,
    cancelledBy,
    cancelledById,
    status: "pending",
    createdAt: new Date(),
  };

  db.insert(cancelReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
```

- [ ] **Step 3: Create refund reports API**

Create `src/app/api/reports/refund/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { refundReports, connectivityReports } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = [
  "connectivity_issues", "customer_request", "duplicate_order",
  "late_delivery", "device_malfunction", "billing_error", "other",
];

/** GET /api/reports/refund — list recent refund reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "20", 10)));
  const reason = req.nextUrl.searchParams.get("reason");

  let query = db.select().from(refundReports).orderBy(desc(refundReports.createdAt)).limit(limit);

  const results = reason
    ? db.select().from(refundReports).where(eq(refundReports.reason, reason)).orderBy(desc(refundReports.createdAt)).limit(limit).all()
    : query.all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/refund — create a refund report. If reason is connectivity_issues, also creates a connectivity report. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    orderId, orderNumber, customerEmail, type, amount, currency,
    reason, country, notes, processedBy, processedById,
    telliSimData,
  } = body;

  if (!orderId || !orderNumber || !customerEmail || !type || amount == null || !currency || !reason || !processedBy || !processedById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` }, { status: 400 });
  }

  if (!["full", "partial"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Type must be 'full' or 'partial'" }, { status: 400 });
  }

  if (reason === "connectivity_issues" && !country) {
    return NextResponse.json({ ok: false, error: "Country required for connectivity issues" }, { status: 400 });
  }

  const now = new Date();

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerEmail,
    type,
    amount: Math.round(amount * 100), // Store as cents
    currency,
    reason,
    country: country || null,
    notes: notes || null,
    processedBy,
    processedById,
    status: "pending",
    createdAt: now,
  };

  db.insert(refundReports).values(report).run();

  // Also create a connectivity report if reason is connectivity_issues
  let connectivityReport = null;
  if (reason === "connectivity_issues" && country) {
    connectivityReport = {
      id: randomUUID(),
      orderId,
      orderNumber,
      customerEmail,
      country,
      reason: "no_data", // Default reason for refund-linked reports
      notes: notes ? `[From refund] ${notes}` : "[Created from refund report]",
      telliSimData: telliSimData ? JSON.stringify(telliSimData) : null,
      reportedBy: processedBy,
      reportedById: processedById,
      createdAt: now,
    };
    db.insert(connectivityReports).values(connectivityReport).run();
  }

  return NextResponse.json({ ok: true, report, connectivityReport });
}
```

- [ ] **Step 4: Create connectivity reports API**

Create `src/app/api/reports/connectivity/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { connectivityReports } from "@/lib/db/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { randomUUID } from "crypto";

const VALID_REASONS = ["no_data", "intermittent", "slow_speeds", "cannot_register", "other"];

/** GET /api/reports/connectivity?country=JP&hours=48 — list connectivity reports */
export async function GET(req: NextRequest) {
  const limit = Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "50", 10)));
  const country = req.nextUrl.searchParams.get("country");
  const hours = parseInt(req.nextUrl.searchParams.get("hours") || "0", 10);

  const conditions = [];
  if (country) {
    conditions.push(eq(connectivityReports.country, country.toUpperCase()));
  }
  if (hours > 0) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    conditions.push(gte(connectivityReports.createdAt, since));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const results = db
    .select()
    .from(connectivityReports)
    .where(where)
    .orderBy(desc(connectivityReports.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({ ok: true, reports: results });
}

/** POST /api/reports/connectivity — create a connectivity report */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orderId, orderNumber, customerEmail, country, reason, notes, telliSimData, reportedBy, reportedById } = body;

  if (!orderId || !orderNumber || !customerEmail || !country || !reason || !reportedBy || !reportedById) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` }, { status: 400 });
  }

  const report = {
    id: randomUUID(),
    orderId,
    orderNumber,
    customerEmail,
    country: country.toUpperCase(),
    reason,
    notes: notes || null,
    telliSimData: telliSimData ? JSON.stringify(telliSimData) : null,
    reportedBy,
    reportedById,
    createdAt: new Date(),
  };

  db.insert(connectivityReports).values(report).run();

  return NextResponse.json({ ok: true, report });
}
```

- [ ] **Step 5: Verify all report endpoints respond**

Start the dev server and test each endpoint with curl:

```bash
# Test fraud report creation
curl -X POST http://localhost:5000/api/reports/fraud \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-1","orderNumber":"TW-00001","customerName":"Test User","customerEmail":"test@test.com","notes":"Test fraud","reportedBy":"Agent","reportedById":"agent@test.com"}'

# Test cancel report creation
curl -X POST http://localhost:5000/api/reports/cancel \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-1","orderNumber":"TW-00001","customerEmail":"test@test.com","reason":"customer_request","cancelledBy":"Agent","cancelledById":"agent@test.com"}'

# Test refund report creation
curl -X POST http://localhost:5000/api/reports/refund \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-1","orderNumber":"TW-00001","customerEmail":"test@test.com","type":"full","amount":42.00,"currency":"USD","reason":"customer_request","processedBy":"Agent","processedById":"agent@test.com"}'

# Test connectivity report creation
curl -X POST http://localhost:5000/api/reports/connectivity \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test-1","orderNumber":"TW-00001","customerEmail":"test@test.com","country":"JP","reason":"no_data","reportedBy":"Agent","reportedById":"agent@test.com"}'

# Test GET endpoints
curl http://localhost:5000/api/reports/fraud
curl http://localhost:5000/api/reports/cancel
curl http://localhost:5000/api/reports/refund
curl http://localhost:5000/api/reports/connectivity?country=JP
```

Expected: All POST endpoints return `{ ok: true, report: {...} }`. All GET endpoints return `{ ok: true, reports: [...] }`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/reports/
git commit -m "feat(api): add fraud, cancel, refund, connectivity report endpoints"
```

---

## Task 3: API — Dashboard Summary + Config Endpoints

**Files:**
- Create: `src/app/api/dashboard/summary/route.ts`
- Create: `src/app/api/dashboard/config/route.ts`

- [ ] **Step 1: Create dashboard config API**

Create `src/app/api/dashboard/config/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dashboardConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getOrCreateConfig() {
  let config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get();
  if (!config) {
    db.insert(dashboardConfig).values({
      id: "default",
      connectivityThreshold: 10,
      connectivityWindowHours: 48,
    }).run();
    config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get()!;
  }
  return config;
}

/** GET /api/dashboard/config — get dashboard thresholds */
export async function GET() {
  const config = getOrCreateConfig();
  return NextResponse.json({ ok: true, config });
}

/** PUT /api/dashboard/config — update dashboard thresholds (supervisor/admin only) */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { connectivityThreshold, connectivityWindowHours, updatedBy } = body;

  if (!updatedBy) {
    return NextResponse.json({ ok: false, error: "updatedBy required" }, { status: 400 });
  }

  // Ensure row exists
  getOrCreateConfig();

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy };
  if (connectivityThreshold !== undefined) {
    const val = parseInt(connectivityThreshold, 10);
    if (isNaN(val) || val < 1) {
      return NextResponse.json({ ok: false, error: "Threshold must be a positive integer" }, { status: 400 });
    }
    updates.connectivityThreshold = val;
  }
  if (connectivityWindowHours !== undefined) {
    const val = parseInt(connectivityWindowHours, 10);
    if (isNaN(val) || val < 1) {
      return NextResponse.json({ ok: false, error: "Window must be a positive integer" }, { status: 400 });
    }
    updates.connectivityWindowHours = val;
  }

  db.update(dashboardConfig).set(updates).where(eq(dashboardConfig.id, "default")).run();

  const config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get();
  return NextResponse.json({ ok: true, config });
}
```

- [ ] **Step 2: Create dashboard summary API**

Create `src/app/api/dashboard/summary/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  fraudReports,
  connectivityReports,
  refundReports,
  cancelReports,
  escalations,
  dashboardConfig,
} from "@/lib/db/schema";
import { desc, gte, sql, eq, and } from "drizzle-orm";

function getConfig() {
  let config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get();
  if (!config) {
    db.insert(dashboardConfig).values({
      id: "default",
      connectivityThreshold: 10,
      connectivityWindowHours: 48,
    }).run();
    config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get()!;
  }
  return config;
}

/** GET /api/dashboard/summary — aggregated dashboard data */
export async function GET() {
  const config = getConfig();
  const now = Date.now();
  const h24 = new Date(now - 24 * 60 * 60 * 1000);
  const h48 = new Date(now - 48 * 60 * 60 * 1000);
  const windowStart = new Date(now - config.connectivityWindowHours * 60 * 60 * 1000);

  // ── Connectivity alerts: group by country within window ──
  const countryAgg = db
    .select({
      country: connectivityReports.country,
      count: sql<number>`count(*)`,
      latestAt: sql<string>`max(created_at)`,
    })
    .from(connectivityReports)
    .where(gte(connectivityReports.createdAt, windowStart))
    .groupBy(connectivityReports.country)
    .all();

  const connectivityAlerts = countryAgg
    .filter((c) => c.count >= config.connectivityThreshold)
    .sort((a, b) => b.count - a.count)
    .map((c) => ({
      country: c.country,
      count: c.count,
      latestAt: c.latestAt,
      threshold: config.connectivityThreshold,
      windowHours: config.connectivityWindowHours,
    }));

  const topCountries = countryAgg
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map((c) => ({
      country: c.country,
      count: c.count,
      latestAt: c.latestAt,
      aboveThreshold: c.count >= config.connectivityThreshold,
    }));

  // ── Trend cards: last 24h vs prior 24h ──
  const connectivityLast24 = db.select({ count: sql<number>`count(*)` }).from(connectivityReports).where(gte(connectivityReports.createdAt, h24)).get()?.count ?? 0;
  const connectivityPrior24 = db.select({ count: sql<number>`count(*)` }).from(connectivityReports).where(and(gte(connectivityReports.createdAt, h48), sql`created_at < ${h24.getTime() / 1000}`)).get()?.count ?? 0;

  const refundsLast24 = db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(amount), 0)` }).from(refundReports).where(gte(refundReports.createdAt, h24)).get() ?? { count: 0, total: 0 };
  const refundsPrior24 = db.select({ count: sql<number>`count(*)` }).from(refundReports).where(and(gte(refundReports.createdAt, h48), sql`created_at < ${h24.getTime() / 1000}`)).get()?.count ?? 0;

  const cancelsLast24 = db.select({ count: sql<number>`count(*)` }).from(cancelReports).where(gte(cancelReports.createdAt, h24)).get()?.count ?? 0;
  const cancelsPrior24 = db.select({ count: sql<number>`count(*)` }).from(cancelReports).where(and(gte(cancelReports.createdAt, h48), sql`created_at < ${h24.getTime() / 1000}`)).get()?.count ?? 0;

  const escalationsOpen = db.select({ count: sql<number>`count(*)` }).from(escalations).where(sql`status != 'resolved'`).get()?.count ?? 0;
  const escalationsNew24 = db.select({ count: sql<number>`count(*)` }).from(escalations).where(gte(escalations.createdAt, h24)).get()?.count ?? 0;

  function pctChange(current: number, prior: number): number {
    if (prior === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prior) / prior) * 100);
  }

  const trends = {
    connectivity: { current: connectivityLast24, prior: connectivityPrior24, change: pctChange(connectivityLast24, connectivityPrior24) },
    refunds: { current: refundsLast24.count, prior: refundsPrior24, change: pctChange(refundsLast24.count, refundsPrior24), totalAmount: refundsLast24.total },
    cancellations: { current: cancelsLast24, prior: cancelsPrior24, change: pctChange(cancelsLast24, cancelsPrior24) },
    escalations: { open: escalationsOpen, new24h: escalationsNew24 },
  };

  // ── Fraud reports: most recent ──
  const recentFraud = db
    .select()
    .from(fraudReports)
    .orderBy(desc(fraudReports.createdAt))
    .limit(10)
    .all();

  // ── Recent actions feed: union of all report types ──
  const recentFraudActions = db.select({ id: fraudReports.id, type: sql<string>`'fraud'`, agent: fraudReports.reportedBy, orderNumber: fraudReports.orderNumber, createdAt: fraudReports.createdAt }).from(fraudReports).orderBy(desc(fraudReports.createdAt)).limit(5).all();
  const recentCancelActions = db.select({ id: cancelReports.id, type: sql<string>`'cancel'`, agent: cancelReports.cancelledBy, orderNumber: cancelReports.orderNumber, createdAt: cancelReports.createdAt }).from(cancelReports).orderBy(desc(cancelReports.createdAt)).limit(5).all();
  const recentRefundActions = db.select({ id: refundReports.id, type: sql<string>`'refund'`, agent: refundReports.processedBy, orderNumber: refundReports.orderNumber, createdAt: refundReports.createdAt }).from(refundReports).orderBy(desc(refundReports.createdAt)).limit(5).all();
  const recentConnActions = db.select({ id: connectivityReports.id, type: sql<string>`'connectivity'`, agent: connectivityReports.reportedBy, orderNumber: connectivityReports.orderNumber, createdAt: connectivityReports.createdAt }).from(connectivityReports).orderBy(desc(connectivityReports.createdAt)).limit(5).all();

  const recentActions = [...recentFraudActions, ...recentCancelActions, ...recentRefundActions, ...recentConnActions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return NextResponse.json({
    ok: true,
    connectivityAlerts,
    topCountries,
    trends,
    fraudReports: recentFraud,
    recentActions,
    config: {
      connectivityThreshold: config.connectivityThreshold,
      connectivityWindowHours: config.connectivityWindowHours,
    },
  });
}
```

- [ ] **Step 3: Verify dashboard summary endpoint**

```bash
curl http://localhost:5000/api/dashboard/summary | jq .
```

Expected: Returns JSON with `connectivityAlerts`, `topCountries`, `trends`, `fraudReports`, `recentActions`, `config` keys. All arrays/objects should be present (may be empty if no test data).

- [ ] **Step 4: Verify dashboard config endpoint**

```bash
# Get default config
curl http://localhost:5000/api/dashboard/config | jq .

# Update threshold
curl -X PUT http://localhost:5000/api/dashboard/config \
  -H "Content-Type: application/json" \
  -d '{"connectivityThreshold": 5, "connectivityWindowHours": 24, "updatedBy": "admin@test.com"}'
```

Expected: GET returns default config (threshold=10, window=48). PUT updates successfully and returns updated config.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/dashboard/
git commit -m "feat(api): add dashboard summary aggregation and config endpoints"
```

---

## Task 4: Migrate Existing Fraud Flow to Write to fraud_reports

**Files:**
- Modify: `src/app/(app)/customers/[id]/page.tsx` (lines ~1041-1074, the `handleFraudFlag` function)

- [ ] **Step 1: Update handleFraudFlag to also write to fraud_reports**

In `src/app/(app)/customers/[id]/page.tsx`, find the `handleFraudFlag` function (around line 1041). Replace it with a version that first writes to `/api/reports/fraud`, then sends notifications as before:

```typescript
  async function handleFraudFlag() {
    if (!fraudNote.trim()) return;
    setFraudLoading(true);
    try {
      const currentEmail = typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : "";
      const currentUser = TEAM_MEMBERS.find((m) => m.email === currentEmail) || TEAM_MEMBERS[0];

      // Write structured fraud report to DB
      await fetch("/api/reports/fraud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder?.id || "",
          orderNumber: selectedOrder?.order_number || selectedOrder?.id || "N/A",
          customerName: [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail,
          customerEmail,
          notes: fraudNote,
          reportedBy: currentUser.name,
          reportedById: currentEmail,
        }),
      });

      // Notify all supervisors/admins about fraud flag (existing behavior)
      const supervisors = TEAM_MEMBERS.filter((m) => m.role === "admin" || m.role === "manager");
      for (const sup of supervisors) {
        if (sup.email === currentEmail) continue;
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: sup.email,
            type: "escalation",
            title: `Fraud Flag: ${[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail}`,
            message: `Order ${selectedOrder?.order_number || selectedOrder?.id || "N/A"} flagged for fraud. ${fraudNote}`,
            link: `/customers/${customerEmail}`,
            sourceType: "escalation",
            sourceId: selectedOrder?.id || customerEmail,
            actorId: currentEmail,
            actorName: currentUser.name,
          }),
        });
      }
      setFraudNote("");
      setFraudDialogOpen(false);
    } catch {
      // silent — notification is best-effort
    } finally {
      setFraudLoading(false);
    }
  }
```

- [ ] **Step 2: Test fraud flag in browser**

1. Open `http://localhost:5000` and navigate to a customer
2. Select an order, click the "Fraud" button
3. Enter a reason and confirm
4. Verify the fraud report was saved: `curl http://localhost:5000/api/reports/fraud | jq .`

Expected: The fraud report appears in the GET response with the correct order and customer data.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/customers/[id]/page.tsx
git commit -m "feat(fraud): write structured fraud reports to DB alongside notifications"
```

---

## Task 5: Cancel Order Dialog

**Files:**
- Create: `src/components/order-actions/cancel-dialog.tsx`
- Modify: `src/app/(app)/customers/[id]/page.tsx` (add button + state + import)

- [ ] **Step 1: Create cancel dialog component**

Create `src/components/order-actions/cancel-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CANCEL_REASONS = [
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_order", label: "Duplicate Order" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

interface CancelDialogProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number?: string;
    customer_email?: string;
    customer_first_name?: string;
    customer_last_name?: string;
    total?: number;
    currency?: string;
  };
  agentName: string;
  agentId: string;
}

export function CancelDialog({ open, onClose, order, agentName, agentId }: CancelDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || order.customer_email || "Unknown";

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number || order.id,
          customerEmail: order.customer_email || "",
          reason,
          notes: notes.trim() || null,
          cancelledBy: agentName,
          cancelledById: agentId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setStep("form");
          setReason("");
          setNotes("");
          onClose();
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep("form");
    setReason("");
    setNotes("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-fraud-red flex items-center gap-2">
            <XCircle className="h-5 w-5" strokeWidth={2} />
            Cancel Order
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            Record a cancellation for this order. Actual processing will happen when the CRM endpoint is ready.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-6 text-center">
              <p className="text-[14px] font-[600] text-success">Order cancellation recorded. Pending processing.</p>
            </div>
          ) : step === "form" ? (
            <>
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-fraud-red/80">
                  <span className="font-[600]">{customerName}</span> — Order {order.order_number || order.id}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason</p>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reason === "fraud" && (
                  <p className="text-[11px] font-[460] text-fraud-red mt-1.5">This will also file a fraud report.</p>
                )}
              </div>
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Notes <span className="font-[460] text-muted-foreground">(optional)</span></p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context..."
                  className="rounded-[8px] min-h-[60px] text-[13px] font-[460] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={handleClose} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Close
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!reason}
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-4 text-center space-y-2">
                <AlertTriangle className="h-8 w-8 text-fraud-red mx-auto" strokeWidth={1.5} />
                <p className="text-[14px] font-[600] text-fraud-red">
                  Are you sure you want to cancel order {order.order_number || order.id}?
                </p>
                <p className="text-[12px] font-[460] text-muted-foreground">This action will be recorded and cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setStep("form")} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" strokeWidth={2} />}
                  Confirm Cancellation
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add cancel button and state to customer order page**

In `src/app/(app)/customers/[id]/page.tsx`:

1. Add import at top of file:
```typescript
import { CancelDialog } from "@/components/order-actions/cancel-dialog";
```

2. Add state alongside existing action dialog states (near line 566):
```typescript
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
```

3. Add the Cancel button in the action buttons row (after the Escalate button, before the Fraud button, around line 1307):
```typescript
                <Button size="sm" onClick={() => setCancelDialogOpen(true)} className="h-7 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] hover:bg-fraud-red/20 cursor-pointer px-2">
                  <XCircle className="h-3 w-3" strokeWidth={2} /> Cancel
                </Button>
```

4. Add the dialog render before the closing `</div>` of the page (near the other dialogs around line 2755):
```typescript
      {/* ─── Cancel Order Dialog ─── */}
      <CancelDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />
```

5. Add `XCircle` to the lucide-react import if not already present.

- [ ] **Step 3: Test cancel flow in browser**

1. Navigate to a customer with orders
2. Click "Cancel" on an order
3. Select a reason, add notes, click Continue
4. Confirm the cancellation
5. Verify toast/success state appears
6. Verify: `curl http://localhost:5000/api/reports/cancel | jq .`

Expected: Cancel report saved with correct order data.

- [ ] **Step 4: Commit**

```bash
git add src/components/order-actions/cancel-dialog.tsx src/app/(app)/customers/[id]/page.tsx
git commit -m "feat(actions): add cancel order dialog with reason capture"
```

---

## Task 6: Refund Dialog

**Files:**
- Create: `src/components/order-actions/refund-dialog.tsx`
- Modify: `src/app/(app)/customers/[id]/page.tsx` (add button + state + import)

- [ ] **Step 1: Create refund dialog component**

Create `src/components/order-actions/refund-dialog.tsx`:

```typescript
"use client";

import { useState } from "react";
import { DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const REFUND_REASONS = [
  { value: "connectivity_issues", label: "Connectivity Issues" },
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_order", label: "Duplicate Order" },
  { value: "late_delivery", label: "Late Delivery" },
  { value: "device_malfunction", label: "Device Malfunction" },
  { value: "billing_error", label: "Billing Error" },
  { value: "other", label: "Other" },
];

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number?: string;
    customer_email?: string;
    customer_first_name?: string;
    customer_last_name?: string;
    total?: number;
    total_usd?: number;
    currency?: string;
    destination_country?: string;
  };
  agentName: string;
  agentId: string;
}

export function RefundDialog({ open, onClose, order, agentName, agentId }: RefundDialogProps) {
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState(String(order.total || order.total_usd || 0));
  const [reason, setReason] = useState("");
  const [country, setCountry] = useState(order.destination_country || "");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const currency = order.currency || "USD";
  const customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || order.customer_email || "Unknown";
  const displayAmount = refundType === "full" ? (order.total || order.total_usd || 0) : parseFloat(amount) || 0;

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number || order.id,
          customerEmail: order.customer_email || "",
          type: refundType,
          amount: displayAmount,
          currency,
          reason,
          country: reason === "connectivity_issues" ? country.toUpperCase() : null,
          notes: notes.trim() || null,
          processedBy: agentName,
          processedById: agentId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setStep("form");
          setReason("");
          setNotes("");
          setRefundType("full");
          onClose();
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setStep("form");
    setReason("");
    setNotes("");
    setRefundType("full");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-amethyst flex items-center gap-2">
            <DollarSign className="h-5 w-5" strokeWidth={2} />
            Refund Order
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            Record a refund for this order. Actual payment processing will happen when the API is ready.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-6 text-center">
              <p className="text-[14px] font-[600] text-success">
                {refundType === "full" ? "Full" : "Partial"} refund of {currency} {displayAmount.toFixed(2)} recorded.
              </p>
            </div>
          ) : step === "form" ? (
            <>
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-charcoal/80">
                  <span className="font-[600]">{customerName}</span> — Order {order.order_number || order.id}
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Total: {currency} {(order.total || order.total_usd || 0).toFixed(2)}
                  </span>
                </p>
              </div>

              {/* Refund type toggle */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Refund Type</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => { setRefundType("full"); setAmount(String(order.total || order.total_usd || 0)); }}
                    className={`rounded-[8px] text-[12px] font-[600] cursor-pointer flex-1 ${refundType === "full" ? "bg-amethyst text-white" : "bg-cream text-charcoal hover:bg-cream-hover"}`}
                  >
                    Full Refund
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setRefundType("partial")}
                    className={`rounded-[8px] text-[12px] font-[600] cursor-pointer flex-1 ${refundType === "partial" ? "bg-amethyst text-white" : "bg-cream text-charcoal hover:bg-cream-hover"}`}
                  >
                    Partial Refund
                  </Button>
                </div>
              </div>

              {/* Amount (editable for partial) */}
              {refundType === "partial" && (
                <div>
                  <p className="text-[12px] font-[600] text-foreground mb-1.5">Amount ({currency})</p>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={order.total || order.total_usd || 9999}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="rounded-[8px] text-[13px] font-[460]"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason</p>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REFUND_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country (only for connectivity issues) */}
              {reason === "connectivity_issues" && (
                <div>
                  <p className="text-[12px] font-[600] text-foreground mb-1.5">Country</p>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="ISO2 country code (e.g., JP)"
                    className="rounded-[8px] text-[13px] font-[460] uppercase"
                    maxLength={2}
                  />
                  <p className="text-[11px] font-[460] text-amethyst mt-1">This will also create a connectivity report for this country.</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Notes <span className="font-[460] text-muted-foreground">(optional)</span></p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional context..."
                  className="rounded-[8px] min-h-[60px] text-[13px] font-[460] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={handleClose} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Close
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!reason || (refundType === "partial" && (!amount || parseFloat(amount) <= 0)) || (reason === "connectivity_issues" && !country.trim())}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-[8px] bg-fraud-yellow-soft border border-fraud-yellow/20 px-4 py-4 text-center space-y-2">
                <AlertTriangle className="h-8 w-8 text-fraud-yellow mx-auto" strokeWidth={1.5} />
                <p className="text-[14px] font-[600] text-charcoal">
                  Confirm {refundType} refund of {currency} {displayAmount.toFixed(2)}
                </p>
                <p className="text-[12px] font-[460] text-muted-foreground">
                  Order {order.order_number || order.id} — {customerName}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setStep("form")} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DollarSign className="h-3.5 w-3.5" strokeWidth={2} />}
                  Confirm Refund
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add refund button and state to customer order page**

In `src/app/(app)/customers/[id]/page.tsx`:

1. Add import:
```typescript
import { RefundDialog } from "@/components/order-actions/refund-dialog";
```

2. Add state (near other action dialog states):
```typescript
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
```

3. Add Refund button in the action buttons row (after Cancel, before Fraud):
```typescript
                <Button size="sm" onClick={() => setRefundDialogOpen(true)} className="h-7 rounded-[8px] bg-lavender/20 text-amethyst text-[11px] font-[600] hover:bg-lavender/30 cursor-pointer px-2">
                  <DollarSign className="h-3 w-3" strokeWidth={2} /> Refund
                </Button>
```

4. Add dialog render (near other dialogs):
```typescript
      {/* ─── Refund Dialog ─── */}
      <RefundDialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />
```

5. Add `DollarSign` to lucide-react import if not already present.

- [ ] **Step 3: Test refund flow in browser**

1. Navigate to a customer order
2. Click "Refund", select Full Refund, pick "Customer Request", confirm
3. Click "Refund" again, select Partial Refund, enter amount, pick "Connectivity Issues", enter country code, confirm
4. Verify: `curl http://localhost:5000/api/reports/refund | jq .`
5. For connectivity reason, also verify: `curl http://localhost:5000/api/reports/connectivity | jq .`

Expected: Both refund reports saved. Connectivity-reason refund also created a connectivity report.

- [ ] **Step 4: Commit**

```bash
git add src/components/order-actions/refund-dialog.tsx src/app/(app)/customers/[id]/page.tsx
git commit -m "feat(actions): add refund/partial refund dialog with reason and connectivity linking"
```

---

## Task 7: Report Connectivity Dialog

**Files:**
- Create: `src/components/order-actions/connectivity-dialog.tsx`
- Modify: `src/app/(app)/customers/[id]/page.tsx` (add button + state + import)

- [ ] **Step 1: Create connectivity dialog component**

Create `src/components/order-actions/connectivity-dialog.tsx`:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Signal, Loader2, Wifi, WifiOff, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTelliSIM } from "@/lib/settings-client";

const CONNECTIVITY_REASONS = [
  { value: "no_data", label: "No Data" },
  { value: "intermittent", label: "Intermittent Connection" },
  { value: "slow_speeds", label: "Slow Speeds" },
  { value: "cannot_register", label: "Cannot Register on Network" },
  { value: "other", label: "Other" },
];

interface ConnectivityDialogProps {
  open: boolean;
  onClose: () => void;
  order: {
    id: string;
    order_number?: string;
    customer_email?: string;
    destination_country?: string;
  };
  iccid: string;
  agentName: string;
  agentId: string;
}

interface TelliSimSnapshot {
  iccid: string;
  imei?: string;
  operator?: string;
  connectionStatus?: string;
  planState?: string;
}

export function ConnectivityDialog({ open, onClose, order, iccid, agentName, agentId }: ConnectivityDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [telliSimLoading, setTelliSimLoading] = useState(false);
  const [telliSimData, setTelliSimData] = useState<TelliSimSnapshot | null>(null);

  const country = order.destination_country || "";

  // Fetch TelliSIM data when dialog opens
  useEffect(() => {
    if (!open || !iccid) return;
    setTelliSimLoading(true);
    setTelliSimData(null);

    async function fetchData() {
      try {
        // Fetch subscription data
        const subData = await fetchTelliSIM(`/api/tellisim/subscription/${iccid}`, {});
        const sub = subData?.subscription || subData;

        // Fetch location data
        const locData = await fetchTelliSIM(`/api/tellisim/location/${iccid}`, {});
        const loc = locData?.location || locData;

        setTelliSimData({
          iccid,
          imei: sub?.imei || loc?.imei || undefined,
          operator: loc?.operatorName || loc?.operator || undefined,
          connectionStatus: loc?.connectionStatus || sub?.connectionStatus || undefined,
          planState: sub?.state || undefined,
        });
      } catch {
        setTelliSimData({ iccid });
      } finally {
        setTelliSimLoading(false);
      }
    }
    fetchData();
  }, [open, iccid]);

  if (!open) return null;

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch("/api/reports/connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number || order.id,
          customerEmail: order.customer_email || "",
          country: country.toUpperCase(),
          reason,
          notes: notes.trim() || null,
          telliSimData: telliSimData || null,
          reportedBy: agentName,
          reportedById: agentId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setReason("");
          setNotes("");
          onClose();
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setReason("");
    setNotes("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-lg mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-amethyst flex items-center gap-2">
            <Signal className="h-5 w-5" strokeWidth={2} />
            Report Connectivity Issue
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            Report a connectivity problem for this eSIM. TelliSIM data is captured automatically.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-6 text-center">
              <p className="text-[14px] font-[600] text-success">Connectivity issue reported for {country}.</p>
            </div>
          ) : (
            <>
              {/* TelliSIM Data Panel */}
              <div className="rounded-[8px] bg-muted/30 border border-border/60 px-4 py-3 space-y-2">
                <p className="text-[11px] font-[600] text-muted-foreground uppercase tracking-wider">TelliSIM Status</p>
                {telliSimLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amethyst" />
                    <span className="text-[12px] font-[460] text-muted-foreground">Fetching SIM data...</span>
                  </div>
                ) : telliSimData ? (
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="font-[600] text-muted-foreground">ICCID:</span>
                      <span className="ml-1 font-mono font-[460]">{telliSimData.iccid}</span>
                    </div>
                    {telliSimData.imei && (
                      <div>
                        <span className="font-[600] text-muted-foreground">IMEI:</span>
                        <span className="ml-1 font-mono font-[460]">{telliSimData.imei}</span>
                      </div>
                    )}
                    {telliSimData.operator && (
                      <div>
                        <span className="font-[600] text-muted-foreground">Operator:</span>
                        <span className="ml-1 font-[460]">{telliSimData.operator}</span>
                      </div>
                    )}
                    {telliSimData.connectionStatus && (
                      <div className="flex items-center gap-1">
                        <span className="font-[600] text-muted-foreground">Status:</span>
                        {telliSimData.connectionStatus.toLowerCase().includes("online") ? (
                          <Badge className="bg-success-soft text-success border-0 text-[10px] px-1.5 py-0 font-[600]">
                            <Wifi className="h-2.5 w-2.5 mr-0.5" /> Online
                          </Badge>
                        ) : (
                          <Badge className="bg-fraud-red-soft text-fraud-red border-0 text-[10px] px-1.5 py-0 font-[600]">
                            <WifiOff className="h-2.5 w-2.5 mr-0.5" /> {telliSimData.connectionStatus}
                          </Badge>
                        )}
                      </div>
                    )}
                    {telliSimData.planState && (
                      <div>
                        <span className="font-[600] text-muted-foreground">Plan:</span>
                        <span className="ml-1 font-[460]">{telliSimData.planState}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] font-[460] text-muted-foreground">Could not fetch TelliSIM data.</p>
                )}
              </div>

              {/* Country */}
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-charcoal/80">
                  <span className="font-[600]">Country:</span> {country || "Unknown"}
                  <span className="mx-2 text-border">|</span>
                  <span className="font-[600]">Order:</span> {order.order_number || order.id}
                </p>
              </div>

              {/* Reason */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Issue Type</p>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="What is the customer experiencing?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONNECTIVITY_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Notes <span className="font-[460] text-muted-foreground">(optional)</span></p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Customer's description of the issue..."
                  className="rounded-[8px] min-h-[60px] text-[13px] font-[460] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button onClick={handleClose} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Close
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!reason || !country || loading}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Signal className="h-3.5 w-3.5" strokeWidth={2} />}
                  Report Issue
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add connectivity button and state to customer order page**

In `src/app/(app)/customers/[id]/page.tsx`:

1. Add import:
```typescript
import { ConnectivityDialog } from "@/components/order-actions/connectivity-dialog";
```

2. Add state:
```typescript
  const [connectivityDialogOpen, setConnectivityDialogOpen] = useState(false);
```

3. Add button in the eSIM-only section of action buttons (inside the `productType === "esim"` block, around line 1291, after the existing eSIM buttons and before `</>`:
```typescript
                    <Button size="sm" onClick={() => setConnectivityDialogOpen(true)} className="h-7 rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow text-[11px] font-[600] hover:bg-fraud-yellow/20 cursor-pointer px-2">
                      <Signal className="h-3 w-3" strokeWidth={2} /> Connectivity
                    </Button>
```

4. Add `Signal` to lucide-react import if not already present.

5. Add dialog render (near other dialogs):
```typescript
      {/* ─── Connectivity Report Dialog ─── */}
      <ConnectivityDialog
        open={connectivityDialogOpen}
        onClose={() => setConnectivityDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        iccid={selectedSerial || ""}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />
```

- [ ] **Step 3: Test connectivity report flow in browser**

1. Navigate to a customer with an eSIM order
2. Select a serial/ICCID
3. Click "Connectivity" button (should only be visible for eSIM orders)
4. Verify TelliSIM data loads in the modal
5. Select a reason, submit
6. Verify: `curl http://localhost:5000/api/reports/connectivity | jq .`

Expected: Connectivity report saved with TelliSIM snapshot JSON.

- [ ] **Step 4: Commit**

```bash
git add src/components/order-actions/connectivity-dialog.tsx src/app/(app)/customers/[id]/page.tsx
git commit -m "feat(actions): add connectivity issue report dialog with TelliSIM data capture"
```

---

## Task 8: Dashboard Redesign — Replace Mock Data

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx` (complete rewrite)

- [ ] **Step 1: Rewrite dashboard page with real data**

Replace the entire contents of `src/app/(app)/dashboard/page.tsx` with the new data-driven dashboard. The page should:

1. Call `GET /api/dashboard/summary` on mount and every 60 seconds
2. Display sections in this order:
   - **Connectivity Alerts** (countries above threshold) — full width, top
   - **Trend Cards** (4 cards: connectivity, refunds, cancellations, escalations) — full width row
   - **Two-column layout**: Left (Fraud Alerts, Manager Broadcasts), Right (Top Reported Countries, Recent Actions Feed)
3. Show "Last refreshed: X seconds ago" in the header
4. Remove all hardcoded mock data arrays
5. Handle loading and empty states gracefully

Key implementation details:
- Use `useState` for dashboard data, loading state, last refresh time
- Use `useEffect` with `setInterval` for auto-refresh
- Reuse the existing broadcast-fetching pattern (already works)
- Country flags: use `getCountryFlag` from `@/lib/country-flags` and `getCountryName` from `@/lib/countries`
- Follow existing design system: font weights 460/540/600, border radius 8px/16px, Lucide icons, fraud-red/fraud-yellow/success colors

The full component is large — the implementing agent should write it following the layout described in the spec's "Dashboard Layout" section, using the existing dashboard as a style reference for card components, spacing, and typography.

- [ ] **Step 2: Test dashboard in browser**

1. Open `http://localhost:5000/dashboard`
2. Verify the page loads without errors
3. Verify "Last refreshed" indicator works
4. If test data exists from earlier tasks, verify it appears in the correct sections
5. Verify auto-refresh (wait 60 seconds, check network tab for new `/api/dashboard/summary` call)
6. Verify empty states show gracefully when no data exists

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): replace mock data with real-time aggregated dashboard"
```

---

## Task 9: Supervisor Dashboard Settings UI

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Add Dashboard section to settings navigation**

In `src/app/(app)/settings/page.tsx`:

1. Add `"dashboard"` to the `SectionKey` type union (around line 101):
```typescript
type SectionKey =
  | "opensearch"
  | "vendor-integrations"
  | "ucl-integration"
  | "plan-catalog"
  | "system-mapping"
  | "sapphire-mapping"
  | "fraud-watch"
  | "dashboard"
  | "coming-soon";
```

2. Add `BarChart3` to the lucide-react import.

3. Add a "Dashboard" item to the "Automation" group in `NAV_GROUPS` (around line 152):
```typescript
  {
    label: "Automation",
    icon: SlidersHorizontal,
    items: [
      { key: "fraud-watch", label: "Fraud Watch", description: "Scan interval & behavior", icon: AlertTriangle },
      { key: "dashboard", label: "Dashboard", description: "Alert thresholds & refresh", icon: BarChart3 },
    ],
  },
```

- [ ] **Step 2: Add Dashboard settings section render**

In the settings page's section render logic (find the pattern where each section key renders its UI), add a case for `"dashboard"`:

```typescript
{active === "dashboard" && (
  <DashboardSettingsSection />
)}
```

Create a `DashboardSettingsSection` component inside the same file (or extract to a separate file if the settings page is already large):

```typescript
function DashboardSettingsSection() {
  const [config, setConfig] = useState<{ connectivityThreshold: number; connectivityWindowHours: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState("10");
  const [windowHours, setWindowHours] = useState("48");

  useEffect(() => {
    fetch("/api/dashboard/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.config) {
          setConfig(data.config);
          setThreshold(String(data.config.connectivityThreshold));
          setWindowHours(String(data.config.connectivityWindowHours));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const email = localStorage.getItem("travelwifi_ops_user_email") || "";
    try {
      const res = await fetch("/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectivityThreshold: parseInt(threshold, 10),
          connectivityWindowHours: parseInt(windowHours, 10),
          updatedBy: email,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfig(data.config);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 className="h-4 w-4 animate-spin text-amethyst" />
        <span className="text-[13px] font-[460] text-muted-foreground">Loading dashboard config...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-[600] text-foreground">Dashboard Settings</h3>
        <p className="text-[13px] font-[460] text-muted-foreground mt-1">
          Configure alert thresholds for the operations dashboard.
        </p>
      </div>

      <Card className="rounded-[16px]">
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label className="text-[12px] font-[600]">Connectivity Alert Threshold</Label>
            <p className="text-[11px] font-[460] text-muted-foreground mb-2">
              Number of connectivity reports for a country to trigger a dashboard alert.
            </p>
            <Input
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="rounded-[8px] text-[13px] font-[460] w-32"
            />
          </div>

          <div>
            <Label className="text-[12px] font-[600]">Alert Time Window (hours)</Label>
            <p className="text-[11px] font-[460] text-muted-foreground mb-2">
              How far back to look when counting connectivity reports.
            </p>
            <Input
              type="number"
              min="1"
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="rounded-[8px] text-[13px] font-[460] w-32"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
              Save
            </Button>
            {saved && (
              <span className="text-[12px] font-[600] text-success">Saved</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Test settings in browser**

1. Navigate to Settings > Dashboard (under Automation)
2. Verify default values load (threshold: 10, window: 48)
3. Change threshold to 5, save
4. Refresh the page, verify the value persists
5. Verify: `curl http://localhost:5000/api/dashboard/config | jq .`

Expected: Config saved and persisted correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/settings/page.tsx
git commit -m "feat(settings): add dashboard threshold configuration for supervisors"
```

---

## Task 10: Final Integration Verification

- [ ] **Step 1: End-to-end flow test**

1. Start the dev server: `./scripts/start.sh`
2. Open `http://localhost:5000` in the browser
3. Navigate to a customer with an eSIM order
4. Test each action:
   - Report Fraud (existing, now also writes to fraud_reports)
   - Cancel Order (new)
   - Refund with connectivity reason (new — should also create connectivity report)
   - Report Connectivity (new — should show TelliSIM data)
5. Navigate to Dashboard
6. Verify all reported data appears in the correct sections
7. Navigate to Settings > Dashboard, adjust threshold, verify dashboard updates

- [ ] **Step 2: Verify dashboard summary endpoint returns all data**

```bash
curl http://localhost:5000/api/dashboard/summary | jq .
```

Expected: Response includes `connectivityAlerts`, `trends` (with non-zero counts), `fraudReports` (with recent fraud report), `recentActions` (showing all action types), `topCountries`.

- [ ] **Step 3: Final commit**

If any fixes were needed during integration testing, commit them:

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end dashboard testing"
```
