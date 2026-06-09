"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShieldAlert } from "lucide-react";
import { mfetch } from "@/lib/marketing/client";

interface Domain { id: string; domain: string; note?: string | null; }
interface Name { id: string; name: string; note?: string | null; }

export function ExclusionsTab({ onChanged }: { onChanged: () => void }) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [names, setNames] = useState<Name[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newName, setNewName] = useState("");
  const [impact, setImpact] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [d, n] = await Promise.all([
      mfetch("/api/marketing/exclusions/domains").then((r) => r.json()),
      mfetch("/api/marketing/exclusions/names").then((r) => r.json()),
    ]);
    const ds: Domain[] = d.ok ? d.domains : [];
    const ns: Name[] = n.ok ? n.names : [];
    setDomains(ds); setNames(ns);
    const imp = await mfetch("/api/marketing/exclusions/impact", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domains: ds.map((x) => x.domain), names: ns.map((x) => x.name) }),
    }).then((r) => r.json());
    setImpact(imp.ok ? imp.count : null);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addDomain() {
    const v = newDomain.trim();
    if (!v) return;
    const res = await mfetch("/api/marketing/exclusions/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: v }) });
    const data = await res.json();
    if (!data.ok) { alert(data.error); return; }
    setNewDomain(""); await load(); onChanged();
  }
  async function addName() {
    const v = newName.trim();
    if (!v) return;
    await mfetch("/api/marketing/exclusions/names", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: v }) });
    setNewName(""); await load(); onChanged();
  }
  async function delDomain(id: string) { await mfetch(`/api/marketing/exclusions/domains?id=${id}`, { method: "DELETE" }); await load(); onChanged(); }
  async function delName(id: string) { await mfetch(`/api/marketing/exclusions/names?id=${id}`, { method: "DELETE" }); await load(); onChanged(); }

  return (
    <div className="space-y-4">
      {impact != null && (
        <div className="flex items-center gap-2 rounded-[8px] border border-border bg-muted/40 px-3 py-2 text-[13px]">
          <ShieldAlert className="h-4 w-4 text-amber-500" />
          These rules currently exclude <span className="font-[600]">{impact.toLocaleString()}</span> customer{impact === 1 ? "" : "s"} from the snapshot.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px]">Excluded domains ({domains.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDomain()} placeholder="example.com" />
              <Button onClick={addDomain} className="gap-1 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <ul className="space-y-1">
              {domains.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-[8px] border border-border px-3 py-1.5 text-[13px]">
                  <span className="font-mono">{d.domain}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => delDomain(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
              {!domains.length && <li className="text-[13px] text-muted-foreground">None yet.</li>}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-[15px]">Excluded names ({names.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addName()} placeholder="Wallace Davis" />
              <Button onClick={addName} className="gap-1 shrink-0"><Plus className="h-4 w-4" /> Add</Button>
            </div>
            <ul className="space-y-1">
              {names.map((n) => (
                <li key={n.id} className="flex items-center justify-between rounded-[8px] border border-border px-3 py-1.5 text-[13px]">
                  <span>{n.name} <Badge variant="secondary" className="ml-1 text-[10px]">+ variants</Badge></span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => delName(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
              {!names.length && <li className="text-[13px] text-muted-foreground">None yet.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Names match loosely: all words must appear in a customer&apos;s name or email handle, with nickname variants (Alex ↔ Alexander) and order-insensitive. Excluded customers are moved to the Excluded tab of every export.
      </p>
    </div>
  );
}
