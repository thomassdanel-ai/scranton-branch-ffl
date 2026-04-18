'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface StandingsTeam {
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
  rank: number;
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
  champion: {
    teamName: string;
    leagueName: string;
    leagueColor: string;
    avatar: string | null;
  } | null;
  awards: Record<string, Award> | null;
  archived_at: string;
  seasons: { year: string };
}

function AwardCell({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="award-cell">
      <span className="award-cell__lab">{title}</span>
      <span className="award-cell__name">{value}</span>
      <span className="award-cell__detail">{detail}</span>
    </div>
  );
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
      <div className="wrap" style={{ padding: '64px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--ink-5)' }}>Loading archive...</p>
      </div>
    );
  }

  if (!archive) {
    return (
      <div className="wrap">
        <div
          className="surface-raised"
          style={{ padding: 48, textAlign: 'center', margin: '32px 0' }}
        >
          <div
            className="font-display"
            style={{
              fontSize: 32,
              color: 'var(--ink-8)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--tr-wide)',
              marginBottom: 12,
            }}
          >
            ARCHIVE NOT FOUND
          </div>
          <Link href="/history" className="btn btn--ghost">
            ← Back to History
          </Link>
        </div>
      </div>
    );
  }

  const year = archive.seasons?.year ?? 'Unknown';
  const awards = archive.awards;

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <Link href="/history">HISTORY</Link>
        <span className="sep">/</span>
        <b>{year}</b>
      </div>

      <div className="wrap">
        <section className="hist-head">
          <Link href="/history" className="hist-back">
            ← ALL SEASONS
          </Link>
          <div className="kicker">
            <span className="kicker__dot" />
            ARCHIVED{' '}
            {new Date(archive.archived_at)
              .toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
              .toUpperCase()}
          </div>
          <h1>
            {year} <em>SEASON.</em>
          </h1>
        </section>

        {archive.champion && (
          <div className="hist-champ-banner">
            <span className="kick">★ CHAMPION · {year}</span>
            <h2 className="name">{archive.champion.teamName}</h2>
            <span
              className="chip"
              style={{
                background: `${archive.champion.leagueColor}22`,
                color: archive.champion.leagueColor,
                borderColor: `${archive.champion.leagueColor}55`,
              }}
            >
              {archive.champion.leagueName}
            </span>
          </div>
        )}

        {awards && Object.keys(awards).length > 0 && (
          <section style={{ margin: '32px 0 24px' }}>
            <div
              className="label"
              style={{
                paddingBottom: 10,
                borderBottom: 'var(--hairline-strong)',
                marginBottom: 16,
              }}
            >
              SEASON AWARDS
            </div>
            <div className="awards-grid">
              {awards.mostPoints && (
                <AwardCell
                  title="MOST POINTS"
                  value={awards.mostPoints.name ?? ''}
                  detail={`${awards.mostPoints.points?.toFixed(1) ?? '—'} PF · ${awards.mostPoints.league ?? ''}`}
                />
              )}
              {awards.bestRecord && (
                <AwardCell
                  title="BEST RECORD"
                  value={awards.bestRecord.name ?? ''}
                  detail={`${awards.bestRecord.wins}·${awards.bestRecord.losses} · ${awards.bestRecord.league ?? ''}`}
                />
              )}
              {awards.topPowerRanked && (
                <AwardCell
                  title="#1 POWER RANK"
                  value={awards.topPowerRanked.name ?? ''}
                  detail={`${awards.topPowerRanked.score?.toFixed(1) ?? '—'} · ${awards.topPowerRanked.league ?? ''}`}
                />
              )}
              {awards.champion && (
                <AwardCell
                  title="DUNDIE WINNER"
                  value={awards.champion.name ?? ''}
                  detail={awards.champion.league ?? ''}
                />
              )}
            </div>
          </section>
        )}

        {Object.keys(archive.final_standings).map((leagueId) => {
          const league = archive.final_standings[leagueId];
          if (league.error || !league.standings) return null;

          return (
            <div key={leagueId} className="hist-standings">
              <div className="hist-standings__hdr">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: league.leagueColor,
                  }}
                />
                <h3>{league.leagueName} · FINAL STANDINGS</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>TEAM</th>
                    <th>W</th>
                    <th>L</th>
                    <th className="right" style={{ textAlign: 'right' }}>PF</th>
                    <th className="right" style={{ textAlign: 'right' }}>PA</th>
                  </tr>
                </thead>
                <tbody>
                  {league.standings.map((entry, i) => (
                    <tr key={entry.rosterId} className={entry.inPlayoffPosition ? 'playoff' : ''}>
                      <td>{String(i + 1).padStart(2, '0')}</td>
                      <td className="team">
                        {entry.teamName ?? entry.displayName}
                        {entry.inPlayoffPosition && (
                          <span style={{ color: 'var(--accent-live)', marginLeft: 6 }}>★</span>
                        )}
                      </td>
                      <td className="win">{entry.wins}</td>
                      <td className="loss">{entry.losses}</td>
                      <td className="right">{entry.pointsFor.toFixed(1)}</td>
                      <td className="right" style={{ color: 'var(--ink-5)' }}>
                        {entry.pointsAgainst.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <p
          className="label"
          style={{ padding: '0 0 48px', color: 'var(--ink-5)' }}
        >
          ★ = PLAYOFF QUALIFIER
        </p>
      </div>
    </>
  );
}
