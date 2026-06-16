import { NextRequest, NextResponse } from "next/server";
import { getSmdpInfo, getSimDetails } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Get profile installation status and state history for a SIM.
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

    // Fetch SMDP info and SIM details in parallel
    const [smdpResult, simResult] = await Promise.allSettled([
      getSmdpInfo(credentials, iccid),
      getSimDetails(credentials, iccid),
    ]);

    const result: Record<string, unknown> = { ok: true };

    if (smdpResult.status === "fulfilled") {
      result.smdp = smdpResult.value?.data ?? smdpResult.value;
    } else {
      result.smdp = null;
      result.smdpError = smdpResult.reason?.message || "Failed to fetch SMDP info";
    }

    if (simResult.status === "fulfilled") {
      result.sim = simResult.value?.data ?? simResult.value;
    } else {
      result.sim = null;
      result.simError = simResult.reason?.message || "Failed to fetch SIM details";
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
