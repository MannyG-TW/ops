"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Search,
  Plus,
  AlertTriangle,
  Eye,
  CheckCircle,
  Clock,
  Mail,
  Phone,
  CreditCard,
  User,
  ChevronDown,
  X,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type FraudStatus = "active" | "investigating" | "resolved";

interface FraudCase {
  id: string;
  customerName: string;
  email: string;
  phone: string;
  lastFourCC: string;
  matchedIdentifiers: string[];
  occurrenceCount: number;
  status: FraudStatus;
  flaggedDate: string;
  orderIds: string[];
  notes: string;
  assignedTo: string;
}

const mockFraudCases: FraudCase[] = [
  {
    id: "FRD-001",
    customerName: "John Smith",
    email: "j.smith@tempmail.com",
    phone: "+1 (555) 012-3456",
    lastFourCC: "4829",
    matchedIdentifiers: ["email", "phone", "cc"],
    occurrenceCount: 7,
    status: "active",
    flaggedDate: "2026-04-08",
    orderIds: ["ORD-9812", "ORD-9834", "ORD-9901"],
    notes: "Multiple chargebacks filed across different names",
    assignedTo: "Maria G.",
  },
  {
    id: "FRD-002",
    customerName: "Alice Wong",
    email: "alice.w@proton.me",
    phone: "+44 7700 900123",
    lastFourCC: "1137",
    matchedIdentifiers: ["cc", "address"],
    occurrenceCount: 3,
    status: "investigating",
    flaggedDate: "2026-04-07",
    orderIds: ["ORD-9756"],
    notes: "Shipping address linked to known fraud ring",
    assignedTo: "Carlos R.",
  },
  {
    id: "FRD-003",
    customerName: "Bob Martinez",
    email: "bob.m@gmail.com",
    phone: "+1 (555) 987-6543",
    lastFourCC: "5502",
    matchedIdentifiers: ["phone"],
    occurrenceCount: 2,
    status: "investigating",
    flaggedDate: "2026-04-06",
    orderIds: ["ORD-9688", "ORD-9701"],
    notes: "Same phone used with different identities",
    assignedTo: "Maria G.",
  },
  {
    id: "FRD-004",
    customerName: "Emily Chen",
    email: "emily.chen@yahoo.com",
    phone: "+61 412 345 678",
    lastFourCC: "8891",
    matchedIdentifiers: ["email", "cc"],
    occurrenceCount: 5,
    status: "active",
    flaggedDate: "2026-04-05",
    orderIds: ["ORD-9501", "ORD-9523", "ORD-9544"],
    notes: "Velocity pattern: 5 orders in 2 hours",
    assignedTo: "Carlos R.",
  },
  {
    id: "FRD-005",
    customerName: "James Lee",
    email: "j.lee@outlook.com",
    phone: "+1 (555) 234-5678",
    lastFourCC: "3347",
    matchedIdentifiers: ["email"],
    occurrenceCount: 1,
    status: "resolved",
    flaggedDate: "2026-04-01",
    orderIds: ["ORD-9402"],
    notes: "False positive - verified legitimate customer",
    assignedTo: "Maria G.",
  },
  {
    id: "FRD-006",
    customerName: "Sarah Johnson",
    email: "s.johnson@disposable.com",
    phone: "+1 (555) 876-5432",
    lastFourCC: "6614",
    matchedIdentifiers: ["email", "phone", "cc", "address"],
    occurrenceCount: 12,
    status: "active",
    flaggedDate: "2026-04-03",
    orderIds: ["ORD-9300", "ORD-9312", "ORD-9344", "ORD-9389"],
    notes: "Serial fraudster. Disposable emails, rotating phones.",
    assignedTo: "Carlos R.",
  },
];

const statusConfig: Record<
  FraudStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  active: {
    label: "Active",
    color: "text-fraud-red",
    bgColor: "bg-fraud-red-soft",
    icon: AlertTriangle,
  },
  investigating: {
    label: "Investigating",
    color: "text-fraud-yellow",
    bgColor: "bg-fraud-yellow-soft",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    color: "text-success",
    bgColor: "bg-success-soft",
    icon: CheckCircle,
  },
};

