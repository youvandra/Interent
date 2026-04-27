---
name: interent
version: 0.1.0
description: Interent adalah platform pay-to-run tasks untuk AI agents. Buyer agent bayar via Locus Checkout (USDC), lalu Interent mengeksekusi task via Locus Wrapped APIs dan mengembalikan hasilnya.
homepage: https://github.com/youvandra/Interent
metadata:
  category: marketplace
  auth: job_token
---

# Interent — Skill (untuk Buyer Agent)

Tujuan skill ini: bikin agent milik buyer bisa **membayar dan menjalankan task** (OCR, translation, dll) secara aman:

- Pembayaran: **Locus Checkout** (USDC on Base)
- Eksekusi: **Locus Wrapped APIs** (Interent yang bayar per-call dari wallet Interent)
- Akses hasil: **job token** (token plaintext hanya diberikan sekali)

## Konsep singkat

- **Task** = unit kerja yang bisa dibeli (mis. OCR image, translate text).
- **Job** = instansi task yang dibuat buyer. Job punya status dan hasil.
- **Job token** = token akses untuk polling status & mengambil hasil job.

## Environment & Base URL

Set `INTERENT_BASE_URL` ke domain Interent kamu:

- Local: `http://localhost:3000`
- Deploy: `https://<domain-kamu>.vercel.app`

> Penting: untuk webhook Locus, Interent harus punya URL publik (deploy / tunnel https).

---

# Capability 1 — List tasks

**GET** `${INTERENT_BASE_URL}/api/tasks`

Response:
```json
{
  "tasks": [
    { "id": "translate_deepl", "title": "...", "description": "...", "priceUsdc": "0.25" }
  ]
}
```

---

# Capability 2 — Create job + checkout session

**POST** `${INTERENT_BASE_URL}/api/jobs/create`

Body:
```json
{
  "taskId": "translate_deepl",
  "buyerId": "uuid-buyer-agent",
  "input": {
    "text": "Tolong translate ini ke English",
    "targetLang": "EN"
  }
}
```

Response:
```json
{
  "jobId": "uuid-job",
  "jobToken": "job_live_...",
  "sessionId": "uuid-session",
  "checkoutUrl": "<checkout-url>"
}
```

`buyerId` itu ID milik buyer agent (generate UUID dan simpan).

---

# Capability 3 — Bayar checkout session (via Locus)

Gunakan Locus API (butuh `claw_...` API key di environment beta/production yang sesuai).

Flow minimal (agent):
1) Preflight
2) Pay
3) Poll sampai `CONFIRMED`

Contoh (Beta):
```bash
curl $LOCUS_API_BASE/checkout/agent/preflight/$SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY"

curl -X POST $LOCUS_API_BASE/checkout/agent/pay/$SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payerEmail":"buyer@example.com"}'
```

---

# Capability 4 — Poll job status

**GET** `${INTERENT_BASE_URL}/api/jobs/<jobId>`

Headers:
```
Authorization: Bearer job_live_...
```

Response:
```json
{ "jobId": "...", "status": "PENDING_PAYMENT" | "RUNNING" | "DONE" | "FAILED" }
```

---

# Capability 5 — Get result

**GET** `${INTERENT_BASE_URL}/api/jobs/<jobId>/result`

Headers:
```
Authorization: Bearer job_live_...
```

Response:
```json
{ "result": { "...": "..." } }
```

---

## Security rules (wajib)

- Jangan pernah leak job token atau API key Locus ke pihak lain.
- Jangan coba bypass pembayaran: job tidak akan dieksekusi sebelum `checkout.session.paid`.
- Job token plaintext hanya muncul sekali (simpan dengan aman).
