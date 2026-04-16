import Link from 'next/link';
import { getSeasonLeagues, getSeasonStatus, getActiveSeasonId } from '@/lib/config';
import { computePowerRankings } from '@/lib/rankings/compute';
import { loadBracket, computeBracketStatus } from '@/lib/bracket/engine';
import { createServiceClient } from '@/lib/supabase/server';
import { ORG_NAME } from '@/config/constants';
import OffSeasonBanner from '@/components/ui/OffSeasonBanner';
import Card from '@/components/ui/Card';
import KickerLabel from '@/components/ui/KickerLabel';

export const dynamic = 'force-dynamic';

type MatchupData = {
  leagueName: string;
  leagueColor: string;
  leagueSleeperIds: string;
  matchups: { team1: string; team1Score: number; team2: string; team2Score: number }[];
  week: number;
};

type TransactionPreview = {
  type: string;
  playerNames: string[];
  leagueName: string;
  leagueColor: string;
};

async function getMatchupPreviews(
  seasonId: string,
  leagues: Awaited<ReturnType<typeof getSeasonLeagues>>,
): Promise<MatchupData[]> {
  const supabase = createServiceClient();

  const { data: latestSnap } = await supabase
    .from('league_snapshots')
    .select('week')
    .eq('season_id', seasonId)
    .order('week', { ascending: false })
    .limit(1)
    .single();

  if (!latestSnap) return [];

  const week = latestSnap.week;
  const leagueSleeperIds = leagues.map((l) => l.sleeperId).filter(Boolean);

  const { data: snapshots } = await supabase
    .from('league_snapshots')
    .select('league_id, matchups')
    .eq('season_id', seasonId)
    .eq('week', week)
    .in('league_id', leagueSleeperIds.length > 0 ? leagueSleeperIds : ['_none_']);

  if (!snapshots || snapshots.length === 0) return [];

  const leagueLookup: Record<string, typeof leagues[0]> = {};
  for (const l of leagues) {
    leagueLookup[l.sleeperId] = l;
  }

  const results: MatchupData[] = [];
  for (const snap of snapshots) {
    const league = leagueLookup[snap.league_id];
    if (!league) continue;

    const rawMatchups = snap.matchups as Array<{
      matchup_id: number;
      team1?: { displayName?: string; teamName?: string; points?: number };
      team2?: { displayName?: string; teamName?: string; points?: number };
    }> | null;

    if (!rawMatchups || !Array.isArray(rawMatchups)) continue;

    const matchups = rawMatchups.slice(0, 3).map((m) => ({
      team1: m.team1?.teamName || m.team1?.displayName || 'Team 1',
      team1Score: m.team1?.points ?? 0,
      team2: m.team2?.teamName || m.team2?.displayName || 'Team 2',
      team2Score: m.team2?.points ?? 0,
    }));

    results.push({
      leagueName: league.name,
      leagueColor: league.color,
      leagueSleeperIds: league.sleeperId,
      matchups,
      week,
    });
  }

  return results;
}

