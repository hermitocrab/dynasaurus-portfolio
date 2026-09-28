# Case study — Building DynaSaurus, a pedagogy-first AI language tutor

**Role:** Founder, product designer, prompt/pedagogy architect
**Product:** DynaSaurus (词灵龙) — https://dynasaurus.rkrk.io
**Category:** EdTech · AI tutoring · language learning
**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase · Stripe · LLM APIs · Whisper · PWA

---

## 1. The problem

Generic AI chat is a great demo and a poor tutor. Ask three learners the same question and they get the same wall of text — pitched at a level nobody chose, in a language register nobody uses, with examples about topics nobody cares about.

The result is the classic AI-learning failure mode: **fluent output, zero acquisition.** Learners read it, nod, and retain nothing, because nothing in the answer was aimed at *them*.

For an experienced teacher, the gap is obvious. A good teacher does three things an off-the-shelf model doesn't:

1. calibrates to the learner's **current level**,
2. explains through the learner's **first language**,
3. anchors examples in the learner's **interests**, so the new word has somewhere to live.

That's not a model problem. It's a **design** problem.

## 2. The approach

I built DynaSaurus around a single thesis: **encode teaching craft into the product layer, not the prompt of the moment.**

That produced four decisions that define the app.

### a) Personalisation as a structured contract
The client never sends a raw system prompt — a known safety and quality hazard. Instead, learner attributes (CEFR level, first language, interests) are validated and clamped server-side into an allowlisted profile before any model call. Personalisation becomes predictable, testable and safe, instead of a freeform string that drifts.

### b) The RUA method
Answers follow a fixed pedagogical loop:
- **Recognise** — meaning, form, pronunciation, a core metaphor.
- **Understand** — collocations, contexts, connotations, examples tied to the learner's interests.
- **Apply** — cross-linguistic mapping and level-appropriate practice.

This is the teacher's lesson shape, made repeatable by software.

### c) Native to 11 interface languages
The product treats multilingualism as a first-class feature, not a translation afterthought — so explanations can genuinely use the learner's L1 as a bridge.

### d) Make it a real product, not a notebook
Auth, entitlements, subscriptions, streaming, rate limiting and a health endpoint were built in from the start, because the point was a usable product with real learners — not a prototype.

## 3. What was built

| Area | Implementation |
| --- | --- |
| Learner experience | Smart dictionary, translation, grammar feedback, IELTS speaking practice |
| Personalisation | Server-validated profile (CEFR × first language × interests) |
| Interface | 11 languages; light/dark; installable PWA |
| Auth | Supabase email/password with email verification and password reset |
| Monetisation | Stripe subscription tiers + a free daily allowance; signed, idempotent webhooks |
| AI | Provider-routed LLM calls with SSE streaming |
| Speech | Audio transcription for pronunciation and upload flows |
| Trust & safety | Allowlisted CORS, no-store app/API caching, bounded rate limiting, entitlement checks |

## 4. Hard problems solved

- **Streaming that doesn't lie.** Early client/server code assumed a network chunk equals a line. Rebuilt around buffered SSE framing with a single close path so responses never truncate or double-close.
- **Payments that can't be farmed.** Webhook signatures verified, callbacks made idempotent, amounts checked — repeated callbacks never re-grant entitlements.
- **Prompt injection by design.** Replacing freeform prompts with a validated profile contract removed an entire class of abuse and made output quality deterministic.
- **Cache correctness.** Explicit no-store headers on app and API routes, and a deploy gate that rejects stale HTML caching.

## 5. Outcome

- A **live, public product** used by real learners at dynasaurus.rkrk.io.
- A working **monetisation path**, not just a demo.
- A reusable **pedagogy engine** (RUA + profile contract) that can be pointed at any target language or exam.

## 6. What I learned

1. **The hardest part of AI EdTech isn't the model — it's encoding pedagogy as a contract.** Once the teaching method is data, quality stops being luck.
2. **Personalisation and safety are the same problem.** Constraining what the client can send made answers both safer and better.
3. **Ship the boring parts.** Auth, payments, entitlements and caching are what separate "an AI demo" from "a product people pay for".

## 7. What's next

- Deeper speaking practice (live voice, structured feedback).
- Learning analytics: turning usage into measured progress.
- Extending the pedagogy engine to more exams and more languages.

---

*Written by Kee Lee. This case study accompanies the DynaSaurus source, published as a portfolio copy for demonstration and review.*
