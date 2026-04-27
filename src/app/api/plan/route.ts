import { NextResponse } from "next/server";
import { getOpenRouterApiKey, OPENROUTER_BASE } from "@/lib/openrouter";
import { supabaseServer } from "@/lib/supabase/server";

type Body = { text?: string };

type PlanStep = {
  taskId?: string;
  label: string;
  tool?: string; // provider/endpoint, e.g. "firecrawl/scrape"
  missing?: boolean;
  params?: Record<string, unknown>;
};

type OutputOption = {
  id: string;
  label: string;
  description: string;
  defaultSelected?: boolean;
};

function inferSupportedTaskId(label: string, userText: string) {
  const l = (label || "").toLowerCase();
  const t = (userText || "").toLowerCase();

  // Common workflow intent → supported tools (demo defaults)
  if (
    /scrape|extract|article|body|website|url|link|http/.test(l) ||
    /http|url|link/.test(t)
  ) {
    return "firecrawl_scrape";
  }
  if (
    /translate|translation|terjemah|spanish|indonesian|english|japanese|korean|chinese/.test(l) ||
    /translate|terjemah|spanish|indonesian|english|japanese|korean|chinese/.test(t)
  ) {
    return "translate_deepl";
  }
  if (/tts|text-to-speech|speech|audio|voice|mp3|wav/.test(l) || /tts|audio|voice/.test(t)) {
    return "openai_tts";
  }
  return null;
}

function fallbackOutputs(text: string): OutputOption[] {
  const t = text.toLowerCase();
  const wantsScrape = /http|url|link|scrape|crawl|extract|article|website/.test(t);
  const wantsTranslate = /translate|spanish|indonesian|english|japanese|korean|chinese|terjemah/.test(t);
  const wantsTts = /audio|tts|speech|voice|mp3|wav/.test(t);
  const wantsImage = /image|generate image|text-to-image|illustration/.test(t);

  const opts: OutputOption[] = [];
  if (wantsScrape) {
    opts.push({
      id: "extracted_text",
      label: "Extracted content",
      description: "Clean article/body text (or markdown) extracted from the URL.",
      defaultSelected: true,
    });
  }
  if (wantsTranslate) {
    opts.push({
      id: "translated_text",
      label: "Translated text",
      description: "Final translated text in your target language.",
      defaultSelected: true,
    });
  }
  if (wantsTts) {
    opts.push({
      id: "audio_file",
      label: "Audio file (MP3)",
      description: "Speech audio generated from the final text output.",
      defaultSelected: true,
    });
  }
  if (wantsImage) {
    opts.push({
      id: "generated_image",
      label: "Generated image",
      description: "An image output (base64 or URL, depending on provider).",
      defaultSelected: true,
    });
  }

  if (!opts.length) {
    opts.push({
      id: "json_result",
      label: "JSON result",
      description: "Raw JSON output from the workflow steps.",
      defaultSelected: true,
    });
  }
  return opts;
}

function fallbackPlan(text: string): PlanStep[] {
  const t = text.toLowerCase();
  const wantsScrape = /http|link|url|scrap|crawl|website/.test(t);
  const wantsTranslate = /translate|terjemah|indo|indonesia|english|japanese|korean|chinese/.test(t);
  const wantsTts = /audio|tts|voice|speech|mp3|wav|suara/.test(t);

  const steps: PlanStep[] = [];
  if (wantsScrape) steps.push({ taskId: "firecrawl_scrape", label: "Web Scrape (Firecrawl)", tool: "firecrawl/scrape" });
  if (wantsTranslate) steps.push({ taskId: "translate_deepl", label: "Translate (DeepL)", tool: "deepl/translate" });
  if (wantsTts) steps.push({ taskId: "openai_tts", label: "Text-to-Speech (OpenAI)", tool: "openai/tts" });
  if (steps.length === 0) steps.push({ taskId: "openai_chat", label: "LLM Chat (OpenAI)", tool: "openai/chat" });
  return steps;
}

