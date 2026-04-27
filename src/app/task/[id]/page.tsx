"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LocusCheckout } from "@withlocus/checkout-react";
import { getOrCreateBuyerId } from "@/lib/buyer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2 } from "lucide-react";

type Task = {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  provider?: string;
  endpoint?: string;
};

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: taskId } = React.use(params);
  const buyerId = useMemo(() => getOrCreateBuyerId(), []);

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [text, setText] = useState("");
  const [targetLang, setTargetLang] = useState("EN");
  const [sourceLang, setSourceLang] = useState("");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [rawJson, setRawJson] = useState("");

  const [job, setJob] = useState<{
    jobId: string;
    jobToken: string;
    sessionId: string;
    checkoutUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const resp = await fetch("/api/tasks");
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        if (!cancelled) setError(json?.error || "Failed to load tasks");
        setLoading(false);
        return;
      }
      const found = (json?.tasks || []).find((t: Task) => t.id === taskId) || null;
      if (!cancelled) setTask(found);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  async function createJob() {
    setError(null);
    let input: Record<string, unknown> = {};

    try {
      if (taskId === "ocr_mathpix") {
        input = { imageUrl };
      } else if (taskId === "translate_deepl") {
        input = {
          text,
          targetLang,
          ...(sourceLang ? { sourceLang } : {}),
        };
      } else if (taskId === "openai_chat") {
        input = {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: text }],
        };
      } else if (taskId === "gemini_chat") {
        input = {
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: text }],
        };
      } else if (taskId === "firecrawl_scrape") {
        input = { url, formats: ["markdown"] };
      } else if (taskId === "exa_search") {
        input = { query, numResults: 5 };
      } else if (rawJson.trim()) {
        input = JSON.parse(rawJson);
      } else {
        input = {};
      }
    } catch {
      setError("Input JSON tidak valid");
      return;
    }

    const resp = await fetch("/api/jobs/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, buyerId, input }),
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) {
      setError(json?.error || "Failed to create job");
      return;
    }
    // `@withlocus/checkout-react` defaultnya pakai https://checkout.paywithlocus.com
    // tapi di beta kadang checkout host-nya beda. Jadi kita pakai `checkoutUrl` dari API response.
    const checkoutUrl = json?.checkoutUrl ?? null;
    const sessionId =
      json?.sessionId ??
      (typeof checkoutUrl === "string" ? checkoutUrl.split("/").filter(Boolean).pop() : null);
    if (!sessionId) {
      setError("Missing sessionId from /api/jobs/create");
      return;
    }
    setJob({
      jobId: json.jobId,
      jobToken: json.jobToken,
      sessionId,
      checkoutUrl,
    });
    // simpan token lokal supaya /jobs bisa akses tanpa querystring
    window.localStorage.setItem(`interent_job_token_${json.jobId}`, json.jobToken);
  }

  const canSubmit = (() => {
    if (taskId === "ocr_mathpix") return !!imageUrl.trim();
    if (taskId === "translate_deepl") return !!text.trim() && !!targetLang.trim();
    if (taskId === "openai_chat" || taskId === "gemini_chat") return !!text.trim();
    if (taskId === "firecrawl_scrape") return !!url.trim();
    if (taskId === "exa_search") return !!query.trim();

    // Task lain: user isi params JSON (kalau kosong, kita allow tapi kemungkinan gagal di wrapped API)
    return !!rawJson.trim();
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Run task</CardTitle>
                <CardDescription>Pay once, Interent executes via Locus Wrapped APIs.</CardDescription>
              </div>
              <Link href="/marketplace">
                <Button variant="ghost">Back</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[--color-muted]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}
            {task && (
              <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{task.title}</div>
                    <div className="mt-1 text-xs text-[--color-muted]">{task.description}</div>
                  </div>
                  <Badge className="border-[--color-primary]/20 bg-[--color-primary-soft] text-[--color-primary]">
                    {task.priceUsdc} USDC
                  </Badge>
                </div>
              </div>
            )}

            {taskId === "ocr_mathpix" && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Image URL</div>
                <Input
                  placeholder="https://.../image.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <div className="text-xs text-[--color-muted]">
                  MVP: pakai URL publik (belum upload file).
                </div>
              </div>
            )}

            {taskId === "translate_deepl" && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Text</div>
                <Textarea
                  rows={6}
                  placeholder="Paste text yang mau ditranslate…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">Target language</div>
                    <Input
                      placeholder="EN / ID / JA / ZH"
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Source (optional)</div>
                    <Input
                      placeholder="Auto"
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
              </div>
            )}

            {(taskId === "openai_chat" || taskId === "gemini_chat") && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Prompt</div>
                <Textarea
                  rows={6}
                  placeholder="Tulis prompt untuk chat…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="text-xs text-[--color-muted]">
                  Default model dipilih otomatis (OpenAI: gpt-4o-mini, Gemini: gemini-2.5-flash).
                </div>
              </div>
            )}

            {taskId === "firecrawl_scrape" && (
              <div className="space-y-2">
                <div className="text-sm font-medium">URL</div>
                <Input
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <div className="text-xs text-[--color-muted]">
                  Akan return output markdown (formats: [\"markdown\"]).
                </div>
              </div>
            )}

            {taskId === "exa_search" && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Query</div>
                <Input
                  placeholder="mis. best OCR API pricing"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="text-xs text-[--color-muted]">Default numResults = 5.</div>
              </div>
            )}

            {task &&
              ![
                "ocr_mathpix",
                "translate_deepl",
                "openai_chat",
                "gemini_chat",
                "firecrawl_scrape",
                "exa_search",
              ].includes(taskId) && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Wrapped params (JSON)</div>
                  <Textarea
                    rows={8}
                    placeholder={`{\n  \"...\": \"...\"\n}`}
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                  />
                  <div className="text-xs text-[--color-muted]">
                    Endpoint: <span className="font-mono">{task.provider}/{task.endpoint}</span>
                  </div>
                </div>
              )}

            {!job && (
              <Button disabled={!canSubmit} onClick={createJob} className="w-full">
                Create job & checkout <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-7">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Checkout</CardTitle>
            <CardDescription>Complete payment to run the task.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {!job && <div className="text-sm text-[--color-muted]">Create a job first.</div>}
            {job && (
              <LocusCheckout
                sessionId={job.sessionId}
                checkoutUrl={job.checkoutUrl ?? undefined}
                mode="embedded"
                onSuccess={() => {
                  window.location.href = `/jobs/${job.jobId}`;
                }}
                onCancel={() => {
                  window.location.href = `/task/${taskId}`;
                }}
                onError={(e) => setError(e.message)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
