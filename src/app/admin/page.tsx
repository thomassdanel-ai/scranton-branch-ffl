'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState('');

  useEffect(() => {
    // Check if already authed by trying to hit a protected endpoint
    fetch('/api/admin/season')
      .then((res) => {
        if (res.ok) setAuthed(true);
      })
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
    } else {
      setError('Wrong password');
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={handleLogin} className="glass-card p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white text-center">Commissioner Login</h1>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            autoFocus
          />
          {error && <p className="text-accent-red text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            Log In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-white">Commissioner Panel</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/admin/members" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Members</h2>
          <p className="text-text-muted text-sm">Manage league members, view history</p>
        </Link>

        <Link href="/admin/season" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Season Management</h2>
          <p className="text-text-muted text-sm">Update league IDs, switch seasons</p>
        </Link>

        <Link href="/admin/bracket" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Bracket Manager</h2>
          <p className="text-text-muted text-sm">Seed bracket, input matchup results</p>
        </Link>

        <Link href="/admin/archive" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Archive Season</h2>
          <p className="text-text-muted text-sm">Snapshot season for historical record</p>
        </Link>

        <Link href="/admin/season-setup" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Season Setup Wizard</h2>
          <p className="text-text-muted text-sm">Create season, intake, randomize, draft order</p>
        </Link>

        <Link href="/admin/draft" className="glass-card p-6 hover:bg-white/5 transition-colors">
          <h2 className="font-bold text-white mb-1">Draft Board</h2>
          <p className="text-text-muted text-sm">Run live snake drafts, mock drafts</p>
        </Link>
      </div>

      {/* Backfill Data */}
      <div className="glass-card p-6 space-y-3">
        <h2 className="font-bold text-white">Backfill Weekly Results</h2>
        <p className="text-text-muted text-sm">Pull all historical weekly scores from Sleeper and bracket results into the database. Safe to run multiple times.</p>
        <button
          onClick={async () => {
            setBackfilling(true);
            setBackfillResult('');
            try {
              const res = await fetch('/api/admin/backfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
              });
              const data = await res.json();
              if (res.ok) {
                const leagueSummary = Object.entries(data.leagues || {})
                  .map(([name, info]) => `${name}: ${(info as { rows: number }).rows} rows`)
                  .join(', ');
                setBackfillResult(`Done! ${data.weeksBackfilled} weeks. ${leagueSummary}. Bracket: ${data.bracketResults} rows.`);
              } else {
                setBackfillResult(data.error || 'Backfill failed');
              }
            } catch {
              setBackfillResult('Network error');
            }
            setBackfilling(false);
          }}
          disabled={backfilling}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {backfilling ? 'Backfilling...' : 'Run Backfill'}
        </button>
        {backfillResult && (
          <p className={`text-sm ${backfillResult.startsWith('Done') ? 'text-green-300' : 'text-red-300'}`}>
            {backfillResult}
          </p>
        )}
      </div>
    </div>
  );
}
