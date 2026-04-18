'use client';

import { useState } from 'react';
import InviteEmailGenerator from '@/components/admin/InviteEmailGenerator';
import type { Season, Cohort, FlashFn } from '../page';

type Props = {
  season: Season | null;
  cohorts: Cohort[];
  flash: FlashFn;
  onComplete: () => Promise<void>;
  isReview: boolean;
};

type Registration = {
  id: string;
  status: string;
  members: { full_name: string; display_name: string | null; email: string };
};

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

function regChipClass(status: string): string {
  if (status === 'confirmed' || status === 'promoted') return 'chip chip--success';
  if (status === 'waitlisted') return 'chip chip--warning';
  return 'chip chip--info';
}

export default function Step2Cohorts({ season, cohorts, flash, onComplete, isReview }: Props) {
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortColor, setNewCohortColor] = useState('#3b82f6');
  const [newCohortCapacity, setNewCohortCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailCohortId, setEmailCohortId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [expandedRegs, setExpandedRegs] = useState<Record<string, Registration[]>>({});

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (!season) {
    return (
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Step 2: Cohorts &amp; Invites</h2>
        </div>
        <div className="info-panel info-panel--danger">Complete Step 1 first to create a season.</div>
      </div>
    );
  }

  async function createCohort(e: React.FormEvent) {
    e.preventDefault();
    if (!newCohortName.trim()) return;
    setSaving(true);

    const res = await fetch('/api/admin/cohorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newCohortName.trim(),
        color: newCohortColor,
        settings: newCohortCapacity ? { maxCapacity: Number(newCohortCapacity) } : {},
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Failed to create cohort', 'error');
    } else {
      flash('Cohort created', 'success');
      setNewCohortName('');
      setNewCohortCapacity('');
      await onComplete();
    }
    setSaving(false);
  }

  async function copyInviteLink(token: string) {
    const url = `${siteUrl}/register/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(token);
    setTimeout(() => setCopiedLink(null), 2000);
  }

  async function fetchRegistrations(cohortId: string) {
    const res = await fetch(`/api/admin/cohorts/${cohortId}/registrations`);
    if (res.ok) {
      const data = await res.json();
      setExpandedRegs((prev) => ({ ...prev, [cohortId]: data.registrations || [] }));
    }
  }

  return (
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 2: Cohorts &amp; Invites</h2>
        {cohorts.length > 0 && (
          <span className="chip chip--success">
            {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''} created
          </span>
        )}
      </div>
      <p className="wiz-panel__sub">
        Create cohorts for different groups, send invite links, and wait for signups.
      </p>

      {/* Existing cohorts */}
      {cohorts.length > 0 && (
        <div className="col">
          {cohorts.map((cohort) => {
            const regCount = cohort.season_registrations?.[0]?.count || 0;
            const maxCap = (cohort.settings?.maxCapacity as number) || null;
            const pct = maxCap ? Math.min(100, (regCount / maxCap) * 100) : 0;

            return (
              <div key={cohort.id} className="subcard" style={cssVars({ '--dot-color': cohort.color })}>
                <div className="subcard__head">
                  <div className="subcard__title">
                    <span className="subcard__dot" />
                    <span>{cohort.name}</span>
                    <span className={`chip ${cohort.status === 'open' ? 'chip--success' : 'chip--danger'}`}>
                      {cohort.status}
                    </span>
                  </div>
                  <span className="subcard__meta">
                    {regCount}{maxCap ? `/${maxCap}` : ''} registered
                  </span>
                </div>

                {maxCap && (
                  <div className="progress progress--sm">
                    <div
                      className="progress__fill"
                      style={{ width: `${pct}%`, background: cohort.color }}
                    />
                  </div>
                )}

                <div className="subcard__actions">
                  <button
                    onClick={() => copyInviteLink(cohort.invite_token)}
                    className={`btn btn--sm ${copiedLink === cohort.invite_token ? 'chip--success' : ''}`}
                  >
                    {copiedLink === cohort.invite_token ? 'Copied!' : 'Copy Invite Link'}
                  </button>
                  <button
                    onClick={() => setEmailCohortId(emailCohortId === cohort.id ? null : cohort.id)}
                    className="btn btn--sm"
                  >
                    {emailCohortId === cohort.id ? 'Hide Email' : 'Generate Email'}
                  </button>
                  <button
                    onClick={() => fetchRegistrations(cohort.id)}
                    className="btn btn--sm btn--ghost"
                  >
                    View Registrations
                  </button>
                </div>

                {emailCohortId === cohort.id && (
                  <InviteEmailGenerator
                    cohortName={cohort.name}
                    seasonYear={String(season.year)}
                    inviteUrl={`${siteUrl}/register/${cohort.invite_token}`}
                  />
                )}

                {expandedRegs[cohort.id] && (
                  <div className="col col--sm">
                    {expandedRegs[cohort.id].length === 0 ? (
                      <p className="form-hint">No registrations yet.</p>
                    ) : (
                      expandedRegs[cohort.id].map((reg) => (
                        <div key={reg.id} className="reg-row">
                          <span className="reg-row__name">
                            {reg.members?.display_name || reg.members?.full_name}
                            <span className="reg-row__email">({reg.members?.email})</span>
                          </span>
                          <span className={regChipClass(reg.status)}>{reg.status}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create new cohort form */}
      <form onSubmit={createCohort} className="subcard">
        <h3 className="subcard__title">Create New Cohort</h3>
        <div className="form-grid form-grid--3">
          <input
            type="text"
            value={newCohortName}
            onChange={(e) => setNewCohortName(e.target.value)}
            placeholder="Cohort Name *"
            required
            className="inp"
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="color"
              value={newCohortColor}
              onChange={(e) => setNewCohortColor(e.target.value)}
              className="inp-color"
            />
            <input
              type="number"
              value={newCohortCapacity}
              onChange={(e) => setNewCohortCapacity(e.target.value)}
              placeholder="Max Capacity"
              min={1}
              className="inp"
              style={{ flex: 1 }}
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newCohortName.trim()}
            className="btn btn--primary"
          >
            {saving ? 'Creating\u2026' : 'Create Cohort'}
          </button>
        </div>
      </form>

      {/* Navigation hints */}
      {cohorts.length === 0 && (
        <p className="form-hint">Create at least one cohort to continue.</p>
      )}
      {cohorts.length > 0 && !isReview && (
        <p className="form-hint">
          Waiting for signups&hellip; share your invite links and come back when people have registered.
        </p>
      )}
    </div>
  );
}
