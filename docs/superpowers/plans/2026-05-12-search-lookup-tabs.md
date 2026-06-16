# Search Lookup Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IMEI Lookup and ICCID Lookup tabs to the existing Search page so operators can investigate devices from a single input.

**Architecture:** The existing `SearchPageContent` component gets wrapped with a tab switcher. Each lookup tab is a self-contained component that fires parallel API requests and renders results as a card grid. A shared `LookupCard` component handles loading/error/empty states. No new API routes needed — all endpoints exist.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui (Card, Badge, Input, Button, Skeleton)

**Spec:** `docs/superpowers/specs/2026-05-12-search-lookup-tabs-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/lookup/lookup-card.tsx` | Create | Reusable card wrapper with skeleton/error/empty states |
| `src/components/lookup/imei-lookup.tsx` | Create | IMEI tab: input + 5 parallel fetches + card grid |
| `src/components/lookup/iccid-lookup.tsx` | Create | ICCID tab: input + 5 parallel fetches + card grid |
| `src/app/(app)/search/page.tsx` | Modify | Add tab navigation wrapping existing search + two new tabs |

---

### Task 1: Create LookupCard Component

**Files:**
- Create: `src/components/lookup/lookup-card.tsx`

This is the shared card wrapper used by both lookup tabs. It handles three states: loading (skeleton), error (red text), and loaded (children).

- [ ] **Step 1: Create the LookupCard component**

```tsx
// src/components/lookup/lookup-card.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LookupCardProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  error: string | null;
  /** If true and not loading/error, show "No data found" */
  empty?: boolean;
  /** Optional status pill next to the title */
  badge?: { label: string; className: string } | null;
  /** Full-width card (spans both columns) */
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function LookupCard({
  title,
  icon,
  loading,
  error,
  empty,
  badge,
  fullWidth,
  children,
}: LookupCardProps) {
  return (
    <Card className={`rounded-[8px] ${fullWidth ? "col-span-full" : ""}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-lavender/10">
            {icon}
          </div>
          <h3 className="text-[13px] font-[600] text-charcoal">{title}</h3>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-[540] ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-[12px] font-[460] text-fraud-red">{error}</p>
        )}

        {/* Empty */}
        {!loading && !error && empty && (
          <p className="text-[12px] font-[460] text-muted-foreground">No data found</p>
        )}

        {/* Content */}
        {!loading && !error && !empty && children}
      </CardContent>
    </Card>
  );
}

