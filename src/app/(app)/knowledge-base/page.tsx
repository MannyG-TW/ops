"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  BookOpen,
  Search,
  Globe,
  MapPin,
  ChevronDown,
  ChevronRight,
  Info,
  AlertTriangle,
  Layers,
  Wifi,
  Smartphone,
  Check,
  X,
  Copy,
  ChevronsUpDown,
  HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  loadCatalog,
  getSeason,
  type LocalProduct,
  type RegionalRegion,
  type Tier,
  type SeasonSchedule,
} from "@/lib/plan-catalog";
import { getCountryName } from "@/lib/countries";
import { getCountryFlag } from "@/lib/country-flags";
import { KbSlideOver } from "@/components/kb-slide-over";

// ─── Types ───

type Season = "peak" | "high" | "shoulder" | "low";
type ProductTab = "esim" | "rental" | "sapphire";

interface ProductCatalog {
  local: { products: LocalProduct[]; season_schedule?: SeasonSchedule; currency: string } | null;
  regional: { regions: Record<string, RegionalRegion>; currency: string } | null;
  global: { tiers: Tier[]; currency: string } | null;
}

interface AllCatalogs {
  esim: ProductCatalog;
  rental: ProductCatalog;
  sapphire: ProductCatalog;
}

// ─── Helpers ───

function currentSeason(schedule: SeasonSchedule | null | undefined): Season {
  if (!schedule) return "shoulder";
  return getSeason(new Date(), schedule);
}

const SEASON_LABELS: Record<Season, string> = { peak: "Peak", high: "High", shoulder: "Shoulder", low: "Low" };
const SEASON_MONTHS: Record<Season, string> = { peak: "May–Aug", high: "Apr, Sep, Oct", shoulder: "Mar, Nov", low: "Jan, Feb, Dec" };
const SEASON_COLORS: Record<Season, string> = {
  peak: "bg-fraud-red-soft text-fraud-red",
  high: "bg-fraud-yellow-soft text-fraud-yellow",
  shoulder: "bg-lavender/20 text-amethyst",
  low: "bg-success-soft text-success",
};

const PRODUCT_META: Record<ProductTab, { label: string; icon: typeof Globe; color: string; badgeColor: string; kbModels: { model: string; label: string }[]; description: string }> = {
  esim: {
    label: "eSIM",
    icon: Globe,
    color: "bg-lavender/20 text-amethyst",
    badgeColor: "bg-lavender/15 text-amethyst",
    kbModels: [{ model: "ESIM", label: "eSIM Setup & Troubleshooting" }],
    description: "Digital SIM plans — local, regional, and global coverage. TOTAL_DATA model (fixed pool, no throttling).",
  },
  rental: {
    label: "Rental",
    icon: Wifi,
    color: "bg-success-soft text-success",
    badgeColor: "bg-success-soft text-success",
    kbModels: [
      { model: "RENTAL", label: "Rental Plans Guide" },
      { model: "U2S", label: "U2S Device Guide" },
    ],
    description: "Portable hotspot rental — Adventure/Escape/Voyage/Unlimited tiers. DAILY_DATA model (daily cap + FUP).",
  },
  sapphire: {
    label: "Sapphire",
    icon: Smartphone,
    color: "bg-fraud-yellow-soft text-fraud-yellow",
    badgeColor: "bg-fraud-yellow-soft text-fraud-yellow",
    kbModels: [{ model: "SAPPHIRE", label: "Sapphire Devices & Plans" }],
    description: "FLOW data plans for Sapphire device owners. TOTAL_DATA model. Single-country plans.",
  },
};

function fmt(price: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(price);
}

function countryDisplay(code: string): string {
  const name = getCountryName(code);
  return name !== code ? name : code;
}

function parseSearchTerms(input: string): string[] {
  return input.split(",").map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
}

