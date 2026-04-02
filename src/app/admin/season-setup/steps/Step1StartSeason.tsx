'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Season, FlashFn } from '../page';

type Props = {
  season: Season | null;
  nextSeasonNumber: number;
  flash: FlashFn;
  onComplete: () => Promise<void>;
};

export default function Step1StartSeason({ season, nextSeasonNumber, flash, onComplete }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [saving, setSaving] = useState(false);

  // Season already exists — read-only summary
  if (season) {
    return (
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
            className="w-full px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
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
