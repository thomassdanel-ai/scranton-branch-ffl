'use client';

import { useState } from 'react';
import type { Season, Cohort, Registration, MemberSeason, FlashFn } from '../page';

type Props = {
  season: Season | null;
  cohorts: Cohort[];
  registrationsByCohort: Record<string, Registration[]>;
  confirmedMemberCount: number;
  totalRegisteredCount: number;
  memberSeasons: MemberSeason[];
  flash: FlashFn;
  onComplete: () => Promise<void>;
  isReview: boolean;
};

export default function Step3Registrations({
  cohorts,
  registrationsByCohort,
  confirmedMemberCount,
  totalRegisteredCount,
  memberSeasons,
  flash,
  onComplete,
  isReview,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [loadedRegs, setLoadedRegs] = useState<Record<string, Registration[]>>({});

  if (cohorts.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white">Step 3: Review Registrations</h2>
        <p className="text-accent-red text-sm mt-2">Complete Step 2 first to create at least one cohort.</p>
      </div>
    );
  }

  // Merge server-loaded registrations with on-demand loaded ones
  function getRegs(cohortId: string): Registration[] {
    return loadedRegs[cohortId] || registrationsByCohort[cohortId] || [];
  }

  async function loadRegistrations(cohortId: string) {
    const res = await fetch(`/api/admin/cohorts/${cohortId}/registrations`);
    if (res.ok) {
      const data = await res.json();
      setLoadedRegs((prev) => ({ ...prev, [cohortId]: data.registrations || [] }));
    }
  }

  async function confirmCohortRegistrations(cohortId: string, maxSlots: number) {
    setSaving(true);
    const res = await fetch(`/api/admin/cohorts/${cohortId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxSlots }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Confirmation failed', 'error');
    } else {
      const data = await res.json();
      flash(`${data.confirmed} confirmed, ${data.waitlisted} waitlisted`, 'success');
      await onComplete();
    }
    setSaving(false);
  }

  async function promoteCohort(cohortId: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/cohorts/${cohortId}/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 }),
    });
    if (!res.ok) {
      const err = await res.json();
      flash(err.error || 'Promote failed', 'error');
    } else {
      const data = await res.json();
      flash(`${data.promoted} member(s) promoted from waitlist`, 'success');
      await onComplete();
    }
    setSaving(false);
  }

  // Check for late registrations after league lock
  const lateConfirmed = isReview && memberSeasons.length > 0
    ? confirmedMemberCount - memberSeasons.length
    : 0;

  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Step 3: Review Registrations</h2>
        {confirmedMemberCount > 0 && (
          <span className="text-xs px-3 py-1 rounded-full bg-accent-green/20 text-accent-green font-semibold">
            {confirmedMemberCount} confirmed
          </span>
        )}
      </div>

      {/* Summary banner */}
      <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
        confirmedMemberCount > 0
          ? 'bg-accent-green/20 text-accent-green'
          : totalRegisteredCount > 0
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-bg-tertiary text-text-secondary'
      }`}>
        {confirmedMemberCount} confirmed / {totalRegisteredCount} total registered across {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
      </div>

      {lateConfirmed > 0 && (
        <div className="text-sm px-3 py-2 rounded-lg bg-amber-500/10 text-amber-300">
          Note: {lateConfirmed} member{lateConfirmed !== 1 ? 's' : ''} confirmed after league assignment was locked. They will need to be manually added to leagues.
        </div>
      )}

      {/* Per-cohort registration list */}
      {cohorts.map((cohort) => {
        const regs = getRegs(cohort.id);
        const maxCap = (cohort.settings?.maxCapacity as number) || 20;
        const registeredCount = regs.filter((r) => r.status === 'registered').length;
        const waitlistedCount = regs.filter((r) => r.status === 'waitlisted').length;
        const hasLoadedRegs = !!loadedRegs[cohort.id] || !!registrationsByCohort[cohort.id];

        return (
          <div key={cohort.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                <span className="text-white font-semibold">{cohort.name}</span>
                <span className="text-text-muted text-xs">
                  {cohort.season_registrations?.[0]?.count || 0} registered
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!hasLoadedRegs && (
                  <button
                    onClick={() => loadRegistrations(cohort.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-text-secondary hover:text-white transition-colors"
                  >
                    Load Registrations
                  </button>
                )}
                {registeredCount > 0 && (
                  <button
                    onClick={() => confirmCohortRegistrations(cohort.id, maxCap)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-green/20 text-accent-green hover:bg-accent-green/30 disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Confirming...' : `Confirm All (max ${maxCap})`}
                  </button>
                )}
                {waitlistedCount > 0 && (
                  <button
                    onClick={() => promoteCohort(cohort.id)}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
                  >
                    Promote from Waitlist
                  </button>
                )}
              </div>
            </div>

            {hasLoadedRegs && regs.length === 0 && (
              <p className="text-text-muted text-xs">No registrations yet.</p>
            )}

            {hasLoadedRegs && regs.length > 0 && (
              <div className="space-y-1">
                {regs.map((reg) => (
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
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Navigation hints */}
      {confirmedMemberCount === 0 && totalRegisteredCount === 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Share your invite links and come back when members have signed up.
        </p>
      )}
      {confirmedMemberCount === 0 && totalRegisteredCount > 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Confirm at least one registered member before configuring leagues.
        </p>
      )}
      {confirmedMemberCount > 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Continue to Configure Leagues to set up your league structure.
        </p>
      )}
    </div>
  );
}
