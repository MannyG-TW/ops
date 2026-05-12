import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ucl/device-detail
 *
 * Rich device + account detail via QueryCustomerForkf on the SaaS portal.
 * Returns binding account, device model/version, org, activation status,
 * seed ICCID/IMSI, balance, lock status, and more.
 *
 * Body: { imei: string }
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
    const initRes = await fetch("https://saas.ucloudlink.com/saas/index/login", {
      redirect: "manual", signal: AbortSignal.timeout(10000),
    });
    const initCookies = extractCookies(initRes);

    const loginRes = await fetch("https://saas.ucloudlink.com/saas/index/ajax_login", {
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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const imei = (body.imei || "").trim();

  if (!imei) {
    return NextResponse.json({ ok: false, error: "imei required" }, { status: 400 });
  }

  const session = await loginPortal();
  if ("error" in session) {
    return NextResponse.json({ ok: false, error: session.error });
  }

  try {
    const res = await fetch("https://saas.travelwifi.com/bss/customerTerminal/QueryCustomerForkf", {
      method: "POST",
      headers: { Cookie: session.cookies, "Content-Type": "application/json" },
      body: JSON.stringify({
        imei,
        loginCustomerId: session.loginCustomerId,
        partnerCode: "DHI",
        streamNo: `web_ops${Date.now()}${Math.floor(Math.random() * 999999)}`,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json();

    if (data.resultCode !== "00000000") {
      // Auth expired — retry once
      if (portalSession) {
        portalSession = null;
        const retrySession = await loginPortal();
        if (!("error" in retrySession)) {
          const retryRes = await fetch("https://saas.travelwifi.com/bss/customerTerminal/QueryCustomerForkf", {
            method: "POST",
            headers: { Cookie: retrySession.cookies, "Content-Type": "application/json" },
            body: JSON.stringify({
              imei,
              loginCustomerId: retrySession.loginCustomerId,
              partnerCode: "DHI",
              streamNo: `web_ops${Date.now()}${Math.floor(Math.random() * 999999)}`,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const retryData = await retryRes.json();
          if (retryData.resultCode === "00000000") {
            return NextResponse.json({ ok: true, imei, detail: retryData.data });
          }
        }
      }
      return NextResponse.json({ ok: false, error: data.resultDesc || `UCL error ${data.resultCode}` });
    }

    return NextResponse.json({ ok: true, imei, detail: data.data });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "QueryCustomerForkf failed" });
  }
}
