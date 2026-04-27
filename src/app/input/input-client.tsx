"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LocusCheckout } from "@withlocus/checkout-react";
import { getOrCreateBuyerId } from "@/lib/buyer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type PlannedStep = {
  taskId: string | null;
  label: string;
  tool?: string | null;
  missing?: boolean;
  priceUsdc: string;
};

type OutputOption = {
  id: string;
  label: string;
  description: string;
  defaultSelected?: boolean;
};

type TaskOption = {
  id: string;
  title: string;
  provider: string;
  endpoint: string;
  priceUsdc: string;
};

function formatUsdc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  const s = typeof value === "number" ? value.toString() : String(value);
  // Normalize and trim trailing zeros: "0.001000" -> "0.001", "1.000000" -> "1"
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

function toMicroUsdc(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Math.round(n * 1_000_000);
}

function fromMicroUsdc(micro: number): string {
  return (micro / 1_000_000).toFixed(6);
}

function getCapability(step: PlannedStep): string | null {
  const endpoint = (step.tool || "").split("/")[1]?.toLowerCase() || "";
  const label = step.label.toLowerCase();

  if (endpoint === "chat" || label.includes("llm")) return "llm_chat";
  if (endpoint === "image-generate" || label.includes("image")) return "image_generate";
  if (endpoint === "tts" || label.includes("speech") || label.includes("audio")) return "tts";
  if (endpoint === "translate" || label.includes("translate")) return "translate";
  if (endpoint === "search" || label.includes("search")) return "web_search";
  if (endpoint === "extract" || label.includes("extract")) return "extract_data";
  if (endpoint === "scrape" || label.includes("scrape")) return "scrape";

  return null;
}

function capabilityMatch(cap: string, task: TaskOption) {
  const ep = task.endpoint.toLowerCase();
  if (cap === "llm_chat") return ep === "chat";
  if (cap === "image_generate") return ep === "image-generate";
  if (cap === "tts") return ep === "tts";
  if (cap === "translate") return ep === "translate";
  if (cap === "web_search") return ep === "search";
  if (cap === "extract_data") return ep === "extract";
  if (cap === "scrape") return ep === "scrape";
  return false;
}