export default function FraudPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FraudStatus | "all">("all");
  const [selectedCase, setSelectedCase] = useState<FraudCase | null>(null);
  const [showNewFlag, setShowNewFlag] = useState(false);

  const filtered = mockFraudCases.filter((c) => {
    const matchesSearch =
      !search ||
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    active: mockFraudCases.filter((c) => c.status === "active").length,
    investigating: mockFraudCases.filter((c) => c.status === "investigating")
      .length,
    resolved: mockFraudCases.filter((c) => c.status === "resolved").length,
    total: mockFraudCases.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-[540] text-charcoal">Fraud Watch</h1>
          <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
            Monitor and manage flagged fraud cases
          </p>
        </div>
        <Dialog open={showNewFlag} onOpenChange={setShowNewFlag}>
          <DialogTrigger
            render={
              <Button className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]">
                <Plus className="h-4 w-4" />
                Flag New Order
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Flag New Order</DialogTitle>
              <DialogDescription>
                Enter an order ID to flag for fraud investigation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Order ID
                </label>
                <Input
                  placeholder="e.g. ORD-9812"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-[540] text-charcoal">
                  Reason
                </label>
                <Input
                  placeholder="Describe the suspicious activity"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setShowNewFlag(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-fraud-red text-white hover:bg-fraud-red/90 rounded-[8px]"
                onClick={() => setShowNewFlag(false)}
              >
                <ShieldAlert className="h-4 w-4" />
                Flag Order
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Total Cases",
            value: stats.total,
            icon: ShieldAlert,
            color: "text-amethyst",
            bg: "bg-lavender/20",
          },
          {
            label: "Active",
            value: stats.active,
            icon: AlertTriangle,
            color: "text-fraud-red",
            bg: "bg-fraud-red-soft",
          },
          {
            label: "Investigating",
            value: stats.investigating,
            icon: Clock,
            color: "text-fraud-yellow",
            bg: "bg-fraud-yellow-soft",
          },
          {
            label: "Resolved",
            value: stats.resolved,
            icon: CheckCircle,
            color: "text-success",
            bg: "bg-success-soft",
          },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-[16px]">
            <CardContent className="flex items-center gap-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-[8px] ${stat.bg}`}
              >
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-[12px] font-[460] text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-[20px] font-[600] text-charcoal">
                  {stat.value}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search cases, emails, IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-[8px]"
          />
        </div>
        <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-muted p-0.5">
          {(["all", "active", "investigating", "resolved"] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                  statusFilter === status
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted-foreground hover:text-charcoal"
                }`}
              >
                {status === "all"
                  ? "All"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Fraud Cases List */}
      <div className="space-y-3">
        {filtered.map((fraudCase) => {
          const config = statusConfig[fraudCase.status];
          const StatusIcon = config.icon;
          return (
            <Card
              key={fraudCase.id}
              className="rounded-[16px] transition-shadow hover:shadow-md cursor-pointer"
              onClick={() => setSelectedCase(fraudCase)}
            >
              <CardContent className="p-0">
                <div className="flex items-start justify-between p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] ${config.bgColor}`}
                    >
                      <StatusIcon
                        className={`h-5 w-5 ${config.color}`}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-[600] text-charcoal">
                          {fraudCase.customerName}
                        </span>
                        <span className="text-[12px] font-[460] text-muted-foreground">
                          {fraudCase.id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-[600] ${config.bgColor} ${config.color}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-[460] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {fraudCase.email}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {fraudCase.phone}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5" />
                          ****{fraudCase.lastFourCC}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[12px] font-[460] text-muted-foreground">
                          Matched:
                        </span>
                        {fraudCase.matchedIdentifiers.map((id) => (
                          <span
                            key={id}
                            className="rounded-[6px] bg-lavender/20 px-1.5 py-0.5 text-[11px] font-[540] text-amethyst"
                          >
                            {id}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[20px] font-[700] text-charcoal">
                      {fraudCase.occurrenceCount}
                    </div>
                    <div className="text-[11px] font-[460] text-muted-foreground">
                      occurrences
                    </div>
                    <div className="mt-1 text-[11px] font-[460] text-muted-foreground">
                      {fraudCase.flaggedDate}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-[14px] font-[540] text-muted-foreground">
            No fraud cases found
          </p>
          <p className="text-[13px] font-[460] text-muted-foreground/70">
            Adjust your filters or search query
          </p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedCase}
        onOpenChange={(open) => !open && setSelectedCase(null)}
      >
        {selectedCase && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-fraud-red" />
                {selectedCase.id} - {selectedCase.customerName}
              </DialogTitle>
              <DialogDescription>
                Full fraud case history and details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[8px] bg-muted/50 p-3">
                  <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-0.5 text-[13px] font-[460] text-charcoal">
                    {selectedCase.email}
                  </p>
                </div>
                <div className="rounded-[8px] bg-muted/50 p-3">
                  <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                    Phone
                  </p>
                  <p className="mt-0.5 text-[13px] font-[460] text-charcoal">
                    {selectedCase.phone}
                  </p>
                </div>
                <div className="rounded-[8px] bg-muted/50 p-3">
                  <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                    Card (Last 4)
                  </p>
                  <p className="mt-0.5 text-[13px] font-[460] text-charcoal">
                    ****{selectedCase.lastFourCC}
                  </p>
                </div>
                <div className="rounded-[8px] bg-muted/50 p-3">
                  <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                    Assigned To
                  </p>
                  <p className="mt-0.5 text-[13px] font-[460] text-charcoal">
                    {selectedCase.assignedTo}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                  Linked Orders
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedCase.orderIds.map((oid) => (
                    <span
                      key={oid}
                      className="rounded-[6px] bg-lavender/20 px-2 py-1 text-[12px] font-[540] text-amethyst"
                    >
                      {oid}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-[540] uppercase tracking-wider text-muted-foreground">
                  Notes
                </p>
                <p className="mt-1 text-[13px] font-[460] text-charcoal">
                  {selectedCase.notes}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-[8px]"
                onClick={() => setSelectedCase(null)}
              >
                Close
              </Button>
              {selectedCase.status !== "resolved" && (
                <Button className="bg-success text-white hover:bg-success/90 rounded-[8px]">
                  <CheckCircle className="h-4 w-4" />
                  Mark Resolved
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
