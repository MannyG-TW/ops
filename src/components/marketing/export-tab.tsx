"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Download, Eye, Loader2 } from "lucide-react";
import { mfetch } from "@/lib/marketing/client";
import type { BrevoSummary } from "@/lib/marketing/brevo";

export interface Facets { segments: string[]; systems: string[]; destinations: string[]; }

interface Criteria {
  segments: string[]; systems: string[]; destination: string;
  monthsBack: number | null; subscription: "any" | "exclude_unsub" | "subscribed_only";
  minSpend: number | null; maxSpend: number | null;
  countryFilter: "any" | "us" | "non_us";
}
interface Counts { matched: number; sendable: number; unsubscribed: number; excluded: number; uniqueEmails: number; }

const MONTHS = [
  { l: "1 mo", v: 1 }, { l: "2 mo", v: 2 }, { l: "3 mo", v: 3 },
  { l: "6 mo", v: 6 }, { l: "12 mo", v: 12 }, { l: "24 mo", v: 24 }, { l: "All time", v: null },
];
const PRESET_MONTHS = new Set([1, 2, 3, 6, 12, 24]);
const LOCATIONS = [
  { l: "Any", v: "any" }, { l: "US only", v: "us" }, { l: "Non-US", v: "non_us" },
] as const;
const SUBS = [
  { l: "Any", v: "any" }, { l: "Exclude unsubscribed", v: "exclude_unsub" }, { l: "Subscribed only", v: "subscribed_only" },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn(
      "rounded-[8px] border px-2.5 py-1 text-[12px] transition-colors",
      active ? "border-amethyst bg-amethyst/10 text-amethyst font-[540]" : "border-border text-muted-foreground hover:bg-muted/40"
    )}>{children}</button>
  );
}

