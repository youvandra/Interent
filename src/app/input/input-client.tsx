"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LocusCheckout } from "@withlocus/checkout-react";
import { getOrCreateBuyerId } from "@/lib/buyer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Loader2 } from "lucide-react";

type PlannedStep = {
  taskId: string | null;
  label: string;
  tool?: string | null;
  missing?: boolean;
  priceUsdc: string;
};

export function InputClient() {
  const searchParams = useSearchParams();
  const buyerId = useMemo(() => getOrCreateBuyerId(), []);

  const [prompt, setPrompt] = useState(searchParams.get("text") || "");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<{
    steps: PlannedStep[];
    totalPriceUsdc: string;
    notes?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [checkout, setCheckout] = useState<{
    jobId: string;
    jobToken: string;
    sessionId: string;
    checkoutUrl?: string | null;
  } | null>(null);

  async function generatePlan(text: string) {
    setError(null);
    setLoading(true);
    setPlan(null);
    setCheckout(null);
    try {
      const resp = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to generate plan");
      setPlan(json);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function createWorkflowCheckout() {
    if (!plan) return;
    const missing = plan.steps.filter((s) => s.missing);
    if (missing.length) {
      setError(
        `Missing tools: ${missing.map((m) => m.label).join(", ")}. Please edit the request or choose supported tools.`,
      );
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const resp = await fetch("/api/workflows/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          prompt,
          steps: plan.steps.map((s) => ({ taskId: s.taskId!, label: s.label, priceUsdc: s.priceUsdc })),
          totalPriceUsdc: plan.totalPriceUsdc,
        }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to create checkout");

      const checkoutUrl = json?.checkoutUrl ?? null;
      const sessionId =
        json?.sessionId ??
        (typeof checkoutUrl === "string" ? checkoutUrl.split("/").filter(Boolean).pop() : null);
      if (!sessionId) throw new Error("Missing sessionId");

      setCheckout({
        jobId: json.jobId,
        jobToken: json.jobToken,
        sessionId,
        checkoutUrl,
      });

      window.localStorage.setItem(`interent_job_token_${json.jobId}`, json.jobToken);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // Auto-run if query param exists
  useEffect(() => {
    const initial = searchParams.get("text");
    if (initial && initial.trim()) generatePlan(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>Describe your task</CardTitle>
            <CardDescription>
              We’ll route it into a toolchain. Example: “Extract the article body from a URL,
              translate to Indonesian, then generate audio.”
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Textarea
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Type what you want to achieve…"
            />

            <Button
              disabled={!prompt.trim() || loading}
              onClick={() => generatePlan(prompt)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Planning…
                </>
              ) : (
                <>
                  Generate toolchain <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-7">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Toolchain & pricing</CardTitle>
            <CardDescription>Review the tools, then pay once via Locus Checkout.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {!plan && <div className="text-sm text-[--color-muted]">No plan yet.</div>}

            {plan && (
              <div className="space-y-3">
                <div className="border border-[--color-border] bg-white p-4 text-sm">
                  <div className="font-semibold">Suggested flow</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[--color-muted]">
                    {plan.steps.map((s, idx) => (
                      <div key={`${s.taskId ?? "missing"}-${idx}`} className="flex items-center gap-2">
                        <span
                          className={[
                            "border px-2 py-1 text-xs font-semibold",
                            s.missing
                              ? "border-red-400 bg-red-50 text-red-700"
                              : "border-[--color-border-strong] bg-white text-[--color-text]",
                          ].join(" ")}
                        >
                          {s.label}
                          {s.missing ? " (missing)" : ""}
                        </span>
                        {idx < plan.steps.length - 1 ? (
                          <span className="text-xs text-[--color-muted]">→</span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {plan.notes ? (
                    <div className="mt-2 text-xs text-[--color-muted]">{plan.notes}</div>
                  ) : null}
                </div>

                <div className="border border-[--color-border] bg-white p-4 text-sm">
                  <div className="font-semibold">Price breakdown</div>
                  <div className="mt-2 space-y-1 text-[--color-muted]">
                    {plan.steps.map((s) => (
                      <div key={`${s.taskId ?? s.label}`} className="flex items-center justify-between">
                        <span>{s.label}</span>
                        <span>{s.missing ? "—" : `$${s.priceUsdc}`}</span>
                      </div>
                    ))}
                    <div className="mt-2 border-t border-[--color-border] pt-2 flex items-center justify-between font-semibold text-[--color-text]">
                      <span>Total</span>
                      <span>${plan.totalPriceUsdc}</span>
                    </div>
                  </div>
                </div>

                {!checkout && (
                  <Button
                    className="w-full"
                    onClick={createWorkflowCheckout}
                    disabled={loading || plan.steps.some((s) => s.missing)}
                  >
                    Pay with Locus
                  </Button>
                )}

                {checkout && (
                  <div className="border border-[--color-border] bg-white p-4">
                    <div className="mb-3 text-sm text-[--color-muted]">
                      Complete payment to run the workflow.
                    </div>
                    <LocusCheckout
                      sessionId={checkout.sessionId}
                      checkoutUrl={checkout.checkoutUrl ?? undefined}
                      mode="embedded"
                      onSuccess={() => {
                        window.location.href = `/jobs/${checkout.jobId}`;
                      }}
                      onCancel={() => {
                        window.location.href = `/input?text=${encodeURIComponent(prompt)}`;
                      }}
                      onError={(e) => setError(e.message)}
                    />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
