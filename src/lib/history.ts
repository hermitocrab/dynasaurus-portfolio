export const HISTORY_STORAGE_KEY = 'dynasaurus-history';
export const LEGACY_HISTORY_STORAGE_KEYS = ['dynasaurus_history'] as const;
export const MAX_HISTORY_ENTRIES = 50;
export const MAX_HISTORY_CONTENT_CHARS = 50_000;

const MAX_HISTORY_WORD_CHARS = 500;
const MAX_HISTORY_TIME_CHARS = 80;
const MAX_LOCAL_HISTORY_CHARS = 1_500_000;
const MIN_VALID_TIMESTAMP = Date.UTC(2000, 0, 1);
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export interface HistoryEntry {
  word: string;
  content: string;
  ts: number;
  time: string;
}

function normalizeTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < MIN_VALID_TIMESTAMP || value > Date.now() + MAX_FUTURE_SKEW_MS) return null;
  return value;
}

function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<HistoryEntry>;
  if (typeof candidate.word !== 'string') return null;

  const word = candidate.word.trim().slice(0, MAX_HISTORY_WORD_CHARS);
  if (!word) return null;

  const normalizedTimestamp = normalizeTimestamp(candidate.ts);
  if (candidate.ts !== undefined && normalizedTimestamp === null) return null;
  const ts = normalizedTimestamp ?? Date.now();
  return {
    word,
    content: typeof candidate.content === 'string'
      ? candidate.content.slice(0, MAX_HISTORY_CONTENT_CHARS)
      : '',
    ts,
    time: typeof candidate.time === 'string'
      ? candidate.time.slice(0, MAX_HISTORY_TIME_CHARS)
      : new Date(ts).toLocaleString(),
  };
}

function readRawHistory(): { raw: string; sourceKey: string } {
  const canonical = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (canonical !== null) return { raw: canonical, sourceKey: HISTORY_STORAGE_KEY };

  for (const key of LEGACY_HISTORY_STORAGE_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy !== null) return { raw: legacy, sourceKey: key };
  }

  return { raw: '[]', sourceKey: HISTORY_STORAGE_KEY };
}

export function readLocalHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];

  try {
    const { raw, sourceKey } = readRawHistory();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const entries = parsed
      .map(normalizeHistoryEntry)
      .filter((entry): entry is HistoryEntry => entry !== null)
      .slice(0, MAX_HISTORY_ENTRIES);

    if (sourceKey !== HISTORY_STORAGE_KEY) replaceLocalHistory(entries);
    return entries;
  } catch {
    return [];
  }
}

export function replaceLocalHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return;

  const normalized = entries
    .map(normalizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .slice(0, MAX_HISTORY_ENTRIES);

  let totalChars = 0;
  const bounded = normalized.filter((entry) => {
    const entryChars = entry.word.length + entry.content.length + entry.time.length + 64;
    if (totalChars + entryChars > MAX_LOCAL_HISTORY_CHARS) return false;
    totalChars += entryChars;
    return true;
  });

  // If a browser has an unusually small quota, retain as many newest entries
  // as possible instead of turning a successful chat response into an error.
  for (let length = bounded.length; length >= 0; length -= 1) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(bounded.slice(0, length)));
      LEGACY_HISTORY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
      return;
    } catch {
      // Retry with one fewer (oldest) entry.
    }
  }
}

function historyIdentity(word: string) {
  return word.trim().toLocaleLowerCase();
}

export function mergeHistoryEntries(...groups: HistoryEntry[][]): HistoryEntry[] {
  const entries = groups
    .flat()
    .map(normalizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null)
    .sort((a, b) => b.ts - a.ts);
  const byWord = new Map<string, HistoryEntry>();

  for (const entry of entries) {
    const key = historyIdentity(entry.word);
    const existing = byWord.get(key);
    if (!existing || (!existing.content && entry.content)) byWord.set(key, entry);
  }

  return Array.from(byWord.values())
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_HISTORY_ENTRIES);
}

export function saveLocalHistoryEntry(entry: HistoryEntry) {
  const entries = mergeHistoryEntries([entry], readLocalHistory());
  replaceLocalHistory(entries);
  return entries;
}

export function findLocalHistoryEntry(word: string) {
  const identity = historyIdentity(word);
  return readLocalHistory().find((entry) => historyIdentity(entry.word) === identity) ?? null;
}

export function clearLocalHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  LEGACY_HISTORY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export async function syncHistoryEntries(entries = readLocalHistory()) {
  if (entries.length === 0) return 0;

  const response = await fetch('/api/history/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: entries.slice(0, MAX_HISTORY_ENTRIES) }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof result.error === 'string' ? result.error : 'History sync failed.';
    throw new Error(message);
  }

  return typeof result.synced === 'number' ? result.synced : 0;
}
