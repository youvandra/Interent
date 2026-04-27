-- Interent (MVP) — Pay-to-run tasks via Locus Checkout + Locus Wrapped APIs
-- Jalankan ini di Supabase SQL Editor.

-- 1) Task catalog
create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null,
  price_usdc numeric(12,2) not null check (price_usdc > 0),
  provider text not null,  -- locus wrapped provider slug (mis. deepl, mathpix)
  endpoint text not null,  -- locus wrapped endpoint (mis. translate, process-image)
  created_at timestamptz not null default now()
);

-- 2) Jobs (dibuat sebelum bayar; dieksekusi setelah PAID)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  buyer_id text not null,
  task_id text not null references public.tasks(id) on delete cascade,

  status text not null default 'PENDING_PAYMENT',
  input_json jsonb,
  result_json jsonb,
  error_message text,

  job_token_hash text not null, -- sha256 token; token plaintext hanya dikasih sekali ke buyer

  -- Locus checkout linkage
  session_id uuid,
  webhook_secret text,
  checkout_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  completed_at timestamptz
);

create index if not exists jobs_buyer_id_idx on public.jobs(buyer_id);
create index if not exists jobs_task_id_idx on public.jobs(task_id);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_session_id_idx on public.jobs(session_id);

-- Seed contoh tasks
insert into public.tasks (id, title, description, price_usdc, provider, endpoint)
values
  ('ocr_mathpix', 'OCR (Mathpix)', 'Extract text/LaTeX from an image URL.', 0.01, 'mathpix', 'process-image'),
  ('translate_deepl', 'Translate (DeepL)', 'High-quality translation for heavy text.', 0.01, 'deepl', 'translate')
on conflict (id) do nothing;
