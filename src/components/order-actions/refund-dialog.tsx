"use client";

import { useState } from "react";
import { AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface RefundOrder {
  id: string;
  order_number?: string;
  customer_email?: string;
  // Real orders-index fields (raw _source from /api/opensearch/customer).
  // customer_name is a single field; currency is currency_iso; there is no
  // total_usd / destination_country in the index.
  customer_name?: string;
  total?: number;
  currency_iso?: string;
}

interface RefundDialogProps {
  open: boolean;
  onClose: () => void;
  order: RefundOrder;
  agentName: string;
  agentId: string;
}

type RefundType = "full" | "partial";
type Step = "form" | "confirm";

const REFUND_REASONS = [
  { value: "connectivity_issues", label: "Connectivity Issues" },
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_order", label: "Duplicate Order" },
  { value: "late_delivery", label: "Late Delivery" },
  { value: "device_malfunction", label: "Device Malfunction" },
  { value: "billing_error", label: "Billing Error" },
  { value: "other", label: "Other" },
];

export function RefundDialog({ open, onClose, order, agentName, agentId }: RefundDialogProps) {
  const [refundType, setRefundType] = useState<RefundType>("full");
  const [amount, setAmount] = useState(String(order.total ?? ""));
  const [reason, setReason] = useState("");
  // No order-level country field exists in the index; operator selects it
  const [country, setCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!open) return null;

  const orderLabel = order.order_number || order.id || "N/A";
  const customerName = order.customer_name?.trim() || order.customer_email || "Customer";
  const currency = order.currency_iso || "USD";
  const orderTotal = order.total ?? 0;
  const displayAmount = refundType === "full" ? orderTotal.toFixed(2) : amount;

  function handleClose() {
    setRefundType("full");
    setAmount(String(order.total ?? ""));
    setReason("");
    setCountry("");
    setNotes("");
    setStep("form");
    setLoading(false);
    setSuccess(false);
    setSubmitError(null);
    onClose();
  }

  function handleTypeChange(type: RefundType) {
    setRefundType(type);
    if (type === "full") {
      setAmount(String(order.total ?? ""));
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/reports/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
          type: refundType,
          amount: displayAmount,
          currency,
          reason,
          ...(reason === "connectivity_issues" ? { country } : {}),
          notes,
          processedBy: agentName,
          processedById: agentId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      // Don't report success on a 4xx/5xx — the report was not written.
      if (!res.ok || data.ok === false) {
        setSubmitError(data.error || `Refund failed (${res.status})`);
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
      setSubmitError("Refund request failed — please retry.");
      setLoading(false);
    }
  }

  // Connectivity refunds also create a country-scoped connectivity report, so a
  // valid 2-letter country is required (the API rejects it otherwise).
  const canContinue =
    reason &&
    (refundType === "full" || (amount && parseFloat(amount) > 0)) &&
    (reason !== "connectivity_issues" || country.trim().length === 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-amethyst flex items-center gap-2">
            <DollarSign className="h-5 w-5" strokeWidth={2} />
            Refund Order
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            {step === "form"
              ? "Select refund type, amount, and reason before continuing."
              : `Confirm refund for order ${orderLabel}.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-3">
              <p className="text-[13px] font-[600] text-success">
                Refund for order {orderLabel} has been processed.
              </p>
            </div>
          ) : step === "form" ? (
            <>
              {/* Order summary */}
              <div className="rounded-[8px] bg-lavender/10 border border-lavender/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-charcoal">
                  <span className="font-[600]">{customerName}</span> — Order {orderLabel}
                  {orderTotal > 0 && (
                    <span className="ml-1">
                      ({currency} {orderTotal.toFixed(2)})
                    </span>
                  )}
                </p>
              </div>

              {/* Refund type toggle */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Refund Type</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange("full")}
                    className={`flex-1 rounded-[8px] px-3 py-1.5 text-[12px] font-[600] transition-colors cursor-pointer ${
                      refundType === "full"
                        ? "bg-amethyst text-white"
                        : "bg-cream text-charcoal hover:bg-cream/80"
                    }`}
                  >
                    Full Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange("partial")}
                    className={`flex-1 rounded-[8px] px-3 py-1.5 text-[12px] font-[600] transition-colors cursor-pointer ${
                      refundType === "partial"
                        ? "bg-amethyst text-white"
                        : "bg-cream text-charcoal hover:bg-cream/80"
                    }`}
                  >
                    Partial Refund
                  </button>
                </div>
              </div>

              {/* Amount (partial only) */}
              {refundType === "partial" && (
                <div>
                  <p className="text-[12px] font-[600] text-foreground mb-1.5">
                    Amount <span className="font-[460] text-muted-foreground">({currency})</span>
                  </p>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={orderTotal.toFixed(2)}
                    className="rounded-[8px] text-[13px] font-[460]"
                  />
                </div>
              )}

              {/* Reason */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason</p>
                <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[8px]">
                    {REFUND_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px] font-[460]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country (connectivity issues only) */}
              {reason === "connectivity_issues" && (
                <div>
                  <p className="text-[12px] font-[600] text-foreground mb-1.5">Country Code</p>
                  <Input
                    value={country}
                    onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="e.g. US"
                    maxLength={2}
                    className="rounded-[8px] text-[13px] font-[460] uppercase"
                  />
                  <p className="text-[11px] font-[460] text-amethyst mt-1.5">
                    This will also create a connectivity report for this country.
                  </p>
                </div>
              )}

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
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!canContinue}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation */}
              <div className="rounded-[8px] bg-fraud-yellow-soft border border-fraud-yellow/20 px-4 py-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-fraud-yellow flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <p className="text-[13px] font-[600] text-charcoal">
                    {refundType === "full" ? "Full refund" : `Partial refund of ${currency} ${displayAmount}`} for order {orderLabel}
                  </p>
                  <p className="text-[12px] font-[460] text-charcoal/70 mt-0.5">
                    Reason: {REFUND_REASONS.find((r) => r.value === reason)?.label}
                    {notes && ` — ${notes}`}
                  </p>
                </div>
              </div>

              {submitError && (
                <p className="text-[12px] font-[540] text-fraud-red">{submitError}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => setStep("form")}
                  disabled={loading}
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Back
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="rounded-[8px] bg-amethyst text-white text-[13px] font-[600] hover:bg-amethyst/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? "Processing…" : "Confirm Refund"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
