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

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>HISTORY</b>
      </div>

      <div className="wrap">
        <section className="hist-head">
          <div className="kicker">
            <span className="kicker__dot" />
            {loading ? 'LOADING ARCHIVE' : `${archives.length} SEASONS ARCHIVED`}
          </div>
          <h1>
            THE <em>RECORD</em>
            <br />
            BOOK.
          </h1>
          <p className="sub">
            Past seasons preserved for all time. Every champion, every standing, every awkward
            pre-draft message screenshotted and saved.
          </p>
        </section>

        {loading ? (
          <div
            className="surface-raised"
            style={{ padding: 40, textAlign: 'center', margin: '24px 0' }}
          >
            <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>Loading archive...</p>
          </div>
        ) : archives.length === 0 ? (
          <div
            className="surface-raised"
            style={{
              padding: 48,
              textAlign: 'center',
              margin: '24px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 36,
                letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)',
                textTransform: 'uppercase',
              }}
            >
              NO ARCHIVES YET
            </div>
            <p style={{ color: 'var(--ink-6)', maxWidth: 480, margin: '0 auto', fontSize: 'var(--fs-14)' }}>
              Season archives will appear here after the commissioner snapshots a completed season
              from the admin panel.
            </p>
          </div>
        ) : (
          <div className="hist-grid">
            {archives.map((archive) => {
              const year = archive.seasons?.year ?? 'Unknown';
              const champion = archive.champion;
              const awards = archive.awards as Record<
                string,
                { name?: string; league?: string }
              > | null;

              return (
                <Link key={archive.id} href={`/history/${archive.id}`} className="hist-card">
                  <div className="hist-card__hdr">
                    <span className="hist-card__year">{year}</span>
                    <span className="hist-card__date">
                      ARCHIVED {new Date(archive.archived_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      }).toUpperCase()}
                    </span>
                  </div>

                  {champion ? (
                    <div className="hist-card__champ">
                      <span className="icon">★</span>
                      <span className="name">{champion.teamName}</span>
                      <span
                        className="chip"
                        style={{
                          background: `${champion.leagueColor}22`,
                          color: champion.leagueColor,
                          borderColor: `${champion.leagueColor}55`,
                        }}
                      >
                        {champion.leagueName}
                      </span>
                    </div>
                  ) : (
                    <p className="hist-card__note">No champion recorded</p>
                  )}

                  {awards?.bestRecord && (
                    <p className="hist-card__note">
                      Best Record · {awards.bestRecord.name} ({awards.bestRecord.league})
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
