import Link from 'next/link';
import { computePowerRankings } from '@/lib/rankings/compute';
import { getSeasonStatus } from '@/lib/config';
import PowerRankingsTable from '@/components/rankings/PowerRankingsTable';
import PhaseStrip from '@/components/layout/PhaseStrip';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Power Rankings',
  description:
    'Cross-league power rankings — all teams ranked by composite score using win%, points, luck, and momentum.',
  openGraph: {
    title: 'Power Rankings | Scranton Branch FFL',
    description: 'Cross-league power rankings — all teams ranked by composite score.',
  },
};

const FORMULA = [
  { label: 'WIN %', weight: 40 },
  { label: 'POINTS FOR', weight: 35 },
  { label: 'LUCK', weight: 15 },
  { label: 'STREAK', weight: 10 },
];

export default async function PowerRankingsPage() {
  const [rankings, status] = await Promise.all([computePowerRankings(), getSeasonStatus()]);

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>RANKINGS</b>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <div className="wrap">
        <section className="rnk-head">
          <div>
            <div className="kicker">
              <span className="kicker__dot" />
              CROSS-LEAGUE POWER RANKINGS · {status.year}
            </div>
            <h1>
              EVERY TEAM,
              <br />
              ONE <em>LADDER.</em>
            </h1>
            <p className="sub">
              {rankings.length} teams ranked by a composite score — blending win rate, points
              scored, schedule luck, and momentum into one number. Seeding is W/L with PF as
              tiebreaker; this is just for bragging rights.
            </p>
          </div>
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              THE FORMULA
            </div>
            <div className="formula-grid">
              {FORMULA.map((f) => (
                <div key={f.label} className="formula-cell">
                  <div className="formula-cell__hdr">
                    <span className="formula-cell__lab">{f.label}</span>
                    <span className="formula-cell__val">{f.weight}</span>
                  </div>
                  <div className="formula-cell__bar">
                    <div className="formula-cell__fill" style={{ width: `${f.weight * 2.5}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                fontSize: 'var(--fs-12)',
                color: 'var(--ink-5)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tr-wide)',
                marginTop: 8,
                lineHeight: 1.5,
              }}
            >
              Luck = actual record vs. expected record against all opponents each week. Streak
              weights recent momentum.
            </p>
          </div>
        </section>

        <PowerRankingsTable rankings={rankings} />
      </div>
    </>
  );
}
