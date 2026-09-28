"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const EMOJIS = [
  { emoji: "😤", label: "annoying" },
  { emoji: "😕", label: "confusing" },
  { emoji: "😐", label: "meh" },
  { emoji: "🫠", label: "minor" },
  { emoji: "💀", label: "actually broken" },
];

const SCREENSHOT_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

interface Props {
  lang: string;
  onClose: () => void;
}

const t = (lang: string, en: string, zh: string) => lang.startsWith("zh") ? zh : en;

function saveFeedbackLocally(mood: number | null, title: string, detail: string) {
  try {
    const stored: string[] = JSON.parse(localStorage.getItem("dynasaurus-feedback") || "[]");
    stored.push(JSON.stringify({ mood, title, detail, ts: new Date().toISOString() }));
    localStorage.setItem("dynasaurus-feedback", JSON.stringify(stored.slice(-20)));
  } catch {
    // The visible submit error still tells the user the report was not sent.
  }
}

export default function FeedbackModal({ lang, onClose }: Props) {
  const [mood, setMood] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!SCREENSHOT_EXTENSIONS[file.type] || file.size >= 5 * 1024 * 1024) {
      setScreenshot(null);
      setSubmitError(t(lang, "Use a PNG, JPEG, or WebP image under 5MB.", "请使用 5MB 以内的 PNG、JPEG 或 WebP 图片。"));
      event.target.value = "";
      return;
    }
    setSubmitError("");
    setScreenshot(file);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setUploading(true);
    setSubmitError("");

    try {
      let screenshotUrl: string | null = null;

      if (screenshot) {
        const extension = SCREENSHOT_EXTENSIONS[screenshot.type];
        if (!extension) throw new Error("Unsupported screenshot format");
        const path = `bug-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const bucket = supabase.storage.from("bug-screenshots");
        const { error: uploadError } = await bucket.upload(path, screenshot, {
          contentType: screenshot.type || undefined,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        screenshotUrl = bucket.getPublicUrl(path).data.publicUrl;
      }

      const { error: reportError } = await supabase.from("bug_reports").insert({
        mood: mood !== null ? EMOJIS[mood].emoji : "❓",
        r_recognize: title.trim(),
        u_understand: detail.trim(),
        screenshot_url: screenshotUrl,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
      });
      if (reportError) throw reportError;

      setSent(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      saveFeedbackLocally(mood, title.trim(), detail.trim());
      const detailMessage = error instanceof Error ? error.message : "Unknown error";
      setSubmitError(t(
        lang,
        `The report could not be sent and was saved on this device. Please retry. (${detailMessage})`,
        `报告未能发送，已保存在此设备上。请重试。（${detailMessage}）`,
      ));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-7 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
        {sent ? (
          <div className="py-6 text-center">
            <span className="inline-block animate-bounce text-5xl">🫶</span>
            <h3 className="mt-4 text-lg font-bold text-[var(--color-text-primary)]">
              {t(lang, "got it — thanks for taking the time", "收到——谢谢你花时间告诉我")}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {t(lang, "I'm on it 🦕", "马上跟进 🦕")}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🐛</span>
                <div>
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {t(lang, "notice something off?", "发现什么问题了吗？")}
                  </h3>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {t(lang, "I'm listening — the details help me learn", "我在听——细节越清楚我学得越快")}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-lg text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]">✕</button>
            </div>

            <div className="mb-5">
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t(lang, "how's the vibe?", "什么感受？")}
              </p>
              <div className="flex gap-2.5">
                {EMOJIS.map((entry, index) => (
                  <button
                    key={entry.label}
                    onClick={() => setMood(index)}
                    className={`flex-1 rounded-xl border py-2.5 text-xl transition-all ${
                      mood === index
                        ? "scale-110 border-[#FF6B6B] bg-[#FF6B6B]/10 shadow-lg shadow-[#FF6B6B]/10"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-hover)]"
                    }`}
                    title={entry.label}
                  >
                    {entry.emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-medium text-[var(--color-accent)]">
                {t(lang, "🅁 what went wrong?", "🅁 出了什么问题？")}
              </label>
              <input
                type="text"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t(lang, "describe what you saw — keep it sharp", "描述你看到的——精简就行")}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[#FF6B6B]/50"
              />
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-medium text-[var(--color-accent-warm)]">
                {t(lang, "🅄 what should have happened?", "🅄 你期待发生什么？")}
              </label>
              <textarea
                rows={2}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                placeholder={t(lang, "what did you expect instead? any steps to reproduce?", "你本来期待看到什么？有复现步骤吗？")}
                className="custom-scrollbar w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-muted)] focus:border-[#FF6B6B]/50"
              />
            </div>

            <div className="mb-5">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-medium transition-all ${
                  screenshot
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {screenshot ? `📎 ${screenshot.name}` : t(lang, "📎 attach screenshot (optional)", "📎 附上截图（可选）")}
              </button>
            </div>

            {submitError && <p role="alert" className="mb-3 text-xs text-red-400">{submitError}</p>}

            <button
              onClick={handleSubmit}
              disabled={!title.trim() || uploading}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] py-3 text-sm font-bold text-black shadow-lg shadow-[#FF6B6B]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {uploading ? t(lang, "sending…", "发送中…") : t(lang, "🚀 send report", "🚀 发送报告")}
            </button>

            <p className="mt-3 text-center text-[10px] text-[var(--color-text-muted)]">
              {t(lang, "every report makes this better. thank you 🙏", "每次反馈都让这个产品更好。谢谢你 🙏")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export function FeedbackButton({ onClick }: { onClick: () => void; lang: string }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[997] flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] text-lg shadow-lg transition-all hover:scale-110 hover:border-[#FF6B6B]/40 hover:shadow-[#FF6B6B]/10 active:scale-95"
      title="Report a bug"
    >
      🐛
    </button>
  );
}
