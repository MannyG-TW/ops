"use client";

import { useState, useEffect, useMemo } from "react";
import { Signal, Loader2, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchTelliSIM } from "@/lib/settings-client";
import { parsePlanSku } from "@/lib/sku-parser";
import { getPlanCountries } from "@/lib/plan-catalog";
import { getCountryName } from "@/lib/countries";

interface ConnectivityOrder {
  id: string;
  order_number?: string;
  customer_email?: string;
  destination_country?: string;
}

interface ConnectivityDialogProps {
  open: boolean;
  onClose: () => void;
  order: ConnectivityOrder;
  iccid: string;
  agentName: string;
  agentId: string;
  planSku?: string;
}

interface TelliSimSnapshot {
  iccid: string;
  imei?: string;
  operator?: string;
  connectionStatus?: string;
  planState?: string;
}

const CONNECTIVITY_REASONS = [
  { value: "no_data", label: "No Data" },
  { value: "intermittent", label: "Intermittent Connection" },
  { value: "slow_speeds", label: "Slow Speeds" },
  { value: "cannot_register", label: "Cannot Register on Network" },
  { value: "other", label: "Other" },
];

export function ConnectivityDialog({
  open,
  onClose,
  order,
  iccid,
  agentName,
  agentId,
  planSku,
}: ConnectivityDialogProps) {
  const [telliSimData, setTelliSimData] = useState<TelliSimSnapshot | null>(null);
  const [telliSimLoading, setTelliSimLoading] = useState(false);
  const [telliSimError, setTelliSimError] = useState(false);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Determine if plan is single-country or regional/global
  const parsed = useMemo(() => planSku ? parsePlanSku(planSku) : null, [planSku]);
  const isSingleCountry = parsed ? /^[A-Z]{2}$/.test(parsed.countryCode) : false;
  const coveredCountries = useMemo(() => {
    if (!planSku) return [];
    if (isSingleCountry) return [];
    return getPlanCountries(planSku);
  }, [planSku, isSingleCountry]);
  const needsCountrySelection = !isSingleCountry && coveredCountries.length > 0;

  // Resolved country: single-country from SKU, or agent-selected for regional/global
  const country = isSingleCountry
    ? parsed?.countryCode ?? order.destination_country?.toUpperCase().slice(0, 2) ?? ""
    : selectedCountry;

  useEffect(() => {
    if (!open || !iccid) return;

    setTelliSimData(null);
    setTelliSimError(false);
    setTelliSimLoading(true);

    Promise.all([
      fetchTelliSIM(`/api/tellisim/subscription/${iccid}`, {}),
      fetchTelliSIM(`/api/tellisim/location/${iccid}`, {}),
    ])
      .then(([subData, locData]) => {
        const snapshot: TelliSimSnapshot = {
          iccid,
          imei: subData?.imei || locData?.imei,
          operator:
            locData?.operatorName ||
            locData?.operator ||
            subData?.operatorName ||
            subData?.operator,
          connectionStatus:
            locData?.connectionStatus || subData?.connectionStatus,
          planState: subData?.state,
        };
        setTelliSimData(snapshot);
      })
      .catch(() => {
        setTelliSimError(true);
      })
      .finally(() => {
        setTelliSimLoading(false);
      });
  }, [open, iccid]);

  if (!open) return null;

  const orderLabel = order.order_number || order.id || "N/A";

  function handleClose() {
    setReason("");
    setNotes("");
    setSelectedCountry("");
    setLoading(false);
    setSuccess(false);
    setTelliSimData(null);
    setTelliSimError(false);
    onClose();
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      await fetch("/api/reports/connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
          country: country,
          reason,
          notes,
          telliSimData: telliSimData ?? { iccid },
          reportedBy: agentName,
          reportedById: agentId,
        }),
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
      setLoading(false);
    }
  }

  const isOnline =
    telliSimData?.connectionStatus?.toLowerCase().includes("online") ||
    telliSimData?.connectionStatus?.toLowerCase().includes("active") ||
    telliSimData?.connectionStatus?.toLowerCase() === "connected";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-amethyst flex items-center gap-2">
            <Signal className="h-5 w-5" strokeWidth={2} />
            Report Connectivity Issue
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            Log a connectivity issue for order {orderLabel}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-3">
              <p className="text-[13px] font-[600] text-success">
                Connectivity issue reported for order {orderLabel}.
              </p>
            </div>
          ) : (
            <>
              {/* TelliSIM Status Panel */}
              <div className="rounded-[8px] bg-muted/30 border border-border/60 px-4 py-3 space-y-2.5">
                <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground">
                  TelliSIM Status
                </p>
                {telliSimLoading ? (
                  <div className="flex items-center gap-2 text-[12px] font-[460] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Fetching SIM data…
                  </div>
                ) : telliSimError ? (
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Could not fetch TelliSIM data.
                  </p>
                ) : telliSimData ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    <div>
                      <p className="text-[10px] font-[600] text-muted-foreground uppercase tracking-wide">ICCID</p>
                      <p className="text-[12px] font-[460] text-foreground font-mono truncate">{telliSimData.iccid || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-[600] text-muted-foreground uppercase tracking-wide">IMEI</p>
                      <p className="text-[12px] font-[460] text-foreground font-mono truncate">{telliSimData.imei || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-[600] text-muted-foreground uppercase tracking-wide">Operator</p>
                      <p className="text-[12px] font-[460] text-foreground truncate">{telliSimData.operator || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-[600] text-muted-foreground uppercase tracking-wide">Status</p>
                      {telliSimData.connectionStatus ? (
                        <Badge
                          className={`rounded-[6px] text-[10px] font-[600] border-0 px-1.5 py-0 flex items-center gap-1 w-fit ${
                            isOnline
                              ? "bg-success-soft text-success"
                              : "bg-fraud-red-soft text-fraud-red"
                          }`}
                        >
                          {isOnline ? (
                            <Wifi className="h-2.5 w-2.5" strokeWidth={2} />
                          ) : (
                            <WifiOff className="h-2.5 w-2.5" strokeWidth={2} />
                          )}
                          {telliSimData.connectionStatus}
                        </Badge>
                      ) : (
                        <p className="text-[12px] font-[460] text-foreground">—</p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-[600] text-muted-foreground uppercase tracking-wide">Plan State</p>
                      <p className="text-[12px] font-[460] text-foreground">{telliSimData.planState || "—"}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Country / Order info */}
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3 space-y-2">
                {isSingleCountry && parsed ? (
                  <p className="text-[12px] font-[460] text-charcoal">
                    <span className="font-[600]">Country:</span> {parsed.countryName} ({parsed.countryCode})
                    {order.customer_email && (
                      <span className="ml-2 text-muted-foreground">— {order.customer_email}</span>
                    )}
                  </p>
                ) : needsCountrySelection ? (
                  <div>
                    <p className="text-[12px] font-[600] text-charcoal mb-1.5">
                      Country <span className="text-fraud-red">*</span>
                      <span className="font-[460] text-muted-foreground ml-1">— {parsed?.countryName || "Regional/Global"} plan, select where the issue is occurring</span>
                    </p>
                    <Select value={selectedCountry} onValueChange={(v) => setSelectedCountry(v ?? "")}>
                      <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                        <SelectValue placeholder="Select country…" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[8px] max-h-[200px]">
                        {coveredCountries.map((c) => (
                          <SelectItem key={c} value={c} className="text-[13px] font-[460]">
                            {getCountryName(c)} ({c})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {order.customer_email && (
                      <p className="text-[11px] font-[460] text-muted-foreground mt-1">{order.customer_email}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] font-[460] text-charcoal">
                    <span className="font-[600]">Destination:</span> {order.destination_country || "Unknown"}
                    {order.customer_email && (
                      <span className="ml-2 text-muted-foreground">— {order.customer_email}</span>
                    )}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason</p>
                <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[8px]">
                    {CONNECTIVITY_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px] font-[460]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">
                  Notes <span className="font-[460] text-muted-foreground">(optional)</span>
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any additional context…"
                  className="rounded-[8px] min-h-[80px] text-[13px] font-[460] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleClose}
                  disabled={loading}
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!reason || (needsCountrySelection && !selectedCountry) || loading}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? "Reporting…" : "Report Issue"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
