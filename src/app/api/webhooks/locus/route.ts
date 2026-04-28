import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { executeJobNow } from "@/lib/execute-job";

function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function computeHmacSha256(payload: string, secret: string) {
  return (
    "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex")
  );
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-signature-256") || "";
  const sessionIdHeader = req.headers.get("x-session-id") || "";

  // Minimal payload shape we expect:
  // { event: "checkout.session.paid", data: { sessionId, paymentTxHash, paidAt, metadata } }
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionIdFromBody =
    parsed?.data?.sessionId || parsed?.data?.id || parsed?.sessionId;
  const sessionId = sessionIdHeader || sessionIdFromBody;
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

  const sb = supabaseServer();
  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Unknown sessionId" }, { status: 404 });

  // Verify signature (if we have a webhook secret from checkout session creation)
  if (job.webhook_secret) {
    const expected = computeHmacSha256(raw, job.webhook_secret);
    if (!signature || !safeEqual(signature, expected)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = parsed?.event;
  if (event === "checkout.session.paid") {
    const txHash = parsed?.data?.paymentTxHash || parsed?.data?.txHash || null;
    const paidAt = parsed?.data?.paidAt ? new Date(parsed.data.paidAt).toISOString() : null;

    try {
      await executeJobNow(job.id, { txHash, paidAt });
      return NextResponse.json({ ok: true });
    } catch (e: any) {
      await sb
        .from("jobs")
        .update({
          status: "FAILED",
          error_message: String(e?.message || e),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return NextResponse.json({ ok: false });
    }
  }

  if (event === "checkout.session.expired") {
    await sb
      .from("jobs")
      .update({ status: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", job.id);
    return NextResponse.json({ ok: true });
  }

  // Unknown events: ack so the sender won't keep retrying
  return NextResponse.json({ ok: true, ignored: true });
}
