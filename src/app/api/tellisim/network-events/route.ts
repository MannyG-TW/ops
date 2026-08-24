import { NextRequest, NextResponse } from "next/server";
import { sql, desc, eq, gte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkIntentEvents } from "@/lib/db/schema";
import { sanitizeError } from "@/lib/api-errors";

/**
 * Read back captured out-of-coverage intent — customers who tried to connect
 * from a country their plan did not cover.
 *
 * `GET /api/tellisim/network-events`            → country demand leaderboard
 * `GET /api/tellisim/network-events?iccid=…`    → raw events for one ICCID
 * `?days=30`                                    → limit to the last N days of detections
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const iccid = sp.get("iccid")?.trim();
    const days = parseInt(sp.get("days") || "0", 10);
    const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "100", 10)));

    const conditions = [];
    if (iccid) conditions.push(eq(networkIntentEvents.iccid, iccid));
    if (days > 0) {
      conditions.push(
        gte(networkIntentEvents.detectedAt, new Date(Date.now() - days * 86_400_000))
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    if (iccid) {
      const events = db
        .select()
        .from(networkIntentEvents)
        .where(where)
        .orderBy(desc(networkIntentEvents.eventTime))
        .limit(limit)
        .all();
      return NextResponse.json({ ok: true, iccid, events });
    }

    // Demand leaderboard: distinct customers matter more than raw event volume,
    // since one device retrying produces many events for a single traveller.
    const countries = db
      .select({
        countryAlpha2: networkIntentEvents.countryAlpha2,
        countryName: sql<string>`max(${networkIntentEvents.countryName})`,
        events: sql<number>`count(*)`,
        sims: sql<number>`count(distinct ${networkIntentEvents.iccid})`,
        lastSeen: sql<string>`max(${networkIntentEvents.eventTime})`,
      })
      .from(networkIntentEvents)
      .where(where)
      .groupBy(networkIntentEvents.countryAlpha2)
      .orderBy(sql`count(distinct ${networkIntentEvents.iccid}) desc`)
      .limit(limit)
      .all();

    return NextResponse.json({ ok: true, countries });
  } catch (err) {
    return sanitizeError(err, "Network intent");
  }
}
