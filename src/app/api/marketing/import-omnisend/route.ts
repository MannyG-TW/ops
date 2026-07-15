import { NextRequest, NextResponse } from "next/server";
import { sanitizeError } from "@/lib/api-errors";
import { Readable } from "stream";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { importOmnisendFile } from "@/lib/marketing/omnisend";
import { marketingForbidden } from "@/lib/marketing/guard";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/marketing/import-omnisend — body is the raw CSV (Content-Type
 * text/csv). Streamed to a temp file so a 100 MB upload isn't buffered in memory,
 * then parsed into marketing_contacts.
 */
export async function POST(req: NextRequest) {
  const denied = marketingForbidden(req); if (denied) return denied;
  const tmpPath = path.join(tmpdir(), `omnisend-${randomUUID()}.csv`);
  try {
    if (!req.body) {
      return NextResponse.json({ ok: false, error: "No file body received" }, { status: 400 });
    }
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(tmpPath);
      const nodeStream = Readable.fromWeb(req.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
      nodeStream.pipe(out);
      out.on("finish", () => resolve());
      out.on("error", reject);
      nodeStream.on("error", reject);
    });

    const result = importOmnisendFile(tmpPath);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return sanitizeError(err, "Request");
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
