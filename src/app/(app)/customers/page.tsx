"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  productType: string;
  lastOrderDate: string;
  totalOrders: number;
  totalSpent: string;
}

const mockCustomers: Customer[] = [
  {
    id: "cust-001",
    name: "John Smith",
    email: "j.smith@tempmail.com",
    phone: "+1 (555) 012-3456",
    productType: "Travel WiFi",
    lastOrderDate: "2026-04-08",
    totalOrders: 5,
    totalSpent: "$389.95",
  },
  {
    id: "cust-002",
    name: "Alice Wong",
    email: "alice.w@proton.me",
    phone: "+44 7700 900123",
    productType: "Sapphire Hotspot",
    lastOrderDate: "2026-04-07",
    totalOrders: 2,
    totalSpent: "$249.98",
  },
  {
    id: "cust-003",
    name: "Bob Martinez",
    email: "bob.m@gmail.com",
    phone: "+1 (555) 987-6543",
    productType: "eSIM",
    lastOrderDate: "2026-04-06",
    totalOrders: 3,
    totalSpent: "$59.97",
  },
  {
    id: "cust-004",
    name: "Emily Chen",
    email: "emily.chen@yahoo.com",
    phone: "+61 412 345 678",
    productType: "Travel WiFi",
    lastOrderDate: "2026-04-05",
    totalOrders: 7,
    totalSpent: "$629.93",
  },
  {
    id: "cust-005",
    name: "James Lee",
    email: "j.lee@outlook.com",
    phone: "+1 (555) 234-5678",
    productType: "eSIM",
    lastOrderDate: "2026-04-04",
    totalOrders: 1,
    totalSpent: "$29.99",
  },
  {
    id: "cust-006",
    name: "Sarah Johnson",
    email: "s.johnson@icloud.com",
    phone: "+1 (555) 876-5432",
    productType: "Sapphire Hotspot",
    lastOrderDate: "2026-04-03",
    totalOrders: 4,
    totalSpent: "$499.96",
  },
  {
    id: "cust-007",
    name: "Michael Brown",
    email: "m.brown@gmail.com",
    phone: "+1 (555) 345-6789",
    productType: "Travel WiFi",
    lastOrderDate: "2026-04-02",
    totalOrders: 2,
    totalSpent: "$179.98",
  },
  {
    id: "cust-008",
    name: "Lisa Tanaka",
    email: "lisa.t@yahoo.co.jp",
    phone: "+81 90 1234 5678",
    productType: "eSIM",
    lastOrderDate: "2026-04-01",
    totalOrders: 6,
    totalSpent: "$119.94",
  },
  {
    id: "cust-009",
    name: "David Park",
    email: "d.park@naver.com",
    phone: "+82 10 9876 5432",
    productType: "Travel WiFi",
    lastOrderDate: "2026-03-30",
    totalOrders: 3,
    totalSpent: "$269.97",
  },
  {
    id: "cust-010",
    name: "Anna Mueller",
    email: "a.mueller@web.de",
    phone: "+49 151 2345 6789",
    productType: "Sapphire Hotspot",
    lastOrderDate: "2026-03-28",
    totalOrders: 1,
    totalSpent: "$149.99",
  },
];

const productTypeColors: Record<string, string> = {
  "Travel WiFi": "bg-success-soft text-success",
  "Sapphire Hotspot": "bg-fraud-yellow-soft text-fraud-yellow",
  eSIM: "bg-lavender/20 text-amethyst",
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = mockCustomers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-[540] text-charcoal">Customers</h1>
        <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
          Browse and manage customer accounts
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-[8px]"
        />
      </div>

      {/* Customers Table */}
      <Card className="rounded-[16px]">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Product Type</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Total Spent</TableHead>
                <TableHead>Last Order</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/customers/${customer.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cream text-[12px] font-[600] text-charcoal">
                        {customer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-[13px] font-[540] text-charcoal">
                        {customer.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] font-[460] text-muted-foreground">
                    {customer.email}
                  </TableCell>
                  <TableCell className="text-[13px] font-[460] text-muted-foreground">
                    {customer.phone}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-[600] ${
                        productTypeColors[customer.productType] || ""
                      }`}
                    >
                      {customer.productType}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] font-[540] text-charcoal">
                    {customer.totalOrders}
                  </TableCell>
                  <TableCell className="text-[13px] font-[540] text-charcoal">
                    {customer.totalSpent}
                  </TableCell>
                  <TableCell className="text-[13px] font-[460] text-muted-foreground">
                    {customer.lastOrderDate}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-[14px] font-[540] text-muted-foreground">
            No customers found
          </p>
          <p className="text-[13px] font-[460] text-muted-foreground/70">
            Try a different search term
          </p>
        </div>
      )}
    </div>
  );
}
