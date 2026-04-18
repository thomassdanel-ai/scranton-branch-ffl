'use client';

import { useState, useEffect } from 'react';
import InviteEmailGenerator from './InviteEmailGenerator';

type Registration = {
  id: string;
  status: string;
  registered_at: string;
  confirmed_at: string | null;
  waitlist_position: number | null;
  members: {
    full_name: string;
    display_name: string | null;
    email: string;
  };
};

type Props = {
  cohortId: string;
  cohortName: string;
  cohortColor: string;
  inviteToken: string;
  seasonYear: string;
  settings: Record<string, unknown>;
  onClose: () => void;
};

function statusChipClass(status: string): string {
  if (status === 'confirmed' || status === 'promoted') return 'chip chip--success';
  if (status === 'waitlisted') return 'chip chip--warning';
  if (status === 'registered') return 'chip chip--live';
  return 'chip chip--muted';
}

export default function CohortDetailPanel({
  cohortId,
  cohortName,
  cohortColor,
  inviteToken,
  seasonYear,
  settings,
  onClose,
}: Props) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${siteUrl}/register/${inviteToken}`;
  const maxCapacity = (settings?.maxCapacity as number) || null;

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/cohorts/${cohortId}/registrations`);
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data.registrations || []);
      }
      setLoading(false);
    }
    load();
  }, [cohortId]);

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  const statusCounts = registrations.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const total = registrations.length;
  const confirmed = statusCounts['confirmed'] || 0;
  const waitlisted = statusCounts['waitlisted'] || 0;
  const registered = statusCounts['registered'] || 0;
  const promoted = statusCounts['promoted'] || 0;

  const capPct = maxCapacity ? Math.min(100, (total / maxCapacity) * 100) : 0;

  return (
    <div className="wiz-panel">
      <div className="wiz-panel__head">
        <div className="row" style={{ alignItems: 'center' }}>
          <span
            style={{ width: 10, height: 10, borderRadius: '50%', background: cohortColor, display: 'inline-block' }}
          />
          <h3 className="wiz-panel__title">{cohortName}</h3>
        </div>
        <button onClick={onClose} className="action-link action-link--muted">Close</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__lab">Registered</div>
          <div className="stat-card__val">{registered}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lab">Confirmed</div>
          <div className="stat-card__val stat-card__val--good">{confirmed + promoted}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lab">Waitlisted</div>
          <div className="stat-card__val" style={{ color: 'var(--accent-clock)' }}>{waitlisted}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__lab">{maxCapacity ? 'Capacity' : 'Total'}</div>
          <div className="stat-card__val">{maxCapacity ? `${total}/${maxCapacity}` : total}</div>
        </div>
      </div>

      {maxCapacity && (
        <div className="progress">
          <div
            className="progress__fill"
            style={{ width: `${capPct}%`, background: cohortColor }}
          />
        </div>
      )}

      <div className="share-link-row">
        <span className="share-link-row__lab">Invite Link</span>
        <code className="code-badge" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inviteUrl}
        </code>
        <button
          onClick={copyLink}
          className={`btn btn--sm ${linkCopied ? 'btn--primary' : 'btn--ghost'}`}
        >
          {linkCopied ? 'Copied!' : 'Copy Link'}
        </button>
        <button
          onClick={() => setShowEmail(!showEmail)}
          className="btn btn--sm btn--ghost"
        >
          {showEmail ? 'Hide Email' : 'Generate Email'}
        </button>
      </div>

      {showEmail && (
        <InviteEmailGenerator
          cohortName={cohortName}
          seasonYear={seasonYear}
          inviteUrl={inviteUrl}
        />
      )}

      {loading ? (
        <p className="form-hint">Loading registrations&hellip;</p>
      ) : registrations.length === 0 ? (
        <p className="form-hint">No registrations yet.</p>
      ) : (
        <div className="col col--sm" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {registrations.map((reg) => (
            <div key={reg.id} className="hist-entry">
              <div className="hist-entry__body">
                <div className="hist-entry__primary">
                  {reg.members?.display_name || reg.members?.full_name || 'Unknown'}
                </div>
                <div className="hist-entry__secondary">{reg.members?.email}</div>
              </div>
              <div className="hist-entry__meta">
                <span className={statusChipClass(reg.status)}>{reg.status}</span>
                <span style={{ color: 'var(--ink-5)', font: '500 var(--fs-11) / 1 var(--font-mono)' }}>
                  {new Date(reg.registered_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