export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as Body;
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const sb = supabaseServer();

  // Use the DB as the source of truth for supported tools.
  const { data: supported } = await sb
    .from("tasks")
    .select("id, title, provider, endpoint, price_usdc")
    .neq("id", "workflow");

  const supportedTools = (supported ?? []).map((t: any) => ({
    taskId: t.id,
    label: t.title,
    tool: `${t.provider}/${t.endpoint}`,
  }));

  // Provider list (for missing tool display). From Locus docs.
  const providerSlugs = [
    "openai",
    "gemini",
    "firecrawl",
    "exa",
    "clado",
    "apollo",
    "browser-use",
    "x",
    "fal",
    "abstract-api",
    "anthropic",
    "deepseek",
    "grok",
    "perplexity",
    "replicate",
    "stability-ai",
    "suno",
    "mathpix",
    "deepgram",
    "alpha-vantage",
    "sec-edgar",
    "rentcast",
    "openweather",
    "diffbot",
    "builtwith",
    "hunter",
    "ipinfo",
    "whitepages",
    "ofac",
    "judge0",
    "mapbox",
    "brave",
    "coingecko",
    "deepl",
    "groq",
    "mistral",
    "screenshotone",
    "tavily",
    "virustotal",
    "wolframalpha",
    "billboard",
  ];

  const system = [
    "You are a task router for Interent, a pay-per-use AI microservices marketplace.",
    "Given a user's natural-language request, output a minimal toolchain.",
    "Return STRICT JSON (no markdown) with this shape:",
    "{",
    '  "steps": [',
    '    { "taskId": "<supported taskId OR empty>", "tool": "<provider/endpoint>", "label": "<human label>", "missing": <true|false> }',
    "  ],",
    '  "expectedOutputs": [',
    '    { "id": "short_id", "label": "Short label", "description": "What the user will get", "defaultSelected": true }',
    "  ],",
    '  "notes": "<one-sentence explanation>"',
    "}",
    "Supported tools (use these when possible):",
    JSON.stringify(supportedTools),
    "If a required step is not supported yet, still include it with missing=true and a best-guess tool in provider/endpoint format.",
    "Allowed provider slugs (for tool field):",
    JSON.stringify(providerSlugs),
    "For expectedOutputs, include 2-5 items. Prefer: extracted_text, translated_text, audio_file, json_result.",
    "Rules:",
    "- Prefer the shortest chain that satisfies the request.",
    "- If the user mentions a URL/link and extracting content, include firecrawl_scrape.",
    "- If the user mentions translation, include translate_deepl.",
    "- If the user mentions audio/tts, include openai_tts.",
    "- Otherwise, fallback to openai_chat.",
  ].join("\n");

  let steps: PlanStep[] | null = null;
  let expectedOutputs: OutputOption[] | null = null;
  let notes = "";
  try {
    const key = getOpenRouterApiKey();
    const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // recommended metadata for OpenRouter
        "HTTP-Referer": "https://interent.vercel.app",
        "X-Title": "Interent",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b:free",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const json = (await resp.json().catch(() => null)) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!resp.ok || !content) throw new Error("OpenRouter response missing content");
    const parsed = JSON.parse(content);
    steps = Array.isArray(parsed?.steps) ? parsed.steps : null;
    expectedOutputs = Array.isArray(parsed?.expectedOutputs) ? parsed.expectedOutputs : null;
    notes = String(parsed?.notes || "");
  } catch {
    steps = fallbackPlan(text);
    expectedOutputs = fallbackOutputs(text);
    notes = "Fallback planner was used.";
  }

  // Normalize, detect missing, and price supported steps.
  const byTaskId = new Map<string, any>((supported ?? []).map((t: any) => [t.id, t]));
  const byTool = new Map<string, any>(
    (supported ?? []).map((t: any) => [`${t.provider}/${t.endpoint}`.toLowerCase(), t]),
  );

  const normalizedSteps = (steps ?? []).map((s) => {
    const tool = (s.tool || "").toLowerCase();
    const taskIdFromTool = tool ? byTool.get(tool)?.id : null;
    let taskId = s.taskId || taskIdFromTool || null;
    let task = taskId ? byTaskId.get(taskId) : null;

    // If model returned generic labels, map them to supported tools.
    if (!task) {
      const inferred = inferSupportedTaskId(s.label, text);
      if (inferred) {
        taskId = inferred;
        task = byTaskId.get(inferred) ?? null;
      }
    }

    const missing = Boolean(s.missing) || !task;
    const price = task ? Number(task.price_usdc) : 0;
    // If supported, always use canonical label from DB (prevents generic labels in UI).
    const label = task ? String(task.title) : s.label || (tool ? tool : "Unknown tool");

    return {
      taskId: task?.id ?? null,
      tool: tool || (task ? `${task.provider}/${task.endpoint}` : null),
      label,
      missing,
      // keep precision for transparent totals (USDC has 6 decimals)
      priceUsdc: price.toFixed(6),
    };
  });

  // Use micro-USDC integer math to avoid floating drift.
  const SCALE = 1_000_000;
  const toMicro = (n: number) => Math.round(n * SCALE);
  const fromMicro = (m: number) => (m / SCALE).toFixed(6);

  const subtotalMicro = normalizedSteps.reduce(
    (sum, s) => sum + (s.missing ? 0 : toMicro(Number(s.priceUsdc))),
    0,
  );

  // Service fee: 5% of subtotal tools (MVP pricing rule).
  const SERVICE_FEE_RATE = 0.05;
  const serviceFeeMicro = Math.round(subtotalMicro * SERVICE_FEE_RATE);
  const totalMicro = subtotalMicro + serviceFeeMicro;

  return NextResponse.json({
    steps: normalizedSteps,
    subtotalToolsUsdc: fromMicro(subtotalMicro),
    serviceFeeUsdc: fromMicro(serviceFeeMicro),
    serviceFeeRate: SERVICE_FEE_RATE,
    totalPriceUsdc: fromMicro(totalMicro),
    expectedOutputs: (expectedOutputs ?? fallbackOutputs(text)).slice(0, 6),
    notes,
  });
}
