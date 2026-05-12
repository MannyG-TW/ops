"use client";

import { useState } from "react";
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
    fetchOS("/api/opensearch/cdr", { imei: trimmed, size: 50 })
      .then((d) => {
        const records =
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
              <KVRow label="Import Date" value={detData?.createTime ? formatDate(detData.createTime) : ""} />
              <KVRow label="Created By" value={detData?.operatorName || ""} />
              <KVRow label="Source" value={detData?.regsiterSource || ""} />
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
                    {offer.flowByte != null && offer.surplusFlowbyte != null && (
                      <p className="mt-0.5 text-[11px] font-[460] text-muted-foreground">
                        Data: {formatBytes(Number(offer.surplusFlowbyte))} / {formatBytes(Number(offer.flowByte))} remaining
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

          {/* Data Usage (full width) */}
          <LookupCard
            title="Data Usage"
            icon={<BarChart3 className="h-3.5 w-3.5 text-amethyst" />}
            loading={usageLoading}
            error={usageError}
            empty={usageData.length === 0 && !usageLoading && !usageError}
            badge={usageData.length > 0 ? { label: `${usageData.length} sessions`, className: "bg-lavender/20 text-amethyst" } : null}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-3 font-[460]">Start</th>
                    <th className="pb-2 pr-3 font-[460]">End</th>
                    <th className="pb-2 pr-3 font-[460]">Duration</th>
                    <th className="pb-2 pr-3 font-[460]">Data</th>
                    <th className="pb-2 font-[460]">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {usageData.slice(0, 50).map((row, i) => {
                    const startIso = (row.start_time_iso || "") as string;
                    const endIso = (row.end_time_iso || "") as string;
                    const durSec = Number(row.duration_seconds || 0);
                    const durMin = durSec > 0 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : "";
                    const mb = Number(row.flow_size_mb || 0);
                    const display = mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb > 0 ? `${mb.toFixed(1)} MB` : "0";
                    const country = (row.visit_country || "") as string;
                    return (
                      <tr key={i} className="border-b border-parchment/50 text-charcoal font-[460]">
                        <td className="py-1.5 pr-3 whitespace-nowrap">{startIso.replace("T", " ").slice(0, 16)}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">{endIso.replace("T", " ").slice(0, 16)}</td>
                        <td className="py-1.5 pr-3">{durMin}</td>
                        <td className="py-1.5 pr-3 font-[540]">{display}</td>
                        <td className="py-1.5">{country}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  {cdrData.slice(0, 50).map((row: Record<string, unknown>, i: number) => (
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
          </LookupCard>
        </div>
      )}
    </div>
  );
}
