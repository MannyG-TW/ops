import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { getCoverageProfiles } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Get all coverage profiles.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const data = await getCoverageProfiles(credentials);

    return NextResponse.json({
      ok: true,
      coverageProfiles: data?.data ?? data,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
