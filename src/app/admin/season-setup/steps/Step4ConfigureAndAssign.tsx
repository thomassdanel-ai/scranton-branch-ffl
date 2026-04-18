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

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

export default function Step4ConfigureAndAssign({
  season,
  leagues,
  members,
  memberSeasons,
  confirmedMemberCount,
  flash,
  onComplete,
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
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Step 4: Configure &amp; Assign Leagues</h2>
          <span className="chip chip--success">Locked</span>
        </div>

        <div className="form-grid form-grid--2">
          <div className="stat-mini">
            <div className="stat-mini__lab">Leagues</div>
            <div className="stat-mini__val">{leagues.length}</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini__lab">Roster Size</div>
            <div className="stat-mini__val">{season.roster_size_per_league}</div>
          </div>
        </div>

        <div className="form-grid form-grid--2">
          {leagues.map((league) => {
            const leagueMembers = memberSeasons
              .filter((ms) => ms.league_id === league.id)
              .map((ms) => getMemberName(ms.member_id));
            return (
              <div key={league.id} className="subcard" style={cssVars({ '--dot-color': league.color })}>
                <div className="subcard__head">
                  <div className="subcard__title">
                    <span className="subcard__dot" />
                    <span>{league.name}</span>
                    <span className="subcard__meta">({leagueMembers.length})</span>
                  </div>
                </div>
                <div className="subcard__members">
                  {leagueMembers.map((name, i) => (
                    <div key={i} className="subcard__member">{name}</div>
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

      await fetch('/api/admin/setup/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: season.id }),
      });

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
    };

    const applySuggestion = (s: { leagues: number; size: number }) => {
      setNumLeagues(s.leagues);
      setRosterSize(s.size);
      setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, s.leagues));
    };

    return (
      <form onSubmit={handleConfigure} className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Step 4: Configure Leagues</h2>
        </div>

        <div className="info-panel info-panel--primary">
          You have {confirmedMemberCount} confirmed member{confirmedMemberCount !== 1 ? 's' : ''}. Choose how to divide them into leagues.
        </div>

        {suggestions.length > 0 && (
          <div className="row">
            {suggestions.map((s) => {
              const isOn = numLeagues === s.leagues && rosterSize === s.size;
              return (
                <button
                  key={`${s.leagues}-${s.size}`}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className={`sug-chip ${isOn ? 'sug-chip--on' : ''}`}
                >
                  {s.leagues} league{s.leagues !== 1 ? 's' : ''} &times; {s.size} players
                </button>
              );
            })}
          </div>
        )}

        <div className="form-grid form-grid--2">
          <div>
            <label className="form-label">Number of Leagues</label>
            <select
              value={numLeagues}
              onChange={(e) => {
                const n = Number(e.target.value);
                setNumLeagues(n);
                setLeagueNames(DEFAULT_LEAGUE_NAMES.slice(0, n));
                setRosterSize(Math.min(16, Math.max(4, Math.ceil(confirmedMemberCount / n))));
              }}
              className="sel"
              style={{ width: '100%', height: 32 }}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Roster Size per League</label>
            <input
              type="number"
              value={rosterSize}
              onChange={(e) => setRosterSize(Number(e.target.value))}
              min={4}
              max={16}
              className="inp"
            />
          </div>
        </div>

        {diff !== 0 && (
          <div className="info-panel info-panel--warning">
            Note: {numLeagues} &times; {rosterSize} = {product} slots but you have {confirmedMemberCount} confirmed member{confirmedMemberCount !== 1 ? 's' : ''}.
            {diff > 0
              ? ` ${diff} slot${diff !== 1 ? 's' : ''} will be unfilled.`
              : ` ${Math.abs(diff)} member${Math.abs(diff) !== 1 ? 's' : ''} will be unassigned.`}
          </div>
        )}

        <div>
          <label className="form-label">League Names</label>
          <div className="col col--sm">
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
                className="inp"
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={configureSaving}
          className="btn btn--primary"
          style={{ alignSelf: 'flex-start' }}
        >
          {configureSaving ? 'Creating\u2026' : 'Create Leagues'}
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
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 4b: Assign Members to Leagues</h2>
      </div>
      <p className="wiz-panel__sub">
        {confirmedMemberCount} members &rarr; {leagues.length} league{leagues.length !== 1 ? 's' : ''}
      </p>

      <div className="row">
        <button onClick={randomizeLeagues} className="btn">
          {Object.keys(assignments).length > 0 ? 'Re-roll' : 'Randomize'}
        </button>
      </div>

      {Object.keys(assignments).length > 0 && (
        <>
          <div className="form-grid form-grid--2">
            {leagues.map((league) => {
              const leagueMembers = Object.keys(assignments)
                .filter((mid) => assignments[mid] === league.id)
                .map((mid) => getMemberName(mid));
              return (
                <div key={league.id} className="subcard" style={cssVars({ '--dot-color': league.color })}>
                  <div className="subcard__head">
                    <div className="subcard__title">
                      <span className="subcard__dot" />
                      <span>{league.name}</span>
                      <span className="subcard__meta">({leagueMembers.length})</span>
                    </div>
                  </div>
                  <div className="subcard__members">
                    {leagueMembers.map((name, i) => (
                      <div key={i} className="subcard__member">{name}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={lockLeagues}
            disabled={assignSaving}
            className="btn btn--primary"
            style={{ alignSelf: 'flex-start' }}
          >
            {assignSaving ? 'Locking\u2026' : 'Lock League Assignments'}
          </button>
        </>
      )}
    </div>
  );
}
