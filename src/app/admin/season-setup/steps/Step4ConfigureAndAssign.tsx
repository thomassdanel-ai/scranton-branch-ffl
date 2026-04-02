'use client';

import { useState } from 'react';
import { DEFAULT_LEAGUE_NAMES } from '@/config/constants';
import type { Season, League, Member, MemberSeason, FlashFn } from '../page';

type Props = {
  season: Season;
  leagues: League[];
  members: Member[];
  memberSeasons: MemberSeason[];
  confirmedMemberCount: number;
  flash: FlashFn;
  onComplete: () => Promise<void>;
  isReview: boolean;
};

export default function Step4ConfigureAndAssign({
  season,
  leagues,
  members,
  memberSeasons,
  confirmedMemberCount,
  flash,
  onComplete,
  isReview,
}: Props) {
  // Sub-phase 4a: Configure leagues
  const defaultNumLeagues = Math.max(1, Math.min(4, Math.round(confirmedMemberCount / 10)));
  const defaultRosterSize = defaultNumLeagues > 0 ? Math.ceil(confirmedMemberCount / defaultNumLeagues) : 10;

  const [numLeagues, setNumLeagues] = useState(defaultNumLeagues);
  const [rosterSize, setRosterSize] = useState(Math.min(16, Math.max(4, defaultRosterSize)));
  const [leagueNames, setLeagueNames] = useState(DEFAULT_LEAGUE_NAMES.slice(0, defaultNumLeagues));
  const [configureSaving, setConfigureSaving] = useState(false);

  // Sub-phase 4b: Assign members
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [assignSaving, setAssignSaving] = useState(false);

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  // If member_seasons exist, show locked read-only view
  if (memberSeasons.length > 0) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Step 4: Configure & Assign Leagues</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            Locked
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">Leagues</p>
            <p className="text-white font-semibold">{leagues.length}</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">Roster Size</p>
            <p className="text-white font-semibold">{season.roster_size_per_league}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leagues.map((league) => {
            const leagueMembers = memberSeasons
              .filter((ms) => ms.league_id === league.id)
              .map((ms) => getMemberName(ms.member_id));
            return (
              <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                  <h3 className="font-bold text-white">{league.name}</h3>
                  <span className="text-text-muted text-xs">({leagueMembers.length})</span>
                </div>
                <div className="space-y-1">
                  {leagueMembers.map((name, i) => (
                    <p key={i} className="text-text-secondary text-sm">{name}</p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Sub-phase 4a: Configure leagues (when no leagues exist yet)
  if (leagues.length === 0) {
    const product = numLeagues * rosterSize;
    const diff = product - confirmedMemberCount;

    // Smart suggestions
    const suggestions: { leagues: number; size: number }[] = [];
    for (let l = 1; l <= 4; l++) {
      const s = Math.ceil(confirmedMemberCount / l);
      if (s >= 4 && s <= 16) {
        suggestions.push({ leagues: l, size: s });
      }
    }

    const handleConfigure = async (e: React.FormEvent) => {
      e.preventDefault();
      setConfigureSaving(true);

      // First activate confirmed members
      await fetch('/api/admin/setup/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: season.id }),
      });

      // Then create leagues
      const res = await fetch('/api/admin/setup/leagues/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonId: season.id,
          numLeagues,
          leagueNames: leagueNames.slice(0, numLeagues),
          rosterSize,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        flash(err.error || 'Failed to create leagues', 'error');
      } else {
        flash('Leagues created!', 'success');
        await onComplete();
      }
      setConfigureSaving(false);
    }

    const applySuggestion = (s: { leagues: number; size: number }) => {
      setNumLeagues(s.leagues);
      setRosterSize(s.size);
      setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, s.leagues));
    }

    return (
      <form onSubmit={handleConfigure} className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-white">Step 4: Configure Leagues</h2>

        <div className="text-sm font-medium px-3 py-2 rounded-lg bg-primary/10 text-primary">
          You have {confirmedMemberCount} confirmed member{confirmedMemberCount !== 1 ? 's' : ''}. Choose how to divide them into leagues.
        </div>

        {/* Smart suggestions */}
        {suggestions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {suggestions.map((s) => (
              <button
                key={`${s.leagues}-${s.size}`}
                type="button"
                onClick={() => applySuggestion(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  numLeagues === s.leagues && rosterSize === s.size
                    ? 'bg-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:text-white'
                }`}
              >
                {s.leagues} league{s.leagues !== 1 ? 's' : ''} &times; {s.size} players
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Number of Leagues</label>
            <select
              value={numLeagues}
              onChange={(e) => {
                const n = Number(e.target.value);
                setNumLeagues(n);
                setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, n));
                setRosterSize(Math.min(16, Math.max(4, Math.ceil(confirmedMemberCount / n))));
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

        {/* Headcount check */}
        {diff !== 0 && (
          <div className="text-sm px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300">
            Note: {numLeagues} &times; {rosterSize} = {product} slots but you have {confirmedMemberCount} confirmed member{confirmedMemberCount !== 1 ? 's' : ''}.
            {diff > 0
              ? ` ${diff} slot${diff !== 1 ? 's' : ''} will be unfilled.`
              : ` ${Math.abs(diff)} member${Math.abs(diff) !== 1 ? 's' : ''} will be unassigned.`}
          </div>
        )}

        <div>
          <label className="block text-sm text-text-secondary mb-2">League Names</label>
          <div className="space-y-2">
            {leagueNames.slice(0, numLeagues).map((name, i) => (
              <input
                key={i}
                type="text"
                value={name}
                onChange={(e) => {
                  const u = [...leagueNames];
                  u[i] = e.target.value;
                  setLeagueNames(u);
                }}
                placeholder={`League ${i + 1}`}
                className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={configureSaving}
          className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {configureSaving ? 'Creating...' : 'Create Leagues'}
        </button>
      </form>
    );
  }

  // Sub-phase 4b: Assign members to leagues
  async function randomizeLeagues() {
    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, action: 'randomize' }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Randomize failed', 'error');
      return;
    }
    const data = await res.json();
    setAssignments(data.assignments);
  }

  async function lockLeagues() {
    if (Object.keys(assignments).length === 0) {
      flash('Randomize first before locking', 'error');
      return;
    }
    setAssignSaving(true);
    const res = await fetch('/api/admin/setup/leagues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id, action: 'lock', assignments }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Lock failed', 'error');
    } else {
      flash('League assignments locked! Season advanced to pre_draft.', 'success');
    }
    setAssignSaving(false);
    await onComplete();
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 4b: Assign Members to Leagues</h2>
      <p className="text-text-muted text-sm">
        {confirmedMemberCount} members &rarr; {leagues.length} league{leagues.length !== 1 ? 's' : ''}
      </p>

      <div className="flex gap-3">
        <button
          onClick={randomizeLeagues}
          className="px-4 py-2 bg-accent-purple text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          {Object.keys(assignments).length > 0 ? 'Re-roll' : 'Randomize'}
        </button>
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
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.color }} />
                    <h3 className="font-bold text-white">{league.name}</h3>
                    <span className="text-text-muted text-xs">({leagueMembers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {leagueMembers.map((name, i) => (
                      <p key={i} className="text-text-secondary text-sm">{name}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={lockLeagues}
            disabled={assignSaving}
            className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {assignSaving ? 'Locking...' : 'Lock League Assignments'}
          </button>
        </>
      )}
    </div>
  );
}
