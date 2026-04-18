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
