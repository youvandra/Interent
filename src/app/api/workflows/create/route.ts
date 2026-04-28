import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getAppUrl, getLocusApiBase, getLocusApiKey } from "@/lib/locus";
import { randomToken, sha256Hex } from "@/lib/auth";
import { executeJobNow } from "@/lib/execute-job";

type Body = {
  buyerId?: string;
  prompt?: string;
  steps?: Array<{ taskId: string; label?: string; priceUsdc?: string }>;
  totalPriceUsdc?: string;
  expectedOutputs?: string[];
  promoCode?: string;
};

export async function POST(req: Request) {
  const { buyerId, prompt, steps, totalPriceUsdc, expectedOutputs, promoCode } = (await req.json()) as Body;
  if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (!Array.isArray(steps) || steps.length === 0)
    return NextResponse.json({ error: "steps required" }, { status: 400 });

  const expectedPromo = (process.env.PROMO_CODE || "").trim();
  const promoOk =
    Boolean(expectedPromo) &&
    typeof promoCode === "string" &&
    promoCode.trim().length > 0 &&
    promoCode.trim().toUpperCase() === expectedPromo.toUpperCase();

  const total = Number(totalPriceUsdc ?? "0");
  if (!promoOk && (!Number.isFinite(total) || total <= 0)) {
    return NextResponse.json({ error: "totalPriceUsdc required" }, { status: 400 });
  }

  const sb = supabaseServer();

  // Ensure workflow task exists.
  const { data: wfTask } = await sb.from("tasks").select("*").eq("id", "workflow").maybeSingle();
  if (!wfTask) {
    return NextResponse.json(
      { error: 'Missing task "workflow" in database. Re-run supabase-schema.sql.' },
      { status: 500 },
    );
  }

  // Validate that every step refers to a supported taskId
  const stepIds = Array.from(new Set(steps.map((s) => s.taskId))).filter(Boolean);
  const { data: stepTasks } = await sb.from("tasks").select("id").in("id", stepIds);
  const stepSet = new Set((stepTasks ?? []).map((t: any) => t.id));
  const missing = stepIds.filter((id) => !stepSet.has(id));
  if (missing.length) {
    return NextResponse.json(
      { error: `Unsupported tools in workflow: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const jobToken = randomToken("job_live_");
  const jobTokenHash = sha256Hex(jobToken);

  const { data: jobRow, error: jobErr } = await sb
    .from("jobs")
    .insert({
      buyer_id: buyerId,
      task_id: "workflow",
      status: "PENDING_PAYMENT",
      input_json: {
        kind: "workflow",
        prompt,
        steps,
        expectedOutputs: Array.isArray(expectedOutputs) ? expectedOutputs : [],
        ...(promoOk ? { promoApplied: true } : {}),
      },
      job_token_hash: jobTokenHash,
    })
    .select("id")
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  const jobId = jobRow?.id;
  if (!jobId) return NextResponse.json({ error: "Failed to create job" }, { status: 500 });

  // Promo: free checkout (skip Locus session) and run immediately.
  if (promoOk) {
    const paidAt = new Date().toISOString();
    // Fire-and-forget execution; job page will poll status/result.
    void executeJobNow(jobId, { txHash: null, paidAt });
    return NextResponse.json({ jobId, jobToken, promoApplied: true });
  }

  const appUrl = getAppUrl();
  if (!/^https:\/\//i.test(appUrl)) {
    return NextResponse.json(
      {
        error:
          "NEXT_PUBLIC_APP_URL must be HTTPS for checkout session creation.",
        appUrl,
      },
      { status: 400 },
    );
  }

  const locusBase = getLocusApiBase();
  const locusKey = getLocusApiKey();
  const webhookUrl = `${appUrl}/api/webhooks/locus`;

  const payload = {
    // keep USDC precision (6 decimals) so UI total matches charged amount
    amount: total.toFixed(6),
    description: `Interent workflow (${steps.length} steps)`,
    successUrl: `${appUrl}/jobs/${jobId}`,
    cancelUrl: `${appUrl}/input?text=${encodeURIComponent(prompt)}`,
    webhookUrl,
    metadata: { jobId, buyerId, kind: "workflow" },
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
      { error: "Failed to create Locus session", status: resp.status, details: json },
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
