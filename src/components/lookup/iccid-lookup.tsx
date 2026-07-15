"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Signal,
  MapPin,
  Package,
  Globe,
  Activity,
  History,
  QrCode,
  Copy,
  Check,
  Download,
  Smartphone,
  CheckCircle2,
  XCircle,
  WifiOff,
  ChevronRight,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import type { EsimPdfOptions } from "@/lib/esim-pdf";
import { resolveBrandName } from "@/lib/brands";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LookupCard, KVRow } from "./lookup-card";
import { fetchOS, fetchTelliSIM } from "@/lib/settings-client";
import { getSmdpLabel } from "@/lib/smdp-labels";

// Loose types — TelliSIM API shapes vary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface OrderResult {
  id: string;
  order_number: string;
  customer_email: string;
  status: string;
  product_sku: string | string[];
  total: number;
  currency_iso: string;
  created_at: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const statusColors: Record<string, string> = {
  completed: "bg-success-soft text-success",
  shipped: "bg-lavender/20 text-amethyst",
  processing: "bg-fraud-yellow-soft text-fraud-yellow",
  cancelled: "bg-fraud-red-soft text-fraud-red",
  pending: "bg-fraud-yellow-soft text-fraud-yellow",
  refunded: "bg-fraud-red-soft text-fraud-red",
};

const subStatusColors: Record<string, string> = {
  active: "bg-success-soft text-success",
  suspended: "bg-fraud-yellow-soft text-fraud-yellow",
};

function subStatusClass(status: string): string {
  return (
    subStatusColors[(status || "").toLowerCase()] ||
    "bg-muted text-muted-foreground"
  );
}

function smdpBadgeClass(
  severity: "success" | "info" | "warning" | "error"
): string {
  switch (severity) {
    case "success":
      return "bg-success-soft text-success";
    case "warning":
      return "bg-fraud-yellow-soft text-fraud-yellow";
    case "error":
      return "bg-fraud-red-soft text-fraud-red";
    default:
      return "bg-lavender/20 text-amethyst";
  }
}

