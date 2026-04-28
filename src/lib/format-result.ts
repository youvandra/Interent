type WorkflowStepOutput = {
  taskId?: string;
  provider?: string;
  endpoint?: string;
  input?: any;
  data?: any;
};

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

function safeStringify(x: any, maxLen: number) {
  try {
    const s = JSON.stringify(x, null, 2);
    return s.length > maxLen ? s.slice(0, maxLen) + "\n…(truncated)" : s;
  } catch {
    const s = String(x);
    return s.length > maxLen ? s.slice(0, maxLen) + "…(truncated)" : s;
  }
}

async function callAiProvider(system: string, user: string): Promise<string> {
  const base = getAiProviderBase();
  const key = getAiProviderKey();
  const model = getAiProviderModel();

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
    throw new Error(
      `AI provider format failed status=${resp.status} body=${safeStringify(json, 1500)}`,
    );
  }
  return String(content);
}

export async function formatWorkflowResult(opts: {
  prompt: string;
  expectedOutputs?: string[];
  steps: WorkflowStepOutput[];
  finalText?: string | null;
}): Promise<{ prettyText: string } | null> {
  // Best-effort only.
  try {
    const system = [
      "You are an output formatter for Interent.",
      "Your job: take messy tool outputs from multiple APIs and produce a clean, human-readable answer.",
      "Rules:",
      "- Do NOT mention internal JSON fields unless necessary.",
      "- Prefer short sections with headings and bullets.",
      "- If user asked to translate, output the translated text prominently.",
      "- If scraped data is long, summarize key points and include 5-10 useful links if present.",
      "- Use the same language as the user's prompt unless the prompt explicitly asks for a different output language (e.g. 'translate to Spanish').",
      "Return ONLY plain text (no code fences).",
    ].join("\n");

    const compactSteps = opts.steps.map((s, i) => ({
      step: i + 1,
      taskId: s.taskId,
      tool: `${s.provider ?? "provider"}/${s.endpoint ?? "endpoint"}`,
      input: safeStringify(s.input, 800),
      // Keep a compact view of the result; raw results can be massive.
      outputPreview: safeStringify(s.data, 1200),
    }));

    const user = [
      `User prompt: ${opts.prompt}`,
      opts.expectedOutputs?.length ? `Expected outputs: ${opts.expectedOutputs.join(", ")}` : "",
      opts.finalText ? `Current pipeline finalText (may be empty):\n${opts.finalText.slice(0, 2000)}` : "",
      "Tool outputs (previews):",
      safeStringify(compactSteps, 6000),
      "",
      "Now produce the final formatted response.",
    ]
      .filter(Boolean)
      .join("\n");

    const prettyText = await callAiProvider(system, user);
    return { prettyText: prettyText.trim() };
  } catch {
    return null;
  }
}

