import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { getSubscriptionLocation } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Get subscription location for an ICCID.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const data = await getSubscriptionLocation(credentials, iccid);

    return NextResponse.json({
      ok: true,
      location: data?.data ?? data,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
