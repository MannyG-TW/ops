"use client";

import { Search, Sun, Moon, Bell, Check, CheckCheck, AtSign, AlertTriangle, ClipboardList, Info } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { TEAM_MEMBERS, type TeamMember } from "@/components/ui/internal-notes";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  actorName: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof AtSign> = {
  mention: AtSign,
  escalation: AlertTriangle,
  task_assignment: ClipboardList,
  system: Info,
};

const TYPE_COLORS: Record<string, string> = {
  mention: "text-amethyst bg-amethyst/10",
  escalation: "text-destructive bg-destructive/10",
  task_assignment: "text-lavender bg-lavender/20",
  system: "text-muted-foreground bg-muted",
};

export function Topbar() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [user, setUser] = useState<TeamMember | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setSearchQuery("");
    searchInputRef.current?.blur();
  }, [searchQuery, router]);

  // Fetch notifications
  const fetchNotifications = useCallback((userId: string) => {
    fetch(`/api/notifications?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const email = localStorage.getItem("travelwifi_ops_user_email");
    if (email) {
      const found = TEAM_MEMBERS.find((m) => m.email === email);
      if (found) {
        setUser(found);
        fetchNotifications(found.id);
        // Poll every 30s
        const interval = setInterval(() => fetchNotifications(found.id), 30000);
        return () => clearInterval(interval);
      }
    }
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const markAllRead = useCallback(() => {
    if (!user) return;
    fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, markAll: true }),
    }).then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    });
  }, [user]);

  const markOneRead = useCallback((notifId: string) => {
    if (!user) return;
    fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, notificationIds: [notifId] }),
    }).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    });
  }, [user]);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "/") return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 backdrop-blur-sm px-6">
      {/* Global Search */}
      <div className="flex-1 max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className={cn(
            "flex items-center gap-2 rounded-[8px] border px-3 py-2 transition-all duration-200",
            searchFocused
              ? "border-lavender bg-background shadow-sm"
              : "border-border bg-muted/50"
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by Order ID, IMEI, Serial, ICCID, Phone, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-transparent text-[14px] font-[460] text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded-[8px] border border-border bg-muted px-1.5 text-[11px] font-[500] text-muted-foreground">
            /
          </kbd>
        </form>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground cursor-pointer"
          >
            <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 rounded-[16px] border border-border bg-popover shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-[13px] font-[600] text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] font-[540] text-amethyst hover:text-amethyst/80 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="h-3 w-3" strokeWidth={2} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="text-[12px] font-[460] text-muted-foreground text-center py-8">
                    No notifications
                  </p>
                )}
                {notifications.map((notif) => {
                  const Icon = TYPE_ICONS[notif.type] ?? Info;
                  const colorClass = TYPE_COLORS[notif.type] ?? TYPE_COLORS.system;
                  const isUnread = !notif.readAt;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => {
                        if (isUnread) markOneRead(notif.id);
                        if (notif.link) {
                          router.push(notif.link);
                          setNotifOpen(false);
                        }
                      }}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 border-b border-border/50 last:border-0",
                        isUnread && "bg-amethyst/[0.03]"
                      )}
                    >
                      <div className={cn("flex-shrink-0 mt-0.5 p-1.5 rounded-[8px]", colorClass)}>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("text-[12px] font-[540] truncate", isUnread ? "text-foreground" : "text-muted-foreground")}>
                            {notif.title}
                          </span>
                          {isUnread && (
                            <span className="flex-shrink-0 h-1.5 w-1.5 rounded-full bg-amethyst" />
                          )}
                        </div>
                        {notif.actorName && (
                          <p className="text-[11px] font-[460] text-muted-foreground mt-0.5">
                            by {notif.actorName}
                          </p>
                        )}
                        <p className="text-[11px] font-[460] text-muted-foreground/70 mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                        <span className="text-[10px] font-[460] text-muted-foreground/50 mt-1 block">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-[8px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground cursor-pointer"
        >
          {darkMode ? (
            <Sun className="h-[18px] w-[18px]" strokeWidth={1.8} />
          ) : (
            <Moon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          )}
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender">
            <span className="text-[12px] font-[700] text-mysteria">{user?.initials ?? "??"}</span>
          </div>
          <div className="hidden md:block">
            <p className="text-[13px] font-[600] text-foreground leading-tight">{user?.name ?? "Guest"}</p>
            <p className="text-[11px] font-[460] text-muted-foreground leading-tight capitalize">{user?.role ?? "—"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
