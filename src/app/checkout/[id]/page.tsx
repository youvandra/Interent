"use client";

import { useEffect, useMemo, useState } from "react";
import { LocusCheckout } from "@withlocus/checkout-react";
import Link from "next/link";
import { getOrCreateBuyerId } from "@/lib/buyer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

export default function CheckoutPage({ params }: { params: { id: string } }) {
  const packId = params.id;
  const buyerId = useMemo(() => getOrCreateBuyerId(), []);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setError(null);
      const resp = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, buyerId }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        if (!cancelled) setError(json?.error || "Failed to create session");
        return;
      }
      if (!cancelled) setSessionId(json.sessionId);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [packId, buyerId]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Checkout</CardTitle>
                <CardDescription>Pack: {packId}</CardDescription>
              </div>
              <Link href={`/pack/${packId}`}>
                <Button variant="ghost">Back</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {!sessionId && !error && (
              <div className="flex items-center gap-2 text-sm text-[--color-muted]">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating checkout session…
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {sessionId && (
              <div className="mt-3">
                <LocusCheckout
                  sessionId={sessionId}
                  mode="embedded"
                  onSuccess={(data) => {
                    window.location.href = `/chat/${packId}?sessionId=${encodeURIComponent(
                      data.sessionId,
                    )}&txHash=${encodeURIComponent(data.txHash)}`;
                  }}
                  onCancel={() => {
                    window.location.href = `/pack/${packId}?cancelled=1`;
                  }}
                  onError={(e) => setError(e.message)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>What happens after you pay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[--color-muted]">
            <div className="flex items-center justify-between">
              <span>Pack</span>
              <Badge>{packId}</Badge>
            </div>
            <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
              <div className="flex items-center gap-2 font-medium text-[--color-text]">
                <ShieldCheck className="h-4 w-4 text-[--color-primary]" />
                Webhook-gated access
              </div>
              <div className="mt-1 text-xs">
                Setelah <span className="font-medium">checkout.session.paid</span>, entitlement
                dibuat, lalu chat kebuka otomatis.
              </div>
            </div>
            <div className="rounded-xl border border-[--color-border] bg-white p-3">
              <div className="text-xs">Buyer ID (demo)</div>
              <div className="mt-1 break-all font-mono text-xs text-[--color-text]">{buyerId}</div>
            </div>
            <Link href={`/chat/${packId}`} className="block">
              <Button variant="secondary" className="w-full">
                Go to chat <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
