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

// Loose types — TelliSIM API shapes vary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

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

  // Valid when 19-20 digits starting with "89"
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
      .then((d: AnyRecord) => setSubData(d))
      .catch((e: Error) => setSubError(e.message))
      .finally(() => setSubLoading(false));

    // 2. Location
    setLocLoading(true);
    setLocError(null);
    setLocData(null);
    fetchTelliSIM(`/api/tellisim/location/${trimmed}`)
      .then((d: AnyRecord) => setLocData(d))
      .catch((e: Error) => setLocError(e.message))
      .finally(() => setLocLoading(false));

    // 3. Orders
    setOrdLoading(true);
    setOrdError(null);
    setOrdData([]);
    fetchOS("/api/opensearch/search", { query: trimmed })
      .then((d: { results?: OrderResult[] }) => setOrdData(d.results ?? []))
      .catch((e: Error) => setOrdError(e.message))
      .finally(() => setOrdLoading(false));

    // 4. Coverage
    setCovLoading(true);
    setCovError(null);
    setCovData(null);
    fetchTelliSIM("/api/tellisim/coverage", { iccid: trimmed })
      .then((d: AnyRecord) => setCovData(d))
      .catch((e: Error) => setCovError(e.message))
      .finally(() => setCovLoading(false));

    // 5. CDR
    setCdrLoading(true);
    setCdrError(null);
    setCdrRows([]);
    fetchOS("/api/opensearch/cdr", { iccid: trimmed, size: 20 })
      .then(
        (d: AnyRecord) => {
          const records =
            d.cdr?.tellisim?.records ??
            d.cdr?.archive?.records ??
            d.tellisimCdr?.hits ??
            d.archiveCdr?.hits ??
            [];
          setCdrRows(records as AnyRecord[]);
        }
      )
      .catch((e: Error) => setCdrError(e.message))
      .finally(() => setCdrLoading(false));
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
  const lpaString = String((subData as AnyRecord)?.subscription?.esim?.lpastring || "");

  // Location: { location: { last_operator: { country, operator, event_time, rat, imei } } }
  const lastOp = (locData as AnyRecord)?.location?.last_operator as AnyRecord | undefined;

  // Coverage: { coverageProfiles: [{ countries: [{ name, iso2, operators: [{ name, supported_rats }] }] }] }
  const covProfiles = (covData as AnyRecord)?.coverageProfiles as AnyRecord[] | undefined;
  const covCountries = (covProfiles?.[0]?.countries as AnyRecord[]) || [];

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
              {lpaString && (
                <KVRow label="LPA" value={
                  <span className="text-[10px] font-mono break-all">{lpaString}</span>
                } />
              )}
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
              <KVRow label="IMEI" value={String(lastOp?.imei || "")} />
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

          {/* Recent CDR (full width) */}
          <LookupCard
            title="Recent CDR"
            icon={<Activity className="h-3.5 w-3.5 text-amethyst" />}
            loading={cdrLoading}
            error={cdrError}
            empty={cdrRows.length === 0 && !cdrLoading && !cdrError}
            fullWidth
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-parchment text-left text-muted-foreground font-[460]">
                    <th className="pb-2 pr-4 font-[460]">Date</th>
                    <th className="pb-2 pr-4 font-[460]">Usage</th>
                    <th className="pb-2 pr-4 font-[460]">Network</th>
                    <th className="pb-2 font-[460]">Country</th>
                  </tr>
                </thead>
                <tbody>
                  {cdrRows.slice(0, 20).map((row, i) => {
                    const src = (
                      row._source ? row._source : row
                    ) as AnyRecord;
                    // TelliSIM CDR fields
                    const date = String(
                      src.USAGE_DATE_UTC || src.ConnectTime || src.date || ""
                    );
                    const usage = Number(
                      src.TOTAL_QTY ?? src.total_qty ?? NaN
                    );
                    const narrative = String(src.Narrative || "");
                    const network = String(src.NETWORK || src.network || "");
                    const country = String(src.COUNTRY || src.country || "");
                    return (
                      <tr
                        key={i}
                        className="border-b border-parchment/50 text-charcoal font-[460]"
                      >
                        <td className="py-1.5 pr-4">{date.slice(0, 16)}</td>
                        <td className="py-1.5 pr-4">
                          {!isNaN(usage)
                            ? formatBytes(usage)
                            : narrative || "—"}
                        </td>
                        <td className="py-1.5 pr-4">{network || "—"}</td>
                        <td className="py-1.5">{country || "—"}</td>
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
