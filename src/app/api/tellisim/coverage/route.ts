import { NextRequest, NextResponse } from "next/server";
import { getCoverageProfiles } from "@/lib/tellisim-client";

/**
 * Get all coverage profiles.
 * POST body: { credentials: { baseUrl, apiKey } }
 */
export async function POST(req: NextRequest) {
  try {
    const { credentials } = await req.json();

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "API credentials required" },
        { status: 400 }
      );
    }

    const data = await getCoverageProfiles(credentials);

    return NextResponse.json({
      ok: true,
      coverageProfiles: data?.data ?? data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
