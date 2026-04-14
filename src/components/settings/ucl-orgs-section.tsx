"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Save,
  Plus,
  Trash2,
  Pencil,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle2,
  XCircle,
  Server,
  KeyRound,
  Building2,
  X,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
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

/* ─── Types ─── */
interface UclOrg {
  id: string;
  orgName: string;
  username: string;
  password: string;
  isActive: boolean;
  lastTestedAt: string | null;
  lastTestResult: string | null;
  lastTestMessage: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface UclGlobalConfig {
  partnerCode: string;
  clientId: string;
  clientSecret: string;
  mvnoCode: string;
}

interface TestStep {
  label: string;
  status: "pending" | "running" | "success" | "error";
  detail?: string;
}

/* ─── Main Component ─── */
export function UclOrgsSection() {
  const [orgs, setOrgs] = useState<UclOrg[]>([]);
  const [config, setConfig] = useState<UclGlobalConfig>({
    partnerCode: "",
    clientId: "",
    clientSecret: "",
    mvnoCode: "",
  });
  const [configSaved, setConfigSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [revealedConfigFields, setRevealedConfigFields] = useState<Set<string>>(new Set());

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editOrg, setEditOrg] = useState<UclOrg | null>(null);
  const [deleteOrg, setDeleteOrg] = useState<UclOrg | null>(null);
  const [testOrg, setTestOrg] = useState<UclOrg | null>(null);

  // Config expand
  const [configExpanded, setConfigExpanded] = useState(false);

  // Test All state
  const [testAllRunning, setTestAllRunning] = useState(false);
  const [testAllProgress, setTestAllProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    error: 0,
  });

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await fetch("/api/ucl/orgs");
      const data = await res.json();
      if (data.ok) setOrgs(data.orgs);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/ucl/config");
      const data = await res.json();
      if (data.ok && data.config) {
        setConfig({
          partnerCode: data.config.partnerCode || "",
          clientId: data.config.clientId || "",
          clientSecret: data.config.clientSecret || "",
          mvnoCode: data.config.mvnoCode || "",
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchOrgs(), fetchConfig()]).finally(() => setLoading(false));
  }, [fetchOrgs, fetchConfig]);

  const handleSaveConfig = async () => {
    try {
      const res = await fetch("/api/ucl/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.ok) {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 2000);
      }
    } catch {
      /* ignore */
    }
  };

  const handleTestAll = async () => {
    const targets = orgs.filter((o) => o.isActive);
    if (targets.length === 0 || testAllRunning) return;

    setTestAllRunning(true);
    setTestAllProgress({ current: 0, total: targets.length, success: 0, error: 0 });

    let successCount = 0;
    let errorCount = 0;

    // Sequential to avoid hammering UCL — each request also writes status to DB
    for (let i = 0; i < targets.length; i++) {
      const org = targets[i];
      try {
        const res = await fetch("/api/ucl/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: org.id,
            username: org.username,
            password: org.password,
          }),
        });
        const data = await res.json();
        if (data.ok) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
      setTestAllProgress({
        current: i + 1,
        total: targets.length,
        success: successCount,
        error: errorCount,
      });
    }

    await fetchOrgs();
    setTestAllRunning(false);
  };

  const togglePassword = (id: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleConfigField = (key: string) => {
    setRevealedConfigFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Status sort: failed first → not tested → valid. Surfaces problems at the top.
  const statusRank = (r: string | null) =>
    r === "error" ? 0 : r === null ? 1 : 2;

  const filteredOrgs = orgs
    .filter(
      (o) =>
        o.orgName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const diff = statusRank(a.lastTestResult) - statusRank(b.lastTestResult);
      if (diff !== 0) return diff;
      return a.orgName.localeCompare(b.orgName);
    });

  const failedOrgs = orgs.filter((o) => o.lastTestResult === "error");

  if (loading) {
    return (
      <Card className="rounded-[16px]">
        <CardContent className="py-12 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-[13px] font-[460] text-muted-foreground">
            Loading UCL organizations...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* ─── Global Config (collapsible) ─── */}
      <Card className="rounded-[16px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setConfigExpanded(!configExpanded)}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
                <KeyRound className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
              </div>
              <div className="text-left">
                <CardTitle className="text-[15px] font-[600] text-foreground">
                  UCL API Credentials
                </CardTitle>
                <CardDescription className="text-[12px]">
                  Global OAuth parameters shared by all organizations
                </CardDescription>
              </div>
              {configExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-2" strokeWidth={1.8} />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground ml-2" strokeWidth={1.8} />
              )}
            </button>
            {configExpanded && (
              <Button
                onClick={handleSaveConfig}
                className={`rounded-[8px] text-[13px] font-[600] transition-all duration-200 cursor-pointer ${
                  configSaved
                    ? "bg-success text-white"
                    : "bg-cream text-charcoal hover:bg-cream-hover"
                }`}
              >
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                {configSaved ? "Saved" : "Save"}
              </Button>
            )}
          </div>
        </CardHeader>
        {configExpanded && (
          <CardContent className="space-y-4 pt-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[13px] font-[600] text-foreground">
                  Partner Code
                </Label>
                <Input
                  value={config.partnerCode}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, partnerCode: e.target.value }))
                  }
                  placeholder="e.g. UKGRP"
                  className="mt-1.5 rounded-[8px] font-mono text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[13px] font-[600] text-foreground">
                  MVNO Code
                </Label>
                <Input
                  value={config.mvnoCode}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, mvnoCode: e.target.value }))
                  }
                  placeholder="e.g. MVNO"
                  className="mt-1.5 rounded-[8px] font-mono text-[13px]"
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-[13px] font-[600] text-foreground">
                Client ID
              </Label>
              <div className="relative mt-1.5">
                <Input
                  type={revealedConfigFields.has("clientId") ? "text" : "password"}
                  value={config.clientId}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, clientId: e.target.value }))
                  }
                  placeholder="OAuth Client ID"
                  className="rounded-[8px] pr-10 font-mono text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => toggleConfigField("clientId")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {revealedConfigFields.has("clientId") ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-[13px] font-[600] text-foreground">
                Client Secret
              </Label>
              <div className="relative mt-1.5">
                <Input
                  type={
                    revealedConfigFields.has("clientSecret") ? "text" : "password"
                  }
                  value={config.clientSecret}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, clientSecret: e.target.value }))
                  }
                  placeholder="OAuth Client Secret"
                  className="rounded-[8px] pr-10 font-mono text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => toggleConfigField("clientSecret")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {revealedConfigFields.has("clientSecret") ? (
                    <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                  ) : (
                    <Eye className="h-4 w-4" strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </div>

            <div className="rounded-[8px] bg-muted/50 border border-border px-4 py-3">
              <p className="text-[12px] font-[460] text-muted-foreground leading-relaxed">
                These values are provided by uCloudlink during integration setup.
                They are used for all org logins via the GrpUserLogin endpoint.
                The access token is valid for 8 hours per session.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ─── Org List ─── */}
      <Card className="rounded-[16px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-lavender/20">
                <Building2 className="h-4 w-4 text-amethyst" strokeWidth={1.8} />
              </div>
              <div>
                <CardTitle className="text-[15px] font-[600] text-foreground">
                  UCL Organizations
                </CardTitle>
                <CardDescription className="text-[12px]">
                  {orgs.length} org{orgs.length !== 1 ? "s" : ""} configured
                  &mdash; API credentials for the uCloudlink SaaS device management
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleTestAll}
                disabled={testAllRunning || orgs.filter((o) => o.isActive).length === 0}
                className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                title="Test connection for every active org sequentially"
              >
                {testAllRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    Testing {testAllProgress.current}/{testAllProgress.total}
                    <span className="ml-1 text-[11px] font-[460] text-muted-foreground">
                      ({testAllProgress.success} ok · {testAllProgress.error} err)
                    </span>
                  </>
                ) : (
                  <>
                    <Wifi className="h-3.5 w-3.5" strokeWidth={2} />
                    Test All
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add Org
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Connection Issues panel */}
          {failedOrgs.length > 0 && (
            <div className="mb-4 rounded-[8px] border border-fraud-red/20 bg-fraud-red-soft overflow-hidden">
              <div className="px-4 py-2.5 border-b border-fraud-red/20 flex items-center gap-2">
                <WifiOff className="h-3.5 w-3.5 text-fraud-red" strokeWidth={2} />
                <span className="text-[12px] font-[600] text-fraud-red">
                  {failedOrgs.length} connection{failedOrgs.length !== 1 ? "s" : ""} failed
                </span>
              </div>
              <div className="divide-y divide-fraud-red/10 max-h-64 overflow-y-auto">
                {failedOrgs.map((o) => (
                  <div key={o.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-[540] text-foreground truncate">
                        {o.orgName}
                      </div>
                      <div className="text-[11px] font-mono font-[460] text-muted-foreground truncate">
                        {o.username}
                      </div>
                      {o.lastTestMessage && (
                        <div className="text-[12px] font-[460] text-fraud-red mt-1 break-words">
                          {o.lastTestMessage}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setTestOrg(o)}
                      className="shrink-0 rounded-[8px] px-2 py-1 text-[11px] font-[600] text-charcoal bg-cream hover:bg-cream-hover cursor-pointer"
                    >
                      Retest
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              strokeWidth={1.8}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by org name or username..."
              className="rounded-[8px] pl-9 text-[13px]"
            />
          </div>

          {/* Table */}
          <div className="rounded-[8px] border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left text-[11px] font-[600] text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Organization
                  </th>
                  <th className="text-left text-[11px] font-[600] text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Username
                  </th>
                  <th className="text-left text-[11px] font-[600] text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Password
                  </th>
                  <th className="text-left text-[11px] font-[600] text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Status
                  </th>
                  <th className="text-right text-[11px] font-[600] text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-8 text-[13px] font-[460] text-muted-foreground"
                    >
                      {searchQuery
                        ? "No organizations match your search"
                        : "No organizations configured yet"}
                    </td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-[540] text-foreground">
                          {org.orgName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[13px] font-mono font-[460] text-muted-foreground">
                          {org.username}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-mono font-[460] text-muted-foreground">
                            {revealedPasswords.has(org.id)
                              ? org.password
                              : "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                          </span>
                          <button
                            onClick={() => togglePassword(org.id)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {revealedPasswords.has(org.id) ? (
                              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.8} />
                            ) : (
                              <Eye className="h-3.5 w-3.5" strokeWidth={1.8} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <OrgStatusBadge org={org} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setTestOrg(org)}
                            className="rounded-[8px] p-1.5 text-muted-foreground hover:text-amethyst hover:bg-lavender/20 cursor-pointer transition-colors"
                            title="Test connection"
                          >
                            <Wifi className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={() => setEditOrg(org)}
                            className="rounded-[8px] p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                          <button
                            onClick={() => setDeleteOrg(org)}
                            className="rounded-[8px] p-1.5 text-muted-foreground hover:text-fraud-red hover:bg-fraud-red/10 cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredOrgs.length > 0 && (
            <p className="mt-2 text-[11px] font-[460] text-muted-foreground">
              Showing {filteredOrgs.length} of {orgs.length} organizations
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Modals ─── */}
      {showAddModal && (
        <AddOrgModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            fetchOrgs();
          }}
        />
      )}
      {editOrg && (
        <EditOrgModal
          org={editOrg}
          onClose={() => setEditOrg(null)}
          onSaved={() => {
            setEditOrg(null);
            fetchOrgs();
          }}
        />
      )}
      {deleteOrg && (
        <DeleteOrgModal
          org={deleteOrg}
          onClose={() => setDeleteOrg(null)}
          onDeleted={() => {
            setDeleteOrg(null);
            fetchOrgs();
          }}
        />
      )}
      {testOrg && (
        <TestConnectionModal
          org={testOrg}
          onClose={() => {
            setTestOrg(null);
            fetchOrgs();
          }}
        />
      )}
    </>
  );
}

/* ─── Status Badge ─── */
function OrgStatusBadge({ org }: { org: UclOrg }) {
  if (!org.lastTestResult) {
    return (
      <Badge
        variant="outline"
        className="rounded-[8px] border-border text-muted-foreground text-[11px] font-[500]"
      >
        Not tested
      </Badge>
    );
  }
  if (org.lastTestResult === "success") {
    return (
      <Badge className="rounded-[8px] bg-success-soft text-success border-0 text-[11px] font-[500]">
        <Wifi className="h-3 w-3 mr-1" strokeWidth={2} />
        Valid
      </Badge>
    );
  }
  return (
    <Badge className="rounded-[8px] bg-fraud-red-soft text-fraud-red border-0 text-[11px] font-[500]">
      <WifiOff className="h-3 w-3 mr-1" strokeWidth={2} />
      Failed
    </Badge>
  );
}

/* ─── Modal Backdrop ─── */
function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md mx-4 rounded-[16px] bg-background border border-border shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

/* ─── Add Org Modal ─── */
function AddOrgModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: () => void;
}) {
  const [orgName, setOrgName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!orgName.trim() || !username.trim() || !password.trim()) {
      setError("All fields are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/ucl/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: orgName.trim(),
          username: username.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onAdded();
      } else {
        setError(data.error || "Failed to add organization");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-[600] text-foreground">
            Add UCL Organization
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-[13px] font-[600] text-foreground">
              Organization Name
            </Label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. DHI-B2B-Leidos"
              className="mt-1.5 rounded-[8px] text-[13px]"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-[13px] font-[600] text-foreground">
              API Username
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. B2BLeidos"
              className="mt-1.5 rounded-[8px] font-mono text-[13px]"
            />
          </div>
          <div>
            <Label className="text-[13px] font-[600] text-foreground">
              API Password
            </Label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="rounded-[8px] pr-10 font-mono text-[13px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-3 py-2">
              <XCircle
                className="h-3.5 w-3.5 mt-0.5 shrink-0 text-fraud-red"
                strokeWidth={2}
              />
              <span className="text-[12px] font-[460] text-fraud-red">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            onClick={onClose}
            className="rounded-[8px] bg-muted text-foreground text-[13px] font-[600] hover:bg-muted/80 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Add Organization
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* ─── Edit Org Modal ─── */
function EditOrgModal({
  org,
  onClose,
  onSaved,
}: {
  org: UclOrg;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [password, setPassword] = useState(org.password);
  const [showPassword, setShowPassword] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/ucl/orgs/${org.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        onSaved();
      } else {
        setError(data.error || "Failed to update");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-[600] text-foreground">
            Edit Password
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-[8px] bg-muted/50 border border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Building2
                className="h-4 w-4 text-amethyst shrink-0"
                strokeWidth={1.8}
              />
              <div>
                <p className="text-[13px] font-[600] text-foreground">
                  {org.orgName}
                </p>
                <p className="text-[11px] font-mono font-[460] text-muted-foreground">
                  {org.username}
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-[13px] font-[600] text-foreground">
              New Password
            </Label>
            <div className="relative mt-1.5">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="rounded-[8px] pr-10 font-mono text-[13px]"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <Eye className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-[8px] bg-fraud-red-soft border border-fraud-red/20 px-3 py-2">
              <XCircle
                className="h-3.5 w-3.5 mt-0.5 shrink-0 text-fraud-red"
                strokeWidth={2}
              />
              <span className="text-[12px] font-[460] text-fraud-red">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            onClick={onClose}
            className="rounded-[8px] bg-muted text-foreground text-[13px] font-[600] hover:bg-muted/80 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-[8px] bg-mysteria text-white text-[13px] font-[600] hover:bg-mysteria/90 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" strokeWidth={2} />
                Save Password
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* ─── Delete Org Modal ─── */
function DeleteOrgModal({
  org,
  onClose,
  onDeleted,
}: {
  org: UclOrg;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/ucl/orgs/${org.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) onDeleted();
    } catch {
      /* ignore */
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-[600] text-fraud-red">
            Delete Organization
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <p className="text-[13px] font-[460] text-muted-foreground mb-2">
          Are you sure you want to remove this organization?
        </p>
        <div className="rounded-[8px] bg-fraud-red/5 border border-fraud-red/20 px-4 py-3 mb-4">
          <p className="text-[14px] font-[600] text-foreground">{org.orgName}</p>
          <p className="text-[12px] font-mono font-[460] text-muted-foreground">
            {org.username}
          </p>
        </div>
        <p className="text-[12px] font-[460] text-muted-foreground">
          This action cannot be undone. The API credentials will be permanently
          removed.
        </p>

        <div className="flex justify-end gap-2 mt-6">
          <Button
            onClick={onClose}
            className="rounded-[8px] bg-muted text-foreground text-[13px] font-[600] hover:bg-muted/80 cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-[8px] bg-fraud-red text-white text-[13px] font-[600] hover:bg-fraud-red/90 cursor-pointer"
          >
            {deleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

/* ─── Test Connection Modal (with live steps) ─── */
function TestConnectionModal({
  org,
  onClose,
}: {
  org: UclOrg;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<TestStep[]>([
    { label: "Checking global config", status: "pending" },
    { label: "Connecting to UCL SaaS", status: "pending" },
    { label: "Authenticating credentials", status: "pending" },
    { label: "Validating access token", status: "pending" },
    { label: "Cleaning up session", status: "pending" },
  ]);
  const [done, setDone] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateStep = (
    index: number,
    status: TestStep["status"],
    detail?: string
  ) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, status, detail } : s))
    );
  };

  useEffect(() => {
    let cancelled = false;

    async function runTest() {
      // Step 0: Check config
      updateStep(0, "running");
      await delay(400);
      if (cancelled) return;

      let data: Record<string, unknown>;
      try {
        // Fire the API call while showing config check
        const res = await fetch("/api/ucl/test-connection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: org.id,
            username: org.username,
            password: org.password,
          }),
        });

        if (cancelled) return;
        data = await res.json();
      } catch {
        if (cancelled) return;
        updateStep(0, "error", "Network error — could not reach API");
        setDone(true);
        return;
      }

      // If config is missing, fail at step 0
      if (data.step === "config_missing") {
        updateStep(0, "error", data.error as string);
        setDone(true);
        return;
      }

      // Config OK — advance through steps
      updateStep(0, "success", "Global config loaded");
      updateStep(1, "running");
      await delay(500);
      if (cancelled) return;

      updateStep(1, "success", "Connected to saas.ucloudlink.com");
      updateStep(2, "running");
      await delay(300);
      if (cancelled) return;

      if (data.ok) {
        updateStep(2, "success", "Credentials accepted");

        // Step 3: Token
        updateStep(3, "running");
        await delay(400);
        if (cancelled) return;
        updateStep(3, "success", `Access token ${data.accessToken}`);

        // Step 4: Cleanup
        updateStep(4, "running");
        await delay(300);
        if (cancelled) return;
        updateStep(4, "success", "Session logged out");

        setSuccess(true);
      } else {
        updateStep(
          2,
          "error",
          (data.error as string) || `Error ${data.resultCode}`
        );
      }

      setDone(true);
    }

    runTest();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-[600] text-foreground">
            Test Connection
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Org info */}
        <div className="rounded-[8px] bg-muted/50 border border-border px-4 py-3 mb-5">
          <div className="flex items-center gap-2">
            <Server
              className="h-4 w-4 text-amethyst shrink-0"
              strokeWidth={1.8}
            />
            <div>
              <p className="text-[13px] font-[600] text-foreground">
                {org.orgName}
              </p>
              <p className="text-[11px] font-mono font-[460] text-muted-foreground">
                {org.username}
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {step.status === "pending" && (
                  <div className="h-4 w-4 rounded-full border-2 border-border" />
                )}
                {step.status === "running" && (
                  <Loader2 className="h-4 w-4 animate-spin text-amethyst" />
                )}
                {step.status === "success" && (
                  <CheckCircle2
                    className="h-4 w-4 text-success"
                    strokeWidth={2}
                  />
                )}
                {step.status === "error" && (
                  <XCircle
                    className="h-4 w-4 text-fraud-red"
                    strokeWidth={2}
                  />
                )}
              </div>
              <div>
                <p
                  className={`text-[13px] font-[540] ${
                    step.status === "pending"
                      ? "text-muted-foreground"
                      : step.status === "error"
                        ? "text-fraud-red"
                        : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p
                    className={`text-[11px] font-[460] mt-0.5 ${
                      step.status === "error"
                        ? "text-fraud-red"
                        : "text-muted-foreground"
                    }`}
                  >
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Result */}
        {done && (
          <div
            className={`mt-5 rounded-[8px] px-4 py-3 border ${
              success
                ? "bg-success-soft border-success/20"
                : "bg-fraud-red-soft border-fraud-red/20"
            }`}
          >
            <p
              className={`text-[13px] font-[600] ${
                success ? "text-success" : "text-fraud-red"
              }`}
            >
              {success
                ? "Connection successful — credentials are valid"
                : "Connection failed — check credentials or global config"}
            </p>
          </div>
        )}

        <div className="flex justify-end mt-6">
          <Button
            onClick={onClose}
            className="rounded-[8px] bg-cream text-charcoal text-[13px] font-[600] hover:bg-cream-hover cursor-pointer"
          >
            {done ? "Close" : "Cancel"}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
