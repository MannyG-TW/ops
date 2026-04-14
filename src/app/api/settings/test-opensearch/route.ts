import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url, username, password } = await req.json();

    if (!url) {
      return NextResponse.json({ ok: false, error: "URL is required" }, { status: 400 });
    }

    const cleanUrl = url.replace(/\/$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (username && password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }

    const res = await fetch(cleanUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({
        ok: false,
        error: `OpenSearch returned ${res.status}: ${text.slice(0, 200)}`,
      });
    }

    const data = await res.json();
    const clusterName = data.cluster_name || "unknown";
    const version = data.version?.number || "unknown";

    return NextResponse.json({
      ok: true,
      message: `Connected to cluster "${clusterName}" (v${version})`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("timeout") || message.includes("abort")) {
      return NextResponse.json({ ok: false, error: "Connection timed out after 10 seconds" });
    }
    if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
      return NextResponse.json({ ok: false, error: "Connection refused. Check the URL and ensure OpenSearch is reachable." });
    }
    return NextResponse.json({ ok: false, error: message });
  }
}
