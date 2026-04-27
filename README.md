# Interent (Supabase + Serverless)

MVP untuk event internal: **pay-to-run tasks** (OCR, translation, dll) dengan **Locus Checkout** + eksekusi via **Locus Wrapped APIs**.

## 1) Setup Supabase

1. Bikin project di Supabase
2. Buka **SQL Editor** → jalankan file: `supabase-schema.sql`
3. Ambil env:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only)

> Untuk MVP, reads dilakukan via public anon key. Writes (webhook) via service role key.

## 2) Setup Locus (Internal)

1. Minta `LOCUS_API_KEY` dan `LOCUS_API_BASE` ke tim/platform internal
2. Set env:
   - `LOCUS_API_KEY`
   - `LOCUS_API_BASE`

## 3) Env vars

Copy `.env.example` → `.env.local` lalu isi.

Penting:
- `NEXT_PUBLIC_APP_URL` harus jadi base URL yang bisa diakses publik saat deploy (buat webhook).
  - Lokal: `http://localhost:3000` (webhook nggak akan ke-hit dari internet)
  - Deploy: `https://your-app.vercel.app`

## 4) Run lokal

```bash
npm install
npm run dev
```

## 5) Deploy (Vercel)

1. Import repo ke Vercel
2. Isi env vars (sama seperti `.env.local`)
3. Deploy

## Webhook notes

Webhook endpoint:
- `POST /api/webhooks/locus`

Handler akan:
1. Cari `jobs.session_id`
2. Kalau `webhook_secret` ada, verify HMAC header `X-Signature-256`
3. Kalau event `checkout.session.paid` → jalankan Wrapped API sesuai `task_id` → simpan result di `jobs.result_json`

## Troubleshooting

### `@locus/agent-sdk` nggak bisa di-install
Package merchant SDK ini belum ada di npm publik. Jadi project ini **create checkout session via REST** di:
- `src/app/api/jobs/create/route.ts`

Kalau ternyata endpoint create session beda di environment kamu, edit 1 tempat itu aja.
