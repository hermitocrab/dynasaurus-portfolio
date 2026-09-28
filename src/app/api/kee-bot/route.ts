import { NextRequest, NextResponse } from "next/server";
import { getServerEnv, type ServerEnv } from "@/lib/env";

// ─── Multi-Provider AI Router ───────────────────────────────────
// Auto-detects available API keys and routes to the best provider.

interface Provider {
  name: string;
  url: string;
  key: string | undefined;
  defaultModel: string;
}

function getAvailableProviders(env: ServerEnv): Provider[] {
  return [
    {
      name: "deepseek",
      url: "https://api.deepseek.com/v1/chat/completions",
      key: env.DEEPSEEK_API_KEY,
      defaultModel: "deepseek-chat",
    },
    {
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: env.OPENROUTER_API_KEY,
      defaultModel: "deepseek/deepseek-chat",
    },
  ];
}

function getProvider(env: ServerEnv, requestedModel?: string): Provider | null {
  const providers = getAvailableProviders(env);
  if (providers.length === 0) return null;
  
  // If a specific model is requested, find the right provider
  if (requestedModel) {
    // OpenRouter can handle any model prefix
    const orProvider = providers.find(p => p.name === "openrouter");
    if (orProvider && (requestedModel.includes("/") || requestedModel.startsWith("claude") || requestedModel.startsWith("gpt"))) {
      return orProvider;
    }
    // Direct provider match
    const direct = providers.find(p => requestedModel.startsWith(p.name));
    if (direct) return direct;
    // Fall back to first available
  }
  
  return providers[0];
}

const KEE_SYSTEM_PROMPT = `You are Kee's AI assistant on rkrk.io — you embody his warmth, intellect, and sharpness. Answer questions naturally, intrigue visitors with Kee's vision, and when the moment feels right, gently guide them toward connecting with Kee directly.

CONTENT SAFETY:
If a query involves politics, adult content, hate speech, or substance abuse, respond with: "I'm Kee's assistant — I can help you learn about his teaching, book a demo, or try DynaSaurus. What would you like to explore?" Do not engage further.

══════════════════════════════════════
ABOUT KEE LI — The Architect
══════════════════════════════════════
Kee Li is an AI-native education architect. He dismantles English and rebuilds it as architecture. Every student is a site. Every lesson is a blueprint.

- IELTS: Listening 9.0 | Reading 8.5 | Speaking 8.5
- Former EF Expert Teacher + Trainer of Trainers for West China
- TEDx 2026 speaker — "Learning Is Now Design"
- Interpreter for the Backstreet Boys 2012 Chengdu tour — 20,000 people, live mic
- Based in Chengdu, China 🇨🇳
- Built his AI toolchain with two AI agents: 002 🦄 and 003 🐺

══════════════════════════════════════
FUN FACTS — Drop naturally when relevant
══════════════════════════════════════
- Kee interpreted for a global pop band in front of 20K people. That's where he learned language is about RESONANCE, not rules.
- He trained the trainers. Same problem everywhere: content without architecture.
- He believes AI won't replace teachers — but teachers who use AI will replace those who don't.
- Students call his method "the Nano Banana" — small input, massive cognitive yield.

══════════════════════════════════════
DYNAMOS — The Cognitive OS
══════════════════════════════════════
DynamOS is Kee's platform — a "Roblox Studio for education." Educators build, share, and monetize AI learning tools with zero code. Built on the RUA cognitive framework (Recognize → Understand → Apply).

══════════════════════════════════════
DYNASAURUS 🦕 — The First DynApp
══════════════════════════════════════
DynaSaurus is an AI dictionary that teaches CHUNKS, not isolated words. 4 modules: Dictionary, Smart Translator (17 languages), Grammar Doctor, IELTS Coach Kee. Live at dynasaurus.rkrk.io. Free tier available.

══════════════════════════════════════
KEE'S COACHING
══════════════════════════════════════
Kee offers 1-on-1 coaching: IELTS (all 4 skills), TOEFL, LanguageCert, AI-native education consulting. Free LangCert prep at rkrk.io/langcert.

══════════════════════════════════════
SUBTLE GUIDANCE RULES
══════════════════════════════════════

1. ANSWER FIRST, NUDGE SECOND. Always be genuinely helpful before suggesting anything.

2. WHEN TO MENTION CONTACT (only in natural contexts):
   - Someone asks about coaching, tutoring, or demo classes → "Kee offers free 15-minute diagnostic sessions. You can reach him on WeChat: keedahooman or WhatsApp: +447555338741."
   - A complex question beyond your scope → "That's a great question — Kee could break this down properly. His WeChat is keedahooman."
   - Someone struggles after 2+ exchanges → "This is exactly the kind of thing Kee covers in coaching. His WeChat is keedahooman if you want a deeper walkthrough."

3. WHEN TO MENTION DYNASAURUS:
   - Vocabulary or dictionary questions → "DynaSaurus at dynasaurus.rkrk.io explains this through YOUR hobbies. Free to try."
   - Grammar struggles → "DynaSaurus has a Grammar Doctor that diagnoses your specific patterns. Check it out at dynasaurus.rkrk.io."

4. DO NOT:
   - Mention contact info in your first response to a new question
   - Repeat contact info if already shared in this conversation
   - Force a nudge when it doesn't fit
   - Sound salesy. Be a helpful assistant who happens to know Kee is available.

5. TONE: Warm, conversational, slightly playful. Concise (80-150 words). Never corporate. End with a question ~40% of the time.\n\n6. FORMAT: Use Markdown. Bold key concepts, bullet points for lists, keep it clean. No headings or horizontal rules.

CRITICAL: Be genuinely helpful first. Let the conversation naturally reveal when someone needs Kee. You're an assistant, not a sales rep.`;

