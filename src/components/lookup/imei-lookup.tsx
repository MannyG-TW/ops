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

  // Device info
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const [devBinding, setDevBinding] = useState<DeviceBinding | null>(null);

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

    // 3. Orders (search by IMEI)
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d) => setOrdData(d.results ?? []))
      .catch((e: Error) => setOrdError(e.message))
      .finally(() => setOrdLoading(false));

    // 5. CDR / recent sessions
    setCdrLoading(true);
    setCdrError(null);
    setCdrData([]);
    fetchOS("/api/opensearch/cdr", { imei: trimmed, size: 20 })
      .then((d) => {
        const hits =
          (d.uclCdr?.hits as Record<string, unknown>[]) ||
          (d.consumption?.hits as Record<string, unknown>[]) ||
          [];
        setCdrData(hits);
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
            loading={devLoading}
            error={devError}
            empty={!devBinding && !termAllData && !devLoading && !devError}
          >
            <div>
              <KVRow label="Device" value={resolved.name} />
              <KVRow label="Org" value={termAllData?.u_orgName || ""} />
              <KVRow
                label="Terminal Type"
                value={devBinding?.terminalType || termAllData?.devicetype || ""}
              />
              <KVRow label="Software" value={termAllData?.softversion || ""} />
              <KVRow
                label="User"
                value={termAllData?.userCode || devBinding?.userCode || ""}
              />
              <KVRow label="Status" value={devBinding?.status || ""} />
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

          {/* Recent Sessions (full width) */}
          <LookupCard
            title="Recent Sessions"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrData.length === 0 && !cdrLoading && !cdrError}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-4 font-[460]">Date</th>
                    <th className="pb-2 pr-4 font-[460]">Upload</th>
                    <th className="pb-2 pr-4 font-[460]">Download</th>
                    <th className="pb-2 pr-4 font-[460]">Total</th>
                    <th className="pb-2 font-[460]">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {cdrData.slice(0, 20).map((row, i) => {
                    const src = (
                      row._source ? row._source : row
                    ) as Record<string, unknown>;
                    const date = String(
                      src.date || src.Date || src.timestamp || ""
                    );
                    const up = Number(
                      src.sysUpFlow || src.upload || src.UPLOAD_BYTES || 0
                    );
                    const down = Number(
                      src.sysDownFlow || src.download || src.DOWNLOAD_BYTES || 0
                    );
                    const total = Number(
                      src.totalFlow || src.total || up + down
                    );
                    const country = String(
                      src.country || src.iso2 || src.mcc || ""
                    );
                    return (
                      <tr
                        key={i}
                        className="border-b border-parchment/50 text-charcoal font-[460]"
                      >
                        <td className="py-1.5 pr-4">{date.slice(0, 16)}</td>
                        <td className="py-1.5 pr-4">{formatBytes(up)}</td>
                        <td className="py-1.5 pr-4">{formatBytes(down)}</td>
                        <td className="py-1.5 pr-4">{formatBytes(total)}</td>
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
    </div>
  );
}
