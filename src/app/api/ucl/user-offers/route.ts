import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclOrgs, uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ucl/user-offers
 *
 * Query the full offer (plan) list UCL has on file for a sub-user — the stable
 * user identity that data plans attach to.
 *
 * Body: { userCode: string, orgUsername?: string, flag?: "0"|"1"|"2", goodsType?: "PKAG"|"DISC"|"ALL" }
 *
 * Flag meaning (spec §4.7.3):
 *   0 = currently valid plans
 *   1 = expired / used-up plans
 *   2 = all (default here — we want the full history for audit)
 *
 * Returns the raw UCL response plus a convenience `offers` list extracted from
 * data.dataList, so the caller can both map fields quickly and inspect the
 * original payload.
 */

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
const UCL_BASE = "https://saas.ucloudlink.com/bss";

function streamNo(): string {
  return (
    "TWOPS" +
    new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) +
    String(Math.floor(Math.random() * 999999)).padStart(6, "0")
  );
}

interface UclSession {
  accessToken?: string;
  userId?: string;
  partnerCode?: string;
  error?: string;
}

async function loginUcl(orgUsername?: string): Promise<UclSession> {
  const config = db.select().from(uclGlobalConfig).where(eq(uclGlobalConfig.id, "default")).get();
  if (!config?.partnerCode || !config.clientId || !config.clientSecret) {
    return { error: "UCL global config missing" };
  }
  const org = orgUsername
    ? db.select().from(uclOrgs).where(eq(uclOrgs.username, orgUsername)).get()
    : db.select().from(uclOrgs).where(eq(uclOrgs.isActive, true)).get();
  if (!org) return { error: "No active UCL org configured" };

  const res = await fetch(`${UCL_BASE}/grp/noauth/GrpUserLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      streamNo: streamNo(),
      partnerCode: config.partnerCode,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      userCode: org.username,
      password: md5(org.password),
      mvnoCode: config.mvnoCode,
      langType: "en-US",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (data.resultCode !== "00000000") {
    return { error: `${data.resultCode}: ${data.resultDesc || "login failed"}` };
  }
  return { accessToken: data.data?.accessToken, userId: data.data?.userId, partnerCode: config.partnerCode };
}

async function logoutUcl(session: UclSession): Promise<void> {
  if (!session.accessToken) return;
  try {
    await fetch(
      `${UCL_BASE}/grp/user/GrpUserLogout?access_token=${session.accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamNo: streamNo(),
          partnerCode: session.partnerCode,
          loginCustomerId: session.userId,
          langType: "en-US",
        }),
        signal: AbortSignal.timeout(5000),
      }
    );
  } catch {
    /* fire and forget */
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userCode = (body.userCode || "").trim();
  const orgUsername = body.orgUsername as string | undefined;
  const flag = (body.flag as string) || "2";
  const goodsType = (body.goodsType as string) || "ALL";
  const bgTime = body.bgTime as number | undefined;
  const endTime = body.endTime as number | undefined;

  if (!userCode) {
    return NextResponse.json({ ok: false, error: "userCode required" }, { status: 400 });
  }

  const session = await loginUcl(orgUsername);
  if (session.error || !session.accessToken) {
    return NextResponse.json({ ok: false, error: session.error || "UCL login failed", step: "login" });
  }

  try {
    const res = await fetch(
      `${UCL_BASE}/grp/goods/QueryUserOfferList?access_token=${session.accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamNo: streamNo(),
          partnerCode: session.partnerCode,
          loginCustomerId: session.userId,
          userCode,
          flag,
          goodsType,
          ...(bgTime ? { bgTime } : {}),
          ...(endTime ? { endTime } : {}),
          currentPage: 1,
          perPageCount: 100,
          langType: "en-US",
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await res.json();
    const offers = (data?.data?.dataList as Array<Record<string, unknown>>) || [];
    return NextResponse.json({ ok: true, userCode, offers, raw: data });
  } finally {
    await logoutUcl(session);
  }
}
