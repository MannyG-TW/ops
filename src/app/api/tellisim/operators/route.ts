import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { getOperators } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Get operators with optional filters.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const credentials = resolveTelliSIMCredentials(body);
    const { label, iso2Codes } = body;

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "TelliSIM credentials not configured" },
        { status: 400 }
      );
    }

    const data = await getOperators(credentials, { label, iso2Codes });

    return NextResponse.json({
      ok: true,
      operators: data?.data ?? data,
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