async function getRecentTransactions(
  seasonId: string,
  leagues: Awaited<ReturnType<typeof getSeasonLeagues>>,
): Promise<TransactionPreview[]> {
  const supabase = createServiceClient();

  const leagueSleeperIds = leagues.map((l) => l.sleeperId).filter(Boolean);

  const { data } = await supabase
    .from('transactions_cache')
    .select('league_id, transactions')
    .eq('season_id', seasonId)
    .in('league_id', leagueSleeperIds.length > 0 ? leagueSleeperIds : ['_none_'])
    .order('week', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return [];

  const leagueLookup: Record<string, typeof leagues[0]> = {};
  for (const l of leagues) {
    leagueLookup[l.sleeperId] = l;
  }

  const playerIdSet = new Set<string>();
  for (const row of data) {
    const txns = row.transactions as Array<{
      type: string;
      status: string;
      adds?: Record<string, number> | null;
      drops?: Record<string, number> | null;
    }>;
    if (!Array.isArray(txns)) continue;
    for (const txn of txns) {
      if (txn.status !== 'complete') continue;
      if (txn.adds) Object.keys(txn.adds).forEach((id) => playerIdSet.add(id));
      if (txn.drops) Object.keys(txn.drops).forEach((id) => playerIdSet.add(id));
    }
  }

  const playerIds = Array.from(playerIdSet).slice(0, 100);
  const playerNames: Record<string, string> = {};
  if (playerIds.length > 0) {
    const { data: players } = await supabase
      .from('players_normalized')
      .select('player_id, full_name')
      .in('player_id', playerIds);
    if (players) {
      for (const p of players) {
        playerNames[p.player_id] = p.full_name;
      }
    }
  }

  const results: TransactionPreview[] = [];
  for (const row of data) {
    const league = leagueLookup[row.league_id];
    if (!league) continue;
    const txns = row.transactions as Array<{
      type: string;
      status: string;
      adds?: Record<string, number> | null;
      drops?: Record<string, number> | null;
      created: number;
    }>;
    if (!Array.isArray(txns)) continue;

    const completed = txns
      .filter((t) => t.status === 'complete')
      .sort((a, b) => b.created - a.created);

    for (const txn of completed.slice(0, 5)) {
      const names: string[] = [];
      if (txn.adds) {
        for (const id of Object.keys(txn.adds)) {
          names.push(playerNames[id] || `Player ${id.slice(0, 6)}`);
        }
      }
      if (names.length === 0 && txn.drops) {
        for (const id of Object.keys(txn.drops)) {
          names.push(playerNames[id] || `Player ${id.slice(0, 6)}`);
        }
      }
      results.push({
        type: txn.type === 'trade' ? 'TRADE' : txn.type === 'waiver' ? 'WAIVER' : 'FA',
        playerNames: names.slice(0, 3),
        leagueName: league.name,
        leagueColor: league.color,
      });
      if (results.length >= 8) break;
    }
    if (results.length >= 8) break;
  }

  return results;
}

const TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  TRADE: {
    bg: 'rgba(157,127,255,0.14)',
    color: '#B8A4FF',
    border: 'rgba(157,127,255,0.4)',
  },
  WAIVER: {
    bg: 'rgba(86,240,255,0.12)',
    color: '#7FE9FF',
    border: 'rgba(86,240,255,0.35)',
  },
  FA: {
    bg: 'rgba(204,255,86,0.14)',
    color: '#D9FF7A',
    border: 'rgba(204,255,86,0.4)',
  },
};

