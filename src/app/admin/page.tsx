import { redirect } from 'next/navigation';
import Link from 'next/link';
import AdminDashboard, { type Student } from '@/components/AdminDashboard';
import { getAdminAuth } from '@/lib/admin';
import { getServiceClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const ENTITLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

export default async function AdminPage() {
  const { user, isAdmin } = await getAdminAuth();
  if (!user) redirect('/auth/login?next=/admin');

  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0D0D0F] p-6 text-center text-[#F2F2F5]">
        <div className="max-w-md rounded-2xl border border-[#2E2E33] bg-[#1A1A1E] p-8">
          <div className="mb-4 text-5xl">🔒</div>
          <h1 className="text-xl font-bold">Administrator access required</h1>
          <p className="mt-3 text-sm leading-6 text-[#9E9EA6]">Your session is valid, but it does not contain an administrator role.</p>
          <Link href="/" className="mt-6 inline-block text-sm text-[#FF6B6B] hover:underline">Back to DynaSaurus</Link>
        </div>
      </main>
    );
  }

  const service = getServiceClient();
  const [profilesResult, subscriptionsResult, countsResult] = await Promise.all([
    service.from('profiles').select('id, email, cefr_level, l1, created_at').order('created_at', { ascending: false }),
    service.from('subscriptions').select('user_id, tier, status, updated_at').order('updated_at', { ascending: false }),
    service.rpc('get_query_counts'),
  ]);

  const loadError = profilesResult.error || subscriptionsResult.error || countsResult.error;
  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0D0D0F] p-6 text-center text-[#F2F2F5]">
        <div className="max-w-lg rounded-2xl border border-red-500/30 bg-[#1A1A1E] p-8">
          <h1 className="text-xl font-bold">Admin data could not be loaded</h1>
          <p className="mt-3 text-sm text-red-300">{loadError.message}</p>
        </div>
      </main>
    );
  }

  const tierByUser = new Map<string, string>();
  for (const subscription of subscriptionsResult.data ?? []) {
    if (!tierByUser.has(subscription.user_id) && ENTITLED_STATUSES.has(subscription.status)) {
      tierByUser.set(subscription.user_id, subscription.tier);
    }
  }
  const countByUser = new Map<string, number>(
    ((countsResult.data ?? []) as Array<{ user_id: string; count: number }>).map((entry) => [entry.user_id, Number(entry.count) || 0]),
  );

  const students: Student[] = (profilesResult.data ?? []).map((profile) => ({
    id: profile.id,
    email: profile.email ?? '',
    cefr_level: profile.cefr_level ?? '',
    l1: profile.l1 ?? '',
    created_at: profile.created_at ?? '',
    tier: tierByUser.get(profile.id) ?? 'free',
    query_count: countByUser.get(profile.id) ?? 0,
  }));

  return <AdminDashboard adminEmail={user.email ?? 'admin'} initialStudents={students} />;
}
