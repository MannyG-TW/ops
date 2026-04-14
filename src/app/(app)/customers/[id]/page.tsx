"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { fetchOS, fetchTelliSIM, getTelliSIMCredentials } from "@/lib/settings-client";
import { formatPlanDisplay, detectProductType, findPlanSku, parsePlanSku } from "@/lib/sku-parser";
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
  }>;
  coupons?: Array<string | { code?: string; discount?: number; type?: string }>;
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

/* ─── Main Page ─── */
export default function CustomerProfilePage() {
  const params = useParams();
  const customerEmail = decodeURIComponent(params.id as string);

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
  const [serviceError, setServiceError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [dateRange, setDateRange] = useState<"7" | "14" | "30" | "custom">("30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // TelliSIM location data
  const [locationData, setLocationData] = useState<LocationOperator | null>(null);
  const [iccidOrders, setIccidOrders] = useState<Order[]>([]);

  // Coverage lookup state
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [coverageQuery, setCoverageQuery] = useState("");
  const [coverageLoading, setCoverageLoading] = useState(false);
  const [coverageResults, setCoverageResults] = useState<CoverageOperator[]>([]);
  const [coverageError, setCoverageError] = useState<string | null>(null);

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
          setOrders(data.orders || []);
          setCustomer(data.customer);
          if (data.orders?.length > 0) setSelectedOrder(data.orders[0]);
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
  }, [customerEmail]);

  const loadServiceData = useCallback(async (serial: string) => {
    setSelectedSerial(serial);
    setServiceLoading(true);
    setServiceError(null);
    setPlanAttachments([]);
    setSmdpData(null);
    setCdrRecords([]);
    setCdrTotal(0);
    setLocationData(null);
    setIccidOrders([]);

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

    const isTelliSim = selectedOrder ? isTelliSimEsim(selectedOrder) : false;

    try {
      const promises: Promise<unknown>[] = [
        fetchTelliSIM(`/api/tellisim/subscription/${serial}`, {}),
        fetchTelliSIM(`/api/tellisim/smdp/${serial}`, {}),
        fetchOS("/api/opensearch/cdr", {
          iccid: serial,
          productSku: getSkus(selectedOrder as Order).find(s => s.toUpperCase().includes("ESIM")) || "",
          from: from.toISOString(),
          to: now.toISOString(),
          size: 500,
        }),
      ];

      // 4th call: location data for TelliSIM eSIMs only
      if (isTelliSim) {
        promises.push(fetchTelliSIM(`/api/tellisim/location/${serial}`, {}));
      }

      // 5th call: all orders sharing this ICCID (for plan-to-order matching)
      promises.push(fetchOS("/api/opensearch/orders-by-iccid", { iccid: serial }));

      const results = await Promise.allSettled(promises);

      const [planRes, smdpRes, cdrRes] = results as PromiseSettledResult<{ ok?: boolean; planAttachments?: { data?: PlanAttachment[] } | PlanAttachment[]; smdp?: SmdpData; cdr?: { tellisim?: { records?: Record<string, unknown>[]; total?: number } } }>[];

      if (planRes.status === "fulfilled" && planRes.value.ok) {
        const att = (planRes.value.planAttachments as { data?: PlanAttachment[] })?.data || planRes.value.planAttachments || [];
        setPlanAttachments(Array.isArray(att) ? att : []);
      }
      if (smdpRes.status === "fulfilled" && smdpRes.value.ok) setSmdpData(smdpRes.value.smdp || null);
      if (cdrRes.status === "fulfilled") {
        const cdrVal = cdrRes.value as Record<string, unknown>;
        if (cdrVal.ok) {
          const cdr = cdrVal.cdr as Record<string, unknown> | undefined;
          const tellisim = cdr?.tellisim as { records?: Record<string, unknown>[]; total?: number } | undefined;
          const archive = cdr?.archive as { records?: Record<string, unknown>[]; total?: number } | undefined;
          // Use TelliSIM CDR first, fall back to archive
          const records = tellisim?.records || archive?.records || [];
          const total = tellisim?.total || archive?.total || 0;
          setCdrRecords(records);
          setCdrTotal(total);
        }
      }

      // Location data for TelliSIM
      if (isTelliSim && results[3]) {
        const locRes = results[3] as PromiseSettledResult<{ ok?: boolean; location?: { last_operator?: LocationOperator; error?: boolean } }>;
        if (locRes.status === "fulfilled" && locRes.value.ok) {
          setLocationData(locRes.value.location?.last_operator || null);
        }
      }

      // ICCID orders — for plan-to-order matching
      const iccidIdx = isTelliSim ? 4 : 3;
      if (results[iccidIdx]) {
        const iccidRes = results[iccidIdx] as PromiseSettledResult<{ ok?: boolean; orders?: Order[] }>;
        if (iccidRes.status === "fulfilled" && iccidRes.value.ok) {
          setIccidOrders(iccidRes.value.orders || []);
        }
      }
    } catch (err) {
      setServiceError(err instanceof Error ? err.message : "Failed to load service data");
    } finally {
      setServiceLoading(false);
    }
  }, [dateRange, selectedOrder]);

  useEffect(() => { if (selectedSerial) loadServiceData(selectedSerial); }, [dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Reload service data
      if (selectedSerial) loadServiceData(selectedSerial);
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
      // Create escalation notification for all supervisors/admins
      const supervisors = TEAM_MEMBERS.filter((m) => m.role === "admin" || m.role === "manager");
      for (const sup of supervisors) {
        if (sup.email === currentEmail) continue;
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: sup.email,
            type: "escalation",
            title: `Escalation: ${[customer?.firstName, customer?.lastName].filter(Boolean).join(" ") || customerEmail}`,
            message: escalateNote,
            link: `/customers/${customerEmail}`,
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
      // Notify all supervisors/admins about fraud flag
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

  const productType = selectedOrder ? detectProductType(getSkus(selectedOrder)) : "unknown";
  const productLabel = productType === "esim" ? "eSIM" : productType === "rental" ? "Rental" : productType === "sapphire" ? "Sapphire" : "Order";
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
  const tripStart = selectedOrder?.order_details_data?.[0]?.trip_start;
  const tripEnd = selectedOrder?.order_details_data?.[0]?.trip_end;
  const packageSku = selectedOrder?.order_details_data?.[0]?.package_sku;
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
                    <Button size="sm" title="Disable eSIM profile temporarily (TelliSIM)" className="h-7 rounded-[8px] bg-fraud-yellow-soft text-fraud-yellow text-[11px] font-[600] hover:bg-fraud-yellow/20 cursor-pointer px-2 opacity-50" disabled>
                      <Pause className="h-3 w-3" strokeWidth={2} /> Pause
                    </Button>
                    <Button size="sm" title="Permanently block this SIM (TelliSIM)" className="h-7 rounded-[8px] bg-fraud-red-soft text-fraud-red text-[11px] font-[600] hover:bg-fraud-red/20 cursor-pointer px-2 opacity-50" disabled>
                      <ShieldBan className="h-3 w-3" strokeWidth={2} /> Block
                    </Button>
                    <Button size="sm" title="Resend eSIM QR code to customer (TelliSIM)" className="h-7 rounded-[8px] bg-cream text-charcoal text-[11px] font-[600] hover:bg-cream-hover cursor-pointer px-2 opacity-50" disabled>
                      <Send className="h-3 w-3" strokeWidth={2} /> Resend
                    </Button>
                  </>
                )}
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
          <CardContent className="space-y-4">
            {/* Plan headline with flag */}
            {(packageSku || planSku) && (() => {
              const sku = packageSku || planSku || "";
              const parsed = parsePlanSku(sku);
              const flag = parsed ? getCountryFlag(parsed.countryCode) : "";
              return (
                <div className="rounded-[8px] bg-muted/30 px-4 py-3">
                  <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Plan Purchased</p>
                  <p className="text-[20px] font-[540] text-foreground">
                    {flag && <span className="mr-2">{flag}</span>}
                    {formatPlanDisplay(sku)}
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

            {/* Trip dates — only for Rental/Sapphire orders, NOT eSIM */}
            {(tripStart || tripEnd) && productType !== "esim" && (
              <div className="rounded-[8px] border border-lavender/20 bg-lavender/5 px-4 py-3 flex items-center gap-4">
                <Plane className="h-4 w-4 text-amethyst shrink-0" strokeWidth={1.8} />
                <div className="flex items-center gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60">Trip Start</p>
                    <p className="text-[14px] font-[540] text-foreground">{formatDate(tripStart)}</p>
                  </div>
                  <span className="text-muted-foreground/40">→</span>
                  <div>
                    <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60">Trip End</p>
                    <p className="text-[14px] font-[540] text-foreground">{formatDate(tripEnd)}</p>
                  </div>
                  {tripEnd && (
                    <div className="ml-2">
                      <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60">Remaining</p>
                      <p className={cn("text-[14px] font-[600]", {
                        "text-fraud-red": (daysUntil(tripEnd) ?? 999) <= 3,
                        "text-fraud-yellow": (daysUntil(tripEnd) ?? 999) > 3 && (daysUntil(tripEnd) ?? 999) <= 7,
                        "text-success": (daysUntil(tripEnd) ?? 999) > 7,
                        "text-muted-foreground": (daysUntil(tripEnd) ?? 0) < 0,
                      })}>
                        {daysUntilDisplay(tripEnd)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Order details grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <InfoCell icon={Calendar} label="Purchased" value={formatDate(selectedOrder.created_at)} />
              <InfoCell icon={MapPin} label="Country" value={selectedOrder.destination_country ? getCountryName(selectedOrder.destination_country) : packageSku ? getCountryName(packageSku.split("_")[0]) : "—"} />
              <InfoCell icon={DollarSign} label="Amount Paid"
                value={selectedOrder.total != null ? `${Number(selectedOrder.total).toFixed(2)} ${currencyCode}` : "—"} />
              <InfoCell icon={TrendingUp} label="USD Value"
                value={(() => {
                  if (selectedOrder.total_usd) return `$${Number(selectedOrder.total_usd).toFixed(2)}`;
                  if (selectedOrder.total != null && selectedOrder.order_usd_rate_exchange) {
                    const rate = parseFloat(selectedOrder.order_usd_rate_exchange);
                    if (rate > 0) return `$${(Number(selectedOrder.total) / rate).toFixed(2)}`;
                  }
                  return currencyCode === "USD" && selectedOrder.total != null ? `$${Number(selectedOrder.total).toFixed(2)}` : "—";
                })()} />
              <InfoCell icon={CreditCard} label="Payment"
                value={selectedOrder.payment_method_title || selectedOrder.delivery_address || "—"} />
            </div>

            {/* Exchange rate if applicable */}
            {selectedOrder.order_usd_rate_exchange && currencyCode !== "USD" && (
              <p className="text-[11px] font-[460] text-muted-foreground">
                Exchange rate: {selectedOrder.order_usd_rate_exchange} {currencyCode}/USD as of {formatDate(selectedOrder.created_at)}
              </p>
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

            {/* Serial number badges — prominent CTA for support */}
            {serials.length > 0 && (
              <div className="rounded-[8px] border border-lavender/30 bg-lavender/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-[600] text-foreground flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                    {productType === "esim" ? "eSIM Serial" : "Device Serial"}
                  </p>
                  <p className="text-[11px] font-[460] text-amethyst">Click to load live status from provider</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {serials.map((s) => (
                    <button key={s} onClick={() => loadServiceData(s)}
                      className={cn(
                        "flex items-center gap-2 rounded-[8px] border-2 px-4 py-2.5 text-[13px] font-mono font-[600] transition-all cursor-pointer",
                        selectedSerial === s
                          ? "border-lavender bg-lavender/20 text-foreground"
                          : "border-lavender/40 bg-background text-foreground hover:border-lavender hover:bg-lavender/10"
                      )}>
                      {selectedSerial === s && serviceLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-amethyst" />
                      ) : (
                        <Wifi className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                      )}
                      {s}
                      {selectedSerial === s && serviceLoading && (
                        <span className="text-[11px] font-[500] text-amethyst ml-1">Loading...</span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedSerial && serviceLoading && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full bg-parchment overflow-hidden">
                      <div className="h-full rounded-full bg-lavender animate-pulse" style={{ width: "60%" }} />
                    </div>
                    <p className="text-[11px] font-[460] text-muted-foreground mt-1">Fetching real-time data from provider...</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── 3. SERVICE STATUS — Only when serial is selected ─── */}
      {selectedSerial && (
        <>
          {serviceLoading ? (
            <Card className="rounded-[16px] bg-lavender/5">
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-lavender" />
                <span className="ml-3 text-[14px] font-[460] text-muted-foreground">Loading service details...</span>
              </CardContent>
            </Card>
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

              {/* ─── Device & Network Card — TelliSIM eSIM only ─── */}
              {isTelliSim && (
                <Card className="rounded-[16px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                      Device & Network
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {locationData ? (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {/* Device (IMEI) */}
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

                        {/* Last Country */}
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

                        {/* Operator */}
                        <div>
                          <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Operator</p>
                          <p className="text-[14px] font-[540] text-foreground">{locationData.operator || "—"}</p>
                        </div>

                        {/* Network (RAT) */}
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

                        {/* Last Seen */}
                        <div>
                          <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1">Last Seen</p>
                          <p className="text-[14px] font-[540] text-foreground">{formatDateTime(locationData.event_time)}</p>
                        </div>
                      </div>
                    ) : (cdrImei || cdrCountry) ? (
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
                      ) : (
                        <div className="flex items-center gap-3 py-4">
                          <Radio className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                          <p className="text-[13px] font-[460] text-muted-foreground">
                            No network activity data available
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              )}

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

              {smdpData?.state_history && smdpData.state_history.length > 0 && (
                <Card className="rounded-[16px]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-[14px] font-[600] text-foreground flex items-center gap-2">
                      <Globe className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                      Profile History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative ml-4">
                      <div className="absolute left-0 top-2 bottom-2 w-px bg-parchment" />
                      <div className="space-y-5">
                        {smdpData.state_history.map((event, i) => {
                          const label = getSmdpLabel(event.state);
                          const iconMap = { success: CheckCircle2, info: Download, warning: WifiOff, error: XCircle };
                          const colorMap = { success: "text-success", info: "text-amethyst", warning: "text-fraud-yellow", error: "text-fraud-red" };
                          const bgMap = { success: "bg-success-soft", info: "bg-lavender/10", warning: "bg-fraud-yellow-soft", error: "bg-fraud-red-soft" };
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
                  </CardContent>
                </Card>
              )}

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
                            onClick={() => { if (customFrom && customTo && selectedSerial) loadServiceData(selectedSerial); }}
                            disabled={!customFrom || !customTo}
                            className="rounded-[8px] bg-cream text-charcoal px-3 py-1 text-[12px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer">
                            Go
                          </button>
                        </div>
                      )}
                      <button onClick={() => selectedSerial && loadServiceData(selectedSerial)}
                        className="ml-1 rounded-[8px] p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors">
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
                      <p className="text-[13px] font-[460]">No usage data for the selected period</p>
                      <p className="text-[11px] font-[460] text-muted-foreground/60 mt-1">
                        {cdrTotal === 0 ? "No data sessions recorded for this serial" : "Try expanding the date range"}
                      </p>
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
