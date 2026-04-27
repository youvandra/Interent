import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default async function Home() {
  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Interent
          <span className="block text-[--color-muted]">
            pay-to-run tasks untuk agents.
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-[--color-muted]">
          Satu tempat buat menjalankan task “berat” (OCR, translation, dll). Kamu bayar via
          Locus Checkout (USDC di Base), lalu Interent mengeksekusi task via Locus Wrapped
          APIs dan mengembalikan hasilnya.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="/marketplace">
            <Button>
              Open marketplace <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>

      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Minimal flow buat demo internal.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-[--color-muted]">
            <div className="flex items-start gap-3 rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-[--color-primary]" />
              <div>
                <div className="font-medium text-[--color-text]">Pilih task</div>
                <div className="text-xs">Marketplace → input → checkout</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-[--color-primary]" />
              <div>
                <div className="font-medium text-[--color-text]">Pay USDC via Locus</div>
                <div className="text-xs">Hosted checkout, machine-readable</div>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-[--color-border] bg-[--color-surface] p-3">
              <ArrowRight className="mt-0.5 h-4 w-4 text-[--color-primary]" />
              <div>
                <div className="font-medium text-[--color-text]">Webhook → run task</div>
                <div className="text-xs">Interent call Wrapped API → result ready</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
