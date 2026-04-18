"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Mail,
  Phone,
  Calendar,
  Copy,
  Loader2,
  AlertCircle,
  Package,
  Settings,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Pause,
  ShieldBan,
  Send,
  ArrowUpRight,
  Flag,
  ChevronDown,
  ChevronUp,
  Smartphone,
  Globe,
  Wifi,
  WifiOff,
  Download,
  CreditCard,
  DollarSign,
  MapPin,
  Timer,
  TrendingUp,
  User,
  Plane,
  ShieldCheck,
  Search,
  MessageSquare,
  Radio,
  Signal,
  HelpCircle,
  Shield,
  Warehouse,
  Truck,
  Undo2,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { InternalNotes, TEAM_MEMBERS } from "@/components/ui/internal-notes";
import { CancelDialog } from "@/components/order-actions/cancel-dialog";
import { RefundDialog } from "@/components/order-actions/refund-dialog";
import { ConnectivityDialog } from "@/components/order-actions/connectivity-dialog";
import { KbSlideOver } from "@/components/kb-slide-over";
import { Input } from "@/components/ui/input";
import { fetchOS, fetchTelliSIM, getTelliSIMCredentials } from "@/lib/settings-client";
import { formatPlanDisplay, detectProductType, findPlanSku, parsePlanSku } from "@/lib/sku-parser";
import { getSapphireDeviceName } from "@/lib/sapphire-mapping";
import { getCountryName, ISO2_TO_COUNTRY } from "@/lib/countries";
import { getCountryFlag } from "@/lib/country-flags";
import { getCatalogPrice, getPlanCountries } from "@/lib/plan-catalog";
import { getSystemName } from "@/lib/system-mapping";
import { getSmdpLabel, getPlanStateLabel } from "@/lib/smdp-labels";
import { getCurrentRole, hasPermission } from "@/lib/roles";

/* ─── Types ─── */
interface Order {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  customer_phone?: string;
  status?: string;
  system?: string;
  tenant_id?: string;
  total?: number;
  currency?: string;
  currency_iso?: string;
  total_usd?: number;
  order_usd_rate_exchange?: string;
  created_at?: string | number;
  threshold_date?: number;
  delivery_address?: string;
  return_address?: string;
  warehouse?: string | string[];
  shipping_methods?: string | string[];
  shipping_methods_key?: string | string[];
  serials?: string | string[];
  product_sku?: string | string[];
  destination_country?: string;
  payment_method_title?: string;
  sales_order_id?: string;
  order_details_data?: Array<{
    product_sku?: string;
    package_sku?: string;
    trip_start?: string;
    trip_end?: string;
    qty?: number;
    quantity?: number;
    total?: number;
    return_address?: string;
    delivery_address?: string;
  }>;
  coupons?: Array<string | { code?: string; discount?: number; type?: string }>;
  tracking_information?: Array<{
    device_serial?: string | number;
    shipping_carrier?: string;
    shipping_tracking_number?: string;
    return_carrier?: string;
    return_tracking_number?: string;
    fulfillment_id?: string | number;
  }>;
  [key: string]: unknown;
}

interface PlanAttachment {
  plan_attachment_id?: string;
  state?: string;
  created_at?: string;
  activation_at?: string | null;
  expiration_at?: string | null;
  used_allowance?: { dataBytes?: number };
  plan?: {
    name?: string;
    data_mega_bytes?: number | string;
    period_days?: number;
    region_code?: string;
    label?: string;
    throttling?: boolean;
    recurring?: boolean;
  };
}

interface SmdpState {
  state?: string;
  modification_result?: string;
  modified_at?: string;
}

interface SmdpData {
  current_status?: string;
  state_history?: SmdpState[];
}

interface LocationOperator {
  country?: string;
  country_alpha_2?: string;
  operator?: string;
  rat?: string;
  imei?: string;
  event_time?: string;
  brand?: string;
  model?: string;
}

interface CoverageOperator {
  operator_name?: string;
  supported_rats?: string[];
  country?: string;
}

/* ─── Helpers ─── */
function toDate(val?: string | number | null): Date | null {
  if (!val) return null;
  // Unix timestamp (seconds) — if numeric and > 1_000_000_000 (year ~2001)
  if (typeof val === "number") {
    const d = val > 1e12 ? new Date(val) : new Date(val * 1000);
    return isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
  }
  // Numeric string (Unix timestamp)
  if (/^\d{9,13}$/.test(val)) {
    const n = parseInt(val, 10);
    const d = n > 1e12 ? new Date(n) : new Date(n * 1000);
    return isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
  }
  // ISO string or date string
  const d = new Date(val);
  return isNaN(d.getTime()) || d.getFullYear() < 2000 ? null : d;
}

