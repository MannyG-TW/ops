"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  ShieldAlert,
  Barcode,
  BookOpen,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  LogOut,
  AlertTriangle,
  Megaphone,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getRoleFromTeamMember } from "@/lib/roles";
import { TEAM_MEMBERS } from "@/components/ui/internal-notes";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search, alsoMatchPaths: ["/customers"] },
  { href: "/fraud", label: "Fraud Watch", icon: ShieldAlert },
  { href: "/analyzer", label: "Analyzer", icon: Barcode },
  { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpen },
];

const supervisorItems = [
  { href: "/escalations", label: "Escalations", icon: AlertTriangle },
  { href: "/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/marketing", label: "Marketing", icon: Send },
];

const adminItems = [
  { href: "/admin/users", label: "User Management", icon: UserCog },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string>("agent");
  const [escalationCount, setEscalationCount] = useState(0);

  useEffect(() => {
    const email = localStorage.getItem("travelwifi_ops_user_email");
    if (email) {
      const member = TEAM_MEMBERS.find((m) => m.email === email);
      if (member) {
        setRole(getRoleFromTeamMember(member.role));
        return;
      }
    }
    setRole("agent");
  }, []);

  // Fetch new escalation count for badge
  useEffect(() => {
    if (role !== "supervisor" && role !== "admin") return;
    function fetchCount() {
      fetch("/api/escalations")
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.counts) setEscalationCount(data.counts["new"] ?? 0);
        })
        .catch(() => {});
    }
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [role]);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[240px]"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-mysteria">
            <span className="text-sm font-bold text-white">T</span>
          </div>
          {!collapsed && (
            <span className="text-[16px] text-ui-semi text-sidebar-foreground truncate">
              TravelWifi Ops
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href) || (item.alsoMatchPaths?.some((p) => pathname.startsWith(p)) ?? false);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-[460] transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary font-[600]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Supervisor Section — visible to supervisor + admin */}
        {(role === "supervisor" || role === "admin") && (
          <div className="mt-6">
            {!collapsed && (
              <p className="mb-2 px-3 text-[12px] font-[700] uppercase tracking-wider text-muted-foreground/60">
                Supervisor
              </p>
            )}
            <ul className="space-y-1">
              {supervisorItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-[460] transition-colors duration-150",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary font-[600]"
                          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                      {!collapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {!collapsed && escalationCount > 0 && item.href === "/escalations" && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white px-1">
                          {escalationCount > 99 ? "99+" : escalationCount}
                        </span>
                      )}
                      {collapsed && escalationCount > 0 && item.href === "/escalations" && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white px-0.5">
                          {escalationCount > 9 ? "9+" : escalationCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Admin Section */}
        <div className="mt-6">
          {!collapsed && (
            <p className="mb-2 px-3 text-[12px] font-[700] uppercase tracking-wider text-muted-foreground/60">
              Admin
            </p>
          )}
          <ul className="space-y-1">
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-[460] transition-colors duration-150",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-primary font-[600]"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-[460] text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          ) : (
            <>
              <ChevronLeft className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span>Collapse</span>
            </>
          )}
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("travelwifi_ops_user_email");
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 text-[14px] font-[460] text-sidebar-foreground/60 transition-colors duration-150 hover:bg-sidebar-accent hover:text-destructive cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
