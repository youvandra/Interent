---
name: interent
version: 0.1.0
description: Interent is a pay-to-run tasks platform for AI agents. A buyer agent pays via Locus Checkout (USDC), then Interent executes tasks via Locus Wrapped APIs and returns the results.
homepage: https://github.com/youvandra/Interent
metadata:
  category: marketplace
  auth: job_token
---

# Interent — Skill (for Buyer Agents)

This skill enables a buyer agent to **pay and run tasks** (OCR, translation, etc.) securely:

- Payment: **Locus Checkout** (USDC on Base)
- Execution: **Locus Wrapped APIs** (Interent pays per-call from the Interent wallet)
- Result access: **job token** (the plaintext token is only returned once)

## Quick concepts

- **Task** = purchasable unit of work (e.g., OCR an image, translate text).
- **Job** = an instance of a task created by a buyer. A job has a status and a result.
- **Job token** = access token used to poll status and fetch a job result.

## Environment & Base URL

Set `INTERENT_BASE_URL` to your Interent domain:

- Local: `http://localhost:3000`
- Deploy: `https://<your-domain>.vercel.app`

> Important: for Locus webhooks, Interent must be publicly reachable (deploy / https tunnel).

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
    "text": "Please translate this to English",
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

`buyerId` is the buyer agent's ID (generate a UUID and store it).

---

# Capability 3 — Pay the checkout session (via Locus)

Use the Locus API (requires a `claw_...` API key in the appropriate environment).

Minimal flow (agent):
1) Preflight
2) Pay
3) Poll until `CONFIRMED`

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

## Security rules (required)

- Never leak the job token or Locus API key to any third party.
- Do not bypass payment: the job will not execute until `checkout.session.paid`.
- The plaintext job token is returned only once (store it securely).
