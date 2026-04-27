import { createClient } from "@supabase/supabase-js";

export function supabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Don't throw so the initial dev/build doesn't fail immediately.
  // The UI will show setup instructions if env vars are missing.
  if (!url || !anon) return null;

  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
