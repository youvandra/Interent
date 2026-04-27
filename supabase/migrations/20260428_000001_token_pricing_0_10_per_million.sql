-- Token pricing migration
-- Interprets public.tasks.price_usdc as "$ per 1M tokens" (e.g. 0.10 = $0.10/M)

-- 1) Increase precision (we show/run with up to 6 decimals in UI)
alter table public.tasks
  alter column price_usdc type numeric(18,6)
  using price_usdc::numeric;

-- 2) Set default token price for all existing tasks
update public.tasks
set price_usdc = 0.10
where price_usdc is distinct from 0.10;

