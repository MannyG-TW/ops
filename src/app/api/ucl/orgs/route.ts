import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uclOrgs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

/** GET /api/ucl/orgs — List all UCL orgs */
export async function GET() {
  const orgs = db
    .select()
    .from(uclOrgs)
    .orderBy(desc(uclOrgs.createdAt))
    .all();

  return NextResponse.json({ ok: true, orgs });
}

/** POST /api/ucl/orgs — Add a new UCL org */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { orgName, username, password } = body;

  if (!orgName || !username || !password) {
    return NextResponse.json(
      { ok: false, error: "orgName, username, and password are required" },
      { status: 400 }
    );
  }

  // Check for duplicate org name
  const existing = db
    .select()
    .from(uclOrgs)
    .where(
eq(uclOrgs.orgName, orgName)
    )
    .get();

  if (existing) {
    return NextResponse.json(
      { ok: false, error: `Org "${orgName}" already exists` },
      { status: 409 }
    );
  }

  const org = {
    id: randomUUID(),
    orgName,
    username,
    password,
    isActive: true,
    createdAt: new Date(),
  };

  db.insert(uclOrgs).values(org).run();

  return NextResponse.json({ ok: true, org });
}
