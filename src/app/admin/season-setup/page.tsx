'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Season = {
  id: string;
  season_number: number;
  year: number;
  status: string;
  num_leagues: number;
  roster_size_per_league: number;
};

type League = {
  id: string;
  name: string;
  sleeper_league_id: string | null;
};

type Member = {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string | null;
  status: string;
};

type MemberSeason = {
  id: string;
  member_id: string;
  league_id: string;
  draft_position: number | null;
  onboard_status: string;
  sleeper_roster_id: string | null;
  sleeper_display_name: string | null;
};

type SleeperRosterInfo = {
  roster_id: string;
  display_name: string;
  team_name: string | null;
};

const DEFAULT_LEAGUE_NAMES = ['Sales', 'Accounting', 'Warehouse', 'HR'];

export default function SeasonSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [season, setSeason] = useState<Season | null>(null);
  const [nextSeasonNumber, setNextSeasonNumber] = useState(1);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSeasons, setMemberSeasons] = useState<MemberSeason[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 form
  const [year, setYear] = useState(new Date().getFullYear());
  const [numLeagues, setNumLeagues] = useState(2);
  const [leagueNames, setLeagueNames] = useState(DEFAULT_LEAGUE_NAMES.slice(0, 2));
  const [rosterSize, setRosterSize] = useState(10);

  // Step 2
  const [confirmations, setConfirmations] = useState<Record<string, 'confirmed' | 'declined' | 'pending'>>({});

  // Step 3
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Step 4
  const [draftOrders, setDraftOrders] = useState<Record<string, number>>({});

  // Step 5
  const [sleeperLinks, setSleeperLinks] = useState<Record<string, string>>({});
  const [sleeperRosters, setSleeperRosters] = useState<Record<string, SleeperRosterInfo[]>>({});
  const [rosterMappings, setRosterMappings] = useState<Record<string, { sleeper_roster_id: string; sleeper_display_name: string }>>({});

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/admin/setup');
    if (res.status === 401) {
      router.push('/admin');
      return;
    }
    const data = await res.json();
    setSeason(data.season);
    setNextSeasonNumber(data.nextSeasonNumber || 1);
    setLeagues(data.leagues || []);
    setMembers(data.members || []);
    setMemberSeasons(data.memberSeasons || []);

    // Initialize confirmations from members
    if (data.members) {
      const confs: Record<string, 'confirmed' | 'declined' | 'pending'> = {};
      for (const m of data.members) {
        confs[m.id] = m.status === 'active' ? 'pending' : 'declined';
      }
      setConfirmations(confs);
    }

    // Initialize sleeper links from existing leagues
    if (data.leagues) {
      const links: Record<string, string> = {};
      for (const l of data.leagues) {
        if (l.sleeper_league_id) links[l.id] = l.sleeper_league_id;
      }
      setSleeperLinks(links);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Determine current step based on season status
  function getCurrentStep(): number {
    if (!season) return 1;
    if (season.status === 'setup' && memberSeasons.length === 0) {
      return members.length > 0 ? 2 : 2;
    }
    if (season.status === 'setup') return 3;
    if (season.status === 'pre_draft') {
      const hasOrders = memberSeasons.some((ms) => ms.draft_position !== null);
      return hasOrders ? 4 : 4;
    }
    if (season.status === 'drafting' || season.status === 'active') return 5;
    return 1;
  }

  const currentStep = getCurrentStep();

  // Step 1: Create Season
  async function createSeason(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, numLeagues, leagueNames: leagueNames.slice(0, numLeagues), rosterSize }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Failed to create season');
      setSaving(false);
      return;
    }

    setSaving(false);
    fetchState();
  }

  // Step 2: Save intake
  async function saveIntake() {
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/setup/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, confirmations }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Failed to save intake');
    }

    setSaving(false);
    fetchState();
  }

  // Step 3: Randomize leagues
  async function randomizeLeagues() {
    setError('');
    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'randomize' }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Randomize failed');
      return;
    }

    const data = await res.json();
    setAssignments(data.assignments);
  }

  async function lockLeagues() {
    if (Object.keys(assignments).length === 0) {
      setError('Randomize first before locking');
      return;
    }
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'lock', assignments }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Lock failed');
      setSaving(false);
      return;
    }

    setSaving(false);
    fetchState();
  }

  // Step 4: Randomize draft order
  async function randomizeDraft() {
    setError('');
    const res = await fetch('/api/admin/setup/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'randomize' }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Randomize failed');
      return;
    }

    const data = await res.json();
    setDraftOrders(data.draftOrders);
  }

  async function lockDraft() {
    if (Object.keys(draftOrders).length === 0) {
      setError('Randomize draft order first');
      return;
    }
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/setup/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season!.id, action: 'lock', draftOrders }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Lock failed');
      setSaving(false);
      return;
    }

    setSaving(false);
    fetchState();
  }

  // Step 5: Fetch Sleeper rosters
  async function fetchSleeperRosters(leagueId: string, sleeperId: string) {
    const res = await fetch(`/api/admin/setup/sleeper?sleeper_league_id=${sleeperId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSleeperRosters((prev) => ({ ...prev, [leagueId]: data.rosters }));
  }

  async function saveSleeper() {
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/setup/sleeper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seasonId: season!.id,
        leagueLinks: sleeperLinks,
        rosterMappings,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || 'Save failed');
      setSaving(false);
      return;
    }

    setSaving(false);
    fetchState();
  }

  // Helpers
  const confirmedMembers = members.filter((m) => confirmations[m.id] === 'confirmed' || (confirmations[m.id] === 'pending' && m.status === 'active'));
  const targetCount = season ? season.num_leagues * season.roster_size_per_league : numLeagues * rosterSize;
  const confirmedCount = Object.values(confirmations).filter((v) => v === 'confirmed').length;

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  function getLeagueName(leagueId: string): string {
    const l = leagues.find((x) => x.id === leagueId);
    return l?.name || 'Unknown';
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  const steps = [
    { num: 1, label: 'Create Season' },
    { num: 2, label: 'Member Intake' },
    { num: 3, label: 'League Randomization' },
    { num: 4, label: 'Draft Order' },
    { num: 5, label: 'Sleeper Linking' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/admin" className="text-text-muted text-sm hover:text-white transition-colors">
          &larr; Back to Admin
        </Link>
        <h1 className="text-2xl font-extrabold text-white mt-1">Season Setup Wizard</h1>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {steps.map((s) => (
          <div
            key={s.num}
            className={`flex-1 text-center py-2 text-xs font-medium rounded ${
              s.num === currentStep
                ? 'bg-primary text-white'
                : s.num < currentStep || (season && s.num <= currentStep)
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'bg-bg-tertiary text-text-muted'
            }`}
          >
            {s.num}. {s.label}
          </div>
        ))}
      </div>

      {error && <p className="text-accent-red text-sm">{error}</p>}

      {/* Step 1: Create Season */}
      {!season && (
        <form onSubmit={createSeason} className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 1: Create Season</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Season Number</label>
              <input
                type="text"
                value={`Season ${nextSeasonNumber}`}
                disabled
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-text-muted text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">NFL Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Number of Leagues</label>
              <select
                value={numLeagues}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setNumLeagues(n);
                  setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, n));
                }}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Roster Size per League</label>
              <input
                type="number"
                value={rosterSize}
                onChange={(e) => setRosterSize(Number(e.target.value))}
                min={4}
                max={16}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-secondary mb-2">League Names</label>
            <div className="space-y-2">
              {leagueNames.slice(0, numLeagues).map((name, i) => (
                <input
                  key={i}
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const updated = [...leagueNames];
                    updated[i] = e.target.value;
                    setLeagueNames(updated);
                  }}
                  placeholder={`League ${i + 1}`}
                  className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
              ))}
            </div>
          </div>

          <p className="text-text-muted text-sm">
            Target: {numLeagues * rosterSize} members ({numLeagues} leagues x {rosterSize} per league)
          </p>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Season'}
          </button>
        </form>
      )}

      {/* Step 2: Member Intake */}
      {season && season.status === 'setup' && memberSeasons.length === 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 2: Member Intake</h2>

          <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
            confirmedCount === targetCount
              ? 'bg-accent-green/20 text-accent-green'
              : confirmedCount > targetCount
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-bg-tertiary text-text-secondary'
          }`}>
            {confirmedCount}/{targetCount} confirmed
            {confirmedCount < targetCount && ` — need ${targetCount - confirmedCount} more`}
            {confirmedCount > targetCount && ` — consider adding a league`}
          </div>

          {members.length === 0 ? (
            <p className="text-text-muted text-sm">
              No members yet. <Link href="/admin/members" className="text-primary hover:underline">Add members first</Link>, then come back here.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-tertiary/50">
                  <div>
                    <span className="text-white font-medium">{m.display_name || m.full_name}</span>
                    {m.display_name && (
                      <span className="text-text-muted text-xs ml-2">({m.full_name})</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {(['confirmed', 'pending', 'declined'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setConfirmations((prev) => ({ ...prev, [m.id]: status }))}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          confirmations[m.id] === status
                            ? status === 'confirmed'
                              ? 'bg-accent-green text-white'
                              : status === 'declined'
                                ? 'bg-accent-red text-white'
                                : 'bg-yellow-500 text-white'
                            : 'bg-bg-tertiary text-text-muted hover:text-white'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={saveIntake}
              disabled={saving || confirmedCount === 0}
              className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save & Continue to Step 3'}
            </button>
            <Link
              href="/admin/members"
              className="px-4 py-2 text-text-secondary hover:text-white transition-colors text-sm flex items-center"
            >
              + Add New Members
            </Link>
          </div>
        </div>
      )}

      {/* Step 3: League Randomization */}
      {season && season.status === 'setup' && currentStep >= 3 && memberSeasons.length === 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 3: League Randomization</h2>

          <div className="flex gap-3">
            <button
              onClick={randomizeLeagues}
              className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Randomize
            </button>
            {Object.keys(assignments).length > 0 && (
              <button
                onClick={randomizeLeagues}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg font-semibold hover:text-white transition-colors"
              >
                Re-roll
              </button>
            )}
          </div>

          {Object.keys(assignments).length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leagues.map((league) => {
                  const leagueMembers = Object.keys(assignments)
                    .filter((mid) => assignments[mid] === league.id)
                    .map((mid) => getMemberName(mid));

                  return (
                    <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                      <h3 className="font-bold text-white mb-2">{league.name}</h3>
                      <p className="text-text-muted text-xs mb-2">{leagueMembers.length} members</p>
                      <div className="space-y-1">
                        {leagueMembers.map((name, i) => (
                          <p key={i} className="text-text-secondary text-sm">{name}</p>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Manual override: move a member between leagues */}
              <details className="text-sm">
                <summary className="text-text-muted cursor-pointer hover:text-white">Manual Override</summary>
                <div className="mt-2 space-y-2">
                  {Object.keys(assignments).map((mid) => (
                    <div key={mid} className="flex items-center gap-2">
                      <span className="text-text-secondary w-40 truncate">{getMemberName(mid)}</span>
                      <select
                        value={assignments[mid]}
                        onChange={(e) => setAssignments((prev) => ({ ...prev, [mid]: e.target.value }))}
                        className="px-2 py-1 rounded bg-bg-tertiary border border-white/10 text-white text-xs"
                      >
                        {leagues.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </details>

              <button
                onClick={lockLeagues}
                disabled={saving}
                className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Locking...' : 'Lock League Assignments'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 4: Draft Order */}
      {season && season.status === 'pre_draft' && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 4: Draft Order</h2>

          <div className="flex gap-3">
            <button
              onClick={randomizeDraft}
              className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Randomize Draft Order
            </button>
            {Object.keys(draftOrders).length > 0 && (
              <button
                onClick={randomizeDraft}
                className="px-4 py-2 bg-bg-tertiary text-text-secondary rounded-lg font-semibold hover:text-white transition-colors"
              >
                Re-roll
              </button>
            )}
          </div>

          {Object.keys(draftOrders).length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {leagues.map((league) => {
                  const leagueMS = memberSeasons
                    .filter((ms) => ms.league_id === league.id)
                    .sort((a, b) => (draftOrders[a.id] || 0) - (draftOrders[b.id] || 0));

                  return (
                    <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                      <h3 className="font-bold text-white mb-2">{league.name}</h3>
                      <div className="space-y-1">
                        {leagueMS.map((ms) => (
                          <div key={ms.id} className="flex items-center gap-2">
                            <span className="text-accent-gold font-mono text-sm w-6">
                              {draftOrders[ms.id] || '?'}.
                            </span>
                            <span className="text-text-secondary text-sm">
                              {getMemberName(ms.member_id)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={lockDraft}
                disabled={saving}
                className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? 'Locking...' : 'Lock Draft Order & Generate Pick Slots'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Step 5: Sleeper Linking */}
      {season && (season.status === 'drafting' || season.status === 'active' || season.status === 'pre_draft') && currentStep >= 5 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Step 5: Link Sleeper Leagues</h2>
          <p className="text-text-muted text-sm">
            Enter the Sleeper league IDs for each league, then map rosters to members.
          </p>

          {leagues.map((league) => (
            <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
              <h3 className="font-bold text-white">{league.name}</h3>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={sleeperLinks[league.id] || ''}
                  onChange={(e) => setSleeperLinks((prev) => ({ ...prev, [league.id]: e.target.value }))}
                  placeholder="Sleeper League ID"
                  className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    const sid = sleeperLinks[league.id];
                    if (sid) fetchSleeperRosters(league.id, sid);
                  }}
                  disabled={!sleeperLinks[league.id]}
                  className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                >
                  Fetch Rosters
                </button>
              </div>

              {/* Roster mapping */}
              {sleeperRosters[league.id] && (
                <div className="space-y-2">
                  <p className="text-text-muted text-xs">Map each Sleeper roster to a member:</p>
                  {memberSeasons
                    .filter((ms) => ms.league_id === league.id)
                    .map((ms) => (
                      <div key={ms.id} className="flex items-center gap-2">
                        <span className="text-text-secondary text-sm w-40 truncate">
                          {getMemberName(ms.member_id)}
                        </span>
                        <select
                          value={rosterMappings[ms.id]?.sleeper_roster_id || ''}
                          onChange={(e) => {
                            const roster = sleeperRosters[league.id].find(
                              (r) => r.roster_id === e.target.value
                            );
                            if (roster) {
                              setRosterMappings((prev) => ({
                                ...prev,
                                [ms.id]: {
                                  sleeper_roster_id: roster.roster_id,
                                  sleeper_display_name: roster.display_name,
                                },
                              }));
                            }
                          }}
                          className="flex-1 px-2 py-1 rounded bg-bg-tertiary border border-white/10 text-white text-xs"
                        >
                          <option value="">Select roster...</option>
                          {sleeperRosters[league.id].map((r) => (
                            <option key={r.roster_id} value={r.roster_id}>
                              {r.display_name} {r.team_name ? `(${r.team_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}

          <button
            onClick={saveSleeper}
            disabled={saving || Object.keys(sleeperLinks).length === 0}
            className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Sleeper Links'}
          </button>
        </div>
      )}

      {/* Completed state */}
      {season && (season.status === 'active' || season.status === 'completed') && (
        <div className="glass-card p-6 text-center">
          <p className="text-accent-green text-lg font-bold">Season {season.season_number} is set up!</p>
          <p className="text-text-muted text-sm mt-2">
            Status: {season.status} | {leagues.length} leagues | {memberSeasons.length} members assigned
          </p>
        </div>
      )}
    </div>
  );
}
