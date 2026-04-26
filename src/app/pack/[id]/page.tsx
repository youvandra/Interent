import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";

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
      <div className="rounded-xl border bg-white p-6">
        <div className="text-lg font-semibold">Pack tidak ditemukan</div>
        <Link className="mt-4 inline-block text-sm underline" href="/">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-white p-6">
      <div className="text-2xl font-semibold">{pack.title}</div>
      <div className="mt-2 text-sm text-zinc-600">{pack.description}</div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-semibold">{Number(pack.price_usdc).toFixed(2)}</span>{" "}
          <span className="text-zinc-600">USDC</span>
        </div>
        <Link
          href={`/checkout/${pack.id}`}
          className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Buy & Checkout
        </Link>
      </div>

      <div className="mt-6 text-xs text-zinc-500">
        Catatan: setelah bayar (webhook), kamu bakal bisa akses chat page.
      </div>
    </div>
  );
}
