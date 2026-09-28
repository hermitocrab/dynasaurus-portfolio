"use client";

import { useEffect, useState } from "react";
import EmailVerificationPanel from "@/components/EmailVerificationPanel";
import {
  getFriendlyAuthError,
  isEmailNotConfirmedError,
  isRateLimitError,
  useEmailResendCooldown,
} from "@/lib/email-verification";
import { supabase } from "@/lib/supabase";

function getSafeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/")) return "/";
  // Reject protocol-relative, backslash, and control-character redirects.
  if (next.startsWith("//") || /[\\\u0000-\u001F\u007F]/.test(next)) return "/";
  return next;
}

function getConfirmationCallbackUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", getSafeNextPath());
  return callbackUrl.toString();
}

export default function LoginPage() {
  const [lang, setLang] = useState("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const { cooldownReady, remainingSeconds, startCooldown } =
    useEmailResendCooldown(email);
  const isZh = lang.startsWith("zh");
  const t = (en: string, zh: string) => (isZh ? zh : en);

  useEffect(() => {
    setLang(navigator.language || "en");
    const callbackError = new URLSearchParams(window.location.search).get(
      "error",
    );
    if (callbackError) setError(callbackError);
  }, []);

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      if (isEmailNotConfirmedError(signInError)) {
        setUnconfirmed(true);
        setResendError("");
        setResendNotice("");
      } else {
        setError(getFriendlyAuthError(signInError, isZh));
      }
    } else {
      window.location.href = getSafeNextPath();
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (
      !email.trim() ||
      !cooldownReady ||
      remainingSeconds > 0 ||
      resending
    ) {
      return;
    }

    setResending(true);
    setResendError("");
    setResendNotice("");

    try {
      const { error: resendFailure } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: { emailRedirectTo: getConfirmationCallbackUrl() },
      });

      if (resendFailure) {
        if (isRateLimitError(resendFailure)) startCooldown();
        setResendError(getFriendlyAuthError(resendFailure, isZh));
      } else {
        startCooldown();
        setResendNotice(
          t(
            "A new confirmation email is on its way.",
            "新的确认邮件已发送，请检查收件箱。",
          ),
        );
      }
    } catch (resendFailure) {
      if (isRateLimitError(resendFailure)) startCooldown();
      setResendError(getFriendlyAuthError(resendFailure, isZh));
    } finally {
      setResending(false);
    }
  };

  const handleUseDifferentEmail = () => {
    setUnconfirmed(false);
    setEmail("");
    setPassword("");
    setError("");
    setResendError("");
    setResendNotice("");
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      setError(t("Enter your email address first.", "请先输入邮箱地址。"));
      return;
    }

    setLoading(true);
    setError("");
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: getConfirmationCallbackUrl() },
    });
    if (magicLinkError) {
      setError(getFriendlyAuthError(magicLinkError, isZh));
    } else {
      setNotice(
        t(
          `Magic link sent. Check ${email.trim()}.`,
          `登录链接已发送，请检查 ${email.trim()}。`,
        ),
      );
      setSent(true);
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError(t("Enter your email address first.", "请先输入邮箱地址。"));
      return;
    }

    setLoading(true);
    setError("");
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/auth/reset-password");
    const { error: resetError } =
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: callbackUrl.toString(),
      });
    if (resetError) {
      setError(getFriendlyAuthError(resetError, isZh));
    } else {
      setNotice(
        t(
          `Password reset link sent. Check ${email.trim()}.`,
          `密码重置链接已发送，请检查 ${email.trim()}。`,
        ),
      );
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🦕</div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {t("Welcome back to DynaSaurus", "欢迎回到 DynaSaurus")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t("Your Dynamic Thesaurus", "你的动态词库")}
          </p>
        </div>

        {unconfirmed ? (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-xl shadow-[var(--color-shadow)] sm:p-7">
            <EmailVerificationPanel
              cooldownReady={cooldownReady}
              email={email.trim()}
              error={resendError}
              isResending={resending}
              isZh={isZh}
              kind="unconfirmed"
              onResend={handleResendConfirmation}
              onUseDifferentEmail={handleUseDifferentEmail}
              remainingSeconds={remainingSeconds}
              successMessage={resendNotice}
            />
          </div>
        ) : sent ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center">
            <p className="text-sm text-[var(--color-text-primary)]">
              {t("Check your inbox ✨", "请查看邮箱 ✨")}
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {notice}
            </p>
          </div>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
            />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t("Password", "密码")}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
            />
            {error && (
              <p role="alert" className="text-xs text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)] py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {loading ? t("Signing in…", "登录中…") : t("Sign In", "登录")}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading || !email.trim()}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {t("Sign in without password", "免密码登录")}
            </button>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading || !email.trim()}
              className="w-full py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] disabled:opacity-50"
            >
              {t("Forgot password?", "忘记密码？")}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
          {t("Don't have an account?", "还没有账号？")} {" "}
          <a
            href="/auth/signup"
            className="text-[var(--color-accent)] hover:underline"
          >
            {t("Sign up", "注册")}
          </a>
        </p>
      </div>
    </div>
  );
}
