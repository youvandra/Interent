import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Section } from "@/components/site/section";
import { ArrowRight, Sparkles } from "lucide-react";

export default async function Home() {
  // Server Component: fetch langsung dari Supabase (public read)
  const sb = supabasePublic();
  if (!sb) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Setup required</div>
        <div className="mt-2 text-sm text-zinc-600">
          Isi <code>.env.local</code> (lihat <code>.env.example</code>) lalu run{" "}
          <code>supabase-schema.sql</code> di Supabase.
        </div>
      </div>
    );
  }

  const { data: packs, error } = await sb
    .from("memory_packs")
    .select("*")
    .order("created_at");
  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Supabase error</div>
        <pre className="mt-2 overflow-auto text-sm text-red-600">{error.message}</pre>
        <div className="mt-4 text-sm text-zinc-600">
          Pastikan kamu sudah run <code>supabase-schema.sql</code> di Supabase, dan set{" "}
          <code>.env.local</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <Section className="py-6 sm:py-10">
        <div className="grid items-start gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2">
              <Badge className="border-[--color-primary]/20 bg-[--color-primary-soft] text-[--color-primary]">
                Checkout with Locus
              </Badge>
              <Badge>Machine-readable</Badge>
            </div>

            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Agents can buy context.
              <span className="block text-[--color-muted]">Interent makes it shippable.</span>
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-6 text-[--color-muted]">
              Marketplace untuk “AI memory packs” — persona/context yang bisa dipakai untuk
              chat. Pembayaran USDC di Base via Locus Checkout, dan akses kebuka otomatis via
              webhook.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="#packs">
                <Button>
                  Explore packs <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="https://docs.paywithlocus.com/credits" target="_blank" rel="noreferrer">
                <Button variant="secondary">
                  Request credits <Sparkles className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>How it works</CardTitle>
                <CardDescription>Simple flow, serverless-friendly.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-[--color-muted]">
                <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
                  1) Seller publish memory pack + price
                </div>
                <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
                  2) Buyer checkout USDC via Locus
                </div>
                <div className="rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
                  3) Webhook → entitlement → chat unlocked
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      <Section className="py-0">
        <div className="grid gap-4 rounded-2xl border border-[--color-border] bg-white p-6 sm:grid-cols-3">
          <div>
            <div className="text-sm text-[--color-muted]">Payment</div>
            <div className="mt-1 text-2xl font-semibold">USDC on Base</div>
          </div>
          <div>
            <div className="text-sm text-[--color-muted]">Checkout</div>
            <div className="mt-1 text-2xl font-semibold">Hosted + embed</div>
          </div>
          <div>
            <div className="text-sm text-[--color-muted]">Access</div>
            <div className="mt-1 text-2xl font-semibold">Webhook-gated</div>
          </div>
        </div>
      </Section>

      <Section id="packs" className="pt-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm text-[--color-muted]">Marketplace</div>
            <h2 className="mt-1 text-2xl font-semibold">Memory packs</h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(packs ?? []).map((p: any) => (
            <Card key={p.id} className="group">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{p.title}</span>
                  <Badge className="border-[--color-primary]/20 bg-[--color-primary-soft] text-[--color-primary]">
                    {Number(p.price_usdc).toFixed(2)} USDC
                  </Badge>
                </CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="text-xs text-[--color-muted]">Pack ID: {p.id}</div>
                <Link href={`/pack/${p.id}`}>
                  <Button variant="secondary" className="group-hover:border-[--color-border-strong]">
                    View <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>
    </div>
  );
}
