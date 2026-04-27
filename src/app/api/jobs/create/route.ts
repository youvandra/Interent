import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getAppUrl, getLocusApiBase, getLocusApiKey } from "@/lib/locus";
import { randomToken, sha256Hex } from "@/lib/auth";

type Body = {
  taskId?: string;
  buyerId?: string;
  input?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const { taskId, buyerId, input } = (await req.json()) as Body;
  if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });
  if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });

  const sb = supabaseServer();
  const { data: task, error: taskErr } = await sb
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();

  if (taskErr) return NextResponse.json({ error: taskErr.message }, { status: 500 });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const jobToken = randomToken("job_live_");
  const jobTokenHash = sha256Hex(jobToken);

  const { data: jobRow, error: jobErr } = await sb
    .from("jobs")
    .insert({
      buyer_id: buyerId,
      task_id: task.id,
      status: "PENDING_PAYMENT",
      input_json: input ?? null,
      job_token_hash: jobTokenHash,
    })
    .select("id")
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  const jobId = jobRow?.id;
  if (!jobId) return NextResponse.json({ error: "Failed to create job" }, { status: 500 });

  const appUrl = getAppUrl();
  // Locus checkout session creation often fails if the URL isn't publicly reachable over HTTPS.
  // If you're doing local dev, deploy to Vercel or use a tunnel (ngrok/cloudflared),
  // and set NEXT_PUBLIC_APP_URL to that public https URL.
  if (!/^https:\/\//i.test(appUrl)) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_APP_URL must be a public HTTPS URL to create a checkout session. Deploy to Vercel or use a tunnel, then set NEXT_PUBLIC_APP_URL to that https URL.",
        appUrl,
      },
      { status: 400 },
    );
  }
  const locusBase = getLocusApiBase();
  const locusKey = getLocusApiKey();
  const webhookUrl = `${appUrl}/api/webhooks/locus`;

  // Guard: create-session can fail while the wallet is deploying.
  try {
    const statusResp = await fetch(`${locusBase}/status`, {
      headers: { Authorization: `Bearer ${locusKey}` },
      cache: "no-store",
    });
    const statusJson = (await statusResp.json().catch(() => null)) as any;
    const walletStatus =
      statusJson?.data?.walletStatus ?? statusJson?.walletStatus ?? null;
    // BUGFIX: don't use `includes("deploy")` because it also matches "deployed".
    // Only block if it's exactly "deploying".
    const ws = walletStatus ? String(walletStatus).toLowerCase() : "";
    if (ws === "deploying") {
      return NextResponse.json(
        { error: "Locus wallet is still deploying. Please try again in a few minutes.", walletStatus },
        { status: 503 },
      );
    }
  } catch {
    // ignore
  }

  const payload = {
    amount: Number(task.price_usdc).toFixed(2),
    description: `Interent task: ${task.title}`,
    successUrl: `${appUrl}/jobs/${jobId}`,
    cancelUrl: `${appUrl}/task/${task.id}`,
    webhookUrl,
    metadata: { jobId, taskId: task.id, buyerId },
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
    return NextResponse.json(
      {
        error: "Failed to create Locus session",
        status: resp.status,
        details: json,
        debug: {
          locusBase,
          // do not log the API key
          webhookUrl,
          successUrl: payload.successUrl,
          cancelUrl: payload.cancelUrl,
          amount: payload.amount,
        },
      },
      { status: 502 },
    );
  }

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

  await sb
    .from("jobs")
    .update({
      session_id: sessionId,
      webhook_secret: webhookSecret ?? null,
      checkout_url: checkoutUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return NextResponse.json({ jobId, jobToken, sessionId, checkoutUrl });
}
