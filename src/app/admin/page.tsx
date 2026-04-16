'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SEASON_STATUS_TRANSITIONS, type SeasonStatusValue } from '@/config/constants';
import CohortDetailPanel from '@/components/admin/CohortDetailPanel';
import ConfirmModal from '@/components/admin/ConfirmModal';

type AuthMode = 'checking' | 'setup' | 'login' | 'authed';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
  num_leagues: number;
  roster_size_per_league: number;
};

type Cohort = {
  id: string;
  name: string;
  color: string;
  status: string;
  invite_token: string;
  settings: Record<string, unknown>;
  season_registrations: { count: number }[];
};

type Registration = {
  id: string;
  status: string;
  registered_at: string;
  cohort_id: string;
  cohortName: string;
  cohortColor: string;
  members: { full_name: string; display_name: string | null; email: string };
};

type LeagueHealth = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  memberCount: number;
  draftStatus: string;
  sleeperLinked: boolean;
  leader: { record: string; pointsFor: number } | null;
  leaderName: string | null;
};

const PHASE_LABELS: Record<string, string> = {
  setup: 'Setup',
  registering: 'Registration',
  confirming: 'Confirmation',
  pre_draft: 'Pre-Draft',
  drafting: 'Drafting',
  active: 'Active',
  playoffs: 'Playoffs',
  completed: 'Complete',
  archived: 'Archived',
};

const PHASE_ORDER = ['setup', 'registering', 'confirming', 'pre_draft', 'drafting', 'active', 'playoffs', 'completed'];

const WIZARD_STEPS = [
  { label: 'Create Season', path: '/admin/season-setup', phases: ['setup'] },
  { label: 'Cohorts & Invites', path: '/admin/season-setup', phases: ['setup', 'registering'] },
  { label: 'Registration', path: '/admin/season-setup', phases: ['registering', 'confirming'] },
  { label: 'League Assignment', path: '/admin/season-setup', phases: ['setup', 'confirming'] },
  { label: 'Draft Setup', path: '/admin/season-setup', phases: ['pre_draft'] },
  { label: 'Sleeper Linking', path: '/admin/season-setup', phases: ['drafting', 'active', 'pre_draft'] },
];

