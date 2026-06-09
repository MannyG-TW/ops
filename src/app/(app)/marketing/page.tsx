"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OverviewTab, type SyncState } from "@/components/marketing/overview-tab";
import { SearchTab } from "@/components/marketing/search-tab";
import { ExclusionsTab } from "@/components/marketing/exclusions-tab";
import { ExportTab, type Facets } from "@/components/marketing/export-tab";
import { mfetch, canUseMarketing } from "@/lib/marketing/client";
import { Send, Lock } from "lucide-react";

export default function MarketingPage() {
  const [facets, setFacets] = useState<Facets>({ segments: [], systems: [], destinations: [] });
  const [state, setState] = useState<SyncState | null>(null);
  const [allowed, setAllowed] = useState(true);

  const load = useCallback(async () => {
    const res = await mfetch("/api/marketing/facets");
    const data = await res.json();
    if (data.ok) { setFacets(data.facets); setState(data.state); }
  }, []);

  useEffect(() => { setAllowed(canUseMarketing()); load(); }, [load]);

  const synced = (state?.osSegmentRows ?? 0) > 0;

  if (!allowed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed border-border p-12 text-center">
        <Lock className="h-7 w-7 text-muted-foreground/50" strokeWidth={1.6} />
        <p className="text-[15px] font-[540]">Marketing is restricted</p>
        <p className="text-[13px] text-muted-foreground">This console is available to supervisors and admins only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-mysteria/10">
          <Send className="h-5 w-5 text-mysteria" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-[600] leading-tight">Marketing</h1>
          <p className="text-[13px] text-muted-foreground">Segment customers, manage exclusions, and build campaign exports from the local snapshot.</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="search">Customer Search</TabsTrigger>
          <TabsTrigger value="exclusions">Exclusions</TabsTrigger>
          <TabsTrigger value="export">Export Builder</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab state={state} onChanged={load} />
        </TabsContent>
        <TabsContent value="search" className="mt-4">
          {synced ? <SearchTab onExclusionAdded={load} /> : <NeedSync />}
        </TabsContent>
        <TabsContent value="exclusions" className="mt-4">
          <ExclusionsTab onChanged={load} />
        </TabsContent>
        <TabsContent value="export" className="mt-4">
          {synced ? <ExportTab facets={facets} /> : <NeedSync />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NeedSync() {
  return (
    <div className="rounded-[8px] border border-dashed border-border p-8 text-center text-[13px] text-muted-foreground">
      No local data yet. Go to <span className="font-[540] text-foreground">Overview</span> and click <span className="font-[540] text-foreground">Refresh data</span> to sync from OpenSearch first.
    </div>
  );
}
