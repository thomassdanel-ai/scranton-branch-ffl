'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StandingsTeam {
  team: {
    rosterId: number;
    teamName: string | null;
    displayName: string;
    avatar: string | null;
    wins: number;
    losses: number;
    ties: number;
    pointsFor: number;
    pointsAgainst: number;
    streak: string | null;
  };
  inPlayoffPosition: boolean;
}

interface LeagueStandings {
  leagueName: string;
  leagueColor: string;
  standings: StandingsTeam[];
  error?: string;
}

interface Award {
  name?: string;
  points?: number;
  score?: number;
  wins?: number;
  losses?: number;
  league?: string;
}

interface ArchiveData {
  id: string;
  season_id: string;
  final_standings: Record<string, LeagueStandings>;
  champion: { teamName: string; leagueName: string; leagueColor: string; avatar: string | null } | null;
  awards: Record<string, Award> | null;
  archived_at: string;
  seasons: { year: string };
}

export default function SeasonArchivePage() {
  const params = useParams();
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/history/${params.id}`)
      .then((r) => r.json())
      .then((data) => setArchive(data.archive ?? null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="glass-card p-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Archive Not Found</h2>
        <Link href="/history" className="text-primary hover:underline">
          Back to History
        </Link>
      </div>
    );
  }

  const year = archive.seasons?.year ?? 'Unknown';
  const awards = archive.awards;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/history" className="text-primary text-sm hover:underline mb-1 block">
            &larr; All Seasons
          </Link>
          <h1 className="text-3xl font-extrabold text-white">{year} Season</h1>
        </div>
        <span className="text-xs text-text-muted">
          Archived {new Date(archive.archived_at).toLocaleDateString()}
        </span>
      </div>

      {/* Champion banner */}
      {archive.champion && (
        <div className="glass-card p-6 text-center space-y-2 border border-accent-gold/30 bg-accent-gold/5">
          <p className="text-accent-gold text-sm font-semibold uppercase tracking-wider">
            Champion
          </p>
          <div className="flex items-center justify-center gap-3">
            {archive.champion.avatar ? (
              <img src={archive.champion.avatar} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-bg-tertiary" />
            )}
            <div>
              <p className="text-2xl font-extrabold text-white">{archive.champion.teamName}</p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${archive.champion.leagueColor}22`,
                  color: archive.champion.leagueColor,
                }}
              >
                {archive.champion.leagueName}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Awards */}
      {awards && Object.keys(awards).length > 0 && (
        <div className="glass-card p-6 space-y-4">
          <h2 className="font-bold text-white text-lg">Season Awards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {awards.mostPoints && (
              <AwardCard
                title="Most Points Scored"
                value={`${awards.mostPoints.name}`}
                detail={`${awards.mostPoints.points?.toFixed(1)} PF — ${awards.mostPoints.league}`}
                icon="🔥"
              />
            )}
            {awards.bestRecord && (
              <AwardCard
                title="Best Record"
                value={`${awards.bestRecord.name}`}
                detail={`${awards.bestRecord.wins}-${awards.bestRecord.losses} — ${awards.bestRecord.league}`}
                icon="📈"
              />
            )}
            {awards.topPowerRanked && (
              <AwardCard
                title="#1 Power Ranked"
                value={`${awards.topPowerRanked.name}`}
                detail={`Score: ${awards.topPowerRanked.score?.toFixed(1)} — ${awards.topPowerRanked.league}`}
                icon="⚡"
              />
            )}
            {awards.champion && (
              <AwardCard
                title="Champion"
                value={`${awards.champion.name}`}
                detail={`${awards.champion.league}`}
                icon="🏆"
              />
            )}
          </div>
        </div>
      )}

      {/* Final Standings per League */}
      {Object.keys(archive.final_standings).map((leagueId) => {
        const league = archive.final_standings[leagueId];
        if (league.error || !league.standings) return null;

        return (
          <div key={leagueId} className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: league.leagueColor }} />
              <h2 className="font-bold text-white text-lg">{league.leagueName} Final Standings</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-muted text-xs uppercase tracking-wider border-b border-white/10">
                    <th className="text-left py-2 px-2">#</th>
                    <th className="text-left py-2 px-2">Team</th>
                    <th className="text-center py-2 px-2">W</th>
                    <th className="text-center py-2 px-2">L</th>
                    <th className="text-right py-2 px-2">PF</th>
                    <th className="text-right py-2 px-2">PA</th>
                  </tr>
                </thead>
                <tbody>
                  {league.standings.map((entry, i) => {
                    const t = entry.team;
                    return (
                      <tr
                        key={t.rosterId}
                        className={`border-b border-white/5 ${entry.inPlayoffPosition ? 'bg-accent-green/5' : ''}`}
                      >
                        <td className="py-2 px-2 text-text-muted">{i + 1}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            {t.avatar ? (
                              <img src={t.avatar} alt="" className="w-6 h-6 rounded-full bg-bg-tertiary" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-bg-tertiary" />
                            )}
                            <span className="text-white font-medium truncate">
                              {t.teamName ?? t.displayName}
                            </span>
                            {entry.inPlayoffPosition && (
                              <span className="text-accent-green text-[10px]">*</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center text-accent-green stat">{t.wins}</td>
                        <td className="py-2 px-2 text-center text-accent-red stat">{t.losses}</td>
                        <td className="py-2 px-2 text-right stat text-white">{t.pointsFor.toFixed(1)}</td>
                        <td className="py-2 px-2 text-right stat text-text-muted">{t.pointsAgainst.toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-text-muted">* Playoff qualifier</p>
          </div>
        );
      })}
    </div>
  );
}

function AwardCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-bg-tertiary flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider">{title}</p>
        <p className="text-white font-bold">{value}</p>
        <p className="text-text-secondary text-xs">{detail}</p>
      </div>
    </div>
  );
}
