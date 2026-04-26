import { createClient } from "@supabase/supabase-js";

export function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Jangan throw biar build/dev awal nggak langsung fail.
  // Halaman akan tampilkan instruksi setup kalau env belum ada.
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
