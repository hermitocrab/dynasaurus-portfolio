"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import OnboardingModal from "@/components/OnboardingModal";
import UsageGuide from "@/components/UsageGuide";
import FeedbackModal from "@/components/FeedbackModal";
import AuthModal from "@/components/AuthModal";
import AdSlot from "@/components/AdSlot";
import { supabase } from "@/lib/supabase";
import {
  clearLocalHistory as clearAllHistory,
  findLocalHistoryEntry as getCachedEntry,
  mergeHistoryEntries,
  readLocalHistory as getHistory,
  replaceLocalHistory,
  saveLocalHistoryEntry as saveHistoryEntry,
  syncHistoryEntries,
  type HistoryEntry,
} from "@/lib/history";
import { translations, detectSystemLang, LANG_NAMES, getLangNameIn, getCEFRLabel, type UILanguage } from "@/lib/translations";
import { consumeChatStream } from "@/lib/sse";

// ─── Constants ────────────────────────────────────────────────────
const PROFILE_KEY = 'dynasaurus-profile';
const LICENSE_KEY = 'dynasaurus-license';
const DEVICE_ID_KEY = 'dynasaurus-device-id';
const USAGE_GUIDE_KEY = 'dynasaurus-usage-guide-dismissed';

// ─── Types ───────────────────────────────────────────────────────
interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

interface UserProfile {
  nickname: string;
  level: string;
  background: string;
  hobbies: string;
  goal: string;
  targetLang: string;
}

interface LicenseRecord {
  code: string;
  tier: string;
  isStudent: boolean;
  activatedAt: string;
}



// ─── History Helpers ──────────────────────────────────────────────
function escapeHTML(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadHistoryPDF() {
  if (typeof window === 'undefined') return;
  const hist = getHistory();
  if (hist.length === 0) return;
  const now = escapeHTML(new Date().toLocaleDateString('en-GB'));
  const rows = hist.map((h, i) => {
    const cleanContent = escapeHTML(h.content).replace(/\n/g, '<br>');
    const cleanWord = escapeHTML(h.word);
    const cleanTime = escapeHTML(h.time);
    return `
      <div class="entry">
        <div class="entry-header">
          <span class="entry-num">#${i + 1}</span>
          <span class="entry-word">${cleanWord}</span>
          <span class="entry-time">${cleanTime}</span>
        </div>
        <div class="entry-body">${cleanContent}</div>
      </div>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>DynaSaurus Lookup History — ${now}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1c; padding: 32px 24px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .date { color: #888; font-size: 11px; margin-bottom: 28px; }
    .entry { margin-bottom: 24px; border: 1px solid #e5e5e0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; }
    .entry-header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #f5f5f3; border-bottom: 1px solid #e5e5e0; }
    .entry-num { font-size: 10px; color: #999; min-width: 24px; }
    .entry-word { font-weight: 700; font-size: 15px; color: #1a1a1c; flex: 1; }
    .entry-time { font-size: 10px; color: #999; }
    .entry-body { padding: 14px 16px; font-size: 13px; color: #333; white-space: pre-wrap; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <h1>🦕 DynaSaurus Lookup History</h1>
  <p class="date">Exported ${now} · ${hist.length} entries</p>
  ${rows}
  <script>window.onload=()=>{setTimeout(()=>window.print(),200)}<\/script>
</body></html>`;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.opener = null;
    win.document.write(html);
    win.document.close();
  }
}

// ─── RUA Section Highlighting ─────────────────────────────────────
function preprocessRUA(content: string): string {
  return content
    .replace(/^##\s*1\.?\s*Recogni[sz]e/igm, '## 🅁 RECOGNIZE')
    .replace(/^##\s*2\.?\s*Understand/igm, '## 🅄 UNDERSTAND')
    .replace(/^##\s*3\.?\s*Apply/igm, '## 🅰 APPLY');
}

// ─── UI Translations ─────────────────────────────────────────────
// All 17 languages live in @/lib/translations.ts

// ─── Prompt Suggestions ──────────────────────────────────────────
function getSmartPrompts(lang: UILanguage, profile: UserProfile, history: HistoryEntry[]): string[] {
  const dict = translations[lang];
  const base = [dict.prompt1!, dict.prompt2!, dict.prompt3!, dict.prompt4!, dict.prompt5!, dict.prompt6!];
  
  // Inject context-aware prompts based on profile
  const smart: string[] = [];
  const isZh = lang.startsWith("zh");

  // Always expose the Module 5 entry point; profile details are read from the sidebar context.
  smart.push(dict.prompt7!);
  
  // Based on hobby
  if (profile.hobbies) {
    const hobby = profile.hobbies.split(/[,，、]/)[0].trim();
    if (hobby && hobby.length < 20) {
      smart.push(isZh ? `跟${hobby}有关的英语怎么说？` : `How do I talk about ${hobby}?`);
    }
  }
  
  // Based on goal
  if (profile.goal && profile.goal.toLowerCase().includes("ielts")) {
    smart.push(isZh ? "给我一个雅思口语话题" : "Give me an IELTS speaking topic");
  }
  
  // Based on recent lookups
  if (history.length > 0) {
    const last = history[0].word;
    smart.push(isZh ? `再解释一下"${last}"` : `Explain "${last}" again`);
  }
  
  // Pick 6 total: smart prompts first, then fill with base
  const result = [...smart, ...base].slice(0, 6);
  return result;
}

// ─── Prompt Suggestions ──────────────────────────────────────────

// ─── Markdown Components ─────────────────────────────────────────
const MarkdownComponents = {
  p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="answer-paragraph text-[var(--color-text-secondary)]" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-[var(--color-text-primary)]" {...props}>{children}</strong>
  ),
  em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <em className="italic text-[var(--color-accent)]" {...props}>{children}</em>
  ),
  code: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
    <code className="answer-inline-code text-[var(--color-accent-cool)] font-mono" {...props}>{children}</code>
  ),
  pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="answer-code-block overflow-x-auto" {...props}>{children}</pre>
  ),
  ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="answer-list answer-list--unordered" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="answer-list answer-list--ordered" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="answer-list-item text-[var(--color-text-secondary)]" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote className="answer-quote text-[var(--color-text-muted)]" {...props}>{children}</blockquote>
  ),
  h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="answer-title text-[var(--color-text-primary)]" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const text = String(children);
    const isR = text.includes('🅁 RECOGNIZE');
    const isU = text.includes('🅄 UNDERSTAND');
    const isA = text.includes('🅰 APPLY');
    const isRoot = text.toLowerCase().includes('root') || text.includes('词根');
    const isEtymology = text.toLowerCase().includes('etymolog') || text.includes('词源');
    const ruaClass = isR ? 'bg-blue-500/8 border-l-[3px] border-blue-400 text-blue-400' 
      : isU ? 'bg-purple-500/8 border-l-[3px] border-purple-400 text-purple-400'
      : isA ? 'bg-amber-500/8 border-l-[3px] border-amber-400 text-amber-400'
      : isRoot ? 'bg-[var(--color-accent)]/8 border-l-[3px] border-[var(--color-accent)] text-[var(--color-accent)]'
      : isEtymology ? 'bg-[var(--color-accent-warm)]/8 border-l-[3px] border-[var(--color-accent-warm)] text-[var(--color-accent-warm)]'
      : '';
    return (
      <h2 className={`answer-section-title ${ruaClass ? 'answer-section-title--featured' : ''} ${ruaClass} ${ruaClass ? 'px-3 py-2 rounded-r-lg' : 'text-[var(--color-text-primary)]'}`} {...props}>
        {children}
      </h2>
    );
  },
  h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const text = String(children).toLowerCase();
    const isRoot = text.includes('root') || text.includes('词根');
    const isEtymology = text.includes('etymology') || text.includes('词源');
    const featureClass = isRoot
      ? 'border-l-[3px] border-[var(--color-accent)] bg-[var(--color-accent)]/8 px-3 py-2 text-[var(--color-accent)] rounded-r-lg'
      : isEtymology
        ? 'border-l-[3px] border-[var(--color-accent-warm)] bg-[var(--color-accent-warm)]/8 px-3 py-2 text-[var(--color-accent-warm)] rounded-r-lg'
        : 'text-[var(--color-text-primary)]';
    return <h3 className={`answer-subsection-title ${featureClass}`} {...props}>{children}</h3>;
  },
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr className="answer-divider" {...props} />
  ),
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className="text-[var(--color-accent-cool)] underline underline-offset-[3px]" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  table: ({ children, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="answer-table-wrap">
      <table className="answer-table" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }: React.HTMLAttributes<HTMLTableHeaderCellElement>) => (
    <th className="answer-table-heading text-[var(--color-text-primary)]" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.HTMLAttributes<HTMLTableDataCellElement>) => (
    <td className="answer-table-cell text-[var(--color-text-secondary)]" {...props}>{children}</td>
  ),
};

