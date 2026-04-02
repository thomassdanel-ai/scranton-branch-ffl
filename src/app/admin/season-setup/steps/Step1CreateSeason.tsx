'use client';

import { useState } from 'react';
import { DEFAULT_LEAGUE_NAMES } from '@/config/constants';
import type { Season, League, FlashFn } from '../page';

type Props = {
  season: Season | null;
  nextSeasonNumber: number;
  leagues: League[];
  flash: FlashFn;
  onMutate: () => Promise<void>;
  isReview: boolean;
};

export default function Step1CreateSeason({ season, nextSeasonNumber, leagues, flash, onMutate, isReview }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [numLeagues, setNumLeagues] = useState(2);
  const [leagueNames, setLeagueNames] = useState(DEFAULT_LEAGUE_NAMES.slice(0, 2));
  const [rosterSize, setRosterSize] = useState(10);
  const [saving, setSaving] = useState(false);

  // If season exists, show read-only summary
  if (season) {
    return (
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Step 1: Create Season</h2>
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            Season Created
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">Season</p>
            <p className="text-white font-semibold">Season {season.season_number}</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">NFL Year</p>
            <p className="text-white font-semibold">{season.year}</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">Leagues</p>
            <p className="text-white font-semibold">{season.num_leagues}</p>
          </div>
          <div className="p-3 rounded-lg bg-bg-tertiary/50">
            <p className="text-text-muted text-xs">Roster Size</p>
            <p className="text-white font-semibold">{season.roster_size_per_league}</p>
          </div>
        </div>

        {leagues.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {leagues.map((l) => (
              <span
                key={l.id}
                className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: l.color + '33', borderColor: l.color, borderWidth: 1 }}
              >
                {l.name}
              </span>
            ))}
          </div>
        )}

        {!isReview && (
          <p className="text-text-muted text-sm">
            Continue to Cohorts &amp; Invites to set up registration.
          </p>
        )}
      </div>
    );
  }

  // No season — show creation form
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year,
        numLeagues,
        leagueNames: leagueNames.slice(0, numLeagues),
        rosterSize,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Failed to create season', 'error');
      setSaving(false);
      return;
    }

    flash(`Season ${nextSeasonNumber} created!`, 'success');
    setSaving(false);
    await onMutate();
  }

  return (
    <form onSubmit={handleCreate} className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 1: Create Season</h2>
      <p className="text-text-muted text-sm">
        Create your Season {nextSeasonNumber} to get started.
      </p>

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
        disabled={saving}
        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {saving ? 'Creating...' : `Create Season ${nextSeasonNumber}`}
      </button>
    </form>
  );
}
