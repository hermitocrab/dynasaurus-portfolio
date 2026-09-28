"use client";

interface Props {
  cooldownReady: boolean;
  email: string;
  error?: string;
  isResending: boolean;
  isZh: boolean;
  kind: "signup" | "unconfirmed";
  onResend: () => void;
  onUseDifferentEmail: () => void;
  remainingSeconds: number;
  successMessage?: string;
}

export default function EmailVerificationPanel({
  cooldownReady,
  email,
  error,
  isResending,
  isZh,
  kind,
  onResend,
  onUseDifferentEmail,
  remainingSeconds,
  successMessage,
}: Props) {
  const t = (en: string, zh: string) => (isZh ? zh : en);
  const coolingDown = !cooldownReady || remainingSeconds > 0;

  return (
    <div className="py-2 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--color-accent)]/25 bg-gradient-to-br from-[var(--color-accent)]/15 to-[var(--color-guide-purple)]/15">
        <svg
          aria-hidden="true"
          className="h-7 w-7 text-[var(--color-accent)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7.5 10.2 12a3.4 3.4 0 0 0 3.6 0L21 7.5M5.25 19.5h13.5A2.25 2.25 0 0 0 21 17.25V6.75a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </div>

      <h2 className="mt-4 text-xl font-bold text-[var(--color-text-primary)]">
        {kind === "signup"
          ? t("Confirmation email sent", "确认邮件已发送")
          : t("Email not verified", "邮箱尚未验证")}
      </h2>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-[var(--color-text-secondary)]">
        {kind === "signup"
          ? t("We sent a confirmation link to", "我们已将确认链接发送至")
          : t(
              "Check your inbox and click the confirmation link for",
              "请检查收件箱，并点击确认链接完成验证",
            )}
      </p>
      <p className="mt-1 break-all text-sm font-semibold text-[var(--color-text-primary)]">
        {email}
      </p>

      <div className="mt-5 space-y-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left">
        <p className="flex gap-2 text-xs leading-5 text-[var(--color-text-secondary)]">
          <span aria-hidden="true" className="text-[var(--color-accent-warm)]">✦</span>
          <span>
            {t(
              "Didn't get it? Check your spam or junk folder.",
              "没有收到？请检查垃圾邮件或广告邮件文件夹。",
            )}
          </span>
        </p>
        <p className="flex gap-2 text-xs leading-5 text-[var(--color-text-muted)]">
          <span aria-hidden="true">◷</span>
          <span>
            {t(
              "The link expires for your security, so please verify soon.",
              "为保障账号安全，链接会过期，请尽快完成验证。",
            )}
          </span>
        </p>
      </div>

      {successMessage && (
        <p aria-live="polite" className="mt-4 text-xs text-[var(--color-accent-cool)]">
          {successMessage}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-xs leading-5 text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onResend}
        disabled={isResending || coolingDown}
        className="mt-5 w-full rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 py-3 text-sm font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-surface)] disabled:text-[var(--color-text-muted)] disabled:opacity-80"
      >
        {isResending
          ? t("Sending…", "发送中…")
          : remainingSeconds > 0
            ? t(
                `Resend in ${remainingSeconds}s`,
                `${remainingSeconds} 秒后可重新发送`,
              )
            : kind === "unconfirmed"
              ? t("Resend confirmation email", "重新发送确认邮件")
              : t("Resend", "重新发送")}
      </button>

      <button
        type="button"
        onClick={onUseDifferentEmail}
        className="mt-4 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        {t("Use a different email", "换个邮箱")}
      </button>
    </div>
  );
}