export default async function HomePage() {
  const [leagues, status] = await Promise.all([getSeasonLeagues(), getSeasonStatus()]);

  const seasonId = await getActiveSeasonId();

  const [matchupData, rankingsData, transactionsData, bracketData] = await Promise.all([
    (async () => {
      if (!seasonId || status.isOffSeason) return null;
      try {
        return await getMatchupPreviews(seasonId, leagues);
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        const rankings = await computePowerRankings();
        return rankings.slice(0, 5);
      } catch {
        return null;
      }
    })(),
    (async () => {
      if (!seasonId) return null;
      try {
        return await getRecentTransactions(seasonId, leagues);
      } catch {
        return null;
      }
    })(),
    (async () => {
      try {
        return await loadBracket();
      } catch {
        return null;
      }
    })(),
  ]);

  const currentWeek = matchupData?.[0]?.week ?? null;
  const topTeam = rankingsData?.[0] ?? null;

  return (
    <div className="space-y-8">
      {status.isOffSeason && <OffSeasonBanner year={status.year} />}

      {/* ================= HERO ================= */}
      <section className="pt-6 md:pt-10 pb-4">
        <div className="flex items-center gap-3 mb-5">
          <KickerLabel live={!status.isOffSeason} tone="lime">
            {status.isOffSeason ? 'Off-Season' : 'Live · Season in Progress'}
          </KickerLabel>
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
            {status.year} · {ORG_NAME}
          </span>
        </div>

        <h1 className="font-display font-bold text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.9] tracking-[-0.04em] text-text-primary max-w-4xl">
          The league in{' '}
          <span className="text-aurora">one view.</span>
        </h1>
        <p className="mt-5 max-w-xl text-text-secondary text-lg leading-relaxed">
          Scores, power rankings, trades and trash talk across every division — a single heads-up
          display for the whole season.
        </p>

        {/* League quick-jump chips */}
        <div className="mt-7 flex items-center flex-wrap gap-2">
          {leagues.map((league) => (
            <Link
              key={league.sleeperId || league.dbId}
              href={`/leagues/${league.sleeperId}`}
              className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-full transition-all hover:-translate-y-px"
              style={{
                backgroundColor: `${league.color}12`,
                border: `1px solid ${league.color}55`,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: league.color, boxShadow: `0 0 10px ${league.color}` }}
              />
              <span
                className="font-mono text-[11px] uppercase tracking-[0.14em] font-semibold"
                style={{ color: league.color }}
              >
                {league.name}
              </span>
              <span className="text-text-muted text-[11px] group-hover:text-text-primary transition-colors">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= BENTO GRID ================= */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5 auto-rows-[minmax(0,auto)]">
        {/* ----- WEEK READOUT (featured, 4/6) ----- */}
        <Card edge="cyan" padding="lg" className="md:col-span-4 md:row-span-2 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-20 -right-20 h-80 w-80 rounded-full opacity-40 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(86,240,255,0.5) 0%, rgba(86,240,255,0) 70%)',
              filter: 'blur(40px)',
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <KickerLabel live={!status.isOffSeason} tone="cyan">
                Current Week
              </KickerLabel>
              {currentWeek !== null && (
                <Link
                  href={`/leagues/${leagues[0]?.sleeperId}`}
                  className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-cyan transition-colors"
                >
                  All matchups →
                </Link>
              )}
            </div>

            {currentWeek !== null ? (
              <>
                <div className="flex items-baseline gap-6 mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono text-sm uppercase tracking-[0.2em] text-text-muted">
                      Week
                    </span>
                    <span className="stat font-display font-bold text-[clamp(4.5rem,10vw,7.5rem)] leading-none text-aurora-cyan-lime tracking-[-0.04em]">
                      {String(currentWeek).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {matchupData?.map((league) => (
                    <div key={league.leagueSleeperIds}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: league.leagueColor,
                            boxShadow: `0 0 8px ${league.leagueColor}`,
                          }}
                        />
                        <span
                          className="font-mono text-[10.5px] uppercase tracking-[0.18em] font-semibold"
                          style={{ color: league.leagueColor }}
                        >
                          {league.leagueName}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {league.matchups.map((m, i) => {
                          const winner =
                            m.team1Score === m.team2Score
                              ? null
                              : m.team1Score > m.team2Score
                                ? 1
                                : 2;
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/2 transition-colors"
                            >
                              <span
                                className={`truncate flex-1 text-[13px] ${
                                  winner === 1 ? 'text-text-primary font-semibold' : 'text-text-secondary'
                                }`}
                              >
                                {m.team1}
                              </span>
                              <span className="stat text-text-muted text-[11.5px] mx-2 shrink-0">
                                {m.team1Score.toFixed(1)} · {m.team2Score.toFixed(1)}
                              </span>
                              <span
                                className={`truncate flex-1 text-right text-[13px] ${
                                  winner === 2 ? 'text-text-primary font-semibold' : 'text-text-secondary'
                                }`}
                              >
                                {m.team2}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12">
                <div className="font-display font-bold text-6xl text-text-muted mb-4">—</div>
                <p className="text-text-secondary max-w-sm">
                  {status.isOffSeason
                    ? 'The season is complete. Live scores will resume at kickoff.'
                    : 'Matchup scores will populate here as games begin.'}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* ----- POWER LEADER (2/6) ----- */}
        <Card edge="mag" padding="lg" className="md:col-span-2 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-50 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(224,86,255,0.55) 0%, rgba(224,86,255,0) 70%)',
              filter: 'blur(30px)',
            }}
          />
          <div className="relative flex flex-col h-full">
            <KickerLabel tone="magenta">Power Leader</KickerLabel>
            {topTeam ? (
              <>
                <div className="mt-6">
                  <div className="font-mono text-[11px] text-text-muted tracking-[0.2em] uppercase">
                    Rank #01
                  </div>
                  <div className="font-display font-bold text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] tracking-tight text-text-primary mt-1">
                    {topTeam.team.teamName || topTeam.team.displayName}
                  </div>
                  <div
                    className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-[0.14em] uppercase font-semibold"
                    style={{
                      backgroundColor: `${topTeam.leagueColor}1f`,
                      color: topTeam.leagueColor,
                      border: `1px solid ${topTeam.leagueColor}55`,
                    }}
                  >
                    {topTeam.leagueName}
                  </div>
                </div>

                <div className="mt-auto pt-6 flex items-end justify-between">
                  <div>
                    <div className="font-mono text-[10px] text-text-muted tracking-[0.18em] uppercase mb-1">
                      Power Score
                    </div>
                    <div className="stat font-display font-bold text-5xl text-aurora-mag-cyan tracking-[-0.03em]">
                      {topTeam.powerScore.toFixed(1)}
                    </div>
                  </div>
                  <Link
                    href="/rankings"
                    className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-magenta transition-colors"
                  >
                    Full board →
                  </Link>
                </div>
              </>
            ) : (
              <p className="mt-6 text-text-secondary">Rankings populate once the season begins.</p>
            )}
          </div>
        </Card>

        {/* ----- BRACKET STATUS (2/6) ----- */}
        <Card edge="lime" padding="lg" className="md:col-span-2 relative overflow-hidden">
          <div className="flex flex-col h-full">
            <KickerLabel tone="lime">Championship</KickerLabel>

            {bracketData?.matchups ? (() => {
              const bracketStatus = computeBracketStatus(bracketData.matchups);
              const decided = bracketData.matchups.filter((m) => m.winningSeed !== null).length;
              const total = bracketData.matchups.length;
              const pct = total > 0 ? Math.round((decided / total) * 100) : 0;
              const champion = bracketData.champion;

              return (
                <>
                  {champion ? (
                    <div className="mt-5">
                      <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-aurora-lime">
                        Champion
                      </div>
                      <div className="font-display font-bold text-[clamp(1.5rem,3vw,2rem)] leading-[1.05] tracking-tight text-text-primary mt-1">
                        {champion.teamName}
                      </div>
                      <div className="font-mono text-[11px] text-text-muted mt-1">
                        {champion.leagueName}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5">
                      <div className="stat font-display font-bold text-5xl text-aurora-cyan-lime tracking-[-0.03em]">
                        {pct}%
                      </div>
                      <div className="font-mono text-[11px] text-text-muted tracking-[0.14em] uppercase mt-1">
                        {decided}/{total} matchups decided
                      </div>
                    </div>
                  )}

                  <div className="mt-auto pt-4">
                    <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden mb-4">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, #56F0FF, #CCFF56)',
                        }}
                      />
                    </div>
                    <Link
                      href="/bracket"
                      className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-lime transition-colors"
                    >
                      {bracketStatus === 'complete' ? 'Final bracket' : 'View bracket'} →
                    </Link>
                  </div>
                </>
              );
            })() : (
              <>
                <p className="mt-6 text-text-secondary text-sm">
                  Bracket assembles at the start of playoffs.
                </p>
                <Link
                  href="/bracket"
                  className="mt-auto font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-lime transition-colors"
                >
                  Preview →
                </Link>
              </>
            )}
          </div>
        </Card>

        {/* ----- TOP FIVE (3/6) ----- */}
        <Card padding="lg" className="md:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <KickerLabel>Top 5 · Cross-League</KickerLabel>
            <Link
              href="/rankings"
              className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-magenta transition-colors"
            >
              Full rankings →
            </Link>
          </div>

          {rankingsData && rankingsData.length > 0 ? (
            <ol className="space-y-0 divide-y divide-hairline">
              {rankingsData.map((team, i) => (
                <li
                  key={`${team.leagueId}-${team.team.rosterId}`}
                  className="flex items-center gap-4 py-3"
                >
                  <span className="stat font-display font-bold text-2xl text-text-muted w-10 shrink-0">
                    {String(team.rank).padStart(2, '0')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`truncate text-[14px] ${
                        i === 0
                          ? 'font-display font-bold text-aurora-mag-cyan text-[17px]'
                          : 'text-text-primary font-medium'
                      }`}
                    >
                      {team.team.teamName || team.team.displayName}
                    </div>
                  </div>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-[0.14em] uppercase font-semibold"
                    style={{
                      backgroundColor: `${team.leagueColor}1f`,
                      color: team.leagueColor,
                      border: `1px solid ${team.leagueColor}55`,
                    }}
                  >
                    {team.leagueName}
                  </span>
                  <span className="stat text-text-primary text-sm w-14 text-right shrink-0">
                    {team.powerScore.toFixed(1)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-text-secondary text-sm">
              Rankings will appear once the season begins.
            </p>
          )}
        </Card>

        {/* ----- ACTIVITY FEED (3/6) ----- */}
        <Card padding="lg" className="md:col-span-3">
          <div className="flex items-center justify-between mb-5">
            <KickerLabel>Wire · Latest Moves</KickerLabel>
            <Link
              href="/transactions"
              className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted hover:text-aurora-cyan transition-colors"
            >
              All transactions →
            </Link>
          </div>

          {transactionsData && transactionsData.length > 0 ? (
            <ul className="space-y-0 divide-y divide-hairline">
              {transactionsData.slice(0, 6).map((txn, i) => {
                const style = TYPE_STYLES[txn.type] ?? TYPE_STYLES.FA;
                return (
                  <li key={i} className="flex items-center gap-3 py-2.5">
                    <span
                      className="shrink-0 px-2 py-0.5 rounded-full font-mono text-[9.5px] tracking-[0.18em] uppercase font-semibold"
                      style={{
                        backgroundColor: style.bg,
                        color: style.color,
                        border: `1px solid ${style.border}`,
                      }}
                    >
                      {txn.type}
                    </span>
                    <span className="text-text-primary text-sm truncate flex-1">
                      {txn.playerNames.join(', ') || '—'}
                    </span>
                    <span
                      className="shrink-0 font-mono text-[10px] tracking-[0.14em] uppercase"
                      style={{ color: txn.leagueColor }}
                    >
                      {txn.leagueName}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-text-secondary text-sm">No recent activity.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
