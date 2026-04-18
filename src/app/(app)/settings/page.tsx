"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Eye,
  EyeOff,
  Save,
  Shield,
  Wifi,
  WifiOff,
  Loader2,
  Radio,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Globe,
  Database,
  Upload,
  Building2,
  Plug,
  SlidersHorizontal,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Plus,
  Smartphone,
  BarChart3,
} from "lucide-react";
import { UclOrgsSection } from "@/components/settings/ucl-orgs-section";
import {
  getSapphireMappings,
  saveSapphireMappings,
  type SapphireMapping,
} from "@/lib/sapphire-mapping";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  getCatalogSummaries,
  getProductCatalogSummaries,
  validateCatalog,
  saveCatalog,
} from "@/lib/plan-catalog";
import type { CatalogSummary } from "@/lib/plan-catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "travelwifi_ops_settings";

interface ConnectionStatus {
  status: "idle" | "testing" | "connected" | "error";
  message?: string;
  timestamp?: string;
}

interface AppSettings {
  opensearch: { url: string; username: string; password: string };
  tellisim: { baseUrl: string; apiKey: string; orgId: string };
  fraudWatch: { scanInterval: string; enabled: boolean };
}

const defaultSettings: AppSettings = {
  opensearch: { url: "", username: "", password: "" },
  tellisim: { baseUrl: "https://api.tellisim.com", apiKey: "", orgId: "" },
  fraudWatch: { scanInterval: "5", enabled: true },
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // ignore parse errors
  }
  return defaultSettings;
}

