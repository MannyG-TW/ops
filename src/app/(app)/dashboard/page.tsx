"use client";

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Globe,
  Activity,
  ShieldAlert,
  Megaphone,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getCountryFlag } from "@/lib/country-flags";
import { getCountryName } from "@/lib/countries";

// ─── Types ──────────────────────────────────────────────────

interface ConnectivityAlert {
  country: string;
  count: number;
  latestAt: string;
  threshold: number;
  windowHours: number;
}

interface TopCountry {
  country: string;
  count: number;
  latestAt: string;
  aboveThreshold: boolean;
}

interface Trends {
  connectivity: { current: number; prior: number; change: number };
  refunds: { current: number; prior: number; change: number; totalAmount: number };
  cancellations: { current: number; prior: number; change: number };
  escalations: { open: number; new24h: number };
}

interface FraudReport {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  notes: string;
  reportedBy: string;
  createdAt: string;
}

interface RecentAction {
  id: string;
  type: string;
  agent: string;
  orderNumber: string;
  createdAt: string;
}

interface DashboardSummary {
  ok: boolean;
  connectivityAlerts: ConnectivityAlert[];
  topCountries: TopCountry[];
  trends: Trends;
  fraudReports: FraudReport[];
  recentActions: RecentAction[];
  config: { connectivityThreshold: number; connectivityWindowHours: number };
}

interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  authorName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────────

