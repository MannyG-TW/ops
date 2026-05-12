"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface LookupCardProps {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  error: string | null;
  empty?: boolean;
  badge?: { label: string; className: string } | null;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function LookupCard({
  title,
  icon,
  loading,
  error,
  empty,
  badge,
  fullWidth,
  children,
}: LookupCardProps) {
  return (
    <Card className={`rounded-[8px] ${fullWidth ? "col-span-full" : ""}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-lavender/10">
            {icon}
          </div>
          <h3 className="text-[13px] font-[600] text-charcoal">{title}</h3>
          {badge && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-[540] ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {!loading && error && (
          <p className="text-[12px] font-[460] text-fraud-red">{error}</p>
        )}

        {!loading && !error && empty && (
          <p className="text-[12px] font-[460] text-muted-foreground">No data found</p>
        )}

        {!loading && !error && !empty && children}
      </CardContent>
    </Card>
  );
}

export function KVRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === "" || value === null || value === undefined) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-[12px] font-[460] text-muted-foreground">{label}</span>
      <span className="text-right text-[12px] font-[540] text-charcoal">{value}</span>
    </div>
  );
}
