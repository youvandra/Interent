import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { randomToken, sha256Hex } from "@/lib/auth";

type Body = {
  buyerId?: string;
  prompt?: string;
  steps?: Array<{ taskId: string; label?: string; priceUsdc?: string; missing?: boolean }>;
  expectedOutputs?: string[];
  pricing?: {
    subtotalToolsUsdc?: string;
    serviceFeeUsdc?: string;
    serviceFeeRate?: number;
    totalPriceUsdc?: string;
  };
};

function extractUrl(text: string) {
  const m = text.match(/https?:\/\/\S+/i);
  return m?.[0] ?? null;
}

function buildMockOutputs(prompt: string, expectedOutputs: string[]) {
  const url = extractUrl(prompt);
  const extracted = url
    ? `Example extracted content from: ${url}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. (mock)`
    : "Example extracted content (mock).";
  const translated = "Este es un ejemplo de traducción al español. (mock)";
  const audio = {
    format: "mp3",
    note: "Mock audio output (no TTS executed).",
    url: "https://example.com/mock-audio.mp3",
  };
  const image = {
    note: "Mock image output (no generation executed).",
    url: "https://example.com/mock-image.png",
  };

  const out: Record<string, unknown> = {};
  for (const id of expectedOutputs) {
    if (id === "extracted_text") out.extracted_text = extracted;
    if (id === "translated_text") out.translated_text = translated;
    if (id === "audio_file") out.audio_file = audio;
    if (id === "generated_image") out.generated_image = image;
    if (id === "json_result") out.json_result = { extracted, translated, audio };
  }
  if (!expectedOutputs.length) {
    out.json_result = { extracted, translated, audio };
  }
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const buyerId = body.buyerId;
  const prompt = body.prompt;
  if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const steps = Array.isArray(body.steps) ? body.steps : [];
  const expectedOutputs = Array.isArray(body.expectedOutputs) ? body.expectedOutputs : [];

  const jobToken = randomToken("job_live_");
  const jobTokenHash = sha256Hex(jobToken);

  const sb = supabaseServer();
  const now = new Date().toISOString();

  const mock = {
    kind: "workflow",
    mode: "test",
    note: "Test Pay: this is a mock result. No wrapped tools were executed and no Locus payment was made.",
    prompt,
    expectedOutputs,
    pricing: body.pricing ?? null,
    progress: {
      currentStepIndex: steps.length ? steps.length - 1 : 0,
      steps: steps.map((s) => ({ taskId: s.taskId, status: "DONE" })),
    },
    steps: steps.map((s) => ({
      taskId: s.taskId,
      label: s.label ?? s.taskId,
      missing: Boolean((s as any).missing),
      priceUsdc: s.priceUsdc ?? null,
      data: { ok: true, mock: true },
    })),
    outputs: buildMockOutputs(prompt, expectedOutputs),
  };

  const { data: jobRow, error: jobErr } = await sb
    .from("jobs")
    .insert({
      buyer_id: buyerId,
      task_id: "workflow",
      status: "DONE",
      input_json: {
        kind: "workflow",
        mode: "test",
        prompt,
        steps,
        expectedOutputs,
      },
      result_json: mock,
      job_token_hash: jobTokenHash,
      paid_at: now,
      completed_at: now,
      updated_at: now,
    })
    .select("id")
    .maybeSingle();

  if (jobErr) return NextResponse.json({ error: jobErr.message }, { status: 500 });
  const jobId = jobRow?.id;
  if (!jobId) return NextResponse.json({ error: "Failed to create test job" }, { status: 500 });

  return NextResponse.json({ jobId, jobToken, mode: "test" });
}
