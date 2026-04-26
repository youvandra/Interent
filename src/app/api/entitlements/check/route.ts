import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { buyerId, packId } = (await req.json()) as {
    buyerId?: string;
    packId?: string;
  };

  if (!buyerId) return NextResponse.json({ error: "buyerId required" }, { status: 400 });
  if (!packId) return NextResponse.json({ error: "packId required" }, { status: 400 });

  const sb = supabaseServer();
  const { data, error } = await sb
    .from("entitlements")
    .select("*")
    .eq("buyer_id", buyerId)
    .eq("pack_id", packId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ hasAccess: !!data });
}

