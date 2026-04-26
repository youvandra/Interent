import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

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

  // Payload minimal yang kita butuhin:
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
  const { data: session, error: sessErr } = await sb
    .from("checkout_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 });
  if (!session) return NextResponse.json({ error: "Unknown sessionId" }, { status: 404 });

  // Verify signature (kalau kita punya webhook secret dari create session)
  if (session.webhook_secret) {
    const expected = computeHmacSha256(raw, session.webhook_secret);
    if (!signature || !safeEqual(signature, expected)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = parsed?.event;
  if (event === "checkout.session.paid") {
    const txHash = parsed?.data?.paymentTxHash || parsed?.data?.txHash || null;
    const paidAt = parsed?.data?.paidAt ? new Date(parsed.data.paidAt).toISOString() : null;

    // Update session
    await sb
      .from("checkout_sessions")
      .update({
        status: "PAID",
        paid_at: paidAt,
        payment_tx_hash: txHash,
      })
      .eq("session_id", sessionId);

    // Grant entitlement
    await sb.from("entitlements").upsert(
      {
        buyer_id: session.buyer_id,
        pack_id: session.pack_id,
        status: "ACTIVE",
        payment_tx_hash: txHash,
      },
      { onConflict: "buyer_id,pack_id" },
    );

    return NextResponse.json({ ok: true });
  }

  if (event === "checkout.session.expired") {
    await sb
      .from("checkout_sessions")
      .update({ status: "EXPIRED" })
      .eq("session_id", sessionId);
    return NextResponse.json({ ok: true });
  }

  // Unknown events: ack biar nggak retry terus
  return NextResponse.json({ ok: true, ignored: true });
}

