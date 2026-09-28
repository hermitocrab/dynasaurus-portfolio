import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './supabase-server';

export function hasAdminRole(user: User) {
  const metadata = user.app_metadata ?? {};
  const roles = Array.isArray(metadata.roles) ? metadata.roles : [];

  return metadata.role === 'admin'
    || metadata.is_admin === true
    || roles.includes('admin');
}

export async function getAdminAuth() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return {
    user: error ? null : user,
    isAdmin: Boolean(user && hasAdminRole(user)),
  };
}
