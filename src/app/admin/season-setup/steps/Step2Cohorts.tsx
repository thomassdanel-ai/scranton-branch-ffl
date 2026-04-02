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

export default function Step2Cohorts({ season, cohorts, flash, onComplete, isReview }: Props) {
  const [newCohortName, setNewCohortName] = useState('');
  const [newCohortColor, setNewCohortColor] = useState('#3b82f6');
  const [newCohortCapacity, setNewCohortCapacity] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailCohortId, setEmailCohortId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [expandedRegs, setExpandedRegs] = useState<Record<string, Registration[]>>({});

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  type Registration = {
    id: string;
    status: string;
    members: { full_name: string; display_name: string | null; email: string };
  };

  if (!season) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white">Step 2: Cohorts & Invites</h2>
        <p className="text-accent-red text-sm mt-2">Complete Step 1 first to create a season.</p>
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
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Step 2: Cohorts & Invites</h2>
        {cohorts.length > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''} created
          </span>
        )}
      </div>
      <p className="text-text-muted text-sm">
        Create cohorts for different groups, send invite links, and wait for signups.
      </p>

      {/* Existing cohorts */}
      {cohorts.length > 0 && (
        <div className="space-y-3">
          {cohorts.map((cohort) => {
            const regCount = cohort.season_registrations?.[0]?.count || 0;
            const maxCap = (cohort.settings?.maxCapacity as number) || null;

            return (
              <div key={cohort.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                    <span className="text-white font-semibold">{cohort.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      cohort.status === 'open' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {cohort.status}
                    </span>
                  </div>
                  <span className="text-text-muted text-sm font-mono">
                    {regCount}{maxCap ? `/${maxCap}` : ''} registered
                  </span>
                </div>

                {maxCap && (
                  <div className="w-full bg-bg-tertiary rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (regCount / maxCap) * 100)}%`, backgroundColor: cohort.color }}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => copyInviteLink(cohort.invite_token)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      copiedLink === cohort.invite_token
                        ? 'bg-green-500/20 text-green-300'
                        : 'bg-primary/20 text-primary hover:bg-primary/30'
                    }`}
                  >
                    {copiedLink === cohort.invite_token ? 'Copied!' : 'Copy Invite Link'}
                  </button>
                  <button
                    onClick={() => setEmailCohortId(emailCohortId === cohort.id ? null : cohort.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors"
                  >
                    {emailCohortId === cohort.id ? 'Hide Email' : 'Generate Email'}
                  </button>
                  <button
                    onClick={() => fetchRegistrations(cohort.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-text-secondary hover:text-white transition-colors"
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
                  <div className="space-y-1 mt-2">
                    {expandedRegs[cohort.id].length === 0 ? (
                      <p className="text-text-muted text-xs">No registrations yet.</p>
                    ) : (
                      expandedRegs[cohort.id].map((reg) => (
                        <div key={reg.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-bg-tertiary/30">
                          <span className="text-text-secondary text-xs">
                            {reg.members?.display_name || reg.members?.full_name}
                            <span className="text-text-muted ml-1">({reg.members?.email})</span>
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            reg.status === 'confirmed' || reg.status === 'promoted'
                              ? 'bg-green-500/20 text-green-300'
                              : reg.status === 'waitlisted'
                                ? 'bg-yellow-500/20 text-yellow-300'
                                : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {reg.status}
                          </span>
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
      <form onSubmit={createCohort} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
        <h3 className="text-sm font-bold text-white">Create New Cohort</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={newCohortName}
            onChange={(e) => setNewCohortName(e.target.value)}
            placeholder="Cohort Name *"
            required
            className="px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={newCohortColor}
              onChange={(e) => setNewCohortColor(e.target.value)}
              className="w-10 h-10 rounded border border-white/10 bg-bg-tertiary cursor-pointer"
            />
            <input
              type="number"
              value={newCohortCapacity}
              onChange={(e) => setNewCohortCapacity(e.target.value)}
              placeholder="Max Capacity"
              min={1}
              className="flex-1 px-3 py-2 rounded-lg bg-bg-tertiary border border-white/10 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newCohortName.trim()}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Cohort'}
          </button>
        </div>
      </form>

      {/* Navigation hints */}
      {cohorts.length === 0 && (
        <p className="text-text-muted text-sm">Create at least one cohort to continue.</p>
      )}
      {cohorts.length > 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Waiting for signups... share your invite links and come back when people have registered.
        </p>
      )}
    </div>
  );
}
