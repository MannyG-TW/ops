import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const MIME: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ model: string; filename: string }> },
) {
  const { model, filename } = await params;

  if (!/^[a-zA-Z0-9_-]+$/.test(model) || !/^[a-zA-Z0-9_.-]+$/.test(filename)) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 });
  }

  const filePath = join(process.cwd(), "kb", model, filename);
  if (!existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME[ext] || "application/octet-stream";

  const data = readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