const DEFAULT_PROFILE: UserProfile = {
  nickname: "",
  level: "B1",
  background: "",
  hobbies: "",
  goal: "",
  targetLang: "en",
};

function normalizeProfile(value: unknown): UserProfile {
  const raw = value && typeof value === 'object' ? value as Partial<UserProfile> : {};
  const levels = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
  const targetLang = typeof raw.targetLang === 'string' && raw.targetLang in LANG_NAMES
    ? raw.targetLang
    : DEFAULT_PROFILE.targetLang;
  const clean = (candidate: unknown, max: number) => typeof candidate === 'string'
    ? candidate.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max)
    : '';

  return {
    nickname: clean(raw.nickname, 80),
    level: typeof raw.level === 'string' && levels.has(raw.level) ? raw.level : DEFAULT_PROFILE.level,
    background: clean(raw.background, 400),
    hobbies: clean(raw.hobbies, 400),
    goal: clean(raw.goal, 400),
    targetLang,
  };
}

function loadProfile(): UserProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return normalizeProfile(JSON.parse(raw));
  }
  catch {}
  // cookie fallback — 允许 rkrk.io/notion 跨子域共享设置
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + PROFILE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    if (m && m[1]) return normalizeProfile(JSON.parse(decodeURIComponent(m[1])));
  } catch {}
  return DEFAULT_PROFILE;
}

function saveProfile(p: UserProfile) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeProfile(p);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized)); }
  catch { /* Keep the live form usable if storage is unavailable. */ }
  // 同步到 .rkrk.io 域 cookie — rkrk.io/notion 网页 chatbot 可读/可改
  try {
    document.cookie = PROFILE_KEY + '=' + encodeURIComponent(JSON.stringify(normalized)) + '; domain=.rkrk.io; path=/; max-age=31536000; SameSite=Lax; Secure';
  } catch {}
}

function normalizeLicense(value: unknown): LicenseRecord | null {
  const raw = value && typeof value === 'object' ? value as Partial<LicenseRecord> : {};
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
  const isActivationCode = /^DYNA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code);
  const isNoteKey = /^[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+$/.test(code);
  const isSharedKey = isNoteKey || /^[A-Z0-9]{4,128}$/.test(code);
  if (!isActivationCode && !isSharedKey) return null;
  return {
    code,
    tier: typeof raw.tier === 'string' && raw.tier.trim() ? raw.tier.trim() : 'basic',
    isStudent: raw.isStudent === true || (isNoteKey && raw.tier !== "Teacher"),
    activatedAt: typeof raw.activatedAt === 'string' && raw.activatedAt
      ? raw.activatedAt
      : new Date().toISOString(),
  };
}

function loadLicense(): LicenseRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LICENSE_KEY);
    if (raw) {
      const parsed = normalizeLicense(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {}
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + LICENSE_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
    if (m?.[1]) return normalizeLicense(JSON.parse(decodeURIComponent(m[1])));
  } catch {}
  return null;
}

function saveLicense(value: LicenseRecord) {
  if (typeof window === 'undefined') return;
  const normalized = normalizeLicense(value);
  if (!normalized) return;
  try { localStorage.setItem(LICENSE_KEY, JSON.stringify(normalized)); } catch {}
  try {
    document.cookie = LICENSE_KEY + '=' + encodeURIComponent(JSON.stringify(normalized)) + '; domain=.rkrk.io; path=/; max-age=31536000; SameSite=Lax; Secure';
  } catch {}
}

function loadDeviceId(): string {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(DEVICE_ID_KEY)?.trim();
  if (existing && existing.length <= 160) return existing;
  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  try { localStorage.setItem(DEVICE_ID_KEY, generated); } catch {}
  return generated;
}