function saveSettingsToStorage(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/* ─── Navigation config ───────────────────────────────────────── */

type SectionKey =
  | "opensearch"
  | "vendor-integrations"
  | "ucl-integration"
  | "plan-catalog"
  | "system-mapping"
  | "sapphire-mapping"
  | "fraud-watch"
  | "dashboard"
  | "coming-soon";

type PlanCategory = "esim" | "rental" | "sapphire";
type UclTab = "credentials" | "orgs";
type VendorId = "tellisim";

const VENDORS: Array<{ id: VendorId; name: string; description: string }> = [
  { id: "tellisim", name: "TelliSIM", description: "eSIM subscription management, plan attachments, and CDR enrichment" },
];

type NavItem = {
  key: SectionKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

type NavGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Integrations",
    icon: Plug,
    items: [
      { key: "opensearch", label: "OpenSearch", description: "Cluster connection", icon: Search },
      { key: "vendor-integrations", label: "Vendor Integrations", description: "TelliSIM and future vendors", icon: Plug },
      { key: "ucl-integration", label: "UCL Integration", description: "Credentials and organizations", icon: Building2 },
    ],
  },
  {
    label: "Data",
    icon: Database,
    items: [
      { key: "plan-catalog", label: "Plan Catalog", description: "CRM pricing data", icon: Database },
      { key: "system-mapping", label: "System Mapping", description: "Code → brand names", icon: Globe },
      { key: "sapphire-mapping", label: "Sapphire Devices", description: "Terminal/TAC → device names", icon: Smartphone },
    ],
  },
  {
    label: "Automation",
    icon: SlidersHorizontal,
    items: [
      { key: "fraud-watch", label: "Fraud Watch", description: "Scan interval & behavior", icon: AlertTriangle },
      { key: "dashboard", label: "Dashboard", description: "Alert thresholds & refresh", icon: BarChart3 },
    ],
  },
  {
    label: "Upcoming",
    icon: Sparkles,
    items: [
      { key: "coming-soon", label: "Coming Soon", description: "Zendesk, Stripe, Mailgun", icon: Sparkles },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
const DEFAULT_SECTION: SectionKey = "opensearch";

function isSectionKey(value: string): value is SectionKey {
  return ALL_ITEMS.some((i) => i.key === value);
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});
  const [osStatus, setOsStatus] = useState<ConnectionStatus>({ status: "idle" });
  const [tsStatus, setTsStatus] = useState<ConnectionStatus>({ status: "idle" });
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState<SectionKey>(DEFAULT_SECTION);
  const [planCategory, setPlanCategory] = useState<PlanCategory>("esim");
  const [uclTab, setUclTab] = useState<UclTab>("credentials");
  const [activeVendor, setActiveVendor] = useState<VendorId | null>(null);
  const [showAddVendor, setShowAddVendor] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    // Sync localStorage credentials to DB (one-time migration + ongoing sync)
    if (s.opensearch?.url && s.opensearch.username) {
      fetch("/api/settings/opensearch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s.opensearch),
      }).catch(() => {});
    }
    if (s.tellisim?.apiKey) {
      fetch("/api/settings/tellisim", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s.tellisim),
      }).catch(() => {});
    }
    const hash = window.location.hash.replace("#", "");
    if (hash && isSectionKey(hash)) setActive(hash);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (window.location.hash.replace("#", "") !== active) {
      window.history.replaceState(null, "", `#${active}`);
    }
  }, [active, mounted]);

  const activeItem = useMemo(
    () => ALL_ITEMS.find((i) => i.key === active) ?? ALL_ITEMS[0],
    [active],
  );

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const showSaved = useCallback((section: string) => {
    setSavedFeedback((prev) => ({ ...prev, [section]: true }));
    setTimeout(
      () => setSavedFeedback((prev) => ({ ...prev, [section]: false })),
      2000,
    );
  }, []);

  const handleSaveOS = async () => {
    saveSettingsToStorage(settings);
    showSaved("opensearch");
    try {
      await fetch("/api/settings/opensearch", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.opensearch),
      });
    } catch { /* localStorage is the fallback */ }
  };
  const handleSaveTS = async () => {
    saveSettingsToStorage(settings);
    showSaved("tellisim");
    try {
      await fetch("/api/settings/tellisim", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.tellisim),
      });
    } catch { /* localStorage is the fallback */ }
  };
  const handleSaveFraud = () => { saveSettingsToStorage(settings); showSaved("fraud"); };

  const testOpenSearch = async () => {
    if (!settings.opensearch.url) {
      setOsStatus({ status: "error", message: "URL is required" });
      return;
    }
    setOsStatus({ status: "testing" });
    try {
      const res = await fetch("/api/settings/test-opensearch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.opensearch),
      });
      const data = await res.json();
      if (data.ok) {
        setOsStatus({
          status: "connected",
          message: data.message || "Connected successfully",
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setOsStatus({ status: "error", message: data.error || "Connection failed" });
      }
    } catch {
      setOsStatus({
        status: "error",
        message: "Could not reach the test endpoint. Start the API server first.",
      });
    }
  };

  const testTelliSIM = async () => {
    if (!settings.tellisim.apiKey) {
      setTsStatus({ status: "error", message: "API key is required" });
      return;
    }
    setTsStatus({ status: "testing" });
    try {
      const res = await fetch("/api/settings/test-tellisim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings.tellisim),
      });
      const data = await res.json();
      if (data.ok) {
        setTsStatus({
          status: "connected",
          message: data.message || "Connected successfully",
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setTsStatus({ status: "error", message: data.error || "Connection failed" });
      }
    } catch {
      setTsStatus({
        status: "error",
        message: "Could not reach the test endpoint. Start the API server first.",
      });
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-[540] text-foreground">Settings</h1>
          <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
            Configure service connections and system behavior
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-[8px] bg-lavender/20 px-3 py-1.5">
          <Shield className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
          <span className="text-[12px] font-[600] text-amethyst">Admin Access</span>
        </div>
      </div>

      {/* Two-column layout: sidebar + content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar nav */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <nav aria-label="Settings sections" className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-2 pb-1.5 text-[11px] font-[700] uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          onClick={() => { setActive(item.key); setActiveVendor(null); }}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13px] transition-colors cursor-pointer ${
                            isActive
                              ? "bg-lavender/25 text-amethyst font-[600]"
                              : "text-foreground/80 font-[460] hover:bg-muted/60 hover:text-foreground"
                          }`}
                        >
                          <Icon
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-amethyst" : "text-muted-foreground"}`}
                            strokeWidth={1.8}
                          />
                          <span className="truncate">{item.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <section aria-label={activeItem.label} className="min-w-0">
          {active === "opensearch" && (
            <OpenSearchCard
              settings={settings}
              setSettings={setSettings}
              osStatus={osStatus}
              savedFeedback={savedFeedback.opensearch}
              revealed={revealedFields.has("os_pass")}
              onToggleReveal={() => toggleReveal("os_pass")}
              onSave={handleSaveOS}
              onTest={testOpenSearch}
            />
          )}

          {active === "vendor-integrations" && activeVendor === null && (
            <VendorListView
              onSelect={(id) => setActiveVendor(id)}
              onAdd={() => setShowAddVendor(true)}
              tsStatus={tsStatus}
            />
          )}

          {active === "vendor-integrations" && activeVendor === "tellisim" && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveVendor(null)}
                className="inline-flex items-center gap-1.5 text-[12px] font-[600] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                Back to vendors
              </button>
              <TelliSimCard
                settings={settings}
                setSettings={setSettings}
                tsStatus={tsStatus}
                savedFeedback={savedFeedback.tellisim}
                revealed={revealedFields.has("ts_key")}
                onToggleReveal={() => toggleReveal("ts_key")}
                onSave={handleSaveTS}
                onTest={testTelliSIM}
              />
            </div>
          )}

          {showAddVendor && <ComingSoonModal onClose={() => setShowAddVendor(false)} />}

          {active === "ucl-integration" && (
            <div className="space-y-4">
              <SubTabs
                value={uclTab}
                onChange={(v) => setUclTab(v as UclTab)}
                options={[
                  { value: "credentials", label: "API Credentials" },
                  { value: "orgs", label: "Organizations" },
                ]}
                ariaLabel="UCL integration views"
              />
              <UclOrgsSection view={uclTab} />
            </div>
          )}

          {active === "plan-catalog" && (
            <div className="space-y-4">
              <SubTabs
                value={planCategory}
                onChange={(v) => setPlanCategory(v as PlanCategory)}
                options={[
                  { value: "esim", label: "eSIM" },
                  { value: "rental", label: "Rental" },
                  { value: "sapphire", label: "Sapphire" },
                ]}
                ariaLabel="Plan catalog product category"
              />
              <PlanCatalogSection category={planCategory} />
            </div>
          )}

          {active === "system-mapping" && <SystemMappingSection />}

          {active === "sapphire-mapping" && <SapphireMappingSection />}

          {active === "fraud-watch" && (
            <FraudWatchCard
              settings={settings}
              setSettings={setSettings}
              savedFeedback={savedFeedback.fraud}
              onSave={handleSaveFraud}
            />
          )}

          {active === "dashboard" && <DashboardSettingsSection />}

          {active === "coming-soon" && <ComingSoonCard />}
        </section>
      </div>
    </div>
  );
}

