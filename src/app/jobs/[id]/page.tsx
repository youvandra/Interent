"use client";

import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw } from "lucide-react";

type JobStatus = {
  jobId: string;
  taskId: string;
  status: string;
  error?: string | null;
};

export default function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = React.use(params);
  const storageKey = useMemo(() => `interent_job_token_${jobId}`, [jobId]);

  const [jobToken, setJobToken] = useState<string>("");
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fromStorage = window.localStorage.getItem(storageKey);
    if (fromStorage) setJobToken(fromStorage);
  }, [storageKey]);

  async function refresh() {
    setError(null);
    if (!jobToken) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${jobToken}` },
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to fetch job status");
      setStatus(json);

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
      setLoading(false);
    }
  }

  // auto-poll
  useEffect(() => {
    if (!jobToken) return;
    refresh();
    const t = window.setInterval(() => refresh(), 2500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobToken, jobId]);

  function saveToken() {
    window.localStorage.setItem(storageKey, jobToken);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Job</CardTitle>
            <CardDescription>Track execution & fetch result.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[--color-muted]">Job ID</span>
              <Badge className="max-w-[220px] truncate">{jobId}</Badge>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Job token</div>
              <Input
                value={jobToken}
                onChange={(e) => setJobToken(e.target.value)}
                placeholder="job_live_..."
              />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={saveToken}>
                  Save token
                </Button>
                <Button variant="ghost" onClick={refresh} disabled={!jobToken || loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
              <div className="text-xs text-[--color-muted]">
                Token ini cuma disimpan di browser kamu. Kalau hilang, job tetap jalan tapi kamu
                nggak bisa ambil hasil.
              </div>
            </div>

            <Link href="/marketplace">
              <Button className="w-full">Back to marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>
              {status ? `Task: ${status.taskId}` : "Masukin token untuk mulai polling."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {status && (
              <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-[--color-text]">Status</div>
                  <Badge>{status.status}</Badge>
                </div>
                {status.status === "FAILED" && (
                  <div className="mt-2 text-xs text-red-700">{status.error}</div>
                )}
                <div className="mt-2 text-xs text-[--color-muted]">
                  Poll tiap ~2.5 detik. Normalnya selesai cepat untuk task kecil.
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-[--color-border] bg-white p-4">
                <div className="text-sm font-medium">Result</div>
                <pre className="mt-2 max-h-[420px] overflow-auto rounded-lg bg-[--color-surface] p-3 text-xs text-[--color-text]">
{JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

