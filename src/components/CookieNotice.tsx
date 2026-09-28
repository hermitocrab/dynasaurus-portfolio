'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Cookie notice — a prerequisite for switching the ad slots on.
 *
 * Rendered by the root layout only when ads are enabled, so an unconfigured
 * deployment shows no banner. Dismissal is remembered per browser.
 */

const STORAGE_KEY = 'dynasaurus-cookie-notice-v1';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Private mode with storage blocked: stay quiet rather than re-prompting.
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // Ignore storage failures — the notice is informational.
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/95 p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)] shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:gap-3">
        <p className="flex-1">
          <span className="font-semibold text-[var(--color-text-primary)]">Cookies</span> — 我们只用必要的
          Cookie 保存你的设置；广告开启后，广告联盟可能使用 Cookie 展示广告。
          <span className="text-[var(--color-text-muted)]"> We use essential cookies for your settings; when ads are on, our ad partner may use cookies to serve them.</span>{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[var(--color-text-primary)]">
            隐私政策 / Privacy
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-xl bg-gradient-to-r from-[#FF6B6B] to-[#FFB347] px-4 py-2 text-xs font-bold text-black transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          知道了 / Got it
        </button>
      </div>
    </div>
  );
}
