import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Bound memory and upstream request size.
const ALLOWED_LANGS = new Set(["en", "zh-CN", "zh-TW", "ja", "ko", "fr", "de", "es", "pt", "it", "ru"]);

// Mainstream audio formats we accept for parsing
const ALLOWED_MIME: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/webm": "webm",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/amr": "amr",
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const requestedLang = form.get("lang");
    const lang = typeof requestedLang === "string" && ALLOWED_LANGS.has(requestedLang)
      ? requestedLang
      : "en";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({
        error: "Audio too large (max 4MB). Keep recordings under ~45 seconds.",
      }, { status: 413 });
    }

    const mime = file.type.toLowerCase();
    const format = ALLOWED_MIME[mime] || (file.name.split(".").pop()?.toLowerCase() || "");
    if (!["mp3", "wav", "m4a", "aac", "ogg", "webm", "flac", "amr"].includes(format)) {
      return NextResponse.json({
        error: `Unsupported audio format: ${mime || format}. Supported: mp3, wav, m4a, aac, ogg, webm, flac, amr.`,
      }, { status: 415 });
    }

    // Route to the configured speech-to-text service.
    // Falls back to a hosted provider if the primary service is unavailable.
    const env = getServerEnv();
    const whisperUrl = env.WHISPER_API_URL;
    const whisperToken = env.WHISPER_SERVICE_TOKEN;

    if (whisperUrl && whisperToken) {
      try {
        const buffer = await file.arrayBuffer();
        const fd = new FormData();
        fd.append("audio", new Blob([buffer], { type: file.type }), file.name || `audio.${format}`);
        fd.append("lang", lang);

        const resp = await fetch(`${whisperUrl.replace(/\/$/, "")}/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${whisperToken}` },
          body: fd,
          signal: AbortSignal.timeout(50_000),
        });

        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.transcript) {
          return NextResponse.json({ transcript: data.transcript, engine: "whisper", detectedLang: data.language || null });
        }
        if (resp.status === 413 || resp.status === 422) {
          return NextResponse.json({ error: data.error || "Transcription failed" }, { status: resp.status });
        }
        // fall through to OpenRouter on other errors
        console.warn("whisper service error:", resp.status, data.error);
      } catch (err) {
        console.warn("whisper service unavailable:", err);
      }
    }

    // Fallback: OpenRouter gpt-audio-mini
    const apiKey = env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json({ error: "Transcription service not configured" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-audio-mini",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: `Transcribe the audio. The speaker's language is ${lang}. Return ONLY the verbatim transcript with correct punctuation. Do not add comments, translations, or explanations.`,
            },
            {
              type: "input_audio",
              input_audio: { data: base64, format },
            },
          ],
        }],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("OpenRouter transcribe error:", response.status, errText.slice(0, 300));
      return NextResponse.json({ error: "Transcription failed. Try again." }, { status: 502 });
    }

    const data = await response.json();
    const transcript = data?.choices?.[0]?.message?.content?.trim();
    if (!transcript) {
      return NextResponse.json({ error: "No speech detected. Try speaking closer to the mic." }, { status: 422 });
    }

    return NextResponse.json({ transcript, engine: "openrouter" });
  } catch (err) {
    console.error("transcribe route error:", err);
    return NextResponse.json({ error: "Transcription error" }, { status: 500 });
  }
}