function countryMatchesAny(code: string, terms: string[]): boolean {
  const name = countryDisplay(code).toLowerCase();
  const lower = code.toLowerCase();
  return terms.some(t => name.includes(t) || lower.includes(t));
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="inline-flex items-center gap-0.5 text-[10px] font-[540] text-muted-foreground hover:text-amethyst transition-colors cursor-pointer ml-1.5"
      title={`Copy: ${text}`}
    >
      {copied ? <Check className="h-3 w-3 text-success" strokeWidth={2} /> : <Copy className="h-3 w-3" strokeWidth={1.8} />}
    </button>
  );
}

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative group/tip inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[280px] rounded-[8px] bg-charcoal text-white text-[11px] font-[460] leading-[1.4] px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity z-50 shadow-lg">
        {text}
      </span>
    </span>
  );
}

// ─── Search across a single product's catalogs ───

interface ProductSearchResult {
  product: ProductTab;
  local: LocalProduct[];
  regional: { region: RegionalRegion; tier: Tier }[];
  global: Tier[];
}

function searchProductCatalog(catalog: ProductCatalog, terms: string[], isMulti: boolean): Omit<ProductSearchResult, "product"> {
  const localMatches: LocalProduct[] = [];
  const regionalMatches: { region: RegionalRegion; tier: Tier }[] = [];
  const globalMatches: Tier[] = [];

  if (catalog.local?.products) {
    for (const p of catalog.local.products) {
      if (countryMatchesAny(p.country, terms)) localMatches.push(p);
    }
  }

  if (catalog.regional?.regions) {
    for (const region of Object.values(catalog.regional.regions)) {
      for (const tier of region.tiers || []) {
        const countries = tier.countries || region.countries || [];
        if (isMulti) {
          const allMatch = terms.every(t =>
            countries.some(c => c.toLowerCase().includes(t) || countryDisplay(c).toLowerCase().includes(t))
            || region.region_name.toLowerCase().includes(t)
          );
          if (allMatch) regionalMatches.push({ region, tier });
        } else {
          const match = countries.some(c => countryMatchesAny(c, terms));
          const regionMatch = region.region_name.toLowerCase().includes(terms[0]);
          if (match || regionMatch) regionalMatches.push({ region, tier });
        }
      }
    }
  }

  if (catalog.global?.tiers) {
    for (const tier of catalog.global.tiers) {
      const countries = tier.countries || [];
      if (isMulti) {
        const allMatch = terms.every(t =>
          countries.some(c => c.toLowerCase().includes(t) || countryDisplay(c).toLowerCase().includes(t))
          || tier.tier_name.toLowerCase().includes(t)
        );
        if (allMatch) globalMatches.push(tier);
      } else {
        const match = countries.some(c => countryMatchesAny(c, terms));
        const tierMatch = tier.tier_name.toLowerCase().includes(terms[0]);
        if (match || tierMatch) globalMatches.push(tier);
      }
    }
  }

  return { local: localMatches, regional: regionalMatches, global: globalMatches };
}

function hasAnyResults(r: Omit<ProductSearchResult, "product">): boolean {
  return r.local.length > 0 || r.regional.length > 0 || r.global.length > 0;
}

function resultCount(r: Omit<ProductSearchResult, "product">): string {
  const parts: string[] = [];
  if (r.local.length > 0) parts.push(`${r.local.length} local`);
  if (r.regional.length > 0) parts.push(`${r.regional.length} regional`);
  if (r.global.length > 0) parts.push(`${r.global.length} global`);
  return parts.join(" · ");
}

