import Link from "next/link";
import { supabasePublic } from "@/lib/supabase/public";

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketplace Intelligence (AI Memory)</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Beli akses ke “context memory pack” pakai USDC (Base) via Locus Checkout.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(packs ?? []).map((p: any) => (
          <div key={p.id} className="rounded-xl border bg-white p-5">
            <div className="text-lg font-semibold">{p.title}</div>
            <div className="mt-1 text-sm text-zinc-600">{p.description}</div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{Number(p.price_usdc).toFixed(2)}</span>{" "}
                <span className="text-zinc-600">USDC</span>
              </div>
              <Link
                href={`/pack/${p.id}`}
                className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                Lihat
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
