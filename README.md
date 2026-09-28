# DynaSaurus 🦕

**AI language learning that adapts to the learner — not the other way around.**

DynaSaurus is a production web app that turns a language learner's *level, first language and interests* into personalised vocabulary explanations, translation, grammar feedback and IELTS speaking practice.

Live: https://dynasaurus.rkrk.io

---

## Why it's different

Most AI language tools return the same generic answer to everyone. DynaSaurus is built on a **pedagogy-first** premise: an explanation is only useful if it lands at the learner's current level, in the learner's own first language, and inside the topics they actually care about.

- **CEFR-aware** — every answer is pitched at A1–C2.
- **First-language-aware** — explanations use cross-linguistic mapping (e.g. an English word explained to a Mandarin, Korean or Spanish speaker differently).
- **Interest-driven** — examples are drawn from the learner's own hobbies, so vocabulary sticks.
- **The RUA method** — a structured learning loop: **Recognise → Understand → Apply**.

## Core modules

| Module | What it does |
| --- | --- |
| Smart dictionary | Personalised word explanations built around level, L1 and interests |
| Translation | Language and cross-cultural guidance explaining *why* an expression works |
| Grammar feedback | Corrections that explain the issue, not just a rewritten sentence |
| IELTS speaking | Practice prompts and structured support for building answers |

The interface and learner profiles support **11 language settings**.

## Tech stack

- **Framework** — Next.js 16 (App Router), React 19, TypeScript
- **Styling** — Tailwind CSS v4
- **Auth & data** — Supabase (auth, Postgres, storage)
- **Payments** — Stripe subscriptions (recurring price tiers)
- **AI** — LLM routing across providers; streaming responses over SSE
- **Speech** — audio transcription for pronunciation/upload flows
- **PWA** — installable, offline-aware shell

## Architecture highlights

- **Structured profile contract** — the client never sends a freeform system prompt. Learner attributes are validated and clamped server-side into an allowlisted profile before they reach the model. This keeps personalisation safe and predictable.
- **Streaming by design** — chat responses stream to the client with buffered SSE framing.
- **Entitlement model** — free and paid tiers with a server-side entitlement check and a free daily lookup allowance.
- **Payments built to be idempotent** — signed webhooks, no double-granting on repeated callbacks, amount verification.
- **Production hardening** — allowlisted CORS, explicit no-store caching for app/API routes, rate limiting, and a health endpoint.

## Getting started

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env.local   # then fill in your own keys

# 3. run
npm run dev        # development
npm run build      # production build
npm start          # serve the production build
```

Quality gates: `npm run lint`, `npm run typecheck`, `npm run check:seo`.

## Configuration

All secrets are read from the environment — none are committed. See [`.env.example`](./.env.example) for the full list (Supabase, Stripe, AI provider keys, payment aggregator, advertising).

## Status

Live and in active development. Free and paid plans; audio upload and word-level audio are available today.

## Author

Built by **Kee Lee** — teacher and founder — to encode real classroom pedagogy into an AI tutor.
- https://rkrk.io

---

*This repository is published as a portfolio copy of the product source. It is shared for demonstration and review; all rights reserved. Sample learner personas used in the UI are illustrative, not testimonials.*
