import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
              <Badge className="border-[--color-primary]/20 bg-[--color-primary-soft] text-[--color-primary]">
                {Number(t.price_usdc).toFixed(2)} USDC
              </Badge>
            </CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-xs text-[--color-muted]">Task ID: {t.id}</div>
            <Link href={`/task/${t.id}`}>
              <Button variant="secondary" className="group-hover:border-[--color-border-strong]">
                Start <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
