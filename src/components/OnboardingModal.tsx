"use client";

import { useState, useEffect } from "react";
import { LANG_NAMES, getLangNameIn, getCEFRLabel } from "@/lib/translations";

const ONBOARDING_KEY = "dynasaurus-onboarded";

interface OnboardingData {
  nickname: string;
  targetLang: string;
  level: string;
  background: string;
  hobbies: string;
  goal: string;
}

interface Props {
  lang: string;
  onComplete: (data: OnboardingData) => void;
  onUpdate: (data: Partial<OnboardingData>) => void; // live fill sidebar
}

type Step = {
  key: keyof OnboardingData;
  fieldId: string;
  emoji: string;
  q: string; qZh: string;
  hint: string; hintZh: string;
  type: "text" | "select" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
};

const STEPS: Step[] = [
  {
    key: "nickname", fieldId: "field-nickname", emoji: "👋",
    q: "what should i call u?", qZh: "怎么称呼你？",
    hint: "ur name or a fun nickname ✨", hintZh: "名字或昵称，随便起 ✨",
    type: "text", placeholder: "ur nickname",
  },
  {
    key: "targetLang", fieldId: "field-targetlang", emoji: "🎯",
    q: "what do u wanna learn?", qZh: "你想学什么语言？",
    hint: "most pick English but ur call 🌏", hintZh: "大多数人选英语，你自己定 🌏",
    type: "select",
    options: [
      { value: "en", label: "English" }, { value: "zh-CN", label: "简体中文" },
      { value: "zh-TW", label: "繁體中文" }, { value: "ja", label: "日本語" },
      { value: "ko", label: "한국어" }, { value: "fr", label: "Français" },
      { value: "de", label: "Deutsch" }, { value: "es", label: "Español" },
      { value: "pt", label: "Português" }, { value: "it", label: "Italiano" },
      { value: "ru", label: "Русский" },
    ],
  },
  {
    key: "level", fieldId: "field-level", emoji: "📊",
    q: "where's ur {lang} at rn?", qZh: "{lang}现在什么水平？",
    hint: "no wrong answers bestie 💫", hintZh: "大胆说，没有错误答案 💫",
    type: "select",
    options: [
      { value: "A1", label: "A1 — Complete Beginner" }, { value: "A2", label: "A2 — Elementary" },
      { value: "B1", label: "B1 — Intermediate" }, { value: "B2", label: "B2 — Upper-Intermediate" },
      { value: "C1", label: "C1 — Advanced" }, { value: "C2", label: "C2 — Proficient" },
    ],
  },
  {
    key: "background", fieldId: "field-background", emoji: "💬",
    q: "tell me about ur language world", qZh: "跟我说说你的语言世界",
    hint: "what do u speak at home? at school or work? any accent or dialect? what's ur field?", hintZh: "在家说什么？在学校或工作用什么语言？有口音或方言吗？专业是什么？",
    type: "textarea",
    placeholder: "e.g. Mandarin at home, English at work, Sichuan accent, CS major",
  },
  {
    key: "hobbies", fieldId: "field-hobbies", emoji: "🎮",
    q: "what do u geek out about?", qZh: "平时喜欢干什么？",
    hint: "the more specific the better — i'll use this to make examples u actually care about 🔥", hintZh: "越具体越好——我会用这些来生成你真正感兴趣的例句 🔥",
    type: "text",
    placeholder: "gaming, k-pop, skating, cooking, basketball…",
  },
  {
    key: "goal", fieldId: "field-goal", emoji: "🏆",
    q: "what are we aiming for?", qZh: "你想达成什么目标？",
    hint: "a real goal helps me choose the right practice", hintZh: "目标越具体，我给的练习越合适",
    type: "text",
    placeholder: "IELTS 7.5, confident meetings, travel…",
  },
];

const t = (lang: string, en: string, zh: string) => lang.startsWith("zh") ? zh : en;

function fillLang(text: string, targetLang: string): string {
  const name = LANG_NAMES[targetLang as keyof typeof LANG_NAMES] || "English";
  return text.replace("{lang}", name);
}