// ═══════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState("");
  const [catalogs, setCatalogs] = useState<AllCatalogs>({
    esim: { local: null, regional: null, global: null },
    rental: { local: null, regional: null, global: null },
    sapphire: { local: null, regional: null, global: null },
  });
  const [loaded, setLoaded] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ProductTab>("esim");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [expandedTiers, setExpandedTiers] = useState<Set<string>>(new Set());
  const [kbModel, setKbModel] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCatalogs({
      esim: {
        local: loadCatalog("local") as ProductCatalog["local"],
        regional: loadCatalog("regional") as ProductCatalog["regional"],
        global: loadCatalog("global") as ProductCatalog["global"],
      },
      rental: {
        local: loadCatalog("rental_local") as ProductCatalog["local"],
        regional: loadCatalog("rental_regional") as ProductCatalog["regional"],
        global: null,
      },
      sapphire: {
        local: loadCatalog("sapphire_local") as ProductCatalog["local"],
        regional: loadCatalog("sapphire_regional") as ProductCatalog["regional"],
        global: null,
      },
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && search) { e.preventDefault(); setSearch(""); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [search]);

  const season = currentSeason(catalogs.esim.local?.season_schedule);
  const activeCatalog = catalogs[activeProduct];
  const hasAnyCatalogForProduct = activeCatalog.local || activeCatalog.regional || activeCatalog.global;
  const meta = PRODUCT_META[activeProduct];
  const Icon = meta.icon;

  // Cross-product search
  const isSearching = search.trim().length > 0;
  const crossProductResults = useMemo(() => {
    const terms = parseSearchTerms(search);
    if (terms.length === 0) return null;
    const isMulti = terms.length > 1;

    const results: ProductSearchResult[] = [];
    for (const product of ["esim", "rental", "sapphire"] as const) {
      const r = searchProductCatalog(catalogs[product], terms, isMulti);
      if (hasAnyResults(r)) results.push({ product, ...r });
    }
    return { results, terms, isMulti };
  }, [search, catalogs]);

  function toggleRegion(key: string) {
    setExpandedRegions(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleTier(key: string) {
    setExpandedTiers(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  return (
    <div className="space-y-4">
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-[22px] font-[540] text-charcoal">Knowledge Base</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[13px] font-[460] text-muted-foreground">Product plans, coverage, pricing, and support guides</p>
          {catalogs.esim.local?.season_schedule && (
            <>
              <span className="text-muted-foreground/30">·</span>
              <Tip text="Seasonal pricing: Peak (May–Aug) ×1.25, High (Apr/Sep/Oct) ×1.10, Shoulder (Mar/Nov) ×1.00, Low (Jan/Feb/Dec) ×0.90.">
                <Badge className={cn("rounded-[6px] text-[10px] font-[600] border-0 py-0 cursor-help", SEASON_COLORS[season])}>
                  {SEASON_LABELS[season]} ({SEASON_MONTHS[season]})
                </Badge>
              </Tip>
            </>
          )}
        </div>
      </div>

      {/* ─── Search bar (cross-product) ─── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder='Search all products by country — e.g. "Mexico" or "France, Italy, Spain"'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 pr-20 rounded-[8px] text-[14px] h-11 border-border focus:border-lavender"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {!search && <kbd className="hidden sm:inline-flex items-center rounded-[4px] border border-border bg-muted px-1.5 py-0.5 text-[10px] font-[540] text-muted-foreground/60">/</kbd>}
          {search && (
            <>
              <kbd className="hidden sm:inline-flex items-center rounded-[4px] border border-border bg-muted px-1.5 py-0.5 text-[10px] font-[540] text-muted-foreground/60">esc</kbd>
              <button onClick={() => { setSearch(""); searchRef.current?.focus(); }} className="text-muted-foreground hover:text-charcoal cursor-pointer">
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══════════ CROSS-PRODUCT SEARCH RESULTS ═══════════ */}
      {isSearching && crossProductResults && (
        <div className="space-y-3">
          {/* Verdict */}
          {crossProductResults.results.length > 0 ? (
            <div className="flex items-center gap-3 rounded-[16px] bg-success-soft/60 border border-success/20 px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/20 shrink-0">
                <Check className="h-4 w-4 text-success" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[14px] font-[600] text-success">
                  {crossProductResults.isMulti ? "Yes — all countries covered" : `Yes — we cover \u201c${search.trim()}\u201d`}
                </p>
                <p className="text-[12px] font-[460] text-success/80">
                  Found in: {crossProductResults.results.map(r => PRODUCT_META[r.product].label).join(", ")}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-[16px] bg-muted/60 border border-border px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                <X className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[14px] font-[600] text-charcoal">
                  {crossProductResults.isMulti ? "No single plan covers all these countries" : `No plans found for \u201c${search.trim()}\u201d`}
                </p>
                <p className="text-[12px] font-[460] text-muted-foreground">Check spelling, or try each country individually.</p>
              </div>
            </div>
          )}

          {/* Results grouped by product */}
          {crossProductResults.results.map(({ product, local, regional, global }) => {
            const pm = PRODUCT_META[product];
            const PIcon = pm.icon;
            const productSeason = product === "esim" ? season : "shoulder";
            const productSchedule = product === "esim" ? catalogs.esim.local?.season_schedule : null;

            return (
              <Card key={product} className="rounded-[16px]">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-[14px] font-[600] flex items-center gap-2 text-charcoal">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-[8px]", pm.color)}>
                        <PIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </div>
                      {pm.label}
                      <span className="text-[11px] font-[460] text-muted-foreground">{resultCount({ local, regional, global })}</span>
                    </CardTitle>
                    {pm.kbModels.length > 0 && (
                      <div className="flex items-center gap-1">
                        {pm.kbModels.map(kb => (
                          <button
                            key={kb.model}
                            onClick={() => setKbModel(kb.model)}
                            className="flex items-center gap-1 rounded-[8px] border border-border bg-background hover:bg-lavender/10 text-muted-foreground hover:text-amethyst px-2 py-1 cursor-pointer transition-colors text-[10px] font-[600]"
                          >
                            <BookOpen className="h-2.5 w-2.5" strokeWidth={1.8} />
                            {kb.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  {/* Local */}
                  {local.length > 0 && (
                    <div>
                      <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" strokeWidth={1.8} /> Local Plans
                      </p>
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Country</th>
                            <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Plan</th>
                            <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">
                              Price {productSchedule && <span className={cn("rounded px-1 py-0.5 ml-1 text-[9px]", SEASON_COLORS[productSeason])}>{SEASON_LABELS[productSeason]}</span>}
                            </th>
                            <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">SKU</th>
                          </tr>
                        </thead>
                        <tbody>
                          {local.sort((a, b) => a.country.localeCompare(b.country) || a.data_gb - b.data_gb).map((p) => (
                            <tr key={p.sku} className="border-b border-border/30 last:border-0">
                              <td className="py-1.5 font-[540]">{getCountryFlag(p.country)} {countryDisplay(p.country)}</td>
                              <td className="py-1.5 font-[540] text-charcoal">{p.data_gb} GB / {p.validity_days}d</td>
                              <td className="py-1.5 font-[700] text-charcoal">{fmt(p.prices?.[productSeason] ?? p.prices?.shoulder ?? 0)}</td>
                              <td className="py-1.5">
                                <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                                <CopyButton text={p.sku} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Regional */}
                  {regional.length > 0 && (
                    <div>
                      <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                        <Globe className="h-3 w-3" strokeWidth={1.8} /> Regional Plans
                      </p>
                      <div className="space-y-2">
                        {regional.map(({ region, tier }) => (
                          <TierCard
                            key={`${region.region_name}-${tier.tier_name}`}
                            label={`${region.region_name} — ${tier.tier_name}`}
                            countries={tier.countries || region.countries || []}
                            packages={tier.packages || []}
                            currency={catalogs[product].regional?.currency ?? "USD"}
                            highlightTerms={crossProductResults.terms}
                            defaultExpanded
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Global */}
                  {global.length > 0 && (
                    <div>
                      <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                        <Layers className="h-3 w-3" strokeWidth={1.8} /> Global Plans
                      </p>
                      <div className="space-y-2">
                        {global.map((tier) => (
                          <TierCard
                            key={tier.tier_name}
                            label={`Global — ${tier.tier_name}`}
                            countries={tier.countries || []}
                            packages={tier.packages || []}
                            currency={catalogs[product].global?.currency ?? "USD"}
                            highlightTerms={crossProductResults.terms}
                            defaultExpanded
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ═══════════ PRODUCT TABS (when not searching) ═══════════ */}
      {!isSearching && (
        <>
          {/* Product tab bar */}
          <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-muted p-0.5">
            {(["esim", "rental", "sapphire"] as const).map((product) => {
              const pm = PRODUCT_META[product];
              const PIcon = pm.icon;
              const hasCatalog = catalogs[product].local || catalogs[product].regional || catalogs[product].global;
              return (
                <button
                  key={product}
                  onClick={() => setActiveProduct(product)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer",
                    activeProduct === product ? "bg-white text-charcoal shadow-sm" : "text-muted-foreground hover:text-charcoal"
                  )}
                >
                  <PIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {pm.label}
                  {!hasCatalog && <span className="h-1.5 w-1.5 rounded-full bg-fraud-yellow" />}
                </button>
              );
            })}
          </div>

          {/* Product header + KB guide buttons */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-[460] text-muted-foreground">{meta.description}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {meta.kbModels.map(kb => (
                <button
                  key={kb.model}
                  onClick={() => setKbModel(kb.model)}
                  className="flex items-center gap-1.5 rounded-[8px] border border-border bg-background hover:bg-lavender/10 hover:border-lavender/40 text-muted-foreground hover:text-amethyst px-2.5 py-1.5 cursor-pointer transition-colors text-[11px] font-[600]"
                >
                  <BookOpen className="h-3 w-3" strokeWidth={1.8} />
                  {kb.label}
                </button>
              ))}
            </div>
          </div>

          {/* No catalog for this product */}
          {!hasAnyCatalogForProduct && loaded && (
            <Card className="rounded-[16px] border-fraud-yellow/30 bg-fraud-yellow-soft/30">
              <CardContent className="flex items-center gap-3 p-4">
                <AlertTriangle className="h-5 w-5 text-fraud-yellow shrink-0" strokeWidth={1.8} />
                <div>
                  <p className="text-[13px] font-[600] text-charcoal">No {meta.label} catalogs loaded</p>
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Upload {meta.label} plan catalogs in <strong>Settings → Plan Catalog → {meta.label}</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Product catalog content */}
          {hasAnyCatalogForProduct && (
            <ProductCatalogView
              product={activeProduct}
              catalog={activeCatalog}
              season={activeProduct === "esim" ? season : "shoulder"}
              expandedRegions={expandedRegions}
              expandedTiers={expandedTiers}
              onToggleRegion={toggleRegion}
              onToggleTier={toggleTier}
            />
          )}
        </>
      )}

      {/* KB Slide-over */}
      {kbModel && (
        <KbSlideOver
          open={true}
          onOpenChange={(open) => { if (!open) setKbModel(null); }}
          modelCode={kbModel}
          deviceLabel={
            kbModel === "ESIM" ? "eSIM Plans" : kbModel === "RENTAL" ? "Rental Data Plans" :
            kbModel === "SAPPHIRE" ? "Sapphire Data Plans" : kbModel === "U2S" ? "U2S Rental Device" : kbModel
          }
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// Product Catalog View — shows plans for a single product
// ═══════════════════════════════════════════════

function ProductCatalogView({ product, catalog, season, expandedRegions, expandedTiers, onToggleRegion, onToggleTier }: {
  product: ProductTab;
  catalog: ProductCatalog;
  season: Season;
  expandedRegions: Set<string>;
  expandedTiers: Set<string>;
  onToggleRegion: (key: string) => void;
  onToggleTier: (key: string) => void;
}) {
  const [subTab, setSubTab] = useState<"local" | "regional" | "global">("local");
  const hasLocal = !!catalog.local?.products?.length;
  const hasRegional = catalog.regional?.regions && Object.keys(catalog.regional.regions).length > 0;
  const hasGlobal = catalog.global?.tiers && catalog.global.tiers.length > 0;

  // Auto-select first available sub-tab
  const availableTabs = [
    hasLocal && "local",
    hasRegional && "regional",
    hasGlobal && "global",
  ].filter(Boolean) as ("local" | "regional" | "global")[];

  const activeSubTab = availableTabs.includes(subTab) ? subTab : availableTabs[0] || "local";

  return (
    <div className="space-y-3">
      {/* Sub-tabs: Local / Regional / Global */}
      {availableTabs.length > 1 && (
        <div className="flex items-center gap-1 rounded-[8px] border border-border/60 bg-muted/50 p-0.5 w-fit">
          {availableTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={cn(
                "rounded-[6px] px-3 py-1 text-[12px] font-[540] transition-colors cursor-pointer capitalize",
                activeSubTab === tab ? "bg-white text-charcoal shadow-sm" : "text-muted-foreground hover:text-charcoal"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {activeSubTab === "local" && hasLocal && (
        <LocalPlansTable
          products={catalog.local!.products}
          season={season}
          currency={catalog.local!.currency}
          hasSeasonal={!!catalog.local!.season_schedule}
        />
      )}

      {activeSubTab === "regional" && hasRegional && (
        <RegionalPlansView
          regions={catalog.regional!.regions}
          currency={catalog.regional!.currency}
          expandedRegions={expandedRegions}
          expandedTiers={expandedTiers}
          onToggleRegion={onToggleRegion}
          onToggleTier={onToggleTier}
          prefix={product}
        />
      )}

      {activeSubTab === "global" && hasGlobal && (
        <GlobalPlansView
          tiers={catalog.global!.tiers}
          currency={catalog.global!.currency}
          expandedTiers={expandedTiers}
          onToggleTier={onToggleTier}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════

function TierCard({ label, countries, packages, currency, highlightTerms, defaultExpanded = false }: {
  label: string;
  countries: string[];
  packages: { sku: string; data_gb: number; validity_days: number; price_usd: number }[];
  currency: string;
  highlightTerms?: string[];
  defaultExpanded?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...countries].sort((a, b) => countryDisplay(a).localeCompare(countryDisplay(b)));
  const visible = showAll ? sorted : sorted.slice(0, 24);
  const hidden = sorted.length - 24;

  return (
    <div className="rounded-[16px] border border-border/60 bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[13px] font-[600] text-charcoal">{label}</p>
        <Badge className="rounded-[8px] text-[10px] font-[600] border-0 bg-lavender/15 text-amethyst">{countries.length} countries</Badge>
      </div>
      <div className="flex flex-wrap gap-1">
        {visible.map((c) => {
          const isMatch = highlightTerms?.some(t => c.toLowerCase().includes(t) || countryDisplay(c).toLowerCase().includes(t));
          return (
            <span key={c} className={cn("inline-flex items-center gap-1 rounded-[8px] px-1.5 py-0.5 text-[11px] font-[460]",
              isMatch ? "bg-lavender/30 text-amethyst font-[600] ring-1 ring-amethyst/30" : "bg-muted text-muted-foreground"
            )}>
              {getCountryFlag(c)} {countryDisplay(c)}
            </span>
          );
        })}
        {!showAll && hidden > 0 && (
          <button onClick={() => setShowAll(true)} className="inline-flex items-center rounded-[8px] px-2 py-0.5 text-[11px] font-[600] text-amethyst bg-lavender/10 hover:bg-lavender/20 cursor-pointer transition-colors">
            +{hidden} more
          </button>
        )}
      </div>
      {packages.length > 0 && (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-border/50 text-left">
              <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Plan</th>
              <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Price</th>
              <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">SKU</th>
            </tr>
          </thead>
          <tbody>
            {[...packages].sort((a, b) => a.data_gb - b.data_gb).map((pkg) => (
              <tr key={pkg.sku} className="border-b border-border/30 last:border-0">
                <td className="py-1.5 font-[540] text-charcoal">{pkg.data_gb} GB / {pkg.validity_days}d</td>
                <td className="py-1.5 font-[700] text-charcoal">{fmt(pkg.price_usd, currency)}</td>
                <td className="py-1.5"><span className="font-mono text-[11px] text-muted-foreground">{pkg.sku}</span><CopyButton text={pkg.sku} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function LocalPlansTable({ products, season, currency, hasSeasonal }: {
  products: LocalProduct[];
  season: Season;
  currency: string;
  hasSeasonal: boolean;
}) {
  const [filter, setFilter] = useState("");
  const grouped = useMemo(() => {
    const map: Record<string, LocalProduct[]> = {};
    for (const p of products) { if (!map[p.country]) map[p.country] = []; map[p.country].push(p); }
    return Object.entries(map).sort(([a], [b]) => countryDisplay(a).localeCompare(countryDisplay(b)));
  }, [products]);

  const filtered = filter
    ? grouped.filter(([code]) => code.toLowerCase().includes(filter.toLowerCase()) || countryDisplay(code).toLowerCase().includes(filter.toLowerCase()))
    : grouped;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Filter countries..." value={filter} onChange={(e) => setFilter(e.target.value)} className="pl-8 rounded-[8px] h-9 text-[13px]" />
        </div>
        <span className="text-[11px] font-[460] text-muted-foreground">{filtered.length} countries · {products.length} plans</span>
      </div>
      <div className="overflow-x-auto rounded-[16px] border border-border">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/50">
            <tr className="border-b border-border text-left">
              <th className="px-4 py-2 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Country</th>
              <th className="px-3 py-2 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Plan</th>
              <th className="px-3 py-2 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">
                Price {hasSeasonal && <span className={cn("rounded px-1 py-0.5 ml-1 text-[9px]", SEASON_COLORS[season])}>{SEASON_LABELS[season]}</span>}
              </th>
              <th className="px-3 py-2 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">SKU</th>
              {hasSeasonal && <th className="px-3 py-2 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">All Seasons</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(([code, plans]) =>
              plans.sort((a, b) => a.data_gb - b.data_gb).map((p, i) => (
                <tr key={p.sku} className={cn("border-b border-border/40 last:border-0", i === 0 && plans.length > 1 && "border-t border-border/60")}>
                  {i === 0 && <td className="px-4 py-2 font-[540]" rowSpan={plans.length}>{getCountryFlag(code)} {countryDisplay(code)}</td>}
                  <td className="px-3 py-2 font-[540] text-charcoal">{p.data_gb} GB / {p.validity_days}d</td>
                  <td className="px-3 py-2 font-[700] text-charcoal">{fmt(p.prices?.[season] ?? p.prices?.shoulder ?? 0, currency)}</td>
                  <td className="px-3 py-2"><span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span><CopyButton text={p.sku} /></td>
                  {hasSeasonal && (
                    <td className="px-3 py-2 text-[11px] text-muted-foreground/50 font-[460]">
                      Peak {fmt(p.prices.peak, currency)} · High {fmt(p.prices.high, currency)} · Shldr {fmt(p.prices.shoulder, currency)} · Low {fmt(p.prices.low, currency)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RegionalPlansView({ regions, currency, expandedRegions, expandedTiers, onToggleRegion, onToggleTier, prefix }: {
  regions: Record<string, RegionalRegion>;
  currency: string;
  expandedRegions: Set<string>;
  expandedTiers: Set<string>;
  onToggleRegion: (key: string) => void;
  onToggleTier: (key: string) => void;
  prefix: string;
}) {
  const entries = Object.entries(regions).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      {entries.map(([key, region]) => {
        const rKey = `${prefix}-${key}`;
        const isExpanded = expandedRegions.has(rKey);
        return (
          <Card key={rKey} className="rounded-[16px]">
            <button onClick={() => onToggleRegion(rKey)} className="flex w-full items-center justify-between px-5 py-3.5 text-left cursor-pointer">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                <div>
                  <p className="text-[14px] font-[600] text-charcoal">{region.region_name}</p>
                  <p className="text-[11px] font-[460] text-muted-foreground">{region.country_count || region.countries?.length || 0} countries · {region.tiers?.length || 0} tiers</p>
                </div>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {isExpanded && (
              <CardContent className="pt-0 space-y-3 px-5 pb-4">
                {(region.tiers || []).map((tier) => {
                  const tKey = `${rKey}-${tier.tier_name}`;
                  const isOpen = expandedTiers.has(tKey);
                  const countries = tier.countries || region.countries || [];
                  return (
                    <div key={tKey} className="rounded-[16px] border border-border/60 bg-muted/20">
                      <button onClick={() => onToggleTier(tKey)} className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-[600] text-charcoal">{tier.tier_name}</p>
                          <Badge className="rounded-[8px] text-[10px] font-[600] border-0 bg-lavender/15 text-amethyst">{countries.length} countries</Badge>
                          <span className="text-[11px] font-[460] text-muted-foreground">{tier.packages?.length || 0} packages</span>
                        </div>
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-3 space-y-3">
                          <div>
                            <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Countries covered</p>
                            <div className="flex flex-wrap gap-1">
                              {[...countries].sort((a, b) => countryDisplay(a).localeCompare(countryDisplay(b))).map((c) => (
                                <span key={c} className="inline-flex items-center gap-1 rounded-[8px] bg-muted px-1.5 py-0.5 text-[11px] font-[460] text-muted-foreground">
                                  {getCountryFlag(c)} {countryDisplay(c)}
                                </span>
                              ))}
                            </div>
                          </div>
                          {tier.packages && tier.packages.length > 0 && (
                            <table className="w-full text-[12px]">
                              <thead><tr className="border-b border-border/50 text-left">
                                <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Plan</th>
                                <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Price</th>
                                <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">SKU</th>
                              </tr></thead>
                              <tbody>
                                {[...tier.packages].sort((a, b) => a.data_gb - b.data_gb).map((pkg) => (
                                  <tr key={pkg.sku} className="border-b border-border/30 last:border-0">
                                    <td className="py-1.5 font-[540]">{pkg.data_gb} GB / {pkg.validity_days}d</td>
                                    <td className="py-1.5 font-[700] text-charcoal">{fmt(pkg.price_usd, currency)}</td>
                                    <td className="py-1.5"><span className="font-mono text-[11px] text-muted-foreground">{pkg.sku}</span><CopyButton text={pkg.sku} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function GlobalPlansView({ tiers, currency, expandedTiers, onToggleTier }: {
  tiers: Tier[];
  currency: string;
  expandedTiers: Set<string>;
  onToggleTier: (key: string) => void;
}) {
  return (
    <div className="space-y-3">
      {tiers.map((tier) => {
        const tKey = `global-${tier.tier_name}`;
        const isExpanded = expandedTiers.has(tKey);
        const countries = tier.countries || [];
        return (
          <Card key={tKey} className="rounded-[16px]">
            <button onClick={() => onToggleTier(tKey)} className="flex w-full items-center justify-between px-5 py-3.5 text-left cursor-pointer">
              <div className="flex items-center gap-3">
                <Layers className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
                <div>
                  <p className="text-[14px] font-[600] text-charcoal">Global — {tier.tier_name}</p>
                  <p className="text-[11px] font-[460] text-muted-foreground">{countries.length} countries · {tier.packages?.length || 0} packages</p>
                </div>
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {isExpanded && (
              <CardContent className="pt-0 space-y-3 px-5 pb-4">
                <div>
                  <p className="text-[10px] font-[600] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Countries covered ({countries.length})</p>
                  <div className="flex flex-wrap gap-1">
                    {[...countries].sort((a, b) => countryDisplay(a).localeCompare(countryDisplay(b))).map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-[8px] bg-muted px-1.5 py-0.5 text-[11px] font-[460] text-muted-foreground">
                        {getCountryFlag(c)} {countryDisplay(c)}
                      </span>
                    ))}
                  </div>
                </div>
                {tier.packages && tier.packages.length > 0 && (
                  <table className="w-full text-[12px]">
                    <thead><tr className="border-b border-border/50 text-left">
                      <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Plan</th>
                      <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">Price</th>
                      <th className="pb-1.5 font-[600] text-muted-foreground/70 text-[10px] uppercase tracking-wider">SKU</th>
                    </tr></thead>
                    <tbody>
                      {[...tier.packages].sort((a, b) => a.data_gb - b.data_gb).map((pkg) => (
                        <tr key={pkg.sku} className="border-b border-border/30 last:border-0">
                          <td className="py-1.5 font-[540]">{pkg.data_gb} GB / {pkg.validity_days}d</td>
                          <td className="py-1.5 font-[700] text-charcoal">{fmt(pkg.price_usd, currency)}</td>
                          <td className="py-1.5"><span className="font-mono text-[11px] text-muted-foreground">{pkg.sku}</span><CopyButton text={pkg.sku} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
