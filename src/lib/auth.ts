import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { SubscriptionTier } from './subscriptions';

export type { SubscriptionTier } from './subscriptions';

export interface UserProfile {
  id: string;
  email?: string;
  full_name?: string;
  cefr_level: string;
  l1: string;
  hobbies: string;
  goal: string;
}

export interface UserSubscription {
  stripe_subscription_id: string;
  stripe_price_id: string;
  tier: SubscriptionTier;
  status: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  updated_at: string;
}

// Get current user
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// Get user profile
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data as UserProfile | null;
}

// Upsert user profile
export async function upsertProfile(userId: string, updates: Partial<UserProfile>) {
  return supabase.from('profiles').upsert({ id: userId, ...updates });
}

// Get subscription
export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id, stripe_price_id, tier, status, current_period_start, current_period_end, cancel_at_period_end, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as UserSubscription | null;
}

// Log query
export async function logQuery(userId: string, word: string, module: string, response: string) {
  return supabase.from('query_log').insert({ user_id: userId, word, module, response });
}

// Get query history for a user (admin or self)
export async function getQueryHistory(userId: string, limit = 50) {
  const { data } = await supabase
    .from('query_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// Sign out
export async function signOut() {
  return supabase.auth.signOut();
}