function actionTypeBadgeClass(type: string): string {
  switch (type.toLowerCase()) {
    case "fraud":
      return "bg-fraud-red-soft text-fraud-red border-fraud-red/20";
    case "cancel":
    case "cancellation":
      return "bg-fraud-red-soft text-fraud-red border-fraud-red/20";
    case "refund":
      return "bg-fraud-yellow-soft text-fraud-yellow border-fraud-yellow/20";
    case "connectivity":
      return "bg-amethyst/10 text-amethyst border-amethyst/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function formatActionType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function TrendBadge({ change, prefix }: { change: number; prefix?: string }) {
  if (change === 0) {
    return (
      <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
        No change
      </span>
    );
  }
  const isUp = change > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[8px] px-1.5 py-0.5 text-[11px]",
        isUp
          ? "bg-fraud-red-soft text-fraud-red"
          : "bg-success-soft text-success"
      )}
      style={{ fontWeight: 600 }}
    >
      {isUp ? <TrendingUp className="h-3 w-3" strokeWidth={2} /> : <TrendingDown className="h-3 w-3" strokeWidth={2} />}
      {prefix}{Math.abs(change)}%
    </span>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([]);
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);
  const lastFetchedAt = useRef<Date>(new Date());

  // Fetch dashboard summary every 60 seconds
  useEffect(() => {
    function fetchSummary() {
      fetch("/api/dashboard/summary")
        .then((r) => r.json())
        .then((data: DashboardSummary) => {
          if (data.ok) {
            setSummary(data);
            lastFetchedAt.current = new Date();
            setSecondsSinceRefresh(0);
          }
        })
        .catch(() => {});
    }

    fetchSummary();
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  // Tick "seconds since refresh" every second
  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - lastFetchedAt.current.getTime()) / 1000
      );
      setSecondsSinceRefresh(elapsed);
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  // Fetch broadcasts every 30 seconds (separate from summary)
  useEffect(() => {
    function fetchBroadcasts() {
      fetch("/api/broadcasts?active=true")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setBroadcasts(data.broadcasts);
        })
        .catch(() => {});
    }
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 30000);
    return () => clearInterval(interval);
  }, []);

  const trends = summary?.trends;
  const alerts = summary?.connectivityAlerts ?? [];
  const topCountries = summary?.topCountries ?? [];
  const fraudReports = summary?.fraudReports ?? [];
  const recentActions = summary?.recentActions ?? [];
  const maxCountryCount = topCountries.length > 0 ? topCountries[0].count : 1;

  function refreshLabel() {
    if (secondsSinceRefresh < 5) return "just now";
    if (secondsSinceRefresh < 60) return `${secondsSinceRefresh}s ago`;
    const mins = Math.floor(secondsSinceRefresh / 60);
    return `${mins}m ago`;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50">
        <div className="mx-auto max-w-[1440px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl text-charcoal" style={{ fontWeight: 540 }}>
                Operations Dashboard
              </h1>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                TravelWifi Ops Command Center
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span>Live</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-[12px] text-muted-foreground">
                Last refreshed: {refreshLabel()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 py-6 space-y-6">

        {/* ── Section 1: Connectivity Alerts ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-fraud-red" strokeWidth={2} />
            <h2
              className="text-[12px] uppercase tracking-wider text-fraud-red"
              style={{ fontWeight: 600 }}
            >
              Connectivity Alerts
            </h2>
            <Badge
              className="ml-1 px-1.5 py-0 text-[10px] bg-fraud-red-soft text-fraud-red border-fraud-red/20"
              variant="outline"
            >
              {alerts.length} {alerts.length === 1 ? "country" : "countries"}
            </Badge>
          </div>

          {alerts.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-3 px-4">
                <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2} />
                <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 460 }}>
                  No active connectivity alerts
                </span>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {alerts.map((alert) => (
                <Card
                  key={alert.country}
                  className="border-l-[3px] border-l-fraud-red bg-fraud-red-soft/60 transition-shadow hover:shadow-md"
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px] leading-none">
                          {getCountryFlag(alert.country)}
                        </span>
                        <span className="text-[13px] text-charcoal" style={{ fontWeight: 540 }}>
                          {getCountryName(alert.country)}
                        </span>
                      </div>
                      <span
                        className="text-[24px] leading-none text-fraud-red tabular-nums"
                        style={{ fontWeight: 700 }}
                      >
                        {alert.count}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-fraud-red/70" style={{ fontWeight: 460 }}>
                      reports in last {alert.windowHours}h
                    </p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                      Latest{" "}
                      {formatDistanceToNow(new Date(alert.latestAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ── Section 2: Trend Cards ── */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-amethyst" strokeWidth={2} />
            <h2
              className="text-[12px] uppercase tracking-wider text-charcoal"
              style={{ fontWeight: 600 }}
            >
              Shift Awareness
            </h2>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Last 24 hours
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Connectivity */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                  <Globe className="h-3.5 w-3.5" strokeWidth={2} />
                  Connectivity Reports
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className="text-[28px] leading-none text-charcoal tabular-nums"
                  style={{ fontWeight: 700 }}
                >
                  {trends?.connectivity.current ?? "—"}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {trends && <TrendBadge change={trends.connectivity.change} />}
                  <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                    vs prior 24h
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Refunds */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                  <DollarSign className="h-3.5 w-3.5" strokeWidth={2} />
                  Refunds
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className="text-[28px] leading-none text-charcoal tabular-nums"
                  style={{ fontWeight: 700 }}
                >
                  {trends?.refunds.current ?? "—"}
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground" style={{ fontWeight: 460 }}>
                  {trends
                    ? `$${(trends.refunds.totalAmount / 100).toFixed(2)} total`
                    : ""}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {trends && <TrendBadge change={trends.refunds.change} />}
                  <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                    vs prior 24h
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Cancellations */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />
                  Cancellations
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className="text-[28px] leading-none text-charcoal tabular-nums"
                  style={{ fontWeight: 700 }}
                >
                  {trends?.cancellations.current ?? "—"}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {trends && <TrendBadge change={trends.cancellations.change} />}
                  <span className="text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                    vs prior 24h
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Escalations */}
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground" style={{ fontWeight: 600 }}>
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
                  Escalations
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div
                  className="text-[28px] leading-none text-charcoal tabular-nums"
                  style={{ fontWeight: 700 }}
                >
                  {trends?.escalations.open ?? "—"}
                </div>
                <div className="mt-1.5 text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                  {trends
                    ? `${trends.escalations.new24h} new in last 24h`
                    : ""}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 3: Two-Column Layout ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Left Column ── */}
          <div className="space-y-6">

            {/* Fraud Alerts */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-fraud-red" strokeWidth={2} />
                <h2
                  className="text-[12px] uppercase tracking-wider text-fraud-red"
                  style={{ fontWeight: 600 }}
                >
                  Fraud Watch
                </h2>
                <Badge
                  className="ml-1 px-1.5 py-0 text-[10px] bg-fraud-red-soft text-fraud-red border-fraud-red/20"
                  variant="outline"
                >
                  {fraudReports.length}
                </Badge>
              </div>

              {fraudReports.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center gap-2 py-3 px-4">
                    <CheckCircle2 className="h-4 w-4 text-success" strokeWidth={2} />
                    <span className="text-[13px] text-muted-foreground" style={{ fontWeight: 460 }}>
                      No recent fraud reports
                    </span>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {fraudReports.map((report) => (
                    <Card
                      key={report.id}
                      className="border-l-[3px] border-l-fraud-red bg-fraud-red-soft/60 transition-shadow hover:shadow-md"
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className="text-[13px] text-charcoal"
                                style={{ fontWeight: 540 }}
                              >
                                {report.orderNumber}
                              </span>
                              <span className="text-[12px] text-charcoal/70" style={{ fontWeight: 460 }}>
                                {report.customerName}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-muted-foreground" style={{ fontWeight: 460 }}>
                              {report.customerEmail}
                            </p>
                            {report.notes && (
                              <p
                                className="mt-1.5 text-[12px] text-charcoal/80 line-clamp-2 leading-relaxed"
                                style={{ fontWeight: 460 }}
                              >
                                {report.notes}
                              </p>
                            )}
                            <p className="mt-2 text-[11px] text-muted-foreground" style={{ fontWeight: 460 }}>
                              Reported by {report.reportedBy} &middot;{" "}
                              {formatDistanceToNow(new Date(report.createdAt), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Manager Broadcasts */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-amethyst" strokeWidth={2} />
                <h2
                  className="text-[12px] uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Manager Broadcast
                </h2>
                {broadcasts.length > 0 && (
                  <Badge
                    className="ml-1 px-1.5 py-0 text-[10px] bg-amethyst/10 text-amethyst border-amethyst/20"
                    variant="outline"
                  >
                    {broadcasts.length} active
                  </Badge>
                )}
              </div>

              {broadcasts.length === 0 ? (
                <Card>
                  <CardContent className="py-4 px-4">
                    <p className="text-[13px] text-muted-foreground text-center" style={{ fontWeight: 460 }}>
                      No active broadcasts
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {broadcasts.map((msg) => (
                    <Card
                      key={msg.id}
                      className="transition-shadow hover:shadow-md ring-1 ring-amber-200/40 dark:ring-amber-800/30"
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" strokeWidth={2} />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-center gap-2">
                              <span
                                className="text-[13px] text-charcoal"
                                style={{ fontWeight: 540 }}
                              >
                                {msg.title}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {msg.authorName}
                              </span>
                            </div>
                            <p
                              className="text-[13px] text-charcoal/85 leading-relaxed"
                              style={{ fontWeight: 460 }}
                            >
                              {msg.message}
                            </p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              <Clock className="mr-1 inline h-3 w-3" strokeWidth={2} />
                              {new Date(msg.startsAt).toLocaleString()} —{" "}
                              {new Date(msg.endsAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* ── Right Column (340px) ── */}
          <div className="space-y-6">

            {/* Top Reported Countries */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4 text-amethyst" strokeWidth={2} />
                <h2
                  className="text-[12px] uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Top Countries
                </h2>
              </div>

              <Card>
                <ScrollArea className="h-[280px]">
                  <div className="divide-y divide-border/50">
                    {topCountries.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-muted-foreground" style={{ fontWeight: 460 }}>
                        No data yet
                      </div>
                    ) : (
                      topCountries.map((c) => (
                        <div key={c.country} className="px-4 py-2.5">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[14px] leading-none">
                                {getCountryFlag(c.country)}
                              </span>
                              <span
                                className={cn(
                                  "text-[12px] truncate",
                                  c.aboveThreshold
                                    ? "text-fraud-red"
                                    : "text-charcoal"
                                )}
                                style={{ fontWeight: 460 }}
                              >
                                {getCountryName(c.country)}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 text-[12px] tabular-nums",
                                c.aboveThreshold
                                  ? "text-fraud-red"
                                  : "text-charcoal"
                              )}
                              style={{ fontWeight: 600 }}
                            >
                              {c.count}
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.aboveThreshold ? "bg-fraud-red" : "bg-amethyst"
                              )}
                              style={{
                                width: `${Math.max(4, (c.count / maxCountryCount) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </section>

            {/* Recent Activity Feed */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amethyst" strokeWidth={2} />
                <h2
                  className="text-[12px] uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Recent Activity
                </h2>
              </div>

              <Card>
                <ScrollArea className="h-[360px]">
                  <div className="divide-y divide-border/50">
                    {recentActions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[13px] text-muted-foreground" style={{ fontWeight: 460 }}>
                        No recent activity
                      </div>
                    ) : (
                      recentActions.map((item) => (
                        <div key={item.id} className="px-4 py-3 hover:bg-cream/30 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className="text-[12px] text-charcoal"
                                  style={{ fontWeight: 540 }}
                                >
                                  {item.agent}
                                </span>
                                <span
                                  className={cn(
                                    "inline-block rounded-[8px] border px-1.5 py-0.5 text-[10px]",
                                    actionTypeBadgeClass(item.type)
                                  )}
                                  style={{ fontWeight: 600 }}
                                >
                                  {formatActionType(item.type)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground truncate" style={{ fontWeight: 460 }}>
                                {item.orderNumber}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground/70">
                              {formatDistanceToNow(new Date(item.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
