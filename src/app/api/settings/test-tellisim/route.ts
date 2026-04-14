import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { baseUrl, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "API key is required" }, { status: 400 });
    }

    const cleanUrl = (baseUrl || "https://api.tellisim.com").replace(/\/$/, "");

    // TelliSIM uses query string auth: ?key=<api_key>
    // Test with a known-good endpoint pattern — list subscriptions
    const res = await fetch(`${cleanUrl}/v3/subscriptions?key=${encodeURIComponent(apiKey)}&limit=1`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        error: "Authentication failed. Check your API key.",
      });
    }

    // A 200 or even a 400 with a valid JSON response means the API is reachable and key works
    if (res.ok) {
      return NextResponse.json({
        ok: true,
        message: "API key is valid. Connected to TelliSIM v3.",
      });
    }

    // Some endpoints may return 404 if no data — but the API itself responded, so connection works
    const text = await res.text().catch(() => "");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    // If TelliSIM returns a structured JSON error, the API is reachable
    if (parsed && parsed.code) {
      return NextResponse.json({
        ok: true,
        message: `Connected to TelliSIM v3. API responded with code ${parsed.code}.`,
      });
    }

    return NextResponse.json({
      ok: false,
      error: `TelliSIM returned ${res.status}: ${text.slice(0, 200)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timeout") || message.includes("abort")) {
      return NextResponse.json({ ok: false, error: "Connection timed out after 10 seconds" });
    }
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json({ ok: false, error: "Connection refused. Check the base URL." });
    }
    return NextResponse.json({ ok: false, error: message });
  }
}
