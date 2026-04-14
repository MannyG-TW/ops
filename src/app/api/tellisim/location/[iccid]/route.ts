import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionLocation } from "@/lib/tellisim-client";

/**
 * Get subscription location for an ICCID.
 * POST body: { credentials: { baseUrl, apiKey } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const { credentials } = await req.json();

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "API credentials required" },
        { status: 400 }
      );
    }

    const data = await getSubscriptionLocation(credentials, iccid);

    return NextResponse.json({
      ok: true,
      location: data?.data ?? data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
