"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, UserX, Ban, Loader2 } from "lucide-react";
import { mfetch } from "@/lib/marketing/client";

interface Hit {
  email: string; name: string; phone: string; system: string;
  segments: string[]; orders: number; totalSpentUsd: number; lastPurchase: string;
  destinations: string; inOmnisend: boolean; emailStatus: string; excludedReason: string;
}

export function SearchTab({ onExclusionAdded }: { onExclusionAdded: () => void }) {
  const [q, setQ] = useState("");
  const [variants, setVariants] = useState(true);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  async function run() {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await mfetch(`/api/marketing/customers?q=${encodeURIComponent(q)}&variants=${variants}`);
      const data = await res.json();
      setHits(data.ok ? data.results : []);
    } finally { setLoading(false); }
  }

  async function excludeName(name: string) {
    if (!name || !confirm(`Exclude everyone matching the name "${name}" from marketing exports?`)) return;
    await mfetch("/api/marketing/exclusions/names", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    onExclusionAdded();
    run();
  }
  async function excludeDomain(email: string) {
    const domain = email.split("@")[1];
    if (!domain || !confirm(`Exclude the entire domain "${domain}"?`)) return;
    await mfetch("/api/marketing/exclusions/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
    onExclusionAdded();
    run();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Search by name (e.g. Davis, Alex) or email…" className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="variants" checked={variants} onCheckedChange={setVariants} />
          <Label htmlFor="variants" className="text-[13px]">Match variants (Alex → Alexander)</Label>
        </div>
        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
        </Button>
      </div>

      {hits && (
        <div className="text-[13px] text-muted-foreground">{hits.length} customer{hits.length === 1 ? "" : "s"} matched{hits.length >= 200 ? " (showing first 200)" : ""}.</div>
      )}

      {hits && hits.length > 0 && (
        <div className="overflow-x-auto rounded-[8px] border border-border">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-[540]">Name</th>
                <th className="px-3 py-2 font-[540]">Email</th>
                <th className="px-3 py-2 font-[540]">Segments</th>
                <th className="px-3 py-2 font-[540]">Last buy</th>
                <th className="px-3 py-2 font-[540]">Spent</th>
                <th className="px-3 py-2 font-[540]">Status</th>
                <th className="px-3 py-2 font-[540]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((h) => (
                <tr key={h.email} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2">{h.name || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">{h.email}</td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{h.segments.map((s) => <Badge key={s} variant="secondary" className="text-[11px]">{s}</Badge>)}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{h.lastPurchase || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">${h.totalSpentUsd.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {h.excludedReason
                      ? <Badge variant="destructive" className="text-[11px]">excluded</Badge>
                      : <span className={h.emailStatus === "Subscribed" ? "text-emerald-600" : h.emailStatus === "Unsubscribed" ? "text-destructive" : "text-muted-foreground"}>{h.emailStatus}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]" onClick={() => excludeName(h.name)} disabled={!h.name}>
                        <UserX className="h-3.5 w-3.5" /> name
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[12px]" onClick={() => excludeDomain(h.email)}>
                        <Ban className="h-3.5 w-3.5" /> domain
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
