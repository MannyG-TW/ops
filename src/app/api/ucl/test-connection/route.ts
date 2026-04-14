import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { uclOrgs, uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

const UCL_LOGIN_URL =
  "https://saas.ucloudlink.com/bss/grp/noauth/GrpUserLogin";

/** POST /api/ucl/test-connection — Test login for a specific org */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orgId, username, password } = body;

  // Get global config
  const config = db
    .select()
    .from(uclGlobalConfig)
    .where(eq(uclGlobalConfig.id, "default"))
    .get();

  if (!config || !config.partnerCode || !config.clientId || !config.clientSecret) {
    return NextResponse.json({
      ok: false,
      error:
        "UCL global config is incomplete. Set partnerCode, clientId, clientSecret first.",
      step: "config_missing",
    });
  }

  // UCL uses a single partner tenancy: partnerCode/clientId/clientSecret/mvnoCode
  // are shared across all orgs (always DHI for us). Per-org isolation happens at
  // the business-customer layer via userCode + password only.
  const partnerCode = config.partnerCode;

  const streamNo =
    "TWOPS" +
    new Date()
      .toISOString()
      .replace(/[-:T.Z]/g, "")
      .slice(0, 14) +
    String(Math.floor(Math.random() * 999999)).padStart(6, "0");

  const loginPayload = {
    streamNo,
    partnerCode,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    userCode: username,
    // UCL spec §4.1.3: "Encrypt in MD5 once" — send the MD5 hex of the plaintext
    password: md5(password),
    mvnoCode: config.mvnoCode,
    langType: "en-US",
  };

  try {
    const response = await fetch(UCL_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginPayload),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    const success = data.resultCode === "00000000";
    const now = new Date();

    // Update org test status if orgId provided
    if (orgId) {
      db.update(uclOrgs)
        .set({
          lastTestedAt: now,
          lastTestResult: success ? "success" : "error",
          lastTestMessage: success
            ? "Login successful"
            : `${data.resultCode}: ${data.resultDesc || "Unknown error"}`,
          updatedAt: now,
        })
        .where(eq(uclOrgs.id, orgId))
        .run();
    }

    if (success) {
      // Logout immediately to clean up the token
      const accessToken = data.data?.accessToken;
      if (accessToken) {
        fetch(
          `https://saas.ucloudlink.com/bss/grp/user/GrpUserLogout?access_token=${accessToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              streamNo:
                "TWOPS" +
                new Date()
                  .toISOString()
                  .replace(/[-:T.Z]/g, "")
                  .slice(0, 14) +
                String(Math.floor(Math.random() * 999999)).padStart(6, "0"),
              partnerCode,
              loginCustomerId: data.data?.userId,
              langType: "en-US",
            }),
          }
        ).catch(() => {
          /* fire and forget */
        });
      }

      return NextResponse.json({
        ok: true,
        message: "Login successful — credentials are valid",
        accessToken: accessToken ? "obtained" : "not returned",
        userId: data.data?.userId,
        step: "login_success",
      });
    }

    return NextResponse.json({
      ok: false,
      error: data.resultDesc || "Login failed",
      resultCode: data.resultCode,
      step: "login_failed",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Connection failed";

    if (orgId) {
      db.update(uclOrgs)
        .set({
          lastTestedAt: new Date(),
          lastTestResult: "error",
          lastTestMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(uclOrgs.id, orgId))
        .run();
    }

    return NextResponse.json({
      ok: false,
      error: message,
      step: "network_error",
    });
  }
}
