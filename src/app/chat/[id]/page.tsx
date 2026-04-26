"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOrCreateBuyerId } from "@/lib/buyer";

export default function ChatPage({ params }: { params: { id: string } }) {
  const packId = params.id;
  const buyerId = useMemo(() => getOrCreateBuyerId(), []);

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const resp = await fetch("/api/entitlements/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId, packId }),
      });
      const json = await resp.json().catch(() => null);
      if (!cancelled) setHasAccess(!!json?.hasAccess);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [buyerId, packId]);

  async function ask() {
    setAnswer(null);
    // MVP: jawaban dummy (biar fokus ke checkout + gating).
    // Nanti bisa diupgrade jadi RAG + LLM.
    setAnswer(
      `(${packId}) Jawaban berbasis "memory pack" (demo): gue bakal jawab seolah persona pack ini. Pertanyaan lo: ${question}`,
    );
  }

  if (hasAccess === null) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm">
        Cek akses…
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Akses belum kebuka</div>
        <div className="mt-2 text-sm text-zinc-600">
          Lo belum punya entitlement untuk pack ini (atau webhook belum masuk).
        </div>
        <div className="mt-4 flex gap-3">
          <Link
            href={`/checkout/${packId}`}
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Checkout
          </Link>
          <Link href={`/pack/${packId}`} className="rounded-lg border px-3 py-2 text-sm">
            Detail pack
          </Link>
        </div>
        <div className="mt-4 text-xs text-zinc-500">
          Buyer ID (demo): <span className="font-mono">{buyerId}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold">Chat</div>
          <div className="text-sm text-zinc-600">Pack: {packId}</div>
        </div>
        <Link href="/" className="text-sm underline">
          Home
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium">Tanya sesuatu</div>
        <textarea
          className="mt-2 w-full rounded-lg border p-3 text-sm"
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Misal: Gimana strategi growth untuk marketplace agent?"
        />
        <button
          className="mt-3 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          disabled={!question.trim()}
          onClick={ask}
        >
          Ask
        </button>

        {answer && (
          <div className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm">
            <div className="font-medium">Jawaban</div>
            <div className="mt-1 whitespace-pre-wrap text-zinc-700">{answer}</div>
          </div>
        )}
      </div>
    </div>
  );
}

