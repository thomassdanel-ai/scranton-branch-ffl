'use client';

import { useState } from 'react';
import type { Season, League, Member, MemberSeason, FlashFn } from '../page';

type Props = {
  season: Season;
  leagues: League[];
  members: Member[];
  memberSeasons: MemberSeason[];
  flash: FlashFn;
  onMutate: () => Promise<void>;
  isReview: boolean;
};

export default function Step4LeagueAssignment({
  season,
  leagues,
  members,
  memberSeasons,
  flash,
  onMutate,
  isReview,
}: Props) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [intakeDone, setIntakeDone] = useState(false);

  function getMemberName(memberId: string): string {
    const m = members.find((x) => x.id === memberId);
    return m?.display_name || m?.full_name || 'Unknown';
  }

  // If member_seasons exist, show locked read-only view
  if (memberSeasons.length > 0) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Step 4: League Assignment</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            Locked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {leagues.map((league) => {
            const leagueMembers = memberSeasons
              .filter((ms) => ms.league_id === league.id)
              .map((ms) => getMemberName(ms.member_id));
            return (
              <div key={league.id} className="p-4 rounded-lg bg-bg-tertiary/50">
                <h3 className="font-bold text-white mb-2">{league.name}</h3>
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

  // Active state: randomize and lock
  async function runIntake() {
    const res = await fetch('/api/admin/setup/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seasonId: season.id }),
    });
    if (res.ok) {
      setIntakeDone(true);
    }
  }

  async function randomizeLeagues() {
    if (!intakeDone) {
      await runIntake();
    }

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
    setSaving(true);
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
    setSaving(false);
    await onMutate();
  }

  return (
    <div className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 4: League Assignment</h2>
      <p className="text-text-muted text-sm">
        Randomize confirmed members into {leagues.length} league{leagues.length !== 1 ? 's' : ''}, then lock to proceed.
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
                  <h3 className="font-bold text-white mb-2">{league.name}</h3>
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
            disabled={saving}
            className="px-4 py-2 bg-accent-green text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Locking...' : 'Lock League Assignments'}
          </button>
        </>
      )}
    </div>
  );
}
