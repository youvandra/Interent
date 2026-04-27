"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SquareSpinner } from "@/components/ui/square-spinner";
import { RefreshCw } from "lucide-react";

type JobStatus = {
  jobId: string;
  taskId: string;
  status: string;
  error?: string | null;
  inputJson?: any;
};

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = React.use(params);
  const storageKey = useMemo(() => `interent_job_token_${jobId}`, [jobId]);
  const contextKey = useMemo(() => `interent_job_context_${jobId}`, [jobId]);

  const [jobToken, setJobToken] = useState<string>("");
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<number | null>(null);
  const [jobContext, setJobContext] = useState<any | null>(null);

  useEffect(() => {
    const fromStorage = window.localStorage.getItem(storageKey);
    if (fromStorage) setJobToken(fromStorage);
  }, [storageKey]);

  useEffect(() => {
    const raw = window.localStorage.getItem(contextKey);
    if (!raw) return;
    try {
      setJobContext(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [contextKey]);

  async function refresh({ silent = false }: { silent?: boolean } = {}) {
    setError(null);
    if (!jobToken) return;
    if (!silent) setManualLoading(true);
    try {
      const resp = await fetch(`/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${jobToken}` },
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to fetch job status");
      setStatus(json);

      // Fallback: if no local context, use server-side inputJson (when available).
      if (!jobContext && json?.inputJson) {
        setJobContext({ prompt: json.inputJson.prompt, steps: json.inputJson.steps, selectedOutputs: json.inputJson.expectedOutputs });
      }

      if (json.status === "DONE") {
        const r = await fetch(`/api/jobs/${jobId}/result`, {
          headers: { Authorization: `Bearer ${jobToken}` },
        });
        const rj = await r.json().catch(() => null);
        if (!r.ok) throw new Error(rj?.error || "Failed to fetch result");
        setResult(rj.result);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      if (!silent) setManualLoading(false);
    }
  }

  // auto-poll (silent) until terminal state
  useEffect(() => {
    if (!jobToken) return;
    setPolling(true);
    refresh({ silent: true });

    // clear any previous interval
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => refresh({ silent: true }), 3000);

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      setPolling(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobToken, jobId]);

  // Stop polling when terminal
  useEffect(() => {
    const s = status?.status;
    if (!s) return;
    if (s === "DONE" || s === "FAILED" || s === "EXPIRED") {
      if (pollRef.current) window.clearInterval(pollRef.current);
      pollRef.current = null;
      setPolling(false);
    }
  }, [status?.status]);

  function setTokenViaPrompt() {
    const v = window.prompt("Paste job token (job_live_...):", jobToken || "");
    if (!v) return;
    const next = v.trim();
    setJobToken(next);
    window.localStorage.setItem(storageKey, next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Job</CardTitle>
                <CardDescription>Track execution & fetch result.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => refresh({ silent: false })}
                disabled={!jobToken || manualLoading}
                aria-label="Refresh job"
                title="Refresh"
              >
                {manualLoading ? (
                  <SquareSpinner />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[--color-muted]">Job ID</span>
              <span className="max-w-[220px] truncate font-mono text-xs text-[--color-text]">
                {jobId}
              </span>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Job token</div>
              <div className="flex items-center justify-between gap-3">
                <span className="max-w-[220px] truncate font-mono text-xs text-[--color-text]">
                  {jobToken || "—"}
                </span>
                <Button variant="secondary" onClick={setTokenViaPrompt}>
                  Set token
                </Button>
              </div>
              {/* Refresh moved to top-right in header */}
              <div className="text-xs text-[--color-muted]">
                This token is stored only in your browser. If you lose it, the job will still run,
                but you won’t be able to fetch the result.
              </div>
            </div>

            <Link href="/input">
              <Button className="w-full">Back to describe</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Result</CardTitle>
                <CardDescription>
                  {!jobToken
                    ? "Set a token to start polling."
                    : status?.status === "DONE"
                      ? "Completed."
                      : status?.status === "FAILED"
                        ? "Failed."
                        : polling
                          ? "Waiting for completion…"
                          : "Waiting for completion…"}
                </CardDescription>
              </div>
              {status?.status ? <Badge>{status.status}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {status?.status === "FAILED" && status.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {status.error}
              </div>
            ) : null}

            {/* Input + toolchain */}
            {(jobContext?.prompt || jobContext?.steps?.length) && (
              <div className="border border-[--color-border] bg-white p-4">
                {jobContext?.prompt ? (
                  <div>
                    <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
                      INPUT
                    </div>
                    <div className="mt-2 text-sm text-[--color-text]">{jobContext.prompt}</div>
                  </div>
                ) : null}

                {Array.isArray(jobContext?.selectedOutputs) && jobContext.selectedOutputs.length ? (
                  <div className="mt-3">
                    <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
                      EXPECTED OUTPUT
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {jobContext.selectedOutputs.map((o: string) => (
                        <span
                          key={o}
                          className="border border-[--color-border] bg-white px-2 py-1 text-xs text-[--color-text]"
                        >
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {Array.isArray(jobContext?.steps) && jobContext.steps.length ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
                      TOOLCHAIN
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {jobContext.steps.map((s: any, idx: number) => {
                        return (
                          <div key={`${s.taskId ?? s.label ?? "step"}-${idx}`} className="flex items-center gap-2">
                            <span className="border border-[--color-border-strong] bg-white px-2 py-1 text-xs font-semibold text-[--color-text]">
                              {s.label ?? s.taskId ?? `Step ${idx + 1}`}
                            </span>
                            {idx < jobContext.steps.length - 1 ? (
                              <span className="text-xs text-[--color-muted]">→</span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-[--color-border] bg-white p-4">
                <div className="text-sm font-medium">Output</div>
                <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-[--color-surface] p-3 text-xs text-[--color-text]">
{JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}

            {!result && jobToken && status?.status !== "DONE" ? (
              <div className="rounded-xl border border-[--color-border] bg-white p-4 text-sm text-[--color-muted]">
                No result yet.{" "}
                {polling ? "Auto-refreshing…" : "Refresh manually from the Job card."}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
