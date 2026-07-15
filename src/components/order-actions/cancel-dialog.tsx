"use client";

import { useState } from "react";
import { AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CancelOrder {
  id: string;
  order_number?: string;
  customer_email?: string;
  // Real orders-index fields: single customer_name, currency is currency_iso
  customer_name?: string;
  total?: number;
  currency_iso?: string;
}

interface CancelDialogProps {
  open: boolean;
  onClose: () => void;
  order: CancelOrder;
  agentName: string;
  agentId: string;
}

type Step = "form" | "confirm";

const CANCEL_REASONS = [
  { value: "customer_request", label: "Customer Request" },
  { value: "duplicate_order", label: "Duplicate Order" },
  { value: "fraud", label: "Fraud" },
  { value: "other", label: "Other" },
];

export function CancelDialog({ open, onClose, order, agentName, agentId }: CancelDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const orderLabel = order.order_number || order.id || "N/A";
  const customerName = order.customer_name?.trim() || order.customer_email || "Customer";

  function handleClose() {
    setReason("");
    setNotes("");
    setStep("form");
    setLoading(false);
    setSuccess(false);
    onClose();
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch("/api/reports/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          orderNumber: order.order_number,
          customerEmail: order.customer_email,
          reason,
          notes,
          cancelledBy: agentName,
          cancelledById: agentId,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <Card className="rounded-[16px] w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-[16px] font-[600] text-fraud-red flex items-center gap-2">
            <XCircle className="h-5 w-5" strokeWidth={2} />
            Cancel Order
          </CardTitle>
          <p className="text-[12px] font-[460] text-muted-foreground mt-1">
            {step === "form"
              ? "Select a reason and optionally add notes before cancelling."
              : `Confirm cancellation of order ${orderLabel}.`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="rounded-[8px] bg-success-soft border border-success/20 px-4 py-3">
              <p className="text-[13px] font-[600] text-success">
                Order {orderLabel} has been cancelled.
              </p>
            </div>
          ) : step === "form" ? (
            <>
              {/* Order summary */}
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-3">
                <p className="text-[12px] font-[460] text-fraud-red/80">
                  <span className="font-[600]">{customerName}</span> — Order {orderLabel}
                  {order.total != null && (
                    <span className="ml-1">
                      ({order.total.toFixed(2)}
                      {order.currency_iso ? ` ${order.currency_iso.toUpperCase()}` : ""})
                    </span>
                  )}
                </p>
              </div>

              {/* Reason */}
              <div>
                <p className="text-[12px] font-[600] text-foreground mb-1.5">Reason</p>
                <Select value={reason} onValueChange={(v) => setReason(v ?? "")}>
                  <SelectTrigger className="rounded-[8px] text-[13px] font-[460]">
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[8px]">
                    {CANCEL_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value} className="text-[13px] font-[460]">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reason === "fraud" && (
                  <p className="text-[11px] font-[460] text-fraud-red mt-1.5">
                    This will also file a fraud report.
                  </p>
                )}
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
                  className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
                >
                  Close
                </Button>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!reason}
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Confirmation */}
              <div className="rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-fraud-red flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div>
                  <p className="text-[13px] font-[600] text-fraud-red">
                    Are you sure you want to cancel order {orderLabel}?
                  </p>
                  <p className="text-[12px] font-[460] text-fraud-red/70 mt-0.5">
                    Reason: {CANCEL_REASONS.find((r) => r.value === reason)?.label}
                    {notes && ` — ${notes}`}
                  </p>
                </div>
              </div>

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
                  className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 disabled:opacity-40 cursor-pointer"
                >
                  {loading ? "Cancelling…" : "Confirm Cancel"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
