import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-admin";

export interface ActivationCodeRecord {
  id: string;
  code: string;
  tier: string;
  is_student: boolean;
  used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface SharedKeyRecord {
  key: string;
  label: string | null;
}

const ACTIVATION_CODE_COLUMNS =
  "id, code, tier, is_student, used, used_by, used_at, created_at, expires_at";
const CODE_PATTERN = /^DYNA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const NOTE_KEY_PATTERN = /^[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+$/;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function randomBlock(): string {
  const bytes = randomBytes(4);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function normalizeActivationCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function normalizeNoteKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  return NOTE_KEY_PATTERN.test(key) || /^[A-Z0-9]{4,128}$/.test(key) ? key : null;
}

/**
 * Optional path to a shared keys JSON file. Configure via the environment.
 * This public copy ships with no hardcoded path and no bundled key store.
 */
const SHARED_KEYS_PATH = process.env.SHARED_KEYS_PATH?.trim() || "";

/**
 * Shared keys are reusable (one key per class). Supabase note_keys is the source
 * of truth; an optional file store can be layered in via SHARED_KEYS_PATH.
 */
export async function validateSharedKey(key: unknown): Promise<SharedKeyRecord | null> {
  const normalized = normalizeNoteKey(key);
  if (!normalized) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = await import("node:fs");
    if (SHARED_KEYS_PATH && fs.existsSync(SHARED_KEYS_PATH)) {
      const table: Record<string, string> = JSON.parse(fs.readFileSync(SHARED_KEYS_PATH, "utf8"));
      for (const [slug, value] of Object.entries(table)) {
        if (typeof value === "string" && value.trim().toUpperCase() === normalized) {
          return { key: normalized, label: slug };
        }
      }
    }
  } catch {
    // fall through to the database lookup
  }

  const { data, error } = await getServiceClient()
    .from("note_keys")
    .select("key, label")
    .eq("key", normalized)
    .maybeSingle();

  if (error) throw new Error(`Could not validate shared key: ${error.message}`);
  return data ? { key: data.key, label: data.label ?? null } : null;
}

/**
 * Shared class-note keys (e.g. EXAMPLE-00-CLASS). These are NOT consumed — a
 * whole class shares one key, so any device with the key is licensed.
 */
export async function validateNoteKey(key: unknown): Promise<boolean> {
  return Boolean(await validateSharedKey(key));
}

export function activationOwner(
  deviceId: unknown,
  userId?: unknown,
  fallback?: string,
): string {
  const candidate = typeof deviceId === "string" && deviceId.trim()
    ? `device:${deviceId.trim().slice(0, 160)}`
    : typeof userId === "string" && userId.trim()
      ? `user:${userId.trim().slice(0, 160)}`
      : `fallback:${(fallback || "unknown").slice(0, 160)}`;

  return createHash("sha256").update(candidate).digest("hex");
}

export async function generateActivationCode(
  tier = "basic",
  isStudent = false,
): Promise<string> {
  const client = getServiceClient();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `DYNA-${randomBlock()}-${randomBlock()}-${randomBlock()}`;
    const { error } = await client.from("activation_codes").insert({
      code,
      tier,
      is_student: isStudent,
    });

    if (!error) return code;
    if (error.code !== "23505") throw new Error(`Could not generate activation code: ${error.message}`);
  }

  throw new Error("Could not generate a unique activation code after several attempts.");
}

export async function validateActivationCode(
  code: unknown,
): Promise<ActivationCodeRecord | null> {
  const normalized = normalizeActivationCode(code);
  if (!normalized) return null;

  const { data, error } = await getServiceClient()
    .from("activation_codes")
    .select(ACTIVATION_CODE_COLUMNS)
    .eq("code", normalized)
    .maybeSingle();

  if (error) throw new Error(`Could not validate activation code: ${error.message}`);
  if (!data || isExpired(data.expires_at)) return null;
  return data as ActivationCodeRecord;
}

/**
 * Checks a license. Both generated activation codes and shared Kee keys are
 * reusable keys; expiry still applies to generated codes. Device ownership is
 * intentionally not part of this small private-site activation flow.
 */
export async function validateActivatedLicense(
  code: unknown,
  _owner?: string,
): Promise<ActivationCodeRecord | null> {
  const normalized = normalizeActivationCode(code);
  if (normalized) {
    const { data, error } = await getServiceClient()
      .from("activation_codes")
      .select(ACTIVATION_CODE_COLUMNS)
      .eq("code", normalized)
      .maybeSingle();

    if (error) throw new Error(`Could not validate cached license: ${error.message}`);
    if (data && !isExpired(data.expires_at)) return data as ActivationCodeRecord;
  }

  // Shared-key fallback: no consumption or owner binding.
  const shared = await validateSharedKey(code);
  if (shared) {
    return {
      id: "note-key",
      code: shared.key,
      tier: "basic",
      is_student: true,
      used: true,
      used_by: null,
      used_at: null,
      created_at: new Date().toISOString(),
      expires_at: null,
    } as ActivationCodeRecord;
  }

  return null;
}
