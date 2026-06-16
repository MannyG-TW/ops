"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { getRoleFromTeamMember } from "@/lib/roles";
import { TEAM_MEMBERS } from "@/components/ui/internal-notes";

interface Broadcast {
  id: string;
  title: string;
  message: string;
  authorId: string;
  authorName: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  updatedAt: string | null;
}

type BroadcastStatus = "active" | "scheduled" | "expired";

function getBroadcastStatus(b: Broadcast): BroadcastStatus {
  const now = new Date();
  const start = new Date(b.startsAt);
  const end = new Date(b.endsAt);
  if (isPast(end)) return "expired";
  if (isFuture(start)) return "scheduled";
  return "active";
}

const STATUS_STYLE: Record<BroadcastStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  expired: {
    label: "Expired",
    className: "bg-muted text-muted-foreground",
  },
};

function toLocalDatetimeValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function BroadcastsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Broadcast | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formEndsAt, setFormEndsAt] = useState("");

  // Auth gate
  useEffect(() => {
    const email = localStorage.getItem("travelwifi_ops_user_email");
    if (email) {
      const member = TEAM_MEMBERS.find((m) => m.email === email);
      if (member) {
        const effectiveRole = getRoleFromTeamMember(member.role);
        if (effectiveRole === "supervisor" || effectiveRole === "admin") {
          setAuthorized(true);
          return;
        }
      }
    }
    router.push("/dashboard");
  }, [router]);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const res = await fetch("/api/broadcasts?active=false");
      const data = await res.json();
      if (data.ok) setBroadcasts(data.broadcasts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) fetchBroadcasts();
  }, [authorized, fetchBroadcasts]);

  function getCurrentUser() {
    const email = localStorage.getItem("travelwifi_ops_user_email") || "";
    const member = TEAM_MEMBERS.find((m) => m.email === email);
    return { id: member?.id || email, name: member?.name || email };
  }

  function openCreate() {
    setEditing(null);
    setFormTitle("");
    setFormMessage("");
    // Default: starts now, ends in 24h
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    setFormStartsAt(toLocalDatetimeValue(now.toISOString()));
    setFormEndsAt(toLocalDatetimeValue(tomorrow.toISOString()));
    setError("");
    setShowForm(true);
  }

  function openEdit(b: Broadcast) {
    setEditing(b);
    setFormTitle(b.title);
    setFormMessage(b.message);
    setFormStartsAt(toLocalDatetimeValue(b.startsAt));
    setFormEndsAt(toLocalDatetimeValue(b.endsAt));
    setError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setError("");
  }

  async function handleSave() {
    if (!formTitle.trim() || !formMessage.trim()) {
      setError("Title and message are required");
      return;
    }
    if (!formStartsAt || !formEndsAt) {
      setError("Start and end times are required");
      return;
    }

    const start = new Date(formStartsAt);
    const end = new Date(formEndsAt);
    if (end <= start) {
      setError("End time must be after start time");
      return;
    }

    setSaving(true);
    setError("");
    const user = getCurrentUser();

    try {
      if (editing) {
        const res = await fetch("/api/broadcasts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editing.id,
            title: formTitle.trim(),
            message: formMessage.trim(),
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Failed to update");
          return;
        }
      } else {
        const res = await fetch("/api/broadcasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formTitle.trim(),
            message: formMessage.trim(),
            authorId: user.id,
            authorName: user.name,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          setError(data.error || "Failed to create");
          return;
        }
      }

      closeForm();
      fetchBroadcasts();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/broadcasts?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) fetchBroadcasts();
    } catch {
      // silent
    } finally {
      setDeleting(null);
    }
  }

  if (!authorized) return null;

  // Sort: active first, then scheduled, then expired
  const sorted = [...broadcasts].sort((a, b) => {
    const order: Record<BroadcastStatus, number> = { active: 0, scheduled: 1, expired: 2 };
    const diff = order[getBroadcastStatus(a)] - order[getBroadcastStatus(b)];
    if (diff !== 0) return diff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/60 bg-card/50">
        <div className="mx-auto max-w-[1440px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="h-5 w-5 text-amethyst" strokeWidth={1.8} />
              <div>
                <h1 className="text-xl text-charcoal" style={{ fontWeight: 540 }}>
                  Broadcast Messages
                </h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Messages visible to all agents across every screen
                </p>
              </div>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-[8px] bg-warm-cream px-4 py-2.5 text-[13px] font-[540] text-charcoal transition-colors hover:bg-warm-cream/80 cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={1.8} />
              New Broadcast
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-lavender" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground/20 mb-3" strokeWidth={1.5} />
            <p className="text-[14px] font-[540] text-muted-foreground">No broadcasts yet</p>
            <p className="text-[12px] font-[460] text-muted-foreground/60 mt-1">
              Create one to notify all agents
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((b) => {
              const status = getBroadcastStatus(b);
              const style = STATUS_STYLE[status];

              return (
                <div
                  key={b.id}
                  className={cn(
                    "rounded-[16px] border border-border p-5 transition-shadow hover:shadow-md",
                    status === "active" && "ring-1 ring-emerald-300/40 dark:ring-emerald-700/30",
                    status === "expired" && "opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[15px] font-[600] text-foreground">{b.title}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] font-[600] px-1.5 py-0 border-0", style.className)}
                        >
                          {style.label}
                        </Badge>
                      </div>
                      <p className="text-[13px] font-[460] text-muted-foreground leading-relaxed">
                        {b.message}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <span className="flex items-center gap-1.5 text-[11px] font-[460] text-muted-foreground/70">
                          <Megaphone className="h-3 w-3" strokeWidth={1.8} />
                          {b.authorName}
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-[460] text-muted-foreground/70">
                          <Clock className="h-3 w-3" strokeWidth={1.8} />
                          {format(new Date(b.startsAt), "MMM d, h:mm a")} — {format(new Date(b.endsAt), "MMM d, h:mm a")}
                        </span>
                        <span className="text-[11px] font-[460] text-muted-foreground/50">
                          Created {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(b)}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deleting === b.id}
                        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-40 cursor-pointer"
                        title="Delete"
                      >
                        {deleting === b.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create/Edit Modal ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative z-10 w-full max-w-lg rounded-[16px] border border-border bg-background shadow-xl mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-[16px] font-[600] text-foreground">
                {editing ? "Edit Broadcast" : "New Broadcast"}
              </h2>
              <button
                onClick={closeForm}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-[8px] bg-destructive/10 px-3 py-2 text-[12px] font-[460] text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-[600] text-foreground mb-1.5">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. SLA Update"
                  className="w-full rounded-[8px] border border-border bg-muted/30 px-3 py-2 text-[13px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30"
                />
              </div>

              <div>
                <label className="block text-[12px] font-[600] text-foreground mb-1.5">Message</label>
                <textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Message visible to all agents..."
                  rows={4}
                  className="w-full rounded-[8px] border border-border bg-muted/30 px-3 py-2 text-[13px] font-[460] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-[600] text-foreground mb-1.5">Starts At</label>
                  <input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    className="w-full rounded-[8px] border border-border bg-muted/30 px-3 py-2 text-[13px] font-[460] text-foreground outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-[600] text-foreground mb-1.5">Ends At</label>
                  <input
                    type="datetime-local"
                    value={formEndsAt}
                    onChange={(e) => setFormEndsAt(e.target.value)}
                    className="w-full rounded-[8px] border border-border bg-muted/30 px-3 py-2 text-[13px] font-[460] text-foreground outline-none focus:border-lavender focus:ring-1 focus:ring-lavender/30"
                  />
                </div>
              </div>

              <div className="rounded-[8px] bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30 px-3 py-2">
                <p className="text-[11px] font-[460] text-amber-700 dark:text-amber-400">
                  This message will appear as a banner on every screen for all agents during the scheduled time window. Useful for shift handoffs and urgent notices.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              <button
                onClick={closeForm}
                className="rounded-[8px] px-4 py-2 text-[13px] font-[540] text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-[8px] bg-mysteria text-white px-4 py-2 text-[13px] font-[540] transition-colors hover:bg-mysteria/90 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                )}
                {editing ? "Save Changes" : "Create Broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