const KEE_ALLOWED_ORIGINS = new Set(["https://rkrk.io", "https://www.rkrk.io", "https://dynasaurus.rkrk.io"]);
const KEE_LANGS = new Set(["en", "zh-CN", "zh-TW", "ja", "ko", "fr", "de", "es", "pt", "it", "ru"]);
const KEE_MODELS = new Set(["deepseek-chat", "deepseek-reasoner", "deepseek/deepseek-chat"]);

function corsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  return {
    ...(origin && KEE_ALLOWED_ORIGINS.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && !KEE_ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers: corsHeaders(request) });
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: NextRequest) {
  // CORS headers
  const headers = corsHeaders(request);
  const origin = request.headers.get("origin");
  if (origin && !KEE_ALLOWED_ORIGINS.has(origin)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers });
  }

  // Capture metadata
  const clientIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const body = await request.json();
    const { message, model: requestedModel } = body;
    const lang = typeof body.lang === "string" && KEE_LANGS.has(body.lang) ? body.lang : "en";
    const clientPage = typeof body.page === "string" ? body.page.slice(0, 500) : "unknown";
    const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 160) : "anon";

    if (!message || typeof message !== "string" || message.length > 4_000) {
      return NextResponse.json({ error: "Missing message" }, { status: 400, headers });
    }

    // ── Save user message to Supabase (fire-and-forget) ──
    const env = getServerEnv();
    const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/keebot_messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          content: message,
          role: "user",
          session_id: sessionId,
          page: clientPage,
          ip_address: clientIp.slice(0, 64),
        }),
      }).catch(e => console.error("[KEE-BOT] Supabase save error:", e));
    }

    const safeRequestedModel = typeof requestedModel === "string" && KEE_MODELS.has(requestedModel)
      ? requestedModel
      : undefined;
    const provider = getProvider(env, safeRequestedModel);
    if (!provider) {
      return NextResponse.json({ error: "No AI provider configured." }, { status: 500, headers });
    }

    const modelName = safeRequestedModel || provider.defaultModel;
    
    console.log(`[KEE-BOT] Using ${provider.name}/${modelName} | Lang: ${lang || 'en'}`);

    const response = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
        ...(provider.name === "openrouter" ? { "HTTP-Referer": "https://rkrk.io", "X-Title": "Kee's AI Assistant" } : {}),
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: KEE_SYSTEM_PROMPT + "\\n\\nOUTPUT LANGUAGE (MANDATORY): The user's system language is: " + (lang || "en") + ". You MUST respond in this language. If it's Chinese (zh-CN/zh-TW/zh), respond in Chinese. If it's Korean (ko), respond in Korean. Match the user's language EXACTLY. All your knowledge about Kee remains the same — just output it in the user's language." },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`${provider.name} error:`, response.status, err);
      return NextResponse.json({ error: "AI service unavailable" }, { status: 502, headers });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";

    // ── Save assistant reply to Supabase (fire-and-forget) ──
    if (SUPABASE_URL && SUPABASE_KEY) {
      fetch(`${SUPABASE_URL}/rest/v1/keebot_messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          content: reply,
          role: "assistant",
          session_id: sessionId,
          page: clientPage,
          ip_address: clientIp.slice(0, 64),
        }),
      }).catch(e => console.error("[KEE-BOT] Supabase reply save error:", e));
    }

    console.log(`[KEE-BOT] ${new Date().toISOString()} | Lang: ${lang} | provider: ${provider.name} | completed`);

    return NextResponse.json({ reply }, { headers });

  } catch (e) {
    console.error("Kee bot error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers });
  }
}
