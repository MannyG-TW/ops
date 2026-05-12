"use client";

import { useState, useRef } from "react";
import {
  Search,
  Wifi,
  Smartphone,
  Package,
  ShoppingBag,
  Activity,
  BarChart3,
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

interface AllTerminalData {
  // queryUserInfo fields
  belongCountry?: string;
  mcc?: string;
  rat?: string;
  sigStrength?: string;
  qualityVal?: string;
  powerLeft?: string;
  ctUsableClipSum?: number;
  wifyConnectMax?: string;
  loginDateTime?: number;
  isOnline?: number | boolean;
  plmn?: string;
  // legacy queryOnlineTerminal fields (kept for backward compat)
  country?: string;
  iso2?: string;
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

interface DeviceBinding {
  terminalType?: string;
  imei?: string;
  status?: string;
  userCode?: string;
  customerName?: string;
}

interface DeviceDetail {
  userCode?: string;
  imei?: string;
  customerId?: string;
  status?: string;
  isActivation?: string;
  tmlStatus?: string;
  tmlType?: string;
  sVersion?: string;
  orgName?: string;
  orgCode?: string;
  mvnoName?: string;
  seedIccid?: string;
  seedImsi?: string;
  amount?: number;
  currencyType?: string;
  lockFlag?: string;
  activeFlag?: string;
  buType?: string;
  createTime?: number;
  userCreateTime?: number;
  tmlPwd?: string;
  email?: string;
  operatorName?: string;
  regsiterSource?: string;
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
  goodsCode?: string;
  goodsTypeName?: string;
  goodsType?: string;
  status?: string;
  effectiveTime?: number;
  expiryTime?: number;
  flowByte?: number | null;
  surplusFlowbyte?: number | null;
  mccList?: string[];
  periodUnit?: string;
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
  if (!bytes || isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(ts: number | undefined | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const statusColors: Record<string, string> = {
  completed: "bg-success-soft text-success",
  shipped: "bg-lavender/20 text-amethyst",
  processing: "bg-fraud-yellow-soft text-fraud-yellow",
  cancelled: "bg-fraud-red-soft text-fraud-red",
  pending: "bg-fraud-yellow-soft text-fraud-yellow",
  refunded: "bg-fraud-red-soft text-fraud-red",
};

export function ImeiLookup() {
  const [imei, setImei] = useState("");
  const [searched, setSearched] = useState(false);

  // Terminal status
  const [termLoading, setTermLoading] = useState(false);
  const [termError, setTermError] = useState<string | null>(null);
  const [termData, setTermData] = useState<TerminalData | null>(null);
  const [termAllData, setTermAllData] = useState<AllTerminalData | null>(null);

  // Device info (BSS — binding + offers)
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [devBinding, setDevBinding] = useState<DeviceBinding | null>(null);

  // Device detail (QueryCustomerForkf — rich account/device data)
  const [detLoading, setDetLoading] = useState(false);
  const [detError, setDetError] = useState<string | null>(null);
  const [detData, setDetData] = useState<DeviceDetail | null>(null);

  // Orders
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordError, setOrdError] = useState<string | null>(null);
  const [ordData, setOrdData] = useState<OrderResult[]>([]);

  // User offers
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);
  const [offData, setOffData] = useState<OfferItem[]>([]);

  // Data usage (UCL CDR from OpenSearch)
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<Record<string, unknown>[]>([]);

  // CDR / sessions
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrPage, setCdrPage] = useState(0);
  const CDR_PAGE_SIZE = 10;
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
        if (!d.ok) setTermError(d.error || "Failed to fetch terminal status");
        else {
          setTermData(d.terminal ?? null);
          setTermAllData(d.allData ?? null);
        }
      })
      .catch((e: Error) => setTermError(e.message))
      .finally(() => setTermLoading(false));

    // 2. Device info + offers (single call — device-info returns offers alongside binding)
    setDevLoading(true);
    setDevError(null);
    setDevBinding(null);
    setOffLoading(true);
    setOffError(null);
    setOffData([]);
    fetch("/api/ucl/device-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setDevError(d.error || "Failed to fetch device info");
          setOffError(d.error || "Failed to fetch offers");
        } else {
          setDevBinding(d.binding ?? null);
          setOffData(d.offers ?? []);
        }
      })
      .catch((e: Error) => {
        setDevError(e.message);
        setOffError(e.message);
      })
      .finally(() => {
        setDevLoading(false);
        setOffLoading(false);
      });

    // 3. Device detail (QueryCustomerForkf — rich account/device data)
    setDetLoading(true);
    setDetError(null);
    setDetData(null);
    fetch("/api/ucl/device-detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setDetError(d.error || "Failed to fetch device detail");
        else setDetData(d.detail ?? null);
      })
      .catch((e: Error) => setDetError(e.message))
      .finally(() => setDetLoading(false));

    // 4. Orders (search by IMEI)
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d) => setOrdData(d.results ?? []))
      .catch((e: Error) => setOrdError(e.message))
      .finally(() => setOrdLoading(false));

    // 5. Data usage (UCL CDR from OpenSearch)
    setUsageLoading(true);
    setUsageError(null);
    setUsageData([]);
    fetchOS("/api/opensearch/cdr", {
      imei: trimmed,
      size: 500,
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      to: new Date().toISOString(),
    })
      .then((d) => {
        const records =
          d.cdr?.ucl?.records ||
          d.cdr?.dailyConsumption?.records ||
          d.ucl?.records ||
          d.dailyConsumption?.records ||
          [];
        setUsageData(records);
      })
      .catch((e: Error) => setUsageError(e.message))
      .finally(() => setUsageLoading(false));

    // 6. Connection log (UCL activity stream — last 30 days)
    setCdrLoading(true);
    setCdrError(null);
    setCdrData([]);
    fetch("/api/ucl/connection-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imei: trimmed }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) setCdrError(d.error || "Failed to fetch connection log");
        else setCdrData(d.entries ?? []);
      })
      .catch((e: Error) => setCdrError(e.message))
      .finally(() => setCdrLoading(false));
  };

  const resolved = getSapphireDeviceName({
    terminalType: devBinding?.terminalType || termAllData?.devicetype,
    imei: imei.trim() || null,
  });

  const signal = termData?.network ? parseSignal(termData.network) : "";

  return (
    <div className="space-y-4">
      {/* Input bar */}
      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter IMEI (15 digits)..."
            value={imei}
            onChange={(e) =>
              setImei(e.target.value.replace(/\D/g, "").slice(0, 15))
            }
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

      {/* Empty state before first search */}
      {!searched && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-lavender/20">
            <Smartphone className="h-8 w-8 text-amethyst" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            IMEI Lookup
          </p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Enter a 15-digit IMEI to look up Sapphire device status, orders,
            and plans
          </p>
        </div>
      )}

      {/* Results grid */}
      {searched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Terminal Status */}
          <LookupCard
            title="Terminal Status"
            icon={<Wifi className="h-3.5 w-3.5 text-amethyst" />}
            loading={termLoading}
            error={termError}
            empty={!termData && !termLoading && !termError}
            badge={
              termData
                ? termData.isOnline
                  ? { label: "Online", className: "bg-success-soft text-success" }
                  : { label: "Offline", className: "bg-muted text-muted-foreground" }
                : null
            }
          >
            <div>
              <KVRow
                label="Country"
                value={termAllData?.belongCountry || termAllData?.iso2 || termAllData?.country || ""}
              />
              <KVRow
                label="MCC"
                value={termData?.mcc || ""}
              />
              <KVRow label="RAT" value={String(termAllData?.rat || "")} />
              <KVRow label="Signal" value={termAllData?.sigStrength ? `${termAllData.sigStrength}` : signal} />
              <KVRow label="Battery" value={termAllData?.powerLeft ? String(termAllData.powerLeft) : ""} />
              <KVRow label="Quality" value={termAllData?.qualityVal ? String(termAllData.qualityVal) : ""} />
              <KVRow
                label="Data Clips"
                value={termAllData?.ctUsableClipSum != null ? String(termAllData.ctUsableClipSum) : ""}
              />
              <KVRow
                label="WiFi Max Users"
                value={termAllData?.wifyConnectMax ? String(termAllData.wifyConnectMax) : ""}
              />
              <KVRow
                label="Last Login"
                value={
                  termAllData?.loginDateTime
                    ? formatTimestamp(Number(termAllData.loginDateTime))
                    : ""
                }
              />
            </div>
          </LookupCard>

          {/* Device Info */}
          <LookupCard
            title="Device Info"
            icon={<Smartphone className="h-3.5 w-3.5 text-amethyst" />}
            loading={detLoading && devLoading}
            error={detError || devError}
            empty={!detData && !devBinding && !detLoading && !devLoading}
            badge={detData?.isActivation ? {
              label: detData.isActivation,
              className: detData.isActivation === "ACTIVATED" ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
            } : null}
          >
            <div>
              <KVRow label="Device" value={resolved.name} />
              <KVRow label="Model" value={detData?.tmlType || devBinding?.terminalType || ""} />
              <KVRow label="Firmware" value={detData?.sVersion || ""} />
              <KVRow label="Org" value={detData?.orgName || ""} />
              <KVRow label="MVNO" value={detData?.mvnoName || ""} />
              <KVRow label="Bind Account" value={detData?.userCode || devBinding?.customerName || ""} />
              <KVRow label="Account Status" value={detData?.status ? detData.status.charAt(0).toUpperCase() + detData.status.slice(1) : ""} />
              <KVRow label="Device Status" value={detData?.tmlStatus || ""} />
              <KVRow label="Locked" value={detData?.lockFlag === "1" ? "Yes" : detData?.lockFlag === "0" ? "No" : ""} />
              <KVRow label="Seed ICCID" value={detData?.seedIccid || ""} />
              <KVRow label="Seed IMSI" value={detData?.seedImsi || ""} />
              <KVRow label="Balance" value={detData?.amount != null ? `${detData.amount.toFixed(2)} ${detData.currencyType || ""}` : ""} />
            </div>
          </LookupCard>

          {/* Orders */}
          <LookupCard
            title="Orders"
            icon={<Package className="h-3.5 w-3.5 text-amethyst" />}
            loading={ordLoading}
            error={ordError}
            empty={ordData.length === 0 && !ordLoading && !ordError}
            badge={
              ordData.length > 0
                ? {
                    label: String(ordData.length),
                    className: "bg-lavender/20 text-amethyst",
                  }
                : null
            }
          >
            <div className="space-y-2">
              {ordData.map((o) => {
                const statusKey = (o.status || "").toLowerCase();
                const tsRaw = Number(o.created_at);
                const date = !isNaN(tsRaw)
                  ? new Date(
                      tsRaw < 1e12 ? tsRaw * 1000 : tsRaw
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "";
                return (
                  <div
                    key={o.id}
                    className="flex items-start justify-between rounded-[8px] bg-parchment/30 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] font-[600] text-charcoal">
                          {o.order_number || o.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-[540] ${
                            statusColors[statusKey] ||
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {o.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-[460] text-muted-foreground truncate">
                        {Array.isArray(o.product_sku)
                          ? o.product_sku.join(", ")
                          : o.product_sku}
                        {o.total_usd != null &&
                          ` · $${Number(o.total_usd).toFixed(2)}`}
                      </p>
                    </div>
                    <span className="shrink-0 ml-2 text-[11px] font-[460] text-muted-foreground">
                      {date}
                    </span>
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
            empty={offData.length === 0 && !offLoading && !offError}
            badge={offData.length > 0 ? {
              label: `${offData.filter((o) => o.status === "VALID").length} active / ${offData.filter((o) => o.status !== "VALID").length} expired`,
              className: "bg-lavender/20 text-amethyst",
            } : null}
          >
            <div className="space-y-2">
              {/* Deduplicate by goodsCode+effectiveTime+status, show VALID first */}
              {Array.from(new Map(offData.map((o) => [`${o.goodsCode}-${o.effectiveTime}-${o.status}`, o])).values())
                .sort((a, b) => (a.status === "VALID" ? 0 : 1) - (b.status === "VALID" ? 0 : 1))
                .slice(0, 10)
                .map((offer, i) => {
                const isValid = offer.status === "VALID";
                // Calculate data consumed during this plan's validity window from CDR
                const planStart = offer.effectiveTime || 0;
                const planEnd = offer.expiryTime || Infinity;
                const consumed = usageData.reduce((sum, row) => {
                  const sessionStart = Number(row.start_time || 0);
                  if (sessionStart >= planStart && sessionStart <= planEnd) {
                    return sum + Number(row.flowsize || row.flow_size || row.TOTAL_QTY || 0);
                  }
                  return sum;
                }, 0);
                return (
                  <div
                    key={i}
                    className="rounded-[8px] bg-parchment/30 px-2.5 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-[600] text-charcoal">
                        {offer.goodsName || offer.goodsTypeName || "Plan"}
                      </p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-[540] ${isValid ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"}`}>
                        {offer.status || "Unknown"}
                      </span>
                    </div>
                    {offer.goodsCode && (
                      <p className="mt-0.5 text-[11px] font-[460] text-muted-foreground">
                        SKU: {offer.goodsCode}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      {offer.effectiveTime && (
                        <p className="text-[11px] font-[460] text-muted-foreground">
                          From: {formatDate(offer.effectiveTime)}
                        </p>
                      )}
                      {offer.expiryTime && (
                        <p className="text-[11px] font-[460] text-muted-foreground">
                          To: {formatDate(offer.expiryTime)}
                        </p>
                      )}
                    </div>
                    {offer.flowByte != null && offer.surplusFlowbyte != null ? (
                      <p className="mt-0.5 text-[11px] font-[460] text-muted-foreground">
                        Data: {formatBytes(Number(offer.surplusFlowbyte))} / {formatBytes(Number(offer.flowByte))} remaining
                      </p>
                    ) : consumed > 0 ? (
                      <p className="mt-0.5 text-[11px] font-[540] text-amethyst">
                        Consumed: {formatBytes(consumed)}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] font-[460] text-muted-foreground">
                        No usage recorded
                      </p>
                    )}
                    {offer.mccList && offer.mccList.length > 0 && (
                      <p className="mt-0.5 text-[11px] font-[460] text-muted-foreground">
                        Countries: {offer.mccList.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </LookupCard>

          {/* Data Usage (full width) — chart + table */}
          <LookupCard
            title="Data Usage"
            icon={<BarChart3 className="h-3.5 w-3.5 text-amethyst" />}
            loading={usageLoading}
            error={usageError}
            empty={usageData.length === 0 && !usageLoading && !usageError}
            badge={usageData.length > 0 ? {
              label: `${formatBytes(usageData.reduce((sum, r) => sum + Number(r.flowsize || r.flow_size || r.TOTAL_QTY || 0), 0))} total`,
              className: "bg-lavender/20 text-amethyst",
            } : null}
            fullWidth
          >
            <UsageChart data={usageData} />
          </LookupCard>

          {/* Connection Log (full width) */}
          <LookupCard
            title="Connection Log"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrData.length === 0 && !cdrLoading && !cdrError}
            badge={cdrData.length > 0 ? { label: `${cdrData.length} entries`, className: "bg-lavender/20 text-amethyst" } : null}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-3 font-[460]">Time</th>
                    <th className="pb-2 pr-3 font-[460]">Country</th>
                    <th className="pb-2 pr-3 font-[460]">MCC</th>
                    <th className="pb-2 pr-3 font-[460]">MNC</th>
                    <th className="pb-2 pr-3 font-[460]">Network</th>
                    <th className="pb-2 pr-3 font-[460]">RAT</th>
                    <th className="pb-2 pr-3 font-[460]">Signal</th>
                    <th className="pb-2 font-[460]">Battery</th>
                  </tr>
                </thead>
                <tbody>
                  {cdrData.slice(cdrPage * CDR_PAGE_SIZE, (cdrPage + 1) * CDR_PAGE_SIZE).map((row: Record<string, unknown>, i: number) => (
                    <tr key={i} className="border-b border-parchment/50 text-charcoal font-[460]">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{row.time ? formatTimestamp(row.time as number) : ""}</td>
                      <td className="py-1.5 pr-3">{row.country as string}</td>
                      <td className="py-1.5 pr-3">{row.mcc as string}</td>
                      <td className="py-1.5 pr-3">{row.mnc as string}</td>
                      <td className="py-1.5 pr-3">{row.network as string}</td>
                      <td className="py-1.5 pr-3">{row.rat as string}</td>
                      <td className="py-1.5 pr-3">{row.signal != null ? `${row.signal} dBm` : ""}</td>
                      <td className="py-1.5">{row.battery as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {cdrData.length > CDR_PAGE_SIZE && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-[460] text-muted-foreground">
                  {cdrPage * CDR_PAGE_SIZE + 1}–{Math.min((cdrPage + 1) * CDR_PAGE_SIZE, cdrData.length)} of {cdrData.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCdrPage((p) => Math.max(0, p - 1))}
                    disabled={cdrPage === 0}
                    className="rounded-[8px] px-3 py-1 text-[11px] font-[540] text-charcoal bg-parchment/40 hover:bg-parchment/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCdrPage((p) => Math.min(Math.ceil(cdrData.length / CDR_PAGE_SIZE) - 1, p + 1))}
                    disabled={(cdrPage + 1) * CDR_PAGE_SIZE >= cdrData.length}
                    className="rounded-[8px] px-3 py-1 text-[11px] font-[540] text-charcoal bg-parchment/40 hover:bg-parchment/70 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </LookupCard>
        </div>
      )}
    </div>
  );
}

/** Daily usage chart + session table for IMEI data consumption */
function UsageChart({ data }: { data: Record<string, unknown>[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Aggregate sessions by day
  const dailyMap = new Map<string, { bytes: number; sessions: number; country: string }>();
  for (const row of data) {
    const rawDate = (row.start_time_iso || row["@timestamp"] || "") as string;
    const day = typeof rawDate === "string" ? rawDate.slice(0, 10) : "";
    if (!day) continue;
    const bytes = Number(row.flowsize || row.flow_size || row.TOTAL_QTY || 0);
    const country = (row.visit_country || row.country || "") as string;
    const prev = dailyMap.get(day) || { bytes: 0, sessions: 0, country };
    dailyMap.set(day, { bytes: prev.bytes + bytes, sessions: prev.sessions + 1, country: country || prev.country });
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (daily.length === 0) return <p className="text-[12px] font-[460] text-muted-foreground">No usage data</p>;

  // Chart dimensions
  const W = 600, H = 160, padT = 16, padB = 8, padX = 8;
  const plotH = H - padT - padB, plotW = W - padX * 2;
  const maxBytes = Math.max(...daily.map((d) => d.bytes), 1);
  const chartMax = maxBytes * 1.15;
  const labelInterval = daily.length > 14 ? Math.ceil(daily.length / 10) : 1;

  const pts = daily.map((d, i) => {
    const x = daily.length === 1 ? W / 2 : padX + (plotW * i) / (daily.length - 1);
    const y = d.bytes > 0 ? padT + plotH * (1 - d.bytes / chartMax) : padT + plotH;
    return { x, y, ...d };
  });

  // Catmull-Rom smooth curve
  const smoothPath = (() => {
    if (pts.length < 2) return "";
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
    const t = 0.3;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      d += `C${p1.x + (p2.x - p0.x) * t},${p1.y + (p2.y - p0.y) * t} ${p2.x - (p3.x - p1.x) * t},${p2.y - (p3.y - p1.y) * t} ${p2.x},${p2.y}`;
    }
    return d;
  })();
  const areaPath = smoothPath ? `${smoothPath}L${pts[pts.length - 1].x},${padT + plotH}L${pts[0].x},${padT + plotH}Z` : "";

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || daily.length < 2) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0, closestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const gridYs = [0.25, 0.5, 0.75].map((pct) => padT + plotH * pct);

  return (
    <div>
      {/* Chart */}
      <div className="flex">
        <div className="flex flex-col justify-between pr-2" style={{ height: H, width: 48 }}>
          <span className="text-[10px] font-mono font-[500] text-muted-foreground text-right">{formatBytes(maxBytes)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">{formatBytes(maxBytes / 2)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">0</span>
        </div>
        <div ref={containerRef} className="flex-1 relative cursor-crosshair" style={{ height: H }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="lookupUsageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-lavender)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-lavender)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridYs.map((gy, i) => (
              <line key={i} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="var(--color-parchment)" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.6" />
            ))}
            <line x1={padX} y1={padT + plotH} x2={W - padX} y2={padT + plotH} stroke="var(--color-parchment)" strokeWidth="1" strokeOpacity="0.4" />
            {areaPath && <path d={areaPath} fill="url(#lookupUsageGrad)" />}
            {smoothPath && <path d={smoothPath} fill="none" stroke="var(--color-amethyst)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
            {hoveredIdx !== null && (
              <line x1={pts[hoveredIdx].x} y1={padT} x2={pts[hoveredIdx].x} y2={padT + plotH} stroke="var(--color-amethyst)" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />
            )}
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y}
                r={hoveredIdx === i ? 5 : (daily.length <= 14 && p.bytes > 0) ? 2.5 : 0}
                fill={hoveredIdx === i ? "var(--color-amethyst)" : "var(--color-lavender)"}
                stroke={hoveredIdx === i ? "white" : "none"} strokeWidth={hoveredIdx === i ? 2 : 0}
                className="transition-all duration-150"
              />
            ))}
          </svg>
          {hoveredIdx !== null && (
            <div className="absolute z-10 pointer-events-none" style={{
              left: `${(pts[hoveredIdx].x / W) * 100}%`,
              top: `${(pts[hoveredIdx].y / H) * 100}%`,
              transform: "translate(-50%, calc(-100% - 12px))",
            }}>
              <div className="rounded-[8px] bg-mysteria text-white px-3 py-2 text-[11px] font-[500] whitespace-nowrap shadow-lg">
                <div className="font-[600] text-[12px]">{formatBytes(daily[hoveredIdx].bytes)}</div>
                <div className="text-white/60 mt-0.5">
                  {new Date(daily[hoveredIdx].date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {daily[hoveredIdx].country && ` · ${daily[hoveredIdx].country}`}
                  {` · ${daily[hoveredIdx].sessions} session${daily[hoveredIdx].sessions !== 1 ? "s" : ""}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* X-axis labels */}
      <div className="flex mt-1" style={{ paddingLeft: 48 }}>
        <div className="flex-1 flex" style={{ gap: 2 }}>
          {daily.map((d, i) => (
            <div key={i} className="flex-1 text-center">
              {(i % labelInterval === 0 || i === daily.length - 1) && (
                <span className={`text-[9px] font-[460] leading-tight block ${d.bytes > 0 ? "text-muted-foreground" : "text-muted-foreground/30"}`}>
                  {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Session table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
              <th className="pb-2 pr-3 font-[460]">Date</th>
              <th className="pb-2 pr-3 font-[460]">Sessions</th>
              <th className="pb-2 pr-3 font-[460]">Data</th>
              <th className="pb-2 font-[460]">Country</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((d, i) => {
              const mb = d.bytes / (1024 * 1024);
              const display = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
              return (
                <tr key={i} className="border-b border-parchment/50 text-charcoal font-[460]">
                  <td className="py-1.5 pr-3">{new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="py-1.5 pr-3">{d.sessions}</td>
                  <td className="py-1.5 pr-3 font-[540]">{display}</td>
                  <td className="py-1.5">{d.country}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