export function ExportTab({ facets }: { facets: Facets }) {
  const [c, setC] = useState<Criteria>({ segments: [], systems: [], destination: "", monthsBack: 12, subscription: "exclude_unsub", minSpend: null, maxSpend: null, countryFilter: "any" });
  const [counts, setCounts] = useState<Counts | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [err, setErr] = useState("");

  const toggle = (key: "segments" | "systems", v: string) =>
    setC((p) => ({ ...p, [key]: p[key].includes(v) ? p[key].filter((x) => x !== v) : [...p[key], v] }));

  async function preview() {
    setPreviewing(true);
    try {
      const res = await mfetch("/api/marketing/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      const data = await res.json();
      setCounts(data.ok ? data.counts : null);
    } finally { setPreviewing(false); }
  }

  async function exportXlsx() {
    setExporting(true); setErr("");
    try {
      const res = await mfetch("/api/marketing/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(c) });
      if (!res.ok) { setErr("Export failed — try again."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `marketing-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-[15px]">Build a list</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[13px]">Product segments {c.segments.length === 0 && <span className="text-muted-foreground">(all)</span>}</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {facets.segments.map((s) => <Chip key={s} active={c.segments.includes(s)} onClick={() => toggle("segments", s)}>{s}</Chip>)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-[13px]">Destination</Label>
              <Input list="dest-list" value={c.destination} onChange={(e) => setC((p) => ({ ...p, destination: e.target.value }))} placeholder="e.g. Europe, Japan…" className="mt-1.5" />
              <datalist id="dest-list">{facets.destinations.map((d) => <option key={d} value={d} />)}</datalist>
            </div>
            <div>
              <Label className="text-[13px]">Customer location</Label>
              <div className="mt-1.5 flex gap-1.5">{LOCATIONS.map((l) => <Chip key={l.v} active={c.countryFilter === l.v} onClick={() => setC((p) => ({ ...p, countryFilter: l.v }))}>{l.l}</Chip>)}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">By storefront country (US/Non-US from the order’s system code).</p>
            </div>
          </div>

          <div>
            <Label className="text-[13px]">Purchased within</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {MONTHS.map((m) => <Chip key={m.l} active={c.monthsBack === m.v} onClick={() => setC((p) => ({ ...p, monthsBack: m.v }))}>{m.l}</Chip>)}
              <span className="mx-0.5 text-[12px] text-muted-foreground">or</span>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={c.monthsBack != null && !PRESET_MONTHS.has(c.monthsBack) ? String(c.monthsBack) : ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) { setC((p) => ({ ...p, monthsBack: null })); return; }
                  const n = Math.max(1, Math.floor(Number(raw)));
                  if (Number.isFinite(n)) setC((p) => ({ ...p, monthsBack: n }));
                }}
                placeholder="custom"
                className="h-7 w-[5.5rem] text-[12px]"
              />
              <span className="text-[12px] text-muted-foreground">months</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Snapshot holds ~24 months; larger values are capped by the last sync.</p>
          </div>

          <div>
            <Label className="text-[13px]">Subscription status</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{SUBS.map((s) => <Chip key={s.v} active={c.subscription === s.v} onClick={() => setC((p) => ({ ...p, subscription: s.v }))}>{s.l}</Chip>)}</div>
          </div>

          <div>
            <Label className="text-[13px]">Systems {c.systems.length === 0 && <span className="text-muted-foreground">(all)</span>}</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {facets.systems.slice(0, 24).map((s) => <Chip key={s} active={c.systems.includes(s)} onClick={() => toggle("systems", s)}>{s}</Chip>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><Label className="text-[13px]">Min spend USD</Label><Input type="number" value={c.minSpend ?? ""} onChange={(e) => setC((p) => ({ ...p, minSpend: e.target.value ? Number(e.target.value) : null }))} className="mt-1.5" placeholder="—" /></div>
            <div><Label className="text-[13px]">Max spend USD</Label><Input type="number" value={c.maxSpend ?? ""} onChange={(e) => setC((p) => ({ ...p, maxSpend: e.target.value ? Number(e.target.value) : null }))} className="mt-1.5" placeholder="—" /></div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={preview} disabled={previewing} className="gap-2">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview</Button>
            <Button onClick={exportXlsx} disabled={exporting} className="gap-2">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export .xlsx</Button>
          </div>
          {err && <p className="text-[13px] text-destructive">{err}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-[15px]">Preview</CardTitle></CardHeader>
        <CardContent>
          {!counts ? (
            <p className="text-[13px] text-muted-foreground">Set your filters and hit Preview to see how many customers match.</p>
          ) : (
            <div className="space-y-2 text-[13px]">
              <Row label="Sendable" value={counts.sendable} strong />
              <Row label="Unsubscribed (separate tab)" value={counts.unsubscribed} />
              <Row label="Excluded (separate tab)" value={counts.excluded} />
              <Row label="Unique customers" value={counts.uniqueEmails} />
              <div className="pt-2"><Badge variant="secondary">{counts.matched.toLocaleString()} total rows matched</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <BrevoExportCard />
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "text-[18px] font-[600]" : "font-[540]"}>{value.toLocaleString()}</span>
    </div>
  );
}

/* ── Canonical Noomi list (Brevo) — the FULL deduped contact base, not filtered ── */
function BrevoExportCard() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [summary, setSummary] = useState<BrevoSummary | null>(null);

  async function download() {
    setBusy(true); setErr("");
    try {
      const res = await mfetch("/api/marketing/export-brevo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!res.ok) { setErr("Export failed — try again."); return; }
      const sumHeader = res.headers.get("X-Brevo-Summary");
      if (sumHeader) { try { setSummary(JSON.parse(decodeURIComponent(sumHeader)) as BrevoSummary); } catch { /* ignore */ } }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `noomi-brevo-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { setErr("Export failed — try again."); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-[15px]">Canonical Noomi list (Brevo)</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          The full deduped contact base — purchasers + Omnisend prospects + unsubscribed — one row per email, in Brevo&apos;s
          import schema. This is the whole list; the filters above do <span className="font-[540]">not</span> apply, and
          exclusion-list contacts (internal/test domains, fraud names) are removed. Run an
          all-time <span className="font-[540]">Refresh</span> on the Overview tab first so lifetime spend and dates are complete.
        </p>
        <Button onClick={download} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Building… (~30s)" : "Download Noomi CSV"}
        </Button>
        {err && <p className="text-[13px] text-destructive">{err}</p>}
        {summary && (
          <div className="space-y-1.5 rounded-[8px] border border-border bg-muted/40 p-3 text-[12px]">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Total rows</span><span className="text-[14px] font-[600]">{summary.total.toLocaleString()}</span></div>
            <SummaryLine label="Purchasers / prospects" value={`${(summary.byContactType.purchaser || 0).toLocaleString()} / ${(summary.byContactType.prospect || 0).toLocaleString()}`} />
            <SummaryLine label="Subscribed / unsub / unknown" value={`${(summary.byMarketingStatus.subscribed || 0).toLocaleString()} / ${(summary.byMarketingStatus.unsubscribed || 0).toLocaleString()} / ${(summary.byMarketingStatus.unknown || 0).toLocaleString()}`} />
            <SummaryLine label="Source omnisend / opensearch / both" value={`${(summary.byLegacySource.omnisend || 0).toLocaleString()} / ${(summary.byLegacySource.opensearch || 0).toLocaleString()} / ${(summary.byLegacySource.both || 0).toLocaleString()}`} />
            <SummaryLine label="Country US / non-US / unknown" value={`${summary.country.us.toLocaleString()} / ${summary.country.nonUs.toLocaleString()} / ${summary.country.unknown.toLocaleString()}`} />
            {summary.droppedInvalidEmails > 0 && <SummaryLine label="Dropped invalid emails" value={summary.droppedInvalidEmails.toLocaleString()} />}
            {summary.droppedExcluded > 0 && <SummaryLine label="Dropped (exclusion list)" value={summary.droppedExcluded.toLocaleString()} />}
            <p className="pt-1 text-[11px] text-muted-foreground">Engagement columns (open / click / score) are blank — not in our Omnisend import.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-[540]">{value}</span>
    </div>
  );
}
