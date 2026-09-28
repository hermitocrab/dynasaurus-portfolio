'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface Student {
  id: string;
  email: string;
  cefr_level: string;
  l1: string;
  created_at: string;
  tier: string;
  query_count: number;
}

interface AdminQuery {
  word: string | null;
  module: string | null;
  response: string | null;
  created_at: string;
}

export default function AdminDashboard({
  adminEmail,
  initialStudents,
}: {
  adminEmail: string;
  initialStudents: Student[];
}) {
  const [filter, setFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [queries, setQueries] = useState<AdminQuery[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [error, setError] = useState('');

  const loadQueries = async (userId: string) => {
    setSelectedStudent(userId);
    setLoadingQueries(true);
    setError('');

    try {
      const response = await fetch(`/api/admin/queries?user_id=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Unable to load queries.');
      setQueries(Array.isArray(result.queries) ? result.queries : []);
    } catch (loadError) {
      setQueries([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load queries.');
    } finally {
      setLoadingQueries(false);
    }
  };

  const filtered = initialStudents.filter((student) => (
    !filter
    || student.email.toLowerCase().includes(filter.toLowerCase())
    || student.cefr_level === filter
    || student.tier === filter
  ));

  return (
    <div className="min-h-screen bg-[#0D0D0F] text-[#F2F2F5]">
      <header className="flex items-center justify-between border-b border-[#2E2E33] bg-[#1A1A1E] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🦕</span>
          <div>
            <h1 className="text-lg font-bold">DynaSaurus Admin</h1>
            <p className="text-[10px] text-[#6B6B75]">{initialStudents.length} students</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-xs text-[#9E9EA6] hover:text-[#F2F2F5]">← Back to App</Link>
          <span className="text-xs text-[#6B6B75]">{adminEmail}</span>
        </div>
      </header>

      <div className="flex h-[calc(100vh-65px)]">
        <div className="flex w-96 flex-col border-r border-[#2E2E33]">
          <div className="border-b border-[#2E2E33] p-4">
            <input
              type="text"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by email, level, or tier…"
              className="w-full rounded-lg border border-[#2E2E33] bg-[#141417] px-3 py-2 text-xs text-[#F2F2F5] placeholder:text-[#6B6B75] focus:border-[#FF6B6B] focus:outline-none"
            />
            <div className="mt-2 flex gap-2">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level) => (
                <button
                  key={level}
                  onClick={() => setFilter(filter === level ? '' : level)}
                  className={`rounded px-2 py-0.5 text-[10px] ${filter === level ? 'bg-[#FF6B6B] text-black' : 'bg-[#141417] text-[#9E9EA6]'}`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {filtered.map((student) => (
              <button
                key={student.id}
                onClick={() => loadQueries(student.id)}
                className={`w-full border-b border-[#2E2E33] p-4 text-left transition-colors hover:bg-[#141417] ${
                  selectedStudent === student.id ? 'border-l-2 border-l-[#FF6B6B] bg-[#141417]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">{student.email || 'Unknown'}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] ${
                    student.tier === 'ultimate' ? 'bg-purple-500/15 text-purple-400'
                      : student.tier === 'premium' ? 'bg-blue-500/15 text-blue-400'
                        : student.tier === 'basic' ? 'bg-green-500/15 text-green-400'
                          : 'bg-[#2E2E33] text-[#9E9EA6]'
                  }`}>{student.tier}</span>
                </div>
                <div className="mt-1 flex gap-3 text-[10px] text-[#6B6B75]">
                  <span>{student.cefr_level || 'B1'}</span>
                  <span>L1: {student.l1 || 'en'}</span>
                  <span>{student.query_count} queries</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {!selectedStudent ? (
            <div className="py-20 text-center text-[#6B6B75]">
              <div className="mb-4 text-4xl">🦕</div>
              <p>Select a student to view their query history</p>
            </div>
          ) : (
            <div>
              <h2 className="mb-4 text-sm font-semibold">
                Query History — {initialStudents.find((student) => student.id === selectedStudent)?.email}
              </h2>
              {loadingQueries && <p className="py-8 text-center text-sm text-[#6B6B75]">Loading queries…</p>}
              {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
              {!loadingQueries && (
                <div className="space-y-2">
                  {queries.map((query, index) => (
                    <div key={`${query.created_at}-${index}`} className="rounded-lg border border-[#2E2E33] bg-[#1A1A1E] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-[#FF6B6B]">{query.word}</span>
                        <span className="text-[10px] text-[#6B6B75]">
                          {query.module} · {new Date(query.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="line-clamp-4 text-xs text-[#9E9EA6]">{query.response?.substring(0, 400)}</p>
                    </div>
                  ))}
                  {queries.length === 0 && !error && (
                    <p className="py-8 text-center text-sm text-[#6B6B75]">No queries yet</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
