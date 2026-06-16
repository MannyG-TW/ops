import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclOrgs, uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/ucl/device-info
 *
 * Look up a Sapphire device by IMEI via uCloudLink BSS API.
 *
 * Body: { imei: string, orgUsername?: string }
 *
 * Flow:
 *   1. Log in as the specified org (or the first active org) using shared partner creds.
 *   2. Call QueryBindingRelationInfo with IMEI → returns device binding (sub-user, model, status).
 *   3. Call QueryAccountDetailListInfo (optional) for balance / active plan.
 *   4. Logout to release the token.
 *
 * All errors return { ok: false, error } with HTTP 200 so the UI can show a friendly message
 * without treating missing UCL data as a hard failure.
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

interface UclLoginResult {
  accessToken?: string;
  userId?: string;
  partnerCode?: string;
  error?: string;
  resultCode?: string;
}

async function loginUcl(orgUsername?: string): Promise<UclLoginResult> {
  const config = db.select().from(uclGlobalConfig).where(eq(uclGlobalConfig.id, "default")).get();
  if (!config?.partnerCode || !config.clientId || !config.clientSecret) {
    return { error: "UCL global config missing (partnerCode/clientId/clientSecret)" };
  }

  // Pick org: explicit, else first active
  const org = orgUsername
    ? db.select().from(uclOrgs).where(eq(uclOrgs.username, orgUsername)).get()
    : db.select().from(uclOrgs).where(eq(uclOrgs.isActive, true)).get();
  if (!org) return { error: "No active UCL org configured" };

  const payload = {
    streamNo: streamNo(),
    partnerCode: config.partnerCode,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    userCode: org.username,
    password: md5(org.password),
    mvnoCode: config.mvnoCode,
    langType: "en-US",
  };

  const res = await fetch(`${UCL_BASE}/grp/noauth/GrpUserLogin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (data.resultCode !== "00000000") {
    return { error: data.resultDesc || "UCL login failed", resultCode: data.resultCode };
  }
  return {
    accessToken: data.data?.accessToken,
    userId: data.data?.userId,
    partnerCode: config.partnerCode,
  };
}

async function logoutUcl(session: UclLoginResult): Promise<void> {
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

async function queryBindingInfo(session: UclLoginResult, imei: string): Promise<{
  raw: Record<string, unknown>;
  binding: Record<string, unknown> | null;
}> {
  try {
    const res = await fetch(
      `${UCL_BASE}/grp/tml/QueryBindingRelationInfo?access_token=${session.accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streamNo: streamNo(),
          partnerCode: session.partnerCode,
          loginCustomerId: session.userId,
          imei,
          langType: "en-US",
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await res.json();
    return {
      raw: data,
      binding: data.resultCode === "00000000" ? (data.data || null) : null,
    };
  } catch (err) {
    return {
      raw: { error: err instanceof Error ? err.message : "QueryBindingRelationInfo failed" },
      binding: null,
    };
  }
}

/** Fetch every offer (flag=2: all statuses) UCL has on file for a sub-user. */
async function queryUserOffers(session: UclLoginResult, userCode: string): Promise<{
  offers: Array<Record<string, unknown>>;
  raw: Record<string, unknown>;
}> {
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
          flag: "2",
          goodsType: "ALL",
          currentPage: 1,
          perPageCount: 100,
          langType: "en-US",
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const data = await res.json();
    const offers = (data?.data?.dataList as Array<Record<string, unknown>>) || [];
    return { offers, raw: data };
  } catch (err) {
    return {
      offers: [],
      raw: { error: err instanceof Error ? err.message : "QueryUserOfferList failed" },
    };
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const imei = (body.imei || "").trim();
  const hintOrg = body.orgUsername as string | undefined;

  if (!imei) {
    return NextResponse.json({ ok: false, error: "imei required" }, { status: 400 });
  }

  // Devices belong to a specific UCL org sub-user, but we don't always know which
  // one from the order (our `system` codes — TWUS, TWEU… — don't map 1:1 to UCL
  // `username`). Try the hint first, then walk every active org until binding comes
  // back populated. Terminate early on the first hit.
  const activeOrgs = db.select().from(uclOrgs).where(eq(uclOrgs.isActive, true)).all();
  const ordered = hintOrg
    ? [hintOrg, ...activeOrgs.map((o) => o.username).filter((u) => u !== hintOrg)]
    : activeOrgs.map((o) => o.username);

  const attempts: Array<{ org: string; resultCode?: string; error?: string }> = [];
  for (const org of ordered) {
    const session = await loginUcl(org);
    if (session.error || !session.accessToken) {
      attempts.push({ org, error: session.error });
      continue;
    }
    try {
      const { binding, raw } = await queryBindingInfo(session, imei);
      const resultCode = (raw?.resultCode as string) || "";
      attempts.push({ org, resultCode });

      // Hit: resultCode OK AND binding has the target IMEI populated.
      if (binding && binding.imei === imei) {
        const userCode = (binding.customerName as string) || "";
        let offers: Array<Record<string, unknown>> = [];
        let offersRaw: Record<string, unknown> | null = null;
        if (userCode) {
          const result = await queryUserOffers(session, userCode);
          offers = result.offers;
          offersRaw = result.raw;
        }
        return NextResponse.json({
          ok: true,
          imei,
          org,
          binding,
          offers,
          raw,
          offersRaw,
          attempts,
        });
      }
    } finally {
      await logoutUcl(session);
    }
  }

  return NextResponse.json({
    ok: false,
    imei,
    error: "No UCL org returned a binding for this IMEI",
    attempts,
  });
}
