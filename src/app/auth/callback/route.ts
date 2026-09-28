import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith('/')) return '/';
  // Reject protocol-relative, backslash, and control-character redirects
  // (tabs/newlines can be normalised away by browsers before the redirect).
  if (value.startsWith('//') || /[\\\u0000-\u001F\u007F]/.test(value)) return '/';
  return value;
}

function loginErrorRedirect(origin: string, message: string) {
  const url = new URL('/auth/login', origin);
  url.searchParams.set('error', message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (!code) {
    return loginErrorRedirect(origin, 'The sign-in link is missing its authorization code.');
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return loginErrorRedirect(origin, 'The sign-in link is invalid or expired. Please request a new one.');
  }

  return NextResponse.redirect(new URL(next, origin));
}
