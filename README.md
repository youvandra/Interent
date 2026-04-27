# Interent (Supabase + Serverless)

Internal-event MVP: **pay-to-run tasks** (OCR, translation, etc.) with **Locus Checkout** + execution via **Locus Wrapped APIs**.

## 1) Setup Supabase

1. Create a project in Supabase
2. Open **SQL Editor** → run: `supabase-schema.sql`
3. Grab these env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

> For the MVP: reads use the public anon key. Writes (webhook) use the service role key.

## 2) Setup Locus (Internal)

Ask the internal platform/team for:
- `LOCUS_API_KEY`
- `LOCUS_API_BASE`

## 3) Env vars

Copy `.env.example` → `.env.local` and fill it in.

Important:
- `NEXT_PUBLIC_APP_URL` must be a publicly reachable base URL when deployed (for webhooks).
  - Local: `http://localhost:3000` (webhooks won't reach your local machine)
  - Deploy: `https://your-app.vercel.app`

## 4) Run locally

```bash
npm install
npm run dev
```

## 5) Deploy (Vercel)

1. Import the repo into Vercel
2. Set env vars (same as `.env.local`)
3. Deploy

## Webhook notes

Webhook endpoint:
- `POST /api/webhooks/locus`

Handler behavior:
1. Find the job by `jobs.session_id`
2. If `webhook_secret` exists, verify the HMAC header `X-Signature-256`
3. On `checkout.session.paid`, execute the Wrapped API for the job's `task_id` and store the result in `jobs.result_json`

## Sync full Wrapped API catalog (populate `tasks`)

If you want the full catalog (all providers + endpoints) inside the `tasks` table, call the server-side sync endpoint.

1) Set env:
- `ADMIN_SECRET` (any random string)

2) Call the endpoint:

```bash
curl -X POST https://<your-domain>/api/admin/sync-tools \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"priceUsdc": 0.01}'
```

You can also sync a single provider:

```bash
curl -X POST https://<your-domain>/api/admin/sync-tools \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: <ADMIN_SECRET>" \
  -d '{"provider":"openai","priceUsdc":0.01}'
```

## Troubleshooting

### `@locus/agent-sdk` can't be installed

The merchant SDK package isn't on the public npm registry. This project creates checkout sessions via REST in:
- `src/app/api/jobs/create/route.ts`

If your environment uses a different session-creation endpoint, update that one file.

## Security

See `SECURITY.md` (internal notes).
