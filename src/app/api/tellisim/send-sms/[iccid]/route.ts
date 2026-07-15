import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { sendSMS } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";
import { hasPermission } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

/**
 * Send SMS to a subscription.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);
    const { role, from, message } = body;

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
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
    return sanitizeError(err, "TelliSIM");
  }
}
