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

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

function regChipClass(status: string): string {
  if (status === 'confirmed' || status === 'promoted') return 'chip chip--success';
  if (status === 'waitlisted') return 'chip chip--warning';
  return 'chip chip--info';
}

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
      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">Step 3: Review Registrations</h2>
        </div>
        <div className="info-panel info-panel--danger">Complete Step 2 first to create at least one cohort.</div>
      </div>
    );
  }

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

  const lateConfirmed = isReview && memberSeasons.length > 0
    ? confirmedMemberCount - memberSeasons.length
    : 0;

  const summaryVariant = confirmedMemberCount > 0
    ? 'info-panel info-panel--primary'
    : totalRegisteredCount > 0
      ? 'info-panel info-panel--warning'
      : 'info-panel';

  return (
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <h2 className="wiz-panel__title">Step 3: Review Registrations</h2>
        {confirmedMemberCount > 0 && (
          <span className="chip chip--success">{confirmedMemberCount} confirmed</span>
        )}
      </div>

      <div className={summaryVariant}>
        {confirmedMemberCount} confirmed / {totalRegisteredCount} total registered across {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''}
      </div>

      {lateConfirmed > 0 && (
        <div className="info-panel info-panel--warning">
          Note: {lateConfirmed} member{lateConfirmed !== 1 ? 's' : ''} confirmed after league assignment was locked. They will need to be manually added to leagues.
        </div>
      )}

      {cohorts.map((cohort) => {
        const regs = getRegs(cohort.id);
        const maxCap = (cohort.settings?.maxCapacity as number) || 20;
        const registeredCount = regs.filter((r) => r.status === 'registered').length;
        const waitlistedCount = regs.filter((r) => r.status === 'waitlisted').length;
        const hasLoadedRegs = !!loadedRegs[cohort.id] || !!registrationsByCohort[cohort.id];

        return (
          <div key={cohort.id} className="subcard" style={cssVars({ '--dot-color': cohort.color })}>
            <div className="subcard__head">
              <div className="subcard__title">
                <span className="subcard__dot" />
                <span>{cohort.name}</span>
                <span className="subcard__meta">
                  {cohort.season_registrations?.[0]?.count || 0} registered
                </span>
              </div>
              <div className="subcard__actions">
                {!hasLoadedRegs && (
                  <button
                    onClick={() => loadRegistrations(cohort.id)}
                    className="btn btn--sm btn--ghost"
                  >
                    Load Registrations
                  </button>
                )}
                {registeredCount > 0 && (
                  <button
                    onClick={() => confirmCohortRegistrations(cohort.id, maxCap)}
                    disabled={saving}
                    className="btn btn--sm btn--primary"
                  >
                    {saving ? 'Confirming\u2026' : `Confirm All (max ${maxCap})`}
                  </button>
                )}
                {waitlistedCount > 0 && (
                  <button
                    onClick={() => promoteCohort(cohort.id)}
                    disabled={saving}
                    className="btn btn--sm"
                  >
                    Promote from Waitlist
                  </button>
                )}
              </div>
            </div>

            {hasLoadedRegs && regs.length === 0 && (
              <p className="form-hint">No registrations yet.</p>
            )}

            {hasLoadedRegs && regs.length > 0 && (
              <div className="col col--sm">
                {regs.map((reg) => (
                  <div key={reg.id} className="reg-row">
                    <span className="reg-row__name">
                      {reg.members?.display_name || reg.members?.full_name}
                      <span className="reg-row__email">({reg.members?.email})</span>
                    </span>
                    <span className={regChipClass(reg.status)}>{reg.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {confirmedMemberCount === 0 && totalRegisteredCount === 0 && !isReview && (
        <p className="form-hint">Share your invite links and come back when members have signed up.</p>
      )}
      {confirmedMemberCount === 0 && totalRegisteredCount > 0 && !isReview && (
        <p className="form-hint">Confirm at least one registered member before configuring leagues.</p>
      )}
      {confirmedMemberCount > 0 && !isReview && (
        <p className="form-hint">Continue to Configure Leagues to set up your league structure.</p>
      )}
    </div>
  );
}
