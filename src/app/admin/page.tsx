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
  registering: 'Registering',
  confirming: 'Confirming',
  pre_draft: 'Pre-Draft',
  drafting: 'Drafting',
  active: 'Active',
  playoffs: 'Playoffs',
  completed: 'Completed',
  archived: 'Archived',
};

const PHASE_ORDER: SeasonStatusValue[] = [
  'setup',
  'registering',
  'confirming',
  'pre_draft',
  'drafting',
  'active',
  'playoffs',
  'completed',
  'archived',
];

const WIZARD_STEPS = [
  { label: 'Cohorts & Invites', path: '/admin/season-setup', phases: ['setup', 'registering'] },
  { label: 'Review Registration', path: '/admin/season-setup', phases: ['registering', 'confirming'] },
  { label: 'Seasons & Leagues', path: '/admin/season-setup', phases: ['setup', 'confirming'] },
  { label: 'Draft Order', path: '/admin/season-setup', phases: ['pre_draft'] },
  { label: 'Sleeper Linking', path: '/admin/season-setup', phases: ['pre_draft', 'drafting'] },
  { label: 'Link Drafts', path: '/admin/season-setup', phases: ['drafting', 'active'] },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Burning the midnight oil, Commissioner';
  if (h < 12) return 'Good morning, Commissioner';
  if (h < 17) return 'Good afternoon, Commissioner';
  return 'Good evening, Commissioner';
}

