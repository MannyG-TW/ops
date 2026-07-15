import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { listSims } from "@/lib/tellisim-client";
import { resolveTelliSIMCredentials } from "@/lib/server-credentials";

/**
 * Resolve an LPA string to its ICCID by searching through Tellisim SIMs.
 * Uses parallel pagination to search efficiently through large SIM inventories.
 *
 * LPA format: LPA:1$<smdp_address>$<matching_id>
 * POST body: { lpa: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { lpa } = body;
    const credentials = resolveTelliSIMCredentials(body);

    if (!lpa || typeof lpa !== "string") {
      return NextResponse.json({ ok: false, error: "lpa string required" }, { status: 400 });
    }
    if (!credentials?.apiKey) {
      return NextResponse.json({ ok: false, error: "TelliSIM credentials not configured" }, { status: 400 });
    }

    const trimmedLpa = lpa.trim();
    const PAGE_SIZE = 25;

    // Step 1: Fetch the first page to discover total inventory size
    const firstResult = await listSims(credentials, { pageSize: PAGE_SIZE, isEsim: true });
    const firstSims = firstResult?.data || [];

    // Check first page
    const firstMatch = firstSims.find((sim: Record<string, unknown>) => sim.lpa === trimmedLpa);
    if (firstMatch) {
      return NextResponse.json({
        ok: true,
        iccid: firstMatch.iccid,
        lpa: firstMatch.lpa,
        label: firstMatch.label || null,
        esimId: firstMatch.esim_id || null,
      });
    }

    if (!firstResult?.next_page) {
      return NextResponse.json({ ok: false, error: "No SIM found with this LPA string in TelliSIM" });
    }

    // Step 2: Parallel paginate — fetch multiple pages concurrently in batches
    // The next_page tokens are base64-encoded offsets. We can predict them.
    // Pattern from logs: page 0→"NTA=" (50), page 1→"NzU=" (75), etc.
    // These are base64 of the offset number. Generate predicted offsets.
    const BATCH_SIZE = 10; // 10 concurrent requests
    const MAX_SIMS = 5000; // Safety cap
    let offset = PAGE_SIZE; // Start after first page

    while (offset < MAX_SIMS) {
      // Generate batch of page tokens (base64-encoded offsets)
      const batch: Promise<{ data?: Array<Record<string, unknown>> }>[] = [];
      for (let i = 0; i < BATCH_SIZE && (offset + i * PAGE_SIZE) < MAX_SIMS; i++) {
        const pageToken = Buffer.from(String(offset + i * PAGE_SIZE)).toString("base64");
        batch.push(
          listSims(credentials, { pageSize: PAGE_SIZE, page: pageToken, isEsim: true })
            .catch(() => ({ data: [] }))
        );
      }

      const results = await Promise.all(batch);

      for (const result of results) {
        const sims = result?.data || [];
        const match = sims.find((sim: Record<string, unknown>) => sim.lpa === trimmedLpa);
        if (match) {
          return NextResponse.json({
            ok: true,
            iccid: match.iccid,
            lpa: match.lpa,
            label: match.label || null,
            esimId: match.esim_id || null,
          });
        }
        // If a page returned fewer than PAGE_SIZE results, we've reached the end
        if (sims.length < PAGE_SIZE) {
          return NextResponse.json({ ok: false, error: "No SIM found with this LPA string in TelliSIM" });
        }
      }

      offset += BATCH_SIZE * PAGE_SIZE;
    }

    return NextResponse.json({
      ok: false,
      error: "No SIM found with this LPA string in TelliSIM (searched 5000 SIMs)",
    });
  } catch (err) {
    return sanitizeError(err, "TelliSIM");
  }
}