function formatDate(val?: string | number | null): string {
  // Date-only strings (YYYY-MM-DD) parse as UTC midnight, which toLocaleDateString
  // can shift back a day in negative-offset timezones. Parse as local date instead.
  if (typeof val === "string") {
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const local = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return local.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
  const d = toDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(val?: string | number | null): string {
  const d = toDate(val);
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function mbToDisplay(mb?: number | string | null): string {
  if (!mb) return "—";
  const n = typeof mb === "string" ? parseInt(mb, 10) : mb;
  if (isNaN(n)) return "—";
  if (n >= 1024) return `${(n / 1024).toFixed(0)} GB`;
  return `${n} MB`;
}

function daysUntil(val?: string | number | null): number | null {
  const d = toDate(val);
  if (!d) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysUntilDisplay(dateStr?: string | null): string {
  const days = daysUntil(dateStr);
  if (days === null) return "—";
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function getSerials(order: Order): string[] {
  if (!order.serials) return [];
  if (Array.isArray(order.serials)) return order.serials;
  return [order.serials];
}

function getSkus(order: Order): string[] {
  if (!order.product_sku) return [];
  if (Array.isArray(order.product_sku)) return order.product_sku;
  return [order.product_sku];
}

function isTelliSimEsim(order: Order): boolean {
  return getSkus(order).some(s => s.toUpperCase().includes("TELLISIM"));
}

function statusColor(status?: string): string {
  if (!status) return "bg-muted text-muted-foreground";
  const s = status.toLowerCase();
  if (s.includes("completed") || s.includes("active")) return "bg-success-soft text-success";
  if (s.includes("cancel") || s.includes("refund")) return "bg-fraud-red-soft text-fraud-red";
  if (s.includes("pending") || s.includes("processing")) return "bg-fraud-yellow-soft text-fraud-yellow";
  if (s.includes("fraud")) return "bg-fraud-red-soft text-fraud-red";
  return "bg-muted text-muted-foreground";
}

function planStateInfo(state?: string) {
  switch (state) {
    case "ACTIVE":
    case "ENABLED":
      return { icon: CheckCircle2, label: "Active", color: "text-success", bg: "bg-success-soft" };
    case "EXPIRED":
      return { icon: Clock, label: "Expired", color: "text-muted-foreground", bg: "bg-muted" };
    case "PENDING_FOR_FIRST_USE":
    case "PENDING":
    case "CREATED":
    case "ASSIGNED":
      return { icon: Clock, label: "Pending Activation", color: "text-fraud-yellow", bg: "bg-fraud-yellow-soft" };
    case "SUSPENDED":
      return { icon: Pause, label: "Suspended", color: "text-fraud-red", bg: "bg-fraud-red-soft" };
    default:
      return { icon: AlertCircle, label: state || "Unknown", color: "text-muted-foreground", bg: "bg-muted" };
  }
}

function smdpStatusInfo(status?: string) {
  switch (status) {
    case "Enable":
      return { label: "Installed & Active", icon: CheckCircle2, color: "text-success", bg: "bg-success-soft" };
    case "BPP Installation":
      return { label: "Downloaded", icon: Download, color: "text-amethyst", bg: "bg-lavender/10" };
    case "Disable":
      return { label: "Disabled on Device", icon: WifiOff, color: "text-fraud-yellow", bg: "bg-fraud-yellow-soft" };
    case "Delete":
      return { label: "Deleted from Device", icon: XCircle, color: "text-fraud-red", bg: "bg-fraud-red-soft" };
    default:
      return { label: "Not Downloaded", icon: Download, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

/**
 * Match plan attachments to orders by comparing activation dates.
 * Returns plans split into "current customer" and "previous history".
 */
function matchPlansToOrders(
  plans: PlanAttachment[],
  iccidOrders: Order[],
  currentEmail?: string
): { currentPlans: (PlanAttachment & { matchedOrder?: Order })[]; previousPlans: (PlanAttachment & { matchedOrder?: Order })[] } {
  const normalEmail = (currentEmail || "").toLowerCase().trim();
  const sortedOrders = [...iccidOrders].sort((a, b) => {
    const ta = toDate(a.created_at)?.getTime() || 0;
    const tb = toDate(b.created_at)?.getTime() || 0;
    return ta - tb;
  });

  const currentPlans: (PlanAttachment & { matchedOrder?: Order })[] = [];
  const previousPlans: (PlanAttachment & { matchedOrder?: Order })[] = [];

  for (const plan of plans) {
    const planDate = toDate(plan.activation_at || plan.created_at);
    const planTime = planDate?.getTime() || 0;

    // Match: latest order whose created_at <= plan activation date
    let matched: Order | undefined;
    for (const order of sortedOrders) {
      const orderTime = toDate(order.created_at)?.getTime() || 0;
      if (orderTime <= planTime || planTime === 0) {
        matched = order;
      } else {
        break;
      }
    }

    // If no date match, try SKU match
    if (!matched && plan.plan?.name) {
      const planSku = (plan.plan.name || "").toLowerCase();
      matched = sortedOrders.find(o =>
        o.order_details_data?.some(d =>
          (d.package_sku || "").toLowerCase().includes(planSku.split(" ")[0])
        )
      );
    }

    const enriched = { ...plan, matchedOrder: matched };
    const matchedEmail = (matched?.customer_email || "").toLowerCase().trim();

    if (!matched || matchedEmail === normalEmail) {
      currentPlans.push(enriched);
    } else {
      previousPlans.push(enriched);
    }
  }

  return { currentPlans, previousPlans };
}

function getSupportHint(smdpStatus?: string, planState?: string, cdrCount?: number): string | null {
  if (smdpStatus === "Delete") return "Profile was removed from the device. Customer needs to re-download or get a new plan.";
  if (smdpStatus === "Disable") return "Profile is disabled in device settings. Ask customer to enable it in Settings > Cellular/Mobile Data.";
  if (!smdpStatus || smdpStatus === "BPP Installation") {
    if (planState === "PENDING_FOR_FIRST_USE" || planState === "PENDING" || planState === "CREATED")
      return "Plan is provisioned but not yet activated. Walk customer through the eSIM installation steps.";
  }
  if ((planState === "ACTIVE" || planState === "ENABLED") && cdrCount === 0)
    return "Plan is active but no data sessions recorded. Check if customer has data roaming enabled and correct APN settings.";
  if (planState === "EXPIRED") return "Plan has expired. Customer may need a new plan or a top-up.";
  if (planState === "SUSPENDED") return "Plan is suspended at the vendor level. Escalate to carrier operations.";
  return null;
}

function ratBadgeColor(rat?: string): string {
  if (!rat) return "bg-muted text-muted-foreground";
  const upper = rat.toUpperCase();
  if (upper.includes("5G") || upper === "NR") return "bg-success-soft text-success";
  if (upper.includes("4G") || upper === "LTE") return "bg-lavender/20 text-amethyst";
  if (upper.includes("3G") || upper === "WCDMA" || upper === "UMTS") return "bg-fraud-yellow-soft text-fraud-yellow";
  return "bg-muted text-muted-foreground";
}

function ratDisplayLabel(rat?: string): string {
  if (!rat) return "Unknown";
  const upper = rat.toUpperCase();
  if (upper === "NR" || upper.includes("5G")) return "5G";
  if (upper === "LTE" || upper.includes("4G")) return "4G LTE";
  if (upper === "WCDMA" || upper === "UMTS" || upper.includes("3G")) return "3G";
  return rat;
}

function findIso2ByCountryName(name: string): string | null {
  const lower = name.toLowerCase().trim();
  for (const [code, cname] of Object.entries(ISO2_TO_COUNTRY)) {
    if (cname.toLowerCase() === lower || code.toLowerCase() === lower) return code;
  }
  // Partial match
  for (const [code, cname] of Object.entries(ISO2_TO_COUNTRY)) {
    if (cname.toLowerCase().includes(lower)) return code;
  }
  return null;
}

/* ─── Profile History Timeline (collapsible) ─── */
function ProfileHistoryTimeline({ events, collapsedLimit }: { events: SmdpState[]; collapsedLimit: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = events.length > collapsedLimit;
  const visible = expanded ? events : events.slice(0, collapsedLimit);

  return (
    <>
      <div className="relative ml-4">
        <div className="absolute left-0 top-2 bottom-2 w-px bg-parchment" />
        <div className="space-y-5">
          {visible.map((event, i) => {
            const label = getSmdpLabel(event.state);
            const iconMap: Record<string, typeof CheckCircle2> = { success: CheckCircle2, info: Download, warning: WifiOff, error: XCircle };
            const colorMap: Record<string, string> = { success: "text-success", info: "text-amethyst", warning: "text-fraud-yellow", error: "text-fraud-red" };
            const bgMap: Record<string, string> = { success: "bg-success-soft", info: "bg-lavender/10", warning: "bg-fraud-yellow-soft", error: "bg-fraud-red-soft" };
            const EventIcon = iconMap[label.severity];
            return (
              <div key={i} className="relative flex items-start gap-4 pl-6">
                <div className={cn(
                  "absolute left-[-8px] top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-background z-10",
                  bgMap[label.severity]
                )}>
                  <EventIcon className={cn("h-2.5 w-2.5", colorMap[label.severity])} strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-[600] text-foreground leading-tight">{label.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[12px] font-[460] text-muted-foreground">{formatDateTime(event.modified_at)}</p>
                    {event.modification_result && (
                      <Badge className={cn("rounded-[8px] text-[10px] font-[500] border-0 px-1.5 py-0",
                        event.modification_result === "SUCCESS" ? "bg-success-soft text-success" : "bg-fraud-red-soft text-fraud-red"
                      )}>
                        {event.modification_result}
                      </Badge>
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
          className="flex items-center gap-1.5 mt-4 ml-4 text-[12px] font-[540] text-amethyst hover:text-amethyst/80 transition-colors cursor-pointer"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
              Show {events.length - collapsedLimit} more event{events.length - collapsedLimit !== 1 ? "s" : ""}
            </>
          )}
        </button>
      )}
    </>
  );
}

/* ─── Main Page ─── */
export default function CustomerProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const customerEmail = decodeURIComponent(params.id as string);
  const targetOrderNumber = searchParams.get("orderNumber");
  const targetSerial = searchParams.get("serial");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customer, setCustomer] = useState<{ firstName?: string; lastName?: string; email?: string } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [planAttachments, setPlanAttachments] = useState<PlanAttachment[]>([]);
  const [smdpData, setSmdpData] = useState<SmdpData | null>(null);
  const [cdrRecords, setCdrRecords] = useState<Array<Record<string, unknown>>>([]);
  const [cdrTotal, setCdrTotal] = useState(0);
  const [cdrError, setCdrError] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [fetchSteps, setFetchSteps] = useState<Array<{ label: string; status: "pending" | "loading" | "done" | "error"; error?: string; durationMs?: number }>>([]);
  const fetchStepsRef = useRef<typeof fetchSteps>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "custom">("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // TelliSIM location data
  const [locationData, setLocationData] = useState<LocationOperator | null>(null);
  const [iccidOrders, setIccidOrders] = useState<Order[]>([]);

  // UCL device binding info (Sapphire/Rental only) — populated when IMEI button clicked
  const [deviceInfo, setDeviceInfo] = useState<Record<string, unknown> | null>(null);
  const [deviceInfoError, setDeviceInfoError] = useState<string | null>(null);
  const [userOffers, setUserOffers] = useState<Array<Record<string, unknown>>>([]);

  // UCL terminal real-time status (online, MCC/MNC, RAT, signal) — on-demand via sync button
  const [terminalStatus, setTerminalStatus] = useState<Record<string, unknown> | null>(null);
  const [terminalStatusLoading, setTerminalStatusLoading] = useState(false);
  const [terminalStatusError, setTerminalStatusError] = useState<string | null>(null);
  const [terminalStatusCachedAt, setTerminalStatusCachedAt] = useState<number | null>(null);

  // Service data cache — 15 min TTL so agents don't re-fetch on every IMEI click
  const serviceCacheRef = useRef<Record<string, {
    ts: number;
    cdrRecords: Array<Record<string, unknown>>;
    cdrTotal: number;
    cdrError?: string | null;
    deviceInfo: Record<string, unknown> | null;
    deviceInfoError: string | null;
    userOffers: Array<Record<string, unknown>>;
    planAttachments: PlanAttachment[];
    smdpData: SmdpData | null;
    locationData: LocationOperator | null;
    iccidOrders: Order[];
    terminalStatus: Record<string, unknown> | null;
    terminalStatusCachedAt: number | null;
  }>>({});
  const [serviceCachedAt, setServiceCachedAt] = useState<number | null>(null);

  // Coverage lookup state
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageQuery, setCoverageQuery] = useState("");
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageResults, setCoverageResults] = useState<CoverageOperator[]>([]);
  const [coverageError, setCoverageError] = useState<string | null>(null);

  // eSIM KB slide-over
  const [esimKbOpen, setEsimKbOpen] = useState(false);

  // Suspend plan state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendConfirmIccid, setSuspendConfirmIccid] = useState("");
  const [suspendLoading, setSuspendLoading] = useState(false);
  const [suspendError, setSuspendError] = useState<string | null>(null);
  const [suspendSuccess, setSuspendSuccess] = useState(false);

  // Send SMS state
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsFrom, setSmsFrom] = useState("TravelWifi");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [smsSuccess, setSmsSuccess] = useState(false);

  // Action dialogs state
  const [actionsInfoOpen, setActionsInfoOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [connectivityDialogOpen, setConnectivityDialogOpen] = useState(false);
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [escalateNote, setEscalateNote] = useState("");
  const [escalateLoading, setEscalateLoading] = useState(false);
  const [fraudDialogOpen, setFraudDialogOpen] = useState(false);
  const [fraudNote, setFraudNote] = useState("");
  const [fraudLoading, setFraudLoading] = useState(false);

  const role = typeof window !== "undefined" ? getCurrentRole() : "agent";

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchOS("/api/opensearch/customer", { email: customerEmail });
        if (data.ok) {
          const loadedOrders: Order[] = data.orders || [];
          setOrders(loadedOrders);
          setCustomer(data.customer);
          if (loadedOrders.length > 0) {
            // Auto-select the order matching URL param, or fall back to most recent
            let target = loadedOrders[0];
            if (targetOrderNumber) {
              const match = loadedOrders.find(
                (o) => o.order_number === targetOrderNumber || o.id === targetOrderNumber
              );
              if (match) target = match;
            }
            setSelectedOrder(target);
          }
        } else {
          setError(data.error || "Failed to load orders");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerEmail, targetOrderNumber]);

  // Auto-select serial from URL param after order loads (eSIM ICCID from search)
  const autoSerialTriggered = useRef(false);
  useEffect(() => {
    if (autoSerialTriggered.current || !targetSerial || !selectedOrder || loading) return;
    const serials = getSerials(selectedOrder);
    if (serials.includes(targetSerial)) {
      autoSerialTriggered.current = true;
      loadServiceData(targetSerial);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSerial, selectedOrder, loading]);

  const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  const loadServiceData = useCallback(async (serial: string, forceRefresh = false) => {
    setSelectedSerial(serial);

    // Check cache (keyed by serial + dateRange)
    const cacheKey = `${serial}__${dateRange}`;
    const cached = serviceCacheRef.current[cacheKey];
    if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setCdrRecords(cached.cdrRecords);
      setCdrTotal(cached.cdrTotal);
      setCdrError(cached.cdrError || null);
      setDeviceInfo(cached.deviceInfo);
      setDeviceInfoError(cached.deviceInfoError);
      setUserOffers(cached.userOffers);
      setPlanAttachments(cached.planAttachments);
      setSmdpData(cached.smdpData);
      setLocationData(cached.locationData);
      setIccidOrders(cached.iccidOrders);
      setTerminalStatus(cached.terminalStatus);
      setTerminalStatusCachedAt(cached.terminalStatusCachedAt);
      setTerminalStatusError(null);
      setServiceCachedAt(cached.ts);
      setServiceLoading(false);
      setFetchSteps([]);
      return;
    }

    setServiceLoading(true);
    setServiceError(null);
    setPlanAttachments([]);
    setSmdpData(null);
    setCdrRecords([]);
    setCdrTotal(0);
    setCdrError(null);
    setLocationData(null);
    setTerminalStatus(null);
    setTerminalStatusCachedAt(null);
    setTerminalStatusError(null);
    setIccidOrders([]);
    setDeviceInfo(null);
    setDeviceInfoError(null);
    setUserOffers([]);
    setServiceCachedAt(null);

    let now: Date;
    let from: Date;
    if (dateRange === "custom" && customFrom && customTo) {
      from = new Date(customFrom);
      now = new Date(customTo);
      now.setHours(23, 59, 59);
    } else {
      now = new Date();
      from = new Date(now);
      from.setDate(from.getDate() - parseInt(dateRange));
    }

    const skus = selectedOrder ? getSkus(selectedOrder) : [];
    const pkgSkus = selectedOrder?.order_details_data?.map((d) => d.package_sku || "").filter(Boolean) || [];
    const productType = detectProductType(skus, pkgSkus);

    // Rentals: CDR fetch must cover the trip window, not the UI's last-30-days default —
    // a trip older than 30 days would otherwise return zero records.
    if (productType === "rental" && dateRange !== "custom") {
      const tripLine = selectedOrder?.order_details_data?.find((d) => d.trip_start || d.trip_end);
      const ts = tripLine?.trip_start ? new Date(tripLine.trip_start) : null;
      const te = tripLine?.trip_end ? new Date(tripLine.trip_end) : null;
      if (ts && te && !isNaN(ts.getTime()) && !isNaN(te.getTime())) {
        from = new Date(ts.getTime() - 86_400_000);           // 1-day buffer before trip
        now = new Date(te.getTime() + 86_400_000 - 1);        // full end day + small buffer
      }
    }
    const isTelliSim = selectedOrder ? isTelliSimEsim(selectedOrder) : false;
    const isDevice = productType === "sapphire" || productType === "rental";

    // Initialize fetch step tracking
    const mkStep = (label: string) => ({ label, status: "pending" as const, error: undefined as string | undefined, durationMs: undefined as number | undefined });
    const steps = isDevice
      ? [mkStep("CDR Records"), mkStep("UCL Device Info"), mkStep("UCL Terminal Status")]
      : [
          mkStep("Subscription & Plans"), mkStep("SMDP Profile"), mkStep("CDR Records"),
          ...(isTelliSim ? [mkStep("Location")] : []),
          mkStep("ICCID Order History"),
        ];
    fetchStepsRef.current = steps;
    setFetchSteps([...steps]);

    const track = (idx: number, p: Promise<unknown>) => {
      fetchStepsRef.current[idx] = { ...fetchStepsRef.current[idx], status: "loading" };
      setFetchSteps([...fetchStepsRef.current]);
      const t0 = Date.now();
      return p.then(
        (v) => { fetchStepsRef.current[idx] = { ...fetchStepsRef.current[idx], status: "done", durationMs: Date.now() - t0 }; setFetchSteps([...fetchStepsRef.current]); return v; },
        (e) => { fetchStepsRef.current[idx] = { ...fetchStepsRef.current[idx], status: "error", error: e?.message || "Failed", durationMs: Date.now() - t0 }; setFetchSteps([...fetchStepsRef.current]); throw e; }
      );
    };

    // Collect into locals so we can cache + setState in one pass
    const out = {
      cdrRecords: [] as Array<Record<string, unknown>>,
      cdrTotal: 0,
      cdrError: null as string | null,
      deviceInfo: null as Record<string, unknown> | null,
      deviceInfoError: null as string | null,
      userOffers: [] as Array<Record<string, unknown>>,
      planAttachments: [] as PlanAttachment[],
      smdpData: null as SmdpData | null,
      locationData: null as LocationOperator | null,
      iccidOrders: [] as Order[],
      terminalStatus: null as Record<string, unknown> | null,
      terminalStatusCachedAt: null as number | null,
    };

    try {
      if (isDevice) {
        const results = await Promise.allSettled([
          track(0, fetchOS("/api/opensearch/cdr", {
            imei: serial,
            from: from.toISOString(),
            to: now.toISOString(),
            size: 500,
          })),
          track(1, fetch("/api/ucl/device-info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imei: serial, orgUsername: selectedOrder?.system || undefined }),
          }).then((r) => r.json())),
          track(2, fetch("/api/ucl/terminal-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imei: serial, orgUsername: selectedOrder?.system || undefined }),
          }).then((r) => r.json())),
        ]);

        const [cdrRes, deviceRes, terminalRes] = results as PromiseSettledResult<Record<string, unknown>>[];
        if (cdrRes.status === "fulfilled" && cdrRes.value.ok) {
          const cdr = cdrRes.value.cdr as Record<string, unknown> | undefined;
          const ucl = cdr?.ucl as { records?: Record<string, unknown>[]; total?: number; error?: string } | undefined;
          const daily = cdr?.dailyConsumption as { records?: Record<string, unknown>[]; total?: number; error?: string } | undefined;
          out.cdrRecords = ucl?.records || daily?.records || [];
          out.cdrTotal = ucl?.total || daily?.total || 0;
          const srcError = ucl?.error || daily?.error;
          if (out.cdrRecords.length === 0 && srcError) out.cdrError = srcError;
        }
        if (deviceRes.status === "fulfilled") {
          const val = deviceRes.value as {
            ok?: boolean;
            binding?: Record<string, unknown>;
            offers?: Array<Record<string, unknown>>;
            error?: string;
          };
          if (val.ok) {
            out.deviceInfo = val.binding || null;
            out.userOffers = val.offers || [];
          } else {
            out.deviceInfoError = val.error || "UCL lookup unavailable";
          }
        } else {
          out.deviceInfoError = "Network error contacting UCL";
        }
        // Terminal real-time status (online, MCC/MNC, RAT, signal)
        if (terminalRes?.status === "fulfilled") {
          const tVal = terminalRes.value as { ok?: boolean; terminal?: Record<string, unknown> };
          if (tVal.ok && tVal.terminal) {
            out.terminalStatus = tVal.terminal;
            out.terminalStatusCachedAt = Date.now();
          }
        }
      } else {
        const promises: Promise<unknown>[] = [
          track(0, fetchTelliSIM(`/api/tellisim/subscription/${serial}`, {})),
          track(1, fetchTelliSIM(`/api/tellisim/smdp/${serial}`, {})),
          track(2, fetchOS("/api/opensearch/cdr", {
            iccid: serial,
            productSku: skus.find(s => s.toUpperCase().includes("ESIM")) || "",
            from: from.toISOString(),
            to: now.toISOString(),
            size: 500,
          })),
        ];

        if (isTelliSim) {
          promises.push(track(3, fetchTelliSIM(`/api/tellisim/location/${serial}`, {})));
        }
        const iccidStepIdx = isTelliSim ? 4 : 3;
        promises.push(track(iccidStepIdx, fetchOS("/api/opensearch/orders-by-iccid", { iccid: serial })));

        const results = await Promise.allSettled(promises);

        const [planRes, smdpRes, cdrRes] = results as PromiseSettledResult<{ ok?: boolean; planAttachments?: { data?: PlanAttachment[] } | PlanAttachment[]; smdp?: SmdpData; cdr?: { tellisim?: { records?: Record<string, unknown>[]; total?: number } } }>[];

        if (planRes.status === "fulfilled" && planRes.value.ok) {
          const att = (planRes.value.planAttachments as { data?: PlanAttachment[] })?.data || planRes.value.planAttachments || [];
          out.planAttachments = Array.isArray(att) ? att : [];
        }
        if (smdpRes.status === "fulfilled" && smdpRes.value.ok) out.smdpData = smdpRes.value.smdp || null;
        if (cdrRes.status === "fulfilled") {
          const cdrVal = cdrRes.value as Record<string, unknown>;
          if (cdrVal.ok) {
            const cdr = cdrVal.cdr as Record<string, unknown> | undefined;
            const tellisim = cdr?.tellisim as { records?: Record<string, unknown>[]; total?: number; error?: string } | undefined;
            const archive = cdr?.archive as { records?: Record<string, unknown>[]; total?: number; error?: string } | undefined;
            out.cdrRecords = tellisim?.records || archive?.records || [];
            out.cdrTotal = tellisim?.total || archive?.total || 0;
            // Surface CDR source errors so the UI can show "not available" instead of empty
            const srcError = tellisim?.error || archive?.error;
            if (out.cdrRecords.length === 0 && srcError) out.cdrError = srcError;
          }
        }

        if (isTelliSim && results[3]) {
          const locRes = results[3] as PromiseSettledResult<{ ok?: boolean; location?: { last_operator?: LocationOperator; error?: boolean } }>;
          if (locRes.status === "fulfilled" && locRes.value.ok) {
            out.locationData = locRes.value.location?.last_operator || null;
          }
        }

        const iccidIdx = isTelliSim ? 4 : 3;
        if (results[iccidIdx]) {
          const iccidRes = results[iccidIdx] as PromiseSettledResult<{ ok?: boolean; orders?: Order[] }>;
          if (iccidRes.status === "fulfilled" && iccidRes.value.ok) {
            out.iccidOrders = iccidRes.value.orders || [];
          }
        }
      }
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Failed to load service data");
    } finally {
      // Apply results + populate cache
      setCdrRecords(out.cdrRecords);
      setCdrTotal(out.cdrTotal);
      setCdrError(out.cdrError);
      setDeviceInfo(out.deviceInfo);
      setDeviceInfoError(out.deviceInfoError);
      setUserOffers(out.userOffers);
      setPlanAttachments(out.planAttachments);
      setSmdpData(out.smdpData);
      setLocationData(out.locationData);
      setIccidOrders(out.iccidOrders);
      setTerminalStatus(out.terminalStatus);
      setTerminalStatusCachedAt(out.terminalStatusCachedAt);
      const nowTs = Date.now();
      serviceCacheRef.current[cacheKey] = { ts: nowTs, ...out };
      setServiceCachedAt(nowTs);
      setServiceLoading(false);
    }
  }, [dateRange, selectedOrder]);

  useEffect(() => { if (selectedSerial) loadServiceData(selectedSerial, true); }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  /** On-demand refresh of terminal real-time status (Sync button). Updates cache too. */
  const refreshTerminalStatus = useCallback(async (serial: string) => {
    setTerminalStatusLoading(true);
    setTerminalStatusError(null);
    try {
      const res = await fetch("/api/ucl/terminal-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: serial, orgUsername: selectedOrder?.system || undefined }),
      });
      const data = await res.json();
      if (data.ok && data.terminal) {
        const ts = Date.now();
        setTerminalStatus(data.terminal);
        setTerminalStatusCachedAt(ts);
        // Update the service cache entry too
        const cacheKey = `${serial}__${dateRange}`;
        const cached = serviceCacheRef.current[cacheKey];
        if (cached) {
          cached.terminalStatus = data.terminal;
          cached.terminalStatusCachedAt = ts;
        }
      } else {
        setTerminalStatusError(data.error || "Terminal status unavailable");
      }
    } catch {
      setTerminalStatusError("Network error fetching terminal status");
    } finally {
      setTerminalStatusLoading(false);
    }
  }, [selectedOrder, dateRange]);

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  async function handleCoverageLookup() {
    const iso2 = findIso2ByCountryName(coverageQuery);
    if (!iso2) {
      setCoverageError(`Could not find country code for "${coverageQuery}"`);
      return;
    }
    setCoverageLoading(true);
    setCoverageError(null);
    setCoverageResults([]);
    try {
      const data = await fetchTelliSIM(`/api/tellisim/operators?iso2Codes=${iso2}`, {});
      if (data.ok) {
        setCoverageResults(data.operators || []);
      } else {
        setCoverageError(data.error || "Failed to fetch coverage data");
      }
    } catch (err) {
      setCoverageError(err instanceof Error ? err.message : "Failed to fetch coverage");
    } finally {
      setCoverageLoading(false);
    }
  }

  async function handleSuspendPlan() {
    if (!selectedSerial || !currentPlan?.plan_attachment_id) return;
    setSuspendLoading(true);
    setSuspendError(null);
    try {
      const creds = getTelliSIMCredentials();
      await fetchTelliSIM(`/api/tellisim/suspend/${selectedSerial}/${currentPlan.plan_attachment_id}`, {
        credentials: creds,
        role,
      });
      setSuspendSuccess(true);
      setSuspendDialogOpen(false);
      setSuspendConfirmIccid("");
      // Reload service data (force refresh after action)
      if (selectedSerial) loadServiceData(selectedSerial, true);
    } catch (err) {
      setSuspendError(err instanceof Error ? err.message : "Failed to suspend plan");
    } finally {
      setSuspendLoading(false);
    }
  }

  async function handleSendSms() {
    if (!selectedSerial) return;
    setSmsLoading(true);
    setSmsError(null);
    try {
      const creds = getTelliSIMCredentials();
      await fetchTelliSIM(`/api/tellisim/send-sms/${selectedSerial}`, {
        credentials: creds,
        role,
        from: smsFrom,
        message: smsMessage,
      });
      setSmsSuccess(true);
      setSmsMessage("");
      setTimeout(() => {
        setSmsDialogOpen(false);
        setSmsSuccess(false);
      }, 1500);
    } catch (err) {
      setSmsError(err instanceof Error ? err.message : "Failed to send SMS");
    } finally {
      setSmsLoading(false);
    }
  }

  async function handleEscalate() {
    if (!escalateNote.trim()) return;
    setEscalateLoading(true);
    try {
      const currentEmail = typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : "";
      const currentUser = TEAM_MEMBERS.find((m) => m.email === currentEmail) || TEAM_MEMBERS[0];
      const customerFullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail;

      // Create escalation record in the queue
      await fetch("/api/escalations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder?.id || customerEmail,
          orderNumber: selectedOrder?.order_number || selectedOrder?.id || "N/A",
          customerName: customerFullName,
          customerEmail: customerEmail,
          escalatedBy: currentUser.name,
          escalatedById: currentEmail,
          reason: escalateNote,
        }),
      });

      // Create internal note on the customer page for visibility
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerEmail,
          authorId: currentUser.id,
          authorName: currentUser.name,
          body: `[Escalated] Order ${selectedOrder?.order_number || selectedOrder?.id || "N/A"}: ${escalateNote}`,
          mentions: [],
        }),
      });

      // Also send notification to supervisors/admins as a heads-up
      const supervisors = TEAM_MEMBERS.filter((m) => m.role === "admin" || m.role === "manager");
      for (const sup of supervisors) {
        if (sup.email === currentEmail) continue;
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: sup.email,
            type: "escalation",
            title: `Escalation: ${customerFullName}`,
            message: escalateNote,
            link: `/escalations`,
            sourceType: "escalation",
            sourceId: selectedOrder?.id || customerEmail,
            actorId: currentEmail,
            actorName: currentUser.name,
          }),
        });
      }
      setEscalateNote("");
      setEscalateDialogOpen(false);
    } catch {
      // silent — notification is best-effort
    } finally {
      setEscalateLoading(false);
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-lavender" />
        <span className="ml-3 text-[14px] font-[460] text-muted-foreground">Loading customer data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertCircle className="h-6 w-6 text-fraud-red" strokeWidth={1.8} />
        <span className="text-[14px] font-[600] text-fraud-red">{error}</span>
        {error.includes("not configured") && (
          <a href="/settings" className="text-[13px] font-[460] text-amethyst hover:underline">Go to Settings</a>
        )}
      </div>
    );
  }

  const packageSkus = selectedOrder?.order_details_data?.map((d) => d.package_sku || "").filter(Boolean) || [];
  const productType = selectedOrder ? detectProductType(getSkus(selectedOrder), packageSkus) : "unknown";
  const productLabel =
    productType === "esim" ? "eSIM"
    : productType === "rental" ? "Rental"
    : productType === "sapphire" ? "Sapphire Data Plan"
    : "Order";
  const planSku = selectedOrder ? findPlanSku(getSkus(selectedOrder)) : null;
  const serials = selectedOrder ? getSerials(selectedOrder) : [];
  const dailyUsage = aggregateDailyUsage(cdrRecords, dateRange === "custom" ? 30 : parseInt(dateRange), dateRange === "custom" ? customFrom : undefined, dateRange === "custom" ? customTo : undefined);
  const currentPlan = planAttachments.find((p) => p.state === "ACTIVE" || p.state === "ENABLED") || planAttachments[0];
  const planDataMb = currentPlan?.plan?.data_mega_bytes;
  const planDataBytes = planDataMb ? (typeof planDataMb === "string" ? parseInt(planDataMb) : planDataMb) * 1_048_576 : 0;
  const usedBytes = currentPlan?.used_allowance?.dataBytes || 0;
  const usagePct = planDataBytes > 0 ? Math.min((usedBytes / planDataBytes) * 100, 100) : 0;
  const remainingBytes = Math.max(planDataBytes - usedBytes, 0);
  // Derive device info from CDR as fallback when location API returns null
  const cdrImei = cdrRecords.length > 0 ? (cdrRecords[0]["IMEI"] as string || "") : "";
  const cdrCountry = cdrRecords.length > 0 ? (cdrRecords[0]["iso2"] as string || "") : "";
  const cdrLastDate = cdrRecords.length > 0 ? (cdrRecords[0]["USAGE_DATE_UTC"] as string || "") : "";

  // Override SMDP status if CDR proves usage exists but SMDP returned nothing
  const effectiveSmdpStatus = (!smdpData?.current_status && cdrTotal > 0) ? "Enable" : smdpData?.current_status;

  const supportHint = getSupportHint(effectiveSmdpStatus, currentPlan?.state, cdrTotal);
  const fullName = selectedOrder?.customer_name || [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || "Unknown Customer";
  const customerPhone = (selectedOrder?.customer_phone as string) || "";
  const currencyCode = (selectedOrder?.currency_iso as string) || (selectedOrder?.currency as string) || "USD";
  const orderDetails = selectedOrder?.order_details_data || [];
  // Find the primary rental/plan line (first item with trip dates)
  const primaryLine = orderDetails.find((d) => d.trip_start || d.trip_end) || orderDetails[0];
  const tripStart = primaryLine?.trip_start;
  const tripEnd = primaryLine?.trip_end;
  const packageSku = primaryLine?.package_sku;
  // Live plan name from Tellisim (per-serial truth, only populated for eSIM after serial click)
  const livePlanName = currentPlan?.plan?.name;
  // Insurance is a per-day add-on: qty = number of rental days covered
  const insuranceLine = orderDetails.find(
    (d) => (d.product_sku || "").toUpperCase() === "INSURANCE"
  );
  // Total rental days (inclusive of trip_start): 04-29 → 05-09 = 11 days
  const totalRentalDays = (() => {
    if (!tripStart || !tripEnd) return null;
    const s = toDate(tripStart);
    const e = toDate(tripEnd);
    if (!s || !e) return null;
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
    return diff >= 0 ? diff + 1 : null;
  })();
  // Warehouse, shipping, addresses (rental-specific)
  const asList = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]).filter(Boolean)
    : typeof v === "string" && v ? [v]
    : [];
  const warehouses = asList(selectedOrder?.warehouse);
  const shippingMethods = asList(selectedOrder?.shipping_methods);
  const shippingKeys = asList(selectedOrder?.shipping_methods_key);
  // Classify: pickup vs ship (postal service or courier)
  const shippingMode: "pickup" | "ship" | null =
    shippingKeys.some((k) => /pickup/i.test(k)) || shippingMethods.some((m) => /pickup/i.test(m))
      ? "pickup"
      : shippingMethods.length > 0 || shippingKeys.length > 0
      ? "ship"
      : null;
  const returnAddress =
    (selectedOrder as unknown as { return_address?: string })?.return_address ||
    primaryLine?.return_address ||
    "";
  const deliveryAddress =
    selectedOrder?.delivery_address || primaryLine?.delivery_address || "";
  // Fulfillment state: rental with no serial + pre-fulfillment status
  const isAwaitingFulfillment =
    productType === "rental"
    && serials.length === 0
    && /wait|pending|fulfill|new|processing/i.test(selectedOrder?.status || "");
  const thresholdDate = selectedOrder?.threshold_date;
  const isTelliSim = selectedOrder ? isTelliSimEsim(selectedOrder) : false;
  const hasActivePlan = currentPlan && (currentPlan.state === "ACTIVE" || currentPlan.state === "ENABLED");

  return (
    <div className="space-y-6">

      {/* ─── 1. CUSTOMER HEADER — Large, prominent, all key info visible ─── */}
      <Card className="rounded-[16px] border-lavender/20">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lavender">
              <span className="text-[18px] font-[700] text-mysteria">
                {(customer?.firstName?.[0] || "?").toUpperCase()}{(customer?.lastName?.[0] || "").toUpperCase()}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-[24px] font-[540] text-foreground">{fullName}</h1>

              {/* Contact row */}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <button onClick={() => copy(customerEmail, "email")}
                  className="flex items-center gap-1.5 text-[14px] font-[460] text-amethyst hover:underline cursor-pointer">
                  <Mail className="h-4 w-4" strokeWidth={1.8} />
                  {customerEmail}
                  {copiedField === "email" ? (
                    <span className="text-[11px] font-[600] text-success ml-1">Copied!</span>
                  ) : (
                    <Copy className="h-3 w-3 opacity-40" strokeWidth={1.8} />
                  )}
                </button>
                {customerPhone && (
                  <button onClick={() => copy(customerPhone, "phone")}
                    className="flex items-center gap-1.5 text-[14px] font-[460] text-muted-foreground hover:text-foreground cursor-pointer">
                    <Phone className="h-4 w-4" strokeWidth={1.8} />
                    {customerPhone.trim()}
                    {copiedField === "phone" ? (
                      <span className="text-[11px] font-[600] text-success ml-1">Copied!</span>
                    ) : (
                      <Copy className="h-3 w-3 opacity-40" strokeWidth={1.8} />
                    )}
                  </button>
                )}
                {orders.length > 0 && (
                  <button onClick={() => setShowAllOrders(true)}
                    className="text-[13px] font-[600] text-amethyst flex items-center gap-1 hover:underline cursor-pointer">
                    <User className="h-3.5 w-3.5" strokeWidth={1.8} />
                    {orders.length} order record{orders.length !== 1 ? "s" : ""} found
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Order Selector ─── */}
      {orders.length > 1 && (
        <button onClick={() => setShowAllOrders(!showAllOrders)}
          className="flex items-center gap-2 text-[13px] font-[600] text-amethyst hover:underline cursor-pointer">
          {showAllOrders ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAllOrders ? "Hide" : "Show"} all {orders.length} orders
        </button>
      )}
      {showAllOrders && orders.length > 1 && (
        <div className="grid gap-2">
          {orders.map((o) => (
            <button key={o.id}
              onClick={() => { setSelectedOrder(o); setSelectedSerial(null); setShowAllOrders(false); }}
              className={cn(
                "flex items-center justify-between rounded-[8px] border px-4 py-3 text-left transition-all cursor-pointer",
                selectedOrder?.id === o.id ? "border-lavender bg-lavender/5" : "border-border hover:border-muted-foreground/30"
              )}>
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-[600] text-foreground font-mono">{o.order_number || o.id}</span>
                <Badge className={cn("rounded-[8px] text-[11px] font-[500] border-0", statusColor(o.status))}>{o.status || "Unknown"}</Badge>
              </div>
              <span className="text-[12px] font-[460] text-muted-foreground">{formatDate(o.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {/* ─── 2. ORDER DETAILS — Clear, scannable, all payment info ─── */}
      {selectedOrder && (
        <Card className="rounded-[16px]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                  <button onClick={() => copy(selectedOrder.order_number || selectedOrder.id, "order")}
                    className="flex items-center gap-2 cursor-pointer group">
                    <CardTitle className="text-[15px] font-[600] text-foreground">
                      {selectedOrder.order_number || selectedOrder.id}
                    </CardTitle>
                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.8} />
                    {copiedField === "order" && <span className="text-[11px] font-[500] text-success">Copied!</span>}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5 ml-7">
                  <Badge className={cn("rounded-[8px] text-[11px] font-[700] border-0 px-2.5 py-0.5", {
                    "bg-lavender/20 text-amethyst": productType === "esim",
                    "bg-success-soft text-success": productType === "rental",
                    "bg-fraud-yellow-soft text-fraud-yellow": productType === "sapphire",
                    "bg-muted text-muted-foreground": productType === "unknown",
                  })}>
                    {productLabel}
                  </Badge>
                  <Badge className={cn("rounded-[8px] text-[11px] font-[600] border-0 px-2.5 py-0.5", statusColor(selectedOrder.status))}>
                    {selectedOrder.status || "Unknown"}
                  </Badge>
                  <span className="text-[11px] font-[460] text-muted-foreground">{getSystemName(selectedOrder.system)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {productType === "esim" && (
                  <>
                    <Button size="sm" title="eSIM support knowledge base" onClick={() => setEsimKbOpen(true)} className="h-7 rounded-[8px] bg-lavender/20 text-amethyst text-[11px] font-[600] hover:bg-lavender/30 cursor-pointer px-2">
                      <BookOpen className="h-3 w-3" strokeWidth={2} /> eSIM KB
                    </Button>
                    <Button size="sm" title="Disable eSIM profile temporarily (TelliSIM)" className="h-7 rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow text-[11px] font-[600] hover:bg-fraud-yellow/20 cursor-pointer px-2 opacity-50" disabled>
                      <Pause className="h-3 w-3" strokeWidth={2} /> Pause
                    </Button>
                    <Button size="sm" title="Permanently block this SIM (TelliSIM)" className="h-7 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] hover:bg-fraud-red/20 cursor-pointer px-2 opacity-50" disabled>
                      <ShieldBan className="h-3 w-3" strokeWidth={2} /> Block
                    </Button>
                    <Button size="sm" title="Resend eSIM QR code to customer (TelliSIM)" className="h-7 rounded-[8px] bg-cream text-charcoal text-[11px] font-[600] hover:bg-cream-hover cursor-pointer px-2 opacity-50" disabled>
                      <Send className="h-3 w-3" strokeWidth={2} /> Resend
                    </Button>
                    <Button size="sm" onClick={() => setConnectivityDialogOpen(true)} className="h-7 rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow text-[11px] font-[600] hover:bg-fraud-yellow/20 cursor-pointer px-2">
                      <Signal className="h-3 w-3" strokeWidth={2} /> Connectivity
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => setCancelDialogOpen(true)} className="h-7 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] hover:bg-fraud-red/20 cursor-pointer px-2">
                  <XCircle className="h-3 w-3" strokeWidth={2} /> Cancel
                </Button>
                <Button size="sm" onClick={() => setRefundDialogOpen(true)} className="h-7 rounded-[8px] bg-lavender/20 text-amethyst text-[11px] font-[600] hover:bg-lavender/30 cursor-pointer px-2">
                  <DollarSign className="h-3 w-3" strokeWidth={2} /> Refund
                </Button>
                <Button size="sm" onClick={() => { setEscalateDialogOpen(true); setEscalateNote(""); }} className="h-7 rounded-[8px] bg-lavender/20 text-amethyst text-[11px] font-[600] hover:bg-lavender/30 cursor-pointer px-2">
                  <ArrowUpRight className="h-3 w-3" strokeWidth={2} /> Escalate
                </Button>
                <Button size="sm" onClick={() => { setFraudDialogOpen(true); setFraudNote(""); }} className="h-7 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] hover:bg-fraud-red/20 cursor-pointer px-2">
                  <Flag className="h-3 w-3" strokeWidth={2} /> Fraud
                </Button>
                <Button size="sm" onClick={() => setActionsInfoOpen(true)} className="h-7 w-7 rounded-[8px] bg-muted/50 text-muted-foreground hover:bg-muted cursor-pointer p-0" title="What do these actions do?">
                  <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <KbSlideOver
            open={esimKbOpen}
            onOpenChange={setEsimKbOpen}
            modelCode="ESIM"
            deviceLabel="eSIM Plans"
          />
          <CardContent className="space-y-4">
            {/* Plan headline with flag — prefers live Tellisim data when a serial is selected */}
            {(livePlanName || packageSku || planSku) && (() => {
              const sku = livePlanName || packageSku || planSku || "";
              const parsed = parsePlanSku(sku);
              const flag = parsed ? getCountryFlag(parsed.countryCode) : "";
              return (
                <div>
                  <p className="text-[22px] font-[540] text-charcoal leading-tight">
                    {flag && <span className="mr-2">{flag}</span>}
                    {formatPlanDisplay(sku)}
                    {livePlanName && (
                      <span className="ml-2 text-[11px] font-[540] text-success/70 uppercase tracking-wider">Live</span>
                    )}
                  </p>
                  {/* Show covered countries for regional/global plans */}
                  {(() => {
                    const isRegionalOrGlobal = !parsed || !(/^[A-Z]{2}$/.test(parsed.countryCode));
                    if (!isRegionalOrGlobal) return null;
                    const countries = getPlanCountries(sku);
                    if (countries.length === 0) return null;
                    return (
                      <div className="mt-2">
                        <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                          Countries Covered ({countries.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {countries.map((c) => (
                            <span key={c} className="inline-flex items-center gap-1 rounded-[8px] bg-muted px-2 py-0.5 text-[11px] font-[460] text-muted-foreground">
                              {getCountryFlag(c)} {getCountryName(c)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* Quick Facts — single-glance readout of the facts a support agent needs on a live call:
                paid · trip · shipped · usage. Reduces scan time by keeping vital signals in one row. */}
            {productType === "rental" && (
              <QuickFactsRental
                paidAt={selectedOrder.created_at}
                amount={selectedOrder.total}
                currency={currencyCode}
                tripStart={tripStart}
                tripEnd={tripEnd}
                totalDays={totalRentalDays}
                tracking={Array.isArray(selectedOrder.tracking_information) ? selectedOrder.tracking_information : []}
                cdrBytes={(() => {
                  const ts = tripStart ? new Date(tripStart).getTime() : 0;
                  const te = tripEnd ? new Date(tripEnd).getTime() + 86_400_000 - 1 : 0;
                  if (!ts || !te) return 0;
                  return cdrRecords.reduce((s, r) => {
                    const d = r["USAGE_DATE_UTC"];
                    const t = typeof d === "string" ? new Date(d).getTime() : typeof d === "number" ? d : 0;
                    if (t < ts || t > te) return s;
                    return s + Number(r["TOTAL_QTY"] || r["flowsize"] || 0);
                  }, 0);
                })()}
                isAwaitingFulfillment={isAwaitingFulfillment}
              />
            )}

            {/* Exchange rate note */}

            {/* Coupon / Discount info — uses catalog price for accurate discount calculation */}
            {(() => {
              const hasCoupons = selectedOrder.coupons && selectedOrder.coupons.length > 0;
              const totalLocal = Number(selectedOrder.total || 0);
              const rate = parseFloat(selectedOrder.order_usd_rate_exchange || "1") || 1;
              const totalUsd = rate > 0 ? totalLocal / rate : totalLocal;
              const purchaseDate = toDate(selectedOrder.created_at);
              const catalogPriceUsd = getCatalogPrice(packageSku || planSku || "", purchaseDate || undefined);
              const catalogPriceLocal = catalogPriceUsd && rate > 0 ? catalogPriceUsd * rate : null;
              const discountLocal = catalogPriceLocal ? Math.max(catalogPriceLocal - totalLocal, 0) : 0;
              const discountUsd = catalogPriceUsd ? Math.max(catalogPriceUsd - totalUsd, 0) : 0;
              const hasDiscount = discountLocal > 0.01 || discountUsd > 0.01;
              const couponNames = hasCoupons
                ? selectedOrder.coupons!.map(c => typeof c === "string" ? c : (c.code || ""))
                : [];
              const showUsd = currencyCode !== "USD" && rate > 0;

              if (!hasCoupons && !hasDiscount) return null;

              return (
                <div className="rounded-[8px] border border-lavender/30 bg-lavender/5 px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-4 w-4 text-amethyst shrink-0" strokeWidth={1.8} />
                    <span className="text-[12px] font-[600] text-amethyst uppercase tracking-wider">
                      {hasCoupons ? "Coupon Applied" : "Discount Detected"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {/* Coupon names */}
                    {couponNames.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {couponNames.map((name, i) => (
                          <Badge key={i} className="rounded-[8px] bg-lavender/20 text-amethyst text-[13px] font-[700] border-0 px-3 py-1">
                            {name || "Coupon"}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Price breakdown */}
                    {hasDiscount && (
                      <div className="text-[13px] font-[460]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {catalogPriceLocal && (
                            <span className="text-muted-foreground">
                              Catalog: <span className="line-through">{Math.round(catalogPriceLocal).toLocaleString()} {currencyCode}</span>
                              {showUsd && catalogPriceUsd && <span className="ml-1">(${catalogPriceUsd.toFixed(2)} USD)</span>}
                            </span>
                          )}
                          <span className="text-muted-foreground/40">→</span>
                          <span className="font-[600] text-foreground">
                            Paid: {totalLocal.toLocaleString()} {currencyCode}
                            {showUsd && <span className="ml-1">(${totalUsd.toFixed(2)} USD)</span>}
                          </span>
                        </div>
                        <div className="mt-1">
                          <span className="text-success font-[600]">
                            Discount: -{Math.round(discountLocal).toLocaleString()} {currencyCode}
                            {showUsd && discountUsd > 0 && ` / -$${discountUsd.toFixed(2)} USD`}
                          </span>
                        </div>
                      </div>
                    )}
                    {hasCoupons && !hasDiscount && (
                      <p className="text-[12px] font-[460] text-muted-foreground">
                        Coupon applied — catalog price not available for discount calculation
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

          </CardContent>
        </Card>
      )}

      {/* ─── 3. SERVICE STATUS — Only when serial is selected ─── */}
      {selectedSerial && (
        <>
          {serviceLoading ? (
            <Card className="rounded-[16px] bg-lavender/5">
              <CardContent className="py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Loader2 className="h-5 w-5 animate-spin text-lavender" />
                  <span className="text-[14px] font-[540] text-charcoal">Loading service details...</span>
                </div>
                {fetchSteps.length > 0 && (
                  <div className="space-y-2 ml-1">
                    {fetchSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-3 text-[13px]">
                        {step.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-parchment shrink-0" />}
                        {step.status === "loading" && <Loader2 className="h-4 w-4 animate-spin text-amethyst shrink-0" />}
                        {step.status === "done" && <CheckCircle2 className="h-4 w-4 text-success shrink-0" strokeWidth={1.8} />}
                        {step.status === "error" && <XCircle className="h-4 w-4 text-fraud-red shrink-0" strokeWidth={1.8} />}
                        <span className={cn(
                          "font-[460]",
                          step.status === "done" && "text-success",
                          step.status === "error" && "text-fraud-red",
                          step.status === "loading" && "text-charcoal",
                          step.status === "pending" && "text-charcoal/40",
                        )}>
                          {step.label}
                        </span>
                        {step.durationMs != null && (
                          <span className="text-[11px] text-charcoal/40 ml-auto font-mono">{step.durationMs}ms</span>
                        )}
                        {step.status === "error" && step.error && (
                          <span className="text-[11px] text-fraud-red/70 ml-auto truncate max-w-[200px]">{step.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
            {/* Error banner for failed fetch steps */}
            {fetchSteps.some(s => s.status === "error") && (
              <Card className="rounded-[16px] border-fraud-red/20 bg-fraud-red-soft/30 mb-4">
                <CardContent className="py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-fraud-red mt-0.5 shrink-0" strokeWidth={1.8} />
                    <div className="space-y-1">
                      <p className="text-[13px] font-[600] text-fraud-red">Some data sources failed to load</p>
                      {fetchSteps.filter(s => s.status === "error").map((s, i) => (
                        <p key={i} className="text-[12px] font-[460] text-fraud-red/80">
                          {s.label}: {s.error || "Unknown error"} {s.durationMs != null && <span className="text-fraud-red/50">({s.durationMs}ms)</span>}
                        </p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {productType !== "esim" ? (
            <SapphireDeviceCard
              imei={selectedSerial}
              deviceInfo={deviceInfo}
              deviceInfoError={deviceInfoError}
              userOffers={userOffers}
              allOrders={orders}
              cdrRecords={cdrRecords}
              cdrTotal={cdrTotal}
              dailyUsage={dailyUsage}
              packageSku={packageSku || planSku || ""}
              tripStart={tripStart}
              tripEnd={tripEnd}
              orderCreatedAt={selectedOrder?.created_at}
              productType={productType}
              onCopy={(v) => copy(v, "imei")}
              copied={copiedField === "imei"}
              terminalStatus={terminalStatus}
              terminalStatusLoading={terminalStatusLoading}
              terminalStatusError={terminalStatusError}
              terminalStatusCachedAt={terminalStatusCachedAt}
              onSyncTerminalStatus={() => refreshTerminalStatus(selectedSerial)}
            />
          ) : serviceError ? (
            <Card className="rounded-[16px]">
              <CardContent className="flex items-center gap-2 py-6 text-fraud-red">
                <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
                <span className="text-[13px] font-[600]">{serviceError}</span>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Support Decision Helper */}
              {supportHint && (
                <div className="rounded-[8px] border border-lavender/30 bg-lavender/5 px-4 py-3 flex items-start gap-3">
                  <Settings className="h-4 w-4 text-amethyst mt-0.5 shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-amethyst mb-0.5">Support Tip</p>
                    <p className="text-[13px] font-[460] text-foreground leading-relaxed">{supportHint}</p>
                  </div>
                </div>
              )}

              {/* Status Cards — 3 column grid */}
              <Card className="rounded-[16px] bg-lavender/5 border-lavender/20">
                <CardContent className="pt-5 pb-5">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* Profile Status — using friendly labels */}
                    <StatusCard title="Profile Status">
                      {(() => {
                        const smdpInfo = getSmdpLabel(effectiveSmdpStatus);
                        const iconMap = { success: CheckCircle2, info: Download, warning: WifiOff, error: XCircle };
                        const colorMap = { success: "text-success", info: "text-amethyst", warning: "text-fraud-yellow", error: "text-fraud-red" };
                        const bgMap = { success: "bg-success-soft", info: "bg-lavender/10", warning: "bg-fraud-yellow-soft", error: "bg-fraud-red-soft" };
                        const Icon = iconMap[smdpInfo.severity];
                        return (
                          <div>
                            <div className="flex items-center gap-3">
                              <div className={cn("flex h-10 w-10 items-center justify-center rounded-[8px]", bgMap[smdpInfo.severity])}>
                                <Icon className={cn("h-5 w-5", colorMap[smdpInfo.severity])} strokeWidth={2} />
                              </div>
                              <div>
                                <p className={cn("text-[15px] font-[600]", colorMap[smdpInfo.severity])}>{smdpInfo.label}</p>
                                {smdpData?.state_history?.[0]?.modified_at && (
                                  <p className="text-[12px] font-[460] text-muted-foreground">
                                    Since {formatDate(smdpData.state_history[0].modified_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <p className="text-[11px] font-[460] text-muted-foreground mt-2">{smdpInfo.description}</p>
                          </div>
                        );
                      })()}
                    </StatusCard>

                    {/* Plan Status */}
                    <StatusCard title="Plan Status">
                      {currentPlan ? (() => {
                        const info = planStateInfo(currentPlan.state);
                        const Icon = info.icon;
                        const expiryDays = daysUntil(currentPlan.expiration_at);
                        return (
                          <div className="flex items-center gap-3">
                            <div className={cn("flex h-10 w-10 items-center justify-center rounded-[8px]", info.bg)}>
                              <Icon className={cn("h-5 w-5", info.color)} strokeWidth={2} />
                            </div>
                            <div>
                              <p className={cn("text-[15px] font-[600]", info.color)}>{info.label}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Timer className="h-3 w-3 text-muted-foreground" strokeWidth={1.8} />
                                <p className={cn("text-[12px] font-[600]",
                                  expiryDays !== null && expiryDays <= 3 ? "text-fraud-red" :
                                  expiryDays !== null && expiryDays <= 7 ? "text-fraud-yellow" :
                                  "text-muted-foreground"
                                )}>
                                  {daysUntilDisplay(currentPlan.expiration_at)}
                                </p>
                                <span className="text-[11px] font-[460] text-muted-foreground/60">
                                  ({formatDate(currentPlan.expiration_at)})
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })() : (
                        <p className="text-[13px] font-[460] text-muted-foreground">No plan data available</p>
                      )}
                    </StatusCard>

                    {/* Data Usage */}
                    <StatusCard title="Data Usage">
                      {planDataBytes > 0 ? (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-[22px] font-[540] text-foreground">{formatBytes(remainingBytes)}</span>
                            <span className="text-[13px] font-[460] text-muted-foreground">remaining</span>
                          </div>
                          <div className="mt-3 h-2.5 rounded-full bg-parchment overflow-hidden" role="progressbar"
                            aria-label={`${formatBytes(usedBytes)} of ${mbToDisplay(planDataMb)} used, ${usagePct.toFixed(0)}%`}>
                            <div className={cn("h-full rounded-full transition-all duration-500 ease-out",
                              usagePct > 80 ? "bg-amethyst" : "bg-lavender"
                            )} style={{ width: `${usagePct}%` }} />
                          </div>
                          <p className="mt-1.5 text-[12px] font-[460] text-muted-foreground">
                            {formatBytes(usedBytes)} of {mbToDisplay(planDataMb)} used ({usagePct.toFixed(0)}%)
                          </p>
                        </div>
                      ) : (
                        <p className="text-[13px] font-[460] text-muted-foreground">No data plan info</p>
                      )}
                    </StatusCard>
                  </div>
                </CardContent>
              </Card>

              {/* ─── eSIM Network Status Card — TelliSIM only ─── */}
              {isTelliSim && (() => {
                // Determine eSIM lifecycle state to decide what to show
                const profileStatus = effectiveSmdpStatus;
                const isProfileInstalled = profileStatus === "Enable" || profileStatus === "Disable";
                const isProfileEnabled = profileStatus === "Enable";
                const isProfileDisabled = profileStatus === "Disable";
                const isProfileDeleted = profileStatus === "Delete";
                const isProfilePending = !profileStatus || profileStatus === "BPP Installation";
                const hasActivePlan = currentPlan?.state === "ACTIVE" || currentPlan?.state === "ENABLED";
                const hasPendingPlan = currentPlan?.state === "PENDING_FOR_FIRST_USE" || currentPlan?.state === "PENDING" || currentPlan?.state === "CREATED";
                const canShowNetwork = isProfileEnabled && (hasActivePlan || cdrTotal > 0);
                const hasNetworkData = locationData || cdrImei || cdrCountry;

                return (
                  <Card className="rounded-[16px]">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                        <Signal className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                        eSIM Network Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* ── Profile not yet downloaded ── */}
                      {isProfilePending && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/10">
                            <Download className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                          </div>
                          <div>
                            <p className="text-[13px] font-[540] text-foreground">
                              {profileStatus === "BPP Installation" ? "Profile downloaded — pending activation" : "eSIM profile not yet installed on a device"}
                            </p>
                            <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                              Network data will appear after the customer installs and enables the eSIM
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Profile disabled ── */}
                      {isProfileDisabled && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-fraud-yellow-soft">
                            <WifiOff className="h-4 w-4 text-fraud-yellow" strokeWidth={1.8} />
                          </div>
                          <div>
                            <p className="text-[13px] font-[540] text-foreground">eSIM turned off in device settings</p>
                            <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                              No network data while disabled — ask customer to re-enable in Settings
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Profile deleted/removed ── */}
                      {isProfileDeleted && (
                        <div className="flex items-center gap-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-fraud-red-soft">
                            <XCircle className="h-4 w-4 text-fraud-red" strokeWidth={1.8} />
                          </div>
                          <div>
                            <p className="text-[13px] font-[540] text-foreground">eSIM profile removed from device</p>
                            <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                              Profile was permanently deleted — customer needs to re-download
                            </p>
                          </div>
                        </div>
                      )}

                      {/* ── Profile enabled — show network data or contextual empty state ── */}
                      {isProfileEnabled && (
                        <>
                          {/* Full location data from TelliSIM API */}
                          {locationData ? (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Device</p>
                                {(locationData.brand || locationData.model) && (
                                  <p className="text-[14px] font-[540] text-foreground mb-0.5">
                                    {[locationData.brand, locationData.model].filter(Boolean).join(" / ")}
                                  </p>
                                )}
                                <button onClick={() => copy(locationData.imei || "", "imei")}
                                  className="flex items-center gap-1.5 cursor-pointer group">
                                  <p className="text-[12px] font-[460] text-muted-foreground font-mono">IMEI: {locationData.imei || "—"}</p>
                                  {copiedField === "imei" ? (
                                    <span className="text-[11px] font-[600] text-success">Copied!</span>
                                  ) : (
                                    <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.8} />
                                  )}
                                </button>
                              </div>
                              <div>
                                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Last Country</p>
                                <p className="text-[14px] font-[540] text-foreground">
                                  {locationData.country ? (
                                    <>
                                      <span className="mr-1.5">{getCountryFlag(locationData.country)}</span>
                                      {getCountryName(locationData.country)}
                                    </>
                                  ) : "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Operator</p>
                                <p className="text-[14px] font-[540] text-foreground">{locationData.operator || "—"}</p>
                              </div>
                              <div>
                                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Network</p>
                                {locationData.rat ? (
                                  <Badge className={cn("rounded-[8px] text-[12px] font-[700] border-0 px-2.5 py-0.5", ratBadgeColor(locationData.rat))}>
                                    {ratDisplayLabel(locationData.rat)}
                                  </Badge>
                                ) : (
                                  <p className="text-[14px] font-[540] text-muted-foreground">—</p>
                                )}
                              </div>
                              <div>
                                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Last Seen</p>
                                <p className="text-[14px] font-[540] text-foreground">{formatDateTime(locationData.event_time)}</p>
                              </div>
                            </div>
                          ) : (cdrImei || cdrCountry) ? (
                            /* CDR fallback when location API returned nothing */
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {cdrImei && (
                                <div>
                                  <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Device (from CDR)</p>
                                  <button onClick={() => copy(cdrImei, "imei")} className="flex items-center gap-1.5 cursor-pointer group">
                                    <p className="text-[12px] font-[460] text-foreground font-mono">IMEI: {cdrImei}</p>
                                    {copiedField === "imei" ? (
                                      <span className="text-[11px] font-[600] text-success">Copied!</span>
                                    ) : (
                                      <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.8} />
                                    )}
                                  </button>
                                </div>
                              )}
                              {cdrCountry && (
                                <div>
                                  <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Last Country (from CDR)</p>
                                  <p className="text-[14px] font-[540] text-foreground">
                                    {getCountryFlag(cdrCountry)} {getCountryName(cdrCountry)}
                                  </p>
                                </div>
                              )}
                              {cdrLastDate && (
                                <div>
                                  <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Last Session</p>
                                  <p className="text-[13px] font-[460] text-foreground">{formatDateTime(cdrLastDate)}</p>
                                </div>
                              )}
                            </div>
                          ) : hasActivePlan ? (
                            /* Active plan but no network events yet */
                            <div className="flex items-center gap-3 py-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/10">
                                <Radio className="h-4 w-4 text-amethyst animate-pulse" strokeWidth={1.8} />
                              </div>
                              <div>
                                <p className="text-[13px] font-[540] text-foreground">Awaiting first network connection</p>
                                <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                                  eSIM is enabled with an active plan — check data roaming and APN settings
                                </p>
                              </div>
                            </div>
                          ) : hasPendingPlan ? (
                            /* Plan provisioned but not activated */
                            <div className="flex items-center gap-3 py-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/10">
                                <Clock className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                              </div>
                              <div>
                                <p className="text-[13px] font-[540] text-foreground">Plan pending activation</p>
                                <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                                  Network data will appear once the plan activates on first use
                                </p>
                              </div>
                            </div>
                          ) : (
                            /* Enabled profile but no active plan */
                            <div className="flex items-center gap-3 py-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-muted/50">
                                <WifiOff className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                              </div>
                              <div>
                                <p className="text-[13px] font-[540] text-foreground">No active data plan</p>
                                <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                                  eSIM is enabled but has no active plan — customer may need a new plan or top-up
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Profile History Timeline — Fixed spacing */}
              {/* CDR-derived status note when SMDP returned nothing but usage exists */}
              {(!smdpData?.state_history || smdpData.state_history.length === 0) && cdrTotal > 0 && (
                <div className="rounded-[8px] border border-fraud-yellow/30 bg-fraud-yellow-soft px-4 py-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-fraud-yellow mt-0.5 shrink-0" strokeWidth={1.8} />
                  <div>
                    <p className="text-[12px] font-[600] text-foreground">Profile status unavailable from provider</p>
                    <p className="text-[11px] font-[460] text-muted-foreground">
                      SMDP data not available, but CDR records confirm this eSIM has been used ({cdrTotal} sessions recorded).
                      The eSIM was installed and activated on a device.
                    </p>
                  </div>
                </div>
              )}

              {smdpData?.state_history && smdpData.state_history.length > 0 && (() => {
                // Sort newest first, then limit to 3 unless expanded
                const sortedHistory = [...smdpData.state_history].sort((a, b) => {
                  const da = a.modified_at ? new Date(a.modified_at).getTime() : 0;
                  const db = b.modified_at ? new Date(b.modified_at).getTime() : 0;
                  return db - da;
                });
                const COLLAPSED_LIMIT = 3;
                const hasMore = sortedHistory.length > COLLAPSED_LIMIT;

                return (
                  <Card className="rounded-[16px]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                          <Globe className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                          Profile History
                        </CardTitle>
                        <span className="text-[11px] font-[460] text-muted-foreground">
                          {sortedHistory.length} event{sortedHistory.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ProfileHistoryTimeline events={sortedHistory} collapsedLimit={COLLAPSED_LIMIT} />
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Plan Attachments — split by ownership */}
              {planAttachments.length > 0 && (() => {
                const { currentPlans, previousPlans } = matchPlansToOrders(planAttachments, iccidOrders, customerEmail);
                return (
                  <>
                    {/* Current customer's plans */}
                    {currentPlans.length > 0 && (
                      <Card className="rounded-[16px]">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                            <Wifi className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                            Plan Attachments ({currentPlans.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <PlanTable plans={currentPlans} />
                        </CardContent>
                      </Card>
                    )}

                    {/* Previous history (fraud/recycled ICCID) */}
                    {previousPlans.length > 0 && (
                      <Card className="rounded-[16px] border-fraud-red/20">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-[14px] font-[600] text-fraud-red flex items-center gap-2">
                              <ShieldBan className="h-4 w-4" strokeWidth={1.8} />
                              Previous SIM History ({previousPlans.length})
                            </CardTitle>
                            <Badge className="rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] border-0">
                              Different Customer
                            </Badge>
                          </div>
                          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
                            These plans belong to a previous owner of this ICCID. They are not related to the current customer.
                          </p>
                        </CardHeader>
                        <CardContent>
                          <PlanTable plans={previousPlans} showOrder />
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}

              {/* ─── 4. USAGE HISTORY — Line chart + date range + table ─── */}
              <Card className="rounded-[16px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                      Usage History
                    </CardTitle>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(["7", "14", "30"] as const).map((d) => (
                        <button key={d} onClick={() => setDateRange(d)}
                          className={cn(
                            "rounded-[8px] px-3 py-1.5 text-[12px] font-[600] transition-colors cursor-pointer",
                            dateRange === d
                              ? "bg-cream text-charcoal border border-lavender"
                              : "text-muted-foreground hover:bg-muted border border-transparent"
                          )}>
                          {d}d
                        </button>
                      ))}
                      <button onClick={() => setDateRange("custom")}
                        className={cn(
                          "rounded-[8px] px-3 py-1.5 text-[12px] font-[600] transition-colors cursor-pointer",
                          dateRange === "custom"
                            ? "bg-cream text-charcoal border border-lavender"
                            : "text-muted-foreground hover:bg-muted border border-transparent"
                        )}>
                        Custom
                      </button>
                      {dateRange === "custom" && (
                        <div className="flex items-center gap-1 ml-1">
                          <input type="date" value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="rounded-[8px] border border-border bg-background px-2 py-1 text-[12px] font-[460] text-foreground outline-none focus:border-lavender" />
                          <span className="text-[12px] text-muted-foreground">to</span>
                          <input type="date" value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="rounded-[8px] border border-border bg-background px-2 py-1 text-[12px] font-[460] text-foreground outline-none focus:border-lavender" />
                          <button
                            onClick={() => { if (customFrom && customTo && selectedSerial) loadServiceData(selectedSerial, true); }}
                            disabled={!customFrom || !customTo}
                            className="rounded-[8px] bg-cream text-charcoal px-3 py-1 text-[12px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer">
                            Go
                          </button>
                        </div>
                      )}
                      <button onClick={() => selectedSerial && loadServiceData(selectedSerial, true)}
                        className="ml-1 rounded-[8px] p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                        title="Force refresh">
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {dailyUsage.length > 0 ? (
                    <>
                      {/* Line Chart */}
                      <ColumnChart data={dailyUsage} planDataMb={planDataMb ? (typeof planDataMb === "string" ? parseInt(planDataMb) : planDataMb) : undefined} />

                      <Separator className="my-4" />

                      {/* Table fallback */}
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[12px] font-[600]">Date</TableHead>
                              <TableHead className="text-[12px] font-[600]">Data Used</TableHead>
                              <TableHead className="text-[12px] font-[600]">Country</TableHead>
                              <TableHead className="text-[12px] font-[600]">Sessions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dailyUsage.filter(d => d.bytes > 0).map((day, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-[13px] font-[460]">{formatDate(day.date)}</TableCell>
                                <TableCell className="text-[13px] font-[460] font-mono">{formatBytes(day.bytes)}</TableCell>
                                <TableCell className="text-[13px] font-[460]">{day.country ? getCountryName(day.country) : "—"}</TableCell>
                                <TableCell className="text-[13px] font-[460] font-mono">{day.sessions}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mb-2 opacity-20" strokeWidth={1.5} />
                      {cdrError ? (
                        <>
                          <p className="text-[13px] font-[600] text-amber-600">Usage information not available</p>
                          <p className="text-[11px] font-[460] text-muted-foreground/60 mt-1">
                            CDR data source could not be reached for this product type. Contact engineering if this persists.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-[13px] font-[460]">No usage data for the selected period</p>
                          <p className="text-[11px] font-[460] text-muted-foreground/60 mt-1">
                            {cdrTotal === 0 ? "No data sessions recorded for this serial" : "Try expanding the date range"}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ─── Coverage Lookup — TelliSIM eSIM only, regional/global plans (no ISO2 in SKU) ─── */}
              {isTelliSim && !(packageSku && /^[A-Z]{2}_\d+GB/.test(packageSku)) && (
                <Card className="rounded-[16px]">
                  <CardHeader className="pb-3">
                    <button
                      onClick={() => setCoverageOpen(!coverageOpen)}
                      className="flex items-center justify-between w-full cursor-pointer"
                    >
                      <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                        <Signal className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                        Coverage Lookup
                      </CardTitle>
                      {coverageOpen ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
                      )}
                    </button>
                  </CardHeader>
                  {coverageOpen && (
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            type="text"
                            placeholder="Search by country name (e.g. Germany, Japan)..."
                            value={coverageQuery}
                            onChange={(e) => setCoverageQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && coverageQuery.trim()) handleCoverageLookup(); }}
                            className="rounded-[8px] text-[13px] font-[460]"
                          />
                        </div>
                        <Button
                          onClick={handleCoverageLookup}
                          disabled={!coverageQuery.trim() || coverageLoading}
                          className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer"
                        >
                          {coverageLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Search className="h-3.5 w-3.5" strokeWidth={2} />
                          )}
                          Search
                        </Button>
                      </div>

                      {coverageError && (
                        <div className="flex items-center gap-2 text-fraud-red">
                          <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                          <span className="text-[12px] font-[600]">{coverageError}</span>
                        </div>
                      )}

                      {coverageResults.length > 0 && (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[12px] font-[600]">Operator</TableHead>
                                <TableHead className="text-[12px] font-[600]">Supported Networks</TableHead>
                                <TableHead className="text-[12px] font-[600]">Country</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {coverageResults.map((op, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-[13px] font-[460]">{op.operator_name || "—"}</TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {(op.supported_rats || []).map((rat, j) => (
                                        <Badge key={j} className={cn("rounded-[8px] text-[11px] font-[700] border-0 px-2 py-0.5", ratBadgeColor(rat))}>
                                          {ratDisplayLabel(rat)}
                                        </Badge>
                                      ))}
                                      {(!op.supported_rats || op.supported_rats.length === 0) && (
                                        <span className="text-[12px] text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-[13px] font-[460]">
                                    {op.country ? (
                                      <>
                                        <span className="mr-1">{getCountryFlag(op.country)}</span>
                                        {getCountryName(op.country)}
                                      </>
                                    ) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}

                      {coverageResults.length === 0 && !coverageError && !coverageLoading && coverageQuery.trim() && (
                        <p className="text-[12px] font-[460] text-muted-foreground text-center py-4">
                          Enter a country name and click Search to see available operators
                        </p>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}
            </>
          )}
            </>
          )}

        </>
      )}

      {/* Order Summary — rendered below plan purchases. Two stacked groups:
          (1) Billing recap: purchased / country / amount / payment
          (2) Trip: start → end, days, insurance (rentals only) */}
      {selectedOrder && (
        <Card className="rounded-[16px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px] font-[600] text-charcoal flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-charcoal/70" strokeWidth={1.8} />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Billing group */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3">
              <SummaryField label="Purchased" value={formatDate(selectedOrder.created_at)} />
              <SummaryField label="Country" value={(() => {
                if (selectedOrder.destination_country) return getCountryName(selectedOrder.destination_country);
                const parsed = parsePlanSku(packageSku || planSku || "");
                if (parsed?.countryName) return parsed.countryName;
                return "—";
              })()} />
              <SummaryField
                label="Amount Paid"
                value={selectedOrder.total != null ? `${Number(selectedOrder.total).toFixed(2)} ${currencyCode}` : "—"}
              />
              <SummaryField
                label="USD Value"
                value={(() => {
                  if (selectedOrder.total_usd) return `$${Number(selectedOrder.total_usd).toFixed(2)}`;
                  if (selectedOrder.total != null && selectedOrder.order_usd_rate_exchange) {
                    const rate = parseFloat(selectedOrder.order_usd_rate_exchange);
                    if (rate > 0) return `$${(Number(selectedOrder.total) / rate).toFixed(2)}`;
                  }
                  return currencyCode === "USD" && selectedOrder.total != null ? `$${Number(selectedOrder.total).toFixed(2)}` : "—";
                })()}
              />
              <SummaryField label="Payment" value={selectedOrder.payment_method_title || "—"} />
            </div>
            {selectedOrder.order_usd_rate_exchange && currencyCode !== "USD" && (
              <p className="text-[11px] font-[460] text-charcoal/60">
                Exchange rate: {selectedOrder.order_usd_rate_exchange} {currencyCode}/USD as of {formatDate(selectedOrder.created_at)}
              </p>
            )}

            {/* Rental trip — rendered as Feature Title hierarchy per design.md §3:
                28px / weight 540 / line-height 1.14 / letter-spacing -0.63px.
                Lavender Glow (#cbb7fb) is used as the sole accent on the → arrow and
                duration separator to visually distinguish this moment from the 14px
                billing grid above, while staying inside design.md's single-accent rule. */}
            {(tripStart || tripEnd) && productType === "rental" && (
              <>
                <Separator className="bg-parchment" />
                <div>
                  <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 mb-2 flex items-center gap-1.5">
                    <Plane className="h-3 w-3" strokeWidth={1.8} /> Rental Trip
                  </p>
                  <div className="flex items-baseline gap-3 flex-wrap" style={{ letterSpacing: "-0.63px" }}>
                    <span className="text-[28px] font-[540] text-charcoal tabular-nums leading-[1.14]">
                      {formatDate(tripStart)}
                    </span>
                    <span className="text-[24px] font-[460] leading-[1.14]" style={{ color: "#cbb7fb" }}>→</span>
                    <span className="text-[28px] font-[540] text-charcoal tabular-nums leading-[1.14]">
                      {formatDate(tripEnd)}
                    </span>
                  </div>
                  {(totalRentalDays !== null || insuranceLine) && (
                    <div className="flex items-center gap-2 flex-wrap mt-2" style={{ letterSpacing: 0 }}>
                      {totalRentalDays !== null && (
                        <span className="text-[13px] font-[460] text-charcoal/70">
                          <span className="font-[600] text-charcoal">{totalRentalDays}</span> day{totalRentalDays === 1 ? "" : "s"} total
                        </span>
                      )}
                      {totalRentalDays !== null && insuranceLine && (
                        <span style={{ color: "#cbb7fb" }}>·</span>
                      )}
                      {insuranceLine && (
                        <span className="inline-flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
                          <span className="text-[13px] font-[460] text-charcoal/70">
                            Insurance · <span className="font-[600] text-charcoal">{insuranceLine.qty || insuranceLine.quantity || 0}</span> day{(insuranceLine.qty || insuranceLine.quantity || 0) === 1 ? "" : "s"}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fulfillment — rentals only (physical device ships, trip window, return label).
          eSIMs and Sapphire Data Plan reloads have no warehouse/shipping context, so this card
          is gated to productType === "rental" (or awaiting fulfillment) only. */}
      {selectedOrder && productType === "rental" && (
        (warehouses.length > 0 || shippingMode || deliveryAddress || returnAddress)
        || (Array.isArray(selectedOrder.tracking_information) && selectedOrder.tracking_information.length > 0)
        || isAwaitingFulfillment
      ) && (
        <Card className="rounded-[16px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[14px] font-[600] text-charcoal flex items-center gap-2">
              <Truck className="h-4 w-4 text-charcoal/70" strokeWidth={1.8} />
              Fulfillment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(warehouses.length > 0 || shippingMode || deliveryAddress || returnAddress) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                {(warehouses.length > 0 || shippingMode) && (
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 mb-1.5 flex items-center gap-1.5">
                      <Warehouse className="h-3 w-3" strokeWidth={1.8} /> Warehouse
                    </p>
                    {warehouses.length > 0 && (
                      <p className="text-[14px] font-[540] text-charcoal leading-snug">
                        {warehouses.join(", ")}
                      </p>
                    )}
                    {shippingMode && (
                      <p className="text-[12px] font-[460] text-charcoal/70 mt-1">
                        {shippingMode === "pickup" ? "Customer pickup" : `Shipped · ${shippingMethods.join(", ") || "Postal service"}`}
                      </p>
                    )}
                  </div>
                )}
                {shippingMode === "ship" && deliveryAddress && (
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" strokeWidth={1.8} /> Delivery Address
                    </p>
                    <p className="text-[14px] font-[460] text-charcoal leading-snug whitespace-pre-line">{deliveryAddress}</p>
                  </div>
                )}
                {returnAddress && (
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 mb-1.5 flex items-center gap-1.5">
                      <Undo2 className="h-3 w-3" strokeWidth={1.8} /> Returning From
                    </p>
                    <p className="text-[14px] font-[460] text-charcoal leading-snug whitespace-pre-line">{returnAddress}</p>
                    <p className="text-[11px] font-[460] text-charcoal/60 mt-1">Customer's return-from address</p>
                  </div>
                )}
              </div>
            )}

            {Array.isArray(selectedOrder.tracking_information) && selectedOrder.tracking_information.length > 0 && (
              <>
                <Separator className="bg-parchment" />
                <TrackingSection tracking={selectedOrder.tracking_information} />
              </>
            )}

            {isAwaitingFulfillment && (
              <div className="rounded-[8px] border border-dashed border-parchment bg-background px-4 py-5 flex items-start gap-3">
                <Clock className="h-4 w-4 text-charcoal/70 shrink-0 mt-0.5" strokeWidth={1.8} />
                <div>
                  <p className="text-[13px] font-[600] text-charcoal">Waiting to be fulfilled</p>
                  <p className="text-[12px] font-[460] text-charcoal/70 mt-0.5">
                    Device has not been assigned yet — no IMEI, device binding, or data usage is available until the warehouse picks and ships the unit.
                  </p>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      )}

      {/* Device selector — always shown when serials exist, regardless of product type.
          eSIMs, Sapphire Data reloads, and Rentals all need this to load live plan + usage data. */}
      {selectedOrder && serials.length > 0 && (
        <Card className="rounded-[16px]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[14px] font-[600] text-charcoal flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-charcoal/70" strokeWidth={1.8} />
                {productType === "esim" ? "eSIM" : productType === "sapphire" ? "Device (IMEI)" : "Device"}
              </CardTitle>
              {serviceCachedAt && selectedSerial && !serviceLoading ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-[460] text-charcoal/50">
                    Cached {Math.floor((Date.now() - serviceCachedAt) / 60000)}m ago
                  </span>
                  <button
                    onClick={() => selectedSerial && loadServiceData(selectedSerial, true)}
                    className="text-[11px] font-[540] text-amethyst hover:text-amethyst/80 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" strokeWidth={2} />
                    Sync
                  </button>
                </div>
              ) : (
                <p className="text-[11px] font-[460] text-charcoal/60">Click to load live status</p>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {serials.map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <button onClick={() => loadServiceData(s)}
                    className={cn(
                      "flex items-center gap-2 rounded-[8px] border-2 px-4 py-2.5 text-[13px] font-mono font-[600] transition-all cursor-pointer",
                      selectedSerial === s
                        ? "border-charcoal bg-cream text-charcoal"
                        : "border-parchment bg-background text-charcoal hover:border-charcoal/40 hover:bg-cream/40"
                    )}>
                    {selectedSerial === s && serviceLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-charcoal/70" />
                    ) : (
                      <Wifi className="h-4 w-4 text-charcoal/70" strokeWidth={1.8} />
                    )}
                    {s}
                    {selectedSerial === s && serviceLoading && (
                      <span className="text-[11px] font-[500] text-charcoal/70 ml-1">Loading...</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); copy(s, `serial-${s}`); }}
                    className="p-1.5 rounded-[8px] hover:bg-cream transition-colors cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copiedField === `serial-${s}` ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={1.8} />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-charcoal/40 hover:text-charcoal/70" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              ))}
            </div>
            {selectedSerial && serviceLoading && (
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-parchment overflow-hidden">
                  <div className="h-full rounded-full bg-charcoal/60 animate-pulse" style={{ width: "60%" }} />
                </div>
                <p className="text-[11px] font-[460] text-charcoal/60 mt-1">Fetching real-time data from provider...</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── 5. TelliSIM Phase 2 Actions (role-gated) ─── */}
      <div className="flex flex-wrap gap-2">
        {/* TelliSIM Phase 2: Suspend Plan — role-gated */}
        {isTelliSim && hasPermission(role, "tellisim:suspend") && hasActivePlan && selectedSerial && (
          <Button
            onClick={() => { setSuspendDialogOpen(true); setSuspendConfirmIccid(""); setSuspendError(null); setSuspendSuccess(false); }}
            className="rounded-[8px] bg-fraud-red-soft text-fraud-red text-[13px] font-[600] hover:bg-fraud-red/20 cursor-pointer"
          >
            <Pause className="h-3.5 w-3.5" strokeWidth={2} /> Suspend Plan
          </Button>
        )}

        {/* TelliSIM Phase 2: Send SMS — role-gated */}
        {isTelliSim && hasPermission(role, "tellisim:send-sms") && selectedSerial && (
          <Button
            onClick={() => { setSmsDialogOpen(true); setSmsFrom("TravelWifi"); setSmsMessage(""); setSmsError(null); setSmsSuccess(false); }}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
          >
            <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} /> Send SMS
          </Button>
        )}
      </div>

      {/* ─── Suspend Plan Confirmation Dialog ─── */}
      {suspendDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] font-[600] text-fraud-red flex items-center gap-2">
                <AlertCircle className="h-5 w-5" strokeWidth={2} />
                Suspend Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-3">
                <p className="text-[13px] font-[700] text-fraud-red">This action is NON-REVERSIBLE</p>
                <p className="text-[12px] font-[460] text-fraud-red/80 mt-1">
                  Once suspended, this plan cannot be reactivated. The customer will lose remaining data and validity.
                </p>
              </div>

              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">
                  Type the ICCID to confirm: <span className="font-mono text-amethyst">{selectedSerial}</span>
                </p>
                <Input
                  type="text"
                  placeholder="Enter ICCID..."
                  value={suspendConfirmIccid}
                  onChange={(e) => setSuspendConfirmIccid(e.target.value)}
                  className="rounded-[8px] text-[13px] font-mono font-[460]"
                />
              </div>

              {suspendError && (
                <div className="flex items-center gap-2 text-fraud-red">
                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="text-[12px] font-[600]">{suspendError}</span>
                </div>
              )}

              {suspendSuccess && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="text-[12px] font-[600]">Plan suspended successfully</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setSuspendDialogOpen(false)}
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSuspendPlan}
                  disabled={suspendConfirmIccid !== selectedSerial || suspendLoading}
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  {suspendLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" strokeWidth={2} />}
                  Confirm Suspend
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Send SMS Dialog ─── */}
      {smsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] font-[600] text-foreground flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amethyst" strokeWidth={2} />
                Send SMS
              </CardTitle>
              <p className="text-[12px] font-[460] text-muted-foreground mt-1">
                Send an SMS to ICCID <span className="font-mono text-amethyst">{selectedSerial}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">From</p>
                <Input
                  type="text"
                  value={smsFrom}
                  onChange={(e) => setSmsFrom(e.target.value)}
                  className="rounded-[8px] text-[13px] font-[460]"
                />
              </div>

              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Message</p>
                <Textarea
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="rounded-[8px] min-h-[80px] text-[13px] font-[460] resize-none"
                />
              </div>

              {smsError && (
                <div className="flex items-center gap-2 text-fraud-red">
                  <AlertCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="text-[12px] font-[600]">{smsError}</span>
                </div>
              )}

              {smsSuccess && (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  <span className="text-[12px] font-[600]">SMS sent successfully</span>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setSmsDialogOpen(false)}
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendSms}
                  disabled={!smsMessage.trim() || !smsFrom.trim() || smsLoading}
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer"
                >
                  {smsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={2} />}
                  Send SMS
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Actions Info Modal ─── */}
      {actionsInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setActionsInfoOpen(false)}>
          <Card className="rounded-[16px] w-full max-w-lg mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] font-[600] text-foreground flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-amethyst" strokeWidth={2} />
                Quick Actions Guide
              </CardTitle>
              <p className="text-[12px] font-[460] text-muted-foreground mt-1">
                Available actions depend on the product type for this order.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3">
                <p className="text-[11px] font-[700] uppercase tracking-wider text-amethyst/60 mb-2">eSIM Only (TelliSIM)</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-5 w-5 rounded-[6px] bg-fraud-yellow-soft mt-0.5">
                      <Pause className="h-3 w-3 text-fraud-yellow" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[13px] font-[600] text-foreground">Pause</p>
                      <p className="text-[11px] font-[460] text-muted-foreground">Temporarily disable the eSIM profile via TelliSIM. The profile can be re-enabled later. Use when a customer needs a temporary hold on service.</p>
                      <Badge className="mt-1 rounded-[6px] text-[10px] font-[600] bg-fraud-yellow-soft text-fraud-yellow border-0 px-1.5 py-0">Coming soon</Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-5 w-5 rounded-[6px] bg-fraud-red-soft mt-0.5">
                      <ShieldBan className="h-3 w-3 text-fraud-red" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[13px] font-[600] text-foreground">Block</p>
                      <p className="text-[11px] font-[460] text-muted-foreground">Permanently block the SIM via TelliSIM. This is irreversible — the SIM cannot be reactivated. Use for confirmed abuse or stolen devices.</p>
                      <Badge className="mt-1 rounded-[6px] text-[10px] font-[600] bg-fraud-yellow-soft text-fraud-yellow border-0 px-1.5 py-0">Coming soon</Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-5 w-5 rounded-[6px] bg-cream mt-0.5">
                      <Send className="h-3 w-3 text-charcoal" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[13px] font-[600] text-foreground">Resend</p>
                      <p className="text-[11px] font-[460] text-muted-foreground">Resend the eSIM QR code and activation instructions to the customer. Use when the customer lost or didn&apos;t receive the original email.</p>
                      <Badge className="mt-1 rounded-[6px] text-[10px] font-[600] bg-fraud-yellow-soft text-fraud-yellow border-0 px-1.5 py-0">Coming soon</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[8px] bg-muted/30 border border-border/50 px-4 py-3">
                <p className="text-[11px] font-[700] uppercase tracking-wider text-muted-foreground/60 mb-2">All Products</p>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-5 w-5 rounded-[6px] bg-lavender/20 mt-0.5">
                      <ArrowUpRight className="h-3 w-3 text-amethyst" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[13px] font-[600] text-foreground">Escalate</p>
                      <p className="text-[11px] font-[460] text-muted-foreground">Escalate this case to supervisors and managers. A notification is sent to the team with your note explaining the issue. Use for complex issues that need supervisor attention.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="flex items-center justify-center h-5 w-5 rounded-[6px] bg-fraud-red-soft mt-0.5">
                      <Flag className="h-3 w-3 text-fraud-red" strokeWidth={2} />
                    </div>
                    <div>
                      <p className="text-[13px] font-[600] text-foreground">Fraud</p>
                      <p className="text-[11px] font-[460] text-muted-foreground">Flag this order for fraud investigation. All supervisors and managers are notified immediately. Use when you suspect fraudulent activity on the order.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button onClick={() => setActionsInfoOpen(false)} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Got it
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Escalate Dialog ─── */}
      {escalateDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] font-[600] text-foreground flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-amethyst" strokeWidth={2} />
                Escalate Case
              </CardTitle>
              <p className="text-[12px] font-[460] text-muted-foreground mt-1">
                Notify supervisors and managers about this customer case.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-amethyst/80">
                  <span className="font-[600]">{[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail}</span> — Order {selectedOrder?.order_number || selectedOrder?.id || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Escalation Note</p>
                <Textarea
                  value={escalateNote}
                  onChange={(e) => setEscalateNote(e.target.value)}
                  placeholder="Describe the issue and why it needs escalation..."
                  className="rounded-[8px] min-h-[80px] text-[13px] font-[460] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setEscalateDialogOpen(false)} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Cancel
                </Button>
                <Button
                  onClick={handleEscalate}
                  disabled={!escalateNote.trim() || escalateLoading}
                  className="rounded-[8px] bg-lavender/20 text-amethyst text-[13px] font-[600] hover:bg-lavender/30 disabled:opacity-40 cursor-pointer"
                >
                  {escalateLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />}
                  Send Escalation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Fraud Flag Dialog ─── */}
      {fraudDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-[16px] font-[600] text-fraud-red flex items-center gap-2">
                <Flag className="h-5 w-5" strokeWidth={2} />
                Flag for Fraud
              </CardTitle>
              <p className="text-[12px] font-[460] text-muted-foreground mt-1">
                Flag this order for fraud investigation. Supervisors will be notified.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-fraud-red/80">
                  <span className="font-[600]">{[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail}</span> — Order {selectedOrder?.order_number || selectedOrder?.id || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason for Fraud Flag</p>
                <Textarea
                  value={fraudNote}
                  onChange={(e) => setFraudNote(e.target.value)}
                  placeholder="Describe the suspected fraud activity..."
                  className="rounded-[8px] min-h-[80px] text-[13px] font-[460] resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setFraudDialogOpen(false)} className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer">
                  Cancel
                </Button>
                <Button
                  onClick={handleFraudFlag}
                  disabled={!fraudNote.trim() || fraudLoading}
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  {fraudLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" strokeWidth={2} />}
                  Confirm Fraud Flag
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Cancel Order Dialog ─── */}
      <CancelDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />

      {/* ─── Refund Dialog ─── */}
      <RefundDialog
        open={refundDialogOpen}
        onClose={() => setRefundDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />

      {/* ─── Connectivity Report Dialog ─── */}
      <ConnectivityDialog
        open={connectivityDialogOpen}
        onClose={() => setConnectivityDialogOpen(false)}
        order={selectedOrder || { id: "" }}
        iccid={selectedSerial || ""}
        agentName={TEAM_MEMBERS.find((m) => m.email === (typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") : ""))?.name || "Agent"}
        agentId={typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : ""}
      />

      {/* ─── 6. INTERNAL NOTES ─── */}
      <InternalNotes customerId={customerEmail} />
    </div>
  );
}

/* ─── Sub-components ─── */

function PlanTable({ plans, showOrder }: { plans: (PlanAttachment & { matchedOrder?: Order })[]; showOrder?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[12px] font-[600]">Plan</TableHead>
            <TableHead className="text-[12px] font-[600]">State</TableHead>
            <TableHead className="text-[12px] font-[600]">Allowance</TableHead>
            <TableHead className="text-[12px] font-[600]">Used</TableHead>
            <TableHead className="text-[12px] font-[600]">Activated</TableHead>
            <TableHead className="text-[12px] font-[600]">Expires</TableHead>
            <TableHead className="text-[12px] font-[600]">Time Left</TableHead>
            {showOrder && <TableHead className="text-[12px] font-[600]">Order</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((pa, i) => {
            const si = planStateInfo(pa.state);
            const SI = si.icon;
            const isFraud = pa.matchedOrder?.status?.toLowerCase().includes("fraud");
            return (
              <TableRow key={i} className={isFraud ? "bg-fraud-red-soft/30" : ""}>
                <TableCell className="text-[13px] font-[460]">
                  {pa.plan?.name || "—"}
                  {pa.plan?.region_code && (
                    <span className="block text-[11px] text-muted-foreground">{getCountryName(pa.plan.region_code)}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <SI className={cn("h-3.5 w-3.5", si.color)} strokeWidth={2} />
                    <span className={cn("text-[12px] font-[500]", si.color)}>{si.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-[13px] font-[460] font-mono">{mbToDisplay(pa.plan?.data_mega_bytes)}</TableCell>
                <TableCell className="text-[13px] font-[460] font-mono">{formatBytes(pa.used_allowance?.dataBytes)}</TableCell>
                <TableCell className="text-[12px] font-[460] text-muted-foreground">{formatDate(pa.activation_at)}</TableCell>
                <TableCell className="text-[12px] font-[460] text-muted-foreground">{formatDate(pa.expiration_at)}</TableCell>
                <TableCell className={cn("text-[12px] font-[600]", {
                  "text-fraud-red": (daysUntil(pa.expiration_at) ?? 999) <= 3,
                  "text-fraud-yellow": (daysUntil(pa.expiration_at) ?? 999) > 3 && (daysUntil(pa.expiration_at) ?? 999) <= 7,
                  "text-muted-foreground": (daysUntil(pa.expiration_at) ?? 999) > 7,
                })}>
                  {daysUntilDisplay(pa.expiration_at)}
                </TableCell>
                {showOrder && (
                  <TableCell className="text-[12px] font-[460]">
                    <div>
                      <span className="font-mono font-[600] text-foreground">{pa.matchedOrder?.order_number || "—"}</span>
                      {isFraud && (
                        <Badge className="ml-1.5 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[10px] font-[600] border-0 px-1.5 py-0">
                          Fraud
                        </Badge>
                      )}
                      {pa.matchedOrder?.customer_email && (
                        <span className="block text-[11px] text-muted-foreground">{pa.matchedOrder.customer_email}</span>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground/50" strokeWidth={1.8} />
        <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60">{label}</p>
      </div>
      <p className="text-[14px] font-[540] text-foreground">{value}</p>
    </div>
  );
}

/** Compact fact pill: icon + small-caps label + value. Used in the Quick Facts strip. */
function QuickFact({ icon: Icon, label, value, sub, tone = "neutral" }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "success" | "warning" | "muted";
}) {
  const color = tone === "success" ? "text-success"
    : tone === "warning" ? "text-fraud-yellow"
    : tone === "muted" ? "text-charcoal/50"
    : "text-charcoal";
  return (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", color)} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="text-[10px] font-[600] uppercase tracking-wider text-charcoal/50 leading-none">{label}</p>
        <p className={cn("text-[13px] font-[540] tabular-nums mt-1 truncate", color)}>{value}</p>
        {sub && <p className="text-[11px] font-[460] text-charcoal/50 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/** Rental quick-facts strip — one row of pills surfacing what a support agent needs on a live call. */
function QuickFactsRental({
  paidAt, amount, currency, tripStart, tripEnd, totalDays, tracking, cdrBytes, isAwaitingFulfillment,
}: {
  paidAt?: string | number;
  amount?: number;
  currency: string;
  tripStart?: string;
  tripEnd?: string;
  totalDays: number | null;
  tracking: NonNullable<Order["tracking_information"]>;
  cdrBytes: number;
  isAwaitingFulfillment: boolean;
}) {
  const paidValue = amount != null ? `${Number(amount).toFixed(0)} ${currency}` : "—";
  const paidSub = paidAt ? formatDate(paidAt) : undefined;

  const tripValue = tripStart && tripEnd
    ? `${formatDate(tripStart)} → ${formatDate(tripEnd)}`
    : "—";
  const tripSub = totalDays !== null ? `${totalDays} day${totalDays === 1 ? "" : "s"}` : undefined;

  // Shipment status: derive from tracking_information. If any leg has an outbound number → shipped.
  const firstLeg = tracking[0];
  const hasOutbound = !!firstLeg?.shipping_tracking_number;
  const shipCarrier = firstLeg?.shipping_carrier;
  const shipValue = isAwaitingFulfillment ? "Not yet fulfilled"
    : hasOutbound ? "Shipped"
    : "No tracking yet";
  const shipSub = hasOutbound && shipCarrier ? `${shipCarrier} · ${firstLeg?.shipping_tracking_number || ""}` : undefined;
  const shipTone = isAwaitingFulfillment ? "warning" : hasOutbound ? "success" : "muted";

  const usageValue = cdrBytes > 0 ? formatBytes(cdrBytes) : "No data yet";
  const usageTone = cdrBytes > 0 ? "neutral" : "muted";

  return (
    <div className="rounded-[8px] border border-parchment bg-background px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
      <QuickFact icon={DollarSign} label="Paid" value={paidValue} sub={paidSub} />
      <QuickFact icon={Plane} label="Trip" value={tripValue} sub={tripSub} />
      <QuickFact icon={Truck} label="Shipping" value={shipValue} sub={shipSub} tone={shipTone} />
      <QuickFact icon={Wifi} label="Usage" value={usageValue} sub="in trip window" tone={usageTone} />
    </div>
  );
}

// Label-above-value field used by the Order Summary card. Cleaner than InfoCell — no leading icon,
// tighter vertical rhythm, charcoal tokens for consistency with design.md.
function SummaryField({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 mb-1">{label}</p>
      <p className={cn("text-[14px] text-charcoal tabular-nums", emphasis ? "font-[600]" : "font-[540]")}>{value}</p>
    </div>
  );
}

function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] bg-background border border-border p-4">
      <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-3">{title}</p>
      {children}
    </div>
  );
}

function ColumnChart({ data, planDataMb }: { data: Array<{ date: string; bytes: number; country: string; sessions: number }>; planDataMb?: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const maxBytes = Math.max(...data.map((d) => d.bytes), 1);
  const chartMax = maxBytes * 1.15;
  const H = 180;
  const padT = 16;
  const padB = 8;
  const plotH = H - padT - padB;
  const labelInterval = data.length > 14 ? Math.ceil(data.length / 10) : 1;
  const planGb = planDataMb ? (planDataMb >= 1024 ? `${(planDataMb / 1024).toFixed(0)} GB` : `${planDataMb} MB`) : null;

  // Use a wide viewBox so coordinates are in real pixels — no aspect-ratio distortion
  const W = 600;
  const padX = 8;
  const plotW = W - padX * 2;

  const pts = data.map((d, i) => {
    const x = data.length === 1 ? W / 2 : padX + (plotW * i) / (data.length - 1);
    const y = d.bytes > 0 ? padT + plotH * (1 - d.bytes / chartMax) : padT + plotH;
    return { x, y, ...d };
  });

  // Catmull-Rom to cubic bezier for smooth curve
  const smoothPath = (() => {
    if (pts.length < 2) return "";
    if (pts.length === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
    const tension = 0.3;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) * tension;
      const cp1y = p1.y + (p2.y - p0.y) * tension;
      const cp2x = p2.x - (p3.x - p1.x) * tension;
      const cp2y = p2.y - (p3.y - p1.y) * tension;
      d += `C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  })();

  const areaPath = smoothPath ? `${smoothPath}L${pts[pts.length - 1].x},${padT + plotH}L${pts[0].x},${padT + plotH}Z` : "";

  // Map mouse position to nearest data point
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || data.length < 2) return;
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(pts[i].x - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  // Grid Y positions
  const gridYs = [0.25, 0.5, 0.75].map((pct) => padT + plotH * pct);

  return (
    <div>
      <div className="flex">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between pr-2" style={{ height: H, width: 48 }}>
          <span className="text-[10px] font-mono font-[500] text-muted-foreground text-right">{formatBytes(maxBytes)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">{formatBytes(maxBytes / 2)}</span>
          <span className="text-[10px] font-mono font-[460] text-muted-foreground/40 text-right">0</span>
        </div>

        {/* Chart area */}
        <div
          ref={containerRef}
          className="flex-1 relative cursor-crosshair"
          style={{ height: H }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full">
            <defs>
              <linearGradient id="usageGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-lavender)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-lavender)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines — dashed, subtle */}
            {gridYs.map((gy, i) => (
              <line key={i} x1={padX} y1={gy} x2={W - padX} y2={gy} stroke="var(--color-parchment)" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.6" />
            ))}
            {/* Baseline */}
            <line x1={padX} y1={padT + plotH} x2={W - padX} y2={padT + plotH} stroke="var(--color-parchment)" strokeWidth="1" strokeOpacity="0.4" />

            {/* Area fill */}
            {areaPath && <path d={areaPath} fill="url(#usageGrad)" />}

            {/* Smooth line */}
            {smoothPath && (
              <path d={smoothPath} fill="none" stroke="var(--color-amethyst)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {/* Hover crosshair */}
            {hoveredIdx !== null && (
              <line x1={pts[hoveredIdx].x} y1={padT} x2={pts[hoveredIdx].x} y2={padT + plotH} stroke="var(--color-amethyst)" strokeWidth="1" strokeOpacity="0.3" strokeDasharray="3 3" />
            )}

            {/* Data dots — only show on hover or if few points */}
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hoveredIdx === i ? 5 : (data.length <= 14 && p.bytes > 0) ? 2.5 : 0}
                fill={hoveredIdx === i ? "var(--color-amethyst)" : "var(--color-lavender)"}
                stroke={hoveredIdx === i ? "white" : "none"}
                strokeWidth={hoveredIdx === i ? 2 : 0}
                className="transition-all duration-150"
              />
            ))}
          </svg>

          {/* Tooltip */}
          {hoveredIdx !== null && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${(pts[hoveredIdx].x / W) * 100}%`,
                top: `${(pts[hoveredIdx].y / H) * 100}%`,
                transform: "translate(-50%, calc(-100% - 12px))",
              }}
            >
              <div className="rounded-[8px] bg-mysteria text-white px-3 py-2 text-[11px] font-[500] whitespace-nowrap shadow-lg">
                <div className="font-[600] text-[12px]">{formatBytes(data[hoveredIdx].bytes)}</div>
                <div className="text-white/60 mt-0.5">
                  {new Date(data[hoveredIdx].date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {data[hoveredIdx].country && ` · ${getCountryName(data[hoveredIdx].country)}`}
                  {` · ${data[hoveredIdx].sessions} session${data[hoveredIdx].sessions !== 1 ? "s" : ""}`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex mt-1" style={{ paddingLeft: 48 }}>
        <div className="flex-1 flex" style={{ gap: 2 }}>
          {data.map((d, i) => {
            const dt = new Date(d.date);
            const dayName = dt.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
            const dayNum = dt.getDate();
            return (
              <div key={i} className="flex-1 text-center">
                {(i % labelInterval === 0 || i === data.length - 1) && (
                  <span className={cn(
                    "text-[9px] font-[460] leading-tight block",
                    d.bytes > 0 ? "text-muted-foreground" : "text-muted-foreground/30"
                  )}>
                    {dayName}-{dayNum}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary row */}
      <div className="flex items-center justify-between mt-3 px-1 flex-wrap gap-2">
        <span className="text-[11px] font-[460] text-muted-foreground">
          Total: <span className="font-[600] text-foreground">{formatBytes(data.reduce((sum, d) => sum + d.bytes, 0))}</span>
        </span>
        <span className="text-[11px] font-[460] text-muted-foreground">
          Peak day: <span className="font-[600] text-foreground">{formatBytes(maxBytes)}</span>
        </span>
        {planGb && (
          <span className="text-[11px] font-[460] text-muted-foreground">
            Plan: <span className="font-[600] text-amethyst">{planGb}</span>
          </span>
        )}
        <span className="text-[11px] font-[460] text-muted-foreground">
          Active: <span className="font-[600] text-foreground">{data.filter(d => d.bytes > 0).length} days</span>
        </span>
      </div>
    </div>
  );
}

/* ─── Data Sources panel — exposes raw API payloads + per-source status / field list ─── */
interface DataSourcesPanelProps {
  ucl: { data: Record<string, unknown> | null; error: string | null };
  cdr: { records: Array<Record<string, unknown>>; total: number };
}

function DataSourcesPanel({ ucl, cdr }: DataSourcesPanelProps) {
  // Field summary helper — counts populated keys, returns sorted name list
  function summariseFields(obj: Record<string, unknown> | null | undefined): { count: number; fields: string[] } {
    if (!obj) return { count: 0, fields: [] };
    const fields = Object.keys(obj).filter((k) => obj[k] !== null && obj[k] !== undefined && obj[k] !== "");
    return { count: fields.length, fields: fields.sort() };
  }
  function valuePreview(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v).slice(0, 60);
    const s = String(v);
    return s.length > 60 ? s.slice(0, 60) + "…" : s;
  }

  const uclSummary = summariseFields(ucl.data);
  const cdrSample = cdr.records[0] || null;
  const cdrSummary = summariseFields(cdrSample);

  const uclStatus: { label: string; color: string; bg: string } = ucl.error
    ? { label: "Error", color: "text-fraud-red", bg: "bg-fraud-red-soft" }
    : ucl.data
    ? { label: `${uclSummary.count} field${uclSummary.count === 1 ? "" : "s"}`, color: "text-success", bg: "bg-success-soft" }
    : { label: "No data", color: "text-muted-foreground", bg: "bg-muted" };

  const cdrStatus: { label: string; color: string; bg: string } = cdr.total > 0
    ? { label: `${cdr.total.toLocaleString()} record${cdr.total === 1 ? "" : "s"}`, color: "text-success", bg: "bg-success-soft" }
    : { label: "No records", color: "text-muted-foreground", bg: "bg-muted" };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/70">Data Sources</p>

      {/* UCL binding source */}
      <details className="rounded-[8px] border border-border bg-background overflow-hidden group">
        <summary className="cursor-pointer flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
          <span className="text-[12px] font-[600] text-foreground">UCL · QueryBindingRelationInfo</span>
          <span className={cn("text-[10px] font-[700] rounded-[8px] px-1.5 py-0.5", uclStatus.color, uclStatus.bg)}>
            {uclStatus.label}
          </span>
          <span className="text-[10px] font-[460] text-muted-foreground ml-auto">/api/ucl/device-info</span>
        </summary>
        <div className="px-3 py-3 border-t border-border bg-parchment/30 space-y-3">
          {ucl.error && (
            <p className="text-[12px] font-[460] text-fraud-red">{ucl.error}</p>
          )}
          {ucl.data && uclSummary.fields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {uclSummary.fields.map((k) => (
                <div key={k} className="flex items-baseline gap-2 text-[11px] font-mono">
                  <span className="font-[600] text-amethyst">{k}</span>
                  <span className="text-foreground truncate">{valuePreview((ucl.data as Record<string, unknown>)[k])}</span>
                </div>
              ))}
            </div>
          )}
          {ucl.data && (
            <details>
              <summary className="cursor-pointer text-[10px] font-[600] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                Raw JSON
              </summary>
              <pre className="mt-2 overflow-auto text-[11px] font-mono leading-relaxed text-foreground max-h-80 bg-background rounded-[8px] p-2 border border-border">
                {JSON.stringify(ucl.data, null, 2)}
              </pre>
            </details>
          )}
          {!ucl.data && !ucl.error && (
            <p className="text-[12px] font-[460] text-muted-foreground italic">No payload returned.</p>
          )}
        </div>
      </details>

      {/* OpenSearch CDR source */}
      <details className="rounded-[8px] border border-border bg-background overflow-hidden">
        <summary className="cursor-pointer flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
          <span className="text-[12px] font-[600] text-foreground">OpenSearch · CDR by IMEI</span>
          <span className={cn("text-[10px] font-[700] rounded-[8px] px-1.5 py-0.5", cdrStatus.color, cdrStatus.bg)}>
            {cdrStatus.label}
          </span>
          <span className="text-[10px] font-[460] text-muted-foreground ml-auto">logstash-cdr*</span>
        </summary>
        <div className="px-3 py-3 border-t border-border bg-parchment/30 space-y-3">
          {cdrSample ? (
            <>
              <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground">
                Sample record fields ({cdrSummary.count})
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {cdrSummary.fields.map((k) => (
                  <div key={k} className="flex items-baseline gap-2 text-[11px] font-mono">
                    <span className="font-[600] text-amethyst">{k}</span>
                    <span className="text-foreground truncate">{valuePreview(cdrSample[k])}</span>
                  </div>
                ))}
              </div>
              <details>
                <summary className="cursor-pointer text-[10px] font-[600] uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  Raw record
                </summary>
                <pre className="mt-2 overflow-auto text-[11px] font-mono leading-relaxed text-foreground max-h-80 bg-background rounded-[8px] p-2 border border-border">
                  {JSON.stringify(cdrSample, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <p className="text-[12px] font-[460] text-muted-foreground italic">No CDR records returned for this IMEI in the selected date range.</p>
          )}
        </div>
      </details>
    </div>
  );
}

/* ─── Shipping tracking — outbound + return legs for rental orders ─── */
function carrierTrackUrl(carrier: string, tracking: string): string | null {
  if (!tracking) return null;
  const c = carrier.toUpperCase().trim();
  const t = encodeURIComponent(tracking);
  if (c === "UPS") return `https://www.ups.com/track?loc=en_US&tracknum=${t}`;
  if (c === "FEDEX") return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c === "USPS") return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${t}`;
  if (c === "DHL") return `https://www.dhl.com/en/express/tracking.html?AWB=${t}`;
  return null;
}

function TrackingLegRow({
  direction, carrier, tracking, isFirst, isLast,
}: {
  direction: "outbound" | "return";
  carrier?: string;
  tracking?: string;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const isOutbound = direction === "outbound";
  const label = isOutbound ? "Outbound" : "Return";
  const url = carrier && tracking ? carrierTrackUrl(carrier, tracking) : null;
  const hasData = !!(carrier || tracking);

  return (
    <div className="relative flex items-start gap-3 py-3">
      {/* Timeline rail — dot for this leg, line connecting to the next */}
      <div className="relative flex flex-col items-center w-4 shrink-0 self-stretch">
        {!isFirst && <div className="absolute top-0 h-2.5 w-px bg-parchment" />}
        <div className={cn(
          "mt-1.5 h-2 w-2 rounded-full border-2",
          hasData ? "border-charcoal bg-charcoal" : "border-charcoal/30 bg-background"
        )} />
        {!isLast && <div className="absolute top-5 bottom-0 w-px bg-parchment" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-[540] text-charcoal">{label}</span>
          {carrier && (
            <span className="text-[10px] font-[700] uppercase tracking-wider rounded-[8px] bg-parchment text-charcoal px-1.5 py-0.5">
              {carrier}
            </span>
          )}
        </div>
        {hasData ? (
          <div className="flex items-center gap-2 flex-wrap">
            {tracking ? (
              <code className="text-[13px] font-mono font-[460] text-charcoal tabular-nums">
                {tracking}
              </code>
            ) : (
              <span className="text-[13px] font-[460] text-charcoal/50">Pending</span>
            )}
          </div>
        ) : (
          <span className="text-[13px] font-[460] text-charcoal/50">
            {isOutbound ? "Not yet shipped" : "Return label not issued"}
          </span>
        )}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-[600] rounded-[8px] bg-cream text-charcoal hover:opacity-90 px-3 py-1.5 transition-opacity shrink-0 self-start"
          aria-label={`Track ${label.toLowerCase()} shipment on ${carrier} in a new tab`}
        >
          Track <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      )}
    </div>
  );
}

function TrackingSection({ tracking }: { tracking: NonNullable<Order["tracking_information"]> }) {
  // Rendered inline inside the Fulfillment card — no outer border/radius to avoid
  // double-card nesting. The parent card provides the container.
  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <p className="text-[11px] font-[600] uppercase tracking-wider text-charcoal/60 flex items-center gap-1.5">
          <Truck className="h-3 w-3" strokeWidth={1.8} />
          Shipment Tracking
        </p>
        {tracking.length > 1 && (
          <span className="text-[11px] font-[460] text-charcoal/60">
            {tracking.length} devices
          </span>
        )}
      </div>

      <div className="divide-y divide-parchment/60">
        {tracking.map((t, i) => {
          const serial = t.device_serial !== undefined ? String(t.device_serial) : "";
          return (
            <div key={t.fulfillment_id ? String(t.fulfillment_id) : i} className="py-1">
              {serial && tracking.length > 1 && (
                <div className="flex items-center gap-2 pb-1">
                  <span className="text-[10px] font-[600] uppercase tracking-wider text-charcoal/50">Device</span>
                  <code className="text-[12px] font-mono font-[460] text-charcoal">{serial}</code>
                </div>
              )}
              <div>
                <TrackingLegRow
                  direction="outbound"
                  carrier={t.shipping_carrier}
                  tracking={t.shipping_tracking_number}
                  isFirst
                />
                <TrackingLegRow
                  direction="return"
                  carrier={t.return_carrier}
                  tracking={t.return_tracking_number}
                  isLast
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Per-plan breakdown — UCL offers with source (Purchased / Pre-loaded) ─── */
interface SapphirePlansListProps {
  offers: Array<Record<string, unknown>>;
  allOrders: Order[];
  selectedPackageSku?: string;
  filterToCustomer?: boolean;
}

function SapphirePlansList({ offers, allOrders, selectedPackageSku, filterToCustomer }: SapphirePlansListProps) {
  if (!offers || offers.length === 0) {
    return (
      <div className="rounded-[8px] border border-dashed border-border bg-muted/10 px-4 py-6 text-center">
        <p className="text-[12px] font-[460] text-muted-foreground">
          No UCL offers returned yet. Plan details will appear here once the device-info call succeeds.
        </p>
      </div>
    );
  }

  // Pair each offer with its matching storefront order.
  // For rentals (filterToCustomer=true): the IMEI recycles across renters and plan SKUs
  // repeat, so SKU alone is ambiguous — require the offer's effectiveTime to fall inside
  // the order's trip window. For non-rentals: SKU match alone is sufficient.
  // allOrders is scoped to the current customer's email, so any match means the offer belongs to this customer.
  const paired = offers.map((offer) => {
    const goodsCode = (offer.goodsCode as string | undefined) || "";
    const effMs = Number(offer.effectiveTime || 0);

    const matchingOrder = allOrders.find((o) => {
      if (!filterToCustomer) {
        return goodsCode
          ? o.order_details_data?.some((d) => d.package_sku === goodsCode)
          : false;
      }
      const line = o.order_details_data?.find((d) => d.trip_start || d.trip_end);
      const startMs = line?.trip_start ? new Date(line.trip_start).getTime() : 0;
      const endMs = line?.trip_end ? new Date(line.trip_end).getTime() : 0;
      return startMs > 0 && endMs > 0 && effMs >= startMs && effMs <= endMs;
    });

    return { offer, matchingOrder };
  });

  // Rentals: IMEI recycles through the fleet, so drop offers not tied to any of this customer's orders.
  const visible = filterToCustomer ? paired.filter((p) => p.matchingOrder) : paired;

  // Newest first
  const sorted = [...visible].sort((a, b) => {
    const ae = (a.offer.effectiveTime as number) || 0;
    const be = (b.offer.effectiveTime as number) || 0;
    return be - ae;
  });

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/70">
        Plans ({sorted.length})
      </p>
      <div className="space-y-2">
        {sorted.map(({ offer, matchingOrder }, i) => {
          const goodsCode = (offer.goodsCode as string | undefined) || "";
          return (
            <SapphirePlanRow
              key={(offer.relationId as string) || (offer.orderId as string) || i}
              offer={offer}
              matchingOrder={matchingOrder}
              isSelected={!!selectedPackageSku && goodsCode === selectedPackageSku}
              isRental={!!filterToCustomer}
            />
          );
        })}
      </div>
    </div>
  );
}

function SapphirePlanRow({
  offer, matchingOrder, isSelected, isRental,
}: {
  offer: Record<string, unknown>;
  matchingOrder: Order | undefined;
  isSelected: boolean;
  isRental?: boolean;
}) {
  const cap = Number(offer.flowByte || 0);              // MB, per UCL spec
  const remaining = Number(offer.surplusFlowbyte || 0); // MB
  const usedMb = Math.max(cap - remaining, 0);
  const usedPct = cap > 0 ? Math.min((usedMb / cap) * 100, 100) : 0;
  const isUnlimited = (offer.attrMap as Record<string, unknown> | undefined)?.infiniFlag === "true";

  const status = (offer.status as string) || "";
  const statusMeta = sapphirePlanStatusMeta(status);
  // Rental plans are removed from the device when the trip ends, so flowByte/surplus go to 0.
  // Treat EXPIRE/USE_END/UNSUBSCRIBE as "plan no longer on device" — hide misleading 0 MB / 0 MB counters.
  const isRentalExpired = isRental && (status === "EXPIRE" || status === "INVALID" || status === "USE_END" || status === "UNSUBSCRIBE");

  const attrMap = (offer.attrMap as Record<string, unknown> | undefined) || {};
  const pkType = attrMap.pkType as string | undefined;
  const source = sapphirePlanSource(pkType, offer.orderId as string | null | undefined);

  const goodsCode = (offer.goodsCode as string) || "";
  const goodsName = (offer.goodsName as string) || goodsCode || "Plan";
  const parsed = parsePlanSku(goodsCode);
  const flag = parsed ? getCountryFlag(parsed.countryCode) : "";

  // Plan duration — prefer UCL attrMap.period (more reliable), fall back to parsed SKU.
  const periodRaw = attrMap.period ? Number(attrMap.period) : parsed?.days || 0;
  const periodUnit = (attrMap.periodUnit as string) || "DAY";
  const periodLabel = periodRaw > 0
    ? (periodUnit === "MONTH" ? `${periodRaw} mo` : `${periodRaw} day${periodRaw === 1 ? "" : "s"}`)
    : "";

  const effMs = Number(offer.effectiveTime || 0);
  const expMs = Number(offer.expiryTime || 0);
  const expiresIn = expMs > 0 ? daysUntilDisplay(new Date(expMs).toISOString()) : "—";

  const orderNumber = matchingOrder?.order_number;

  const StatusIcon = statusMeta.icon;

  return (
    <div
      className={cn(
        "rounded-[8px] border bg-background px-4 py-3 transition-colors",
        isSelected ? "border-amethyst shadow-sm" : "border-border",
        status === "USE_END" || status === "EXPIRE" ? "opacity-75" : ""
      )}
    >
      <div className="flex items-start gap-3">
        {/* Left: title + country */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {flag && <span className="text-[14px]" aria-hidden>{flag}</span>}
            <p className="text-[14px] font-[540] text-foreground truncate">{goodsName}</p>
            {isSelected && (
              <span className="text-[10px] font-[700] uppercase tracking-wider rounded-[8px] bg-amethyst/10 text-amethyst px-1.5 py-0.5">
                Selected order
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-[700] uppercase tracking-wider rounded-[8px] px-1.5 py-0.5",
                statusMeta.bg,
                statusMeta.color
              )}
            >
              <StatusIcon className="h-3 w-3" strokeWidth={2} />
              {statusMeta.label}
            </span>
            <span
              className={cn(
                "text-[10px] font-[700] uppercase tracking-wider rounded-[8px] px-1.5 py-0.5",
                source.bg,
                source.color
              )}
              title={source.tooltip}
            >
              {source.label}
            </span>
            {orderNumber && (
              <span
                className="text-[10px] font-[600] font-mono rounded-[8px] bg-muted text-foreground px-1.5 py-0.5"
                title="Matching storefront order"
              >
                {orderNumber}
              </span>
            )}
            {!orderNumber && source.label === "Purchased" && (
              <span
                className="text-[10px] font-[600] uppercase tracking-wider rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow px-1.5 py-0.5"
                title="UCL shows a purchase but we have no matching order in OpenSearch"
              >
                No OS match
              </span>
            )}
            {periodLabel && (
              <span className="text-[11px] font-[460] text-muted-foreground">{periodLabel}</span>
            )}
            {effMs > 0 && expMs > 0 && (
              <span className="text-[11px] font-[460] text-muted-foreground">
                {formatDate(new Date(effMs).toISOString())} → {formatDate(new Date(expMs).toISOString())}
              </span>
            )}
          </div>
        </div>

        {/* Right: numbers. Rental FUP plans give {dataGB} GB/day at full speed; throttled after.
            Once the trip ends, UCL zeros out flowByte so we show "Expired" instead of 0 MB / 0 MB. */}
        <div className="text-right shrink-0">
          {isRentalExpired ? (
            <p className="text-[14px] font-[600] text-muted-foreground">Expired</p>
          ) : isRental && !isUnlimited && parsed?.dataGB ? (
            <>
              <p className="text-[14px] font-[600] font-mono text-foreground tabular-nums">
                {parsed.dataGB} GB<span className="text-[11px] font-[460] text-muted-foreground">/day</span>
              </p>
              <p className="text-[10px] font-[500] uppercase tracking-wider text-muted-foreground mt-0.5">
                FUP · reduced speed after cap
              </p>
            </>
          ) : (
            <p className="text-[14px] font-[600] font-mono text-foreground tabular-nums">
              {isUnlimited ? "Unlimited" : `${formatMb(usedMb)} / ${formatMb(cap)}`}
            </p>
          )}
          {!isRentalExpired && (
            <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
              {status === "IN_USING" ? expiresIn : status === "USE_END" ? "Depleted" : statusMeta.label}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar — hide for rentals (per-day FUP, not a single bucket) and for expired plans */}
      {!isUnlimited && !isRental && !isRentalExpired && cap > 0 && (
        <div
          className="h-1.5 rounded-full bg-parchment overflow-hidden mt-3"
          role="progressbar"
          aria-label={`${usedPct.toFixed(0)}% of ${goodsName} used`}
          aria-valuenow={Math.round(usedPct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300 ease-out",
              status === "USE_END" ? "bg-muted-foreground/40"
                : usedPct >= 90 ? "bg-fraud-red"
                : usedPct >= 75 ? "bg-fraud-yellow"
                : "bg-lavender"
            )}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function sapphirePlanStatusMeta(status: string): {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
} {
  switch (status) {
    case "IN_USING":
    case "VALID":
      return { label: "Active", icon: CheckCircle2, color: "text-success", bg: "bg-success-soft" };
    case "NOT_ACTIVATED":
      return { label: "Pending", icon: Clock, color: "text-fraud-yellow", bg: "bg-fraud-yellow-soft" };
    case "USE_END":
      return { label: "Depleted", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted" };
    case "EXPIRE":
    case "INVALID":
      // UCL returns INVALID once a rental plan has been removed from the device (post-trip teardown).
      // Functionally identical to EXPIRE from a support perspective.
      return { label: "Expired", icon: Clock, color: "text-muted-foreground", bg: "bg-muted" };
    case "UNSUBSCRIBE":
      return { label: "Unsubscribed", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted" };
    case "TRANSFER":
      return { label: "Transferred", icon: AlertCircle, color: "text-amethyst", bg: "bg-lavender/10" };
    default:
      return { label: status || "Unknown", icon: AlertCircle, color: "text-muted-foreground", bg: "bg-muted" };
  }
}

function sapphirePlanSource(pkType: string | undefined, orderId: string | null | undefined): {
  label: string;
  color: string;
  bg: string;
  tooltip: string;
} {
  // CSTC = factory / pre-loaded allowance. Never has a sale behind it.
  if (pkType === "CSTC" || !orderId) {
    return {
      label: "Pre-loaded",
      color: "text-amethyst",
      bg: "bg-lavender/10",
      tooltip: "Factory-bundled allowance (no purchase). Activates automatically.",
    };
  }
  // SWTC = normal storefront sale.
  return {
    label: "Purchased",
    color: "text-success",
    bg: "bg-success-soft",
    tooltip: "Sold through our storefront. Expect a matching order in OpenSearch.",
  };
}

/** Format UCL flowByte (which is MB, not bytes) into GB/MB display. */
function formatMb(mb: number): string {
  if (!mb || mb <= 0) return "0 MB";
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 2)} GB`;
  return `${mb.toFixed(mb < 10 ? 2 : 0)} MB`;
}

/* ─── Stacked daily-usage chart, colored by plan (recharts) ─── */
// Chart palette — all derived from design.md brand tokens and picked so each
// fill + stroke pair meets WCAG 3:1 for graphical elements on a white surface.
// Order matches visual priority: newest plan (usually the current one) gets the
// strongest colour; depleted/historical plans recede.
const PLAN_COLOR_HEX = [
  "#714cb6", // 1 · Amethyst Link — vivid brand purple, high contrast
  "#1b1938", // 2 · Mysteria — near-black purple for the deepest emphasis
  "#a88dd6", // 3 · Mid-lavender (interpolated between amethyst & lavender)
  "#4a3575", // 4 · Dark plum (interpolated between mysteria & amethyst)
  "#cbb7fb", // 5 · Lavender Glow — softer tint, always paired with the darker stroke
];
const UNMATCHED_HEX = "#7c7770"; // Warm charcoal-gray for unaligned sessions

/**
 * Rental daily FUP chart — stacked bars per day showing full-speed (≤ daily cap) vs throttled (over cap).
 * Rental plans reset data at midnight; cap is the SKU's dataGB. Use for rentals only.
 */
function RentalDailyFupChart({
  cdrRecords, dailyCapGb, tripStart, tripEnd,
}: {
  cdrRecords: Array<Record<string, unknown>>;
  dailyCapGb: number;
  tripStart?: string;
  tripEnd?: string;
}) {
  const capMb = dailyCapGb > 0 ? dailyCapGb * 1024 : 0;

  const byDay = new Map<string, number>();
  for (const rec of cdrRecords) {
    const tsStr = (rec["@timestamp"] as string) || (rec["USAGE_DATE_UTC"] as string) || "";
    if (!tsStr) continue;
    const dayKey = tsStr.slice(0, 10);
    const bytes = Number(rec["TOTAL_QTY"] || rec["flowsize"] || 0);
    if (!bytes) continue;
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + bytes / 1_048_576);
  }

  // Pad range to full trip so empty days render as zero bars.
  const startDay = tripStart ? tripStart.slice(0, 10) : (byDay.size ? [...byDay.keys()].sort()[0] : "");
  const endDay = tripEnd ? tripEnd.slice(0, 10) : (byDay.size ? [...byDay.keys()].sort().slice(-1)[0] : "");
  if (!startDay || !endDay) {
    return (
      <p className="text-[12px] font-[460] text-muted-foreground py-6 text-center">
        No trip window set — cannot render daily FUP chart.
      </p>
    );
  }

  const days: string[] = [];
  for (let d = new Date(startDay); d <= new Date(endDay); d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  const data = days.map((day) => {
    const totalMb = byDay.get(day) || 0;
    const fullMb = capMb > 0 ? Math.min(totalMb, capMb) : totalMb;
    const overMb = capMb > 0 ? Math.max(totalMb - capMb, 0) : 0;
    return { day, fullMb: Math.round(fullMb), overMb: Math.round(overMb) };
  });

  return <RentalFupCanvas data={data} capMb={capMb} />;
}

function RentalFupCanvas({
  data, capMb,
}: {
  data: Array<{ day: string; fullMb: number; overMb: number }>;
  capMb: number;
}) {
  const Recharts = useRechartsLazy();
  if (!Recharts) {
    return (
      <div className="h-64 flex items-center justify-center text-[12px] font-[460] text-muted-foreground">
        Loading chart…
      </div>
    );
  }
  const { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine } = Recharts;
  const fmtDay = (d: string) => {
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dt = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const fmtMb = (mb: number) => mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dcd7d3" />
          <XAxis dataKey="day" tickFormatter={fmtDay} tick={{ fontSize: 11, fill: "#7a6e99" }} />
          <YAxis tickFormatter={fmtMb} tick={{ fontSize: 11, fill: "#7a6e99" }} width={60} />
          <Tooltip
            formatter={((v: unknown, name: unknown) => [fmtMb(Number(v) || 0), name === "fullMb" ? "Full speed" : "Throttled"]) as never}
            labelFormatter={((d: unknown) => fmtDay(String(d ?? ""))) as never}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend
            verticalAlign="bottom"
            wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
            formatter={(v: string) => v === "fullMb" ? "Full speed (≤ daily cap)" : "Throttled (over cap)"}
          />
          {capMb > 0 && (
            <ReferenceLine y={capMb} stroke="#b3a0d9" strokeDasharray="4 4" label={{ value: `Cap: ${fmtMb(capMb)}`, fontSize: 10, fill: "#7a6e99", position: "right" }} />
          )}
          <Bar dataKey="fullMb" stackId="a" fill="#6b46c1" radius={[0, 0, 0, 0]} />
          <Bar dataKey="overMb" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SapphireUsagePerPlanChart({
  cdrRecords,
  offers,
}: {
  cdrRecords: Array<Record<string, unknown>>;
  offers: Array<Record<string, unknown>>;
}) {
  if (!cdrRecords || cdrRecords.length === 0) {
    return (
      <p className="text-[12px] font-[460] text-muted-foreground py-6 text-center">
        No usage recorded for this IMEI in the selected range.
      </p>
    );
  }

  // Plan index — newest first, each gets a stable palette slot
  const planIndex = [...offers]
    .sort((a, b) => Number(b.effectiveTime || 0) - Number(a.effectiveTime || 0))
    .map((o, i) => {
      const goodsCode = (o.goodsCode as string) || "";
      const pretty = (o.goodsName as string) || goodsCode || `Plan ${i + 1}`;
      return {
        key: goodsCode || `offer-${i}`,
        label: pretty,
        effMs: Number(o.effectiveTime || 0),
        expMs: Number(o.expiryTime || 0),
        color: PLAN_COLOR_HEX[i % PLAN_COLOR_HEX.length],
      };
    });

  function matchPlan(tsMs: number): { key: string; label: string; color: string } {
    for (const p of planIndex) {
      if (p.effMs && p.expMs && tsMs >= p.effMs && tsMs <= p.expMs) {
        return { key: p.key, label: p.label, color: p.color };
      }
    }
    return { key: "unmatched", label: "Unmatched", color: UNMATCHED_HEX };
  }

  // Aggregate per-day per-plan MB (recharts wants one object per X tick,
  // with each series as a property).
  const byDay = new Map<string, Record<string, number>>();
  const seriesMap = new Map<string, { key: string; label: string; color: string; totalMb: number }>();

  for (const rec of cdrRecords) {
    const tsStr = (rec["@timestamp"] as string) || (rec["USAGE_DATE_UTC"] as string) || "";
    if (!tsStr) continue;
    const dt = new Date(tsStr);
    if (isNaN(dt.getTime())) continue;
    const dayKey = tsStr.slice(0, 10);
    const bytes = Number(rec["TOTAL_QTY"] || rec["flowsize"] || 0);
    if (!bytes) continue;
    const mb = bytes / 1_048_576;
    const match = matchPlan(dt.getTime());

    if (!byDay.has(dayKey)) byDay.set(dayKey, {});
    const row = byDay.get(dayKey)!;
    row[match.key] = (row[match.key] || 0) + mb;

    const existing = seriesMap.get(match.key);
    if (existing) existing.totalMb += mb;
    else seriesMap.set(match.key, { key: match.key, label: match.label, color: match.color, totalMb: mb });
  }

  if (byDay.size === 0) {
    return (
      <p className="text-[12px] font-[460] text-muted-foreground py-6 text-center">
        No usage recorded for this IMEI in the selected range.
      </p>
    );
  }

  // Fill gaps: continuous date range so the chart doesn't skip days
  const allDays = [...byDay.keys()].sort();
  const start = new Date(allDays[0]);
  const end = new Date(allDays[allDays.length - 1]);
  const filled: string[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    filled.push(d.toISOString().slice(0, 10));
  }

  const series = [...seriesMap.values()].sort((a, b) => b.totalMb - a.totalMb);
  const chartData = filled.map((day) => {
    const row: Record<string, string | number> = { day };
    for (const s of series) row[s.key] = byDay.get(day)?.[s.key] || 0;
    return row;
  });

  return (
    <SapphireUsageChartCanvas
      data={chartData}
      series={series}
    />
  );
}

function SapphireUsageChartCanvas({
  data,
  series,
}: {
  data: Array<Record<string, string | number>>;
  series: Array<{ key: string; label: string; color: string; totalMb: number }>;
}) {
  // Dynamic import keeps the recharts bundle out of the main page chunk
  const Recharts = useRechartsLazy();
  if (!Recharts) {
    return (
      <div className="h-64 flex items-center justify-center text-[12px] font-[460] text-muted-foreground">
        Loading chart…
      </div>
    );
  }
  const { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } = Recharts;

  const fmtMb = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    if (mb >= 1) return `${mb.toFixed(0)} MB`;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.55} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dcd7d3" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: "#292827", fontWeight: 460 }}
              tickFormatter={(d: string) => d.slice(5)}
              tickLine={false}
              axisLine={{ stroke: "#e7e4dd" }}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#292827", fontWeight: 460 }}
              tickFormatter={(mb: number) => fmtMb(mb)}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e7e4dd",
                background: "#ffffff",
                fontSize: 12,
                fontWeight: 460,
                padding: 8,
              }}
              labelStyle={{ fontWeight: 600, color: "#2d1b5b", marginBottom: 4 }}
              formatter={(value, name) => {
                const match = series.find((s) => s.key === String(name));
                return [fmtMb(Number(value) || 0), match?.label || String(name)];
              }}
              labelFormatter={(d) => String(d ?? "")}
            />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stackId="1"
                name={s.key}
                // Always stroke in the darker Mysteria tone so pale fills stay legible on white
                stroke="#1b1938"
                strokeWidth={1.25}
                strokeOpacity={0.7}
                fill={`url(#grad-${s.key})`}
                activeDot={{ r: 3, fill: s.color, stroke: "#1b1938", strokeWidth: 1 }}
                isAnimationActive
                animationDuration={300}
              />
            ))}
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ paddingTop: 12, fontSize: 11 }}
              formatter={(value: string) => {
                const match = series.find((s) => s.key === value);
                return (
                  <span style={{ color: "#2d1b5b", fontWeight: 540 }}>
                    {match?.label || value}
                  </span>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Lazy-load recharts on the client only (avoids SSR bundle bloat). */
type RechartsModule = typeof import("recharts");
function useRechartsLazy(): RechartsModule | null {
  const [mod, setMod] = useState<RechartsModule | null>(null);
  useEffect(() => {
    let mounted = true;
    import("recharts").then((m) => {
      if (mounted) setMod(m);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return mod;
}

/* ─── Sapphire / Rental device card — renders UCL device info + IMEI usage history ─── */
interface SapphireDeviceCardProps {
  imei: string;
  deviceInfo: Record<string, unknown> | null;
  deviceInfoError: string | null;
  userOffers: Array<Record<string, unknown>>;
  allOrders: Order[];
  cdrRecords: Array<Record<string, unknown>>;
  cdrTotal: number;
  dailyUsage: Array<{ date: string; bytes: number; country: string; sessions: number }>;
  packageSku: string;
  tripStart?: string;
  tripEnd?: string;
  orderCreatedAt?: string | number;
  productType: "esim" | "rental" | "sapphire" | "unknown";
  onCopy: (value: string) => void;
  copied: boolean;
  terminalStatus: Record<string, unknown> | null;
  terminalStatusLoading: boolean;
  terminalStatusError: string | null;
  terminalStatusCachedAt: number | null;
  onSyncTerminalStatus: () => void;
}

function SapphireDeviceCard({
  imei, deviceInfo, deviceInfoError, userOffers, allOrders, cdrRecords, cdrTotal, dailyUsage,
  packageSku, tripStart, tripEnd, orderCreatedAt, productType, onCopy, copied,
  terminalStatus, terminalStatusLoading, terminalStatusError, terminalStatusCachedAt, onSyncTerminalStatus,
}: SapphireDeviceCardProps) {
  const [kbOpen, setKbOpen] = useState(false);
  const parsed = parsePlanSku(packageSku);
  const flag = parsed ? getCountryFlag(parsed.countryCode) : "";

  // UCL QueryBindingRelationInfo returns TerminalActivationVo (spec §5.6.5):
  //   id, customerId, customerName, imei, createTime (ms GMT0),
  //   status (BINDING|BINDED), isLocked (bool), terminalType (eg G2, E1).
  // Firmware version and full model name are NOT exposed by this endpoint.
  const terminalType = (deviceInfo?.terminalType as string) || "";
  const deviceName = getSapphireDeviceName({ terminalType, imei });
  const model = deviceName.name;
  const bindingStatusRaw = (deviceInfo?.status as string) || "";
  const bindingStatus =
    bindingStatusRaw === "BINDED" ? "Active (used MiFi)"
    : bindingStatusRaw === "BINDING" ? "Paired (not yet used)"
    : bindingStatusRaw;
  const isLocked = deviceInfo?.isLocked === true;
  const subUser = (deviceInfo?.customerName as string) || (deviceInfo?.customerId as string) || "";
  const createTimeMs = typeof deviceInfo?.createTime === "number"
    ? (deviceInfo.createTime as number)
    : deviceInfo?.createTime ? Number(deviceInfo.createTime) : 0;
  const activationAt = createTimeMs > 0
    ? new Date(createTimeMs).toISOString()
    : (orderCreatedAt ? new Date(
        typeof orderCreatedAt === "number"
          ? (orderCreatedAt > 1e12 ? orderCreatedAt : orderCreatedAt * 1000)
          : orderCreatedAt
      ).toISOString() : "");

  // Remaining days — prefer trip_end when rental has one, else derive from plan duration + activation
  const expiryRef = tripEnd || (parsed?.days && activationAt
    ? new Date(new Date(activationAt).getTime() + parsed.days * 86400000).toISOString()
    : null);
  const remaining = expiryRef ? daysUntil(expiryRef) : null;

  const totalBytes = dailyUsage.reduce((s, d) => s + d.bytes, 0);
  const planBytes = parsed?.unlimited ? 0 : (parsed?.dataGB || 0) * 1_073_741_824;
  const usagePct = planBytes > 0 ? Math.min((totalBytes / planBytes) * 100, 100) : 0;

  // Rental-only: restrict CDR and usage to this order's trip window so prior renters' activity doesn't bleed in.
  const isRental = productType === "rental";
  const tripStartMs = tripStart ? new Date(tripStart).getTime() : 0;
  const tripEndMs = tripEnd ? new Date(tripEnd).getTime() + 86_400_000 - 1 : 0; // include full end day
  const tripScopedCdr = (isRental && tripStartMs > 0 && tripEndMs > 0)
    ? cdrRecords.filter((r) => {
        const d = r["USAGE_DATE_UTC"];
        const t = typeof d === "string" ? new Date(d).getTime() : typeof d === "number" ? d : 0;
        return t >= tripStartMs && t <= tripEndMs;
      })
    : cdrRecords;
  const tripUsageBytes = isRental
    ? tripScopedCdr.reduce((s, r) => s + Number(r["TOTAL_QTY"] || r["flowsize"] || r["TOTAL_BYTES"] || 0), 0)
    : totalBytes;
  const tripDays = (tripStartMs && tripEndMs)
    ? Math.max(1, Math.round((tripEndMs - tripStartMs) / 86_400_000))
    : 0;

  return (
    <Card className="rounded-[16px] bg-lavender/5 border-lavender/20">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Thumbnail (or placeholder) */}
          <div className="h-16 w-16 shrink-0 rounded-[8px] border border-lavender/30 bg-background overflow-hidden flex items-center justify-center">
            {deviceName.imageUrl ? (
              // Plain <img> on purpose — operator-provided URLs don't need next/image's domain allowlist
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={deviceName.imageUrl}
                alt={deviceName.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <Smartphone className="h-7 w-7 text-amethyst/50" strokeWidth={1.6} />
            )}
          </div>

          {/* Title block */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-[600] uppercase tracking-wider text-amethyst/70">{isRental ? "Rental Device" : "Sapphire Device"}</p>
            <h3 className="text-[16px] font-[540] text-foreground truncate">{isRental ? `Rental device${deviceName.code ? ` (${deviceName.code})` : ""}` : deviceName.name}</h3>
            {packageSku && (
              <p className="text-[12px] font-[460] text-muted-foreground mt-0.5 truncate">
                {flag && <span className="mr-1">{flag}</span>}
                {formatPlanDisplay(packageSku)}
              </p>
            )}

            {/* Status pills */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {bindingStatus && (
                <span className={cn(
                  "text-[10px] font-[700] uppercase tracking-wider rounded-[8px] px-1.5 py-0.5",
                  bindingStatusRaw === "BINDED" ? "bg-success-soft text-success" : "bg-lavender/20 text-amethyst"
                )}>
                  {bindingStatus}
                </span>
              )}
              {isLocked && (
                <span className="text-[10px] font-[700] uppercase tracking-wider rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow px-1.5 py-0.5">
                  Locked
                </span>
              )}
              {terminalType && (
                <span className="text-[10px] font-[600] font-mono rounded-[8px] bg-muted text-muted-foreground px-1.5 py-0.5">
                  {terminalType}
                </span>
              )}
              {deviceName.source === "fallback" && deviceName.code && (
                <span
                  className="text-[10px] font-[600] uppercase tracking-wider rounded-[8px] bg-muted text-muted-foreground/80 px-1.5 py-0.5"
                  title={`Add a Sapphire mapping for ${deviceName.code} in Settings → Sapphire Devices`}
                >
                  unmapped
                </span>
              )}
            </div>
          </div>

          {/* Right-rail: IMEI + customer + actions */}
          <div className="flex flex-col items-end gap-2 min-w-[200px]">
            <button
              onClick={() => onCopy(imei)}
              className="flex items-center gap-2 rounded-[8px] border border-lavender/40 bg-background px-3 py-2 text-[12px] font-mono font-[600] text-foreground hover:bg-lavender/10 cursor-pointer"
              aria-label={`Copy IMEI ${imei}`}
            >
              <span>IMEI: {imei}</span>
              {copied ? (
                <span className="text-[11px] font-[600] text-success">Copied!</span>
              ) : (
                <Copy className="h-3 w-3 opacity-60" strokeWidth={1.8} />
              )}
            </button>
            {subUser && (
              <p
                className="text-[11px] font-[460] font-mono text-muted-foreground truncate max-w-[260px]"
                title={subUser}
              >
                {subUser}
              </p>
            )}
            {(deviceName.setupGuideUrl || deviceName.troubleshootingUrl) && (
              <div className="flex items-center gap-1.5">
                {deviceName.setupGuideUrl && (
                  <a
                    href={deviceName.setupGuideUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-[600] rounded-[8px] border border-lavender/40 bg-background hover:bg-lavender/10 text-amethyst px-2 py-1 cursor-pointer transition-colors"
                  >
                    Setup guide ↗
                  </a>
                )}
                {deviceName.troubleshootingUrl && (
                  <a
                    href={deviceName.troubleshootingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-[600] rounded-[8px] border border-lavender/40 bg-background hover:bg-lavender/10 text-amethyst px-2 py-1 cursor-pointer transition-colors"
                  >
                    Troubleshooting ↗
                  </a>
                )}
              </div>
            )}
            {terminalType && (
              <button
                onClick={() => setKbOpen(true)}
                className="flex items-center gap-1.5 rounded-[8px] border border-lavender/40 bg-background hover:bg-lavender/10 text-amethyst px-2.5 py-1 cursor-pointer transition-colors text-[11px] font-[600]"
              >
                <BookOpen className="h-3 w-3" strokeWidth={1.8} />
                Device KB
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <KbSlideOver
        open={kbOpen}
        onOpenChange={setKbOpen}
        modelCode={terminalType}
        deviceLabel={isRental ? `Rental device${deviceName.code ? ` (${deviceName.code})` : ""}` : deviceName.name}
      />

      {/* ─── Network Status (real-time terminal monitor) ─── */}
      <div className="px-6 pb-2">
        <div className="rounded-[8px] border border-lavender/20 bg-background p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-amethyst/70" strokeWidth={1.8} />
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/70">Network Status</p>
            </div>
            <div className="flex items-center gap-2">
              {terminalStatusCachedAt && (
                <p className="text-[10px] font-[460] text-muted-foreground/50">
                  {(() => {
                    const ago = Math.round((Date.now() - terminalStatusCachedAt) / 1000);
                    if (ago < 60) return "just now";
                    if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
                    return `${Math.floor(ago / 3600)}h ago`;
                  })()}
                  {" · cached"}
                </p>
              )}
              <button
                onClick={onSyncTerminalStatus}
                disabled={terminalStatusLoading}
                className="flex items-center gap-1 rounded-[8px] border border-lavender/40 bg-background hover:bg-lavender/10 text-amethyst px-2 py-0.5 cursor-pointer transition-colors text-[10px] font-[600] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {terminalStatusLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.8} />
                ) : (
                  <RefreshCw className="h-3 w-3" strokeWidth={1.8} />
                )}
                Sync
              </button>
            </div>
          </div>

          {terminalStatusError && !terminalStatus && (
            <div className="flex items-center gap-1.5 text-[11px] font-[460] text-muted-foreground/60">
              <WifiOff className="h-3 w-3" strokeWidth={1.8} />
              <span>{terminalStatusError}</span>
            </div>
          )}

          {terminalStatus && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
              {/* Online status */}
              <div>
                <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Status</p>
                <div className="flex items-center gap-1.5">
                  {String(terminalStatus.isOnline) === "1" || terminalStatus.isOnline === true ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                      <span className="text-[13px] font-[540] text-success">Online</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      <span className="text-[13px] font-[540] text-muted-foreground">Offline</span>
                    </>
                  )}
                </div>
              </div>

              {/* RAT / Network type */}
              <div>
                <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">RAT</p>
                <p className="text-[13px] font-[540] text-foreground font-mono">
                  {(terminalStatus.network as string) || "—"}
                </p>
              </div>

              {/* MCC/MNC */}
              <div>
                <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">MCC / MNC</p>
                <p className="text-[13px] font-[540] text-foreground font-mono">
                  {(terminalStatus.mcc as string) || "—"}{(terminalStatus.mnc as string) ? ` / ${terminalStatus.mnc}` : ""}
                </p>
              </div>

              {/* Signal strength */}
              <div>
                <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Signal</p>
                <div className="flex items-center gap-1.5">
                  <Signal className="h-3 w-3 text-amethyst/60" strokeWidth={1.8} />
                  <p className="text-[13px] font-[540] text-foreground font-mono">
                    {(terminalStatus.signalStrength as string) || "—"}
                  </p>
                </div>
              </div>

              {/* LAC */}
              {(terminalStatus.lac as string) && (
                <div>
                  <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">LAC</p>
                  <p className="text-[13px] font-[540] text-foreground font-mono">{terminalStatus.lac as string}</p>
                </div>
              )}

              {/* Cell ID */}
              {(terminalStatus.cellId as string) && (
                <div>
                  <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Cell ID</p>
                  <p className="text-[13px] font-[540] text-foreground font-mono">{terminalStatus.cellId as string}</p>
                </div>
              )}

              {/* Operator name */}
              {(terminalStatus.operatorName as string) && (
                <div>
                  <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">Operator</p>
                  <p className="text-[13px] font-[540] text-foreground">{terminalStatus.operatorName as string}</p>
                </div>
              )}

              {/* IP */}
              {(terminalStatus.ip as string) && (
                <div>
                  <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/50 mb-0.5">IP</p>
                  <p className="text-[13px] font-[540] text-foreground font-mono">{terminalStatus.ip as string}</p>
                </div>
              )}
            </div>
          )}

          {!terminalStatus && !terminalStatusError && !terminalStatusLoading && (
            <p className="text-[11px] font-[460] text-muted-foreground/50">
              Click Sync to fetch real-time network status from the device.
            </p>
          )}
        </div>
      </div>

      <CardContent className="space-y-4">
        {/* Header summary — rentals show trip-scoped numbers; Sapphire/owned show fleet-wide. */}
        {isRental ? (
          // Trip window lives in Order Summary — avoid duplicating it here. Show only the
          // plan daily cap and the trip-scoped usage, which are specific to the plan card.
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Plan</p>
              <p className="text-[14px] font-[540] text-foreground">
                {parsed?.unlimited ? "Unlimited" : parsed?.dataGB ? `${parsed.dataGB} GB/day` : "—"}
              </p>
              <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                {parsed?.tier ? `${parsed.tier} tier · FUP` : "FUP · reduced speed after cap"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Trip usage</p>
              <p className="text-[14px] font-[540] text-foreground">{formatBytes(tripUsageBytes)}</p>
              <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                {tripScopedCdr.length} session{tripScopedCdr.length === 1 ? "" : "s"} in window
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Device activated</p>
              <p className="text-[14px] font-[540] text-foreground">{activationAt ? formatDate(activationAt) : "—"}</p>
            </div>
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Plans on file</p>
              <p className="text-[14px] font-[540] text-foreground">
                {userOffers.length}{" "}
                <span className="text-[11px] font-[460] text-muted-foreground">
                  ({userOffers.filter((o) => o.status === "IN_USING").length} active)
                </span>
              </p>
            </div>
            <div>
              <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Total usage (window)</p>
              <p className="text-[14px] font-[540] text-foreground">{formatBytes(totalBytes)}</p>
              <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">across all plans</p>
            </div>
          </div>
        )}

        {/* Per-plan breakdown — UCL is source of truth for plan state.
            Rentals: hide offers that don't match any of this customer's orders —
            the IMEI recycles through the fleet, so unmatched offers belong to other renters. */}
        <SapphirePlansList
          offers={userOffers}
          allOrders={allOrders}
          selectedPackageSku={packageSku}
          filterToCustomer={productType === "rental"}
        />

        {/* Usage history — rentals are restricted to the trip window so prior-renter activity doesn't appear. */}
        <div className="pt-2 border-t border-lavender/20">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[12px] font-[600] uppercase tracking-wider text-muted-foreground/70">Usage History</p>
            <p className="text-[11px] font-[460] text-muted-foreground">
              {isRental ? tripScopedCdr.length : cdrTotal} session{(isRental ? tripScopedCdr.length : cdrTotal) === 1 ? "" : "s"}
              {isRental ? " · trip window" : " · split by plan"}
            </p>
          </div>
          {isRental ? (
            <RentalDailyFupChart
              cdrRecords={tripScopedCdr}
              dailyCapGb={parsed?.unlimited ? 0 : (parsed?.dataGB || 0)}
              tripStart={tripStart}
              tripEnd={tripEnd}
            />
          ) : (
            <SapphireUsagePerPlanChart cdrRecords={tripScopedCdr} offers={userOffers} />
          )}
        </div>

        {/* Data Sources panel hidden — kept in code for dev debugging if needed.
            Re-enable by dropping <DataSourcesPanel ... /> below.
            <DataSourcesPanel ucl={{ data: deviceInfo, error: deviceInfoError }} cdr={{ records: cdrRecords, total: cdrTotal }} />
        */}
        {deviceInfoError && !deviceInfo && (
          <div className="rounded-[8px] bg-fraud-yellow-soft border border-fraud-yellow/20 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-fraud-yellow mt-0.5 shrink-0" strokeWidth={1.8} />
            <p className="text-[11px] font-[460] text-fraud-yellow">
              UCL lookup failed: {deviceInfoError}
            </p>
          </div>
        )}

        {/* UCL lookup error surface */}
        {deviceInfoError && !model && (
          <div className="rounded-[8px] bg-fraud-yellow-soft border border-fraud-yellow/20 px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-fraud-yellow mt-0.5 shrink-0" strokeWidth={1.8} />
            <p className="text-[11px] font-[460] text-fraud-yellow">
              Live device model unavailable from UCL: {deviceInfoError}. OpenSearch usage data shown above is still accurate.
            </p>
          </div>
        )}
        {cdrRecords.length === 0 && cdrTotal === 0 && !deviceInfoError && (
          <p className="text-[11px] font-[460] text-muted-foreground">
            No CDR records found. If the device shipped recently, usage may take 24 hours to appear.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Daily Usage Aggregation ─── */
function aggregateDailyUsage(records: Array<Record<string, unknown>>, days: number, customFrom?: string, customTo?: string) {
  const buckets: Record<string, { bytes: number; country: string; sessions: number }> = {};
  let startDate: Date;
  let endDate: Date;
  if (customFrom && customTo) {
    startDate = new Date(customFrom);
    endDate = new Date(customTo);
  } else {
    endDate = new Date();
    startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - days + 1);
  }
  // Initialize buckets for each day in range
  const current = new Date(startDate);
  while (current <= endDate) {
    buckets[current.toISOString().split("T")[0]] = { bytes: 0, country: "", sessions: 0 };
    current.setDate(current.getDate() + 1);
  }
  for (const rec of records) {
    const ts = (rec["USAGE_DATE_UTC"] || rec["@timestamp"] || rec["ConnectTime"] || rec["timestamp"]) as string;
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    const key = d.toISOString().split("T")[0];
    if (buckets[key]) {
      buckets[key].bytes += Number(rec["TOTAL_QTY"] || rec["ROUNDED_DATA_VOLUME"] || rec["data_volume"] || 0);
      buckets[key].sessions += 1;
      if (!buckets[key].country) buckets[key].country = (rec["iso2"] || rec["COUNTRY"] || rec["country"] || "") as string;
    }
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }));
}