export function InputClient() {
  const searchParams = useSearchParams();
  const buyerId = useMemo(() => getOrCreateBuyerId(), []);

  const [prompt, setPrompt] = useState(searchParams.get("text") || "");
  const [planning, setPlanning] = useState(false);
  const [taskOptions, setTaskOptions] = useState<TaskOption[] | null>(null);
  const [creatingCheckout, setCreatingCheckout] = useState(false);
  const [plannedPrompt, setPlannedPrompt] = useState<string | null>(null);
  const [plan, setPlan] = useState<{
    steps: PlannedStep[];
    expectedOutputs?: OutputOption[];
    subtotalToolsUsdc?: string;
    serviceFeeUsdc?: string;
    serviceFeeRate?: number;
    totalPriceUsdc: string;
    notes?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([]);

  const [checkout, setCheckout] = useState<{
    jobId: string;
    jobToken: string;
    sessionId: string;
    checkoutUrl?: string | null;
  } | null>(null);
  const [testPaying, setTestPaying] = useState(false);

  function saveJobContext(jobId: string, mode: "live" | "test") {
    if (!plan) return;
    try {
      const payload = {
        mode,
        prompt,
        steps: plan.steps,
        expectedOutputs: plan.expectedOutputs ?? [],
        selectedOutputs,
        pricing: {
          subtotalToolsUsdc: plan.subtotalToolsUsdc,
          serviceFeeUsdc: plan.serviceFeeUsdc,
          serviceFeeRate: plan.serviceFeeRate,
          totalPriceUsdc: plan.totalPriceUsdc,
        },
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(`interent_job_context_${jobId}`, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }

  async function generatePlan(text: string) {
    setError(null);
    setPlanning(true);
    setPlan(null);
    setCheckout(null);
    setPlannedPrompt(null);
    try {
      const resp = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to generate plan");
      setPlan(json);
      setPlannedPrompt(text);
      const defaults =
        (json?.expectedOutputs ?? [])
          .filter((o: any) => o?.defaultSelected)
          .map((o: any) => String(o.id)) ?? [];
      setSelectedOutputs(defaults);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setPlanning(false);
    }
  }

  async function ensureTaskOptions() {
    if (taskOptions) return;
    const resp = await fetch("/api/tasks");
    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(json?.error || "Failed to load tools");
    setTaskOptions(json?.tasks ?? []);
  }

  // When a plan exists, prefetch options so dropdowns are ready.
  useEffect(() => {
    if (plan && !taskOptions) {
      ensureTaskOptions().catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  function toggleOutput(id: string) {
    setSelectedOutputs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
    setCreatingCheckout(true);
    try {
      const resp = await fetch("/api/workflows/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          prompt,
          steps: plan.steps.map((s) => ({ taskId: s.taskId!, label: s.label, priceUsdc: s.priceUsdc })),
          totalPriceUsdc: plan.totalPriceUsdc,
          expectedOutputs: selectedOutputs,
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
      saveJobContext(json.jobId, "live");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setCreatingCheckout(false);
    }
  }

  async function testPay() {
    if (!plan) return;
    setError(null);
    setTestPaying(true);
    try {
      const resp = await fetch("/api/workflows/testpay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerId,
          prompt,
          steps: plan.steps.map((s) => ({
            taskId: s.taskId,
            label: s.label,
            priceUsdc: s.priceUsdc,
            missing: s.missing,
          })),
          expectedOutputs: selectedOutputs,
          pricing: {
            subtotalToolsUsdc: plan.subtotalToolsUsdc,
            serviceFeeUsdc: plan.serviceFeeUsdc,
            serviceFeeRate: plan.serviceFeeRate,
            totalPriceUsdc: plan.totalPriceUsdc,
          },
        }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(json?.error || "Failed to create test job");

      window.localStorage.setItem(`interent_job_token_${json.jobId}`, json.jobToken);
      saveJobContext(json.jobId, "test");
      window.location.href = `/jobs/${json.jobId}`;
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setTestPaying(false);
    }
  }

  function recomputeTotals(nextSteps: PlannedStep[]) {
    const subtotalMicro = nextSteps.reduce(
      (sum, s) => sum + (s.missing ? 0 : toMicroUsdc(s.priceUsdc)),
      0,
    );
    const rate = typeof plan?.serviceFeeRate === "number" ? plan.serviceFeeRate : 0.05;
    const serviceFeeMicro = Math.round(subtotalMicro * rate);
    const totalMicro = subtotalMicro + serviceFeeMicro;
    return {
      subtotalToolsUsdc: fromMicroUsdc(subtotalMicro),
      serviceFeeUsdc: fromMicroUsdc(serviceFeeMicro),
      totalPriceUsdc: fromMicroUsdc(totalMicro),
      serviceFeeRate: rate,
    };
  }

  async function onChangeStepTool(index: number, newTaskId: string) {
    if (!plan) return;
    await ensureTaskOptions();
    const opt = (taskOptions ?? []).find((t) => t.id === newTaskId);
    if (!opt) return;

    const nextSteps = plan.steps.map((s, i) =>
      i === index
        ? {
            ...s,
            taskId: opt.id,
            tool: `${opt.provider}/${opt.endpoint}`,
            label: opt.title,
            missing: false,
            priceUsdc: opt.priceUsdc,
          }
        : s,
    );

    const totals = recomputeTotals(nextSteps);
    setPlan({ ...plan, steps: nextSteps, ...totals });
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
              Example: “I want to scrape data about disease outbreaks in 2025, 
              translate to Spanish, then generate a clean dashboard and a report”
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
              disabled={
                !prompt.trim() ||
                planning ||
                creatingCheckout ||
                (!!checkout || (!!plan && plannedPrompt === prompt))
              }
              onClick={() => generatePlan(prompt)}
              className="w-full"
            >
              {planning ? (
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
                    {plan.steps.map((s, idx) => {
                      const cap = getCapability(s);
                      const options =
                        cap && taskOptions
                          ? taskOptions.filter((t) => capabilityMatch(cap, t))
                          : null;
                      // Only show dropdown if there are 2+ choices for this capability.
                      const canSwitch = !!cap && !!options && options.length > 1;

                      return (
                        <div key={`${s.taskId ?? "missing"}-${idx}`} className="flex items-center gap-2">
                          <div
                            className={[
                              "border px-2 py-1 text-xs font-semibold",
                              s.missing
                                ? "border-red-400 bg-red-50 text-red-700"
                                : "border-[--color-border-strong] bg-white text-[--color-text]",
                            ].join(" ")}
                          >
                            {canSwitch ? (
                              <select
                                className="bg-transparent text-xs font-semibold outline-none"
                                value={s.taskId ?? ""}
                                onClick={() => {
                                  // lazy load options on demand
                                  ensureTaskOptions().catch(() => null);
                                }}
                                onChange={(e) => onChangeStepTool(idx, e.target.value)}
                              >
                                {/* current option */}
                                {s.taskId ? (
                                  <option value={s.taskId}>{s.label}</option>
                                ) : (
                                  <option value="" disabled>
                                    {s.label}
                                  </option>
                                )}
                                {(options ?? [])
                                  .filter((t) => t.id !== s.taskId)
                                  .map((t) => (
                                    <option key={t.id} value={t.id}>
                                      {t.title}
                                    </option>
                                  ))}
                              </select>
                            ) : (
                              <span>
                                {s.label}
                                {s.missing ? " (missing)" : ""}
                              </span>
                            )}
                          </div>

                          {idx < plan.steps.length - 1 ? (
                            <span className="text-xs text-[--color-muted]">→</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  {plan.notes ? (
                    <div className="mt-2 text-xs text-[--color-muted]">{plan.notes}</div>
                  ) : null}
                </div>

                <div className="border border-[--color-border] bg-white p-4 text-sm">
                  <div className="font-semibold">Expected output</div>
                  <div className="mt-2 text-sm text-[--color-muted]">
                    Choose what you want to receive when the workflow completes.
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(plan.expectedOutputs ?? []).map((o) => {
                      const checked = selectedOutputs.includes(o.id);
                      return (
                        <button
                          type="button"
                          key={o.id}
                          onClick={() => toggleOutput(o.id)}
                          aria-pressed={checked}
                          className={[
                            "text-left border p-3 transition",
                            checked
                              ? "border-[--color-border-strong] bg-[--color-primary-soft]"
                              : "border-[--color-border] bg-white hover:bg-[--color-surface]",
                          ].join(" ")}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[--color-text]">
                                {o.label}
                              </div>
                              <div className="mt-1 text-xs text-[--color-muted]">
                                {o.description}
                              </div>
                            </div>
                            <span
                              aria-hidden="true"
                              className={[
                                "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                checked
                                  ? "border-[--color-border-strong] bg-white text-[--color-primary]"
                                  : "border-[--color-border-strong] bg-transparent text-[--color-muted]",
                              ].join(" ")}
                            >
                              <Check className={["h-3.5 w-3.5", checked ? "opacity-100" : "opacity-0"].join(" ")} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border border-[--color-border] bg-white p-4 text-sm">
                  <div className="font-semibold">Price breakdown</div>
                  <div className="mt-2 space-y-1 text-[--color-muted]">
                    {plan.steps.map((s, idx) => (
                      <div
                        key={`${s.taskId ?? s.label ?? "step"}-${idx}`}
                        className="flex items-center justify-between"
                      >
                        <span>{s.label}</span>
                        <span>{s.missing ? "—" : `$${formatUsdc(s.priceUsdc)}`}</span>
                      </div>
                    ))}
                    <div className="mt-2 border-t border-[--color-border] pt-2 space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>Subtotal (tools)</span>
                        <span>${formatUsdc(plan.subtotalToolsUsdc ?? plan.totalPriceUsdc)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          Service fee{" "}
                          {typeof plan.serviceFeeRate === "number"
                            ? `(${Math.round(plan.serviceFeeRate * 100)}%)`
                            : "(5%)"}
                        </span>
                        <span>
                          ${formatUsdc(plan.serviceFeeUsdc ?? "0")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-semibold text-[--color-text]">
                        <span>Total</span>
                        <span>${formatUsdc(plan.totalPriceUsdc)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {!checkout && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-[4]"
                      onClick={createWorkflowCheckout}
                      disabled={
                        planning ||
                        creatingCheckout ||
                        testPaying ||
                        plan.steps.some((s) => s.missing)
                      }
                    >
                      {creatingCheckout ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading checkout…
                        </>
                      ) : (
                        "Pay with Locus"
                      )}
                    </Button>

                    <Button
                      className="flex-[1]"
                      variant="secondary"
                      onClick={testPay}
                      disabled={planning || creatingCheckout || testPaying}
                      aria-label="Test Pay (mock result)"
                    >
                      {testPaying ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Test Pay"
                      )}
                    </Button>
                  </div>
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
