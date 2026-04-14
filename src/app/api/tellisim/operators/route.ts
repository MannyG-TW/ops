import { NextRequest, NextResponse } from "next/server";
import { getOperators } from "@/lib/tellisim-client";

/**
 * Get operators with optional filters.
 * POST body: { credentials: { baseUrl, apiKey }, label?, iso2Codes? }
 */
export async function POST(req: NextRequest) {
  try {
    const { credentials, label, iso2Codes } = await req.json();

    if (!credentials?.apiKey) {
      return NextResponse.json(
        { ok: false, error: "API credentials required" },
        { status: 400 }
      );
    }

    const data = await getOperators(credentials, { label, iso2Codes });

    return NextResponse.json({
      ok: true,
      operators: data?.data ?? data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
