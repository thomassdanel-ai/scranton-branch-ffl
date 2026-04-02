'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type AuthMode = 'checking' | 'setup' | 'login' | 'authed';

export default function AdminPage() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState('');

  useEffect(() => {
    // Check if already authed
    fetch('/api/admin/season')
      .then((res) => {
        if (res.ok) {
          setMode('authed');
        } else {
          // Check if any admin users exist (PUT to auth returns 409 if they do)
          return fetch('/api/admin/auth', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: '', password: '', displayName: '' }),
          }).then((setupRes) => {
            // 409 = admin exists, need login. 400 = no admin yet, show setup
            setMode(setupRes.status === 409 ? 'login' : 'setup');
          });
        }
      })
      .catch(() => setMode('login'));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      setMode('authed');
    } else {
      const data = await res.json();
      setError(data.error || 'Login failed');
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (res.ok) {
      setMode('authed');
    } else {
      const data = await res.json();
      setError(data.error || 'Setup failed');
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/auth', { method: 'DELETE' });
    setMode('login');
    setEmail('');
    setPassword('');
  }

  if (mode === 'checking') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={handleSetup} className="glass-card p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white text-center">Create Admin Account</h1>
          <p className="text-text-muted text-sm text-center">First-time setup. Create your commissioner account.</p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            autoFocus
            required
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            minLength={8}
            required
          />
          {error && <p className="text-accent-red text-sm text-center">{error}</p>}
          <button
            type="submit"
            className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
          >
            Create Account
          </button>
        </form>
      </div>
    );
  }

  if (mode === 'login') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <form onSubmit={handleLogin} className="glass-card p-8 w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-white text-center">Commissioner Login</h1>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            autoFocus
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary"
            required
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Commissioner Panel</h1>
        <button
          onClick={handleLogout}
          className="px-3 py-1 text-sm text-text-muted hover:text-white border border-white/10 rounded-lg transition-colors"
        >
          Log Out
        </button>
      </div>

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
