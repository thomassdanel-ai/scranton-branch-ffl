'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ArchiveSummary {
  id: string;
  season_id: string;
  champion: { teamName: string; leagueName: string; leagueColor: string } | null;
  awards: Record<string, unknown> | null;
  archived_at: string;
  seasons: { year: string; config: unknown };
}

export default function HistoryPage() {
  const [archives, setArchives] = useState<ArchiveSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then((r) => r.json())
      .then((data) => setArchives(data.archives ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Season History</h1>
        <p className="text-text-secondary mt-1">
          Past seasons preserved for all time.
        </p>
      </div>

      {archives.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="text-5xl">📚</div>
          <h2 className="text-xl font-bold text-white">No Archives Yet</h2>
          <p className="text-text-secondary max-w-md mx-auto">
            Season archives will appear here after the commissioner snapshots a completed season
            from the admin panel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {archives.map((archive) => {
            const year = archive.seasons?.year ?? 'Unknown';
            const champion = archive.champion;
            const awards = archive.awards as Record<string, { name?: string; league?: string }> | null;

            return (
              <Link
                key={archive.id}
                href={`/history/${archive.id}`}
                className="glass-card p-6 hover:bg-white/5 transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-white">{year} Season</h2>
                  <span className="text-xs text-text-muted">
                    Archived {new Date(archive.archived_at).toLocaleDateString()}
                  </span>
                </div>

                {champion ? (
                  <div className="flex items-center gap-2">
                    <span className="text-accent-gold">🏆</span>
                    <span className="text-white font-semibold">{champion.teamName}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                      style={{
                        backgroundColor: `${champion.leagueColor}22`,
                        color: champion.leagueColor,
                      }}
                    >
                      {champion.leagueName}
                    </span>
                  </div>
                ) : (
                  <p className="text-text-muted text-sm">No champion recorded</p>
                )}

                {awards?.bestRecord && (
                  <p className="text-xs text-text-secondary">
                    Best Record: {awards.bestRecord.name} ({awards.bestRecord.league})
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
