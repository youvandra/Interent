export type PlannerStep = {
  taskId?: string;
  label: string;
  tool?: string; // provider/endpoint
  missing?: boolean;
};

export type PlannerOutputOption = {
  id: string;
  label: string;
  description: string;
  defaultSelected?: boolean;
};

export type PlannerResult = {
  steps: PlannerStep[];
  expectedOutputs: PlannerOutputOption[];
  notes: string;
  provider: "ai_provider";
  model?: string;
};

function parseJsonLenient(s: string): any {
  const raw = String(s || "").trim();
  // 1) Try direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }
  // 2) Try to extract the first JSON object block
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const candidate = raw.slice(first, last + 1);
    return JSON.parse(candidate);
  }
  throw new Error("Planner returned non-JSON content");
}

function getAiProviderBase(): string {
  return (process.env.AI_PROVIDER_BASE || "https://ai.sumopod.com").replace(/\/$/, "");
}

function getAiProviderKey(): string {
  const key = process.env.AI_PROVIDER_API_KEY || process.env.AI_PROVIDER_KEY;
  if (!key) throw new Error("AI_PROVIDER_API_KEY is not set");
  return key;
}

function getAiProviderModel(): string {
  return process.env.AI_PROVIDER_MODEL || "gpt-5-nano";
}

async function callAiProvider(system: string, user: string): Promise<{ content: string; model?: string }> {
  const base = getAiProviderBase();
  const key = getAiProviderKey();
  const model = getAiProviderModel();

  // Expect OpenAI-compatible Chat Completions:
  // POST {base}/v1/chat/completions
  // Authorization: Bearer {key}
  const resp = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const json = (await resp.json().catch(() => null)) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!resp.ok || !content) {
    throw new Error(`AI provider response missing content status=${resp.status} body=${JSON.stringify(json)}`);
  }
  return { content, model };
}

export async function planWithProvider(opts: {
  system: string;
  userText: string;
}): Promise<PlannerResult> {
  const { content, model } = await callAiProvider(opts.system, opts.userText);

  const parsed = parseJsonLenient(content);
  const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
  const expectedOutputs = Array.isArray(parsed?.expectedOutputs) ? parsed.expectedOutputs : [];
  const notes = String(parsed?.notes || "");

  return {
    steps,
    expectedOutputs,
    notes,
    provider: "ai_provider",
    model,
  };
}
