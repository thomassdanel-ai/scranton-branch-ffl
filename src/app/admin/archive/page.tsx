'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmModal from '@/components/admin/ConfirmModal';

type PreviewData = {
  leagueStandings: {
    leagueName: string;
    leagueColor: string;
    teams: { name: string; wins: number; losses: number; pointsFor: number }[];
  }[];
  awards: Record<string, { name: string; league?: string }>;
  bracketStatus: 'complete' | 'in_progress' | 'not_set_up';
};

function cssVars(vars: Record<string, string>): React.CSSProperties {
  return vars as React.CSSProperties;
}

function bracketChipClass(status: string): string {
  if (status === 'complete') return 'chip chip--success';
  if (status === 'in_progress') return 'chip chip--warning';
  return 'chip chip--danger';
}

function bracketChipLabel(status: string): string {
  if (status === 'complete') return 'Complete';
  if (status === 'in_progress') return 'In Progress';
  return 'Not Set Up';
}

export default function ArchiveSeasonPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [message, setMessage] = useState('');
  const [seasonYear, setSeasonYear] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  useEffect(() => {
    const fetchSeason = fetch('/api/admin/season')
      .then((res) => {
        if (res.status === 401) { router.push('/admin'); return null; }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        const year = data.season?.year ?? data.fallbackConfig?.currentSeason ?? '';
        setSeasonYear(year);
      });

    const fetchPreview = fetch('/api/admin/archive/preview')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.preview) setPreview(data.preview);
      })
      .catch(() => {});

    Promise.all([fetchSeason, fetchPreview]).finally(() => {
      setLoading(false);
      setPreviewLoading(false);
    });
  }, [router]);

  async function handleArchive() {
    setShowConfirm(false);
    setArchiving(true);
    setMessage('');

    const res = await fetch('/api/admin/archive', { method: 'POST' });
    if (res.ok) {
      setMessage(`${seasonYear} season archived successfully! You can now set up the new season.`);
    } else {
      const err = await res.json();
      setMessage(`Error: ${err.error}`);
    }
    setArchiving(false);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}>Loading&hellip;</p>
      </div>
    );
  }

  return (
    <div className="col col--lg" style={{ maxWidth: 780 }}>
      <div className="page-head">
        <Link href="/admin" className="back-link">&larr; Back to Admin</Link>
        <h1 className="page-head__title">Archive Season</h1>
        <p className="wiz-panel__sub" style={{ marginTop: 4 }}>
          Snapshot the {seasonYear} season data for the permanent historical record.
        </p>
      </div>

      <div className="wiz-panel">
        <div className="wiz-panel__head">
          <h2 className="wiz-panel__title">What Gets Archived</h2>
        </div>
        <ul className="bullet-list">
          <li>Final standings for all leagues</li>
          <li>Power rankings snapshot</li>
          <li>Championship bracket results</li>
          <li>Season awards (most points, best record, champion)</li>
        </ul>
      </div>

      {previewLoading ? (
        <div className="wiz-panel">
          <p className="form-hint">Loading preview&hellip;</p>
        </div>
      ) : preview ? (
        <>
          {preview.leagueStandings.length > 0 && (
            <div className="wiz-panel">
              <div className="wiz-panel__head">
                <h2 className="wiz-panel__title">Standings Preview</h2>
              </div>
              <div className="col col--sm">
                {preview.leagueStandings.map((ls) => (
                  <div key={ls.leagueName} className="subcard" style={cssVars({ '--dot-color': ls.leagueColor })}>
                    <div className="subcard__head">
                      <div className="subcard__title">
                        <span className="subcard__dot" />
                        <span>{ls.leagueName}</span>
                      </div>
                    </div>
                    {ls.teams.length > 0 ? (
                      <div>
                        {ls.teams.map((team, i) => (
                          <div key={i} className="stand-preview__row">
                            <span className="stand-preview__rk">{i + 1}.</span>
                            <span className="stand-preview__name">{team.name}</span>
                            <span className="stand-preview__rec">{team.wins}-{team.losses}</span>
                            <span className="stand-preview__pf">{team.pointsFor.toFixed(1)} PF</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="form-hint">No standings data available</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(preview.awards).length > 0 && (
            <div className="wiz-panel">
              <div className="wiz-panel__head">
                <h2 className="wiz-panel__title">Awards</h2>
              </div>
              <div className="awards-grid">
                {preview.awards.champion && (
                  <div className="award-cell award-cell--gold">
                    <div className="award-cell__lab">Champion</div>
                    <div className="award-cell__name">{preview.awards.champion.name}</div>
                    {preview.awards.champion.league && (
                      <div className="award-cell__detail">{preview.awards.champion.league}</div>
                    )}
                  </div>
                )}
                {preview.awards.mostPoints && (
                  <div className="award-cell">
                    <div className="award-cell__lab">Most Points</div>
                    <div className="award-cell__name">{preview.awards.mostPoints.name}</div>
                    {preview.awards.mostPoints.league && (
                      <div className="award-cell__detail">{preview.awards.mostPoints.league}</div>
                    )}
                  </div>
                )}
                {preview.awards.bestRecord && (
                  <div className="award-cell">
                    <div className="award-cell__lab">Best Record</div>
                    <div className="award-cell__name">{preview.awards.bestRecord.name}</div>
                    {preview.awards.bestRecord.league && (
                      <div className="award-cell__detail">{preview.awards.bestRecord.league}</div>
                    )}
                  </div>
                )}
                {preview.awards.topPowerRanked && (
                  <div className="award-cell">
                    <div className="award-cell__lab">#1 Power Ranked</div>
                    <div className="award-cell__name">{preview.awards.topPowerRanked.name}</div>
                    {preview.awards.topPowerRanked.league && (
                      <div className="award-cell__detail">{preview.awards.topPowerRanked.league}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="wiz-panel">
            <div className="wiz-panel__head">
              <h2 className="wiz-panel__title">Bracket Status</h2>
              <span className={bracketChipClass(preview.bracketStatus)}>
                {bracketChipLabel(preview.bracketStatus)}
              </span>
            </div>
            {preview.bracketStatus !== 'complete' && (
              <div className="info-panel info-panel--warning">
                The championship bracket is not complete. Archiving now will freeze incomplete bracket data.
              </div>
            )}
          </div>
        </>
      ) : null}

      <div className="row">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={archiving}
          className="btn btn--danger btn--lg"
        >
          {archiving ? 'Archiving\u2026' : `Archive ${seasonYear} Season`}
        </button>
        {message && (
          <span
            className="form-hint"
            style={{
              color: message.startsWith('Error') ? 'var(--accent-danger)' : 'var(--accent-live)',
              fontSize: 13,
            }}
          >
            {message}
          </span>
        )}
      </div>

      {showConfirm && (
        <ConfirmModal
          title={`Archive Season ${seasonYear}`}
          message={`This will create a permanent snapshot of the ${seasonYear} season. This action cannot be undone.`}
          confirmLabel={`Archive ${seasonYear} Season`}
          cancelLabel="Go Back"
          variant="danger"
          onConfirm={handleArchive}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
