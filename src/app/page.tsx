import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { HowItWorksAnimation } from "@/components/site/how-it-works-animation";
import { Section } from "@/components/site/section";
import { GeometricBackground } from "@/components/site/geometric-bg";

export default async function Home() {
  return (
    <div className="relative">
      <GeometricBackground />
      <div className="relative flex flex-col gap-14">
      {/* HERO */}
      <Section className="py-0">
        <div className="grid items-start gap-10 lg:grid-cols-12">
          {/* 40% */}
          <div className="lg:col-span-5">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Pay-per-use AI microservices.
              <span className="block text-[--color-muted]">Built for agents.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[--color-muted]">
              Interent is a microservices AI marketplace where you mix & match best-in-class
              providers (OCR, translation, scraping, LLMs) without subscriptions. Pay only
              when a task runs — then fetch the result via API.
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
      </Section>

      {/* PROBLEM */}
      <Section className="border-t border-[--color-border] pt-10">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
              PROBLEM
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Subscriptions don’t scale.</h2>
          </div>
          <div className="lg:col-span-8">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "Users end up paying for multiple monthly plans just to run a few tasks.",
                "Most tools lock the best features behind recurring commitments.",
                "If the output isn’t good, you still paid the month (and you must remember to cancel).",
                "Workflows often need multiple services: scrape → OCR → translate → report.",
              ].map((t) => (
                <div
                  key={t}
                  className="border border-[--color-border] bg-white p-4 text-sm text-[--color-muted]"
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* SOLUTION */}
      <Section className="border-t border-[--color-border] pt-10">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
              SOLUTION
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              One marketplace, many providers.
            </h2>
          </div>
          <div className="lg:col-span-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-[--color-border] bg-white p-5">
                <div className="text-sm font-semibold">Pick a task</div>
                <div className="mt-1 text-sm text-[--color-muted]">
                  OCR, translation, scraping, LLM chat, and more.
                </div>
              </div>
              <div className="border border-[--color-border] bg-white p-5">
                <div className="text-sm font-semibold">Pay per use</div>
                <div className="mt-1 text-sm text-[--color-muted]">
                  No subscriptions. No vendor accounts. No lock-in.
                </div>
              </div>
              <div className="border border-[--color-border] bg-white p-5">
                <div className="text-sm font-semibold">Fetch results</div>
                <div className="mt-1 text-sm text-[--color-muted]">
                  Serverless-friendly job status + result API.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* USE CASE */}
      <Section className="border-t border-[--color-border] pt-10">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
              USE CASE
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Build workflows from micro-agents.
            </h2>
          </div>
          <div className="lg:col-span-8 space-y-4">
            <div className="border border-[--color-border] bg-white p-5 text-sm">
              <div className="font-semibold">Example goal</div>
              <div className="mt-2 text-[--color-muted]">
                “I want to scrape data about disease outbreaks in 2025, then generate a clean
                dashboard and a report — without stitching everything manually.”
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="border border-[--color-border] bg-white p-5">
                <div className="text-sm font-semibold">The old way</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[--color-muted]">
                  <li>Subscribe to a scraping tool</li>
                  <li>Subscribe to OCR</li>
                  <li>Subscribe to translation</li>
                  <li>Subscribe to reporting / dashboards</li>
                </ul>
                <div className="mt-3 text-xs text-[--color-muted]">
                  Multiple bills. Monthly minimums. Hard to cancel on time.
                </div>
              </div>
              <div className="border border-[--color-border] bg-white p-5">
                <div className="text-sm font-semibold">With Interent</div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[--color-muted]">
                  <li>Pick recommended tasks (or compose your own)</li>
                  <li>Run only what you need, when you need it</li>
                  <li>Iterate until you’re satisfied</li>
                  <li>Pay per run — no commitment</li>
                </ul>
                <div className="mt-3 text-xs text-[--color-muted]">
                  One interface. Pay-per-use. Agent-native.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section className="border-t border-[--color-border] pt-10">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="text-xs font-semibold tracking-widest text-[--color-muted]">
              READY
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight">
              Run your first task in minutes.
            </div>
            <div className="mt-1 text-sm text-[--color-muted]">
              Start with OCR or translation — then expand to any wrapped provider.
            </div>
          </div>
          <a href="/marketplace">
            <Button>
              Browse tasks <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </Section>
      </div>
    </div>
  );
}
