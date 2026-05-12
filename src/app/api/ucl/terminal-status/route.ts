import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ucl/terminal-status
 *
 * On-demand device status from uCloudLink's SaaS portal.
 * Uses the SaaS web portal login (/saas/index/ajax_login) then queries
 * /oss/userMonitor/queryUserInfo which returns per-device status by IMEI.
 *
 * Body: { imei: string }
 */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Extract set-cookie values from a fetch Response (handles Node compat). */
function extractCookies(res: Response): string {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  }
  const raw = res.headers.get("set-cookie") || "";
  return raw
    .split(/,(?=[^ ]+=)/)
    .map((c) => c.trim().split(";")[0])
    .filter(Boolean)
    .join("; ");
}

/** Cached SaaS portal session. */
let portalSession: { cookies: string; loginCustomerId: string; ts: number } | null = null;
const SESSION_TTL_MS = 20 * 60 * 1000; // 20 min

/** Login to the SaaS web portal. Returns session cookies + loginCustomerId. */
async function loginPortal(): Promise<{ cookies: string; loginCustomerId: string } | { error: string }> {
  if (portalSession && Date.now() - portalSession.ts < SESSION_TTL_MS) {
    return { cookies: portalSession.cookies, loginCustomerId: portalSession.loginCustomerId };
  }

  const config = db.select().from(uclGlobalConfig).where(eq(uclGlobalConfig.id, "default")).get();
  if (!config?.portalUsername || !config.portalPassword) {
    return { error: "UCL portal credentials not configured (Settings > UCL > Portal Username/Password)" };
  }

  try {
    // Step 1: Establish PHP session
    const initRes = await fetch("https://saas.ucloudlink.com/saas/index/login", {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    const initCookies = extractCookies(initRes);

    // Step 2: Login via ajax_login
    const loginRes = await fetch("https://saas.ucloudlink.com/saas/index/ajax_login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: initCookies,
      },
      body: new URLSearchParams({
        userCode: config.portalUsername,
        password: md5(config.portalPassword),
      }).toString(),
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    const loginText = await loginRes.text();
    let loginData: Record<string, unknown>;
    try {
      loginData = JSON.parse(loginText);
    } catch {
      return { error: `Portal login returned non-JSON: ${loginText.slice(0, 100)}` };
    }

    if (loginData.resultCode !== "00000000") {
      return { error: (loginData.resultDesc as string) || "SaaS portal login failed" };
    }

    const tokenData = loginData.data as { accessToken?: string; loginCustomerId?: string } | undefined;
    const loginCustomerId = tokenData?.loginCustomerId || "";
    const dataCookies = tokenData
      ? `access_token=${tokenData.accessToken}; loginCustomerId=${loginCustomerId}`
      : "";

    const loginCookies = extractCookies(loginRes);
    const rawParts = [initCookies, loginCookies, dataCookies]
      .filter(Boolean)
      .join("; ")
      .split("; ")
      .filter(Boolean);
    const cookieMap = new Map<string, string>();
    for (const part of rawParts) {
      const eqIdx = part.indexOf("=");
      if (eqIdx > 0) {
        cookieMap.set(part.slice(0, eqIdx).trim(), part.slice(eqIdx + 1).trim());
      }
    }
    for (const [k, v] of cookieMap) {
      if (v === "deleted") cookieMap.delete(k);
    }
    const allCookies = Array.from(cookieMap.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    portalSession = { cookies: allCookies, loginCustomerId, ts: Date.now() };
    return { cookies: allCookies, loginCustomerId };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "SaaS portal login failed" };
  }
}

/** Query per-device status via /oss/userMonitor/queryUserInfo. */
async function queryUserInfo(
  cookies: string,
  loginCustomerId: string,
  imei: string,
): Promise<Record<string, unknown>> {
  try {
    const url = new URL("https://saas.ucloudlink.com/oss/userMonitor/queryUserInfo");
    url.searchParams.set("imei", imei);
    url.searchParams.set("loginCustomerId", loginCustomerId);
    url.searchParams.set("partnerCode", "DHI");
    url.searchParams.set("streamNo", `web_ops${Date.now()}${Math.floor(Math.random() * 999999)}`);

    const res = await fetch(url.toString(), {
      headers: { Cookie: cookies },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: `Non-JSON response: ${text.slice(0, 200)}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "queryUserInfo failed" };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const imei = (body.imei || "").trim();

  if (!imei) {
    return NextResponse.json({ ok: false, error: "imei required" }, { status: 400 });
  }

  // Login to SaaS portal
  const session = await loginPortal();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error });
  }

  // Query device status
  let result = await queryUserInfo(session.cookies, session.loginCustomerId, imei);

  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error as string });
  }

  // Auth expired — clear cache and retry once
  if (result.resultCode !== "00000000") {
    if (portalSession) {
      portalSession = null;
      const retrySession = await loginPortal();
      if (!("error" in retrySession)) {
        result = await queryUserInfo(retrySession.cookies, retrySession.loginCustomerId, imei);
      }
    }
    if (result.resultCode !== "00000000") {
      return NextResponse.json({
        ok: false,
        error: (result.resultDesc as string) || `UCL error ${result.resultCode}`,
      });
    }
  }

  const data = result.data as Record<string, unknown> | undefined;

  if (!data || !data.imei) {
    return NextResponse.json({
      ok: true,
      imei,
      terminal: {
        isOnline: false,
        mcc: "", mnc: "", lac: "", cellId: "",
        network: "", signalStrength: "",
        ip: "", iccid: "", imsi: "", operatorName: "",
      },
      allData: null,
    });
  }

  const isOnline = data.isOnline === 1 || data.isOnline === true;

  const terminal = {
    isOnline,
    mcc: String(data.mcc || ""),
    mnc: String(data.mnc || ""),
    lac: "",
    cellId: "",
    network: String(data.plmn || ""),
    signalStrength: String(data.sigStrength || ""),
    ip: "",
    iccid: "",
    imsi: "",
    operatorName: "",
  };

  return NextResponse.json({
    ok: true,
    imei,
    terminal,
    allData: data,
  });
}