export default function AdminPage() {
  const [mode, setMode] = useState<AuthMode>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

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

  // ============================================================
  // AUTH SCREENS
  // ============================================================
  if (mode === 'checking') {
    return (
      <div className="wrap" style={{ paddingTop: 120, paddingBottom: 120 }}>
        <div className="flex items-center justify-center">
          <p className="label">Loading...</p>
        </div>
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="flex items-center justify-center">
          <form onSubmit={handleSetup} className="surface-raised" style={{ padding: 32, width: '100%', maxWidth: 400 }}>
            <h1
              className="font-display"
              style={{
                fontSize: 32, letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)', textAlign: 'center', textTransform: 'uppercase', marginBottom: 8,
              }}
            >
              Create Account
            </h1>
            <p className="label" style={{ textAlign: 'center', marginBottom: 24 }}>
              First-time setup — create your commissioner account
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="btn" style={{ width: '100%', height: 40, justifyContent: 'flex-start' }} autoFocus required />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="btn" style={{ width: '100%', height: 40, justifyContent: 'flex-start' }} required />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="btn" style={{ width: '100%', height: 40, justifyContent: 'flex-start' }} minLength={8} required />
              {error && <p className="label" style={{ color: 'var(--accent-danger)', textAlign: 'center' }}>{error}</p>}
              <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
                Create Account
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (mode === 'login') {
    return (
      <div className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div className="flex items-center justify-center">
          <form onSubmit={handleLogin} className="surface-raised" style={{ padding: 32, width: '100%', maxWidth: 400 }}>
            <h1
              className="font-display"
              style={{
                fontSize: 32, letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)', textAlign: 'center', textTransform: 'uppercase', marginBottom: 24,
              }}
            >
              Commissioner Login
            </h1>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="btn" style={{ width: '100%', height: 40, justifyContent: 'flex-start' }} autoFocus required />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="btn" style={{ width: '100%', height: 40, justifyContent: 'flex-start' }} required />
              {error && <p className="label" style={{ color: 'var(--accent-danger)', textAlign: 'center' }}>{error}</p>}
              <button type="submit" className="btn btn--primary btn--lg" style={{ width: '100%', justifyContent: 'center' }}>
                Log In
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ============================================================
  // COMMAND CENTER
  // ============================================================
  const currentPhaseIdx = season ? PHASE_ORDER.indexOf(season.status as SeasonStatusValue) : -1;
  const nextPhase = season ? (SEASON_STATUS_TRANSITIONS[season.status as SeasonStatusValue] || [])[0] : null;
  const confirmedCount = cohorts.reduce((n, c) => n + (c.season_registrations?.[0]?.count || 0), 0);
  const attentionCount = cohorts.filter((c) => c.status === 'open').length;

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <Link href="/admin">COMMAND CENTER</Link>
        {season && (
          <>
            <span className="sep">·</span>
            <b>{season.year} SEASON</b>
          </>
        )}
      </div>

      <div className="wrap">
        <section className="cc-head">
          <div>
            <div className="lab">
              {season ? `Season ${season.season_number} · ${season.year}` : 'No active season'}
            </div>
            <h1>{greeting().split(', ')[0]}, <span style={{ color: 'var(--accent-live)' }}>Commissioner.</span></h1>
          </div>
          <div className="cc-head__actions">
            {season && (
              <span className={`phase-pill phase-pill--${season.status.replace('_', '-')}`}>
                {PHASE_LABELS[season.status]}
              </span>
            )}
            <button type="button" onClick={handleLogout} className="btn btn--ghost btn--sm">
              Log out
            </button>
          </div>
        </section>

        {/* Pipeline */}
        {season ? (
          <section className="pipe-wrap">
            <div className="pipe-info">
              <span className="pipe-info__lab">Current Phase</span>
              <span className="pipe-info__val">{PHASE_LABELS[season.status]}</span>
              <span className="pipe-info__sub">
                Phase {currentPhaseIdx + 1} of {PHASE_ORDER.length}
                {nextPhase ? ` · Next: ${PHASE_LABELS[nextPhase]}` : ''}
              </span>
            </div>
            <div className="pipeline">
              {PHASE_ORDER.map((p, i) => {
                const state = i < currentPhaseIdx ? 'pipe--done' : i === currentPhaseIdx ? 'pipe--active' : '';
                return (
                  <div key={p} className={`pipe ${state}`}>
                    <span className="pipe__ix">0{i + 1}</span>
                    <span>{PHASE_LABELS[p]}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="card" style={{ marginTop: 24 }}>
            <h2 className="card__title">No Active Season</h2>
            <p style={{ color: 'var(--ink-6)' }}>Create a season to get started.</p>
            <Link href="/admin/season-setup" className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
              Start season setup →
            </Link>
          </section>
        )}

        {/* Body */}
        <div className="cc-body">
          {/* Tile row */}
          <div className="c-tiles" style={{ gridColumn: 'span 12' }}>
            <div className="tiles">
              <div className="tile tile--live">
                <span className="tile__lab">Registered</span>
                <span className="tile__val">{confirmedCount}</span>
                <span className="tile__sub">Across {cohorts.length} cohort{cohorts.length === 1 ? '' : 's'}</span>
              </div>
              <div className={`tile ${attentionCount > 0 ? 'tile--attn' : ''}`}>
                <span className="tile__lab">Open Cohorts</span>
                <span className="tile__val">{attentionCount}</span>
                <span className="tile__sub">
                  {attentionCount > 0 ? 'Collecting sign-ups' : 'Closed · ready to advance'}
                </span>
              </div>
              <div className="tile">
                <span className="tile__lab">Leagues</span>
                <span className="tile__val">{leagueHealth.length}</span>
                <span className="tile__sub">
                  {leagueHealth.filter((l) => l.sleeperLinked).length} Sleeper-linked
                </span>
              </div>
              <div className="tile">
                <span className="tile__lab">Recent Activity</span>
                <span className="tile__val">{recentRegs.length}</span>
                <span className="tile__sub">Registrations this feed</span>
              </div>
            </div>
          </div>

          {/* Cohorts */}
          {cohorts.length > 0 && (
            <div className="card" style={{ gridColumn: 'span 7' }}>
              <header className="card__head">
                <span className="card__title">Cohorts</span>
                <Link href="/admin/season-setup" className="card__link">Manage →</Link>
              </header>
              <div className="cohorts">
                {cohorts.map((cohort) => {
                  const regCount = cohort.season_registrations?.[0]?.count || 0;
                  const maxCap = (cohort.settings?.maxCapacity as number | undefined) ?? null;
                  const pct = maxCap ? Math.min(100, (regCount / maxCap) * 100) : 0;
                  return (
                    <button
                      key={cohort.id}
                      type="button"
                      onClick={() =>
                        setExpandedCohort(expandedCohort === cohort.id ? null : cohort.id)
                      }
                      className="coh"
                      style={{ borderLeft: `3px solid ${cohort.color}` }}
                    >
                      <div className="coh__head">
                        <div>
                          <div className="coh__name">{cohort.name}</div>
                          <div className="coh__token">{cohort.invite_token}</div>
                        </div>
                        <span
                          className={
                            cohort.status === 'open' ? 'chip chip--live' : 'chip'
                          }
                        >
                          {cohort.status}
                        </span>
                      </div>
                      <div className="coh__grid">
                        <div className="coh__cell">
                          <span className="v">{regCount}</span>
                          <span className="l">REG</span>
                        </div>
                        <div className="coh__cell">
                          <span className="v">{maxCap ?? '—'}</span>
                          <span className="l">CAP</span>
                        </div>
                        <div className="coh__cell">
                          <span className="v">{maxCap ? `${Math.round(pct)}%` : '—'}</span>
                          <span className="l">FULL</span>
                        </div>
                      </div>
                      {maxCap && (
                        <div className="coh__bar">
                          <div className="coh__bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Activity feed */}
          {recentRegs.length > 0 && (
            <div className="card" style={{ gridColumn: 'span 5' }}>
              <header className="card__head">
                <span className="card__title">Activity</span>
                <span className="label">Last {recentRegs.length}</span>
              </header>
              <div className="feed" style={{ maxHeight: 320, overflowY: 'auto' }}>
                {recentRegs.map((reg) => {
                  const dotVar =
                    reg.status === 'confirmed'
                      ? 'feed__dot--live'
                      : reg.status === 'waitlisted'
                        ? 'feed__dot--clock'
                        : '';
                  return (
                    <div key={reg.id} className="feed__row">
                      <span className={`feed__dot ${dotVar}`} />
                      <div>
                        <div className="feed__text">
                          <b>{reg.members?.display_name || reg.members?.full_name || 'Unknown'}</b>{' '}
                          <span style={{ color: 'var(--ink-5)' }}>→ {reg.cohortName}</span>
                        </div>
                        <div className="feed__text mono" style={{ marginTop: 2 }}>
                          {reg.status}
                        </div>
                      </div>
                      <span className="feed__time">
                        {new Date(reg.registered_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* League health */}
          {leagueHealth.length > 0 && (
            <div className="card" style={{ gridColumn: 'span 7' }}>
              <header className="card__head">
                <span className="card__title">League Health</span>
                <Link href="/admin/situation-room" className="card__link">Situation Room →</Link>
              </header>
              <div className="health">
                {leagueHealth.map((league) => (
                  <div
                    key={league.id}
                    className="hl"
                    style={{ borderLeft: `3px solid ${league.color}` }}
                  >
                    <div>
                      <div className="hl__name">{league.name}</div>
                      <div className="hl__meta">
                        {league.memberCount} members · DRAFT {league.draftStatus.toUpperCase()}
                        {league.sleeperLinked ? ' · LINKED' : ''}
                      </div>
                      {league.leader && league.leaderName && (
                        <div className="hl__leader" style={{ marginTop: 4 }}>
                          Leader: <b>{league.leaderName}</b> ({league.leader.record})
                        </div>
                      )}
                    </div>
                    <span
                      className={
                        league.draftStatus === 'drafting'
                          ? 'chip chip--live'
                          : league.draftStatus === 'completed'
                            ? 'chip'
                            : league.draftStatus === 'pending'
                              ? 'chip chip--clock'
                              : 'chip'
                      }
                    >
                      {league.draftStatus === 'drafting' && <span className="livedot" />}
                      {league.draftStatus === 'none' ? 'not created' : league.draftStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="card" style={{ gridColumn: 'span 5' }}>
            <header className="card__head">
              <span className="card__title">Quick Actions</span>
            </header>
            <div className="qa-list">
              <Link href="/admin/season-setup" className="qa">
                <span className="qa__title">Season Setup</span>
                <span className="qa__desc">Cohorts · Leagues · Draft order</span>
              </Link>
              <Link href="/admin/draft" className="qa">
                <span className="qa__title">Draft Board</span>
                <span className="qa__desc">Live drafts</span>
              </Link>
              <Link href="/admin/situation-room" className="qa">
                <span className="qa__title">Situation Room</span>
                <span className="qa__desc">Multi-draft monitor</span>
              </Link>
              <Link href="/admin/bracket" className="qa">
                <span className="qa__title">Bracket</span>
                <span className="qa__desc">Playoff seeding · scores</span>
              </Link>
              <Link href="/admin/members" className="qa">
                <span className="qa__title">Members</span>
                <span className="qa__desc">Roster · emails</span>
              </Link>
              <Link href="/admin/recaps" className="qa">
                <span className="qa__title">Recaps</span>
                <span className="qa__desc">Weekly & season</span>
              </Link>
            </div>

            {season &&
              nextPhase &&
              !['setup', 'registering', 'confirming', 'pre_draft', 'drafting'].includes(
                season.status,
              ) && (
                <button
                  type="button"
                  onClick={() => {
                    if (nextPhase === 'archived') {
                      router.push('/admin/archive');
                    } else {
                      setConfirmAdvance(true);
                    }
                  }}
                  disabled={advancing}
                  className="btn btn--primary"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                >
                  {advancing
                    ? 'Advancing...'
                    : `Advance → ${PHASE_LABELS[nextPhase]}`}
                </button>
              )}
          </div>

          {/* Setup Wizard steps */}
          {season && (
            <div className="card" style={{ gridColumn: 'span 12' }}>
              <header className="card__head">
                <span className="card__title">Setup Wizard</span>
                <Link href="/admin/season-setup" className="card__link">Open wizard →</Link>
              </header>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: 8,
                }}
              >
                {WIZARD_STEPS.map((step, i) => {
                  const isReachable = step.phases.includes(season.status);
                  return (
                    <Link
                      key={i}
                      href={isReachable ? step.path : '#'}
                      className="qa"
                      onClick={(e) => {
                        if (!isReachable) e.preventDefault();
                      }}
                      style={{
                        opacity: isReachable ? 1 : 0.35,
                        cursor: isReachable ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <span className="qa__title">
                        {String(i + 1).padStart(2, '0')} · {step.label}
                      </span>
                      <span className="qa__desc">
                        {isReachable ? 'AVAILABLE' : 'LOCKED'}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Backfill / utility */}
          <div className="card" style={{ gridColumn: 'span 12' }}>
            <header className="card__head">
              <span className="card__title">Utilities</span>
            </header>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div style={{ color: 'var(--ink-8)', fontWeight: 600 }}>
                  Backfill Weekly Results
                </div>
                <div style={{ color: 'var(--ink-6)', fontSize: 'var(--fs-12)' }}>
                  Pull historical weekly scores from Sleeper into the database.
                </div>
              </div>
              <button
                type="button"
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
                      setBackfillResult(`Done — ${data.weeksBackfilled} weeks backfilled.`);
                    } else {
                      setBackfillResult(data.error || 'Backfill failed');
                    }
                  } catch {
                    setBackfillResult('Network error');
                  }
                  setBackfilling(false);
                }}
                disabled={backfilling}
                className="btn"
              >
                {backfilling ? 'Running...' : 'Run Backfill'}
              </button>
            </div>
            {backfillResult && (
              <p
                className="label"
                style={{
                  color: backfillResult.startsWith('Done')
                    ? 'var(--accent-live)'
                    : 'var(--accent-danger)',
                }}
              >
                {backfillResult}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Confirm advance modal */}
      {confirmAdvance && season && nextPhase && (() => {
        const ADVANCE_MESSAGES: Record<string, string> = {
          'active→playoffs':
            'Are you sure? This will end the regular season. Make sure all weekly results are synced.',
          'playoffs→completed':
            'Are you sure? This marks the season as complete. Run the bracket and confirm the champion first.',
        };
        const key = `${season.status}→${nextPhase}`;
        const msg =
          ADVANCE_MESSAGES[key] ||
          `Advance from ${PHASE_LABELS[season.status]} to ${PHASE_LABELS[nextPhase]}?`;
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

      {expandedCohort &&
        (() => {
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
    </>
  );
}
