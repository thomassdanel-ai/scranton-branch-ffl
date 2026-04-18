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

  const { data: ms } = await supabase
    .from('member_seasons')
    .select('sleeper_roster_id, season_id, league_id, leagues(name, color, sleeper_league_id)')
    .eq('id', scope.memberSeasonId)
    .single();

  const league = ms?.leagues as unknown as
    | { name: string; color: string; sleeper_league_id: string | null }
    | null;

  const { data: myRaw } = await supabase
    .from('weekly_results')
    .select('week, points, opponent_roster_id, opponent_points, result, is_playoff, is_bracket')
    .eq('member_season_id', scope.memberSeasonId)
    .eq('is_bracket', false)
    .order('week', { ascending: true });

  const myResults = (myRaw ?? []) as WeeklyRow[];

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

  const maxPoints = Math.max(
    100,
    ...myResults.map((r) => Math.max(r.points ?? 0, r.opponent_points ?? 0)),
  );

  const gamesPlayed = myResults.length;
  const avgPf = gamesPlayed > 0 ? pf / gamesPlayed : 0;
  const avgPa = gamesPlayed > 0 ? pa / gamesPlayed : 0;

  return (
    <main className="col col--lg" style={{ maxWidth: 1040, padding: '32px 16px' }}>
      <div className="page-hero">
        <div className="page-hero__kicker">Regional Manager&apos;s Desk</div>
        <h1 className="page-hero__title">{scope.memberName}</h1>
        <div className="row" style={{ marginTop: 6, alignItems: 'center' }}>
          <span
            style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: league?.color || 'var(--ink-5)',
            }}
          />
          <span style={{ color: 'var(--ink-7)', font: '600 var(--fs-14) / 1 var(--font-sans)' }}>
            {league?.name ?? scope.leagueName}
          </span>
        </div>
      </div>

      {gamesPlayed === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section className="stat-grid">
            <StatCard
              label="Record"
              value={`${wins}\u2013${losses}${ties ? `\u2013${ties}` : ''}`}
            />
            <StatCard
              label="Streak"
              value={streak.type ? `${streak.type}${streak.count}` : '\u2014'}
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

          <section>
            <div className="label" style={{ marginBottom: 8 }}>Season Arc</div>
            <div className="bar-chart">
              <div className="bar-chart__track">
                {myResults.map((r) => {
                  const myHeight = ((r.points ?? 0) / maxPoints) * 100;
                  const oppHeight = ((r.opponent_points ?? 0) / maxPoints) * 100;
                  const barCls =
                    r.result === 'win'
                      ? 'bar-chart__bar bar-chart__bar--win'
                      : r.result === 'loss'
                        ? 'bar-chart__bar bar-chart__bar--loss'
                        : 'bar-chart__bar bar-chart__bar--tie';
                  return (
                    <div key={r.week} className="bar-chart__col">
                      <div className="bar-chart__bars">
                        <div
                          className={barCls}
                          style={{ height: `${myHeight}%` }}
                          title={`Wk ${r.week} — ${(r.points ?? 0).toFixed(1)} pts`}
                        />
                        <div
                          className="bar-chart__bar bar-chart__bar--opp"
                          style={{ height: `${oppHeight}%` }}
                          title={`Opp — ${(r.opponent_points ?? 0).toFixed(1)} pts`}
                        />
                      </div>
                      <div className="bar-chart__wk">W{r.week}</div>
                    </div>
                  );
                })}
              </div>
              <div className="bar-chart__legend">
                <span className="bar-chart__legend-item"><span className="bar-chart__dot bar-chart__dot--win" /> Win</span>
                <span className="bar-chart__legend-item"><span className="bar-chart__dot bar-chart__dot--loss" /> Loss</span>
                <span className="bar-chart__legend-item"><span className="bar-chart__dot bar-chart__dot--tie" /> Tie</span>
                <span className="bar-chart__legend-item"><span className="bar-chart__dot bar-chart__dot--opp" /> Opponent</span>
              </div>
            </div>
          </section>

          {(best || worst) && (
            <section className="hl-grid">
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

          {h2hSorted.length > 0 && (
            <section>
              <div className="label" style={{ marginBottom: 8 }}>Head-to-Head</div>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Opponent</th>
                      <th style={{ textAlign: 'center' }}>Record</th>
                      <th style={{ textAlign: 'right' }}>PF</th>
                      <th style={{ textAlign: 'right' }}>PA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {h2hSorted.map((row) => {
                      const total = row.wins + row.losses;
                      const recCls =
                        total === 0
                          ? 'h2h-rec--none'
                          : row.wins > row.losses
                            ? 'h2h-rec--win'
                            : row.wins < row.losses
                              ? 'h2h-rec--loss'
                              : 'h2h-rec--tie';
                      return (
                        <tr key={row.opp.rosterId}>
                          <td>{row.opp.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={recCls}>
                              {row.wins}&ndash;{row.losses}
                            </span>
                          </td>
                          <td className="data-table__muted" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {row.myPts.toFixed(1)}
                          </td>
                          <td className="data-table__muted" style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
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

      <div style={{ marginTop: 24, color: 'var(--ink-5)', font: '500 var(--fs-12) / 1 var(--font-mono)' }}>
        Not you?{' '}
        <Link href="/identify" className="action-link action-link--live">Switch member</Link>
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
  const valCls =
    tone === 'good' ? 'stat-card__val stat-card__val--good' :
    tone === 'bad' ? 'stat-card__val stat-card__val--bad' : 'stat-card__val';
  return (
    <div className="stat-card">
      <div className="stat-card__lab">{label}</div>
      <div className={valCls}>{value}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
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
  return (
    <div className={`hl-tile hl-tile--${tone}`}>
      <div className="hl-tile__lab">{title}</div>
      <div className="hl-tile__body">
        <span className="hl-tile__big">{(points ?? 0).toFixed(1)}</span>
        <span className="hl-tile__note">vs {(opp ?? 0).toFixed(1)} &middot; Week {week}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>&#128224;</div>
      <div className="empty-state__title">No games on the board yet.</div>
      <div className="empty-state__body">
        Faxing preseason numbers to corporate. Your dashboard lights up the second Week 1 kicks off.
      </div>
    </div>
  );
}
