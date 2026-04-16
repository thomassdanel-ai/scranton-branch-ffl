'use client';

import { useState } from 'react';
import type { Season, FlashFn } from '../page';

const RESETTABLE_STATUSES = ['setup', 'registering', 'confirming', 'pre_draft', 'drafting'];

type Props = {
  season: Season | null;
  nextSeasonNumber: number;
  flash: FlashFn;
  onComplete: () => Promise<void>;
};

export default function Step1StartSeason({ season, nextSeasonNumber, flash, onComplete }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetting, setResetting] = useState(false);

  const canReset = season && RESETTABLE_STATUSES.includes(season.status);
  const expectedPhrase = season ? `RESET SEASON ${season.season_number}` : '';
  const phraseMatch = resetPhrase === expectedPhrase;

  async function handleReset() {
    if (!season || !phraseMatch) return;
    setResetting(true);
    try {
      const res = await fetch('/api/admin/setup/reset', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonId: season.id, confirmPhrase: resetPhrase }),
      });
      if (res.ok) {
        flash(`Season ${season.season_number} has been reset.`, 'success');
        setResetPhrase('');
        setDangerOpen(false);
        await onComplete();
      } else {
        const data = await res.json();
        flash(data.error || 'Reset failed', 'error');
      }
    } catch {
      flash('Network error during reset', 'error');
    }
    setResetting(false);
  }

  // Season already exists — read-only summary
  if (season) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Step 1: Start Season</h2>
            <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
              Created
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
          </div>

          <p className="text-text-muted text-sm">
            Continue to Cohorts &amp; Invites to start collecting registrations.
          </p>
        </div>

        {/* Danger Zone */}
        {canReset && (
          <div className="border border-accent-red/30 rounded-lg">
            <button
              onClick={() => setDangerOpen(!dangerOpen)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-accent-red/5 transition-colors rounded-lg"
            >
              <span className="text-accent-red font-semibold text-sm">Danger Zone</span>
              <span className="text-text-muted text-xs">{dangerOpen ? '▲' : '▼'}</span>
            </button>
            {dangerOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div className="p-4 rounded-lg bg-accent-red/5 border border-accent-red/20 space-y-3">
                  <h3 className="text-accent-red font-bold text-sm">Reset Season</h3>
                  <p className="text-text-secondary text-sm">
                    This will permanently delete Season {season.season_number} and ALL associated data:
                    leagues, cohorts, registrations, member assignments, draft boards, and picks.
                    This cannot be undone.
                  </p>
                  <div>
                    <label className="text-text-muted text-xs block mb-1">
                      Type <span className="font-mono text-accent-red">{expectedPhrase}</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={resetPhrase}
                      onChange={(e) => setResetPhrase(e.target.value)}
                      placeholder={expectedPhrase}
                      className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm font-mono focus:outline-hidden focus:border-accent-red"
                    />
                  </div>
                  <button
                    onClick={handleReset}
                    disabled={!phraseMatch || resetting}
                    className="px-4 py-2 bg-accent-red text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetting ? 'Resetting...' : `Reset Season ${season.season_number}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // No season — creation form
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const res = await fetch('/api/admin/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year }),
    });

    if (!res.ok) {
      const err = await res.json();
      // Check if this is a conflict with an existing season
      if (res.status === 409) {
        flash(err.error, 'error');
      } else {
        flash(err.error || 'Failed to create season', 'error');
      }
      setSaving(false);
      return;
    }

    flash(`Season ${nextSeasonNumber} created!`, 'success');
    setSaving(false);
    await onComplete();
  }

  return (
    <form onSubmit={handleCreate} className="glass-card p-6 space-y-4">
      <h2 className="text-lg font-bold text-white">Step 1: Start Season</h2>
      <p className="text-text-muted text-sm">
        Create Season {nextSeasonNumber} to get started. You&apos;ll configure leagues later after registration.
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
            min={2020}
            max={2040}
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
      >
        {saving ? 'Creating...' : `Start Season ${nextSeasonNumber}`}
      </button>
    </form>
  );
}
