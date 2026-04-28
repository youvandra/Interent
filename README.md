# Interent

**Interent** is a pay-to-run AI toolchain marketplace:
describe a task → get a suggested toolchain and expected outputs → review transparent pricing (incl. service fee) → pay once via **Locus Checkout** → Interent executes each step via **Locus Wrapped APIs** and returns the result.

> Repo status: MVP / demo-friendly. Some providers and endpoints depend on what you have populated in the database.

---

## What you can do

- **Plan** a workflow from natural language (`/input`)
  - Suggested flow (toolchain)
  - Expected output selection (multi-select)
  - Pricing breakdown: subtotal + 5% service fee + total (USDC precision)
- **Choose provider alternatives** for certain steps (e.g. `chat` via OpenAI or Gemini) when multiple options exist in the `tasks` table.
- **Pay & run** using Locus Checkout (single payment for the entire workflow).
- **Test Pay** mode for demos without paying (creates a mock “DONE” job result).
- Browse available providers/endpoints in `/provider` (old `/marketplace` redirects).

---

## Tech stack

- **Next.js (App Router)** + **TypeScript**
- **Supabase Postgres** (jobs, tasks, pricing)
- **Locus Checkout** (`@withlocus/checkout-react`)
- **Locus Wrapped APIs** (server-side execution)

---

## Project structure (high-level)

```
src/
  app/
    input/                 # Describe task → plan toolchain → pay/testpay
    jobs/[id]/             # Job viewer (input/toolchain + output)
    provider/              # Provider catalog UI (reads from tasks table)
    api/
      plan/                # Toolchain planner (AI provider, OpenAI-compatible) + DB normalization
      tasks/               # List supported tasks/tools from DB
      workflows/create/    # Create workflow checkout session (Locus)
      workflows/testpay/   # Create mock DONE job (no payment, no execution)
      webhooks/locus/      # Payment webhook → execute workflow/step calls
      admin/sync-tools/    # Populate tasks from Locus provider docs (server-side)
  lib/
    locus_wrapped.ts       # Helper for calling Locus wrapped endpoints
```

---

## Getting started

### 1) Prerequisites

- Node.js 18+ (recommended)
- A Supabase project
- Locus API credentials (internal/private depending on your org)

### 2) Supabase setup

1. Create a project in Supabase
2. Open **SQL Editor** → run: `supabase-schema.sql`
3. Copy credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

> Reads use the anon key. Writes in server routes/webhooks use the service role key.

### 3) Locus setup

Set:
- `LOCUS_API_KEY`
- `LOCUS_API_BASE`

### 4) Environment variables

Copy `.env.example` → `.env.local` and fill it in.

Important:
- `NEXT_PUBLIC_APP_URL` must be publicly reachable for webhooks.
  - Local dev: `http://localhost:3000` (webhooks won’t reach local without a tunnel)
  - Deployed: `https://your-app.vercel.app`

### 5) Run locally

```bash
npm install
npm run dev
```

Open:
- `http://localhost:3000/input`

---

## Core flows

### Plan (Suggested flow + Expected output)

`POST /api/plan`
- Uses an OpenAI-compatible AI provider (configurable via env)
- Normalizes steps against the `tasks` table (canonical labels + pricing)
- Returns pricing fields:
  - `subtotalToolsUsdc`
  - `serviceFeeUsdc` (5% of subtotal)
  - `totalPriceUsdc`

### Configure the planner AI provider (e.g. Sumopod)

The planner (tool detection) calls an OpenAI-compatible `POST /v1/chat/completions` endpoint.

Set env vars:

```bash
AI_PROVIDER_BASE=https://ai.sumopod.com
AI_PROVIDER_API_KEY=...
AI_PROVIDER_MODEL=gpt-5-nano
```

### Pay & execute

1. `POST /api/workflows/create` → returns checkout session
2. User completes Locus checkout
3. Locus webhook hits:
   - `POST /api/webhooks/locus`
4. Webhook executes the workflow steps using Locus Wrapped APIs and stores results in `jobs.result_json`

### Test Pay (no money)

Use **Test Pay** on `/input` to create a mock job:
- No Locus payment
- No wrapped API calls
- Job immediately `DONE` with example output

---

## Populate the provider catalog (`tasks` table)

The `/provider` page shows whatever is in `public.tasks`.

### Token pricing in DB ($0.10/M)

This repo interprets `public.tasks.price_usdc` as **$ per 1M tokens** (e.g. `0.10` means `$0.10/M`).

If you already created your Supabase tables, run the migration in:

- `supabase/migrations/20260428_000001_token_pricing_0_10_per_million.sql`

in the Supabase SQL Editor.

To import the full Wrapped API catalog into `tasks`, call the admin sync endpoint:

1) Set env:
- `ADMIN_SECRET` (any random string)

2) Call:

```bash
curl -X POST https://<your-domain>/api/admin/sync-tools \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"priceUsdc": 0.10}'
```

Or sync one provider:

```bash
curl -X POST https://<your-domain>/api/admin/sync-tools \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"provider":"openai","priceUsdc":0.10}'
```

---

## Deployment (Vercel)

1. Import the repo into Vercel
2. Set environment variables (same as `.env.local`)
3. Deploy

> Ensure `NEXT_PUBLIC_APP_URL` points to the deployed HTTPS URL so the Locus webhook can reach your server.

---

## Troubleshooting

### `@locus/agent-sdk` can't be installed

The merchant SDK package may not be publicly available. This project creates checkout sessions via REST in:

- `src/app/api/jobs/create/route.ts`

If your environment uses a different checkout creation endpoint, update that route.

---

## Security

See `SECURITY.md` (internal notes).
