import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { planWithProvider } from "@/lib/planner";

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

// Token pricing: price_usdc on `tasks` is interpreted as "$ per 1M tokens".
// (Example: 0.10 means $0.10 / 1M tokens.)
const DEFAULT_PRICE_PER_1M_TOKENS_USDC = 0.1;

function estimateTokensFromText(s: string) {
  // very rough heuristic: ~4 chars per token
  const chars = (s || "").length;
  return Math.max(1, Math.ceil(chars / 4));
}

function estimateStepTokens(opts: {
  endpoint: string;
  prompt: string;
  prevTextTokens: number;
}) {
  const endpoint = (opts.endpoint || "").toLowerCase();
  const promptTokens = estimateTokensFromText(opts.prompt);
  const inputTokens = Math.max(opts.prevTextTokens, promptTokens);

  // Heuristic output sizes by endpoint (tune later).
  let outputTokens = 0;
  // NOTE: This is intentionally conservative-but-not-tiny so pricing doesn't become "micro-cents".
  // We treat some non-LLM tools (scrape/search/extract) as generating large text payloads.
  if (endpoint === "scrape") outputTokens = 120_000;
  else if (endpoint === "extract") outputTokens = 80_000;
  else if (endpoint === "search") outputTokens = 25_000;
  else if (endpoint === "translate") outputTokens = inputTokens;
  else if (endpoint === "chat") outputTokens = 4_000;
  // Image/TTS are "token-equivalent" estimates for pricing, not actual text tokens.
  else if (endpoint === "image-generate") outputTokens = 100_000;
  else if (endpoint === "tts") outputTokens = 30_000;
  else outputTokens = 300;

  // Cap to avoid runaway estimates.
  outputTokens = Math.min(outputTokens, 200_000);

  const totalTokens = inputTokens + outputTokens;
  // Only some endpoints produce text that should become the next step's "context".
  const producesTextContext = ["scrape", "extract", "search", "translate", "chat"].includes(endpoint);
  const nextTextTokens = producesTextContext ? outputTokens : inputTokens;
  return { promptTokens, inputTokens, outputTokens, totalTokens, nextTextTokens };
}

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
  if (/report|dashboard|summary|analy(s|z)e|insight|brief/.test(l) || /report|dashboard|summary|ringkas|analisis/.test(t)) {
    return "openai_chat";
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
  const wantsReport = /report|dashboard|summary|ringkas|analisis|analysis/.test(t);

  const steps: PlanStep[] = [];
  if (wantsScrape) steps.push({ taskId: "firecrawl_scrape", label: "Web Scrape (Firecrawl)", tool: "firecrawl/scrape" });
  if (wantsTranslate) steps.push({ taskId: "translate_deepl", label: "Translate (DeepL)", tool: "deepl/translate" });
  if (wantsTts) steps.push({ taskId: "openai_tts", label: "Text-to-Speech (OpenAI)", tool: "openai/tts" });
  if (wantsReport) steps.push({ taskId: "openai_chat", label: "LLM Chat (OpenAI)", tool: "openai/chat" });
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
    "- If the user wants web scraping/research but does NOT provide a URL, prefer: firecrawl_search -> firecrawl_scrape.",
    "- If the user mentions translation, include translate_deepl.",
    "- If the user mentions audio/tts, include openai_tts.",
    "- If the user asks for a report/dashboard/summary, include openai_chat as the final step.",
    "- Otherwise, fallback to openai_chat.",
  ].join("\n");

  let steps: PlanStep[] | null = null;
  let expectedOutputs: OutputOption[] | null = null;
  let notes = "";
  try {
    const planned = await planWithProvider({ system, userText: text });
    steps = Array.isArray(planned.steps) ? planned.steps : null;
    expectedOutputs = Array.isArray(planned.expectedOutputs) ? planned.expectedOutputs : null;
    notes = planned.notes || "";
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

  // Normalize steps, detect missing, and estimate tokens + price sequentially.
  const normalizedSteps: Array<{
    taskId: string | null;
    tool: string | null;
    label: string;
    missing: boolean;
    tokenEstimate: { input: number; output: number; total: number };
    priceUsdc: string;
  }> = [];

  // token context (what the next step will likely receive as text)
  let prevTextTokens = estimateTokensFromText(text);

  for (const s of steps ?? []) {
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
    const label = task ? String(task.title) : s.label || (tool ? tool : "Unknown tool");
    const endpoint = (task?.endpoint ?? tool.split("/")[1] ?? "").toString();

    const tok = estimateStepTokens({ endpoint, prompt: text, prevTextTokens });
    prevTextTokens = tok.nextTextTokens;

    const pricePer1M = task ? Number(task.price_usdc) : DEFAULT_PRICE_PER_1M_TOKENS_USDC;
    // Use micro-USDC integer math (1e6). If pricePer1M=$0.10:
    // microUSDC = round(tokens * 0.10)
    const stepMicro = missing ? 0 : Math.round(tok.totalTokens * pricePer1M);
    const priceUsdc = (stepMicro / 1_000_000).toFixed(6);

    normalizedSteps.push({
      taskId: task?.id ?? null,
      tool: tool || (task ? `${task.provider}/${task.endpoint}` : null),
      label,
      missing,
      tokenEstimate: { input: tok.inputTokens, output: tok.outputTokens, total: tok.totalTokens },
      priceUsdc,
    });
  }

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
    pricingModel: { defaultPricePer1MTokensUsdc: DEFAULT_PRICE_PER_1M_TOKENS_USDC },
    subtotalToolsUsdc: fromMicro(subtotalMicro),
    serviceFeeUsdc: fromMicro(serviceFeeMicro),
    serviceFeeRate: SERVICE_FEE_RATE,
    totalPriceUsdc: fromMicro(totalMicro),
    expectedOutputs: (expectedOutputs ?? fallbackOutputs(text)).slice(0, 6),
    notes,
  });
}
