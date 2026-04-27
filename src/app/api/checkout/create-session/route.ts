import { NextResponse } from "next/server";
import { getAppUrl, getLocusApiBase, getLocusApiKey } from "@/lib/locus";
import { supabaseServer } from "@/lib/supabase/server";

type CreateSessionRequest = {
  packId: string;
  buyerId: string;
};

// Catatan: SDK npm @locus/agent-sdk tidak tersedia publik, jadi kita call REST langsung.
// Endpoint create session tidak didokumentasikan detail di CHECKOUT.md, tapi SDK merchant pada dasarnya
// membungkus endpoint create session. Jadi di MVP ini kita coba call:
//   POST {LOCUS_API_BASE}/checkout/sessions
// Kalau ternyata path berbeda, tinggal adjust 1 tempat ini.
export async function POST(req: Request) {
  const body = (await req.json()) as CreateSessionRequest;
  if (!body.packId) return NextResponse.json({ error: "packId required" }, { status: 400 });
  if (!body.buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });

  const sb = supabaseServer();
  const { data: pack, error: packErr } = await sb
    .from("memory_packs")
    .select("*")
    .eq("id", body.packId)
    .maybeSingle();

  if (packErr) return NextResponse.json({ error: packErr.message }, { status: 500 });
  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  const appUrl = getAppUrl();
  const locusBase = getLocusApiBase();
  const locusKey = getLocusApiKey();

  // Common failure di beta: wallet masih "deploying", sehingga create checkout session bisa error.
  // Kita check dulu supaya error-nya jelas.
  try {
    const statusResp = await fetch(`${locusBase}/status`, {
      headers: { Authorization: `Bearer ${locusKey}` },
      cache: "no-store",
    });
    const statusJson = (await statusResp.json().catch(() => null)) as any;
    const walletStatus =
      statusJson?.data?.walletStatus ??
      statusJson?.walletStatus ??
      statusJson?.data?.status ??
      null;
    if (walletStatus && String(walletStatus).toLowerCase().includes("deploy")) {
      return NextResponse.json(
        {
          error: "Locus wallet masih deploying. Tunggu sampai ready lalu coba lagi.",
          walletStatus,
        },
        { status: 503 },
      );
    }
  } catch {
    // kalau status check gagal, lanjut aja (jangan block)
  }

  const webhookUrl = `${appUrl}/api/webhooks/locus`;

  const payload = {
    amount: Number(pack.price_usdc).toFixed(2),
    description: `Unlock: ${pack.title}`,
    successUrl: `${appUrl}/chat/${pack.id}?paid=1`,
    cancelUrl: `${appUrl}/pack/${pack.id}?cancelled=1`,
    webhookUrl,
    metadata: {
      buyerId: body.buyerId,
      packId: pack.id,
    },
  };

  const resp = await fetch(`${locusBase}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${locusKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = (await resp.json().catch(() => null)) as any;
  if (!resp.ok) {
    // Perjelas: sering terjadi kalau NEXT_PUBLIC_APP_URL masih localhost / belum https (webhook/redirect),
    // atau akun belum di-claim, atau wallet belum siap.
    return NextResponse.json(
      { error: "Failed to create Locus session", status: resp.status, details: json },
      { status: 502 },
    );
  }

  // Coba normalize beberapa kemungkinan shape response:
  const data = json?.data ?? json;
  const sessionId = data?.id ?? data?.sessionId;
  const checkoutUrl = data?.checkoutUrl ?? data?.url;
  const webhookSecret = data?.webhookSecret ?? data?.whsec ?? data?.webhook_secret;

  if (!sessionId) {
    return NextResponse.json(
      { error: "Unexpected Locus response (missing session id)", details: json },
      { status: 502 },
    );
  }

  // Simpan mapping untuk verifikasi webhook nanti
  const { error: insertErr } = await sb.from("checkout_sessions").insert({
    session_id: sessionId,
    buyer_id: body.buyerId,
    pack_id: pack.id,
    webhook_secret: webhookSecret ?? null,
    checkout_url: checkoutUrl ?? null,
    status: "PENDING",
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ sessionId, checkoutUrl });
}
