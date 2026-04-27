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
    const input =
      taskId === "ocr_mathpix"
        ? { imageUrl }
        : taskId === "translate_deepl"
          ? { text, targetLang }
          : {};

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

  const canSubmit =
    taskId === "ocr_mathpix"
      ? !!imageUrl.trim()
      : taskId === "translate_deepl"
        ? !!text.trim() && !!targetLang.trim()
        : true;

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
