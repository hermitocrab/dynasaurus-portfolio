"use client";

type Props = {
  lang: string;
  onDismiss: () => void;
  onSelectPrompt: (prompt: string) => void;
};

type GuideItem = {
  emoji: string;
  accent: "coral" | "amber" | "purple" | "sunset";
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  prompt: string;
  promptZh: string;
};

const GUIDE_ITEMS: GuideItem[] = [
  {
    emoji: "🌱",
    accent: "coral",
    title: "Look up a word",
    titleZh: "查一个单词",
    description: "Get meaning, pronunciation, roots, etymology + a memory hook.",
    descriptionZh: "查看释义、发音、词根、词源和记忆钩子。",
    prompt: "serendipity",
    promptZh: "serendipity",
  },
  {
    emoji: "🌉",
    accent: "amber",
    title: "Bridge a sentence",
    titleZh: "翻译一句话",
    description: "Paste a sentence for translation and cross-culture context.",
    descriptionZh: "粘贴句子，获得翻译和跨文化语境提示。",
    prompt: "How would I say '辛苦了' naturally in English?",
    promptZh: "“辛苦了”用英语自然地怎么说？",
  },
  {
    emoji: "🩺",
    accent: "purple",
    title: "Fix my grammar",
    titleZh: "检查语法",
    description: "Share your sentence and learn why a correction works.",
    descriptionZh: "输入你的句子，不只改错，还会解释原因。",
    prompt: "Please check my grammar: I have went there yesterday.",
    promptZh: "请检查语法：I have went there yesterday.",
  },
  {
    emoji: "🎙️",
    accent: "sunset",
    title: "Practise speaking",
    titleZh: "练习口语",
    description: "Start an IELTS-style speaking practice, step by step.",
    descriptionZh: "开始一轮循序渐进的雅思口语练习。",
    prompt: "Give me an IELTS speaking Part 2 practice question.",
    promptZh: "给我一道雅思口语 Part 2 练习题。",
  },
];

const ACCENT_STYLES: Record<GuideItem["accent"], { card: string; icon: string; action: string }> = {
  coral: {
    card: "border-[#ff6b6b]/25 hover:border-[#ff6b6b]/60 hover:shadow-[0_14px_36px_rgba(255,107,107,0.10)]",
    icon: "bg-[#ff6b6b]/12 text-[var(--color-guide-coral)] ring-[#ff6b6b]/25",
    action: "text-[var(--color-guide-coral)]",
  },
  amber: {
    card: "border-[#ffb347]/25 hover:border-[#ffb347]/60 hover:shadow-[0_14px_36px_rgba(255,179,71,0.10)]",
    icon: "bg-[#ffb347]/12 text-[var(--color-guide-amber)] ring-[#ffb347]/25",
    action: "text-[var(--color-guide-amber)]",
  },
  purple: {
    card: "border-[#a78bfa]/25 hover:border-[#a78bfa]/60 hover:shadow-[0_14px_36px_rgba(167,139,250,0.12)]",
    icon: "bg-[#a78bfa]/12 text-[var(--color-guide-purple)] ring-[#a78bfa]/25",
    action: "text-[var(--color-guide-purple)]",
  },
  sunset: {
    card: "border-[#c084fc]/25 hover:border-[#c084fc]/60 hover:shadow-[0_14px_36px_rgba(192,132,252,0.12)]",
    icon: "bg-gradient-to-br from-[#ff6b6b]/15 to-[#a78bfa]/20 text-[var(--color-guide-purple)] ring-[#a78bfa]/25",
    action: "text-[var(--color-guide-purple)]",
  },
};

export default function UsageGuide({ lang, onDismiss, onSelectPrompt }: Props) {
  const isZh = lang.startsWith("zh");

  return (
    <section
      id="usage-guide"
      aria-labelledby="usage-guide-title"
      className="relative isolate mx-3 mb-2 shrink-0 overflow-hidden rounded-3xl border border-[#a78bfa]/20 bg-[var(--color-panel)]/95 p-3.5 shadow-2xl shadow-black/15 backdrop-blur-xl sm:mx-6 sm:mb-3 sm:p-5 md:mx-8"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-10 -top-12 h-36 w-36 rounded-full bg-[#ff6b6b]/12 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#a78bfa]/15 blur-3xl" />

      <div className="relative mb-3 flex items-start justify-between gap-3 sm:mb-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span aria-hidden="true" className="text-xl">🦕</span>
            <h2 id="usage-guide-title" className="text-sm font-extrabold tracking-tight text-[var(--color-text-primary)] sm:text-base">
              {isZh ? "解锁你的 DynaSaurus 工具箱" : "Unlock your DynaSaurus toolkit"}
            </h2>
            <span className="rounded-full border border-[#a78bfa]/25 bg-gradient-to-r from-[#ff6b6b]/10 via-[#ffb347]/10 to-[#a78bfa]/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-guide-purple)]">
              {isZh ? "快速上手" : "start here"}
            </span>
          </div>
          <p className="max-w-2xl text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {isZh
              ? "设置完成。选一个玩法，示例会自动填入输入框，回答会匹配你的等级和兴趣。"
              : "You’re set. Pick a move and we’ll drop an example into the input, tuned to your level and interests."}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={isZh ? "关闭使用指引" : "Dismiss usage guide"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#ff6b6b]/45 hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-guide-purple)]"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <ul
        aria-label={isZh ? "可尝试的 DynaSaurus 功能" : "Ways to use DynaSaurus"}
        className="relative m-0 grid list-none auto-cols-[minmax(13.5rem,82vw)] grid-flow-col gap-2.5 overflow-x-auto p-0 pb-2 [scrollbar-color:var(--color-border)_transparent] snap-x snap-mandatory sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
      >
        {GUIDE_ITEMS.map((item) => {
          const styles = ACCENT_STYLES[item.accent];
          const title = isZh ? item.titleZh : item.title;
          const description = isZh ? item.descriptionZh : item.description;

          return (
            <li key={item.title} className="snap-start">
              <button
                type="button"
                onClick={() => onSelectPrompt(isZh ? item.promptZh : item.prompt)}
                aria-label={`${title}。${description}。${isZh ? "将示例填入输入框" : "Fill the example into the input"}`}
                className={`group h-full min-h-28 w-full rounded-2xl border bg-[var(--color-surface)]/90 p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--color-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-guide-purple)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] motion-reduce:transform-none motion-reduce:transition-none ${styles.card}`}
              >
                <span className="mb-2 flex items-center justify-between gap-3">
                  <span aria-hidden="true" className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ring-1 ${styles.icon}`}>
                    {item.emoji}
                  </span>
                  <span aria-hidden="true" className={`font-mono text-[10px] uppercase tracking-wider ${styles.action}`}>
                    {isZh ? "试试 →" : "try it →"}
                  </span>
                </span>
                <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                  {title}
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-[var(--color-text-secondary)] transition-colors group-hover:text-[var(--color-text-primary)] sm:text-xs">
                  {description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="relative mt-0.5 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] sm:hidden">
        {isZh ? "左滑看更多 →" : "swipe for more →"}
      </p>
    </section>
  );
}
