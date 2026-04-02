'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

const BRACKET_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  complete: { label: 'Complete', color: 'bg-green-500/20 text-green-300' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-300' },
  not_set_up: { label: 'Not Set Up', color: 'bg-red-500/20 text-red-300' },
};

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
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">Archive Season</h1>
        <p className="text-text-secondary text-sm mt-1">
          Snapshot the {seasonYear} season data for the permanent historical record.
        </p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="font-bold text-white">What gets archived:</h2>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Final standings for all leagues
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Power rankings snapshot
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Championship bracket results
          </li>
          <li className="flex items-center gap-2">
            <span className="text-accent-green">*</span>
            Season awards (most points, best record, champion)
          </li>
        </ul>
      </div>

      {/* Archive Preview */}
      {previewLoading ? (
        <div className="glass-card p-6">
          <p className="text-text-muted text-sm">Loading preview...</p>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          {/* League Standings Preview */}
          {preview.leagueStandings.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <h2 className="font-bold text-white">Standings Preview</h2>
              {preview.leagueStandings.map((ls) => (
                <div key={ls.leagueName}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ls.leagueColor }} />
                    <span className="text-white font-semibold text-sm">{ls.leagueName}</span>
                  </div>
                  {ls.teams.length > 0 ? (
                    <div className="space-y-1 ml-4">
                      {ls.teams.map((team, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-text-muted font-mono w-4">{i + 1}.</span>
                          <span className="text-white">{team.name}</span>
                          <span className="text-text-muted font-mono ml-auto">{team.wins}-{team.losses}</span>
                          <span className="text-text-muted font-mono">{team.pointsFor.toFixed(1)} PF</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-text-muted text-xs ml-4">No standings data available</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Awards Preview */}
          {Object.keys(preview.awards).length > 0 && (
            <div className="glass-card p-6 space-y-3">
              <h2 className="font-bold text-white">Awards</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {preview.awards.champion && (
                  <div className="p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20">
                    <p className="text-accent-gold text-xs font-semibold">Champion</p>
                    <p className="text-white text-sm">{preview.awards.champion.name}</p>
                    {preview.awards.champion.league && (
                      <p className="text-text-muted text-xs">{preview.awards.champion.league}</p>
                    )}
                  </div>
                )}
                {preview.awards.mostPoints && (
                  <div className="p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-text-muted text-xs font-semibold">Most Points</p>
                    <p className="text-white text-sm">{preview.awards.mostPoints.name}</p>
                    {preview.awards.mostPoints.league && (
                      <p className="text-text-muted text-xs">{preview.awards.mostPoints.league}</p>
                    )}
                  </div>
                )}
                {preview.awards.bestRecord && (
                  <div className="p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-text-muted text-xs font-semibold">Best Record</p>
                    <p className="text-white text-sm">{preview.awards.bestRecord.name}</p>
                    {preview.awards.bestRecord.league && (
                      <p className="text-text-muted text-xs">{preview.awards.bestRecord.league}</p>
                    )}
                  </div>
                )}
                {preview.awards.topPowerRanked && (
                  <div className="p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-text-muted text-xs font-semibold">#1 Power Ranked</p>
                    <p className="text-white text-sm">{preview.awards.topPowerRanked.name}</p>
                    {preview.awards.topPowerRanked.league && (
                      <p className="text-text-muted text-xs">{preview.awards.topPowerRanked.league}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bracket Status */}
          <div className="glass-card p-6 space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-white">Bracket Status</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${BRACKET_STATUS_DISPLAY[preview.bracketStatus]?.color || ''}`}>
                {BRACKET_STATUS_DISPLAY[preview.bracketStatus]?.label || preview.bracketStatus}
              </span>
            </div>
            {preview.bracketStatus !== 'complete' && (
              <p className="text-amber-300 text-sm">
                The championship bracket is not complete. Archiving now will freeze incomplete bracket data.
              </p>
            )}
          </div>
        </div>
      ) : null}

      {/* Archive Button */}
      <div className="glass-card p-6 space-y-4">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={archiving}
          className="px-6 py-2 bg-accent-red text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          {archiving ? 'Archiving...' : `Archive ${seasonYear} Season`}
        </button>

        {message && (
          <p className={`text-sm ${message.startsWith('Error') ? 'text-accent-red' : 'text-accent-green'}`}>
            {message}
          </p>
        )}
      </div>

      {/* Confirmation Modal */}
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
