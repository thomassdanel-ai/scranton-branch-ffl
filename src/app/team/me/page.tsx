import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { getMemberScope } from '@/lib/member-scope';

type WeeklyRow = {
  week: number;
  points: number;
  opponent_roster_id: number | null;
  opponent_points: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  is_playoff: boolean;
  is_bracket: boolean;
};

type OpponentIdentity = {
  memberSeasonId: string;
  rosterId: number;
  name: string;
};

export const dynamic = 'force-dynamic';

export default async function TeamMePage() {
  const scope = await getMemberScope();
  if (!scope) redirect('/identify?next=/team/me');

  const supabase = createServiceClient();

  // Season & league context
  const { data: ms } = await supabase
    .from('member_seasons')
    .select('sleeper_roster_id, season_id, league_id, leagues(name, color, sleeper_league_id)')
    .eq('id', scope.memberSeasonId)
    .single();

  const league = ms?.leagues as unknown as
    | { name: string; color: string; sleeper_league_id: string | null }
    | null;

  // All my weekly results this season, oldest first for the trend chart.
  const { data: myRaw } = await supabase
    .from('weekly_results')
    .select('week, points, opponent_roster_id, opponent_points, result, is_playoff, is_bracket')
    .eq('member_season_id', scope.memberSeasonId)
    .eq('is_bracket', false)
    .order('week', { ascending: true });

  const myResults = (myRaw ?? []) as WeeklyRow[];

  // League-mates so we can show opponent names in H2H.
  const { data: leagueMates } = await supabase
    .from('member_seasons')
    .select('id, sleeper_roster_id, members(display_name, full_name)')
    .eq('league_id', ms?.league_id ?? '');

  const opponents = new Map<number, OpponentIdentity>();
  for (const lm of leagueMates ?? []) {
    if (lm.id === scope.memberSeasonId) continue;
    if (typeof lm.sleeper_roster_id !== 'number') continue;
    const m = lm.members as unknown as { display_name: string | null; full_name: string } | null;
    opponents.set(lm.sleeper_roster_id, {
      memberSeasonId: lm.id,
      rosterId: lm.sleeper_roster_id,
      name: m?.display_name || m?.full_name || `Roster ${lm.sleeper_roster_id}`,
    });
  }

  // Aggregates
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let pf = 0;
  let pa = 0;
  let streak: { type: 'W' | 'L' | 'T' | null; count: number } = { type: null, count: 0 };
  let best: WeeklyRow | null = null;
  let worst: WeeklyRow | null = null;

  for (const r of myResults) {
    if (r.result === 'win') wins++;
    else if (r.result === 'loss') losses++;
    else if (r.result === 'tie') ties++;
    pf += r.points ?? 0;
    pa += r.opponent_points ?? 0;

    const tag = r.result === 'win' ? 'W' : r.result === 'loss' ? 'L' : r.result === 'tie' ? 'T' : null;
    if (tag && tag === streak.type) streak.count++;
    else if (tag) streak = { type: tag, count: 1 };

    if (!best || (r.points ?? 0) > (best.points ?? 0)) best = r;
    if (!worst || (r.points ?? Infinity) < (worst.points ?? Infinity)) worst = r;
  }

  // H2H map: opponent rosterId -> {wins, losses, myPts, theirPts}
  type H2H = { opp: OpponentIdentity; wins: number; losses: number; myPts: number; theirPts: number };
  const h2h = new Map<number, H2H>();
  for (const r of myResults) {
    if (r.opponent_roster_id == null) continue;
    const opp = opponents.get(r.opponent_roster_id);
    if (!opp) continue;
    const rec = h2h.get(opp.rosterId) ?? { opp, wins: 0, losses: 0, myPts: 0, theirPts: 0 };
    if (r.result === 'win') rec.wins++;
    else if (r.result === 'loss') rec.losses++;
    rec.myPts += r.points ?? 0;
    rec.theirPts += r.opponent_points ?? 0;
    h2h.set(opp.rosterId, rec);
  }
  const h2hSorted = Array.from(h2h.values()).sort(
    (a, b) => b.wins + b.losses - (a.wins + a.losses) || b.wins - a.wins,
  );

  // Chart scale for week-by-week
  const maxPoints = Math.max(
    100,
    ...myResults.map((r) => Math.max(r.points ?? 0, r.opponent_points ?? 0)),
  );

  const gamesPlayed = myResults.length;
  const avgPf = gamesPlayed > 0 ? pf / gamesPlayed : 0;
  const avgPa = gamesPlayed > 0 ? pa / gamesPlayed : 0;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="text-text-muted text-sm uppercase tracking-widest mb-1">
          Regional Manager&apos;s Desk
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white">
          {scope.memberName}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-text-secondary">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: league?.color || '#888' }}
          />
          <span className="font-semibold">{league?.name ?? scope.leagueName}</span>
        </div>
      </div>

      {gamesPlayed === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Top stats */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              label="Record"
              value={`${wins}–${losses}${ties ? `–${ties}` : ''}`}
            />
            <StatCard
              label="Streak"
              value={streak.type ? `${streak.type}${streak.count}` : '—'}
              tone={streak.type === 'W' ? 'good' : streak.type === 'L' ? 'bad' : 'neutral'}
            />
            <StatCard
              label="Points For"
              value={pf.toFixed(1)}
              sub={`${avgPf.toFixed(1)} / game`}
            />
            <StatCard
              label="Points Against"
              value={pa.toFixed(1)}
              sub={`${avgPa.toFixed(1)} / game`}
            />
          </section>

          {/* Week-by-week bar chart */}
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">
              Season Arc
            </h2>
            <div className="bg-bg-secondary/60 border border-bg-tertiary rounded-xl p-4 overflow-x-auto">
              <div className="flex items-end gap-2 min-w-[600px]">
                {myResults.map((r) => {
                  const myHeight = ((r.points ?? 0) / maxPoints) * 100;
                  const oppHeight = ((r.opponent_points ?? 0) / maxPoints) * 100;
                  const color =
                    r.result === 'win'
                      ? 'bg-green-500'
                      : r.result === 'loss'
                        ? 'bg-red-500'
                        : 'bg-amber-500';
                  return (
                    <div key={r.week} className="flex-1 flex flex-col items-center gap-1">
                      <div className="h-40 w-full flex items-end gap-0.5">
                        <div
                          className={`flex-1 rounded-t ${color} transition-all`}
                          style={{ height: `${myHeight}%` }}
                          title={`Wk ${r.week} — ${(r.points ?? 0).toFixed(1)} pts`}
                        />
                        <div
                          className="flex-1 rounded-t bg-bg-tertiary"
                          style={{ height: `${oppHeight}%` }}
                          title={`Opp — ${(r.opponent_points ?? 0).toFixed(1)} pts`}
                        />
                      </div>
                      <div className="text-[10px] text-text-muted font-mono">W{r.week}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
                <LegendDot className="bg-green-500" /> Win
                <LegendDot className="bg-red-500" /> Loss
                <LegendDot className="bg-amber-500" /> Tie
                <LegendDot className="bg-bg-tertiary" /> Opponent
              </div>
            </div>
          </section>

          {/* Best / Worst */}
          {(best || worst) && (
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
              {best && (
                <Highlight
                  title="Best Week"
                  week={best.week}
                  points={best.points}
                  opp={best.opponent_points}
                  tone="good"
                />
              )}
              {worst && worst !== best && (
                <Highlight
                  title="Worst Week"
                  week={worst.week}
                  points={worst.points}
                  opp={worst.opponent_points}
                  tone="bad"
                />
              )}
            </section>
          )}

          {/* H2H Rivalries */}
          {h2hSorted.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs uppercase tracking-widest text-text-muted font-semibold mb-3">
                Head-to-Head
              </h2>
              <div className="bg-bg-secondary/60 border border-bg-tertiary rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-tertiary/50 text-text-muted text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2 font-semibold">Opponent</th>
                      <th className="text-center px-3 py-2 font-semibold">Record</th>
                      <th className="text-right px-3 py-2 font-semibold">PF</th>
                      <th className="text-right px-4 py-2 font-semibold">PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2hSorted.map((row) => {
                      const total = row.wins + row.losses;
                      const winning = row.wins > row.losses;
                      return (
                        <tr
                          key={row.opp.rosterId}
                          className="border-t border-bg-tertiary/60 hover:bg-bg-tertiary/20"
                        >
                          <td className="px-4 py-2.5 text-white font-medium">{row.opp.name}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`font-mono ${
                                total === 0
                                  ? 'text-text-muted'
                                  : winning
                                    ? 'text-green-400'
                                    : row.wins < row.losses
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                              }`}
                            >
                              {row.wins}–{row.losses}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                            {row.myPts.toFixed(1)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-text-muted">
                            {row.theirPts.toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <div className="mt-10 text-xs text-text-muted">
        Not you?{' '}
        <Link href="/identify" className="text-primary hover:underline">
          Switch member
        </Link>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad' | 'neutral';
}) {
  const valueColor =
    tone === 'good' ? 'text-green-400' : tone === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="bg-bg-secondary/60 border border-bg-tertiary rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function Highlight({
  title,
  week,
  points,
  opp,
  tone,
}: {
  title: string;
  week: number;
  points: number | null;
  opp: number | null;
  tone: 'good' | 'bad';
}) {
  const accent = tone === 'good' ? 'border-green-500/40 bg-green-500/5' : 'border-red-500/40 bg-red-500/5';
  return (
    <div className={`rounded-xl border ${accent} p-4`}>
      <div className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">
        {title}
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-3xl font-bold text-white">{(points ?? 0).toFixed(1)}</span>
        <span className="text-sm text-text-muted">vs {(opp ?? 0).toFixed(1)} · Week {week}</span>
      </div>
    </div>
  );
}

function LegendDot({ className }: { className: string }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-xs ${className}`} />;
}

function EmptyState() {
  return (
    <div className="bg-bg-secondary/60 border border-bg-tertiary rounded-xl p-10 text-center">
      <div className="text-4xl mb-3">📠</div>
      <div className="text-white font-semibold text-lg mb-1">No games on the board yet.</div>
      <div className="text-text-muted text-sm">
        Faxing preseason numbers to corporate. Your dashboard lights up the second Week 1 kicks off.
      </div>
    </div>
  );
}
