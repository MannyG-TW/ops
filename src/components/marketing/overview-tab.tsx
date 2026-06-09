"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, Database, Users, CheckCircle2 } from "lucide-react";
import { mfetch } from "@/lib/marketing/client";

export interface SyncState {
  osSyncedAt: number | null;
  osSegmentRows: number;
  osCustomers: number;
  omnisendImportedAt: number | null;
  omnisendContacts: number;
}

function fmt(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleString();
}

export function OverviewTab({ state, onChanged }: { state: SyncState | null; onChanged: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function runSync() {
    setSyncing(true); setMsg("");
    try {
      const res = await mfetch("/api/marketing/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ months: 24 }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMsg(`Synced ${data.segmentRows.toLocaleString()} segment rows for ${data.customers.toLocaleString()} customers.`);
      onChanged();
    } catch (e) {
      setMsg(`Sync failed: ${e instanceof Error ? e.message : "error"}`);
    } finally { setSyncing(false); }
  }

  async function importCsv(file: File) {
    setImporting(true); setMsg("");
    try {
      const res = await mfetch("/api/marketing/import-omnisend", { method: "POST", headers: { "Content-Type": "text/csv" }, body: file });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setMsg(`Imported ${data.contacts.toLocaleString()} Omnisend contacts.`);
      onChanged();
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : "error"}`);
    } finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]"><Database className="h-4 w-4 text-amethyst" /> OpenSearch purchases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-[13px] text-muted-foreground">Last synced: <span className="font-[540] text-foreground">{fmt(state?.osSyncedAt ?? null)}</span></div>
            <div className="flex gap-6 text-[13px]">
              <div><div className="text-[22px] font-[600]">{(state?.osCustomers ?? 0).toLocaleString()}</div><div className="text-muted-foreground">customers</div></div>
              <div><div className="text-[22px] font-[600]">{(state?.osSegmentRows ?? 0).toLocaleString()}</div><div className="text-muted-foreground">segment rows</div></div>
            </div>
            <Button onClick={runSync} disabled={syncing} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing… (~60s)" : "Refresh data"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[15px]"><Users className="h-4 w-4 text-amethyst" /> Omnisend contacts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-[13px] text-muted-foreground">Last imported: <span className="font-[540] text-foreground">{fmt(state?.omnisendImportedAt ?? null)}</span></div>
            <div className="text-[13px]"><div className="text-[22px] font-[600]">{(state?.omnisendContacts ?? 0).toLocaleString()}</div><div className="text-muted-foreground">contacts (consent/status)</div></div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); }} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing} className="gap-2">
              <Upload className={`h-4 w-4 ${importing ? "animate-pulse" : ""}`} /> {importing ? "Importing…" : "Import Omnisend CSV"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-[8px] border border-border bg-muted/40 px-3 py-2 text-[13px]">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {msg}
        </div>
      )}
      <p className="text-[12px] text-muted-foreground">
        The console reads only this local snapshot — OpenSearch is touched solely during a refresh. Data is as fresh as the timestamps above.
      </p>
    </div>
  );
}
