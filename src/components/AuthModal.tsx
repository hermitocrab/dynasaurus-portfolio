"use client";

import { useState } from "react";
import EmailVerificationPanel from "@/components/EmailVerificationPanel";
import {
  getFriendlyAuthError,
  isEmailNotConfirmedError,
  isRateLimitError,
  useEmailResendCooldown,
} from "@/lib/email-verification";
import { syncHistoryEntries } from "@/lib/history";
import { supabase } from "@/lib/supabase";

interface Props {
  lang: string;
  onClose: () => void;
}

type VerificationState = "signup" | "unconfirmed" | null;

function getConfirmationCallbackUrl() {
  const callbackUrl = new URL("/auth/callback", window.location.origin);
  callbackUrl.searchParams.set("next", "/?welcome=true");
  return callbackUrl.toString();
}

export default function AuthModal({ lang, onClose }: Props) {
  const isZh = lang.startsWith("zh");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [notice, setNotice] = useState("");
  const [verificationState, setVerificationState] =
    useState<VerificationState>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const { cooldownReady, remainingSeconds, startCooldown } =
    useEmailResendCooldown(email);

  const t = (en: string, zh: string) => (isZh ? zh : en);

  const syncHistory = async () => {
    await syncHistoryEntries();
  };

  const handleEmailLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      if (isEmailNotConfirmedError(signInError)) {
        setVerificationState("unconfirmed");
        setResendError("");
        setResendNotice("");
      } else {
        setError(getFriendlyAuthError(signInError, isZh));
      }
    } else {
      try {
        await syncHistory();
        onClose();
        window.location.reload();
      } catch (syncError) {
        const message =
          syncError instanceof Error
            ? syncError.message
            : t("History sync failed", "历史记录同步失败");
        setError(
          t(
            `Signed in, but history sync failed: ${message}`,
            `已登录，但历史记录同步失败：${message}`,
          ),
        );
      }
    }
    setLoading(false);
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError("");
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getConfirmationCallbackUrl() },
    });

    if (signUpError) {
      setError(getFriendlyAuthError(signUpError, isZh));
    } else if (data.session) {
      try {
        await syncHistory();
        onClose();
        window.location.href = "/?welcome=true";
      } catch (syncError) {
        const message =
          syncError instanceof Error
            ? syncError.message
            : t("History sync failed", "历史记录同步失败");
        setError(
          t(
            `Account created, but history sync failed: ${message}`,
            `账号已创建，但历史记录同步失败：${message}`,
          ),
        );
      }
    } else {
      startCooldown();
      setVerificationState("signup");
      setResendError("");
      setResendNotice("");
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (
      !verificationState ||
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
      const result =
        verificationState === "signup"
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: getConfirmationCallbackUrl() },
            })
          : await supabase.auth.resend({
              type: "signup",
              email: email.trim(),
              options: { emailRedirectTo: getConfirmationCallbackUrl() },
            });

      if (result.error) {
        if (isRateLimitError(result.error)) startCooldown();
        setResendError(getFriendlyAuthError(result.error, isZh));
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
    const wasUnconfirmedLogin = verificationState === "unconfirmed";
    setVerificationState(null);
    setResendError("");
    setResendNotice("");
    setError("");
    setEmail("");
    if (wasUnconfirmedLogin) setPassword("");
  };

  const handleMagicLink = async () => {
    if (!email.trim()) return;

    setLoading(true);
    setError("");
    const { error: magicLinkError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (magicLinkError) {
      setError(getFriendlyAuthError(magicLinkError, isZh));
    } else {
      setNotice(
        t(
          `Magic link sent to ${email.trim()}`,
          `登录链接已发送到 ${email.trim()}`,
        ),
      );
      setMagicSent(true);
    }
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) return;

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
          `Password reset link sent to ${email.trim()}`,
          `密码重置链接已发送到 ${email.trim()}`,
        ),
      );
      setMagicSent(true);
    }
    setLoading(false);
  };

  const changeMode = (nextMode: "login" | "signup") => {
    setMode(nextMode);
    setError("");
    setMagicSent(false);
    setVerificationState(null);
    setResendError("");
    setResendNotice("");
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-in slide-in-from-bottom-4 relative w-full max-w-sm rounded-3xl border border-[var(--color-border)] bg-[var(--color-panel)] p-7 shadow-2xl duration-200">
        {verificationState ? (
          <EmailVerificationPanel
            cooldownReady={cooldownReady}
            email={email.trim()}
            error={resendError}
            isResending={resending}
            isZh={isZh}
            kind={verificationState}
            onResend={handleResendConfirmation}
            onUseDifferentEmail={handleUseDifferentEmail}
            remainingSeconds={remainingSeconds}
            successMessage={resendNotice}
          />
        ) : magicSent ? (
          <div className="py-6 text-center">
            <span className="text-4xl">📧</span>
            <h3 className="mt-3 text-lg font-bold text-[var(--color-text-primary)]">
              {t("Check your inbox", "查看你的邮箱")}
            </h3>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {notice}
            </p>
            <button
              onClick={onClose}
              className="mt-5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            >
              {t("Close", "关闭")}
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <span className="text-4xl">🦕</span>
              <h2 className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                {mode === "login"
                  ? t("Welcome back", "欢迎回来")
                  : t("Create account", "创建账号")}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {mode === "login"
                  ? t("Sign in to sync your history", "登录以同步你的历史记录")
                  : t(
                      "Save your progress across devices",
                      "跨设备保存你的学习进度",
                    )}
              </p>
            </div>

            <form
              onSubmit={mode === "login" ? handleEmailLogin : handleSignUp}
              className="space-y-3"
            >
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
              />

              <input
                type="password"
                required
                minLength={mode === "signup" ? 6 : undefined}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={
                  mode === "login"
                    ? t("Password", "密码")
                    : t("Password (min 6 chars)", "密码（至少6位）")
                }
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)]"
              />

              {error && (
                <p role="alert" className="px-1 text-xs text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full rounded-2xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)] py-3 text-sm font-bold text-black shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-30"
              >
                {loading
                  ? t("Please wait…", "请稍等…")
                  : mode === "login"
                    ? t("Sign In", "登录")
                    : t("Sign Up", "注册")}
              </button>

              {mode === "login" && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleMagicLink}
                    disabled={loading || !email.trim()}
                    className="w-full rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-medium text-[var(--color-text-muted)] transition-all hover:text-[var(--color-text-secondary)]"
                  >
                    {t("Sign in without password", "免密码登录")}
                  </button>
                  <button
                    type="button"
                    onClick={handlePasswordReset}
                    disabled={loading || !email.trim()}
                    className="w-full text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
                  >
                    {t("Forgot password?", "忘记密码？")}
                  </button>
                </div>
              )}
            </form>

            <p className="mt-5 text-center text-xs text-[var(--color-text-muted)]">
              {mode === "login" ? (
                <>
                  {t("Don't have an account?", "还没有账号？")} {" "}
                  <button
                    onClick={() => changeMode("signup")}
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {t("Sign up", "注册")}
                  </button>
                </>
              ) : (
                <>
                  {t("Already have an account?", "已有账号？")} {" "}
                  <button
                    onClick={() => changeMode("login")}
                    className="font-medium text-[var(--color-accent)] hover:underline"
                  >
                    {t("Sign in", "登录")}
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
