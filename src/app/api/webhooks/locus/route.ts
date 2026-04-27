import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { callWrappedApi } from "@/lib/locus_wrapped";

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
  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  if (!job) return NextResponse.json({ error: "Unknown sessionId" }, { status: 404 });

  // Verify signature (kalau kita punya webhook secret dari create session)
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

    // Mark PAID -> RUNNING
    await sb
      .from("jobs")
      .update({
        status: "RUNNING",
        paid_at: paidAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Load task
    const { data: task, error: taskErr } = await sb
      .from("tasks")
      .select("*")
      .eq("id", job.task_id)
      .maybeSingle();

    if (taskErr || !task) {
      await sb
        .from("jobs")
        .update({
          status: "FAILED",
          error_message: taskErr?.message || "Task not found",
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return NextResponse.json({ ok: false });
    }

    // Execute task (Interent wallet pays per call)
    try {
      const input = job.input_json || {};
      let result: unknown = null;

      if (task.id === "workflow") {
        const steps = (input as any)?.steps as Array<{ taskId: string }>;
        if (!Array.isArray(steps) || steps.length === 0) {
          throw new Error("Missing workflow steps");
        }

        // Fetch task metadata for all steps (provider/endpoint)
        const stepIds = Array.from(new Set(steps.map((s) => s.taskId)));
        const { data: stepTasks, error: stepTasksErr } = await sb
          .from("tasks")
          .select("id, provider, endpoint")
          .in("id", stepIds);
        if (stepTasksErr) throw new Error(stepTasksErr.message);
        const stepMap = new Map<string, { provider: string; endpoint: string }>(
          (stepTasks ?? []).map((t: any) => [t.id, { provider: t.provider, endpoint: t.endpoint }]),
        );

        // Minimal piping for the canonical demo chain:
        // firecrawl_scrape -> translate_deepl -> openai_tts
        const wfPrompt = String((input as any)?.prompt ?? "");
        const outputs: any[] = [];

        let scrapedText: string | null = null;
        let translatedText: string | null = null;

        for (const step of steps) {
          const meta = stepMap.get(step.taskId);
          if (!meta) throw new Error(`Unknown taskId in workflow: ${step.taskId}`);

          if (step.taskId === "firecrawl_scrape") {
            // Expect the user prompt contains a URL; simple extraction
            const urlMatch = wfPrompt.match(/https?:\/\/\S+/);
            const url = urlMatch?.[0];
            if (!url) throw new Error("No URL found in prompt for Firecrawl scrape");
            const data = await callWrappedApi(meta.provider, meta.endpoint, {
              url,
              formats: ["markdown"],
            });
            outputs.push({ taskId: step.taskId, data });
            scrapedText = String((data as any)?.markdown ?? (data as any)?.content ?? JSON.stringify(data));
          } else if (step.taskId === "translate_deepl") {
            if (!scrapedText) throw new Error("Missing scraped text for translation");
            const data = await callWrappedApi(meta.provider, meta.endpoint, {
              text: [scrapedText],
              target_lang: "ID",
            });
            outputs.push({ taskId: step.taskId, data });
            // DeepL shape can vary; keep robust
            translatedText =
              String(
                (data as any)?.translations?.[0]?.text ??
                  (data as any)?.text ??
                  JSON.stringify(data),
              );
          } else if (step.taskId === "openai_tts") {
            if (!translatedText) throw new Error("Missing translated text for TTS");
            const data = await callWrappedApi(meta.provider, meta.endpoint, {
              model: "gpt-4o-mini-tts",
              input: translatedText,
              voice: "alloy",
              response_format: "mp3",
            });
            outputs.push({ taskId: step.taskId, data });
          } else {
            // Generic step: run with empty params (or future: allow params in workflow input)
            const data = await callWrappedApi(meta.provider, meta.endpoint, {});
            outputs.push({ taskId: step.taskId, data });
          }
        }

        result = { kind: "workflow", steps: outputs };
      } else
      if (task.id === "ocr_mathpix") {
        const src = (input as any).imageUrl || (input as any).src;
        if (!src) throw new Error("Missing input.imageUrl");
        result = await callWrappedApi(task.provider, task.endpoint, {
          src,
          formats: ["text"],
        });
      } else if (task.id === "translate_deepl") {
        const text = (input as any).text;
        const targetLang = (input as any).targetLang || "EN";
        const sourceLang = (input as any).sourceLang;
        if (!text) throw new Error("Missing input.text");
        result = await callWrappedApi(task.provider, task.endpoint, {
          text: [String(text)],
          target_lang: String(targetLang),
          ...(sourceLang ? { source_lang: String(sourceLang) } : {}),
        });
      } else {
        // fallback generic
        result = await callWrappedApi(task.provider, task.endpoint, input);
      }

      await sb
        .from("jobs")
        .update({
          status: "DONE",
          result_json: { txHash, provider: task.provider, endpoint: task.endpoint, data: result },
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

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

  // Unknown events: ack biar nggak retry terus
  return NextResponse.json({ ok: true, ignored: true });
}
