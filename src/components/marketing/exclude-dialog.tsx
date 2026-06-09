"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { mfetch } from "@/lib/marketing/client";
import { Loader2, UserX, AtSign, Globe } from "lucide-react";

type Mode = "name" | "email" | "domain";
interface Preview { words: { word: string; expansions: string[] }[]; count: number; sample: { email: string; name: string }[]; }

export function ExcludeDialog({
  open, onOpenChange, seed, onAdded,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  seed: { name?: string; email?: string };
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<Mode>("name");
  const [value, setValue] = useState("");
  const [variants, setVariants] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // (Re)seed each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const hasName = !!seed.name;
    setMode(hasName ? "name" : "email");
    setVariants(true);
    setErr("");
    setValue(hasName ? seed.name! : (seed.email ?? ""));
  }, [open, seed]);

  // When switching mode, reset the value to the relevant seed.
  function pickMode(m: Mode) {
    setMode(m);
    setErr("");
    if (m === "domain") setValue((seed.email?.split("@")[1]) ?? "");
    else if (m === "email") setValue(seed.email ?? "");
    else setValue(seed.name ?? "");
  }

  const refreshPreview = useCallback(async () => {
    const v = value.trim();
    if (!v) { setPreview(null); return; }
    setLoading(true);
    try {
      if (mode === "domain") {
        const r = await mfetch("/api/marketing/exclusions/impact", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domains: [v] }),
        }).then((x) => x.json());
        setPreview({ words: [], count: r.count ?? 0, sample: r.sample ?? [] });
      } else {
        const r = await mfetch("/api/marketing/exclusions/name-preview", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: v, variants: mode === "name" ? variants : false }),
        }).then((x) => x.json());
        setPreview({ words: r.words ?? [], count: r.count ?? 0, sample: r.sample ?? [] });
      }
    } finally { setLoading(false); }
  }, [value, variants, mode]);

  // Debounced preview.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(refreshPreview, 300);
    return () => clearTimeout(t);
  }, [open, refreshPreview]);

  async function save() {
    const v = value.trim();
    if (!v) return;
    setSaving(true); setErr("");
    try {
      let res;
      if (mode === "domain") {
        res = await mfetch("/api/marketing/exclusions/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: v }) });
      } else {
        // Name and exact-email rules both live in excluded_names; the matcher
        // treats an @-value as an exact email. Variants only apply to names.
        res = await mfetch("/api/marketing/exclusions/names", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: v, variants: mode === "name" ? variants : false }) });
      }
      const data = await res.json();
      if (!data.ok) { setErr(data.error || "Could not save"); return; }
      onAdded();
      onOpenChange(false);
    } finally { setSaving(false); }
  }

  const TABS: { m: Mode; label: string; icon: typeof UserX }[] = [
    { m: "name", label: "By name", icon: UserX },
    { m: "email", label: "Exact email", icon: AtSign },
    { m: "domain", label: "Domain", icon: Globe },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add exclusion</DialogTitle>
          <DialogDescription>Excluded customers are moved to the Excluded tab on every export.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-1.5">
            {TABS.map((t) => (
              <button key={t.m} onClick={() => pickMode(t.m)} className={cn(
                "flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-[13px] transition-colors",
                mode === t.m ? "border-amethyst bg-amethyst/10 text-amethyst font-[540]" : "border-border text-muted-foreground hover:bg-muted/40",
              )}>
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          <div>
            <Label className="text-[13px]">
              {mode === "name" ? "Name" : mode === "email" ? "Email address" : "Domain"}
            </Label>
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="mt-1.5"
              placeholder={mode === "name" ? "Wallace Davis" : mode === "email" ? "person@example.com" : "example.com"} />
          </div>

          {mode === "name" && (
            <div className="flex items-center gap-2">
              <Switch id="excl-variants" checked={variants} onCheckedChange={setVariants} />
              <Label htmlFor="excl-variants" className="text-[13px]">Match name variants (Alex ↔ Alexander, any order)</Label>
            </div>
          )}

          {/* Preview */}
          <div className="rounded-[8px] border border-border bg-muted/30 p-3 text-[13px]">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</div>
            ) : !value.trim() ? (
              <span className="text-muted-foreground">Enter a value to preview what it excludes.</span>
            ) : (
              <div className="space-y-2">
                {mode === "name" && variants && preview?.words?.some((w) => w.expansions.length > 0) && (
                  <div className="space-y-1">
                    <div className="text-[12px] text-muted-foreground">Variants matched:</div>
                    {preview.words.filter((w) => w.expansions.length).map((w) => (
                      <div key={w.word} className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary" className="text-[11px]">{w.word}</Badge>
                        <span className="text-muted-foreground">→</span>
                        {w.expansions.map((v) => <Badge key={v} variant="outline" className="text-[11px]">{v}</Badge>)}
                      </div>
                    ))}
                  </div>
                )}
                <div className="font-[540]">
                  Excludes {preview?.count?.toLocaleString() ?? 0} current customer{preview?.count === 1 ? "" : "s"}.
                </div>
                {!!preview?.sample?.length && (
                  <div className="max-h-32 overflow-y-auto rounded-[8px] border border-border bg-background">
                    {preview.sample.map((s) => (
                      <div key={s.email} className="flex justify-between gap-3 px-2 py-1 text-[12px] border-b border-border/50 last:border-0">
                        <span className="truncate">{s.name || <span className="text-muted-foreground">(no name)</span>}</span>
                        <span className="truncate font-mono text-muted-foreground">{s.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {err && <p className="text-[13px] text-destructive">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || !value.trim()} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Add exclusion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
