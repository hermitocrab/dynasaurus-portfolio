"use client";

import { useEffect, useState } from "react";
import EmailVerificationPanel from "@/components/EmailVerificationPanel";
import {
  getFriendlyAuthError,
  isRateLimitError,
  useEmailResendCooldown,
} from "@/lib/email-verification";
import { supabase } from "@/lib/supabase";

function getConfirmationCallbackUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", "/?welcome=true");
  return callbackUrl.toString();
}

export default function SignupPage() {
  const [lang, setLang] = useState("en");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const { cooldownReady, remainingSeconds, startCooldown } =
    useEmailResendCooldown(email);
  const isZh = lang.startsWith("zh");
  const t = (en: string, zh: string) => (isZh ? zh : en);

  useEffect(() => {
    setLang(navigator.language || "en");
  }, []);

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: getConfirmationCallbackUrl(),
      },
    });

    if (signUpError) {
      setError(getFriendlyAuthError(signUpError, isZh));
    } else if (data.session) {
      window.location.href = "/?welcome=true";
    } else {
      startCooldown();
      setConfirmationSent(true);
      setResendError("");
      setResendNotice("");
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
      const { error: resendFailure } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo: getConfirmationCallbackUrl(),
        },
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
    setConfirmationSent(false);
    setEmail("");
    setError("");
    setResendError("");
    setResendNotice("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🦕</div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {t("Join DynaSaurus", "加入 DynaSaurus")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t(
              "Start building your dynamic thesaurus",
              "开始打造你的动态词库",
            )}
          </p>
        </div>

        {confirmationSent ? (
          <div className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-xl shadow-[var(--color-shadow)] sm:p-7">
            <EmailVerificationPanel
              cooldownReady={cooldownReady}
              email={email.trim()}
              error={resendError}
              isResending={resending}
              isZh={isZh}
              kind="signup"
              onResend={handleResendConfirmation}
              onUseDifferentEmail={handleUseDifferentEmail}
              remainingSeconds={remainingSeconds}
              successMessage={resendNotice}
            />
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              type="text"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("Your name", "你的名字")}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
            />
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
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t(
                "Password (min 6 characters)",
                "密码（至少 6 位）",
              )}
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
              {loading
                ? t("Creating account…", "正在创建账号…")
                : t("Create Account", "创建账号")}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[var(--color-text-muted)]">
          {t("Already have an account?", "已有账号？")} {" "}
          <a
            href="/auth/login"
            className="text-[var(--color-accent)] hover:underline"
          >
            {t("Sign in", "登录")}
          </a>
        </p>
      </div>
    </div>
  );
}
