import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ucl/connection-log
 *
 * Connection history for a Sapphire device via the UCL SaaS portal's
 * /oss/performanceLog/queryTerminalActivityStream endpoint.
 *
 * Returns timestamped entries with: country, network, RAT, signal, battery,
 * temperature, cell ID, connected users, etc.
 *
 * Body: { imei: string, days?: number (default 30, max 30) }
 */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function extractCookies(res: Response): string {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  }
  const raw = res.headers.get("set-cookie") || "";
  return raw.split(/,(?=[^ ]+=)/).map((c) => c.trim().split(";")[0]).filter(Boolean).join("; ");
}

let portalSession: { cookies: string; loginCustomerId: string; ts: number } | null = null;
const SESSION_TTL_MS = 20 * 60 * 1000;

async function loginPortal(): Promise<{ cookies: string; loginCustomerId: string } | { error: string }> {
  if (portalSession && Date.now() - portalSession.ts < SESSION_TTL_MS) {
    return { cookies: portalSession.cookies, loginCustomerId: portalSession.loginCustomerId };
  }

  const config = db.select().from(uclGlobalConfig).where(eq(uclGlobalConfig.id, "default")).get();
  if (!config?.portalUsername || !config.portalPassword) {
    return { error: "UCL portal credentials not configured" };
  }

  try {
    const initRes = await fetch("https://saas.travelwifi.com/saas/index/login", {
      redirect: "manual", signal: AbortSignal.timeout(10000),
    });
    const initCookies = extractCookies(initRes);

    const loginRes = await fetch("https://saas.travelwifi.com/saas/index/ajax_login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: initCookies },
      body: new URLSearchParams({
        userCode: config.portalUsername,
        password: md5(config.portalPassword),
      }).toString(),
      redirect: "manual", signal: AbortSignal.timeout(15000),
    });

    const loginData = await loginRes.json();
    if (loginData.resultCode !== "00000000") {
      return { error: (loginData.resultDesc as string) || "SaaS portal login failed" };
    }

    const tokenData = loginData.data as { accessToken?: string; loginCustomerId?: string } | undefined;
    const loginCustomerId = tokenData?.loginCustomerId || "";
    const dataCookies = tokenData
      ? `access_token=${tokenData.accessToken}; loginCustomerId=${loginCustomerId}`
      : "";

    const loginCookies = extractCookies(loginRes);
    const rawParts = [initCookies, loginCookies, dataCookies].filter(Boolean).join("; ").split("; ").filter(Boolean);
    const cookieMap = new Map<string, string>();
    for (const part of rawParts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx > 0) cookieMap.set(part.slice(0, eqIdx).trim(), part.slice(eqIdx + 1).trim());
    }
    for (const [k, v] of cookieMap) { if (v === "deleted") cookieMap.delete(k); }
    const allCookies = Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join("; ");

    portalSession = { cookies: allCookies, loginCustomerId, ts: Date.now() };
    return { cookies: allCookies, loginCustomerId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "SaaS portal login failed" };
  }
}

const RAT_MAP: Record<number, string> = { 0: "2G", 1: "3G", 2: "4G", 3: "5G" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const imei = (body.imei || "").trim();
  const days = Math.min(Math.max(Number(body.days) || 30, 1), 30);

  if (!imei) {
    return NextResponse.json({ ok: false, error: "imei required" }, { status: 400 });
  }

  const session = await loginPortal();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error });
  }

  const endTime = Date.now();
  const beginTime = endTime - days * 24 * 60 * 60 * 1000;

  const params = new URLSearchParams({
    imei,
    loginCustomerId: session.loginCustomerId,
    partnerCode: "UKSAS",
    mvnoId: "58d216591ffdba76d1b4aa48",
    orgId: "58d21659dfd2057e32517438",
    beginTime: String(beginTime),
    endTime: String(endTime),
    currentPage: "1",
    perPageCount: "50",
    page: "1",
    customerId: "{}",
    streamNo: `web_ops${Date.now()}${Math.floor(Math.random() * 999999)}`,
  });

  try {
    const res = await fetch(
      `https://saas.travelwifi.com/oss/performanceLog/queryTerminalActivityStream?${params}`,
      { headers: { Cookie: session.cookies }, signal: AbortSignal.timeout(15000) },
    );
    const data = await res.json();

    if (data.resultCode !== "00000000") {
      // Auth expired — retry
      if (portalSession) {
        portalSession = null;
        const retry = await loginPortal();
        if (!("error" in retry)) {
          params.set("loginCustomerId", retry.loginCustomerId);
          params.set("streamNo", `web_ops${Date.now()}${Math.floor(Math.random() * 999999)}`);
          const r2 = await fetch(
            `https://saas.travelwifi.com/oss/performanceLog/queryTerminalActivityStream?${params}`,
            { headers: { Cookie: retry.cookies }, signal: AbortSignal.timeout(15000) },
          );
          const d2 = await r2.json();
          if (d2.resultCode === "00000000") {
            const entries = (d2.data?.dataList || []).map(mapEntry);
            return NextResponse.json({ ok: true, imei, totalCount: d2.data?.totalCount || 0, entries });
          }
        }
      }
      return NextResponse.json({ ok: false, error: data.resultDesc || `UCL error ${data.resultCode}` });
    }

    const entries = (data.data?.dataList || []).map(mapEntry);
    return NextResponse.json({
      ok: true,
      imei,
      totalCount: data.data?.totalCount || 0,
      entries,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection log query failed" });
  }
}

function mapEntry(e: Record<string, unknown>) {
  return {
    time: e.uploadTime as number,
    country: e.iso as string || "",
    mcc: String(e.mcc || ""),
    mnc: String(e.mnc || ""),
    network: (e.netWork as string) || "",
    rat: RAT_MAP[e.rat as number] || String(e.rat || ""),
    signal: e.sigStrength as number,
    signalQuality: e.sigQuality as number,
    battery: (e.powerLeft as string) || "",
    temperature: e.temperature as number,
    connectedUsers: e.wifyConnectNum as number,
    cellId: e.cellid as number,
    lac: e.lac as number,
    imsi: String(e.imsi || ""),
  };
}
