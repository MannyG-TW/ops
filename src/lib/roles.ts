/**
 * Role-based access control for TravelWifi Ops.
 */

export type UserRole = "agent" | "supervisor" | "admin";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  agent: [
    "tellisim:read",
    "opensearch:read",
  ],
  supervisor: [
    "tellisim:read",
    "tellisim:suspend",
    "tellisim:send-sms",
    "opensearch:read",
  ],
  admin: [
    "tellisim:read",
    "tellisim:suspend",
    "tellisim:send-sms",
    "tellisim:write",
    "opensearch:read",
    "opensearch:write",
    "settings:write",
  ],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Get the current user role from localStorage settings.
 * Defaults to "agent" if not set.
 */
export function getCurrentRole(): UserRole {
  if (typeof window === "undefined") return "agent";
  try {
    const stored = localStorage.getItem("travelwifi_ops_settings");
    if (stored) {
      const settings = JSON.parse(stored);
      const role = settings.role as UserRole;
      if (role && ROLE_PERMISSIONS[role]) return role;
    }
  } catch {
    // ignore
  }
  return "agent";
}
