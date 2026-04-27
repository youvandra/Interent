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
    '  "notes": "<one-sentence explanation>"',
    "}",
    "Supported tools (use these when possible):",
    JSON.stringify(supportedTools),
    "If a required step is not supported yet, still include it with missing=true and a best-guess tool in provider/endpoint format.",
    "Allowed provider slugs (for tool field):",
    JSON.stringify(providerSlugs),
    "Rules:",
    "- Prefer the shortest chain that satisfies the request.",
    "- If the user mentions a URL/link and extracting content, include firecrawl_scrape.",
    "- If the user mentions translation, include translate_deepl.",
    "- If the user mentions audio/tts, include openai_tts.",
    "- Otherwise, fallback to openai_chat.",
  ].join("\n");

  let steps: PlanStep[] | null = null;
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
    notes = String(parsed?.notes || "");
  } catch {
    steps = fallbackPlan(text);
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
    const taskId = s.taskId || taskIdFromTool || null;
    const task = taskId ? byTaskId.get(taskId) : null;

    const missing = Boolean(s.missing) || !task;
    const price = task ? Number(task.price_usdc) : 0;
    const label = s.label || task?.title || (tool ? tool : "Unknown tool");

    return {
      taskId: task?.id ?? null,
      tool: tool || (task ? `${task.provider}/${task.endpoint}` : null),
      label,
      missing,
      priceUsdc: price.toFixed(2),
    };
  });

  const total = normalizedSteps.reduce((sum, s) => sum + (s.missing ? 0 : Number(s.priceUsdc)), 0);

  return NextResponse.json({
    steps: normalizedSteps,
    totalPriceUsdc: total.toFixed(2),
    notes,
  });
}
