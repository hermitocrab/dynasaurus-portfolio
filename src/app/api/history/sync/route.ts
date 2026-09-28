import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface HistorySyncEntry {
  word: string;
  content?: string;
  ts: number;
}

const MIN_VALID_TIMESTAMP = Date.UTC(2000, 0, 1);
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body: unknown = await request.json();
    const rawEntries = body && typeof body === 'object' && 'entries' in body
      ? (body as { entries?: unknown }).entries
      : undefined;

    if (!Array.isArray(rawEntries)) {
      return NextResponse.json({ error: "entries must be an array" }, { status: 400 });
    }

    const entries = rawEntries.filter((entry): entry is HistorySyncEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as Partial<HistorySyncEntry>;
      return typeof candidate.word === 'string'
        && candidate.word.trim().length > 0
        && typeof candidate.ts === 'number'
        && Number.isFinite(candidate.ts)
        && candidate.ts >= MIN_VALID_TIMESTAMP
        && candidate.ts <= Date.now() + MAX_FUTURE_SKEW_MS;
    }).slice(0, 50);

    if (!entries.length) return NextResponse.json({ synced: 0 });

    const values = entries.map(e => ({
      user_id: user.id,
      word: e.word.trim().slice(0, 500),
      module: 'history-sync',
      response: typeof e.content === 'string' ? e.content.slice(0, 100_000) : '',
      created_at: new Date(e.ts).toISOString(),
    }));

    const timestamps = values.map((value) => value.created_at);
    const { data: existing, error: existingError } = await supabase
      .from("query_log")
      .select("word, created_at")
      .in("created_at", timestamps);

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set(
      (existing || []).map((entry) => `${entry.created_at}\u0000${entry.word}`),
    );
    const newValues = values.filter(
      (entry) => !existingKeys.has(`${entry.created_at}\u0000${entry.word}`),
    );

    if (!newValues.length) return NextResponse.json({ synced: 0 });

    const { error } = await supabase.from("query_log").insert(newValues);

    if (error) throw new Error(error.message);

    return NextResponse.json({ synced: newValues.length });
  } catch (err: unknown) {
    console.error("History sync failed:", err);
    return NextResponse.json({ error: "History sync failed" }, { status: 500 });
  }
}
