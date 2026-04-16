import { computePowerRankings } from '@/lib/rankings/compute';
import { getSeasonStatus } from '@/lib/config';
import PowerRankingsTable from '@/components/rankings/PowerRankingsTable';
import OffSeasonBanner from '@/components/ui/OffSeasonBanner';
import Card from '@/components/ui/Card';
import KickerLabel from '@/components/ui/KickerLabel';
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

export default async function PowerRankingsPage() {
  const [rankings, status] = await Promise.all([computePowerRankings(), getSeasonStatus()]);

  return (
    <div className="space-y-8">
      {status.isOffSeason && <OffSeasonBanner year={status.year} />}

      {/* ================= HEADER ================= */}
      <section className="pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <KickerLabel tone="magenta">Cross-League Rankings</KickerLabel>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
            {status.year} · Week current
          </span>
        </div>

        <h1 className="font-display font-bold text-[clamp(2.25rem,5vw,3.75rem)] leading-[0.95] tracking-[-0.04em] text-text-primary">
          Every team,{' '}
          <span className="text-aurora-mag-cyan">one ladder.</span>
        </h1>
        <p className="mt-4 text-text-secondary max-w-xl leading-relaxed">
          {rankings.length} teams ranked by composite score — blending win rate, points scored,
          schedule luck, and momentum into a single number.
        </p>
      </section>

      {/* ================= FORMULA CARD ================= */}
      <Card padding="lg" className="relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="md:w-52 shrink-0">
            <KickerLabel tone="cyan">The Formula</KickerLabel>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted mt-3">
              Power Score
            </p>
          </div>

          <div className="flex-1">
            {/* Formula breakdown row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Win %', weight: 40, color: '#E056FF' },
                { label: 'Points For', weight: 35, color: '#56F0FF' },
                { label: 'Luck', weight: 15, color: '#CCFF56' },
                { label: 'Streak', weight: 10, color: '#9D7FFF' },
              ].map((f) => (
                <div
                  key={f.label}
                  className="rounded-xl border border-hairline p-3"
                  style={{ background: 'rgba(255,255,255,0.015)' }}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-text-muted">
                      {f.label}
                    </span>
                    <span
                      className="stat font-display font-bold text-2xl leading-none"
                      style={{ color: f.color }}
                    >
                      {f.weight}
                    </span>
                  </div>
                  <div className="mt-2 h-[3px] rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.weight * 2.5}%`, backgroundColor: f.color }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[13px] text-text-secondary leading-relaxed">
              Luck measures actual record vs. expected record against every opponent each week.
              Streak weights recent momentum into the final number.
            </p>
            <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-text-muted italic">
              Note · Playoff seeding is W/L with total points as tiebreaker, not this score.
            </p>
          </div>
        </div>
      </Card>

      {/* ================= RANKINGS LIST ================= */}
      <PowerRankingsTable rankings={rankings} />
    </div>
  );
}
