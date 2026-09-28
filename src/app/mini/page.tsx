"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/lib/supabase";
import {
  mergeHistoryEntries,
  readLocalHistory,
  replaceLocalHistory,
  saveLocalHistoryEntry,
  syncHistoryEntries,
  type HistoryEntry,
} from "@/lib/history";
import { consumeChatStream } from "@/lib/sse";

// ─── Constants ────────────────────────────────────────────────────
const PROFILE_KEY = "minisaurus-profile";
const ONBOARDED_KEY = "minisaurus-onboarded";

interface Profile {
  name: string;
  profession: string;
  level: string;
  background: string;
  targetLang: string;
}

type Step = { key: keyof Profile; q: string; hint: string; type: "text" | "select" };
const STEPS: Step[] = [
  { key: "name", q: "What should I call you?", hint: "Your name or a nickname.", type: "text" },
  { key: "profession", q: "What do you do?", hint: "Sculptor, doctor, designer, executive — this shapes every definition you see.", type: "text" },
  { key: "targetLang", q: "What are you learning?", hint: "Your target language.", type: "select" },
  { key: "level", q: "Where are you at with it?", hint: "Your current proficiency.", type: "select" },
  { key: "background", q: "Your first language.", hint: "Default is your system language. Change it if needed.", type: "text" },
];

const LANGUAGES = [
  { v: "en", l: "English" }, { v: "zh-CN", l: "简体中文" }, { v: "zh-TW", l: "繁體中文" },
  { v: "ja", l: "日本語" }, { v: "ko", l: "한국어" }, { v: "fr", l: "Français" },
  { v: "de", l: "Deutsch" }, { v: "es", l: "Español" }, { v: "pt", l: "Português" },
  { v: "it", l: "Italiano" }, { v: "ru", l: "Русский" },
];

const LEVELS = ["A1 - Beginner", "A2 - Elementary", "B1 - Intermediate", "B2 - Upper-Intermediate", "C1 - Advanced", "C2 - Proficient"];

function getSystemLanguageCode(): string {
  const raw = (navigator.language || "en").toLowerCase();
  if (raw === "zh-tw" || raw === "zh-hk" || raw === "zh-hant") return "zh-TW";
  if (raw === "zh" || raw.startsWith("zh-")) return "zh-CN";
  const prefix = raw.split("-")[0];
  return LANGUAGES.some((language) => language.v === prefix) ? prefix : "en";
}

