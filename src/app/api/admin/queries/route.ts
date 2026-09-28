import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/admin';
import { getServiceClient } from '@/lib/supabase-admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const { user, isAdmin } = await getAdminAuth();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isAdmin) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });

  const userId = request.nextUrl.searchParams.get('user_id');
  if (!userId || !UUID_PATTERN.test(userId)) {
    return NextResponse.json({ error: 'A valid user_id is required' }, { status: 400 });
  }

  const service = getServiceClient();
  const { data, error } = await service
    .from('query_log')
    .select('word, module, response, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'Unable to load query history' }, { status: 500 });
  }

  return NextResponse.json({ queries: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
