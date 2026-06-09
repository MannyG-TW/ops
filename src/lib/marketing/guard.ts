/**
 * Access guard for the marketing console API.
 *
 * Matches the app's existing soft-auth model (see tellisim send-sms/suspend
 * routes): the client asserts its role; the server enforces the permission.
 * Role arrives in the `x-ops-role` header (set by the marketing client's
 * mfetch wrapper). This is internal-tool trust, not hardened auth — it keeps
 * agents/viewers out of the console, consistent with the rest of the app.
 */

import { NextResponse } from "next/server";
import { hasPermission, type UserRole } from "@/lib/roles";

/** Returns a 403 NextResponse if the request lacks marketing access, else null. */
export function marketingForbidden(req: Request): NextResponse | null {
  const role = (req.headers.get("x-ops-role") || "agent") as UserRole;
  if (!hasPermission(role, "marketing:read")) {
    return NextResponse.json(
      { ok: false, error: "Forbidden: marketing access requires supervisor or admin" },
      { status: 403 },
    );
  }
  return null;
}
