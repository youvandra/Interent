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

This skill enables a buyer agent to **plan, pay, and run** AI microservice workflows:

- Payment: **Locus Checkout** (USDC on Base)
- Execution: **Locus Wrapped APIs** (Interent pays per-call from the Interent wallet)
- Result access: **job token**

## Agent behavior contract (READ THIS FIRST)

When a user says “read this skill.md”, **do not** summarize or restate this entire document.
Instead:

1) Give a **1–2 sentence** introduction of Interent.
2) Ask the user **what task** they want to send to Interent.
3) Ask how they want to **pay** (two options below).

### Required questions to ask the user

- What is the task/prompt?
- What outputs do you want? (pick from `expectedOutputs` or describe your desired format)
- Any constraints? (language, URL(s), length, tone, etc.)
- Payment choice:
  - **Option A (safer):** I will create a checkout session and you pay via `checkoutUrl`.
  - **Option B:** If you explicitly want the agent to pay, provide a **beta Locus API key** (`claw_dev_*`).

### Example response format (what you should say)

> “Interent is a pay-to-run toolchain marketplace: I can plan a workflow, show pricing, and run it after payment.  
> What task do you want me to send to Interent? Also choose payment: (A) you pay the checkoutUrl, or (B) you give me a beta Locus API key (claw_dev_*) so I can pay for you.”

## Quick concepts

- **Task** = purchasable unit of work (e.g., OCR an image, translate text).
- **Job** = an instance of a task created by a buyer. A job has a status and a result.
- **Job token** = access token used to poll status and fetch a job result.
- **Workflow** = a chain of tasks (toolchain) planned from natural language (e.g., scrape → translate → TTS).
- **Expected output** = what the buyer wants to receive at the end (e.g., translated text, audio file, JSON).

## Environment & Base URL

Set `INTERENT_BASE_URL` to your Interent domain:

- Deploy: `https://interent.vercel.app`

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

# Capability 2 — Plan a toolchain (Suggested flow + Expected output + Pricing)

**POST** `${INTERENT_BASE_URL}/api/plan`

Body:
```json
{ "text": "Extract the article body from a URL, translate to Spanish, then generate audio." }
```

Response (shape):
```json
{
  "steps": [
    { "taskId": "firecrawl_scrape", "tool": "firecrawl/scrape", "label": "Web Scrape (Firecrawl)", "priceUsdc": "0.010000", "missing": false },
    { "taskId": "translate_deepl", "tool": "deepl/translate", "label": "Translate (DeepL)", "priceUsdc": "0.010000", "missing": false },
    { "taskId": "openai_tts", "tool": "openai/tts", "label": "Text-to-Speech (OpenAI)", "priceUsdc": "0.010000", "missing": false }
  ],
  "expectedOutputs": [
    { "id": "translated_text", "label": "Translated text", "description": "Final translated text in your target language.", "defaultSelected": true },
    { "id": "audio_file", "label": "Audio file (MP3)", "description": "Speech audio generated from the final text output.", "defaultSelected": true }
  ],
  "subtotalToolsUsdc": "0.030000",
  "serviceFeeRate": 0.05,
  "serviceFeeUsdc": "0.001500",
  "totalPriceUsdc": "0.031500",
  "notes": "..."
}
```

Rules:
- If a required step is not supported, the planner will mark it with `"missing": true`. You must not proceed to payment until missing steps are resolved (switch to supported tools or simplify the request).
- Prices are returned with up to **6 decimals** (USDC precision).
- `serviceFeeUsdc` is **5% of subtotalToolsUsdc** (same precision) and `totalPriceUsdc = subtotal + fee`.

---

# Capability 3 — Create workflow checkout session (single payment for the toolchain)

**POST** `${INTERENT_BASE_URL}/api/workflows/create`

Body:
```json
{
  "buyerId": "uuid-buyer-agent",
  "prompt": "Extract the article body from a URL, translate to Spanish, then generate audio.",
  "steps": [
    { "taskId": "firecrawl_scrape" },
    { "taskId": "translate_deepl" },
    { "taskId": "openai_tts" }
  ],
  "expectedOutputs": ["translated_text", "audio_file"],
  "totalPriceUsdc": "0.031500"
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

Notes:
- `buyerId` should be stable per buyer agent (generate a UUID once and store it).
- `totalPriceUsdc` should be the exact value returned by `/api/plan` (same decimals).

---

# Capability 4 — Pay the checkout session (via Locus)

Use the Locus API (requires a `claw_...` API key in the appropriate environment).

## Locus environment (important)

Locus has separate environments (prod/beta). Your `claw_dev_*` key only works on **beta**.

- **Beta API base:** `https://beta-api.paywithlocus.com/api`

Do **NOT** use `https://api.withlocus.com/...` for beta — that host is not the correct Locus API base for Interent’s beta flow.

Minimal flow (agent):
1) Preflight
2) Pay
3) Poll until `CONFIRMED`

Contoh (Beta):
```bash
curl https://beta-api.paywithlocus.com/api/checkout/agent/preflight/$SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY"

curl -X POST https://beta-api.paywithlocus.com/api/checkout/agent/pay/$SESSION_ID \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payerEmail":"buyer@example.com"}'
```

---

# Capability 5 — Poll job status

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

# Capability 6 — Get result

**GET** `${INTERENT_BASE_URL}/api/jobs/<jobId>/result`

Headers:
```
Authorization: Bearer job_live_...
```

Response (workflow example):
```json
{
  "result": {
    "kind": "workflow",
    "steps": [
      { "taskId": "firecrawl_scrape", "data": { "...": "..." } },
      { "taskId": "translate_deepl", "data": { "...": "..." } },
      { "taskId": "openai_tts", "data": { "...": "..." } }
    ]
  }
}
```

---

# Capability 7 — (Optional) Switch providers per step

Some capabilities can be satisfied by multiple providers (e.g. `chat` can be OpenAI or Gemini).
To switch, list all supported tasks and choose a different task with the same `endpoint`:

- `chat` (LLM chat)
- `tts` (text-to-speech)
- `translate`
- `scrape` / `search` / `extract`
- `image-generate`

**GET** `${INTERENT_BASE_URL}/api/tasks` returns `provider` and `endpoint` for each supported task.

---
