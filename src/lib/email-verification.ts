"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;

const RESEND_STORAGE_KEY = "dynasaurus-email-resend-at";
const LEGACY_RESEND_STORAGE_KEY = "dynasaurus_email_resend_at";
const STORAGE_RETENTION_MS = 24 * 60 * 60 * 1000;

type CooldownState = {
  email: string;
  ready: boolean;
  remainingSeconds: number;
};

type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function readSentTimes(): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const canonical = window.localStorage.getItem(RESEND_STORAGE_KEY);
    const raw = canonical ?? window.localStorage.getItem(LEGACY_RESEND_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const entries = Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" && Number.isFinite(entry[1]),
      ),
    );
    if (canonical === null) {
      window.localStorage.setItem(RESEND_STORAGE_KEY, JSON.stringify(entries));
      window.localStorage.removeItem(LEGACY_RESEND_STORAGE_KEY);
    }
    return entries;
  } catch {
    return {};
  }
}

function writeSentTime(email: string, sentAt: number) {
  if (typeof window === "undefined" || !email) return;

  try {
    const oldestAllowed = Date.now() - STORAGE_RETENTION_MS;
    const recentEntries = Object.entries(readSentTimes()).filter(
      ([, timestamp]) => timestamp >= oldestAllowed,
    );

    window.localStorage.setItem(
      RESEND_STORAGE_KEY,
      JSON.stringify({ ...Object.fromEntries(recentEntries), [email]: sentAt }),
    );
    window.localStorage.removeItem(LEGACY_RESEND_STORAGE_KEY);
  } catch {
    // The in-memory countdown still works if storage is unavailable.
  }
}

function getRemainingSeconds(email: string, inMemorySentAt = 0) {
  if (!email) return 0;

  const sentAt = Math.max(readSentTimes()[email] ?? 0, inMemorySentAt);
  if (!sentAt) return 0;

  return Math.max(
    0,
    Math.ceil(
      (sentAt + EMAIL_RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000,
    ),
  );
}

export function useEmailResendCooldown(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const inMemorySentTimes = useRef<Record<string, number>>({});
  const [state, setState] = useState<CooldownState>({
    email: "",
    ready: false,
    remainingSeconds: 0,
  });

  useEffect(() => {
    const refresh = () => {
      setState({
        email: normalizedEmail,
        ready: true,
        remainingSeconds: getRemainingSeconds(
          normalizedEmail,
          inMemorySentTimes.current[normalizedEmail],
        ),
      });
    };

    refresh();
    const intervalId = window.setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", refresh);
    };
  }, [normalizedEmail]);

  const startCooldown = useCallback(() => {
    if (!normalizedEmail) return;

    const sentAt = Date.now();
    inMemorySentTimes.current[normalizedEmail] = sentAt;
    writeSentTime(normalizedEmail, sentAt);
    setState({
      email: normalizedEmail,
      ready: true,
      remainingSeconds: EMAIL_RESEND_COOLDOWN_SECONDS,
    });
  }, [normalizedEmail]);

  const isCurrentEmail = state.email === normalizedEmail;

  return {
    cooldownReady: isCurrentEmail && state.ready,
    remainingSeconds: isCurrentEmail ? state.remainingSeconds : 0,
    startCooldown,
  };
}

function getAuthError(error: unknown): AuthErrorLike {
  if (!error || typeof error !== "object") return {};
  return error as AuthErrorLike;
}

export function isEmailNotConfirmedError(error: unknown) {
  const { code = "", message = "" } = getAuthError(error);
  const detail = `${code} ${message}`.toLowerCase().replaceAll("_", " ");

  return (
    detail.includes("email not confirmed") ||
    detail.includes("email is not confirmed") ||
    detail.includes("email not verified")
  );
}

export function isRateLimitError(error: unknown) {
  const { code = "", message = "", status } = getAuthError(error);
  const detail = `${code} ${message}`
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ");

  return (
    status === 429 ||
    detail.includes("rate limit") ||
    detail.includes("too many requests") ||
    detail.includes("only request this after")
  );
}

function getRetrySeconds(error: unknown) {
  const { message = "" } = getAuthError(error);
  const match = message.match(/(\d+)\s*(?:seconds?|secs?|s)\b/i);
  if (!match) return EMAIL_RESEND_COOLDOWN_SECONDS;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0
    ? seconds
    : EMAIL_RESEND_COOLDOWN_SECONDS;
}

export function getFriendlyAuthError(error: unknown, isZh: boolean) {
  if (isRateLimitError(error)) {
    const seconds = getRetrySeconds(error);
    return isZh
      ? `操作过于频繁，请等待 ${seconds} 秒后再试；如果仍未收到，请稍后再试。`
      : `Too many requests. Please wait ${seconds} seconds before trying again; if it still fails, try again later.`;
  }

  const { message } = getAuthError(error);
  if (message) return message;

  return isZh
    ? "出了点问题，请稍后再试。"
    : "Something went wrong. Please try again.";
}
