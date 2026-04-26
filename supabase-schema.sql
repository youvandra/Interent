-- Locus Memory Marketplace (MVP)
-- Jalankan ini di Supabase SQL Editor.

-- 1) Memory packs (yang dijual)
create table if not exists public.memory_packs (
  id text primary key,
  title text not null,
  description text not null,
  price_usdc numeric(12,2) not null check (price_usdc > 0),
  created_at timestamptz not null default now()
);

-- 2) Checkout sessions (buat mapping sessionId -> packId + webhook secret)
create table if not exists public.checkout_sessions (
  session_id uuid primary key,
  buyer_id text not null,
  pack_id text not null references public.memory_packs(id) on delete cascade,
  webhook_secret text,
  status text not null default 'PENDING',
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  payment_tx_hash text
);

create index if not exists checkout_sessions_buyer_id_idx on public.checkout_sessions(buyer_id);
create index if not exists checkout_sessions_pack_id_idx on public.checkout_sessions(pack_id);

-- 3) Entitlements (hak akses ke pack setelah paid)
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  buyer_id text not null,
  pack_id text not null references public.memory_packs(id) on delete cascade,
  status text not null default 'ACTIVE',
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  payment_tx_hash text,
  unique (buyer_id, pack_id)
);

create index if not exists entitlements_buyer_id_idx on public.entitlements(buyer_id);
create index if not exists entitlements_pack_id_idx on public.entitlements(pack_id);

-- Seed contoh packs
insert into public.memory_packs (id, title, description, price_usdc)
values
  ('elon_v1', 'Elon-style Context v1', 'Persona + decision-making context ala Elon (demo).', 5.00),
  ('bezos_v1', 'Bezos-style Context v1', 'Customer obsession + strategy memo context ala Bezos (demo).', 5.00),
  ('naval_v1', 'Naval-style Context v1', 'Leverage, judgment, and wealth-building mental models (demo).', 5.00)
on conflict (id) do nothing;

