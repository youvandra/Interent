import { supabaseServer } from "@/lib/supabase/server";
import { callWrappedApi } from "@/lib/locus_wrapped";
import { formatWorkflowResult } from "@/lib/format-result";

function extractFirstUrl(text: string) {
  const m = text.match(/https?:\/\/\S+/i);
  return m?.[0] ?? null;
}

function collectUrlsFromAny(x: any, out = new Set<string>()): string[] {
  if (!x) return Array.from(out);
  if (typeof x === "string") {
    const matches = x.match(/https?:\/\/[^\s"')\]]+/gi) || [];
    for (const u of matches) out.add(u);
    return Array.from(out);
  }
  if (Array.isArray(x)) {
    for (const v of x) collectUrlsFromAny(v, out);
    return Array.from(out);
  }
  if (typeof x === "object") {
    for (const v of Object.values(x)) collectUrlsFromAny(v, out);
    return Array.from(out);
  }
  return Array.from(out);
}

function extractStringByKeysDeep(x: any, keys: string[]): string | null {
  if (!x) return null;
  if (typeof x === "string") return null;
  if (Array.isArray(x)) {
    for (const v of x) {
      const found = extractStringByKeysDeep(v, keys);
      if (found) return found;
    }
    return null;
  }
  if (typeof x === "object") {
    for (const k of keys) {
      if (typeof (x as any)[k] === "string") return (x as any)[k];
    }
    for (const v of Object.values(x)) {
      const found = extractStringByKeysDeep(v, keys);
      if (found) return found;
    }
  }
  return null;
}

async function guessUrlForPrompt(prompt: string): Promise<string | null> {
  // Best-effort: if the user did not provide a URL, do a quick web search via wrapped APIs,
  // then scrape the top result.
  try {
    const search = await callWrappedApi("firecrawl", "search", { query: prompt });
    const urls = collectUrlsFromAny(search);
    return urls[0] ?? null;
  } catch {
    // fallthrough
  }
  try {
    const search = await callWrappedApi("exa", "search", { query: prompt, numResults: 5 });
    const urls = collectUrlsFromAny(search);
    return urls[0] ?? null;
  } catch {
    return null;
  }
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
      extractStringByKeysDeep(data, ["markdown", "content", "text"]) ||
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

  return extractStringByKeysDeep(data, ["text", "content", "markdown", "result", "output"]);
}

function inferDeepLSourceLang(prompt: string, targetLang: string): string | null {
  // Simple heuristic: if the prompt looks like English and we're translating away from EN, set source_lang=EN.
  const looksEnglish = /[a-z]/i.test(prompt) && !/[^\x00-\x7F]/.test(prompt);
  if (looksEnglish && targetLang !== "EN") return "EN";
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
      const wfExpectedOutputs = Array.isArray((input as any)?.expectedOutputs)
        ? ((input as any).expectedOutputs as string[])
        : [];
      const outputs: any[] = [];

      let lastText: string | null = null;
      let url = extractFirstUrl(wfPrompt);
      const deeplTarget = inferDeepLTargetLang(wfPrompt);
      const deeplSource = inferDeepLSourceLang(wfPrompt, deeplTarget);

      for (const step of steps) {
        const meta = stepMap.get(step.taskId);
        if (!meta) throw new Error(`Unknown taskId in workflow: ${step.taskId}`);

        const provider = meta.provider;
        const endpoint = meta.endpoint;

        let body: any = {};

        if (endpoint === "scrape") {
          if (!url) url = await guessUrlForPrompt(wfPrompt);
          if (!url) throw new Error("No URL found (and could not auto-find one) for scrape");
          body = { url, formats: ["markdown"] };
        } else if (endpoint === "search") {
          body = { query: wfPrompt };
        } else if (endpoint === "extract") {
          if (!url) url = await guessUrlForPrompt(wfPrompt);
          if (!url) throw new Error("No URL found (and could not auto-find one) for extract");
          body = { urls: [url] };
        } else if (endpoint === "translate") {
          // If we don't have text yet, fall back to extracting text from the last step,
          // and if that still fails, use the original prompt (best-effort, not rigid).
          if (!lastText && outputs.length) {
            const prev = outputs[outputs.length - 1]?.data;
            const prevText = extractTextFromResult("unknown", "unknown", prev);
            if (prevText) lastText = prevText;
          }
          if (!lastText) lastText = wfPrompt;
          body = {
            text: [lastText],
            target_lang: deeplTarget,
            ...(deeplSource ? { source_lang: deeplSource } : {}),
          };
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

      const pretty = await formatWorkflowResult({
        prompt: wfPrompt,
        expectedOutputs: wfExpectedOutputs,
        steps: outputs,
        finalText: lastText,
      });

      result = {
        kind: "workflow",
        prompt: wfPrompt,
        steps: outputs,
        finalText: lastText,
        ...(pretty?.prettyText ? { prettyText: pretty.prettyText } : {}),
      };
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
