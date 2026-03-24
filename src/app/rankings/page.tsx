import { computePowerRankings } from '@/lib/rankings/compute';
import PowerRankingsTable from '@/components/rankings/PowerRankingsTable';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Power Rankings',
};

export default async function PowerRankingsPage() {
  const rankings = await computePowerRankings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Cross-League Power Rankings
        </h1>
        <p className="text-text-secondary text-sm mt-1">
          All {rankings.length} teams ranked by composite score — win%, points scored, schedule luck, and momentum.
        </p>
      </div>

      {/* Formula explanation */}
      <div className="glass-card p-4 text-xs text-text-muted">
        <p className="font-semibold text-text-secondary mb-1">How it works</p>
        <p>
          Power Score = (Win% × 40) + (Points For Rank × 35) + (Schedule Luck × 15) + (Streak × 10).
          Luck measures how your actual record compares to your expected record if you played every team every week.
        </p>
        <p className="mt-1 text-text-muted italic">
          Note: Playoff qualification is determined by W/L record with total points as tiebreaker — not power score.
        </p>
      </div>

      <PowerRankingsTable rankings={rankings} />
    </div>
  );
}
