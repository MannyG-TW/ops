import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/tellisim-client";
import { hasPermission } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

/**
 * Send SMS to a subscription.
 * POST body: { credentials: { baseUrl, apiKey }, role: UserRole, from: string, message: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const { credentials, role, from, message } = await req.json();

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "API credentials required" },
        { status: 400 }
      );
    }

    const userRole: UserRole = role || "agent";
    if (!hasPermission(userRole, "tellisim:send-sms")) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: insufficient permissions to send SMS" },
        { status: 403 }
      );
    }

    if (!from || !message) {
      return NextResponse.json(
        { ok: false, error: "Both 'from' and 'message' fields are required" },
        { status: 400 }
      );
    }

    const data = await sendSMS(credentials, iccid, from, message);

    return NextResponse.json({
      ok: true,
      result: data?.data ?? data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
