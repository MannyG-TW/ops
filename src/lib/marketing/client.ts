"use client";

/**
 * Client helpers for the marketing console. `mfetch` is a thin fetch wrapper
 * that attaches the current user's role as `x-ops-role`, which the API routes
 * enforce via marketingForbidden(). Mirrors how the rest of the app asserts
 * role client-side.
 */

import { TEAM_MEMBERS } from "@/components/ui/internal-notes";
import { getRoleFromTeamMember, type UserRole } from "@/lib/roles";

export function currentOpsRole(): UserRole {
  if (typeof window === "undefined") return "agent";
  try {
    const email = localStorage.getItem("travelwifi_ops_user_email");
    const member = TEAM_MEMBERS.find((m) => m.email === email);
    return getRoleFromTeamMember(member?.role);
  } catch {
    return "agent";
  }
}

export function canUseMarketing(): boolean {
  const r = currentOpsRole();
  return r === "supervisor" || r === "admin";
}

export function mfetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set("x-ops-role", currentOpsRole());
  return fetch(input, { ...init, headers });
}