/** Key-value row used inside LookupCard for structured data display */
export function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === "" || value === null || value === undefined) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-[12px] font-[460] text-muted-foreground">{label}</span>
      <span className="text-right text-[12px] font-[540] text-charcoal">{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to lookup-card.

- [ ] **Step 3: Commit**

```bash
git add src/components/lookup/lookup-card.tsx
git commit -m "feat(lookup): add LookupCard and KVRow shared components"
```

---

### Task 2: Create IMEI Lookup Component

**Files:**
- Create: `src/components/lookup/imei-lookup.tsx`

Fires 5 requests in parallel on submit: terminal-status, device-info, orders search, user-offers, and CDR. Each result populates a LookupCard.

- [ ] **Step 1: Create the IMEI lookup component**

```tsx
// src/components/lookup/imei-lookup.tsx
"use client";

import { useState } from "react";
import {
  Search,
  Wifi,
  Smartphone,
  Package,
  ShoppingBag,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LookupCard, KVRow } from "./lookup-card";
import { fetchOS } from "@/lib/settings-client";
import { getSapphireDeviceName } from "@/lib/sapphire-mapping";

interface TerminalData {
  isOnline: boolean;
  mcc: string;
  mnc: string;
  lac: string;
  cellId: string;
  network: string;
  signalStrength: string;
  ip: string;
  iccid: string;
  imsi: string;
  operatorName: string;
}

interface AllTerminalData extends TerminalData {
  country?: string;
  iso2?: string;
  powerLeft?: string;
  devicetype?: string;
  softversion?: string;
  totalFlow?: number;
  userUpFlow?: number;
  userDownFlow?: number;
  u_orgName?: string;
  t_orgName?: string;
  userCode?: string;
  logindatetime?: number;
  lastSeen?: number;
  connectUserMax?: string;
}

interface DeviceInfoData {
  ok: boolean;
  error?: string;
  binding?: {
    terminalType?: string;
    imei?: string;
    status?: string;
    userCode?: string;
    [key: string]: unknown;
  };
}

interface OrderResult {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  product_sku: string | string[];
  total_usd: number;
  created_at: string;
}

interface OfferItem {
  goodsName?: string;
  goodsTypeName?: string;
  effectiveTime?: string;
  expirationTime?: string;
  flowBalance?: number;
  flow?: number;
  [key: string]: unknown;
}

// Parse signal from network field format: mcc|mnc|rat|rssi
function parseSignal(network: string): string {
  const parts = network.split("|");
  if (parts.length >= 4) {
    const rssi = parts[3];
    return rssi ? `${rssi} dBm` : "";
  }
  return "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "";
  // UCL timestamps are in milliseconds
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export function ImeiLookup() {
  const [imei, setImei] = useState("");
  const [searched, setSearched] = useState(false);

  // Terminal status
  const [termLoading, setTermLoading] = useState(false);
  const [termError, setTermError] = useState<string | null>(null);
  const [termData, setTermData] = useState<TerminalData | null>(null);
  const [termAllData, setTermAllData] = useState<AllTerminalData | null>(null);

  // Device info
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [devData, setDevData] = useState<DeviceInfoData | null>(null);

  // Orders
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordError, setOrdError] = useState<string | null>(null);
  const [ordData, setOrdData] = useState<OrderResult[]>([]);

  // User offers
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);
  const [offData, setOffData] = useState<OfferItem[]>([]);

  // CDR / sessions
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrError, setCdrError] = useState<string | null>(null);
  const [cdrData, setCdrData] = useState<Record<string, unknown>[]>([]);

  const isValid = /^\d{15}$/.test(imei.trim());

  const doLookup = () => {
    const trimmed = imei.trim();
    if (!isValid) return;
    setSearched(true);

    // 1. Terminal status
    setTermLoading(true);
    setTermError(null);
    setTermData(null);
    setTermAllData(null);
    fetch("/api/ucl/terminal-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setTermError(d.error);
        else {
          setTermData(d.terminal);
          setTermAllData(d.allData);
        }
      })
      .catch((e) => setTermError(e.message))
      .finally(() => setTermLoading(false));

    // 2. Device info
    setDevLoading(true);
    setDevError(null);
    setDevData(null);
    fetch("/api/ucl/device-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setDevError(d.error);
        else setDevData(d);
      })
      .catch((e) => setDevError(e.message))
      .finally(() => setDevLoading(false));

    // 3. Orders (search by IMEI via serials)
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d) => setOrdData(d.results ?? []))
      .catch((e) => setOrdError(e.message))
      .finally(() => setOrdLoading(false));

    // 4. User offers — needs userCode from device-info, so we chain
    // We'll trigger this after device-info succeeds (see useEffect alternative below)
    // For simplicity, we do a second device-info-like call inline
    setOffLoading(true);
    setOffError(null);
    setOffData([]);
    fetch("/api/ucl/device-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((devResult) => {
        const userCode = devResult?.binding?.userCode;
        if (!userCode) {
          setOffError("No user bound to this device");
          setOffLoading(false);
          return;
        }
        return fetch("/api/ucl/user-offers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userCode }),
        })
          .then((r) => r.json())
          .then((d) => {
            if (!d.ok) setOffError(d.error);
            else setOffData(d.offers ?? []);
          });
      })
      .catch((e) => setOffError(e.message))
      .finally(() => setOffLoading(false));

    // 5. CDR
    setCdrLoading(true);
    setCdrError(null);
    setCdrData([]);
    fetchOS("/api/opensearch/cdr", { imei: trimmed, size: 20 })
      .then((d) => {
        // CDR route returns different shapes per index; normalize
        const hits = d.uclCdr?.hits || d.consumption?.hits || [];
        setCdrData(hits);
      })
      .catch((e) => setCdrError(e.message))
      .finally(() => setCdrLoading(false));
  };

  const deviceInfo = devData?.binding;
  const resolved = deviceInfo
    ? getSapphireDeviceName({
        terminalType: deviceInfo.terminalType || termAllData?.devicetype,
        imei: imei.trim(),
      })
    : termAllData?.devicetype
      ? getSapphireDeviceName({ terminalType: termAllData.devicetype, imei: imei.trim() })
      : null;

  const signal = termData?.network ? parseSignal(termData.network) : "";

  const statusColors: Record<string, string> = {
    completed: "bg-success-soft text-success",
    shipped: "bg-lavender/20 text-amethyst",
    processing: "bg-fraud-yellow-soft text-fraud-yellow",
    cancelled: "bg-fraud-red-soft text-fraud-red",
    pending: "bg-fraud-yellow-soft text-fraud-yellow",
    refunded: "bg-fraud-red-soft text-fraud-red",
  };

  return (
    <div className="space-y-4">
      {/* Input bar */}
      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter IMEI (15 digits)..."
            value={imei}
            onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
            onKeyDown={(e) => e.key === "Enter" && isValid && doLookup()}
            className="h-12 pl-12 text-[15px] rounded-[16px] border-border"
          />
        </div>
        <Button
          onClick={doLookup}
          disabled={!isValid}
          className="h-12 px-6 rounded-[16px] bg-[#e9e5dd] text-charcoal font-[540] hover:bg-[#ddd8cf]"
        >
          Lookup
        </Button>
      </div>

      {/* Results grid */}
      {searched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Terminal Status */}
          <LookupCard
            title="Terminal Status"
            icon={<Wifi className="h-3.5 w-3.5 text-amethyst" />}
            loading={termLoading}
            error={termError}
            empty={!termData}
            badge={
              termData
                ? termData.isOnline
                  ? { label: "Online", className: "bg-success-soft text-success" }
                  : { label: "Offline", className: "bg-muted text-muted-foreground" }
                : null
            }
          >
            {termData && (
              <div>
                <KVRow label="Country" value={termAllData?.iso2 || termAllData?.country || ""} />
                <KVRow label="MCC / MNC" value={termData.mcc && termData.mnc ? `${termData.mcc} / ${termData.mnc}` : ""} />
                <KVRow label="Signal" value={signal} />
                <KVRow label="Battery" value={termAllData?.powerLeft || ""} />
                <KVRow label="IMSI" value={termData.imsi} />
                <KVRow label="Connected Users" value={termAllData?.connectUserMax || ""} />
                <KVRow label="Last Seen" value={termAllData?.lastSeen ? formatTimestamp(termAllData.lastSeen) : ""} />
              </div>
            )}
          </LookupCard>

          {/* Device Info */}
          <LookupCard
            title="Device Info"
            icon={<Smartphone className="h-3.5 w-3.5 text-amethyst" />}
            loading={devLoading}
            error={devError}
            empty={!deviceInfo && !termAllData}
          >
            <div>
              <KVRow label="Device" value={resolved?.name || ""} />
              <KVRow label="Org" value={termAllData?.u_orgName || ""} />
              <KVRow label="Terminal Type" value={deviceInfo?.terminalType || termAllData?.devicetype || ""} />
              <KVRow label="Software" value={termAllData?.softversion || ""} />
              <KVRow label="User" value={termAllData?.userCode || deviceInfo?.userCode || ""} />
              <KVRow label="Status" value={deviceInfo?.status || ""} />
            </div>
          </LookupCard>

          {/* Orders */}
          <LookupCard
            title="Orders"
            icon={<Package className="h-3.5 w-3.5 text-amethyst" />}
            loading={ordLoading}
            error={ordError}
            empty={ordData.length === 0}
            badge={ordData.length > 0 ? { label: String(ordData.length), className: "bg-lavender/20 text-amethyst" } : null}
          >
            <div className="space-y-2">
              {ordData.map((o) => {
                const statusKey = (o.status || "").toLowerCase();
                const ts = typeof o.created_at === "string" ? Number(o.created_at) : o.created_at;
                const date = !isNaN(ts as number)
                  ? new Date((ts as number) < 1e12 ? (ts as number) * 1000 : (ts as number)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "";
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-[8px] bg-parchment/30 px-2 py-1.5">
                    <div>
                      <span className="text-[12px] font-[600] text-charcoal">{o.order_number || o.id}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-[540] ${statusColors[statusKey] || "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                      <p className="text-[11px] font-[460] text-muted-foreground">
                        {Array.isArray(o.product_sku) ? o.product_sku.join(", ") : o.product_sku}
                        {o.total_usd != null && ` · $${Number(o.total_usd).toFixed(2)}`}
                      </p>
                    </div>
                    <span className="text-[11px] font-[460] text-muted-foreground">{date}</span>
                  </div>
                );
              })}
            </div>
          </LookupCard>

          {/* Active Plans */}
          <LookupCard
            title="Active Plans"
            icon={<ShoppingBag className="h-3.5 w-3.5 text-amethyst" />}
            loading={offLoading}
            error={offError}
            empty={offData.length === 0}
          >
            <div className="space-y-2">
              {offData.slice(0, 10).map((offer, i) => (
                <div key={i} className="rounded-[8px] bg-parchment/30 px-2 py-1.5">
                  <span className="text-[12px] font-[600] text-charcoal">
                    {offer.goodsName || offer.goodsTypeName || "Plan"}
                  </span>
                  {(offer.effectiveTime || offer.expirationTime) && (
                    <p className="text-[11px] font-[460] text-muted-foreground">
                      {offer.effectiveTime && `From: ${offer.effectiveTime}`}
                      {offer.expirationTime && ` · To: ${offer.expirationTime}`}
                    </p>
                  )}
                  {offer.flow != null && offer.flowBalance != null && (
                    <p className="text-[11px] font-[460] text-muted-foreground">
                      {formatBytes(offer.flowBalance)} / {formatBytes(offer.flow)} remaining
                    </p>
                  )}
                </div>
              ))}
            </div>
          </LookupCard>

          {/* Recent Sessions (full width) */}
          <LookupCard
            title="Recent Sessions"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrData.length === 0}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Upload</th>
                    <th className="pb-2 pr-4">Download</th>
                    <th className="pb-2 pr-4">Total</th>
                    <th className="pb-2">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {cdrData.slice(0, 20).map((row, i) => {
                    const src = (row._source || row) as Record<string, unknown>;
                    const date = (src.date || src.Date || src.timestamp || "") as string;
                    const up = src.sysUpFlow || src.upload || src.UPLOAD_BYTES || 0;
                    const down = src.sysDownFlow || src.download || src.DOWNLOAD_BYTES || 0;
                    const total = src.totalFlow || src.total || ((up as number) + (down as number));
                    const country = (src.country || src.iso2 || src.mcc || "") as string;
                    return (
                      <tr key={i} className="border-b border-parchment/50 text-charcoal font-[460]">
                        <td className="py-1.5 pr-4">{typeof date === "string" ? date.slice(0, 16) : String(date)}</td>
                        <td className="py-1.5 pr-4">{formatBytes(Number(up))}</td>
                        <td className="py-1.5 pr-4">{formatBytes(Number(down))}</td>
                        <td className="py-1.5 pr-4">{formatBytes(Number(total))}</td>
                        <td className="py-1.5">{country}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LookupCard>
        </div>
      )}

      {/* Empty state before search */}
      {!searched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-lavender/20">
            <Smartphone className="h-8 w-8 text-amethyst" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">IMEI Lookup</p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Enter a 15-digit IMEI to look up Sapphire device status, orders, and plans
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to imei-lookup.

- [ ] **Step 3: Commit**

```bash
git add src/components/lookup/imei-lookup.tsx
git commit -m "feat(lookup): add IMEI lookup component with parallel data fetching"
```

---

### Task 3: Create ICCID Lookup Component

**Files:**
- Create: `src/components/lookup/iccid-lookup.tsx`

Fires 5 requests in parallel: subscription, location, orders, coverage, CDR.

- [ ] **Step 1: Create the ICCID lookup component**

```tsx
// src/components/lookup/iccid-lookup.tsx
"use client";

import { useState } from "react";
import {
  Search,
  Signal,
  MapPin,
  Package,
  Globe,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LookupCard, KVRow } from "./lookup-card";
import { fetchOS, fetchTelliSIM } from "@/lib/settings-client";

interface SubscriptionData {
  ok: boolean;
  error?: string;
  subscription?: {
    status?: string;
    planName?: string;
    dataRemaining?: number;
    dataTotal?: number;
    expiryDate?: string;
    activationDate?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface LocationData {
  ok: boolean;
  error?: string;
  location?: {
    country?: string;
    network?: string;
    timestamp?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface CoverageData {
  ok: boolean;
  error?: string;
  coverage?: {
    countries?: string[];
    networks?: { country: string; operator: string }[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OrderResult {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  product_sku: string | string[];
  total_usd: number;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function IccidLookup() {
  const [iccid, setIccid] = useState("");
  const [searched, setSearched] = useState(false);

  // Subscription
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subData, setSubData] = useState<SubscriptionData | null>(null);

  // Location
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locData, setLocData] = useState<LocationData | null>(null);

  // Orders
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordError, setOrdError] = useState<string | null>(null);
  const [ordData, setOrdData] = useState<OrderResult[]>([]);

  // Coverage
  const [covLoading, setCovLoading] = useState(false);
  const [covError, setCovError] = useState<string | null>(null);
  const [covData, setCovData] = useState<CoverageData | null>(null);

  // CDR
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrError, setCdrError] = useState<string | null>(null);
  const [cdrData, setCdrData] = useState<Record<string, unknown>[]>([]);

  const isValid = /^89\d{17,18}$/.test(iccid.trim());

  const doLookup = () => {
    const trimmed = iccid.trim();
    if (!isValid) return;
    setSearched(true);

    // 1. Subscription
    setSubLoading(true);
    setSubError(null);
    setSubData(null);
    fetchTelliSIM(`/api/tellisim/subscription/${trimmed}`)
      .then((d) => setSubData(d))
      .catch((e) => setSubError(e.message))
      .finally(() => setSubLoading(false));

    // 2. Location
    setLocLoading(true);
    setLocError(null);
    setLocData(null);
    fetchTelliSIM(`/api/tellisim/location/${trimmed}`)
      .then((d) => setLocData(d))
      .catch((e) => setLocError(e.message))
      .finally(() => setLocLoading(false));

    // 3. Orders
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d) => setOrdData(d.results ?? []))
      .catch((e) => setOrdError(e.message))
      .finally(() => setOrdLoading(false));

    // 4. Coverage
    setCovLoading(true);
    setCovError(null);
    setCovData(null);
    fetchTelliSIM("/api/tellisim/coverage", { iccid: trimmed })
      .then((d) => setCovData(d))
      .catch((e) => setCovError(e.message))
      .finally(() => setCovLoading(false));

    // 5. CDR
    setCdrLoading(true);
    setCdrError(null);
    setCdrData([]);
    fetchOS("/api/opensearch/cdr", { iccid: trimmed, size: 20 })
      .then((d) => {
        const hits = d.tellisimCdr?.hits || d.archiveCdr?.hits || [];
        setCdrData(hits);
      })
      .catch((e) => setCdrError(e.message))
      .finally(() => setCdrLoading(false));
  };

  const sub = subData?.subscription;
  const loc = locData?.location;

  const statusColors: Record<string, string> = {
    completed: "bg-success-soft text-success",
    shipped: "bg-lavender/20 text-amethyst",
    processing: "bg-fraud-yellow-soft text-fraud-yellow",
    cancelled: "bg-fraud-red-soft text-fraud-red",
    pending: "bg-fraud-yellow-soft text-fraud-yellow",
    refunded: "bg-fraud-red-soft text-fraud-red",
  };

  const subStatusBadge = sub?.status
    ? {
        label: sub.status,
        className:
          sub.status.toLowerCase() === "active"
            ? "bg-success-soft text-success"
            : sub.status.toLowerCase() === "suspended"
              ? "bg-fraud-yellow-soft text-fraud-yellow"
              : "bg-muted text-muted-foreground",
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Input bar */}
      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter ICCID (19-20 digits, starts with 89)..."
            value={iccid}
            onChange={(e) => setIccid(e.target.value.replace(/\D/g, "").slice(0, 20))}
            onKeyDown={(e) => e.key === "Enter" && isValid && doLookup()}
            className="h-12 pl-12 text-[15px] rounded-[16px] border-border"
          />
        </div>
        <Button
          onClick={doLookup}
          disabled={!isValid}
          className="h-12 px-6 rounded-[16px] bg-[#e9e5dd] text-charcoal font-[540] hover:bg-[#ddd8cf]"
        >
          Lookup
        </Button>
      </div>

      {/* Results grid */}
      {searched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Subscription */}
          <LookupCard
            title="Subscription"
            icon={<Signal className="h-3.5 w-3.5 text-amethyst" />}
            loading={subLoading}
            error={subError}
            empty={!sub}
            badge={subStatusBadge}
          >
            {sub && (
              <div>
                <KVRow label="Plan" value={sub.planName || ""} />
                <KVRow
                  label="Data Remaining"
                  value={
                    sub.dataRemaining != null && sub.dataTotal != null
                      ? `${formatBytes(sub.dataRemaining)} / ${formatBytes(sub.dataTotal)}`
                      : ""
                  }
                />
                <KVRow label="Activation" value={sub.activationDate || ""} />
                <KVRow label="Expiry" value={sub.expiryDate || ""} />
              </div>
            )}
          </LookupCard>

          {/* Location */}
          <LookupCard
            title="Location"
            icon={<MapPin className="h-3.5 w-3.5 text-amethyst" />}
            loading={locLoading}
            error={locError}
            empty={!loc}
          >
            {loc && (
              <div>
                <KVRow label="Country" value={loc.country || ""} />
                <KVRow label="Network" value={loc.network || ""} />
                <KVRow label="Last Update" value={loc.timestamp || ""} />
              </div>
            )}
          </LookupCard>

          {/* Orders */}
          <LookupCard
            title="Orders"
            icon={<Package className="h-3.5 w-3.5 text-amethyst" />}
            loading={ordLoading}
            error={ordError}
            empty={ordData.length === 0}
            badge={ordData.length > 0 ? { label: String(ordData.length), className: "bg-lavender/20 text-amethyst" } : null}
          >
            <div className="space-y-2">
              {ordData.map((o) => {
                const statusKey = (o.status || "").toLowerCase();
                const ts = typeof o.created_at === "string" ? Number(o.created_at) : o.created_at;
                const date = !isNaN(ts as number)
                  ? new Date((ts as number) < 1e12 ? (ts as number) * 1000 : (ts as number)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "";
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-[8px] bg-parchment/30 px-2 py-1.5">
                    <div>
                      <span className="text-[12px] font-[600] text-charcoal">{o.order_number || o.id}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-[540] ${statusColors[statusKey] || "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                      <p className="text-[11px] font-[460] text-muted-foreground">
                        {Array.isArray(o.product_sku) ? o.product_sku.join(", ") : o.product_sku}
                        {o.total_usd != null && ` · $${Number(o.total_usd).toFixed(2)}`}
                      </p>
                    </div>
                    <span className="text-[11px] font-[460] text-muted-foreground">{date}</span>
                  </div>
                );
              })}
            </div>
          </LookupCard>

          {/* Coverage */}
          <LookupCard
            title="Coverage"
            icon={<Globe className="h-3.5 w-3.5 text-amethyst" />}
            loading={covLoading}
            error={covError}
            empty={!covData?.coverage}
          >
            {covData?.coverage && (
              <div>
                {covData.coverage.countries && covData.coverage.countries.length > 0 && (
                  <p className="text-[12px] font-[460] text-charcoal">
                    {covData.coverage.countries.join(", ")}
                  </p>
                )}
                {covData.coverage.networks && covData.coverage.networks.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {covData.coverage.networks.slice(0, 10).map((n, i) => (
                      <p key={i} className="text-[11px] font-[460] text-muted-foreground">
                        {n.country} — {n.operator}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </LookupCard>

          {/* Recent CDR (full width) */}
          <LookupCard
            title="Recent CDR"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrData.length === 0}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2 pr-4">Usage</th>
                    <th className="pb-2 pr-4">Network</th>
                    <th className="pb-2">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {cdrData.slice(0, 20).map((row, i) => {
                    const src = (row._source || row) as Record<string, unknown>;
                    const date = (src.USAGE_DATE_UTC || src.ConnectTime || src.date || "") as string;
                    const usage = src.TOTAL_QTY || src.total || 0;
                    const network = (src.NETWORK || src.Narrative || "") as string;
                    const country = (src.COUNTRY || src.country || "") as string;
                    return (
                      <tr key={i} className="border-b border-parchment/50 text-charcoal font-[460]">
                        <td className="py-1.5 pr-4">{typeof date === "string" ? date.slice(0, 16) : String(date)}</td>
                        <td className="py-1.5 pr-4">{formatBytes(Number(usage))}</td>
                        <td className="py-1.5 pr-4">{network}</td>
                        <td className="py-1.5">{country}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </LookupCard>
        </div>
      )}

      {/* Empty state before search */}
      {!searched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-lavender/20">
            <Signal className="h-8 w-8 text-amethyst" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">ICCID Lookup</p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Enter a 19-20 digit ICCID to look up eSIM subscription, location, and usage
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to iccid-lookup.

- [ ] **Step 3: Commit**

```bash
git add src/components/lookup/iccid-lookup.tsx
git commit -m "feat(lookup): add ICCID lookup component with parallel data fetching"
```

---

### Task 4: Add Tab Navigation to Search Page

**Files:**
- Modify: `src/app/(app)/search/page.tsx`

Wrap the existing `SearchPageContent` with a tab switcher. The existing search becomes the default "Search" tab, and two new tabs render `ImeiLookup` and `IccidLookup`.

- [ ] **Step 1: Add imports and tab state**

At the top of `src/app/(app)/search/page.tsx`, add imports:

```tsx
import { Smartphone, Signal } from "lucide-react";
import { ImeiLookup } from "@/components/lookup/imei-lookup";
import { IccidLookup } from "@/components/lookup/iccid-lookup";
```

- [ ] **Step 2: Modify SearchPageContent to support tabs**

Replace the `SearchPageContent` function's opening to read `tab` from URL params and render a tab bar before the existing content. Wrap the entire existing return JSX (everything inside the `<div className="space-y-6">`) so it only renders when `activeTab === "search"`.

Add at the beginning of `SearchPageContent`, after existing state declarations:

```tsx
const activeTab = searchParams.get("tab") || "search";

const setTab = (tab: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("tab", tab);
  // Clear query param when switching tabs
  if (tab !== "search") params.delete("q");
  router.replace(`/search?${params.toString()}`, { scroll: false });
};
```

- [ ] **Step 3: Add tab bar UI**

Replace the `<Header />` usage in the return JSX with a combined header + tab bar:

```tsx
<div>
  <h1 className="text-[22px] font-[540] text-charcoal">Search</h1>
  <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
    Find orders, customers, and devices across the platform
  </p>
  <div className="mt-4 flex gap-1 border-b border-parchment">
    {[
      { key: "search", label: "Search", icon: Search },
      { key: "imei", label: "IMEI Lookup", icon: Smartphone },
      { key: "iccid", label: "ICCID Lookup", icon: Signal },
    ].map((t) => (
      <button
        key={t.key}
        onClick={() => setTab(t.key)}
        className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-[540] transition-colors cursor-pointer -mb-px ${
          activeTab === t.key
            ? "border-b-2 border-amethyst text-amethyst"
            : "text-muted-foreground hover:text-charcoal"
        }`}
      >
        <t.icon className="h-3.5 w-3.5" />
        {t.label}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 4: Conditionally render tab content**

Below the header+tabs, render the appropriate content:

```tsx
{activeTab === "search" && (
  <>
    <SearchInput query={query} onChange={setQuery} loading={loading} />
    {/* ... all existing search states (LPA, loading, error, empty, results) ... */}
  </>
)}

{activeTab === "imei" && <ImeiLookup />}

{activeTab === "iccid" && <IccidLookup />}
```

The existing search JSX stays exactly as-is, just wrapped in `{activeTab === "search" && (...)}`.

- [ ] **Step 5: Update the Suspense fallback in the default export**

Update the `SearchPage` default export's `<Header />` fallback to include the tab bar as well so it doesn't flash during hydration.

- [ ] **Step 6: Remove standalone `<Header />` calls**

Remove the standalone `<Header />` component calls from the `notConfigured` early return — replace with the same header+tabs block (or extract to a shared component within the file).

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 8: Test in browser**

Start dev server if not running: `./scripts/start.sh`

1. Navigate to `http://localhost:5000/search` — should show Search tab active by default
2. Click "IMEI Lookup" tab — should show IMEI input, URL updates to `?tab=imei`
3. Enter `355700430489472` (known IMEI with orders) — should show all 5 cards with data
4. Click "ICCID Lookup" tab — should show ICCID input, URL updates to `?tab=iccid`
5. Click "Search" tab — should restore the existing search behavior
6. Verify sidebar "Search" stays highlighted on all three tabs

- [ ] **Step 9: Commit**

```bash
git add src/app/(app)/search/page.tsx
git commit -m "feat(search): add IMEI and ICCID lookup tabs to search page"
```
