'use client';

import { useState } from 'react';
import type { Cohort, Registration, FlashFn } from '../page';

type Props = {
  cohorts: Cohort[];
  registrationsByCohort: Record<string, Registration[]>;
  confirmedMemberCount: number;
  flash: FlashFn;
  onMutate: () => Promise<void>;
  isReview: boolean;
};

export default function Step3Registrations({
  cohorts,
  registrationsByCohort,
  confirmedMemberCount,
  flash,
  onMutate,
  isReview,
}: Props) {
  const [saving, setSaving] = useState(false);

  if (cohorts.length === 0) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white">Step 3: Review Registrations</h2>
        <p className="text-accent-red text-sm mt-2">Complete Step 2 first to create at least one cohort.</p>
      </div>
    );
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
      await onMutate();
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
      await onMutate();
    }
    setSaving(false);
  }

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

      {/* Summary bar */}
      <div className={`text-sm font-medium px-3 py-2 rounded-lg ${
        confirmedMemberCount >= 8
          ? 'bg-accent-green/20 text-accent-green'
          : confirmedMemberCount > 0
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'bg-bg-tertiary text-text-secondary'
      }`}>
        {confirmedMemberCount} member{confirmedMemberCount !== 1 ? 's' : ''} confirmed across {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
      </div>

      {/* Per-cohort registration list */}
      {cohorts.map((cohort) => {
        const regs = registrationsByCohort[cohort.id] || [];
        const maxCap = (cohort.settings?.maxCapacity as number) || 20;
        const registeredCount = regs.filter((r) => r.status === 'registered').length;
        const waitlistedCount = regs.filter((r) => r.status === 'waitlisted').length;

        return (
          <div key={cohort.id} className="p-4 rounded-lg bg-bg-tertiary/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cohort.color }} />
                <span className="text-white font-semibold">{cohort.name}</span>
                <span className="text-text-muted text-xs">{regs.length} registration{regs.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-2">
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

            {regs.length === 0 ? (
              <p className="text-text-muted text-xs">No registrations yet.</p>
            ) : (
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

      {confirmedMemberCount === 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Confirm at least one member registration before assigning leagues.
        </p>
      )}

      {confirmedMemberCount > 0 && !isReview && (
        <p className="text-text-muted text-sm">
          Continue to League Assignment to assign confirmed members to leagues.
        </p>
      )}
    </div>
  );
}
