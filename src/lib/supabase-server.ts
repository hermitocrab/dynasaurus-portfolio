import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getServerEnv } from './env';

export async function createServerSupabaseClient() {
  const env = getServerEnv();
  const store = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components cannot write response cookies. The proxy refreshes
          // the session before render; Route Handlers can write them normally.
        }
      },
    },
  });
}

export const createRouteClient = createServerSupabaseClient;
