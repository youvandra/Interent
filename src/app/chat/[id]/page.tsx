"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getOrCreateBuyerId } from "@/lib/buyer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Lock } from "lucide-react";

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
      <Card className="p-6">
        <CardTitle>Cek akses…</CardTitle>
        <CardDescription className="mt-2">
          Nunggu hasil entitlement dari webhook.
        </CardDescription>
      </Card>
    );
  }

  if (!hasAccess) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-[--color-primary]" />
                Akses belum kebuka
              </CardTitle>
              <CardDescription>
                Lo belum punya entitlement untuk pack ini (atau webhook belum masuk).
              </CardDescription>
            </div>
            <Badge>{packId}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href={`/checkout/${packId}`}>
              <Button className="w-full">
                Checkout <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href={`/pack/${packId}`}>
              <Button variant="secondary" className="w-full">
                Detail pack
              </Button>
            </Link>
          </div>
          <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3 text-xs">
            <div className="text-[--color-muted]">Buyer ID (demo)</div>
            <div className="mt-1 break-all font-mono text-[--color-text]">{buyerId}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
            <CardDescription>Demo persona chat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[--color-muted]">
            <div className="flex items-center justify-between">
              <span>Pack</span>
              <Badge>{packId}</Badge>
            </div>
            <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3 text-xs">
              <div className="text-[--color-muted]">Buyer ID</div>
              <div className="mt-1 break-all font-mono text-[--color-text]">{buyerId}</div>
            </div>
            <Link href="/">
              <Button variant="secondary" className="w-full">
                Back to marketplace
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>
              Saat ini jawaban masih dummy (buat fokus ke checkout + gating). Nanti bisa
              di-upgrade jadi RAG + LLM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Tanya sesuatu</div>
            <div className="mt-2">
              <Textarea
                rows={4}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Misal: Gimana strategi growth untuk marketplace agent?"
              />
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button disabled={!question.trim()} onClick={ask}>
                Ask
              </Button>
            </div>

            {answer && (
              <div className="mt-4 rounded-xl border border-[--color-border] bg-[--color-surface] p-4 text-sm">
                <div className="font-medium text-[--color-text]">Jawaban</div>
                <div className="mt-2 whitespace-pre-wrap text-[--color-muted]">{answer}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