/* ─── Section Cards ───────────────────────────────────────────── */

type OpenSearchProps = {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  osStatus: ConnectionStatus;
  savedFeedback: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onSave: () => void;
  onTest: () => void;
};

function OpenSearchCard({
  settings, setSettings, osStatus, savedFeedback, revealed, onToggleReveal, onSave, onTest,
}: OpenSearchProps) {
  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
              <Search className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">OpenSearch</CardTitle>
              <CardDescription className="text-[12px]">
                Connection to the OpenSearch cluster for orders, CDR, and customer data
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge status={osStatus} />
            <SaveButton saved={savedFeedback} onClick={onSave} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Field label="Endpoint URL" help="Include the port if not standard (e.g., :9200)">
          <Input
            value={settings.opensearch.url}
            onChange={(e) => setSettings((s) => ({ ...s, opensearch: { ...s.opensearch, url: e.target.value } }))}
            placeholder="https://search-domain.us-east-1.es.amazonaws.com"
            className="mt-1.5 rounded-[8px] font-mono text-[13px]"
          />
        </Field>

        <Separator />

        <Field label="Username">
          <Input
            value={settings.opensearch.username}
            onChange={(e) => setSettings((s) => ({ ...s, opensearch: { ...s.opensearch, username: e.target.value } }))}
            placeholder="admin"
            className="mt-1.5 rounded-[8px] font-mono text-[13px]"
          />
        </Field>

        <Separator />

        <Field label="Password" help="Stored in your browser's local storage only">
          <div className="relative mt-1.5">
            <Input
              type={revealed ? "text" : "password"}
              value={settings.opensearch.password}
              onChange={(e) => setSettings((s) => ({ ...s, opensearch: { ...s.opensearch, password: e.target.value } }))}
              placeholder="Enter password"
              className="rounded-[8px] pr-10 font-mono text-[13px]"
            />
            <button
              type="button"
              onClick={onToggleReveal}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {revealed ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
            </button>
          </div>
        </Field>

        <Separator />

        <TestConnectionRow
          title="Test Connection"
          subtitle="Verify the ops tool can reach OpenSearch"
          status={osStatus}
          onTest={onTest}
        />
        {osStatus.status !== "idle" && osStatus.status !== "testing" && <StatusMessage status={osStatus} />}
      </CardContent>
    </Card>
  );
}

type TelliSimProps = {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  tsStatus: ConnectionStatus;
  savedFeedback: boolean;
  revealed: boolean;
  onToggleReveal: () => void;
  onSave: () => void;
  onTest: () => void;
};

