"use client";

import { useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { seedCatalogIfEmpty } from "@/lib/catalog-seed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => { seedCatalogIfEmpty(); }, []);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col ml-[240px] transition-all duration-200">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
