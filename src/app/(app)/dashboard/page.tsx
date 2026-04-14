"use client";

import {
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  MessageSquare,
  Pin,
  Activity,
  Clock,
  ExternalLink,
  Users,
  Headphones,
  BarChart3,
  RefreshCw,
  CreditCard,
  Globe,
  ChevronRight,
  Search,
  Settings,
  FileText,
  Phone,
  Mail,
  Hash,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ─── Mock Data ──────────────────────────────────────────────

const fraudAlerts = [
  {
    id: "FR-2841",
    severity: "critical" as const,
    title: "Duplicate CC across 4 accounts",
    email: "j.martinez***@gmail.com",
    phone: "+1 (***) ***-8821",
    lastFourCC: "4429",
    occurrences: 4,
    detectedAt: "12 min ago",
    country: "US",
  },
  {
    id: "FR-2839",
    severity: "critical" as const,
    title: "Velocity spike: 9 orders in 2 hours",
    email: "techbuy***@yahoo.com",
    phone: "+44 (***) ***-3310",
    lastFourCC: "7712",
    occurrences: 9,
    detectedAt: "34 min ago",
    country: "GB",
  },
  {
    id: "FR-2836",
    severity: "warning" as const,
    title: "Mismatched billing country & IP geolocation",
    email: "nomad.t***@proton.me",
    phone: "+49 (***) ***-5501",
    lastFourCC: "1183",
    occurrences: 2,
    detectedAt: "1h ago",
    country: "DE",
  },
];

const shiftInsights = [
  {
    id: 1,
    type: "cancellations" as const,
    title: "Cancellation spike",
    subtitle: "Japan - Pocket WiFi",
    value: "+38%",
    trend: "up" as const,
    detail: "47 cancellations in last 12h vs 34 avg",
    severity: "high" as const,
  },
  {
    id: 2,
    type: "refunds" as const,
    title: "Refund volume elevated",
    subtitle: "EU - eSIM Plans",
    value: "+22%",
    trend: "up" as const,
    detail: "31 refund requests, mostly connectivity issues",
    severity: "medium" as const,
  },
  {
    id: 3,
    type: "complaints" as const,
    title: "Complaint drop",
    subtitle: "US - Home WiFi",
    value: "-15%",
    trend: "down" as const,
    detail: "Firmware update resolved most issues",
    severity: "low" as const,
  },
  {
    id: 4,
    type: "cancellations" as const,
    title: "Late delivery complaints",
    subtitle: "South Korea - Rental",
    value: "+12%",
    trend: "up" as const,
    detail: "Logistics delay at Incheon hub",
    severity: "medium" as const,
  },
];

const managerMessages = [
  {
    id: 1,
    author: "Sarah Chen",
    role: "Ops Lead",
    message:
      "Priority: All Japan Pocket WiFi cancellations must be escalated to Tier 2 until logistics backlog clears. Do NOT issue refunds without approval.",
    timestamp: "Today, 08:15 AM",
    pinned: true,
  },
  {
    id: 2,
    author: "Marcus Rivera",
    role: "Shift Supervisor",
    message:
      "New SLA targets effective immediately: first response under 4 min, resolution under 20 min for Premium tier customers.",
    timestamp: "Today, 07:30 AM",
    pinned: true,
  },
  {
    id: 3,
    author: "Sarah Chen",
    role: "Ops Lead",
    message:
      "eSIM activation flow updated - new troubleshooting guide in KB article #4821. Please review before your next eSIM ticket.",
    timestamp: "Yesterday, 04:45 PM",
    pinned: false,
  },
];

const recentActivity = [
  {
    id: 1,
    agent: "Alex Kim",
    action: "Resolved",
    target: "Ticket #29841",
    detail: "eSIM activation failure",
    time: "2 min ago",
  },
  {
    id: 2,
    agent: "Priya Patel",
    action: "Escalated",
    target: "Ticket #29838",
    detail: "Fraud review - duplicate CC",
    time: "5 min ago",
  },
  {
    id: 3,
    agent: "Tom Nguyen",
    action: "Refunded",
    target: "Order #TW-88214",
    detail: "$42.00 - connectivity issue",
    time: "8 min ago",
  },
  {
    id: 4,
    agent: "Lisa Johansson",
    action: "Assigned",
    target: "Ticket #29835",
    detail: "VIP customer complaint",
    time: "12 min ago",
  },
  {
    id: 5,
    agent: "Alex Kim",
    action: "Resolved",
    target: "Ticket #29832",
    detail: "Billing dispute",
    time: "18 min ago",
  },
  {
    id: 6,
    agent: "Marcus Rivera",
    action: "Broadcast",
    target: "All agents",
    detail: "SLA update posted",
    time: "22 min ago",
  },
  {
    id: 7,
    agent: "Priya Patel",
    action: "Resolved",
    target: "Ticket #29829",
    detail: "Device return processed",
    time: "31 min ago",
  },
  {
    id: 8,
    agent: "Tom Nguyen",
    action: "Resolved",
    target: "Ticket #29826",
    detail: "Password reset",
    time: "35 min ago",
  },
];

const quickLinks = [
  { label: "Search Orders", icon: Search, href: "/orders" },
  { label: "Customer Lookup", icon: Users, href: "/customers" },
  { label: "Knowledge Base", icon: FileText, href: "/kb" },
  { label: "Queue Dashboard", icon: BarChart3, href: "/queue" },
  { label: "Phone System", icon: Phone, href: "/phone" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

// ─── Helpers ────────────────────────────────────────────────

function actionColor(action: string) {
  switch (action) {
    case "Resolved":
      return "text-success";
    case "Escalated":
      return "text-fraud-red";
    case "Refunded":
      return "text-fraud-yellow";
    case "Assigned":
      return "text-amethyst";
    case "Broadcast":
      return "text-lavender";
    default:
      return "text-muted-foreground";
  }
}

// ─── Page ───────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50">
        <div className="mx-auto max-w-[1440px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-xl text-charcoal"
                style={{ fontWeight: 540 }}
              >
                Operations Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                TravelWifi Ops Command Center
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                <span>Live</span>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}{" "}
                &middot; Shift B
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 py-6">
        {/* ── Fraud Watch ── */}
        <section className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-fraud-red" />
            <h2
              className="text-sm uppercase tracking-wider text-fraud-red"
              style={{ fontWeight: 600 }}
            >
              Fraud Watch
            </h2>
            <Badge
              variant="destructive"
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {fraudAlerts.filter((a) => a.severity === "critical").length}{" "}
              Critical
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fraudAlerts.map((alert) => (
              <Card
                key={alert.id}
                className={cn(
                  "relative border-l-[3px] transition-shadow hover:shadow-md",
                  alert.severity === "critical"
                    ? "border-l-fraud-red bg-fraud-red-soft/60"
                    : "border-l-fraud-yellow bg-fraud-yellow-soft/60"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={cn(
                          "h-4 w-4",
                          alert.severity === "critical"
                            ? "text-fraud-red"
                            : "text-fraud-yellow"
                        )}
                      />
                      <CardTitle
                        className="text-sm"
                        style={{ fontWeight: 540 }}
                      >
                        {alert.id}
                      </CardTitle>
                    </div>
                    <Badge
                      variant={
                        alert.severity === "critical"
                          ? "destructive"
                          : "secondary"
                      }
                      className={cn(
                        "text-[10px] uppercase",
                        alert.severity === "warning" &&
                          "bg-fraud-yellow/15 text-fraud-yellow border-fraud-yellow/30"
                      )}
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  <CardDescription
                    className="mt-1 text-charcoal/80"
                    style={{ fontWeight: 460 }}
                  >
                    {alert.title}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" />
                      <span className="font-mono">{alert.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3" />
                      <span className="font-mono">{alert.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3 w-3" />
                      <span className="font-mono">
                        **** {alert.lastFourCC}
                      </span>
                    </div>
                  </div>
                  <Separator className="my-2.5" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="h-3 w-3" />
                      <span>{alert.country}</span>
                      <span className="mx-1 text-border">|</span>
                      <Hash className="h-3 w-3" />
                      <span>
                        {alert.occurrences}{" "}
                        {alert.occurrences === 1 ? "match" : "matches"}
                      </span>
                    </div>
                    <span className="text-muted-foreground/70">
                      {alert.detectedAt}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Main Grid: Left Content + Right Sidebar ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Left Column ── */}
          <div className="space-y-6">
            {/* Shift Awareness */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-amethyst" />
                <h2
                  className="text-sm uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Shift Awareness
                </h2>
                <span className="ml-auto text-[11px] text-muted-foreground">
                  Last 12-24 hours
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {shiftInsights.map((insight) => (
                  <Card
                    key={insight.id}
                    className="transition-shadow hover:shadow-md"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle
                            className="text-sm"
                            style={{ fontWeight: 540 }}
                          >
                            {insight.title}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {insight.subtitle}
                          </CardDescription>
                        </div>
                        <div
                          className={cn(
                            "flex items-center gap-1 rounded-[8px] px-2 py-1 text-xs",
                            insight.trend === "up" &&
                              insight.severity === "high" &&
                              "bg-fraud-red-soft text-fraud-red",
                            insight.trend === "up" &&
                              insight.severity === "medium" &&
                              "bg-fraud-yellow-soft text-fraud-yellow",
                            insight.trend === "down" &&
                              "bg-success-soft text-success"
                          )}
                          style={{ fontWeight: 600 }}
                        >
                          {insight.trend === "up" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {insight.value}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p
                        className="text-xs text-muted-foreground"
                        style={{ fontWeight: 460 }}
                      >
                        {insight.detail}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Manager Broadcast Wall */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-amethyst" />
                <h2
                  className="text-sm uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Manager Broadcast
                </h2>
              </div>

              <div className="space-y-3">
                {managerMessages.map((msg) => (
                  <Card
                    key={msg.id}
                    className={cn(
                      "transition-shadow hover:shadow-md",
                      msg.pinned && "ring-1 ring-lavender/40"
                    )}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        {msg.pinned && (
                          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lavender" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex items-center gap-2">
                            <span
                              className="text-sm text-charcoal"
                              style={{ fontWeight: 540 }}
                            >
                              {msg.author}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {msg.role}
                            </span>
                            {msg.pinned && (
                              <Badge
                                variant="secondary"
                                className="ml-auto bg-lavender/15 text-amethyst text-[10px] px-1.5 py-0"
                              >
                                Pinned
                              </Badge>
                            )}
                          </div>
                          <p
                            className="text-sm text-charcoal/85 leading-relaxed"
                            style={{ fontWeight: 460 }}
                          >
                            {msg.message}
                          </p>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            <Clock className="mr-1 inline h-3 w-3" />
                            {msg.timestamp}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-6">
            {/* Quick Links */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-amethyst" />
                <h2
                  className="text-sm uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Quick Links
                </h2>
              </div>

              <Card>
                <CardContent className="p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {quickLinks.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        className="group flex items-center gap-2.5 rounded-[8px] px-3 py-2.5 text-sm text-charcoal transition-colors hover:bg-cream/60"
                        style={{ fontWeight: 460 }}
                      >
                        <link.icon className="h-4 w-4 text-muted-foreground group-hover:text-amethyst transition-colors" />
                        <span>{link.label}</span>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Recent Activity Feed */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-amethyst" />
                <h2
                  className="text-sm uppercase tracking-wider text-charcoal"
                  style={{ fontWeight: 600 }}
                >
                  Team Activity
                </h2>
              </div>

              <Card className="overflow-hidden">
                <ScrollArea className="h-[460px]">
                  <div className="divide-y divide-border/50">
                    {recentActivity.map((item) => (
                      <div
                        key={item.id}
                        className="group px-4 py-3 transition-colors hover:bg-cream/30"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="text-sm text-charcoal"
                                style={{ fontWeight: 540 }}
                              >
                                {item.agent}
                              </span>
                              <span
                                className={cn(
                                  "text-xs",
                                  actionColor(item.action)
                                )}
                                style={{ fontWeight: 600 }}
                              >
                                {item.action}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground truncate">
                              {item.target}{" "}
                              <span className="text-border">-</span>{" "}
                              {item.detail}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground/70">
                            {item.time}
                          </span>
                        </div>
                      </div>
                    ))}
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
