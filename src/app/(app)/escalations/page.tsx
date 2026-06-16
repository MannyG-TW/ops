"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Eye,
  Loader2,
  Send,
  User,
  Package,
  Mail,
  ArrowLeft,
  X,
  ChevronRight,
  ChevronLeft,
  Wifi,
  Smartphone,
  Globe,
  MapPin,
  Calendar,
  DollarSign,
  Truck,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { getRoleFromTeamMember } from "@/lib/roles";
import { TEAM_MEMBERS } from "@/components/ui/internal-notes";
import { fetchOS } from "@/lib/settings-client";
import { parsePlanSku } from "@/lib/sku-parser";

/**
 * Product type rules — governs what fields are shown per type.
 *
 * eSIM:
 *   - SKU pattern: XX_##GB_##D or XX_##D_Unlimited
 *   - Shows: country, data, validity
 *   - Does NOT show: trip dates, tracking, serial, delivery address
 *
 * Rental Device:
 *   - Identified by: has tracking_information (carrier, tracking #, device serial)
 *   - Shows: trip dates, tracking, serial, delivery address, warehouse
 *   - Does NOT show: parsed plan details (SKU is device model, not a data plan)
 *
 * Sapphire (Data Plan):
 *   - SKU starts with DHI_ (FLOW, DP tiers: Adventure/Escape/Voyage)
 *   - Shows: country, data, validity, tier
 *   - Does NOT show: trip dates, tracking, delivery address
 */
type ProductType = "eSIM" | "Rental Device" | "Sapphire";

function detectProductType(orderDetails: OrderDetails): ProductType {
  const skus = getAllSkus(orderDetails);
  const hasTracking = (orderDetails.tracking_information ?? []).length > 0;
  const isDHI = skus.some(s => s.toUpperCase().startsWith("DHI_"));

  if (isDHI) return "Sapphire";
  if (hasTracking) return "Rental Device";
  return "eSIM";
}

function getAllSkus(orderDetails: OrderDetails): string[] {
  const skus = Array.isArray(orderDetails.product_sku)
    ? orderDetails.product_sku
    : orderDetails.product_sku ? [orderDetails.product_sku] : [];
  return [
    ...skus,
    ...(orderDetails.order_details_data?.map(d => d.product_sku || d.package_sku || "") ?? []),
  ].filter(Boolean);
}

// ─── Types ──────────────────────────────────────────────

