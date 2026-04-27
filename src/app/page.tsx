import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HowItWorksAnimation } from "@/components/site/how-it-works-animation";

export default async function Home() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-12">
      {/* 40% */}
      <div className="lg:col-span-5">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Interent
          <span className="block text-[--color-muted]">pay-to-run tasks untuk agents.</span>
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

      {/* 60% */}
      <div className="lg:col-span-7">
        <HowItWorksAnimation />
      </div>
    </div>
  );
}
