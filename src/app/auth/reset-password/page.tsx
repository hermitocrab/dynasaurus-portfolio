'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(false);

  const handleReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
    } else {
      setUpdated(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-3 text-5xl">🦕</div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Set a new password</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Choose a password you do not use elsewhere.</p>
        </div>

        {updated ? (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-6 text-center">
            <p className="text-sm text-[var(--color-text-primary)]">Password updated successfully.</p>
            <Link href="/" className="mt-4 inline-block text-sm text-[var(--color-accent)] hover:underline">Continue to DynaSaurus</Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="New password"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
            />
            {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-warm)] py-3 text-sm font-semibold text-black disabled:opacity-50"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
