import { NextRequest, NextResponse } from "next/server";
import { getSubscription, getPlanAttachments } from "@/lib/tellisim-client";

/**
 * Get TelliSIM subscription + plan attachments for an ICCID.
 * POST body: { credentials: { baseUrl, apiKey, orgId? } }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ iccid: string }> }
) {
  try {
    const { iccid } = await params;
    const { credentials } = await req.json();

    if (!credentials?.apiKey) {
      return NextResponse.json({ ok: false, error: "TelliSIM credentials required" }, { status: 400 });
    }

    // Fetch subscription and plan attachments in parallel
    const [subscription, planAttachments] = await Promise.allSettled([
      getSubscription(credentials, iccid),
      getPlanAttachments(credentials, iccid),
    ]);

    const result: Record<string, unknown> = {};

    if (subscription.status === "fulfilled") {
      result.subscription = subscription.value;
    } else {
      result.subscription = null;
      result.subscriptionError = subscription.reason?.message || "Failed to fetch subscription";
    }

    if (planAttachments.status === "fulfilled") {
      result.planAttachments = planAttachments.value;
    } else {
      result.planAttachments = [];
      result.planAttachmentsError = planAttachments.reason?.message || "Failed to fetch plan attachments";
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