// ─── Main Component ──────────────────────────────────────────────
export default function Home() {
  const [lang, setLang] = useState<UILanguage>("en");
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "system",
      content: (translations.en.welcomeTemplate || "Hey! 👋").replace("{name}", ""),
      timestamp: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputKind, setInputKind] = useState<"text" | "audio">("text");
  const [streamingContent, setStreamingContent] = useState<string>(""); // live SSE token accumulation
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Platform detection for Add-to-Home-Screen guide
  const isIOS = typeof navigator !== 'undefined'
    && /iPad|iPhone|iPod/.test(navigator.userAgent || '')
    && !(window as Window & { MSStream?: unknown }).MSStream;
  const isAndroid = typeof navigator !== 'undefined'
    && /Android/i.test(navigator.userAgent || '');
  const isStandalone = typeof window !== 'undefined'
    && (window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const [inputFocused, setInputFocused] = useState(true); // chips visible on first load
  const [historyPopup, setHistoryPopup] = useState<HistoryEntry | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUsageGuide, setShowUsageGuide] = useState(false);
  const [usageGuideReady, setUsageGuideReady] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showKeePopup, setShowKeePopup] = useState(false);
  const [showAddToHome, setShowAddToHome] = useState(false);
  const [lookupCount, setLookupCount] = useState(0);
  const [remainingLookups, setRemainingLookups] = useState<number | null>(null);
  const [deviceId] = useState(loadDeviceId);
  const [license, setLicense] = useState<LicenseRecord | null>(loadLicense);
  const [activationInput, setActivationInput] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [activationNotice, setActivationNotice] = useState('');
  const [showAuth, setShowAuth] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [childLock, setChildLock] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dynasaurus-child-lock') === 'true';
    }
    return false;
  });
  // Phase 2: file transcription (recording + live voice input removed 2026-08-18)
  const [transcribing, setTranscribing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== 'undefined') {
      return (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "dark";
    }
    return "dark";
  });
  const chatRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const d = translations[lang]; // current dictionary
  const welcomeTemplate = d.welcomeTemplate || d.welcome || "Hey {name}! 👋 Drop anything below.";

  // ─── File Transcription (Phase 2, upload only — recording + live voice removed 2026-08-18) ─
  const uploadForTranscription = useCallback(async (blob: Blob, filename: string) => {
    setTranscribing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('audio', blob, filename);
      fd.append('lang', profile.targetLang || lang || 'en');
      const resp = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.transcript) {
        throw new Error(data.error || 'Transcription failed');
      }
      setInput(data.transcript);
      setInputKind("audio");
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
          Math.max(56, Math.min(textareaRef.current.scrollHeight, 160)) + 'px';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  }, [lang, profile.targetLang]);

  const handleAudioFile = useCallback((file: File | null) => {
    if (!file) return;
    if (transcribing) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Audio too large (max 4MB). Keep recordings under ~45 seconds.');
      return;
    }
    void uploadForTranscription(file, file.name);
  }, [transcribing, uploadForTranscription]);

  // ─── Recording End (recording removed 2026-08-18; upload only) ────


  // ─── Voice Input End ─────────────────────────────────────────────

  // Update welcome message on lang change or nickname change
  useEffect(() => {
    const welcomeText = welcomeTemplate.replace("{name}", profile.nickname || "");
    setMessages((prev) => {
      if (prev.length >= 1 && prev[0].role === "system") {
        return [{ ...prev[0], content: welcomeText }, ...prev.slice(1)];
      }
      return prev;
    });
  }, [welcomeTemplate, profile.nickname]);

  // Follow new tokens only while the learner remains near the bottom. Scrolling
  // upward opts out so a long answer never steals their reading position.
  const followStreamRef = useRef(true);
  useEffect(() => {
    if (!followStreamRef.current || !chatRef.current) return;
    requestAnimationFrame(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    });
  }, [streamingContent, messages.length]);

  // Mobile detection + auto-collapse sidebar
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Check auth state + load cloud history
  useEffect(() => {
    let active = true;

    const loadCloudHistory = async (hasUser: boolean) => {
      if (!active) return;
      setAuthed(hasUser);
      setHistory(getHistory());

      if (!hasUser) {
        setSyncing(false);
        return;
      }

      setSyncing(true);
      setSyncError("");
      try {
        const response = await fetch('/api/history/load?limit=50');
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
        const merged = mergeHistoryEntries(cloud, getHistory());
        replaceLocalHistory(merged);
        if (active) setHistory(merged);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'History load failed.';
        if (active) setSyncError(message);
      } finally {
        if (active) setSyncing(false);
      }
    };

    void supabase.auth.getUser().then(({ data: { user }, error: authError }) => {
      // Not-logged-in is NORMAL — "Auth session missing" is not an error.
      // Only surface real sync failures; anonymous users just skip cloud sync silently.
      if (authError && active && authError.name !== 'AuthSessionMissingError') {
        setSyncError(authError.message);
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

  // Theme sync — read from DOM (inline script already set it from system/localStorage)
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme") as "light" | "dark" | null;
    const initial = attr || "dark";
    setTheme(initial);

    // Listen for system preference changes (only applies when user hasn't manually toggled)
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const manual = localStorage.getItem('dynasaurus-theme-manual');
      if (!manual) {
        const next = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        setTheme(next);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("dynasaurus-theme", next);
      localStorage.setItem("dynasaurus-theme-manual", "1");
      return next;
    });
  }, []);

  // Onboarding check — first visit only; introduce core actions afterwards.
  useEffect(() => {
    const onboarded = localStorage.getItem('dynasaurus-onboarded');
    const usageGuideSeen = localStorage.getItem(USAGE_GUIDE_KEY);
    if (!onboarded) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
        setUsageGuideReady(true);
      }, 800);
      return () => clearTimeout(timer);
    }
    if (!usageGuideSeen) {
      const timer = setTimeout(() => {
        setShowUsageGuide(true);
        setUsageGuideReady(true);
      }, 600);
      return () => clearTimeout(timer);
    }
    setUsageGuideReady(true);
  }, []);

  // L1 auto-detect on first visit
  useEffect(() => {
    const saved = localStorage.getItem('dynasaurus-l1-detected');
    if (!saved) {
      const detected = detectSystemLang();
      setLang(detected);
      if (detected !== 'en') {
        setProfile(p => ({ ...p, background: detected }));
      }
      localStorage.setItem('dynasaurus-l1-detected', 'true');
    } else {
    }
  }, []);

  // Onboarding completion handler
  const handleOnboardComplete = (data: { nickname: string; targetLang: string; level: string; background: string; hobbies: string; goal: string }) => {
    setShowOnboarding(false);
    setUsageGuideReady(true);
    if (!localStorage.getItem(USAGE_GUIDE_KEY)) setShowUsageGuide(true);
    if (data.nickname) updateProfile('nickname', data.nickname);
    if (data.targetLang) updateProfile('targetLang', data.targetLang);
    if (data.level) updateProfile('level', data.level);
    if (data.background) updateProfile('background', data.background);
    if (data.hobbies) updateProfile('hobbies', data.hobbies);
    if (data.goal) updateProfile('goal', data.goal);
  };

  // Live update profile during onboarding
  const handleOnboardUpdate = (patch: Partial<typeof profile>) => {
    setProfile(p => { const next = { ...p, ...patch }; saveProfile(next); return next; });
  };

  // Right-click context menu for phrase lookup
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const sel = window.getSelection()?.toString().trim();
      if (sel && sel.length > 0 && sel.length < 100) {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY, text: sel });
      } else {
        setCtxMenu(null);
      }
    };
    const dismiss = () => setCtxMenu(null);
    document.addEventListener('contextmenu', handler);
    document.addEventListener('click', dismiss);
    return () => {
      document.removeEventListener('contextmenu', handler);
      document.removeEventListener('click', dismiss);
    };
  }, []);

  // Lookup from context menu
  const lookupSelection = useCallback((text: string) => {
    setInput(text);
    setInputKind("text");
    setCtxMenu(null);
    setTimeout(() => {
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
          Math.max(56, Math.min(textareaRef.current.scrollHeight, 160)) + 'px';
      }
    }, 50);
  }, []);

  // History helpers
  const toggleHistory = useCallback(() => {
    setHistoryOpen(prev => { if (!prev) setHistory(getHistory()); return !prev; });
  }, []);
  const clearHistory = useCallback(() => {
    if (typeof window !== 'undefined' && confirm('Clear history on this device? Synced account history will remain available.')) {
      clearAllHistory();
      setHistory([]);
    }
  }, []);
  const replayHistory = useCallback((word: string) => {
    const cached = getCachedEntry(word);
    if (cached) {
      setHistoryPopup(cached);
      setHistoryOpen(false);
    }
  }, []);
  const speakWord = useCallback((text: string) => {
    const audio = new Audio(`https://rkrk.io/tts?word=${encodeURIComponent(text)}&voice=en-US-AriaNeural&rate=-15%`);
    audio.play().catch(() => {});
  }, []);

  const handleActivation = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = activationInput.trim();
    if (!code || activationLoading) return;

    setActivationLoading(true);
    setActivationError('');
    setActivationNotice('');
    try {
      const response = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deviceId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof result.error === 'string' ? result.error : 'Activation failed.');
      }

      const nextLicense = normalizeLicense({
        code,
        tier: result.tier,
        isStudent: result.isStudent === true,
        activatedAt: new Date().toISOString(),
      });
      if (!nextLicense) throw new Error('The activation response was invalid.');
      saveLicense(nextLicense);
      setLicense(nextLicense);
      setRemainingLookups(null);
      setActivationInput('');
      setActivationNotice(lang.startsWith('zh')
        ? `已激活：${nextLicense.isStudent ? 'Kee 学生免费' : nextLicense.tier} · 无限使用`
        : `Activated: ${nextLicense.isStudent ? 'Kee student' : nextLicense.tier} · unlimited access`);
    } catch (activationFailure) {
      setActivationError(activationFailure instanceof Error ? activationFailure.message : 'Activation failed.');
    } finally {
      setActivationLoading(false);
    }
  }, [activationInput, activationLoading, deviceId, lang]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      setInputKind("text");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height =
          Math.max(56, Math.min(textareaRef.current.scrollHeight, 160)) + "px";
      }
    },
    []
  );

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    const submittedKind = inputKind;

    setError(null);
    setLoading(true);
    setStreamingContent("");
    setInput("");
    setInputKind("text");
    followStreamRef.current = true;

    const userMsg: Message = {
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    
    // Scroll to bottom when user sends (the ONLY place we auto-scroll)
    requestAnimationFrame(() => {
      if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
    });

    try {
      // Build conversation history (last 12 messages, excluding welcome)
      const conversationHistory = messages
        .filter(m => m.role !== "system" || m.timestamp > messages[0].timestamp)
        .slice(-12)
        .map(m => ({
          role: m.role === "system" ? "assistant" : m.role,
          content: m.content,
        }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userContext: trimmed,
          profile: { ...profile, uiLang: lang },
          history: conversationHistory,
          childLock,
          inputKind: submittedKind,
          license: license?.code,
          deviceId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const detail = typeof payload.error === 'string' ? payload.error : 'Request failed';
        throw new Error(`${detail} (${res.status})`);
      }

      // Read rate limit header
      const rem = res.headers.get('X-RateLimit-Remaining');
      if (rem === 'unlimited') {
        setRemainingLookups(null);
      } else if (rem !== null) {
        const r = parseInt(rem);
        if (!Number.isNaN(r)) setRemainingLookups(r);
      }

      let fullContent = "";
      let finalized = false;
      const finalize = () => {
        if (finalized || !fullContent) return;
        finalized = true;
        const finalContent = preprocessRUA(fullContent);
        setMessages((prev) => [...prev, { role: "system", content: finalContent, timestamp: Date.now() }]);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const historyEntry = { word: trimmed, time: timeStr, ts: now.getTime(), content: fullContent };
        setHistory(saveHistoryEntry(historyEntry));
        if (authed) {
          void syncHistoryEntries([historyEntry]).catch((syncFailure) => {
            setSyncError(syncFailure instanceof Error ? syncFailure.message : 'History sync failed.');
          });
        }
        setLookupCount((prev) => {
          const next = prev + 1;
          if (next >= 5 && !sessionStorage.getItem('kee-popup-dismissed')) setShowKeePopup(true);
          return next;
        });
      };

      await consumeChatStream(res, (event) => {
        if (event.error) throw new Error(event.error);
        if (event.c) {
          fullContent += event.c;
          setStreamingContent(fullContent);
        }
        if (event.done) {
          finalize();
          return false;
        }
      });

      finalize();
      setStreamingContent("");
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => prev.filter((message) => message.timestamp !== userMsg.timestamp));
      setInput(trimmed);
      setInputKind(submittedKind);
      setError(`🦕 The answer was interrupted. Your text is back in the composer — try again. ${detail}`);
    } finally {
      setLoading(false);
      setStreamingContent("");
    }
  }, [input, inputKind, loading, profile, lang, messages, childLock, authed, license, deviceId]);

  // Enter to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Profile field updater
  const updateProfile = useCallback(
    (field: keyof UserProfile, value: string) => {
      setProfile((prev) => {
        const next = { ...prev, [field]: value };
        saveProfile(next);
        return next;
      });
    },
    []
  );

  // Prompt chip click
  const handlePromptClick = useCallback((prompt: string) => {
    setInput(prompt);
    setInputKind("text");
    setTimeout(() => {
      textareaRef.current?.focus();
      // Trigger resize
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height =
          Math.max(56, Math.min(textareaRef.current.scrollHeight, 160)) + "px";
      }
    }, 0);
  }, []);

  const dismissUsageGuide = useCallback(() => {
    try { localStorage.setItem(USAGE_GUIDE_KEY, 'true'); }
    catch { /* The guide still closes if storage is unavailable. */ }
    setShowUsageGuide(false);
  }, []);

  const openUsageGuide = useCallback(() => {
    setShowUsageGuide(true);
  }, []);

  const tryUsageGuidePrompt = useCallback((prompt: string) => {
    dismissUsageGuide();
    handlePromptClick(prompt);
  }, [dismissUsageGuide, handlePromptClick]);

  const prompts = getSmartPrompts(lang, profile, history);

  return (
    <div className="app-shell flex flex-col overflow-hidden bg-[var(--color-bg)]">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="app-header flex justify-between items-center shrink-0 z-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="header-icon-button md:hidden"
            aria-label={sidebarOpen ? "Close profile" : "Open profile"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <a href="https://rkrk.io" target="_blank" rel="noopener noreferrer" className="brand-mark">
            K
          </a>
          <div className="min-w-0">
            <h1 className="truncate text-base sm:text-lg font-bold tracking-tight text-[var(--color-text-primary)] leading-tight">
              {d.title}
            </h1>
            <p className="hidden sm:block text-[10px] text-[var(--color-text-muted)] font-mono tracking-wider uppercase">
              {d.subtitle}
            </p>
          </div>
          <nav aria-label="Product information" className="ml-3 hidden items-center gap-3 lg:flex">
            <a href="/intro" className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">
              How it works
            </a>
            <a href="/about" className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">
              About
            </a>
            <a href="/faq" className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">
              FAQ
            </a>
            <a href="/pricing" className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">
              Pricing
            </a>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="header-icon-button"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => setShowAuth(true)}
            className={`header-text-button ${
              authed
                ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text-primary)]'
            }`}
          >
            <span className="hidden min-[390px]:inline">{authed ? (d.signedIn || 'Signed in') : (d.signIn || 'Sign In')}</span>
            <span className="min-[390px]:hidden" aria-hidden="true">{authed ? '✓' : '↗'}</span>
          </button>
          <button
            onClick={toggleHistory}
            aria-label={`Lookup history${history.length ? `, ${history.length} items` : ''}`}
            className={`header-text-button ${
              historyOpen
                ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 text-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text-primary)]'
            }`}
          >
            🕐 <span className="hidden sm:inline">History</span>{history.length > 0 ? ` ${history.length}` : ''}
          </button>
        </div>
      </header>

      {/* ── Main Workspace ─────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden">
        {/* ── Mobile overlay ── */}
        {sidebarOpen && isMobile && (
          <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}
        {/* ── Sidebar ── */}
        <aside
          aria-label="Learning profile"
          aria-hidden={isMobile && !sidebarOpen}
          inert={isMobile && !sidebarOpen}
          className={`sidebar-panel
          ${isMobile
            ? `fixed top-0 left-0 h-full z-40 w-80 max-w-[88vw] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'w-80'}
        `}>
          {/* Learning profile */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-mono text-[var(--color-accent-warm)] mb-1 uppercase tracking-widest">
                {d.profile}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">{d.profileDesc}</p>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="header-icon-button md:hidden" aria-label={d.closeProfile}>✕</button>
          </div>

          <div className="space-y-3.5">
            {/* Nickname */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {d.nickname || "Nickname"}
              </label>
              <input
                type="text" id="field-nickname"
                value={profile.nickname}
                onChange={(e) => updateProfile("nickname", e.target.value)}
                placeholder={d.nicknamePlaceholder || "What should I call you?"}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all"
              />
            </div>

            {/* I want to learn... */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {(d.wantToLearn || "🎯 I want to learn…")}
              </label>
              <select
                id="field-targetlang"
                value={profile.targetLang}
                onChange={(e) => updateProfile('targetLang', e.target.value)}
                className="lang-select w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all cursor-pointer"
              >
                {Object.entries(LANG_NAMES).map(([code]) => (
                  <option key={code} value={code}>{getLangNameIn(code as UILanguage, lang)}</option>
                ))}
              </select>
            </div>

            {/* Level */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {profile.targetLang && profile.targetLang !== 'en'
                  ? (d.levelLabel ? d.levelLabel(getLangNameIn(profile.targetLang as UILanguage, lang)) : `📊 Current Level of ${getLangNameIn(profile.targetLang as UILanguage, lang)}`)
                  : d.level}
              </label>
              <select
                id="field-level"
                value={profile.level}
                onChange={(e) => updateProfile("level", e.target.value)}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all appearance-none lang-select"
              >
                {["A1","A2","B1","B2","C1","C2"].map((lvl) => {
                  const target = (profile.targetLang as UILanguage) || "en";
                  const label = getCEFRLabel(lvl, lang, target);
                  return <option key={lvl} value={lvl}>{lvl} — {label}</option>;
                })}
              </select>
            </div>

            {/* Language Background */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {d.background}
              </label>
              <textarea
                rows={2} id="field-background"
                value={profile.background}
                onChange={(e) => updateProfile("background", e.target.value)}
                placeholder={[d.backgroundPlaceholder, d.backgroundHint1, d.backgroundHint2].filter(Boolean).join('\n')}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all custom-scrollbar resize-none"
              />
            </div>

            {/* Hobbies */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {d.hobbies}
              </label>
              <textarea
                rows={2} id="field-hobbies"
                value={profile.hobbies}
                onChange={(e) => updateProfile("hobbies", e.target.value)}
                placeholder={d.hobbiesPlaceholder}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all custom-scrollbar resize-none"
              />
            </div>

            {/* Learning goal */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                {d.goal}
              </label>
              <textarea
                rows={2} id="field-goal"
                value={profile.goal}
                onChange={(e) => updateProfile("goal", e.target.value)}
                placeholder={d.goalPlaceholder}
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30 transition-all custom-scrollbar resize-none"
              />
            </div>
          </div>

          <p className="text-[10px] text-[var(--color-text-muted)] text-center">{d.changeAnytime}</p>

          {/* Settings: keep secondary actions out of the learning profile. */}
          <details className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-1.5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2.5 py-2 [&::-webkit-details-marker]:hidden hover:bg-[var(--color-panel)]">
              <div>
                <h3 className="text-[11px] font-semibold text-[var(--color-text-primary)]">{d.settings}</h3>
                <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">{d.settingsDesc}</p>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>

            <div className="space-y-3 border-t border-[var(--color-border)] px-1.5 pb-1.5 pt-3">
              {/* Interface language */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
                <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {d.language}
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as UILanguage)}
                  className="lang-select w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-warm)] focus:ring-1 focus:ring-[var(--color-accent-warm)]/30 transition-all cursor-pointer"
                >
                  {Object.entries(LANG_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>

              {/* One-time activation code */}
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3">
                <div className="mb-2">
                  <h4 className="text-[11px] font-semibold text-[var(--color-text-primary)]">🔑 {d.activationCode}</h4>
                  <p className="mt-1 text-[10px] leading-relaxed text-[var(--color-text-muted)]">{d.activationDesc}</p>
                </div>
                {license ? (
                  <div className="rounded-lg border border-[var(--color-accent-cool)]/30 bg-[var(--color-accent-cool)]/10 px-3 py-2.5 text-xs text-[var(--color-accent-cool)]">
                    <div className="font-semibold">✓ {d.activationActivated} · {license.isStudent ? d.activationStudent : license.tier}</div>
                    <div className="mt-1 text-[10px] opacity-80">{d.activationUnlimited}</div>
                  </div>
                ) : (
                  <form onSubmit={handleActivation} className="space-y-2">
                    <input
                      value={activationInput}
                      onChange={(event) => {
                        setActivationInput(event.target.value.toUpperCase());
                        setActivationError('');
                        setActivationNotice('');
                      }}
                      placeholder="DYNA-XXXX-XXXX-XXXX"
                      autoComplete="off"
                      spellCheck={false}
                      aria-label={d.activationInput}
                      className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono tracking-wide text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent-cool)] focus:ring-1 focus:ring-[var(--color-accent-cool)]/30 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={activationLoading || !activationInput.trim()}
                      className="w-full rounded-lg border border-[var(--color-accent-cool)]/35 bg-[var(--color-accent-cool)]/10 px-3 py-2 text-xs font-semibold text-[var(--color-accent-cool)] transition-colors hover:bg-[var(--color-accent-cool)]/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activationLoading ? d.activationChecking : d.activationSubmit}
                    </button>
                    {activationError && <p className="text-[10px] leading-relaxed text-red-400" role="alert">{activationError}</p>}
                    {activationNotice && <p className="text-[10px] leading-relaxed text-[var(--color-accent-cool)]" role="status">{activationNotice}</p>}
                  </form>
                )}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--color-text-muted)]">
                  <a href="https://wa.me/447555338741" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-accent-cool)]">💬 WhatsApp</a>
                  <span>💚 WeChat: keedahooman</span>
                </div>
              </div>

              {/* Child Lock */}
              <button
                onClick={() => {
                  const next = !childLock;
                  setChildLock(next);
                  localStorage.setItem('dynasaurus-child-lock', String(next));
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  childLock
                    ? 'bg-[var(--color-accent-warm)]/10 border border-[var(--color-accent-warm)]/30 text-[var(--color-accent-warm)]'
                    : 'bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]'
                }`}
              >
                <span className="text-base">{childLock ? '🔒' : '🔓'}</span>
                <div className="text-left flex-1">
                  <div className="text-[11px] font-medium">{d.childLock}</div>
                  <div className="text-[10px] opacity-60">{childLock ? d.childLockActive : d.childLockInactive}</div>
                </div>
                <div className={`w-8 h-5 rounded-full transition-colors flex items-center px-0.5 ${childLock ? 'bg-[var(--color-accent-warm)]' : 'bg-[var(--color-border)]'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${childLock ? 'translate-x-3' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Add to Home Screen */}
              <div>
                <button
                  onClick={() => {
                    const next = !showAddToHome;
                    setShowAddToHome(next);
                    localStorage.setItem('dynasaurus-add2home-seen', '1');
                  }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all bg-[var(--color-panel)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)]"
                >
                  <span className="text-base">🦕</span>
                  <div className="text-left flex-1">
                    <div className="text-[11px] font-medium">{d.title}</div>
                    <div className="text-[10px] opacity-60">{d.addToHome}</div>
                  </div>
                  <span className="text-xs opacity-60">{showAddToHome ? '▾' : '▸'}</span>
                </button>

                {showAddToHome && (
                  <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] leading-relaxed space-y-2">
                    {isStandalone ? (
                      <p className="text-[var(--color-accent)] font-medium">{d.addToHomeInstalled}</p>
                    ) : (
                      <>
                        <p className="text-[var(--color-text-muted)]">{d.addToHomeTip}</p>
                        <ol className="list-decimal list-inside space-y-1 text-[var(--color-text-secondary)]">
                          {isIOS ? <li>{d.addToHomeIos}</li> : isAndroid ? <li>{d.addToHomeAndroid}</li> : <li>{d.addToHomeOther}</li>}
                        </ol>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowFeedback(true)}
                className="w-full flex items-center gap-2 bg-[var(--color-panel)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-hover)] transition-all"
              >
                <span className="text-sm">🐛</span>
                <span className="text-[11px]">{d.reportProblem}</span>
              </button>
            </div>
          </details>

          {/* Free-tier ad slot — renders nothing unless ads are enabled and the
              viewer is on the free plan. On phones the sidebar is an off-canvas
              drawer, so the slot only mounts once the drawer is open. */}
          {(!isMobile || sidebarOpen) && <AdSlot placement="sidebar" />}
        </aside>

        {/* ── Chat Area ────────────────────────────────────── */}
        <section className="chat-stage flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div
            ref={chatRef}
            className="chat-scroll flex-1 min-h-0 p-3 sm:p-6 md:p-8 overflow-y-auto custom-scrollbar space-y-4"
            style={{ overflowAnchor: 'none' }}
            onScroll={(event) => {
              const element = event.currentTarget;
              followStreamRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={msg.timestamp + "-" + i}
                className={`flex gap-3 message-enter ${
                  msg.role === "user" ? "justify-end" : ""
                }`}
              >
                {msg.role === "system" && (
                  <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-warm)] flex items-center justify-center text-sm mt-0.5 shadow-sm">
                    🦕
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-3 text-sm md:max-w-2xl ${
                    msg.role === "user"
                      ? "user-message max-w-[calc(100%_-_3.5rem)] sm:max-w-[78%] text-[var(--color-text-primary)]"
                      : "assistant-message max-w-[calc(100%_-_2.5rem)] sm:max-w-[88%]"
                  }`}
                >
                  {msg.role === "system" ? (
                    <div className="assistant-answer markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="leading-relaxed">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <>
                  <button
                    onClick={() => speakWord(msg.content)}
                    className="message-action-button"
                    title="Pronounce"
                    aria-label="Pronounce"
                  >
                    🔊
                  </button>
                  <div className="hidden sm:flex w-7 h-7 shrink-0 rounded-full bg-[#2E2E33] items-center justify-center text-[var(--color-text-secondary)] font-mono text-[10px] mt-0.5">
                    U
                  </div>
                  </>
                )}
              </div>
            ))}

            {/* Explicit activation CTA after the server reaches the daily limit. */}
            {remainingLookups === 0 && !license && (
              <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[var(--color-accent-warm)]/30 bg-[var(--color-accent-warm)]/8 px-4 py-4 text-sm shadow-sm" role="status" aria-live="polite">
                <div className="font-semibold text-[var(--color-text-primary)]">
                  🔑 {lang.startsWith('zh') ? '今日次数已用完' : "You've used today's free lookups"}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                  {lang.startsWith('zh')
                    ? '联系 Kee 购买激活码解锁 unlimited；Kee 的学生可以免费领取。'
                    : 'Contact Kee to buy an activation code for unlimited access. Kee students can request a free code.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <a href="https://wa.me/447555338741" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-2 font-semibold text-white hover:bg-[#20bd5a]">💬 WhatsApp Kee</a>
                  <span className="text-[var(--color-text-muted)]">💚 WeChat: <span className="font-mono text-[var(--color-accent-cool)]">keedahooman</span></span>
                  <button type="button" onClick={() => { setSidebarOpen(true); setActivationError(''); }} className="text-[var(--color-accent-cool)] underline underline-offset-2 hover:opacity-80">
                    {lang.startsWith('zh') ? '输入激活码 →' : 'Enter a code →'}
                  </button>
                </div>
              </div>
            )}

            {/* Streaming response — live progressive render */}
            {loading && streamingContent && (
              <div className="flex gap-3 message-enter">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-warm)] flex items-center justify-center text-sm mt-0.5 shadow-sm">
                  🦕
                </div>
                <div className="assistant-message rounded-2xl px-4 py-3 text-sm max-w-[calc(100%_-_2.5rem)] sm:max-w-[88%] md:max-w-2xl" aria-live="polite" aria-busy="true">
                  <div className="assistant-answer markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                      {streamingContent}
                    </ReactMarkdown>
                    <span className="inline-block w-2 h-4 bg-[var(--color-accent)] animate-pulse ml-0.5 align-middle rounded-sm" />
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton — only before first token */}
            {loading && !streamingContent && (
              <div className="flex gap-3 message-enter" role="status" aria-label="DynaSaurus is thinking">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-warm)] flex items-center justify-center text-sm mt-0.5 shadow-sm">
                  🦕
                </div>
                <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl px-4 py-3">
                  <span className="inline-flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-bounce" />
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--color-accent-warm)] animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-[var(--color-accent-cool)] animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                  </span>
                </div>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="flex gap-3 message-enter" role="alert">
                <div className="w-7 h-7 shrink-0 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 font-mono text-[10px] mt-0.5">
                  !
                </div>
                <div className="flex items-start gap-3 bg-red-500/5 border border-red-500/15 rounded-2xl px-4 py-3 text-sm text-red-300/90">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError(null)} className="shrink-0 text-red-300/60 hover:text-red-200" aria-label="Dismiss error">✕</button>
                </div>
              </div>
            )}

            {/* Free-tier ad slot below the results — renders nothing unless ads
                are enabled and the viewer is on the free plan. */}
            <AdSlot placement="result" />
          </div>

          {usageGuideReady && !showOnboarding && (showUsageGuide ? (
            <UsageGuide lang={lang} onDismiss={dismissUsageGuide} onSelectPrompt={tryUsageGuidePrompt} />
          ) : (
            <div className="flex shrink-0 justify-end px-3 pb-1 sm:px-6 md:px-8">
              <button
                type="button"
                onClick={openUsageGuide}
                aria-controls="usage-guide"
                aria-expanded="false"
                aria-label={lang.startsWith("zh") ? "打开 DynaSaurus 使用指南" : "Open the DynaSaurus usage guide"}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[#a78bfa]/25 bg-[var(--color-panel)]/85 px-3.5 py-2 text-[11px] font-semibold text-[var(--color-guide-purple)] shadow-sm shadow-black/10 backdrop-blur-md transition-colors hover:border-[#a78bfa]/55 hover:bg-[#a78bfa]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-guide-purple)]"
              >
                <span aria-hidden="true">✨</span>
                <span>{lang.startsWith("zh") ? "指南" : "Guide"}</span>
              </button>
            </div>
          ))}

          {/* ═══════ Preference Nudge ═══════ */}
          {!showOnboarding && (() => {
            const onboarded = typeof window !== 'undefined' ? localStorage.getItem('dynasaurus-onboarded') : null;
            const raw = typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch { return {}; } })() : {};
            const isEmpty = !onboarded || (!raw.hobbies && !raw.goal && !raw.level);
            return isEmpty ? (
              <div className="flex justify-center px-6 pb-2 animate-in fade-in">
                <button
                  onClick={() => setShowOnboarding(true)}
                  className="flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors bg-[var(--color-panel)]/50 border border-[var(--color-border)] rounded-full px-4 py-1.5 backdrop-blur-sm"
                >
                  <span>🔧</span>
                  <span>Complete your setup for personalized results</span>
                  <span className="opacity-40">→</span>
                </button>
              </div>
            ) : null;
          })()}

          {/* ── Input Area ────────────────────────────────── */}
          <div className="composer-dock shrink-0 p-3 md:p-4 pt-4">
            <div className="max-w-2xl mx-auto">
              {/* iMessage Liquid Glass Input Pill + Remaining Counter */}
              <div className="composer-row flex items-center gap-2 sm:gap-3">
              <div className="input-pill-wrapper flex-1">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={d.inputPlaceholder}
                  disabled={loading || transcribing}
                  aria-label={d.inputPlaceholder}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                  className="input-pill-textarea custom-scrollbar"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || transcribing}
                  aria-label={transcribing ? "Transcribing audio" : "Upload audio file"}
                  title={transcribing ? "Transcribing…" : "Upload audio (mp3, wav, m4a, ogg, flac…)"}
                  className="input-pill-mic"
                >
                  {transcribing ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,.flac,.amr"
                  className="hidden"
                  onChange={(e) => { handleAudioFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
                <button
                  onClick={handleSubmit}
                  disabled={loading || transcribing || !input.trim()}
                  className="input-pill-send"
                  aria-label={d.execute}
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
              {/* Remaining lookups counter */}
              {remainingLookups !== null && !license && (
                <div className={`lookup-meter shrink-0 text-center rounded-xl text-xs font-semibold transition-all ${
                  remainingLookups <= 3
                    ? 'bg-red-500/10 border border-red-500/30 text-red-500'
                    : remainingLookups <= 7
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600'
                    : 'bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/10 text-[var(--color-accent)]'
                }`}>
                  <span className="lookup-meter-label opacity-60">剩余 </span>
                  <span className="text-sm sm:text-lg leading-none font-bold">{remainingLookups}</span>
                  <span className="text-[10px] opacity-50">/20</span>
                </div>
              )}
              </div>

              {transcribing && (
                <p className="mt-2 text-xs text-[var(--color-accent-cool)]" role="status" aria-live="polite">
                  Turning your audio into text…
                </p>
              )}

              {/* Smart prompt chips — horizontal scroll strip below input */}
              {inputFocused && (
                <div className="prompt-strip mt-2 prompt-chips-enter">
                  {prompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => handlePromptClick(prompt)}
                      className="prompt-chip-pill prompt-chip"
                    >
                      {i < 3 ? "💡 " : i < 5 ? "✨ " : "🎯 "}{prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ═══════ History Panel ═══════ */}
      {historyOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={toggleHistory} />
          <aside role="dialog" aria-modal="true" aria-label="Lookup history" className="history-panel fixed top-0 right-0 w-80 max-w-[88vw] h-full bg-[var(--color-panel)] border-l border-[var(--color-border)] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right">
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">🕐 Lookup History</h3>
              <button onClick={toggleHistory} className="header-icon-button" aria-label="Close history">✕</button>
            </div>
            {(syncing || syncError) && (
              <div
                role={syncError ? "alert" : "status"}
                className={`border-b border-[var(--color-border)] px-4 py-2 text-xs ${syncError ? 'text-red-400' : 'text-[var(--color-text-muted)]'}`}
              >
                {syncError ? `History sync: ${syncError}` : 'Syncing history…'}
              </div>
            )}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
              {history.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-xs text-center py-12">No lookups yet. Ask something!</p>
              ) : (
                history.map((h, i) => (
                  <button
                    key={h.ts + '-' + i}
                    onClick={() => replayHistory(h.word)}
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-surface)] transition-all border border-transparent hover:border-[var(--color-border)]"
                  >
                    <span className="text-[var(--color-accent)] text-sm">🔍</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-[var(--color-text-primary)] font-medium truncate">{h.word}</div>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{h.time}</span>
                  </button>
                ))
              )}
            </div>
            {history.length > 0 && (
              <div className="m-3 flex gap-2">
              <button
                onClick={downloadHistoryPDF}
                className="flex-1 p-2.5 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-all"
              >
                📥 Download PDF
              </button>
              <button
                onClick={clearHistory}
                className="flex-1 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-medium text-[var(--color-text-muted)] hover:text-red-400 hover:border-red-400/30 transition-all"
              >
                🗑 Clear device
              </button>
              </div>
            )}
          </aside>
        </>
      )}

      {/* ═══════ Context Menu ═══════ */}
      {ctxMenu && (
        <div
          className="fixed z-[999] bg-[var(--color-panel)] border border-[var(--color-border)] rounded-xl shadow-2xl py-1 min-w-[200px]"
          style={{ left: Math.min(ctxMenu.x, window.innerWidth - 210), top: Math.min(ctxMenu.y, window.innerHeight - 60) }}
        >
          <button
            onClick={() => lookupSelection(ctxMenu.text)}
            className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-all"
          >
            <span>🔍</span> Look up in DynaSaurus
          </button>
        </div>
      )}

      {/* ═══════ History Popup ═══════ */}
      {historyPopup && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4" onClick={() => setHistoryPopup(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cached lookup"
            className="relative bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)] shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">📖</span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{historyPopup.word}</h3>
                  <p className="text-[10px] text-[var(--color-text-muted)]">Cached lookup · {historyPopup.time}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryPopup(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-6 flex-1">
              <div className="assistant-answer markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                  {preprocessRUA(historyPopup.content)}
                </ReactMarkdown>
              </div>
            </div>
            <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between shrink-0">
              <span className="text-[10px] text-[var(--color-text-muted)]">⚡ Loaded from cache — zero tokens used</span>
              <button
                onClick={() => {
                  const content = historyPopup.content;
                  setHistoryPopup(null);
                  navigator.clipboard.writeText(content).then(() => {});
                }}
                className="text-[11px] px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/30 transition-all font-medium"
              >
                📋 Copy content
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ Onboarding Modal ═══════ */}
      {showOnboarding && (
        <OnboardingModal lang={lang} onComplete={handleOnboardComplete} onUpdate={handleOnboardUpdate} />
      )}

      {/* ═══════ Feedback ═══════ */}

      {showFeedback && (
        <FeedbackModal lang={lang} onClose={() => setShowFeedback(false)} />
      )}

      {/* ═══════ Kee Session Popup — triggers after 5+ lookups ═══════ */}
      {showKeePopup && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setShowKeePopup(false); sessionStorage.setItem('kee-popup-dismissed', '1'); }}>
          <div className="bg-[#111116] border border-[#1e1e28] rounded-2xl max-w-md w-full p-8 text-center shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="text-5xl mb-4">🦄</div>
            <h3 className="text-lg font-bold text-[#f0f0f3] mb-2">You’ve been putting in the work! 💪</h3>
            <p className="text-sm text-[#8a8a92] mb-6 leading-relaxed">
              You’ve looked up {lookupCount} phrases — that’s real momentum. Want to sit down with Kee for a free 15‑minute diagnostic? He’ll map out a study plan that fits YOUR goals, YOUR schedule, YOUR brain.
            </p>
            <div className="flex flex-col gap-3 mb-6">
              <a href="https://wa.me/447555338741" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 px-6 rounded-xl hover:bg-[#20bd5a] transition-colors text-sm">
                💬 WhatsApp Kee
              </a>
              <div className="text-xs text-[#6a6a78]">
                WeChat: <span className="text-[#a78bfa] font-mono">keedahooman</span>
              </div>
            </div>
            <button
              onClick={() => { setShowKeePopup(false); sessionStorage.setItem('kee-popup-dismissed', '1'); }}
              className="text-xs text-[#6a6a78] hover:text-[#a0a0b0] underline transition-colors"
            >
              Maybe later — keep studying
            </button>
          </div>
        </div>
      )}

      {/* ═══════ Auth Modal ═══════ */}
      {showAuth && (
        <AuthModal lang={lang} onClose={() => setShowAuth(false)} />
      )}
    </div>
  );
}