function formatDateTime(val?: string): string {
  if (!val) return "—";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function IccidLookup() {
  const [iccid, setIccid] = useState("");
  const [searched, setSearched] = useState(false);

  // Subscription
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [subData, setSubData] = useState<AnyRecord | null>(null);

  // Location
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [locData, setLocData] = useState<AnyRecord | null>(null);

  // Orders
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordError, setOrdError] = useState<string | null>(null);
  const [ordData, setOrdData] = useState<OrderResult[]>([]);

  // Coverage
  const [covLoading, setCovLoading] = useState(false);
  const [covError, setCovError] = useState<string | null>(null);
  const [covData, setCovData] = useState<AnyRecord | null>(null);

  // CDR
  const [cdrLoading, setCdrLoading] = useState(false);
  const [cdrError, setCdrError] = useState<string | null>(null);
  const [cdrRows, setCdrRows] = useState<AnyRecord[]>([]);

  // SMDP profile (state history + SIM/device details)
  const [smdpLoading, setSmdpLoading] = useState(false);
  const [smdpError, setSmdpError] = useState<string | null>(null);
  const [smdpData, setSmdpData] = useState<AnyRecord | null>(null);

  // Valid when 19-20 digits starting with "89"
  const isValid = /^89\d{17,18}$/.test(iccid.trim());

  // Monotonic id so a second lookup's slower responses can't paint the previous
  // ICCID's subscription / LPA / CDR into the new ICCID's panels
  const lookupSeqRef = useRef(0);

  const doLookup = () => {
    const trimmed = iccid.trim();
    if (!isValid) return;
    setSearched(true);
    const seq = ++lookupSeqRef.current;
    const stale = () => seq !== lookupSeqRef.current;

    // CDR fetch — windowed by the plan's activation date so usage older than
    // 30 days still shows. A fixed 30-day window returned an empty chart even
    // when the plan's cumulative counter reported consumed data.
    const runCdr = (fromISO: string) => {
      fetchOS("/api/opensearch/cdr", {
        iccid: trimmed,
        size: 1000,
        from: fromISO,
        to: new Date().toISOString(),
      })
        .then((d: AnyRecord) => {
          if (stale()) return;
          const records =
            d.cdr?.tellisim?.records ??
            d.cdr?.archive?.records ??
            d.tellisimCdr?.hits ??
            d.archiveCdr?.hits ??
            [];
          setCdrRows(records as AnyRecord[]);
        })
        .catch((e: Error) => { if (!stale()) setCdrError(e.message); })
        .finally(() => { if (!stale()) setCdrLoading(false); });
    };
    const yearAgo = () =>
      new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Subscription → chain Coverage (plan coverage_id) + CDR (activation window)
    setSubLoading(true);
    setSubError(null);
    setSubData(null);
    setCovLoading(true);
    setCovError(null);
    setCovData(null);
    setCdrLoading(true);
    setCdrError(null);
    setCdrRows([]);
    fetchTelliSIM(`/api/tellisim/subscription/${trimmed}`)
      .then((d: AnyRecord) => {
        if (stale()) return;
        setSubData(d);
        setSubLoading(false);
        // CDR window: 1 day before activation → now (fallback: last 365 days)
        const activation = d?.planAttachments?.data?.[0]?.activation_at;
        const actMs = activation ? new Date(activation).getTime() : NaN;
        runCdr(!isNaN(actMs) ? new Date(actMs - 86_400_000).toISOString() : yearAgo());
        // Extract coverage_id from the plan and fetch specific coverage
        const coverageId = d?.planAttachments?.data?.[0]?.plan?.coverage_id;
        if (coverageId) {
          fetchTelliSIM(`/api/tellisim/coverage/${coverageId}`, {})
            .then((cov: AnyRecord) => { if (!stale()) setCovData(cov); })
            .catch((e: Error) => { if (!stale()) setCovError(e.message); })
            .finally(() => { if (!stale()) setCovLoading(false); });
        } else {
          setCovError("No coverage ID in plan");
          setCovLoading(false);
        }
      })
      .catch((e: Error) => {
        if (stale()) return;
        setSubError(e.message);
        setSubLoading(false);
        setCovError("Subscription failed — cannot load coverage");
        setCovLoading(false);
        // Still attempt CDR over a wide fallback window
        runCdr(yearAgo());
      });

    // 2. Location
    setLocLoading(true);
    setLocError(null);
    setLocData(null);
    fetchTelliSIM(`/api/tellisim/location/${trimmed}`)
      .then((d: AnyRecord) => { if (!stale()) setLocData(d); })
      .catch((e: Error) => { if (!stale()) setLocError(e.message); })
      .finally(() => { if (!stale()) setLocLoading(false); });

    // 3. Orders
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d: { results?: OrderResult[] }) => { if (!stale()) setOrdData(d.results ?? []); })
      .catch((e: Error) => { if (!stale()) setOrdError(e.message); })
      .finally(() => { if (!stale()) setOrdLoading(false); });

    // 4. SMDP profile — state history + SIM/device details (EID, LPA)
    setSmdpLoading(true);
    setSmdpError(null);
    setSmdpData(null);
    fetchTelliSIM(`/api/tellisim/smdp/${trimmed}`)
      .then((d: AnyRecord) => { if (!stale()) setSmdpData(d); })
      .catch((e: Error) => { if (!stale()) setSmdpError(e.message); })
      .finally(() => { if (!stale()) setSmdpLoading(false); });
  };

  // Extract subscription fields from actual TelliSIM API response
  // Response: { subscription: { esim: {...} }, planAttachments: { data: [{ state, plan: { name }, used_allowance: { dataBytes }, activation_at, expiration_at }] } }
  const planAttachment = (subData as AnyRecord)?.planAttachments?.data?.[0] as AnyRecord | undefined;
  const plan = planAttachment?.plan as AnyRecord | undefined;
  const subStatus = String(planAttachment?.state || "");
  const planName = String(plan?.name || plan?.label || "");
  const usedBytes = Number((planAttachment?.used_allowance as AnyRecord)?.dataBytes ?? NaN);
  const totalMb = Number(plan?.data_mega_bytes ?? NaN);
  const totalBytes = !isNaN(totalMb) ? totalMb * 1024 * 1024 : NaN;
  const remainingBytes = !isNaN(usedBytes) && !isNaN(totalBytes) ? totalBytes - usedBytes : NaN;
  const activationDate = String(planAttachment?.activation_at || "");
  const expiryDate = String(planAttachment?.expiration_at || "");
  const planCountry = String(plan?.region_code || "");
  const planDays = Number(plan?.period_days ?? "");
  const isThrottled = plan?.throttling === true;
  const isRecurring = plan?.recurring === true;
  // LPA lives at subscription.data.esim.lpastring (the API wraps the payload in `data`).
  // Keep the legacy un-wrapped path too for safety.
  const sub = (subData as AnyRecord)?.subscription as AnyRecord | undefined;
  const lpaString = String(
    sub?.data?.esim?.lpastring || sub?.esim?.lpastring || ""
  );

  // Location: { location: { last_operator: { country, operator, event_time, rat, imei, brand, model } } }
  const lastOp = (locData as AnyRecord)?.location?.last_operator as AnyRecord | undefined;
  const deviceBrand = String(lastOp?.brand || "");
  const deviceModel = String(lastOp?.model || "");

  // SMDP profile: { smdp: { current_status, state_history: [...] }, sim: { eid, lpa, ... } }
  const smdp = (smdpData as AnyRecord)?.smdp as AnyRecord | undefined;
  const sim = (smdpData as AnyRecord)?.sim as AnyRecord | undefined;
  const currentSmdpStatus = String(smdp?.current_status || "");
  const stateHistory = (smdp?.state_history as AnyRecord[] | undefined) ?? [];
  // Newest-first timeline
  const sortedHistory = [...stateHistory].sort((a, b) => {
    const da = a.modified_at ? new Date(String(a.modified_at)).getTime() : 0;
    const db = b.modified_at ? new Date(String(b.modified_at)).getTime() : 0;
    return db - da;
  });
  // eUICC chip ID of the device the eSIM was installed on
  const eid = String(sim?.eid || smdp?.eid || "");
  // LPA activation code — subscription is primary, SIM details is fallback
  const lpa = lpaString || String(sim?.lpa || "");

  // Coverage: { coverageProfile: { countries: [{ name, iso2, operators: [{ name, supported_rats }] }] } }
  // or from all profiles: { coverageProfiles: [{ countries: [...] }] }
  const covProfile = (covData as AnyRecord)?.coverageProfile as AnyRecord | undefined;
  const covCountries = (covProfile?.countries as AnyRecord[]) ||
    ((covData as AnyRecord)?.coverageProfiles as AnyRecord[])?.[0]?.countries as AnyRecord[] || [];

  return (
    <div className="space-y-4">
      {/* Input bar */}
      <div className="flex gap-2 max-w-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter ICCID (19-20 digits starting with 89)..."
            value={iccid}
            onChange={(e) =>
              setIccid(e.target.value.replace(/\D/g, "").slice(0, 20))
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
            <Signal className="h-8 w-8 text-amethyst" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            ICCID Lookup
          </p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Enter a 19–20 digit ICCID to look up subscription status, location,
            orders, coverage, and recent data usage
          </p>
        </div>
      )}

      {/* Results grid */}
      {searched && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Subscription */}
          <LookupCard
            title="Subscription"
            icon={<Signal className="h-3.5 w-3.5 text-amethyst" />}
            loading={subLoading}
            error={subError}
            empty={!subData && !subLoading && !subError}
            badge={
              subStatus
                ? {
                    label: subStatus.charAt(0).toUpperCase() + subStatus.slice(1).toLowerCase(),
                    className: subStatusClass(subStatus),
                  }
                : null
            }
          >
            <div>
              {planName && <KVRow label="Plan" value={planName} />}
              {planCountry && <KVRow label="Country" value={
                covCountries.find((c) => String(c.iso2).toUpperCase() === planCountry.toUpperCase())?.name as string || planCountry
              } />}
              {!isNaN(usedBytes) && !isNaN(totalBytes) && (
                <>
                  <KVRow
                    label="Data Used"
                    value={`${formatBytes(usedBytes)} / ${formatBytes(totalBytes)}`}
                  />
                  {!isNaN(remainingBytes) && (
                    <KVRow label="Remaining" value={formatBytes(remainingBytes)} />
                  )}
                  {/* Progress bar */}
                  <div className="mt-1.5 h-2 w-full rounded-full bg-parchment/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        usedBytes / totalBytes > 0.9 ? "bg-fraud-red" :
                        usedBytes / totalBytes > 0.7 ? "bg-fraud-yellow" : "bg-amethyst"
                      }`}
                      style={{ width: `${Math.min((usedBytes / totalBytes) * 100, 100)}%` }}
                    />
                  </div>
                </>
              )}
              {!isNaN(usedBytes) && isNaN(totalBytes) && (
                <KVRow label="Data Used" value={formatBytes(usedBytes)} />
              )}
              {planDays > 0 && <KVRow label="Period" value={`${planDays} days`} />}
              {activationDate && (
                <KVRow label="Activated" value={activationDate.slice(0, 10)} />
              )}
              {expiryDate && (
                <KVRow label="Expires" value={expiryDate.slice(0, 10)} />
              )}
              {isThrottled && <KVRow label="Throttling" value="Enabled" />}
              {isRecurring && <KVRow label="Recurring" value="Yes" />}
            </div>
          </LookupCard>

          {/* Location */}
          <LookupCard
            title="Location"
            icon={<MapPin className="h-3.5 w-3.5 text-amethyst" />}
            loading={locLoading}
            error={locError}
            empty={!lastOp && !locLoading && !locError}
          >
            <div>
              <KVRow label="Country" value={String(lastOp?.country || "")} />
              <KVRow label="Country Code" value={String(lastOp?.country_alpha_2 || "").toUpperCase()} />
              <KVRow label="Operator" value={String(lastOp?.operator || "")} />
              <KVRow label="RAT" value={String(lastOp?.rat || "")} />
              <KVRow label="Device IMEI" value={String(lastOp?.imei || "")} />
              {(deviceBrand || deviceModel) && (
                <KVRow label="Device" value={[deviceBrand, deviceModel].filter(Boolean).join(" ")} />
              )}
              <KVRow
                label="Last Seen"
                value={lastOp?.event_time
                  ? new Date(String(lastOp.event_time)).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : ""
                }
              />
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
                // Link to the customer/order detail page (matches global search).
                // Requires a customer email to resolve the [id] route.
                const customerUrl = o.customer_email
                  ? `/customers/${encodeURIComponent(o.customer_email)}?orderNumber=${encodeURIComponent(o.order_number || o.id)}&serial=${encodeURIComponent(iccid.trim())}`
                  : null;
                const inner = (
                  <>
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
                        {o.total != null &&
                          ` · ${Number(o.total).toFixed(2)}${o.currency_iso ? ` ${o.currency_iso.toUpperCase()}` : ""}`}
                      </p>
                    </div>
                    <div className="shrink-0 ml-2 flex items-center gap-1">
                      <span className="text-[11px] font-[460] text-muted-foreground">
                        {date}
                      </span>
                      {customerUrl && (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                      )}
                    </div>
                  </>
                );
                return customerUrl ? (
                  <Link
                    key={o.id}
                    href={customerUrl}
                    className="flex items-start justify-between rounded-[8px] bg-parchment/30 px-2 py-1.5 transition-colors hover:bg-parchment/60 cursor-pointer"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div
                    key={o.id}
                    className="flex items-start justify-between rounded-[8px] bg-parchment/30 px-2 py-1.5"
                  >
                    {inner}
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
            empty={covCountries.length === 0 && !covLoading && !covError}
            badge={covCountries.length > 0 ? { label: `${covCountries.length} countries`, className: "bg-lavender/20 text-amethyst" } : null}
          >
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {covCountries.slice(0, 50).map((c, i) => {
                const operators = (c.operators as AnyRecord[]) || [];
                return (
                  <div key={i} className="flex items-baseline justify-between gap-2 py-0.5">
                    <span className="text-[12px] font-[540] text-charcoal">{String(c.name)}</span>
                    <span className="text-[10px] font-[460] text-muted-foreground text-right truncate max-w-[60%]">
                      {operators.map((op) => String(op.name)).join(", ")}
                    </span>
                  </div>
                );
              })}
              {covCountries.length > 50 && (
                <p className="text-[11px] font-[460] text-muted-foreground pt-1">
                  +{covCountries.length - 50} more countries
                </p>
              )}
            </div>
          </LookupCard>

          {/* eSIM Profile — install status, state history, device chip (EID) */}
          <LookupCard
            title="eSIM Profile"
            icon={<History className="h-3.5 w-3.5 text-amethyst" />}
            loading={smdpLoading}
            error={smdpError}
            empty={!smdp && !smdpLoading && !smdpError}
            badge={
              currentSmdpStatus || sortedHistory.length > 0
                ? (() => {
                    const lbl = getSmdpLabel(currentSmdpStatus || undefined);
                    return { label: lbl.label, className: smdpBadgeClass(lbl.severity) };
                  })()
                : null
            }
          >
            <div>
              {eid && (
                <KVRow
                  label="EID"
                  value={<span className="text-[10px] font-mono break-all">{eid}</span>}
                />
              )}
              {sortedHistory.length > 0 ? (
                <div className={eid ? "mt-2" : ""}>
                  <ProfileHistoryTimeline events={sortedHistory} collapsedLimit={4} />
                </div>
              ) : (
                <p className="text-[12px] font-[460] text-muted-foreground">
                  No profile history — eSIM not yet downloaded to a device.
                </p>
              )}
            </div>
          </LookupCard>

          {/* eSIM Activation — LPA string + QR code to share with the customer */}
          <LookupCard
            title="eSIM Activation"
            icon={<QrCode className="h-3.5 w-3.5 text-amethyst" />}
            loading={(subLoading || smdpLoading) && !lpa}
            error={null}
            empty={!lpa && !subLoading && !smdpLoading}
          >
            <LpaActivation
              lpa={lpa}
              plan={{
                brand: resolveBrandName(ordData[0]?.order_number),
                iccid: iccid.trim() || undefined,
                planName: planName || undefined,
                dataLabel: !isNaN(totalBytes) ? formatBytes(totalBytes) : undefined,
                validityLabel: planDays > 0 ? `${planDays} days` : undefined,
                countryLabel: planCountry
                  ? ((covCountries.find((c) => String(c.iso2).toUpperCase() === planCountry.toUpperCase())?.name as string) || planCountry)
                  : undefined,
                activatedOn: activationDate || undefined,
                expiresOn: expiryDate || undefined,
              }}
            />
          </LookupCard>

          {/* Data Usage (full width) — chart + table */}
          <LookupCard
            title="Data Usage"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrRows.length === 0 && !cdrLoading && !cdrError && isNaN(usedBytes)}
            badge={cdrRows.length > 0 ? {
              label: `${formatBytes(cdrRows.reduce((sum, r) => sum + Number(r.TOTAL_QTY || r.total_qty || 0), 0))} total`,
              className: "bg-lavender/20 text-amethyst",
            } : null}
            fullWidth
          >
            <IccidUsageChart data={cdrRows} fallbackUsedBytes={usedBytes} />
          </LookupCard>
        </div>
      )}
    </div>
  );
}

/** Daily usage chart + table for ICCID CDR data */
function IccidUsageChart({
  data,
  fallbackUsedBytes,
}: {
  data: AnyRecord[];
  fallbackUsedBytes?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Aggregate by day
  const dailyMap = new Map<string, { bytes: number; sessions: number; country: string }>();
  for (const row of data) {
    const dateStr = String(row.USAGE_DATE_UTC || row.ConnectTime || row.date || "");
    const day = dateStr.slice(0, 10);
    if (!day) continue;
    const bytes = Number(row.TOTAL_QTY || row.total_qty || 0);
    const country = String(row.iso2 || row.COUNTRY || row.country || "");
    const prev = dailyMap.get(day) || { bytes: 0, sessions: 0, country };
    dailyMap.set(day, { bytes: prev.bytes + bytes, sessions: prev.sessions + 1, country: country || prev.country });
  }
  const daily = Array.from(dailyMap.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (daily.length === 0) {
    if (fallbackUsedBytes != null && !isNaN(fallbackUsedBytes) && fallbackUsedBytes > 0) {
      return (
        <p className="text-[12px] font-[460] text-muted-foreground">
          TelliSIM reports{" "}
          <span className="font-[600] text-charcoal">{formatBytes(fallbackUsedBytes)}</span>{" "}
          consumed on this plan, but no per-day call records (CDRs) were found in the
          activation window. The carrier may aggregate usage without emitting daily records.
        </p>
      );
    }
    return <p className="text-[12px] font-[460] text-muted-foreground">No usage data</p>;
  }

  // Chart
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
      <div className="flex">
        <div className="flex flex-col justify-between pr-2" style={{ height: H, width: 48 }}>
          <span className="text-[10px] font-mono font-[500] text-muted-foreground text-right">{formatBytes(maxBytes)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">{formatBytes(maxBytes / 2)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">0</span>
        </div>
        <div ref={containerRef} className="flex-1 relative cursor-crosshair" style={{ height: H }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoveredIdx(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="iccidUsageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-lavender)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-lavender)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {gridYs.map((gy, i) => (
              <line key={i} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="var(--color-parchment)" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.6" />
            ))}
            <line x1={padX} y1={padT + plotH} x2={W - padX} y2={padT + plotH} stroke="var(--color-parchment)" strokeWidth="1" strokeOpacity="0.4" />
            {areaPath && <path d={areaPath} fill="url(#iccidUsageGrad)" />}
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
                  {` · ${daily[hoveredIdx].sessions} record${daily[hoveredIdx].sessions !== 1 ? "s" : ""}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* X-axis */}
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
      {/* Daily table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
              <th className="pb-2 pr-3 font-[460]">Date</th>
              <th className="pb-2 pr-3 font-[460]">Records</th>
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

/** SMDP profile state-history timeline (newest first). */
function ProfileHistoryTimeline({
  events,
  collapsedLimit,
}: {
  events: AnyRecord[];
  collapsedLimit: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = events.length > collapsedLimit;
  const visible = expanded ? events : events.slice(0, collapsedLimit);

  const iconMap = { success: CheckCircle2, info: Download, warning: WifiOff, error: XCircle };
  const colorMap = { success: "text-success", info: "text-amethyst", warning: "text-fraud-yellow", error: "text-fraud-red" };
  const bgMap = { success: "bg-success-soft", info: "bg-lavender/20", warning: "bg-fraud-yellow-soft", error: "bg-fraud-red-soft" };

  return (
    <div>
      <div className="relative ml-1">
        <div className="absolute left-[2px] top-2 bottom-2 w-px bg-parchment" />
        <div className="space-y-3.5">
          {visible.map((event, i) => {
            const label = getSmdpLabel(String(event.state || "") || undefined);
            const sev = label.severity;
            const EventIcon = iconMap[sev];
            return (
              <div key={i} className="relative flex items-start gap-3 pl-5">
                <div
                  className={`absolute left-[-6px] top-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full border-2 border-background z-10 ${bgMap[sev]}`}
                >
                  <EventIcon className={`h-2.5 w-2.5 ${colorMap[sev]}`} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-[600] text-charcoal leading-tight">{label.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-[11px] font-[460] text-muted-foreground">
                      {formatDateTime(String(event.modified_at || ""))}
                    </p>
                    {event.modification_result && (
                      <span
                        className={`rounded-full px-1.5 py-0 text-[10px] font-[500] ${
                          String(event.modification_result) === "SUCCESS"
                            ? "bg-success-soft text-success"
                            : "bg-fraud-red-soft text-fraud-red"
                        }`}
                      >
                        {String(event.modification_result)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 ml-1 text-[12px] font-[540] text-amethyst hover:text-amethyst/80 transition-colors cursor-pointer"
        >
          {expanded
            ? "Show less"
            : `Show ${events.length - collapsedLimit} more event${
                events.length - collapsedLimit !== 1 ? "s" : ""
              }`}
        </button>
      )}
    </div>
  );
}

/** LPA activation code with copy + downloadable QR for the customer to scan. */
function LpaActivation({ lpa, plan }: { lpa: string; plan?: Omit<EsimPdfOptions, "qrDataUrl" | "lpa"> }) {
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!lpa) {
    return (
      <p className="text-[12px] font-[460] text-muted-foreground">
        No LPA activation code available for this eSIM.
      </p>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const downloadPdf = async () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    setPdfBusy(true);
    try {
      const { generateEsimActivationPdf } = await import("@/lib/esim-pdf");
      await generateEsimActivationPdf({ qrDataUrl: canvas.toDataURL("image/png"), lpa, ...plan });
    } catch {
      /* generation failed — on-screen QR/LPA still usable */
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {/* QR — encodes the LPA activation string the customer scans on their phone */}
      <div ref={qrRef} className="rounded-[16px] bg-white p-3 border border-border">
        <QRCodeCanvas value={lpa} size={512} level="M" marginSize={4} style={{ width: 148, height: 148 }} />
      </div>

      <p className="flex items-center gap-1.5 text-[11px] font-[460] text-muted-foreground text-center">
        <Smartphone className="h-3.5 w-3.5 shrink-0" />
        Customer scans this from Settings → Cellular → Add eSIM
      </p>

      {/* LPA string (selectable, monospaced) */}
      <div className="w-full rounded-[8px] bg-parchment/40 px-3 py-2">
        <p className="text-[10px] font-[540] uppercase tracking-wide text-muted-foreground mb-1">
          LPA Activation Code
        </p>
        <p className="text-[11px] font-mono break-all text-charcoal select-all">{lpa}</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 w-full">
        <Button
          onClick={copy}
          className="flex-1 h-9 rounded-[8px] bg-[#e9e5dd] text-charcoal font-[540] hover:bg-[#ddd8cf] gap-1.5"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy LPA"}
        </Button>
        <Button
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="flex-1 h-9 rounded-[8px] bg-[#e9e5dd] text-charcoal font-[540] hover:bg-[#ddd8cf] gap-1.5 disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {pdfBusy ? "Generating…" : "Download PDF"}
        </Button>
      </div>
    </div>
  );
}
