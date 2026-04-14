"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Package,
  ArrowRight,
  Inbox,
  Loader2,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { fetchOS } from "@/lib/settings-client";

interface SearchResult {
  id: string;
  order_number: string;
  customer_email: string;
  customer_first_name: string;
  customer_last_name: string;
  status: string;
  system: string;
  total: number;
  currency: string;
  total_usd: number;
  created_at: string;
  serials: string[];
  product_sku: string;
  destination_country: string;
  order_details_data: unknown;
}

const statusColors: Record<string, string> = {
  shipped: "bg-lavender/20 text-amethyst",
  delivered: "bg-success-soft text-success",
  processing: "bg-fraud-yellow-soft text-fraud-yellow",
  cancelled: "bg-fraud-red-soft text-fraud-red",
  pending: "bg-fraud-yellow-soft text-fraud-yellow",
  completed: "bg-success-soft text-success",
  refunded: "bg-fraud-red-soft text-fraud-red",
};

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 300);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      setTotal(0);
      setHasSearched(false);
      setError(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setNotConfigured(false);

    try {
      const data = await fetchOS("/api/opensearch/search", { query: term });
      if (controller.signal.aborted) return;
      setResults(data.results ?? []);
      setTotal(data.total ?? 0);
      setHasSearched(true);
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      if (message.toLowerCase().includes("not configured")) {
        setNotConfigured(true);
      } else {
        setError(message);
      }
      setResults([]);
      setTotal(0);
      setHasSearched(true);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Sync URL query param
  useEffect(() => {
    const currentQ = searchParams.get("q") || "";
    if (debouncedQuery && debouncedQuery !== currentQ) {
      router.replace(`/search?q=${encodeURIComponent(debouncedQuery)}`, {
        scroll: false,
      });
    } else if (!debouncedQuery && currentQ) {
      router.replace("/search", { scroll: false });
    }
  }, [debouncedQuery, router, searchParams]);

  // Execute search on debounced query change
  useEffect(() => {
    doSearch(debouncedQuery);
  }, [debouncedQuery, doSearch]);

  const hasQuery = query.trim().length > 0;

  // Not configured state
  if (notConfigured) {
    return (
      <div className="space-y-6">
        <Header />
        <SearchInput query={query} onChange={setQuery} loading={false} />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-fraud-yellow-soft">
            <Settings className="h-8 w-8 text-fraud-yellow" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            OpenSearch not configured
          </p>
          <p className="mt-1 max-w-sm text-[13px] font-[460] text-muted-foreground">
            Go to{" "}
            <Link
              href="/settings"
              className="text-amethyst underline underline-offset-2"
            >
              Settings
            </Link>{" "}
            to add your OpenSearch credentials before searching.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />
      <SearchInput query={query} onChange={setQuery} loading={loading} />

      {/* Loading state */}
      {loading && hasQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amethyst" />
          <p className="mt-4 text-[14px] font-[460] text-muted-foreground">
            Searching...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-fraud-red-soft">
            <AlertTriangle className="h-8 w-8 text-fraud-red" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            Search failed
          </p>
          <p className="mt-1 max-w-md text-[13px] font-[460] text-muted-foreground">
            {error}
          </p>
        </div>
      )}

      {/* Empty query state */}
      {!hasQuery && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-lavender/20">
            <Search className="h-8 w-8 text-amethyst" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            Start searching
          </p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Enter a name, email, order number, or SKU to find results
          </p>
        </div>
      )}

      {/* No results */}
      {hasQuery && hasSearched && !loading && !error && total === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[16px] bg-muted">
            <Inbox className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="mt-4 text-[15px] font-[540] text-charcoal">
            No results found
          </p>
          <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
            Try a different search term or check your spelling
          </p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && results.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-amethyst" />
            <h2 className="text-[14px] font-[600] text-charcoal">Orders</h2>
            <span className="rounded-full bg-lavender/20 px-2 py-0.5 text-[11px] font-[600] text-amethyst">
              {total}
            </span>
          </div>
          <div className="space-y-2">
            {results.map((result) => {
              const customerName = [
                result.customer_first_name,
                result.customer_last_name,
              ]
                .filter(Boolean)
                .join(" ");
              const statusKey = (result.status || "").toLowerCase();
              const formattedDate = result.created_at
                ? (() => {
                    let ts = typeof result.created_at === "string" ? Number(result.created_at) : result.created_at;
                    if (!isNaN(ts as number) && (ts as number) < 1e12) ts = (ts as number) * 1000;
                    return new Date(ts as number).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  })()
                : "";
              const totalDisplay =
                result.total_usd != null
                  ? `$${Number(result.total_usd).toFixed(2)}`
                  : result.total != null
                    ? `${Number(result.total).toFixed(2)} ${result.currency || ""}`
                    : "";

              return (
                <Link
                  key={result.id}
                  href={`/customers/${encodeURIComponent(result.customer_email)}`}
                >
                  <Card className="rounded-[8px] transition-shadow hover:shadow-md cursor-pointer">
                    <CardContent className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/10">
                          <Package className="h-4 w-4 text-amethyst" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-[600] text-charcoal">
                              {result.order_number || result.id}
                            </span>
                            {statusKey && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-[540] ${
                                  statusColors[statusKey] ||
                                  "bg-muted text-muted-foreground"
                                }`}
                              >
                                {result.status}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[12px] font-[460] text-muted-foreground">
                            {customerName}
                            {result.customer_email &&
                              ` (${result.customer_email})`}
                            {result.product_sku &&
                              ` \u00B7 ${result.product_sku}`}
                            {totalDisplay && ` \u00B7 ${totalDisplay}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {formattedDate && (
                          <span className="text-[12px] font-[460] text-muted-foreground">
                            {formattedDate}
                          </span>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-[22px] font-[540] text-charcoal">Search</h1>
      <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
        Find orders, customers, and devices across the platform
      </p>
    </div>
  );
}

function SearchInput({
  query,
  onChange,
  loading,
}: {
  query: string;
  onChange: (v: string) => void;
  loading: boolean;
}) {
  return (
    <div className="relative max-w-2xl">
      {loading ? (
        <Loader2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-amethyst" />
      ) : (
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      )}
      <Input
        placeholder="Search orders, customers, IMEI, emails..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 pl-12 text-[15px] rounded-[16px] border-border"
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Header />
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search orders, customers, IMEI, emails..."
              className="h-12 pl-12 text-[15px] rounded-[16px] border-border"
              disabled
            />
          </div>
        </div>
      }
    >
      <SearchPageContent />
    </Suspense>
  );
}
