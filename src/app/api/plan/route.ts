import { NextResponse } from "next/server";
import { getOpenRouterApiKey, OPENROUTER_BASE } from "@/lib/openrouter";
import { supabaseServer } from "@/lib/supabase/server";

type Body = { text?: string };

type PlanStep = {
  taskId: string;
  label: string;
  params?: Record<string, unknown>;
};

function fallbackPlan(text: string): PlanStep[] {
  const t = text.toLowerCase();
  const wantsScrape = /http|link|url|scrap|crawl|website/.test(t);
  const wantsTranslate = /translate|terjemah|indo|indonesia|english|japanese|korean|chinese/.test(t);
  const wantsTts = /audio|tts|voice|speech|mp3|wav|suara/.test(t);

  const steps: PlanStep[] = [];
  if (wantsScrape) steps.push({ taskId: "firecrawl_scrape", label: "Web Scrape (Firecrawl)" });
  if (wantsTranslate) steps.push({ taskId: "translate_deepl", label: "Translate (DeepL)" });
  if (wantsTts) steps.push({ taskId: "openai_tts", label: "Text-to-Speech (OpenAI)" });
  if (steps.length === 0) steps.push({ taskId: "openai_chat", label: "LLM Chat (OpenAI)" });
  return steps;
}

export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as Body;
  if (!text?.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });

  const sb = supabaseServer();

  // Keep tool catalog minimal for MVP demo.
  const toolCatalog = [
    { taskId: "firecrawl_scrape", label: "Web Scrape (Firecrawl)" },
    { taskId: "translate_deepl", label: "Translate (DeepL)" },
    { taskId: "openai_tts", label: "Text-to-Speech (OpenAI)" },
    { taskId: "ocr_mathpix", label: "OCR (Mathpix)" },
    { taskId: "openai_chat", label: "LLM Chat (OpenAI)" },
  ];

  const system = [
    "You are a task router for Interent, a pay-per-use AI microservices marketplace.",
    "Given a user's natural-language request, output a minimal toolchain using ONLY the tools listed.",
    "Return STRICT JSON (no markdown) with this shape:",
    "{",
    '  "steps": [ { "taskId": "<one of the allowed taskIds>", "label": "<short human label>" } ],',
    '  "notes": "<one-sentence explanation>"',
    "}",
    "Allowed tools:",
    JSON.stringify(toolCatalog),
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

  // Normalize and price.
  const taskIds = Array.from(new Set((steps ?? []).map((s) => s.taskId))).filter(Boolean);
  const { data: tasks } = await sb
    .from("tasks")
    .select("id, title, price_usdc")
    .in("id", taskIds);
  const priceMap = new Map<string, number>((tasks ?? []).map((t: any) => [t.id, Number(t.price_usdc)]));

  const pricedSteps = (steps ?? []).map((s) => {
    const price = priceMap.get(s.taskId) ?? 0.01;
    return { ...s, priceUsdc: price.toFixed(2) };
  });

  const total = pricedSteps.reduce((sum, s) => sum + Number(s.priceUsdc), 0);

  return NextResponse.json({
    steps: pricedSteps,
    totalPriceUsdc: total.toFixed(2),
    notes,
  });
}

