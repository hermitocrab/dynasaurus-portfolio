import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const parsedLimit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 50;

    const { data, error } = await supabase
      .from("query_log")
      .select("word, response, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return NextResponse.json({ entries: data || [] });
  } catch (err: unknown) {
    console.error("History load failed:", err);
    return NextResponse.json({ error: "History load failed" }, { status: 500 });
  }
}
