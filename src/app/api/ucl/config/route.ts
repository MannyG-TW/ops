import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uclGlobalConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const CONFIG_ID = "default";

/** GET /api/ucl/config — Get UCL global config */
export async function GET() {
  let config = db
    .select()
    .from(uclGlobalConfig)
    .where(eq(uclGlobalConfig.id, CONFIG_ID))
    .get();

  if (!config) {
    // Create default row
    db.insert(uclGlobalConfig)
      .values({
        id: CONFIG_ID,
        partnerCode: "",
        clientId: "",
        clientSecret: "",
        mvnoCode: "",
        updatedAt: new Date(),
      })
      .run();

    config = db
      .select()
      .from(uclGlobalConfig)
      .where(eq(uclGlobalConfig.id, CONFIG_ID))
      .get();
  }

  return NextResponse.json({ ok: true, config });
}

/** PUT /api/ucl/config — Update UCL global config */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { partnerCode, clientId, clientSecret, mvnoCode } = body;

  const existing = db
    .select()
    .from(uclGlobalConfig)
    .where(eq(uclGlobalConfig.id, CONFIG_ID))
    .get();

  if (!existing) {
    db.insert(uclGlobalConfig)
      .values({
        id: CONFIG_ID,
        partnerCode: partnerCode ?? "",
        clientId: clientId ?? "",
        clientSecret: clientSecret ?? "",
        mvnoCode: mvnoCode ?? "",
        updatedAt: new Date(),
      })
      .run();
  } else {
    db.update(uclGlobalConfig)
      .set({
        partnerCode: partnerCode ?? existing.partnerCode,
        clientId: clientId ?? existing.clientId,
        clientSecret: clientSecret ?? existing.clientSecret,
        mvnoCode: mvnoCode ?? existing.mvnoCode,
        updatedAt: new Date(),
      })
      .where(eq(uclGlobalConfig.id, CONFIG_ID))
      .run();
  }

  const config = db
    .select()
    .from(uclGlobalConfig)
    .where(eq(uclGlobalConfig.id, CONFIG_ID))
    .get();

  return NextResponse.json({ ok: true, config });
}
