import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dashboardConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function getOrCreateConfig() {
  let config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get();
  if (!config) {
    db.insert(dashboardConfig).values({
      id: "default",
      connectivityThreshold: 10,
      connectivityWindowHours: 48,
    }).run();
    config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get()!;
  }
  return config;
}

/** GET /api/dashboard/config — get dashboard thresholds */
export async function GET() {
  const config = getOrCreateConfig();
  return NextResponse.json({ ok: true, config });
}

/** PUT /api/dashboard/config — update dashboard thresholds (supervisor/admin only) */
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { connectivityThreshold, connectivityWindowHours, updatedBy } = body;

  if (!updatedBy) {
    return NextResponse.json({ ok: false, error: "updatedBy required" }, { status: 400 });
  }

  // Ensure row exists
  getOrCreateConfig();

  const updates: Record<string, unknown> = { updatedAt: new Date(), updatedBy };
  if (connectivityThreshold !== undefined) {
    const val = parseInt(connectivityThreshold, 10);
    if (isNaN(val) || val < 1) {
      return NextResponse.json({ ok: false, error: "Threshold must be a positive integer" }, { status: 400 });
    }
    updates.connectivityThreshold = val;
  }
  if (connectivityWindowHours !== undefined) {
    const val = parseInt(connectivityWindowHours, 10);
    if (isNaN(val) || val < 1) {
      return NextResponse.json({ ok: false, error: "Window must be a positive integer" }, { status: 400 });
    }
    updates.connectivityWindowHours = val;
  }

  db.update(dashboardConfig).set(updates).where(eq(dashboardConfig.id, "default")).run();

  const config = db.select().from(dashboardConfig).where(eq(dashboardConfig.id, "default")).get();
  return NextResponse.json({ ok: true, config });
}