export default function MiniPage() {
  const [profile, setProfile] = useState<Profile>({ name: "", profession: "", level: "B1", background: "", targetLang: "en" });

  // Load profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<Profile>;
        setProfile((current) => ({ ...current, ...parsed }));
      } catch {
        localStorage.removeItem(PROFILE_KEY);
      }
    } else {
      // Default background to system language
      const sysLang = getSystemLanguageCode();
      setProfile(p => ({ ...p, background: sysLang }));
    }
  }, []);
  const [onboardStep, setOnboardStep] = useState(-1); // default to no onboarding (will check in useEffect)
  const [onboardChecked, setOnboardChecked] = useState(false);

  useEffect(() => {
    if (!onboardChecked) {
      const done = localStorage.getItem(ONBOARDED_KEY);
      setOnboardStep(done ? -1 : 0);
      setOnboardChecked(true);
    }
  }, [onboardChecked]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");   // accumulating stream text
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [authed, setAuthed] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }, [profile]);

  useEffect(() => {
    let active = true;
    setHistory(readLocalHistory());

    const loadCloudHistory = async (hasUser: boolean) => {
      if (!active) return;
      setAuthed(hasUser);
      if (!hasUser) return;

      try {
        const response = await fetch('/api/history/load?limit=20');
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(typeof result.error === 'string' ? result.error : 'History load failed.');
        }

        const rows: unknown[] = Array.isArray(result.entries) ? result.entries : [];
        const cloud: HistoryEntry[] = rows
          .filter((entry): entry is { word: string; response?: string; created_at: string } => {
            if (!entry || typeof entry !== 'object') return false;
            const candidate = entry as { word?: unknown; created_at?: unknown };
            return typeof candidate.word === 'string' && typeof candidate.created_at === 'string';
          })
          .map((entry) => {
            const ts = new Date(entry.created_at).getTime();
            return {
              word: entry.word,
              content: typeof entry.response === 'string' ? entry.response : '',
              ts,
              time: new Date(ts).toLocaleString(),
            };
          });
        const merged = mergeHistoryEntries(cloud, readLocalHistory());
        replaceLocalHistory(merged);
        if (active) setHistory(merged);
      } catch (loadError) {
        if (active) {
          setSyncError(loadError instanceof Error ? loadError.message : 'History load failed.');
        }
      }
    };

    void supabase.auth.getUser().then(({ data: { user }, error }) => {
      // Not-logged-in is NORMAL for minisaurus — "Auth session missing" is not an error.
      // Only surface real sync failures; anonymous users just skip cloud sync silently.
      if (error && active && error.name !== 'AuthSessionMissingError') {
        setSyncError(error.message);
      }
      void loadCloudHistory(Boolean(user));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadCloudHistory(Boolean(session?.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Theme sync
  useEffect(() => {
    const t = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    if (t) setTheme(t);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("dynasaurus-theme", next);
      return next;
    });
  };

  const advanceOnboard = () => {
    if (onboardStep < STEPS.length - 1) setOnboardStep(onboardStep + 1);
    else { localStorage.setItem(ONBOARDED_KEY, "true"); setOnboardStep(-1); }
  };

  const updateOnboard = (val: string) => {
    setProfile(p => ({ ...p, [STEPS[onboardStep].key]: val }));
  };

  const recordHistory = (word: string, content: string) => {
    const now = new Date();
    const entry: HistoryEntry = {
      word,
      content,
      ts: now.getTime(),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setHistory(saveLocalHistoryEntry(entry));
    if (authed) {
      void syncHistoryEntries([entry]).catch((syncFailure) => {
        setSyncError(syncFailure instanceof Error ? syncFailure.message : 'History sync failed.');
      });
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setOutput(null);
    setStreamBuffer("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext: input.trim(),
          mode: "mini",
          profile: {
            nickname: profile.name,
            profession: profile.profession,
            level: profile.level,
            background: profile.background,
            targetLang: profile.targetLang,
            uiLang: profile.background,
          },
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed (${res.status})`);
      }

      let fullContent = "";
      let finalized = false;
      const finalize = () => {
        if (finalized) return;
        finalized = true;
        setOutput(fullContent || "No response.");
        if (fullContent) recordHistory(input.trim(), fullContent);
      };

      await consumeChatStream(res, (event) => {
        if (event.error) throw new Error(event.error);
        if (event.c) {
          fullContent += event.c;
          setStreamBuffer(fullContent);
        }
        if (event.done) {
          finalize();
          return false;
        }
      });

      // If stream ended without done event
      finalize();
    } catch { setOutput("🦕 Even miniSaurus needs a nap sometimes. Give it a tap and try again?"); }
    setLoading(false);
  };

  const s = profile;

  // Onboarding modal
  if (onboardStep >= 0) {
    const cur = STEPS[onboardStep];
    const val = s[cur.key];
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🥚</div>
            <h1 className="text-2xl font-black tracking-tight text-black">miniSaurus</h1>
          </div>

          {/* Progress — bigger click targets */}
          <div className="flex gap-2 mb-8">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setOnboardStep(i)}
                className={`h-2 flex-1 transition-colors cursor-pointer ${
                  i <= onboardStep ? "bg-black hover:bg-gray-800" : "bg-gray-200 hover:bg-gray-300"
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <h2 className="text-lg font-bold text-black mb-1">{cur.q}</h2>
          <p className="text-gray-400 text-xs mb-6">{cur.hint}</p>

          {cur.type === "select" ? (
            <select value={val as string} onChange={e => updateOnboard(e.target.value)}
              className="w-full border-2 border-gray-200 focus:border-black rounded-none px-4 py-3.5 text-base text-black outline-none bg-white appearance-none">
              {cur.key === "targetLang"
                ? LANGUAGES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)
                : LEVELS.map((l, i) => <option key={i} value={l.split(" - ")[0]}>{l}</option>)}
            </select>
          ) : (
            <input type="text" autoFocus value={val as string} onChange={e => updateOnboard(e.target.value)}
              placeholder="Type here…"
              className="w-full border-2 border-gray-200 focus:border-black rounded-none px-4 py-3.5 text-base text-black placeholder:text-gray-300 outline-none bg-white" />
          )}

          <div className="flex gap-4 mt-8">
            <button onClick={() => { localStorage.setItem(ONBOARDED_KEY, "true"); setOnboardStep(-1); }}
              className="flex-1 py-3 text-sm text-gray-400 hover:text-black transition-colors">Skip</button>
            <button
              type="button"
              onClick={advanceOnboard}
              className="flex-1 py-3 bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors"
            >
              {onboardStep < STEPS.length - 1 ? "Next →" : "🥚 Begin"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mini-page min-h-screen font-sans antialiased">
      {/* Header */}
      <header className="mini-border border-b px-8 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl mini-text-primary">🥚</span>
          <h1 className="text-sm font-bold tracking-widest uppercase mini-text-primary">miniSaurus</h1>
        </div>
        <div className="flex items-center gap-4 text-xs mini-text-muted">
          <button
            onClick={toggleTheme}
            className="w-7 h-7 rounded flex items-center justify-center text-sm mini-text-secondary hover:mini-text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button onClick={() => { localStorage.removeItem(ONBOARDED_KEY); setOnboardStep(0); }}>Setup</button>
          <span>{s.name || "User"}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-8 py-16">
        {/* Profile summary */}
        <div className="mb-16 space-y-1 text-sm">
          <p className="font-bold mini-text-primary">{s.name || "User"} · {s.profession || "Generalist"}</p>
          <p className="mini-text-muted">{LANGUAGES.find(l => l.v === s.targetLang)?.l || "English"} · {s.level} · First: {s.background || "—"}</p>
        </div>

        {/* Input — iMessage Liquid Glass Pill */}
        <div className="mb-12">
          <div className="input-pill-wrapper mini-input-pill max-w-lg">
            <textarea
              ref={textRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Type a word, phrase, or question…"
              disabled={loading}
              className="input-pill-textarea"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="input-pill-send"
              aria-label="Look Up"
            >
              {loading ? (
                <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 rounded-full bg-white/70 animate-bounce" />
                  <span className="w-1 h-1 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <span className="w-1 h-1 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0.2s' }} />
                </span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Streaming output — live progressive render */}
        {(loading && streamBuffer) && (
          <div className="mini-border border-t pt-12">
            <div className="mini-prose prose prose-sm max-w-none
              [&_h1]:text-xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:mt-8 [&_h1]:mb-4
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:leading-relaxed [&_p]:mb-4
              [&_strong]:font-bold
              [&_em]:italic
              [&_blockquote]:border-l-2 [&_blockquote]:pl-6 [&_blockquote]:my-6
              [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
              [&_pre]:p-6 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:my-6
              [&_ul]:list-none [&_ul]:pl-0 [&_ul]:space-y-2 [&_ul]:my-4
              [&_li]:before:content-['—'] [&_li]:before:mr-2
              [&_hr]:my-8
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamBuffer}</ReactMarkdown>
              {/* Streaming cursor */}
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-0.5 align-middle" />
            </div>
          </div>
        )}

        {/* Loading skeleton — only show before first chunk arrives */}
        {loading && !streamBuffer && (
          <div className="animate-pulse space-y-3">
            <div className="h-4 mini-bg-surface w-1/3" />
            <div className="h-3 mini-bg-surface w-2/3" />
            <div className="h-3 mini-bg-surface w-1/2" />
          </div>
        )}

        {/* Output */}
        {output && !loading && (
          <div className="mini-border border-t pt-12">
            <div className="mini-prose prose prose-sm max-w-none
              [&_h1]:text-xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1]:mt-8 [&_h1]:mb-4
              [&_h2]:text-base [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-8 [&_h2]:mb-3
              [&_h3]:text-xs [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:mt-6 [&_h3]:mb-2
              [&_p]:leading-relaxed [&_p]:mb-4
              [&_strong]:font-bold
              [&_em]:italic
              [&_blockquote]:border-l-2 [&_blockquote]:pl-6 [&_blockquote]:my-6
              [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono
              [&_pre]:p-6 [&_pre]:text-xs [&_pre]:overflow-x-auto [&_pre]:my-6
              [&_ul]:list-none [&_ul]:pl-0 [&_ul]:space-y-2 [&_ul]:my-4
              [&_li]:before:content-['—'] [&_li]:before:mr-2
              [&_hr]:my-8
            ">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            </div>
          </div>
        )}

        {syncError && <p role="alert" className="mt-8 text-xs text-red-500">History sync: {syncError}</p>}

        {/* History */}
        {history.length > 0 && (
          <div className="mini-border border-t mt-16 pt-12">
            <h3 className="text-xs font-bold uppercase tracking-widest mini-text-muted mb-6">Recent</h3>
            <div className="space-y-1">
              {history.slice(0, 8).map((h, i) => (
                <button
                  key={`${h.ts}-${i}`}
                  onClick={() => { setInput(h.word); setOutput(h.content); }}
                  className="block w-full text-left text-sm mini-text-muted hover:mini-text-primary transition-colors py-1"
                >
                  {h.word}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mini-border border-t px-8 py-8 text-center">
        <p className="text-xs mini-text-muted">
          miniSaurus · Minimalist Dictionary · By <a href="https://rkrk.io" className="mini-text-secondary hover:mini-text-primary">Kee Lee</a>
        </p>
        <p className="mt-2 text-xs">
          <a href="https://dynasaurus.rkrk.io" className="mini-text-secondary hover:mini-text-primary underline underline-offset-2">🦕 DynaSaurus — 完整版 AI 语言导师 / Full AI Language Tutor</a>
        </p>
        <nav aria-label="miniSaurus information" className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs mini-text-muted">
          <a href="/about" className="hover:mini-text-primary">About</a>
          <a href="/method/rua" className="hover:mini-text-primary">RUA method</a>
          <a href="/faq" className="hover:mini-text-primary">FAQ</a>
          <a href="/privacy" className="hover:mini-text-primary">Privacy</a>
        </nav>
      </footer>
    </div>
  );
}
