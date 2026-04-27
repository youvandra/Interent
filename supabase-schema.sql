-- Interent (MVP) — Pay-to-run tasks via Locus Checkout + Locus Wrapped APIs
-- Run this in the Supabase SQL Editor.

-- 1) Task catalog
create table if not exists public.tasks (
  id text primary key,
  title text not null,
  description text not null,
  -- Token pricing: "$ per 1M tokens" (e.g. 0.10 = $0.10/M)
  price_usdc numeric(18,6) not null check (price_usdc > 0),
  provider text not null,  -- Locus wrapped provider slug (e.g., deepl, mathpix)
  endpoint text not null,  -- Locus wrapped endpoint (e.g., translate, process-image)
  created_at timestamptz not null default now()
);

-- 2) Jobs (created before payment; executed after PAID)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  buyer_id text not null,
  task_id text not null references public.tasks(id) on delete cascade,

  status text not null default 'PENDING_PAYMENT',
  input_json jsonb,
  result_json jsonb,
  error_message text,

  job_token_hash text not null, -- sha256 token; plaintext token is returned only once to the buyer

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

-- Seed example tasks
insert into public.tasks (id, title, description, price_usdc, provider, endpoint)
values
  -- Workflow meta-task (used to charge and run multi-step toolchains)
  ('workflow', 'Workflow', 'Multi-step workflow runner (internal).', 0.10, 'interent', 'workflow'),

  ('ocr_mathpix', 'OCR (Mathpix)', 'Extract text/LaTeX from an image URL.', 0.10, 'mathpix', 'process-image'),
  ('translate_deepl', 'Translate (DeepL)', 'High-quality translation for heavy text.', 0.10, 'deepl', 'translate'),

  -- OpenAI (Wrapped)
  ('openai_chat', 'LLM Chat (OpenAI)', 'Chat completion via OpenAI wrapped API.', 0.10, 'openai', 'chat'),
  ('openai_embed', 'Embeddings (OpenAI)', 'Generate embeddings for text.', 0.10, 'openai', 'embed'),
  ('openai_image', 'Image Generate (OpenAI)', 'Generate image from prompt.', 0.10, 'openai', 'image-generate'),
  ('openai_tts', 'Text-to-Speech (OpenAI)', 'Generate speech audio from text.', 0.10, 'openai', 'tts'),
  ('openai_moderate', 'Moderation (OpenAI)', 'Classify text for harmful content.', 0.10, 'openai', 'moderate'),

  -- Gemini (Wrapped)
  ('gemini_chat', 'LLM Chat (Gemini)', 'Multimodal chat via Gemini wrapped API.', 0.10, 'gemini', 'chat'),
  ('gemini_embed', 'Embeddings (Gemini)', 'Generate embeddings for text.', 0.10, 'gemini', 'embed'),
  ('gemini_count_tokens', 'Count Tokens (Gemini)', 'Estimate tokens (free endpoint).', 0.10, 'gemini', 'count-tokens'),

  -- Firecrawl (Wrapped)
  ('firecrawl_scrape', 'Web Scrape (Firecrawl)', 'Scrape a single URL (markdown/json).', 0.10, 'firecrawl', 'scrape'),
  ('firecrawl_crawl', 'Web Crawl (Firecrawl)', 'Crawl a site up to N pages.', 0.10, 'firecrawl', 'crawl'),
  ('firecrawl_map', 'Site Map (Firecrawl)', 'Discover URLs on a site.', 0.10, 'firecrawl', 'map'),
  ('firecrawl_extract', 'Extract Data (Firecrawl)', 'Extract structured data from URLs.', 0.10, 'firecrawl', 'extract'),
  ('firecrawl_search', 'Web Search (Firecrawl)', 'Search the web and return content.', 0.10, 'firecrawl', 'search'),

  -- Exa (Wrapped)
  ('exa_search', 'Semantic Search (Exa)', 'Search the web with Exa.', 0.10, 'exa', 'search'),
  ('exa_contents', 'Fetch Contents (Exa)', 'Fetch page contents by URL/ID.', 0.10, 'exa', 'contents'),
  ('exa_find_similar', 'Find Similar (Exa)', 'Find pages similar to a URL.', 0.10, 'exa', 'find-similar'),
  ('exa_answer', 'Answer w/ Sources (Exa)', 'Get answer with citations.', 0.10, 'exa', 'answer')
on conflict (id) do nothing;
