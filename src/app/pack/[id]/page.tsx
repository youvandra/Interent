import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = supabasePublic();
  if (!sb) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Setup required</div>
        <div className="mt-2 text-sm text-zinc-600">
          Isi <code>.env.local</code> (lihat <code>.env.example</code>) dan jalankan{" "}
          <code>supabase-schema.sql</code> di Supabase.
        </div>
        <Link className="mt-4 inline-block text-sm underline" href="/">
          Kembali
        </Link>
      </div>
    );
  }
  const { data: pack, error } = await sb
    .from("memory_packs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Supabase error</div>
        <pre className="mt-2 overflow-auto text-sm text-red-600">{error.message}</pre>
      </div>
    );
  }

  if (!pack) {
    return (
      <Card className="p-6">
        <CardTitle>Pack tidak ditemukan</CardTitle>
        <Link className="mt-4 inline-block text-sm underline" href="/">
          Kembali
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-2xl">{pack.title}</CardTitle>
              <Badge className="border-[--color-primary]/20 bg-[--color-primary-soft] text-[--color-primary]">
                {Number(pack.price_usdc).toFixed(2)} USDC
              </Badge>
            </div>
            <CardDescription>{pack.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-4 text-sm text-[--color-muted]">
              <div className="font-medium text-[--color-text]">What you unlock</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Context/persona rules untuk chat</li>
                <li>Contoh jawaban & tone</li>
                <li>Gating via entitlement (webhook)</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-[--color-muted]">Pack ID: {pack.id}</div>
              <div className="flex gap-2">
                <Link href="/">
                  <Button variant="ghost">Back</Button>
                </Link>
                <Link href={`/checkout/${pack.id}`}>
                  <Button>
                    Buy & Checkout <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>Tip</CardTitle>
            <CardDescription>Biar demo keliatan agentic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[--color-muted]">
            <div className="rounded-xl border border-[--color-border] bg-white p-3">
              Setelah paid, buka <span className="font-mono">/chat/{pack.id}</span>
            </div>
            <div className="rounded-xl border border-[--color-border] bg-white p-3">
              Kalau “akses belum kebuka”, biasanya webhook belum masuk (wajib URL publik).
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
