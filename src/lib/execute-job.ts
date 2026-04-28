import { supabaseServer } from "@/lib/supabase/server";
import { callWrappedApi } from "@/lib/locus_wrapped";

function extractFirstUrl(text: string) {
  const m = text.match(/https?:\/\/\S+/i);
  return m?.[0] ?? null;
}

function inferDeepLTargetLang(text: string): string {
  const t = text.toLowerCase();
  if (/(spanish|español|espanol)\b/.test(t)) return "ES";
  if (/(indonesian|bahasa|indonesia|indo)\b/.test(t)) return "ID";
  if (/\benglish\b|\ben\b/.test(t)) return "EN";
  if (/\bjapanese\b|\bja\b/.test(t)) return "JA";
  if (/\bkorean\b|\bko\b/.test(t)) return "KO";
  if (/\bchinese\b|\bzh\b/.test(t)) return "ZH";
  return "EN";
}

function extractTextFromResult(provider: string, endpoint: string, data: any): string | null {
  if (!data) return null;

  if (provider === "firecrawl") {
    return (
      (typeof data?.markdown === "string" && data.markdown) ||
      (typeof data?.content === "string" && data.content) ||
      null
    );
  }

  if (provider === "deepl" || endpoint === "translate") {
    const v =
      data?.translations?.[0]?.text ??
      data?.text ??
      (Array.isArray(data?.translations)
        ? data.translations.map((x: any) => x?.text).filter(Boolean).join("\n")
        : null);
    return typeof v === "string" ? v : null;
  }

  if (provider === "openai" && endpoint === "chat") {
    const v = data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? null;
    return typeof v === "string" ? v : null;
  }

  if (provider === "gemini" && endpoint === "chat") {
    const v =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("\n") ??
      data?.text ??
      null;
    return typeof v === "string" ? v : null;
  }

  for (const k of ["text", "content", "output", "result"]) {
    if (typeof data?.[k] === "string") return data[k];
  }

  return null;
}

export async function executeJobNow(jobId: string, opts?: { txHash?: string | null; paidAt?: string | null }) {
  const sb = supabaseServer();

  const { data: job, error: jobErr } = await sb.from("jobs").select("*").eq("id", jobId).maybeSingle();
  if (jobErr || !job) throw new Error(jobErr?.message || "Job not found");

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
    return;
  }

  const txHash = opts?.txHash ?? null;
  const paidAt = opts?.paidAt ?? null;

  await sb
    .from("jobs")
    .update({
      status: "RUNNING",
      paid_at: paidAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  try {
    const input = job.input_json || {};
    let result: unknown = null;

    if (task.id === "workflow") {
      const steps = (input as any)?.steps as Array<{ taskId: string }>;
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error("Missing workflow steps");
      }

      const stepIds = Array.from(new Set(steps.map((s) => s.taskId)));
      const { data: stepTasks, error: stepTasksErr } = await sb
        .from("tasks")
        .select("id, provider, endpoint")
        .in("id", stepIds);
      if (stepTasksErr) throw new Error(stepTasksErr.message);

      const stepMap = new Map<string, { provider: string; endpoint: string }>(
        (stepTasks ?? []).map((t: any) => [t.id, { provider: t.provider, endpoint: t.endpoint }]),
      );

      const wfPrompt = String((input as any)?.prompt ?? "");
      const outputs: any[] = [];

      let lastText: string | null = null;
      const url = extractFirstUrl(wfPrompt);
      const deeplTarget = inferDeepLTargetLang(wfPrompt);

      for (const step of steps) {
        const meta = stepMap.get(step.taskId);
        if (!meta) throw new Error(`Unknown taskId in workflow: ${step.taskId}`);

        const provider = meta.provider;
        const endpoint = meta.endpoint;

        let body: any = {};

        if (endpoint === "scrape") {
          if (!url) throw new Error("No URL found in prompt for scrape");
          body = { url, formats: ["markdown"] };
        } else if (endpoint === "search") {
          body = { query: wfPrompt };
        } else if (endpoint === "extract") {
          if (!url) throw new Error("No URL found in prompt for extract");
          body = { urls: [url] };
        } else if (endpoint === "translate") {
          if (!lastText) throw new Error("Missing text for translation");
          body = { text: [lastText], target_lang: deeplTarget };
        } else if (endpoint === "chat") {
          const inputText = lastText ?? wfPrompt;
          if (provider === "openai") {
            body = { model: "gpt-4o-mini", messages: [{ role: "user", content: inputText }] };
          } else if (provider === "gemini") {
            body = { model: "gemini-2.5-flash", messages: [{ role: "user", content: inputText }] };
          } else {
            body = { model: "default", messages: [{ role: "user", content: inputText }] };
          }
        } else if (endpoint === "tts") {
          const inputText = lastText ?? wfPrompt;
          body = { model: provider === "openai" ? "gpt-4o-mini-tts" : "tts-1", input: inputText, voice: "alloy", response_format: "mp3" };
        } else if (endpoint === "image-generate") {
          const promptText = lastText ?? wfPrompt;
          body = { prompt: promptText };
        } else {
          body = lastText ? { input: lastText } : {};
        }

        const data = await callWrappedApi(provider, endpoint, body);
        outputs.push({ taskId: step.taskId, provider, endpoint, input: body, data });

        const nextText = extractTextFromResult(provider, endpoint, data);
        if (nextText) lastText = nextText;
      }

      result = { kind: "workflow", prompt: wfPrompt, steps: outputs, finalText: lastText };
    } else if (task.id === "ocr_mathpix") {
      const src = (input as any).imageUrl || (input as any).src;
      if (!src) throw new Error("Missing input.imageUrl");
      result = await callWrappedApi(task.provider, task.endpoint, { src, formats: ["text"] });
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
  }
}

