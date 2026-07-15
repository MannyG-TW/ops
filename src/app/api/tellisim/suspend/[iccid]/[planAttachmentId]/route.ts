import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { suspendPlanAttachment } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";
import { hasPermission } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

/**
 * Suspend a plan attachment (NON-REVERSIBLE).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string; planAttachmentId: string }> }
) {
  try {
    const { iccid, planAttachmentId } = await params;
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);
    const role = body.role;

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const userRole: UserRole = role || "agent";
    if (!hasPermission(userRole, "tellisim:suspend")) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: insufficient permissions to suspend plan attachments" },
        { status: 403 }
      );
    }

    const data = await suspendPlanAttachment(credentials, iccid, planAttachmentId);

    return NextResponse.json({
      ok: true,
      result: data?.data ?? data,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