export default function AdminPage() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  // Dashboard data
  const [season, setSeason] = useState<Season | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [recentRegs, setRecentRegs] = useState<Registration[]>([]);
  const [leagueHealth, setLeagueHealth] = useState<LeagueHealth[]>([]);
  const [expandedCohort, setExpandedCohort] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/admin/season')
      .then((res) => {
        if (res.ok) {
          setMode('authed');
        } else {
          return fetch('/api/admin/auth', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: '', password: '', displayName: '' }),
          }).then((setupRes) => {
            setMode(setupRes.status === 409 ? 'login' : 'setup');
          });
        }
      })
      .catch(() => setMode('login'));
  }, []);

  const fetchDashboard = useCallback(async () => {
    const res = await fetch('/api/admin/dashboard');
    if (!res.ok) return;
    const data = await res.json();
    setSeason(data.season);
    setCohorts(data.cohorts || []);
    setRecentRegs(data.recentRegistrations || []);
    setLeagueHealth(data.leagueHealth || []);
  }, []);

  useEffect(() => {
    if (mode === 'authed') fetchDashboard();
  }, [mode, fetchDashboard]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) setMode('authed');
    else {
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
    if (res.ok) setMode('authed');
    else {
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

  async function advancePhase() {
    if (!season) return;
    const transitions = SEASON_STATUS_TRANSITIONS[season.status as SeasonStatusValue];
    if (!transitions || transitions.length === 0) return;
    const targetStatus = transitions[0];

    setAdvancing(true);
    const res = await fetch('/api/admin/season/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, targetStatus }),
    });
    setAdvancing(false);
    if (res.ok) fetchDashboard();
    else {
      const data = await res.json();
      setError(data.error || 'Failed to advance phase');
    }
  }

  // Auth screens
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
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary" autoFocus required />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary" minLength={8} required />
          {error && <p className="text-accent-red text-sm text-center">{error}</p>}
          <button type="submit" className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors">
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
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary" autoFocus required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
            className="w-full px-4 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white placeholder-text-muted focus:outline-none focus:border-primary" required />
          {error && <p className="text-accent-red text-sm text-center">{error}</p>}
          <button type="submit" className="w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Log In
          </button>
        </form>
      </div>
    );
  }

  // Authed — Command Center
  const currentPhaseIdx = season ? PHASE_ORDER.indexOf(season.status) : -1;
  const nextPhase = season ? (SEASON_STATUS_TRANSITIONS[season.status as SeasonStatusValue] || [])[0] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white">Commissioner Command Center</h1>
        <button onClick={handleLogout}
          className="px-3 py-1 text-sm text-text-muted hover:text-white border border-white/10 rounded-lg transition-colors">
          Log Out
        </button>
      </div>

      {/* 1A: Status Hero Banner */}
      {season && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">
                Season {season.season_number} &middot; {season.year}
              </h2>
              <p className="text-text-muted text-sm">
                {season.num_leagues} leagues &middot; {season.roster_size_per_league} per league
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary font-semibold">
                {PHASE_LABELS[season.status] || season.status}
              </span>
            </div>
          </div>

          {/* Reset Season link (only during wizard-managed phases) */}
          {['setup', 'registering', 'confirming', 'pre_draft', 'drafting'].includes(season.status) && (
            <Link href="/admin/season-setup" className="text-accent-red text-xs hover:underline">
              Reset Season
            </Link>
          )}

          {/* Phase pipeline */}
          <div className="flex items-center gap-1">
            {PHASE_ORDER.map((phase, i) => {
              const isActive = phase === season.status;
              const isComplete = i < currentPhaseIdx;
              const isFuture = i > currentPhaseIdx;

              return (
                <div key={phase} className="flex items-center flex-1">
                  <div className={`flex-1 h-2 rounded-full transition-all ${
                    isComplete ? 'bg-accent-green' :
                    isActive ? 'bg-primary animate-pulse' :
                    'bg-bg-tertiary'
                  }`} />
                  {i < PHASE_ORDER.length - 1 && (
                    <div className={`w-1 h-2 ${isComplete ? 'bg-accent-green' : 'bg-bg-tertiary'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {PHASE_ORDER.map((phase, i) => (
              <span key={phase} className={`text-[10px] ${
                phase === season.status ? 'text-primary font-semibold' :
                i < currentPhaseIdx ? 'text-accent-green' : 'text-text-muted'
              }`}>
                {PHASE_LABELS[phase]?.substring(0, 6)}
              </span>
            ))}
          </div>
        </div>
      )}

      {!season && (
        <div className="glass-card p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">No Active Season</h2>
          <p className="text-text-muted mb-4">Create a season to get started.</p>
          <Link href="/admin/season-setup"
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Start Season Setup
          </Link>
        </div>
      )}

      {/* 1B: Cohort Cards */}
      {cohorts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Cohorts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohorts.map((cohort) => {
              const regCount = cohort.season_registrations?.[0]?.count || 0;
              const maxCap = (cohort.settings?.maxCapacity as number) || null;

              return (
                <button
                  key={cohort.id}
                  onClick={() => setExpandedCohort(expandedCohort === cohort.id ? null : cohort.id)}
                  className="glass-card p-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                    <span className="text-white font-semibold">{cohort.name}</span>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      cohort.status === 'open' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {cohort.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-muted text-sm font-mono">
                      {regCount}{maxCap ? `/${maxCap}` : ''} registered
                    </span>
                  </div>
                  {maxCap && (
                    <div className="w-full bg-bg-tertiary rounded-full h-1.5 mt-2">
                      <div className="h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (regCount / maxCap) * 100)}%`, backgroundColor: cohort.color }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expanded cohort detail */}
      {expandedCohort && (() => {
        const cohort = cohorts.find((c) => c.id === expandedCohort);
        if (!cohort) return null;
        return (
          <CohortDetailPanel
            cohortId={cohort.id}
            cohortName={cohort.name}
            cohortColor={cohort.color}
            inviteToken={cohort.invite_token}
            seasonYear={season ? String(season.year) : ''}
            settings={cohort.settings}
            onClose={() => setExpandedCohort(null)}
          />
        );
      })()}

      {/* 1C: Registration Activity Feed */}
      {recentRegs.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Recent Registrations</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {recentRegs.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: reg.cohortColor }} />
                  <span className="text-white text-sm">
                    {reg.members?.display_name || reg.members?.full_name || 'Unknown'}
                  </span>
                  <span className="text-text-muted text-xs">{reg.cohortName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    reg.status === 'confirmed' ? 'bg-green-500/20 text-green-300' :
                    reg.status === 'waitlisted' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {reg.status}
                  </span>
                  <span className="text-text-muted text-xs">
                    {new Date(reg.registered_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1D: League Health Grid */}
      {leagueHealth.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">League Health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {leagueHealth.map((league) => (
              <div key={league.id} className="glass-card p-4" style={{ borderLeft: `3px solid ${league.color}` }}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-semibold">{league.name}</h4>
                  <span className="text-text-muted text-xs font-mono">{league.memberCount} members</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    league.draftStatus === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                    league.draftStatus === 'drafting' ? 'bg-green-500/20 text-green-300' :
                    league.draftStatus === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-white/5 text-text-muted'
                  }`}>
                    Draft: {league.draftStatus === 'none' ? 'Not Created' : league.draftStatus}
                  </span>
                  {league.sleeperLinked && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">Sleeper</span>
                  )}
                </div>
                {league.leader && league.leaderName && (
                  <p className="text-text-muted text-xs mt-2">
                    Leader: <span className="text-white">{league.leaderName}</span> ({league.leader.record})
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1E: Setup Wizard Progress */}
      {season && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Setup Wizard</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {WIZARD_STEPS.map((step, i) => {
              const isReachable = step.phases.includes(season.status);
              return (
                <Link
                  key={i}
                  href={isReachable ? step.path : '#'}
                  className={`p-3 rounded-lg text-center text-xs font-medium transition-colors ${
                    isReachable
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                  }`}
                  onClick={(e) => { if (!isReachable) e.preventDefault(); }}
                >
                  <div className="text-lg mb-1">{isReachable ? (i + 1) : '&#128274;'}</div>
                  {step.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirm advance modal */}
      {confirmAdvance && season && nextPhase && (() => {
        const ADVANCE_MESSAGES: Record<string, string> = {
          'active→playoffs': 'Are you sure? This will end the regular season. Make sure all weekly results are synced.',
          'playoffs→completed': 'Are you sure? This marks the season as complete. Run the bracket and confirm the champion first.',
        };
        const key = `${season.status}→${nextPhase}`;
        const msg = ADVANCE_MESSAGES[key] || `Advance from ${PHASE_LABELS[season.status]} to ${PHASE_LABELS[nextPhase]}?`;
        return (
          <ConfirmModal
            title="Advance Season Phase"
            message={msg}
            confirmLabel={`Advance to ${PHASE_LABELS[nextPhase]}`}
            variant={nextPhase === 'completed' ? 'danger' : 'safe'}
            onCancel={() => setConfirmAdvance(false)}
            onConfirm={() => {
              setConfirmAdvance(false);
              advancePhase();
            }}
          />
        );
      })()}

      {/* 1F: Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Advance Phase — hidden during wizard-managed statuses */}
          {season && nextPhase && ['setup', 'registering', 'confirming', 'pre_draft', 'drafting'].includes(season.status) && (
            <div className="glass-card p-4 text-left border-l-4 border-white/10">
              <h4 className="text-text-muted font-semibold text-sm">Season Phase</h4>
              <p className="text-text-muted text-xs mb-2">Season phase is managed by the Setup Wizard during initial setup.</p>
              <Link href="/admin/season-setup" className="text-primary text-xs hover:underline">Go to Setup Wizard</Link>
            </div>
          )}
          {season && nextPhase && !['setup', 'registering', 'confirming', 'pre_draft', 'drafting'].includes(season.status) && (
            <button
              onClick={() => {
                if (nextPhase === 'archived') {
                  router.push('/admin/archive');
                } else {
                  setConfirmAdvance(true);
                }
              }}
              disabled={advancing}
              className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-primary disabled:opacity-50"
            >
              <h4 className="text-white font-semibold text-sm">Advance Season Phase</h4>
              <p className="text-text-muted text-xs">
                {advancing ? 'Advancing...' : `${PHASE_LABELS[season.status]} → ${PHASE_LABELS[nextPhase]}`}
              </p>
            </button>
          )}

          <Link href="/admin/season-setup" className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-amber-500">
            <h4 className="text-white font-semibold text-sm">Season Setup</h4>
            <p className="text-text-muted text-xs">Cohorts, leagues, draft order</p>
          </Link>

          <Link href="/admin/draft" className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-green-500">
            <h4 className="text-white font-semibold text-sm">Draft Board</h4>
            <p className="text-text-muted text-xs">View and manage live drafts</p>
          </Link>

          <Link href="/admin/situation-room" className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-red-500">
            <h4 className="text-white font-semibold text-sm">Situation Room</h4>
            <p className="text-text-muted text-xs">
              {season && ['confirming', 'pre_draft'].includes(season.status)
                ? 'Track league enrollment & send invites'
                : 'Monitor all active drafts'}
            </p>
          </Link>

          <Link href="/admin/bracket" className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-blue-500">
            <h4 className="text-white font-semibold text-sm">Bracket Manager</h4>
            <p className="text-text-muted text-xs">Championship bracket setup</p>
          </Link>

          <Link href="/admin/members" className="glass-card p-4 text-left hover:bg-white/5 transition-colors border-l-4 border-purple-500">
            <h4 className="text-white font-semibold text-sm">Members</h4>
            <p className="text-text-muted text-xs">Manage league members</p>
          </Link>
        </div>
      </div>

      {/* Backfill */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold text-sm">Backfill Weekly Results</h4>
            <p className="text-text-muted text-xs">Pull all historical weekly scores from Sleeper into the database.</p>
          </div>
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
                  setBackfillResult(`Done! ${data.weeksBackfilled} weeks backfilled.`);
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
            {backfilling ? 'Running...' : 'Run Backfill'}
          </button>
        </div>
        {backfillResult && (
          <p className={`text-sm mt-2 ${backfillResult.startsWith('Done') ? 'text-green-300' : 'text-red-300'}`}>
            {backfillResult}
          </p>
        )}
      </div>
    </div>
  );
}
