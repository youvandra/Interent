import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default async function MarketplacePage() {
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

  const { data: tasks, error } = await sb
    .from("tasks")
    .select("*")
    .order("created_at");

  if (error) {
    return (
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Supabase error</div>
        <pre className="mt-2 overflow-auto text-sm text-red-600">{error.message}</pre>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(tasks ?? []).map((t: any) => (
        <Card key={t.id} className="group">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{t.title}</span>
              <span className="border border-[--color-border-strong] bg-[--color-primary-soft] px-2 py-1 text-xs font-semibold text-[--color-primary]">
                {Number(t.price_usdc).toFixed(2)} USDC
              </span>
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Link href={`/task/${t.id}`}>
              <span
                className="inline-flex items-center text-[--color-primary] opacity-80 transition group-hover:opacity-100"
                aria-label={`Open ${t.title}`}
              >
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
