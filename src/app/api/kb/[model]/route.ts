import { NextRequest, NextResponse } from "next/server";
import { loadKbForModel } from "@/lib/kb-parser";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ model: string }> },
) {
  const { model } = await params;

  if (!model || !/^[a-zA-Z0-9_-]+$/.test(model)) {
    return NextResponse.json({ ok: false, error: "Invalid model" }, { status: 400 });
  }

  const kb = loadKbForModel(model);
  if (!kb) {
    return NextResponse.json({ ok: false, error: "KB not found for model" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: kb });
}
