"use client";

import { useState, useEffect } from "react";
import { Megaphone, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  authorName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    function fetchBroadcasts() {
      fetch("/api/broadcasts?active=true")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setBroadcasts(data.broadcasts);
        })
        .catch(() => {});
    }
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 30000);
    return () => clearInterval(interval);
  }, []);

  const visible = broadcasts.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  return (
    <div className="border-b border-amber-300/40 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-700/30">
      {visible.map((b) => (
        <div
          key={b.id}
          className={cn(
            "flex items-start gap-3 px-6 py-2.5",
            visible.length > 1 && "border-b border-amber-200/50 dark:border-amber-800/30 last:border-0"
          )}
        >
          <Megaphone className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-[600] text-amber-900 dark:text-amber-200">
                {b.title}
              </span>
              <span className="text-[11px] font-[460] text-amber-700/70 dark:text-amber-400/60">
                {b.authorName} &middot; {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
              </span>
            </div>
            <p className="text-[13px] font-[460] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
              {b.message}
            </p>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set(prev).add(b.id))}
            className="shrink-0 mt-0.5 p-1 rounded-[8px] text-amber-500/60 hover:text-amber-700 hover:bg-amber-200/40 dark:hover:bg-amber-800/30 transition-colors cursor-pointer"
            title="Dismiss (shows again on refresh)"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