function TelliSimCard({
  settings, setSettings, tsStatus, savedFeedback, revealed, onToggleReveal, onSave, onTest,
}: TelliSimProps) {
  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
              <Radio className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">TelliSIM API</CardTitle>
              <CardDescription className="text-[12px]">
                eSIM subscription management, plan attachments, and CDR enrichment
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ConnectionBadge status={tsStatus} />
            <SaveButton saved={savedFeedback} onClick={onSave} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <Field label="Base URL">
          <Input
            value={settings.tellisim.baseUrl}
            onChange={(e) => setSettings((s) => ({ ...s, tellisim: { ...s.tellisim, baseUrl: e.target.value } }))}
            placeholder="https://api.tellisim.com"
            className="mt-1.5 rounded-[8px] font-mono text-[13px]"
          />
        </Field>

        <Separator />

        <Field label="API Key" help="Auth via query string (?key=). Stored in your browser's local storage only">
          <div className="relative mt-1.5">
            <Input
              type={revealed ? "text" : "password"}
              value={settings.tellisim.apiKey}
              onChange={(e) => setSettings((s) => ({ ...s, tellisim: { ...s.tellisim, apiKey: e.target.value } }))}
              placeholder="Enter API key"
              className="rounded-[8px] pr-10 font-mono text-[13px]"
            />
            <button
              type="button"
              onClick={onToggleReveal}
              aria-label={revealed ? "Hide API key" : "Show API key"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {revealed ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
            </button>
          </div>
        </Field>

        <Separator />

        <Field
          label="Organization ID"
          help="Present in config but not currently sent in API calls. Reserved for future use."
        >
          <Input
            value={settings.tellisim.orgId}
            onChange={(e) => setSettings((s) => ({ ...s, tellisim: { ...s.tellisim, orgId: e.target.value } }))}
            placeholder="e.g. Lw3p6r8EbCQXOROQ2ly458f3bGt1"
            className="mt-1.5 rounded-[8px] font-mono text-[13px]"
          />
        </Field>

        <Separator />

        <TestConnectionRow
          title="Test Connection"
          subtitle="Verify the API key is valid"
          status={tsStatus}
          onTest={onTest}
        />
        {tsStatus.status !== "idle" && tsStatus.status !== "testing" && <StatusMessage status={tsStatus} />}
      </CardContent>
    </Card>
  );
}

type FraudWatchProps = {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  savedFeedback: boolean;
  onSave: () => void;
};

function FraudWatchCard({ settings, setSettings, savedFeedback, onSave }: FraudWatchProps) {
  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-fraud-red/10">
              <AlertTriangle className="h-4 w-4 text-fraud-red" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">Fraud Watch</CardTitle>
              <CardDescription className="text-[12px]">
                Configure how often the system scans OpenSearch for fraud matches
              </CardDescription>
            </div>
          </div>
          <SaveButton saved={savedFeedback} onClick={onSave} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div>
          <Label className="text-[13px] font-[600] text-foreground">Scan Interval</Label>
          <p className="text-[11px] font-[460] text-muted-foreground mb-2">
            How often the system checks OpenSearch for orders matching flagged fraud identifiers
          </p>
          <Select
            value={settings.fraudWatch.scanInterval}
            onValueChange={(val) =>
              setSettings((s) => ({
                ...s,
                fraudWatch: { ...s.fraudWatch, scanInterval: val ?? s.fraudWatch.scanInterval },
              }))
            }
          >
            <SelectTrigger className="w-48 rounded-[8px] text-[13px] font-[460]">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mr-1" strokeWidth={1.8} />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[8px]">
              <SelectItem value="1">Every 1 minute</SelectItem>
              <SelectItem value="3">Every 3 minutes</SelectItem>
              <SelectItem value="5">Every 5 minutes</SelectItem>
              <SelectItem value="10">Every 10 minutes</SelectItem>
              <SelectItem value="15">Every 15 minutes</SelectItem>
              <SelectItem value="30">Every 30 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-[600] text-foreground">Active Scanning</p>
            <p className="text-[11px] font-[460] text-muted-foreground">
              When enabled, the cron job will run at the configured interval
            </p>
          </div>
          <button
            onClick={() =>
              setSettings((s) => ({
                ...s,
                fraudWatch: { ...s.fraudWatch, enabled: !s.fraudWatch.enabled },
              }))
            }
            aria-pressed={settings.fraudWatch.enabled}
            aria-label="Toggle active scanning"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer ${
              settings.fraudWatch.enabled ? "bg-success" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                settings.fraudWatch.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="rounded-[8px] bg-muted/50 border border-border px-4 py-3">
          <p className="text-[12px] font-[460] text-muted-foreground leading-relaxed">
            When an agent flags an order as fraud, the system records the customer&apos;s name,
            email, credit card (last 4), and phone number. The cron job then scans OpenSearch for
            all orders matching any of these identifiers and populates the Fraud Watch view.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ComingSoonCard() {
  return (
    <Card className="rounded-[16px] border-dashed">
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-muted">
            <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-[15px] font-[600] text-foreground">Coming Soon</CardTitle>
            <CardDescription className="text-[12px]">
              Future integrations currently in planning
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        <ul className="space-y-2">
          {["Zendesk — ticket sync for customer support", "Stripe — payment and refund operations", "Mailgun — transactional email"].map((line) => (
            <li key={line} className="flex items-start gap-2 text-[13px] font-[460] text-muted-foreground">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-parchment-border" />
              {line}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ─── Dashboard Settings ──────────────────────────────────────── */

function DashboardSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [threshold, setThreshold] = useState("10");
  const [windowHours, setWindowHours] = useState("48");

  useEffect(() => {
    fetch("/api/dashboard/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.config) {
          setThreshold(String(data.config.connectivityThreshold));
          setWindowHours(String(data.config.connectivityWindowHours));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    const email = localStorage.getItem("travelwifi_ops_user_email") || "";
    try {
      const res = await fetch("/api/dashboard/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectivityThreshold: parseInt(threshold, 10),
          connectivityWindowHours: parseInt(windowHours, 10),
          updatedBy: email,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8">
        <Loader2 className="h-4 w-4 animate-spin text-amethyst" />
        <span className="text-[13px] font-[460] text-muted-foreground">Loading dashboard config...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[15px] font-[600] text-foreground">Dashboard Settings</h3>
        <p className="text-[13px] font-[460] text-muted-foreground mt-1">
          Configure alert thresholds for the operations dashboard.
        </p>
      </div>

      <Card className="rounded-[16px]">
        <CardContent className="pt-6 space-y-5">
          <div>
            <Label className="text-[12px] font-[600]">Connectivity Alert Threshold</Label>
            <p className="text-[11px] font-[460] text-muted-foreground mb-2">
              Number of connectivity reports for a country to trigger a dashboard alert.
            </p>
            <Input
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="rounded-[8px] text-[13px] font-[460] w-32"
            />
          </div>

          <div>
            <Label className="text-[12px] font-[600]">Alert Time Window (hours)</Label>
            <p className="text-[11px] font-[460] text-muted-foreground mb-2">
              How far back to look when counting connectivity reports.
            </p>
            <Input
              type="number"
              min="1"
              value={windowHours}
              onChange={(e) => setWindowHours(e.target.value)}
              className="rounded-[8px] text-[13px] font-[460] w-32"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" strokeWidth={2} />}
              Save
            </Button>
            {saved && (
              <span className="text-[12px] font-[600] text-success">Saved</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Plan Catalog & System Mapping (unchanged behavior) ──────── */

function PlanCatalogSection({ category = "esim" }: { category?: PlanCategory }) {
  const [summaries, setSummaries] = useState<CatalogSummary[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    Record<string, { type: "success" | "error"; message: string } | null>
  >({});

  useEffect(() => {
    if (category === "esim") {
      setSummaries(getCatalogSummaries());
    } else {
      setSummaries(getProductCatalogSummaries(category));
    }
  }, [category]);

  const handleUpload = (planType: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const result = validateCatalog(raw);

        if (!result.valid) {
          setUploadStatus((prev) => ({
            ...prev,
            [planType]: { type: "error", message: result.errors.join("; ") },
          }));
          return;
        }

        saveCatalog(planType, raw);
        setSummaries(category === "esim" ? getCatalogSummaries() : getProductCatalogSummaries(category));
        setUploadStatus((prev) => ({
          ...prev,
          [planType]: {
            type: "success",
            message: `v${result.version} loaded — ${result.stats.products} products, ${result.stats.countries} countries`,
          },
        }));
        setTimeout(() => {
          setUploadStatus((prev) => ({ ...prev, [planType]: null }));
        }, 4000);
      } catch {
        setUploadStatus((prev) => ({
          ...prev,
          [planType]: { type: "error", message: "Failed to parse JSON file" },
        }));
      }
    };
    reader.readAsText(file);
  };

  const CATEGORY_META: Record<PlanCategory, { title: string; description: string }> = {
    esim: {
      title: "eSIM Catalog",
      description: "CRM pricing for eSIM local, regional, and global plans",
    },
    rental: {
      title: "Rental Catalog",
      description: "CRM pricing for device rental plans",
    },
    sapphire: {
      title: "Sapphire Catalog",
      description: "CRM pricing for Sapphire product line",
    },
  };
  const meta = CATEGORY_META[category];

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
            <Database className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-[15px] font-[600] text-foreground">{meta.title}</CardTitle>
            <CardDescription className="text-[12px]">{meta.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {summaries.map((s) => (
          <div key={s.planType} className="rounded-[8px] border border-border px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-[600] text-foreground capitalize">{s.planType}</span>
                <span className="text-[11px] font-mono font-[460] text-muted-foreground">{s.planId}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`rounded-[8px] border-0 text-[11px] font-[500] ${
                    s.loaded ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.loaded ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" strokeWidth={2} />
                      Loaded
                    </>
                  ) : (
                    "Not loaded"
                  )}
                </Badge>
                <label className="inline-flex items-center gap-1 rounded-[8px] bg-cream text-charcoal text-[12px] font-[600] hover:bg-cream-hover cursor-pointer h-7 px-2.5">
                  <Upload className="h-3 w-3" strokeWidth={2} />
                  Upload
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(s.planType, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {s.loaded && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-[460] text-muted-foreground">
                <span><span className="font-[600] text-foreground">v{s.version}</span></span>
                <span>Exported {s.exportedAt}</span>
                <span>{s.vendorName} &middot; Sheet {s.sheetVersion}</span>
                <span>{s.totalProducts} products &middot; {s.totalCountries} countries</span>
              </div>
            )}

            {uploadStatus[s.planType] && (
              <div
                className={`flex items-start gap-2 rounded-[8px] px-3 py-2 text-[12px] font-[460] ${
                  uploadStatus[s.planType]!.type === "success"
                    ? "bg-success-soft border border-success/20 text-success"
                    : "bg-fraud-red-soft border border-fraud-red/20 text-fraud-red"
                }`}
              >
                {uploadStatus[s.planType]!.type === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                )}
                <span>{uploadStatus[s.planType]!.message}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SystemMappingSection() {
  const [mappings, setMappings] = useState<Array<{ code: string; name: string }>>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("travelwifi_ops_system_mapping");
      if (stored) {
        setMappings(JSON.parse(stored));
      } else {
        const defaults = [
          { code: "TWUS", name: "TravelWifi US" },
          { code: "TWEU", name: "TravelWifi EU" },
          { code: "TWCL", name: "TravelWifi Chile" },
          { code: "NVCL", name: "Navimo Chile" },
          { code: "NVMX", name: "Navimo Mexico" },
          { code: "NVAR", name: "Navimo Argentina" },
          { code: "CMRP", name: "CMR Puntos" },
        ];
        setMappings(defaults);
      }
    } catch { /* ignore */ }
  }, []);

  function handleSave() {
    localStorage.setItem("travelwifi_ops_system_mapping", JSON.stringify(mappings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addMapping() {
    if (!newCode.trim() || !newName.trim()) return;
    setMappings((prev) => [...prev, { code: newCode.trim().toUpperCase(), name: newName.trim() }]);
    setNewCode("");
    setNewName("");
  }

  function removeMapping(code: string) {
    setMappings((prev) => prev.filter((m) => m.code !== code));
  }

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
              <Globe className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">System Mapping</CardTitle>
              <CardDescription className="text-[12px]">
                Map system codes to brand names shown to support agents
              </CardDescription>
            </div>
          </div>
          <SaveButton saved={saved} onClick={handleSave} />
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-3">
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.code} className="flex items-center gap-3 rounded-[8px] border border-border px-3 py-2">
              <span className="text-[13px] font-mono font-[600] text-foreground w-16">{m.code}</span>
              <span className="text-[13px] font-[460] text-muted-foreground">→</span>
              <span className="text-[13px] font-[460] text-foreground flex-1">{m.name}</span>
              <button
                onClick={() => removeMapping(m.code)}
                className="text-[11px] font-[500] text-muted-foreground hover:text-fraud-red cursor-pointer transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <Input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (e.g. TWUS)"
            className="w-32 rounded-[8px] font-mono text-[13px]"
          />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Brand name (e.g. TravelWifi US)"
            className="flex-1 rounded-[8px] text-[13px]"
          />
          <Button
            onClick={addMapping}
            disabled={!newCode.trim() || !newName.trim()}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer"
          >
            Add
          </Button>
        </div>

        <p className="text-[11px] font-[460] text-muted-foreground">
          These mappings replace raw system codes (TWUS, NVCL, etc.) with human-readable brand names in the customer view.
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Sapphire device mapping ─────────────────────────────────── */

function SapphireMappingList({
  title, codeWidth, mappings, editingCode, onEdit, onRemove,
}: {
  title: string;
  codeWidth: string;
  mappings: SapphireMapping[];
  editingCode: string | null;
  onEdit: (m: SapphireMapping) => void;
  onRemove: (code: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-2">
        {mappings.map((m) => {
          const isEditing = editingCode === `${m.kind}:${m.code}`;
          return (
            <div
              key={`${m.kind}-${m.code}`}
              className={cn(
                "flex items-center gap-3 rounded-[8px] border px-3 py-2 transition-colors",
                isEditing ? "border-lavender bg-lavender/5" : "border-border"
              )}
            >
              <div className="h-10 w-10 shrink-0 rounded-[8px] border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                {m.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.imageUrl} alt={m.name} className="h-full w-full object-contain" />
                ) : (
                  <Smartphone className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.4} />
                )}
              </div>
              <span className={cn("text-[13px] font-mono font-[600] text-foreground", codeWidth)}>{m.code}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-[460] text-foreground truncate">{m.name}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] font-[460] text-muted-foreground/80">
                  {m.setupGuideUrl && <span className="text-amethyst">Setup ✓</span>}
                  {m.troubleshootingUrl && <span className="text-amethyst">Troubleshoot ✓</span>}
                  {m.notes && <span className="truncate">· {m.notes}</span>}
                </div>
              </div>
              <button
                onClick={() => onEdit(m)}
                className="text-[11px] font-[500] text-amethyst hover:text-amethyst/80 cursor-pointer transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(m.code)}
                className="text-[11px] font-[500] text-muted-foreground hover:text-fraud-red cursor-pointer transition-colors"
              >
                Remove
              </button>
            </div>
          );
        })}
        {mappings.length === 0 && (
          <p className="text-[12px] font-[460] text-muted-foreground italic">No mappings yet.</p>
        )}
      </div>
    </div>
  );
}

function SapphireMappingSection() {
  const [mappings, setMappings] = useState<SapphireMapping[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"terminal" | "tac">("terminal");
  const [newNotes, setNewNotes] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newSetupUrl, setNewSetupUrl] = useState("");
  const [newTroubleUrl, setNewTroubleUrl] = useState("");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMappings(getSapphireMappings());
  }, []);

  function handleSave() {
    saveSapphireMappings(mappings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function resetForm() {
    setNewCode(""); setNewName(""); setNewNotes("");
    setNewImageUrl(""); setNewSetupUrl(""); setNewTroubleUrl("");
    setEditingCode(null);
  }

  function addOrUpdateMapping() {
    const codeTrimmed = newCode.trim();
    if (!codeTrimmed || !newName.trim()) return;
    const code = newKind === "tac" ? codeTrimmed.replace(/\D/g, "").slice(0, 8) : codeTrimmed.toUpperCase();
    if (newKind === "tac" && code.length !== 8) return;
    const next: SapphireMapping = {
      code, kind: newKind, name: newName.trim(),
      imageUrl: newImageUrl.trim() || undefined,
      setupGuideUrl: newSetupUrl.trim() || undefined,
      troubleshootingUrl: newTroubleUrl.trim() || undefined,
      notes: newNotes.trim() || undefined,
    };
    setMappings((prev) => {
      const existsIdx = prev.findIndex((m) => m.code === code && m.kind === newKind);
      if (existsIdx >= 0) {
        const copy = [...prev];
        copy[existsIdx] = next;
        return copy;
      }
      return [...prev, next];
    });
    resetForm();
  }

  function editMapping(m: SapphireMapping) {
    setNewKind(m.kind);
    setNewCode(m.code);
    setNewName(m.name);
    setNewImageUrl(m.imageUrl || "");
    setNewSetupUrl(m.setupGuideUrl || "");
    setNewTroubleUrl(m.troubleshootingUrl || "");
    setNewNotes(m.notes || "");
    setEditingCode(`${m.kind}:${m.code}`);
  }

  function removeMapping(code: string, kind: "terminal" | "tac") {
    setMappings((prev) => prev.filter((m) => !(m.code === code && m.kind === kind)));
    if (editingCode === `${kind}:${code}`) resetForm();
  }

  const terminalMappings = mappings.filter((m) => m.kind === "terminal");
  const tacMappings = mappings.filter((m) => m.kind === "tac");

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
              <Smartphone className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">Sapphire Devices</CardTitle>
              <CardDescription className="text-[12px]">
                Map UCL terminal codes (G2, E1) and IMEI TAC prefixes to friendly device names
              </CardDescription>
            </div>
          </div>
          <SaveButton saved={saved} onClick={handleSave} />
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <SapphireMappingList
          title={`UCL Terminal Codes (${terminalMappings.length})`}
          codeWidth="w-20"
          mappings={terminalMappings}
          editingCode={editingCode}
          onEdit={editMapping}
          onRemove={(code) => removeMapping(code, "terminal")}
        />

        <SapphireMappingList
          title={`IMEI TAC Prefixes (${tacMappings.length})`}
          codeWidth="w-28"
          mappings={tacMappings}
          editingCode={editingCode}
          onEdit={editMapping}
          onRemove={(code) => removeMapping(code, "tac")}
        />

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-[600] uppercase tracking-wider text-muted-foreground">
              {editingCode ? "Edit mapping" : "Add mapping"}
            </p>
            {editingCode && (
              <button
                onClick={resetForm}
                className="text-[11px] font-[500] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_140px_1fr] gap-2 items-start">
            <select
              value={newKind}
              onChange={(e) => setNewKind(e.target.value as "terminal" | "tac")}
              className="rounded-[8px] border border-border bg-background px-2 py-2 text-[13px] cursor-pointer h-9"
              aria-label="Mapping kind"
              disabled={!!editingCode}
            >
              <option value="terminal">Terminal code</option>
              <option value="tac">IMEI TAC (8 digits)</option>
            </select>
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder={newKind === "tac" ? "TAC (e.g. 35570043)" : "Code (e.g. U3Q19)"}
              className="rounded-[8px] font-mono text-[13px] h-9"
              disabled={!!editingCode}
            />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Device name (e.g. Sapphire 5G)"
              className="rounded-[8px] text-[13px] h-9"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 items-start">
            <div className="h-24 w-24 rounded-[8px] border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
              {newImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={newImageUrl} alt="preview" className="h-full w-full object-contain" />
              ) : (
                <Smartphone className="h-8 w-8 text-muted-foreground/40" strokeWidth={1.4} />
              )}
            </div>
            <div className="space-y-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Product image URL (https://…)"
                className="rounded-[8px] text-[13px] h-9"
              />
              <Input
                value={newSetupUrl}
                onChange={(e) => setNewSetupUrl(e.target.value)}
                placeholder="Setup / configuration guide URL (https://…)"
                className="rounded-[8px] text-[13px] h-9"
              />
              <Input
                value={newTroubleUrl}
                onChange={(e) => setNewTroubleUrl(e.target.value)}
                placeholder="Troubleshooting guide URL (https://…)"
                className="rounded-[8px] text-[13px] h-9"
              />
              <Input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Internal notes (optional)"
                className="rounded-[8px] text-[13px] h-9"
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Button
              onClick={addOrUpdateMapping}
              disabled={!newCode.trim() || !newName.trim() || (newKind === "tac" && newCode.replace(/\D/g, "").length !== 8)}
              className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer"
            >
              {editingCode ? "Update mapping" : "Add mapping"}
            </Button>
          </div>
        </div>

        <p className="text-[11px] font-[460] text-muted-foreground">
          The customer view looks up <span className="font-mono">terminalType</span> first (from UCL), then falls back to the IMEI TAC prefix.
          Devices in neither list show as &quot;unmapped&quot;. Don&apos;t forget to <span className="font-[600] text-foreground">Save</span> after edits.
        </p>
      </CardContent>
    </Card>
  );
}

/* ─── Shared small components ─────────────────────────────────── */

function VendorListView({
  onSelect, onAdd, tsStatus,
}: {
  onSelect: (id: VendorId) => void;
  onAdd: () => void;
  tsStatus: ConnectionStatus;
}) {
  const statusByVendor: Record<VendorId, ConnectionStatus> = {
    tellisim: tsStatus,
  };

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
              <Plug className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
            </div>
            <div>
              <CardTitle className="text-[15px] font-[600] text-foreground">Vendor Integrations</CardTitle>
              <CardDescription className="text-[12px]">
                Third-party vendor APIs. Select a vendor to configure its credentials.
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={onAdd}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add Vendor
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-2">
        {VENDORS.map((v) => {
          const status = statusByVendor[v.id];
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => onSelect(v.id)}
              className="group flex w-full items-center gap-3 rounded-[8px] border border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/40 hover:border-parchment-border cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
                <Radio className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-[600] text-foreground">{v.name}</span>
                  <ConnectionBadge status={status} />
                </div>
                <p className="mt-0.5 truncate text-[12px] font-[460] text-muted-foreground">
                  {v.description}
                </p>
              </div>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ComingSoonModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-vendor-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[16px] bg-background border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] bg-lavender/20">
            <Sparkles className="h-5 w-5 text-amethyst" strokeWidth={1.8} />
          </div>
          <h2 id="add-vendor-title" className="mt-4 text-[18px] font-[600] text-foreground">
            Coming Soon
          </h2>
          <p className="mt-2 text-[13px] font-[460] text-muted-foreground leading-relaxed">
            Adding custom vendor integrations is on the roadmap. For now, vendors are defined in code. We&apos;ll enable self-serve vendor onboarding once the schema is finalized.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            onClick={onClose}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubTabs({
  value, onChange, options, ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-[8px] bg-muted/50 p-1"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`rounded-[8px] px-3 py-1.5 text-[13px] transition-all cursor-pointer ${
              isActive
                ? "bg-background text-foreground font-[600] shadow-sm"
                : "text-muted-foreground font-[460] hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label, help, children,
}: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[13px] font-[600] text-foreground">{label}</Label>
      {children}
      {help && <p className="mt-1 text-[11px] font-[460] text-muted-foreground">{help}</p>}
    </div>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
        saved ? "bg-success text-white" : "bg-cream text-charcoal hover:bg-cream-hover"
      }`}
    >
      <Save className="h-3.5 w-3.5" strokeWidth={2} />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

function TestConnectionRow({
  title, subtitle, status, onTest,
}: {
  title: string;
  subtitle: string;
  status: ConnectionStatus;
  onTest: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] font-[600] text-foreground">{title}</p>
        <p className="text-[11px] font-[460] text-muted-foreground">{subtitle}</p>
      </div>
      <Button
        onClick={onTest}
        disabled={status.status === "testing"}
        className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
      >
        {status.status === "testing" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5" strokeWidth={2} />
            Test Connection
          </>
        )}
      </Button>
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status.status === "idle") return null;
  if (status.status === "testing") {
    return (
      <Badge
        variant="outline"
        className="rounded-[8px] border-border text-muted-foreground text-[11px] font-[500]"
      >
        <Loader2 className="h-3 w-3 animate-spin mr-1" />
        Testing
      </Badge>
    );
  }
  if (status.status === "connected") {
    return (
      <Badge className="rounded-[8px] bg-success-soft text-success border-0 text-[11px] font-[500]">
        <Wifi className="h-3 w-3 mr-1" strokeWidth={2} />
        Connected
      </Badge>
    );
  }
  return (
    <Badge className="rounded-[8px] bg-fraud-red-soft text-fraud-red border-0 text-[11px] font-[500]">
      <WifiOff className="h-3 w-3 mr-1" strokeWidth={2} />
      Error
    </Badge>
  );
}

function StatusMessage({ status }: { status: ConnectionStatus }) {
  if (status.status === "connected") {
    return (
      <div className="flex items-start gap-2 rounded-[8px] bg-success-soft border border-success/20 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" strokeWidth={2} />
        <div>
          <p className="text-[13px] font-[600] text-success">{status.message}</p>
          {status.timestamp && (
            <p className="text-[11px] font-[460] text-success/70">Last tested at {status.timestamp}</p>
          )}
        </div>
      </div>
    );
  }
  if (status.status === "error") {
    return (
      <div className="flex items-start gap-2 rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-4 py-3">
        <XCircle className="h-4 w-4 text-fraud-red mt-0.5 shrink-0" strokeWidth={2} />
        <p className="text-[13px] font-[600] text-fraud-red">{status.message}</p>
      </div>
    );
  }
  return null;
}