export default function OnboardingModal({ lang, onComplete, onUpdate }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({ nickname: "", targetLang: "en", level: "B1", background: "", hobbies: "", goal: "" });
  const [pos, setPos] = useState<{ top: number; left: number; side: "left" | "right" | "bottom" }>({ top: 0, left: 0, side: "right" });
  const [isMobile, setIsMobile] = useState(false);

  const current = STEPS[step];
  const value = data[current.key];

  // Dynamic options that respect system/target language
  const resolvedOptions = current.type === "select"
    ? (current.key === "targetLang"
        ? Object.keys(LANG_NAMES).map(code => ({
            value: code,
            label: getLangNameIn(code as keyof typeof LANG_NAMES, lang as keyof typeof LANG_NAMES)
          }))
        : current.key === "level"
          ? ["A1","A2","B1","B2","C1","C2"].map(lvl => ({
              value: lvl,
              label: `${lvl} — ${getCEFRLabel(lvl, lang as keyof typeof LANG_NAMES, (data.targetLang as keyof typeof LANG_NAMES) || "en")}`
            }))
          : current.options || [])
    : [];

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (isMobile) return;
    const el = document.getElementById(current.fieldId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Position tooltip to the right of the field, centered vertically on it
    const tipLeft = rect.right + 16;
    const tipTop = rect.top + rect.height / 2;
    // If the tooltip would go off-screen, position below the field instead
    if (tipLeft + 320 > window.innerWidth) {
      setPos({ top: rect.bottom + 8, left: rect.left, side: "bottom" });
    } else {
      setPos({ top: tipTop, left: tipLeft, side: "right" });
    }
  }, [step, isMobile, current.fieldId]);

  const updateValue = (val: string) => {
    const updated = { ...data, [current.key]: val };
    setData(updated);
    // Live fill the sidebar field
    onUpdate({ [current.key]: val } as Partial<OnboardingData>);
  };

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(ONBOARDING_KEY, "true");
      onComplete(data);
    }
  };

  const skip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete(data);
  };

  // ─── Render Field ───
  const renderField = () => {
    if (current.type === "select" && resolvedOptions.length > 0) {
      return (
        <div className="relative">
          <select value={value as string} onChange={(e) => updateValue(e.target.value)}
            className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-2xl px-4 py-3.5 text-base text-[var(--color-text-primary)] outline-none text-center appearance-none cursor-pointer">
            {resolvedOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      );
    }
    if (current.type === "textarea") {
      return (
        <textarea rows={3} autoFocus value={value as string} onChange={(e) => updateValue(e.target.value)}
          placeholder={current.placeholder}
          className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-2xl px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none resize-none custom-scrollbar" />
      );
    }
    return (
      <input type="text" autoFocus value={value as string} onChange={(e) => updateValue(e.target.value)}
        placeholder={current.placeholder}
        className="w-full bg-[var(--color-bg)] border-2 border-[var(--color-border)] focus:border-[var(--color-accent)] rounded-2xl px-4 py-3.5 text-base text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none text-center" />
    );
  };

  // ─── Mobile ───
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
        <div className="relative bg-[var(--color-panel)] border border-[var(--color-border)] rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex gap-2 mb-6 justify-center">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)]" :
                i < step ? "w-4 bg-[var(--color-accent-warm)]/40" : "w-4 bg-[var(--color-border)]"
              }`} />
            ))}
          </div>
          <div className="text-center mb-3"><span className="text-4xl">{current.emoji}</span></div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] text-center">{fillLang(t(lang, current.q, current.qZh), data.targetLang)}</h2>
          <p className="text-[var(--color-text-muted)] text-xs text-center mb-5">{t(lang, current.hint, current.hintZh)}</p>
          {renderField()}
          <div className="flex gap-3 mt-5">
            <button onClick={skip} className="flex-1 py-3 rounded-2xl font-medium text-sm border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all">skip</button>
            <button onClick={advance} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)] text-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg">{step < STEPS.length - 1 ? "next →" : "🦕 let's GO"}</button>
          </div>
          <p className="text-center text-[10px] text-[var(--color-text-muted)] mt-3 font-mono">{step + 1}/{STEPS.length}</p>
        </div>
      </div>
    );
  }

  // ─── Desktop ───
  return (
    <>
      <div className="fixed inset-0 z-[997] bg-black/40 backdrop-blur-[2px]" onClick={skip} />
      <div className="fixed z-[998] w-80 animate-in slide-in-from-bottom-4 duration-200"
        style={{ top: Math.max(pos.top - 80, 16), left: Math.min(pos.left, window.innerWidth - 340) }}>
        {pos.side === "right" && (
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 rotate-45 bg-[var(--color-panel)] border-l border-t border-[var(--color-border)]" />
        )}
        <div className="bg-[var(--color-panel)] border border-[var(--color-border)] rounded-2xl shadow-2xl p-5">
          <div className="flex gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all flex-1 ${
                i === step ? "bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)]" :
                i < step ? "bg-[var(--color-accent-warm)]/40" : "bg-[var(--color-border)]"
              }`} />
            ))}
          </div>
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl shrink-0">{current.emoji}</span>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{fillLang(t(lang, current.q, current.qZh), data.targetLang)}</h3>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{t(lang, current.hint, current.hintZh)}</p>
            </div>
          </div>
          <div>{renderField()}</div>
          <div className="flex gap-2.5 mt-4">
            <button onClick={skip} className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-all">skip all</button>
            <button onClick={advance} className="flex-1 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)] text-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md">{step < STEPS.length - 1 ? "next →" : "🦕 let's gooo"}</button>
          </div>
        </div>
      </div>
    </>
  );
}