interface Escalation {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: "new" | "in_review" | "resolved";
  escalatedBy: string;
  escalatedById: string;
  resolvedBy: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface EscalationNote {
  id: string;
  escalationId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

interface OrderDetails {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_email?: string;
  status?: string;
  system?: string;
  total?: number;
  currency?: string;
  created_at?: string | number;
  delivery_address?: string;
  warehouse?: string | string[];
  product_sku?: string | string[];
  destination_country?: string;
  order_details_data?: Array<{
    product_sku?: string;
    package_sku?: string;
    trip_start?: string;
    trip_end?: string;
    qty?: number;
    quantity?: number;
    total?: number;
  }>;
  tracking_information?: Array<{
    device_serial?: string | number;
    shipping_carrier?: string;
    shipping_tracking_number?: string;
    return_carrier?: string;
    return_tracking_number?: string;
  }>;
}

type StatusTab = "new" | "in_review" | "resolved";

const STATUS_CONFIG = {
  new: {
    label: "New",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  in_review: {
    label: "In Review",
    icon: Eye,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
} as const;

// ─── Component ──────────────────────────────────────────

export default function EscalationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StatusTab>("new");
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [counts, setCounts] = useState({ new: 0, in_review: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedEscalation, setSelectedEscalation] = useState<Escalation | null>(null);
  const [notes, setNotes] = useState<EscalationNote[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Role gate
  useEffect(() => {
    const email = localStorage.getItem("travelwifi_ops_user_email");
    if (email) {
      const member = TEAM_MEMBERS.find((m) => m.email === email);
      if (member) {
        const effectiveRole = getRoleFromTeamMember(member.role);
        if (effectiveRole === "supervisor" || effectiveRole === "admin") {
          setAuthorized(true);
          return;
        }
      }
    }
    router.push("/dashboard");
  }, [router]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  // Fetch escalations list
  const fetchEscalations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", activeTab);
      params.set("page", String(page));
      params.set("limit", "20");
      if (debouncedSearch) params.set("q", debouncedSearch);

      const res = await fetch(`/api/escalations?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setEscalations(data.escalations);
        setCounts(data.counts);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, debouncedSearch]);

  useEffect(() => {
    if (authorized) {
      setLoading(true);
      fetchEscalations();
    }
  }, [authorized, fetchEscalations]);

  // Poll every 30s
  useEffect(() => {
    if (!authorized) return;
    const interval = setInterval(fetchEscalations, 30000);
    return () => clearInterval(interval);
  }, [authorized, fetchEscalations]);

  // Fetch escalation detail + order
  async function openDetail(esc: Escalation) {
    setSelectedEscalation(esc);
    setDetailLoading(true);
    setOrderDetails(null);
    setNotes([]);

    try {
      // Fetch escalation notes
      const escRes = await fetch(`/api/escalations/${esc.id}`);
      const escData = await escRes.json();
      if (escData.ok) {
        setNotes(escData.notes);
      }

      // Fetch order details from OpenSearch (POST with credentials resolved server-side)
      try {
        const orderData = await fetchOS(`/api/opensearch/orders/${esc.orderId}`, {});
        if (orderData.order) {
          setOrderDetails(orderData.order);
        }
      } catch {
        // Order may not be found — that's OK, we still show the escalation
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedEscalation(null);
    setNotes([]);
    setOrderDetails(null);
    setNewNote("");
  }

  // Get current user info from TEAM_MEMBERS
  function getCurrentUser() {
    const email = typeof window !== "undefined" ? localStorage.getItem("travelwifi_ops_user_email") || "" : "";
    const member = TEAM_MEMBERS.find((m) => m.email === email);
    const role = member ? getRoleFromTeamMember(member.role) : "supervisor";
    const name = member?.name || email;
    return { email, role, name };
  }

  // Sync a note to the customer's internal notes for visibility
  function syncToInternalNotes(escalation: Escalation, noteText: string, user: { email: string; name: string }) {
    const member = TEAM_MEMBERS.find((m) => m.email === user.email);
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: escalation.customerEmail,
        authorId: member?.id || user.email,
        authorName: user.name,
        body: `[Escalation - ${escalation.orderNumber}] ${noteText}`,
        mentions: [],
      }),
    }).catch(() => {});
  }

  // Update escalation status
  async function updateStatus(escalation: Escalation, newStatus: "new" | "in_review" | "resolved") {
    const user = getCurrentUser();
    const body: Record<string, string> = {
      status: newStatus,
      authorId: user.email,
      authorName: user.name,
      authorRole: user.role,
    };

    if (newStatus === "in_review") {
      body.note = `${user.name} started reviewing this escalation`;
    }

    if (newStatus === "resolved") {
      body.resolvedBy = user.name;
      body.resolvedById = user.email;
      body.resolution = newNote.trim() || "Resolved";
      body.note = newNote.trim() || "Marked as resolved";
    }

    try {
      const res = await fetch(`/api/escalations/${escalation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedEscalation(data.escalation);
        if (data.note) {
          setNotes((prev) => [data.note, ...prev]);
          // Sync status change to customer internal notes
          syncToInternalNotes(escalation, data.note.content, user);
        }
        setNewNote("");
        fetchEscalations();
      }
    } catch {
      // silent
    }
  }

  // Add note
  async function handleAddNote() {
    if (!newNote.trim() || !selectedEscalation) return;
    setNoteLoading(true);
    const user = getCurrentUser();

    try {
      const res = await fetch(`/api/escalations/${selectedEscalation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: newNote,
          authorId: user.email,
          authorName: user.name,
          authorRole: user.role,
        }),
      });
      const data = await res.json();
      if (data.ok && data.note) {
        setNotes((prev) => [data.note, ...prev]);
        // Sync supervisor note to customer internal notes
        syncToInternalNotes(selectedEscalation, newNote, user);
        setNewNote("");
      }
    } catch {
      // silent
    } finally {
      setNoteLoading(false);
    }
  }

  if (!authorized) {
    return null;
  }

  const tabs: { key: StatusTab; label: string; count: number }[] = [
    { key: "new", label: "New", count: counts.new },
    { key: "in_review", label: "In Review", count: counts.in_review },
    { key: "resolved", label: "Resolved", count: counts.resolved },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* ─── List Panel ─── */}
      <div className={cn(
        "flex flex-col border-r border-border bg-background transition-all duration-200",
        selectedEscalation ? "w-[420px]" : "flex-1"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-[20px] font-[600] text-foreground">Escalation Queue</h1>
            <p className="text-[13px] font-[460] text-muted-foreground mt-0.5">
              {counts.new > 0 ? `${counts.new} new escalation${counts.new !== 1 ? "s" : ""} pending` : "No new escalations"}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.8} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order, name, or email..."
              className="w-full rounded-[8px] border border-border bg-muted/30 pl-9 pr-3 py-2 text-[13px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border px-6 py-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[13px] font-[460] transition-colors cursor-pointer",
                activeTab === tab.key
                  ? "bg-sidebar-accent text-foreground font-[600]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={cn(
                  "text-[11px] font-[600] px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                  activeTab === tab.key
                    ? "bg-mysteria/10 text-mysteria"
                    : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-lavender" />
            </div>
          ) : escalations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mb-3" strokeWidth={1.5} />
              <p className="text-[14px] font-[540] text-muted-foreground">No escalations</p>
              <p className="text-[12px] font-[460] text-muted-foreground/60 mt-1">
                {debouncedSearch
                  ? `No results for "${debouncedSearch}"`
                  : `No ${activeTab.replace("_", " ")} escalations`}
              </p>
            </div>
          ) : (
            escalations.map((esc) => {
              const config = STATUS_CONFIG[esc.status];
              const StatusIcon = config.icon;
              const isSelected = selectedEscalation?.id === esc.id;

              return (
                <button
                  key={esc.id}
                  onClick={() => openDetail(esc)}
                  className={cn(
                    "w-full flex items-start gap-3 px-6 py-4 text-left transition-colors border-b border-border/50 cursor-pointer",
                    isSelected
                      ? "bg-sidebar-accent"
                      : "hover:bg-muted/50"
                  )}
                >
                  <div className={cn("flex-shrink-0 mt-0.5 p-1.5 rounded-[8px]", config.bg)}>
                    <StatusIcon className={cn("h-3.5 w-3.5", config.color)} strokeWidth={1.8} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-[600] text-foreground truncate">
                        {esc.orderNumber}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] font-[600] px-1.5 py-0 shrink-0 border-0", config.badge)}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-[12px] font-[460] text-muted-foreground mt-0.5 truncate">
                      {esc.customerName}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-[460] text-muted-foreground/70">
                        <User className="h-3 w-3" strokeWidth={1.8} />
                        {esc.escalatedBy}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] font-[460] text-muted-foreground/70">
                        <Clock className="h-3 w-3" strokeWidth={1.8} />
                        {formatDistanceToNow(new Date(esc.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 mt-1 shrink-0" strokeWidth={1.8} />
                </button>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-3">
            <span className="text-[11px] font-[460] text-muted-foreground">
              {pagination.total} result{pagination.total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
              <span className="text-[12px] font-[540] text-foreground px-2">
                {page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Detail Panel (Slide-over) ─── */}
      {selectedEscalation && (
        <div className="flex-1 flex flex-col bg-background overflow-hidden">
          {/* Detail Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={closeDetail}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} />
              </button>
              <div>
                <h2 className="text-[16px] font-[600] text-foreground">
                  Order {selectedEscalation.orderNumber}
                </h2>
                <p className="text-[12px] font-[460] text-muted-foreground">
                  Escalated by {selectedEscalation.escalatedBy} {formatDistanceToNow(new Date(selectedEscalation.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
            <button
              onClick={closeDetail}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {detailLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-lavender" />
              </div>
            ) : (
              <div className="px-6 py-4 space-y-6">
                {/* Workflow Status Bar */}
                <div className={cn(
                  "rounded-[16px] border p-4",
                  selectedEscalation.status === "new"
                    ? "border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20"
                    : selectedEscalation.status === "in_review"
                    ? "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20"
                )}>
                  {selectedEscalation.status === "new" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.8} />
                        <span className="text-[13px] font-[600] text-amber-800 dark:text-amber-200">Waiting for a supervisor</span>
                      </div>
                      <p className="text-[12px] font-[460] text-amber-700/80 dark:text-amber-300/80">
                        This escalation hasn&apos;t been picked up yet. Pick it up to let other supervisors know you&apos;re handling it.
                      </p>
                      <button
                        onClick={() => updateStatus(selectedEscalation, "in_review")}
                        className="flex items-center gap-1.5 rounded-[8px] bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 text-[12px] font-[540] transition-colors hover:bg-blue-700 dark:hover:bg-blue-600 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                        I&apos;m handling this
                      </button>
                    </div>
                  )}

                  {selectedEscalation.status === "in_review" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={1.8} />
                        <span className="text-[13px] font-[600] text-blue-800 dark:text-blue-200">Being reviewed</span>
                      </div>
                      <p className="text-[12px] font-[460] text-blue-700/80 dark:text-blue-300/80">
                        A supervisor is looking into this. Add notes below to document your findings. When done, mark it as resolved.
                      </p>
                      <button
                        onClick={() => updateStatus(selectedEscalation, "resolved")}
                        className="flex items-center gap-1.5 rounded-[8px] bg-emerald-600 dark:bg-emerald-500 text-white px-4 py-2 text-[12px] font-[540] transition-colors hover:bg-emerald-700 dark:hover:bg-emerald-600 cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Mark as resolved
                      </button>
                    </div>
                  )}

                  {selectedEscalation.status === "resolved" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
                        <span className="text-[13px] font-[600] text-emerald-800 dark:text-emerald-200">Closed</span>
                        {selectedEscalation.resolvedBy && (
                          <span className="text-[11px] font-[460] text-emerald-700/70 dark:text-emerald-300/70">
                            by {selectedEscalation.resolvedBy}
                          </span>
                        )}
                      </div>
                      {selectedEscalation.resolution && (
                        <p className="text-[12px] font-[460] text-emerald-700/80 dark:text-emerald-300/80">
                          {selectedEscalation.resolution}
                        </p>
                      )}
                      <button
                        onClick={() => updateStatus(selectedEscalation, "new")}
                        className="flex items-center gap-1.5 rounded-[8px] border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 px-4 py-2 text-[12px] font-[540] transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/30 cursor-pointer"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
                        Reopen — customer called back
                      </button>
                    </div>
                  )}
                </div>

                {/* Customer Info */}
                <div className="rounded-[16px] border border-border p-4 space-y-3">
                  <h3 className="text-[13px] font-[600] text-foreground">Customer</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                      <span className="text-[12px] font-[460] text-foreground">{selectedEscalation.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                      <a
                        href={`/customers/${selectedEscalation.customerEmail}`}
                        className="text-[12px] font-[460] text-amethyst hover:underline"
                      >
                        {selectedEscalation.customerEmail}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                {orderDetails && (() => {
                  const allSkus = getAllSkus(orderDetails);
                  const productType = detectProductType(orderDetails);

                  const PRODUCT_STYLE: Record<ProductType, { icon: typeof Wifi; color: string }> = {
                    "eSIM": { icon: Wifi, color: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30" },
                    "Rental Device": { icon: Smartphone, color: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30" },
                    "Sapphire": { icon: Globe, color: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30" },
                  };

                  const { icon: ProductIcon, color: productColor } = PRODUCT_STYLE[productType];

                  // Parse plan details from SKUs
                  const parsedPlans = allSkus.map(s => ({ sku: s, parsed: parsePlanSku(s) })).filter(p => p.parsed);

                  // Order status styling
                  const statusStr = (orderDetails.status || "unknown").toLowerCase();
                  const statusStyle = statusStr.includes("complete") || statusStr.includes("deliver")
                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                    : statusStr.includes("cancel") || statusStr.includes("refund")
                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    : statusStr.includes("process") || statusStr.includes("pending")
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                    : "bg-muted text-muted-foreground";

                  return (
                    <div className="rounded-[16px] border border-border p-4 space-y-4">
                      {/* Header: Order # + Status + Product Type */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-[14px] font-[600] text-foreground">
                              {orderDetails.order_number || orderDetails.id}
                            </h3>
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-[8px] text-[11px] font-[600] uppercase",
                              statusStyle
                            )}>
                              {orderDetails.status || "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[8px] text-[10px] font-[600]", productColor)}>
                              <ProductIcon className="h-3 w-3" strokeWidth={2} />
                              {productType}
                            </span>
                            {orderDetails.total != null && (
                              <span className="flex items-center gap-0.5 text-[12px] font-[540] text-foreground">
                                <DollarSign className="h-3 w-3 text-muted-foreground" strokeWidth={1.8} />
                                {orderDetails.currency ?? ""}{orderDetails.total}
                              </span>
                            )}
                          </div>
                        </div>
                        <a
                          href={`/customers/${selectedEscalation.customerEmail}`}
                          className="text-[11px] font-[540] text-amethyst hover:underline shrink-0"
                        >
                          Full details
                        </a>
                      </div>

                      {/* Plan Details — eSIM and Sapphire only (not rental devices) */}
                      {productType !== "Rental Device" && parsedPlans.length > 0 && (
                        <div className="space-y-2">
                          {parsedPlans.map(({ sku, parsed }, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-[8px] bg-muted/40 px-3 py-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.8} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-[540] text-foreground">
                                    {parsed!.countryName}
                                  </span>
                                  {parsed!.tier && (
                                    <span className="text-[10px] font-[600] px-1.5 py-0.5 rounded-[4px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                                      {parsed!.tier}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-[460] text-muted-foreground">
                                  {parsed!.unlimited ? "Unlimited data" : `${parsed!.dataGB}GB`}
                                  {parsed!.days > 0 && ` / ${parsed!.days} days`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Unparsed products fallback — eSIM/Sapphire only */}
                      {productType !== "Rental Device" && parsedPlans.length === 0 && allSkus.length > 0 && (
                        <div className="space-y-1.5">
                          {orderDetails.order_details_data?.map((item, i) => (
                            <div key={i} className="flex items-center gap-2 rounded-[8px] bg-muted/40 px-3 py-2 text-[12px]">
                              <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.8} />
                              <span className="font-[460] text-foreground">{item.product_sku || item.package_sku}</span>
                              <span className="text-muted-foreground">x{item.qty ?? item.quantity ?? 1}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Trip dates — Rental Device only */}
                      {productType === "Rental Device" && orderDetails.order_details_data?.some(d => d.trip_start) && (
                        <div className="flex items-center gap-2 text-[12px]">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                          <span className="font-[460] text-muted-foreground">Trip:</span>
                          {orderDetails.order_details_data?.filter(d => d.trip_start).map((d, i) => (
                            <span key={i} className="font-[540] text-foreground">
                              {d.trip_start} — {d.trip_end}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Destination */}
                      {orderDetails.destination_country && (
                        <div className="flex items-center gap-2 text-[12px]">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                          <span className="font-[460] text-muted-foreground">Destination:</span>
                          <span className="font-[540] text-foreground">{orderDetails.destination_country}</span>
                        </div>
                      )}

                      {/* Tracking — Rental Device only */}
                      {productType === "Rental Device" && (orderDetails.tracking_information ?? []).length > 0 && (
                        <div className="pt-3 border-t border-border space-y-1.5">
                          <span className="text-[11px] font-[600] text-muted-foreground uppercase tracking-wide">Shipping</span>
                          {orderDetails.tracking_information!.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-[12px]">
                              <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.8} />
                              <span className="font-[460] text-foreground">
                                {t.shipping_carrier}: {t.shipping_tracking_number}
                              </span>
                              {t.device_serial && (
                                <span className="text-muted-foreground ml-auto">SN: {t.device_serial}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!orderDetails && !detailLoading && (
                  <div className="rounded-[16px] border border-border p-4">
                    <p className="text-[12px] font-[460] text-muted-foreground">Order details not available</p>
                  </div>
                )}

                {/* Notes Timeline */}
                <div className="rounded-[16px] border border-border p-4 space-y-3">
                  <h3 className="text-[13px] font-[600] text-foreground">Activity</h3>

                  {/* Add note */}
                  <div className="flex gap-2">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      rows={2}
                      className="flex-1 rounded-[8px] border border-border bg-muted/30 px-3 py-2 text-[13px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30 resize-none"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={!newNote.trim() || noteLoading}
                      className="self-end flex h-9 w-9 items-center justify-center rounded-[8px] bg-mysteria text-white transition-colors hover:bg-mysteria/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {noteLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" strokeWidth={1.8} />
                      )}
                    </button>
                  </div>

                  {/* Notes list */}
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender/60 mt-0.5">
                          <span className="text-[10px] font-[700] text-mysteria">
                            {note.authorName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-[540] text-foreground">{note.authorName}</span>
                            <Badge variant="outline" className="text-[9px] font-[600] px-1 py-0 capitalize border-border">
                              {note.authorRole}
                            </Badge>
                            <span className="text-[10px] font-[460] text-muted-foreground/60 ml-auto">
                              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-[12px] font-[460] text-muted-foreground mt-0.5 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
