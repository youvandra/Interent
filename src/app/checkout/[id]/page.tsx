"use client";

import { useEffect, useMemo, useState } from "react";
import { LocusCheckout } from "@withlocus/checkout-react";
import Link from "next/link";
import { getOrCreateBuyerId } from "@/lib/buyer";

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Checkout</div>
          <div className="text-sm text-zinc-600">Pack: {packId}</div>
        </div>
        <Link href={`/pack/${packId}`} className="text-sm underline">
          Back
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4">
        {!sessionId && !error && <div className="text-sm">Bikin checkout session…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        {sessionId && (
          <LocusCheckout
            sessionId={sessionId}
            mode="embedded"
            onSuccess={(data) => {
              // Data minimal: txHash, sessionId, payerAddress, paidAt, amount
              window.location.href = `/chat/${packId}?sessionId=${encodeURIComponent(
                data.sessionId,
              )}&txHash=${encodeURIComponent(data.txHash)}`;
            }}
            onCancel={() => {
              window.location.href = `/pack/${packId}?cancelled=1`;
            }}
            onError={(e) => setError(e.message)}
          />
        )}
      </div>

      <div className="text-xs text-zinc-500">
        Buyer ID (demo): <span className="font-mono">{buyerId}</span>
      </div>
    </div>
  );
}

