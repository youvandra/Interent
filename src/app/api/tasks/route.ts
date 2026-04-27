import { NextResponse } from "next/server";
import { supabasePublic } from "@/lib/supabase/public";

export async function GET() {
  const sb = supabasePublic();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase env belum di-set" },
      { status: 500 },
    );
  }

  const { data, error } = await sb.from("tasks").select("*").order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    tasks: (data ?? []).map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priceUsdc: Number(t.price_usdc).toFixed(2),
      provider: t.provider,
      endpoint: t.endpoint,
    })),
  });
}

