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
      <div className="col col--lg">
        <div className="wiz-panel">
          <div className="wiz-panel__head">
            <h2 className="wiz-panel__title">Step 1: Start Season</h2>
            <span className="chip chip--success">Created</span>
          </div>

          <div className="form-grid form-grid--2">
            <div className="stat-mini">
              <div className="stat-mini__lab">Season</div>
              <div className="stat-mini__val">Season {season.season_number}</div>
            </div>
            <div className="stat-mini">
              <div className="stat-mini__lab">NFL Year</div>
              <div className="stat-mini__val">{season.year}</div>
            </div>
          </div>

          <p className="wiz-panel__sub">Continue to Cohorts &amp; Invites to start collecting registrations.</p>
        </div>

        {/* Danger Zone */}
        {canReset && (
          <div className="danger-zone">
            <button onClick={() => setDangerOpen(!dangerOpen)} className="danger-zone__toggle">
              <span>Danger Zone</span>
              <span className="danger-zone__caret">{dangerOpen ? '\u25B2' : '\u25BC'}</span>
            </button>
            {dangerOpen && (
              <div className="danger-zone__body">
                <h3 className="danger-zone__title">Reset Season</h3>
                <p>
                  This will permanently delete Season {season.season_number} and ALL associated data:
                  leagues, cohorts, registrations, member assignments, draft boards, and picks. This cannot be undone.
                </p>
                <div>
                  <label className="form-label">
                    Type <span className="danger-zone__phrase">{expectedPhrase}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={resetPhrase}
                    onChange={(e) => setResetPhrase(e.target.value)}
                    placeholder={expectedPhrase}
                    className="inp inp--mono"
                  />
                </div>
                <button
                  onClick={handleReset}
                  disabled={!phraseMatch || resetting}
                  className="btn btn--danger"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {resetting ? 'Resetting\u2026' : `Reset Season ${season.season_number}`}
                </button>
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
    <form onSubmit={handleCreate} className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 1: Start Season</h2>
      </div>
      <p className="wiz-panel__sub">
        Create Season {nextSeasonNumber} to get started. You&apos;ll configure leagues later after registration.
      </p>

      <div className="form-grid form-grid--2">
        <div>
          <label className="form-label">Season Number</label>
          <input type="text" value={`Season ${nextSeasonNumber}`} disabled className="inp" />
        </div>
        <div>
          <label className="form-label">NFL Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2020}
            max={2040}
            className="inp"
          />
        </div>
      </div>

      <button type="submit" disabled={saving} className="btn btn--primary" style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Creating\u2026' : `Start Season ${nextSeasonNumber}`}
      </button>
    </form>
  );
}
