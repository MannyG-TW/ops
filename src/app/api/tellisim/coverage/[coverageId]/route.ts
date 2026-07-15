import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { getCoverageProfile } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Get a single coverage profile by ID.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ coverageId: string }> }
) {
  try {
    const { coverageId } = await params;
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const data = await getCoverageProfile(credentials, coverageId);

    return NextResponse.json({
      ok: true,
      coverageProfile: data?.data ?? data,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
