"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { UclOrgsSection } from "@/components/settings/ucl-orgs-section";
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
  opensearch: {
    url: string;
    username: string;
    password: string;
  };
  tellisim: {
    baseUrl: string;
    apiKey: string;
    orgId: string;
  };
  fraudWatch: {
    scanInterval: string;
    enabled: boolean;
  };
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

function saveSettings(settings: AppSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());
  const [savedFeedback, setSavedFeedback] = useState<Record<string, boolean>>({});
  const [osStatus, setOsStatus] = useState<ConnectionStatus>({ status: "idle" });
  const [tsStatus, setTsStatus] = useState<ConnectionStatus>({ status: "idle" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setMounted(true);
  }, []);

  const toggleReveal = (key: string) => {
    setRevealedFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const showSaved = useCallback((section: string) => {
    setSavedFeedback((prev) => ({ ...prev, [section]: true }));
    setTimeout(() => setSavedFeedback((prev) => ({ ...prev, [section]: false })), 2000);
  }, []);

  const handleSaveOS = () => {
    saveSettings(settings);
    showSaved("opensearch");
  };

  const handleSaveTS = () => {
    saveSettings(settings);
    showSaved("tellisim");
  };

  const handleSaveFraud = () => {
    saveSettings(settings);
    showSaved("fraud");
  };

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
        setOsStatus({
          status: "error",
          message: data.error || "Connection failed",
        });
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
        setTsStatus({
          status: "error",
          message: data.error || "Connection failed",
        });
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
      {/* Header */}
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

      {/* ─── OpenSearch ─── */}
      <Card className="rounded-[16px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
                <Search className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle className="text-[15px] font-[600] text-foreground">
                  OpenSearch
                </CardTitle>
                <CardDescription className="text-[12px]">
                  Connection to the OpenSearch cluster for orders, CDR, and customer data
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionBadge status={osStatus} />
              <Button
                onClick={handleSaveOS}
                className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
                  savedFeedback.opensearch
                    ? "bg-success text-white"
                    : "bg-cream text-charcoal hover:bg-cream-hover"
                }`}
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {savedFeedback.opensearch ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {/* URL */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">Endpoint URL</Label>
            <Input
              value={settings.opensearch.url}
              onChange={(e) =>
                setSettings((s) => ({ ...s, opensearch: { ...s.opensearch, url: e.target.value } }))
              }
              placeholder="https://search-domain.us-east-1.es.amazonaws.com"
              className="mt-1.5 rounded-[8px] font-mono text-[13px]"
            />
            <p className="mt-1 text-[11px] font-[460] text-muted-foreground">
              Include the port if not standard (e.g., :9200)
            </p>
          </div>

          <Separator />

          {/* Username */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">Username</Label>
            <Input
              value={settings.opensearch.username}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  opensearch: { ...s.opensearch, username: e.target.value },
                }))
              }
              placeholder="admin"
              className="mt-1.5 rounded-[8px] font-mono text-[13px]"
            />
          </div>

          <Separator />

          {/* Password */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">Password</Label>
            <div className="relative mt-1.5">
              <Input
                type={revealedFields.has("os_pass") ? "text" : "password"}
                value={settings.opensearch.password}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    opensearch: { ...s.opensearch, password: e.target.value },
                  }))
                }
                placeholder="Enter password"
                className="rounded-[8px] pr-10 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => toggleReveal("os_pass")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {revealedFields.has("os_pass") ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <p className="mt-1 text-[11px] font-[460] text-muted-foreground">
              Stored in your browser&apos;s local storage only
            </p>
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-[600] text-foreground">Test Connection</p>
              <p className="text-[11px] font-[460] text-muted-foreground">
                Verify the ops tool can reach OpenSearch
              </p>
            </div>
            <Button
              onClick={testOpenSearch}
              disabled={osStatus.status === "testing"}
              className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
            >
              {osStatus.status === "testing" ? (
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

          {/* Status Message */}
          {osStatus.status !== "idle" && osStatus.status !== "testing" && (
            <StatusMessage status={osStatus} />
          )}
        </CardContent>
      </Card>

      {/* ─── TelliSIM API ─── */}
      <Card className="rounded-[16px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
                <Radio className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle className="text-[15px] font-[600] text-foreground">
                  TelliSIM API
                </CardTitle>
                <CardDescription className="text-[12px]">
                  eSIM subscription management, plan attachments, and CDR enrichment
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionBadge status={tsStatus} />
              <Button
                onClick={handleSaveTS}
                className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
                  savedFeedback.tellisim
                    ? "bg-success text-white"
                    : "bg-cream text-charcoal hover:bg-cream-hover"
                }`}
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {savedFeedback.tellisim ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {/* Base URL */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">Base URL</Label>
            <Input
              value={settings.tellisim.baseUrl}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  tellisim: { ...s.tellisim, baseUrl: e.target.value },
                }))
              }
              placeholder="https://api.tellisim.com"
              className="mt-1.5 rounded-[8px] font-mono text-[13px]"
            />
          </div>

          <Separator />

          {/* API Key */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">API Key</Label>
            <div className="relative mt-1.5">
              <Input
                type={revealedFields.has("ts_key") ? "text" : "password"}
                value={settings.tellisim.apiKey}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    tellisim: { ...s.tellisim, apiKey: e.target.value },
                  }))
                }
                placeholder="Enter API key"
                className="rounded-[8px] pr-10 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => toggleReveal("ts_key")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {revealedFields.has("ts_key") ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
            <p className="mt-1 text-[11px] font-[460] text-muted-foreground">
              Auth via query string (?key=). Stored in your browser&apos;s local storage only
            </p>
          </div>

          <Separator />

          {/* Org ID */}
          <div>
            <Label className="text-[13px] font-[600] text-foreground">Organization ID</Label>
            <Input
              value={settings.tellisim.orgId}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  tellisim: { ...s.tellisim, orgId: e.target.value },
                }))
              }
              placeholder="e.g. Lw3p6r8EbCQXOROQ2ly458f3bGt1"
              className="mt-1.5 rounded-[8px] font-mono text-[13px]"
            />
            <p className="mt-1 text-[11px] font-[460] text-muted-foreground">
              Present in config but not currently sent in API calls. Reserved for future use.
            </p>
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-[600] text-foreground">Test Connection</p>
              <p className="text-[11px] font-[460] text-muted-foreground">
                Verify the API key is valid
              </p>
            </div>
            <Button
              onClick={testTelliSIM}
              disabled={tsStatus.status === "testing"}
              className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
            >
              {tsStatus.status === "testing" ? (
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

          {tsStatus.status !== "idle" && tsStatus.status !== "testing" && (
            <StatusMessage status={tsStatus} />
          )}
        </CardContent>
      </Card>

      {/* ─── Fraud Watch Settings ─── */}
      <Card className="rounded-[16px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-fraud-red/10">
                <AlertTriangle className="h-4 w-4 text-fraud-red" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle className="text-[15px] font-[600] text-foreground">
                  Fraud Watch
                </CardTitle>
                <CardDescription className="text-[12px]">
                  Configure how often the system scans OpenSearch for fraud matches
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={handleSaveFraud}
              className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
                savedFeedback.fraud
                  ? "bg-success text-white"
                  : "bg-cream text-charcoal hover:bg-cream-hover"
              }`}
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2} />
              {savedFeedback.fraud ? "Saved" : "Save"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {/* Scan Interval */}
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

          {/* Enable/Disable */}
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

          {/* Scan Logic Explanation */}
          <div className="rounded-[8px] bg-muted/50 border border-border px-4 py-3">
            <p className="text-[12px] font-[460] text-muted-foreground leading-relaxed">
              When an agent flags an order as fraud, the system records the customer&apos;s name,
              email, credit card (last 4), and phone number. The cron job then scans OpenSearch for
              all orders matching any of these identifiers and populates the Fraud Watch view.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── System Mapping ─── */}
      <SystemMappingSection />

      {/* ─── Plan Catalog ─── */}
      <PlanCatalogSection />

      {/* ─── UCL Orgs ─── */}
      <UclOrgsSection />

      {/* ─── Coming Soon ─── */}
      <Card className="rounded-[16px] border-dashed opacity-60">
        <CardContent className="py-8 text-center">
          <p className="text-[14px] font-[460] text-muted-foreground">
            Zendesk, Stripe, and Mailgun integrations will be configured here once ready.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Helper Components ─── */

function PlanCatalogSection() {
  const [summaries, setSummaries] = useState<CatalogSummary[]>([]);
  const [uploadStatus, setUploadStatus] = useState<
    Record<string, { type: "success" | "error"; message: string } | null>
  >({});

  useEffect(() => {
    setSummaries(getCatalogSummaries());
  }, []);

  const handleUpload = (planType: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const result = validateCatalog(raw);

        if (!result.valid) {
          setUploadStatus((prev) => ({
            ...prev,
            [planType]: {
              type: "error",
              message: result.errors.join("; "),
            },
          }));
          return;
        }

        saveCatalog(planType, raw);
        setSummaries(getCatalogSummaries());
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
          [planType]: {
            type: "error",
            message: "Failed to parse JSON file",
          },
        }));
      }
    };
    reader.readAsText(file);
  };

  return (
    <Card className="rounded-[16px]">
      <CardHeader className="border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
            <Database className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
          </div>
          <div>
            <CardTitle className="text-[15px] font-[600] text-foreground">
              Plan Catalog
            </CardTitle>
            <CardDescription className="text-[12px]">
              CRM pricing data for discount calculation and coverage lookup
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {summaries.map((s) => (
          <div
            key={s.planType}
            className="rounded-[8px] border border-border px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-[600] text-foreground capitalize">
                  {s.planType}
                </span>
                <span className="text-[11px] font-mono font-[460] text-muted-foreground">
                  {s.planId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`rounded-[8px] border-0 text-[11px] font-[500] ${
                    s.loaded
                      ? "bg-success-soft text-success"
                      : "bg-muted text-muted-foreground"
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
                <label
                  className="inline-flex items-center gap-1 rounded-[8px] bg-cream text-charcoal text-[12px] font-[600] hover:bg-cream-hover cursor-pointer h-7 px-2.5"
                >
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
                <span>
                  <span className="font-[600] text-foreground">v{s.version}</span>
                </span>
                <span>Exported {s.exportedAt}</span>
                <span>
                  {s.vendorName} &middot; Sheet {s.sheetVersion}
                </span>
                <span>
                  {s.totalProducts} products &middot; {s.totalCountries} countries
                </span>
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
              <CardTitle className="text-[15px] font-[600] text-foreground">
                System Mapping
              </CardTitle>
              <CardDescription className="text-[12px]">
                Map system codes to brand names shown to support agents
              </CardDescription>
            </div>
          </div>
          <Button onClick={handleSave}
            className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
              saved ? "bg-success text-white" : "bg-cream text-charcoal hover:bg-cream-hover"
            }`}>
            <Save className="h-3.5 w-3.5" strokeWidth={2} />
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-3">
        {/* Existing mappings */}
        <div className="space-y-2">
          {mappings.map((m) => (
            <div key={m.code} className="flex items-center gap-3 rounded-[8px] border border-border px-3 py-2">
              <span className="text-[13px] font-mono font-[600] text-foreground w-16">{m.code}</span>
              <span className="text-[13px] font-[460] text-muted-foreground">→</span>
              <span className="text-[13px] font-[460] text-foreground flex-1">{m.name}</span>
              <button onClick={() => removeMapping(m.code)}
                className="text-[11px] font-[500] text-muted-foreground hover:text-fraud-red cursor-pointer transition-colors">
                Remove
              </button>
            </div>
          ))}
        </div>

        <Separator />

        {/* Add new mapping */}
        <div className="flex items-center gap-2">
          <Input value={newCode} onChange={(e) => setNewCode(e.target.value)}
            placeholder="Code (e.g. TWUS)" className="w-32 rounded-[8px] font-mono text-[13px]" />
          <Input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Brand name (e.g. TravelWifi US)" className="flex-1 rounded-[8px] text-[13px]" />
          <Button onClick={addMapping} disabled={!newCode.trim() || !newName.trim()}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover disabled:opacity-40 cursor-pointer">
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

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status.status === "idle") return null;
  if (status.status === "testing") {
    return (
      <Badge variant="outline" className="rounded-[8px] border-border text-muted-foreground text-[11px] font-[500]">
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
