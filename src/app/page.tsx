import Link from 'next/link';
import { getSeasonLeagues, getSeasonStatus, getActiveSeasonId } from '@/lib/config';
import { computePowerRankings } from '@/lib/rankings/compute';
import { loadBracket, computeBracketStatus } from '@/lib/bracket/engine';
import { createServiceClient } from '@/lib/supabase/server';
import { ORG_NAME } from '@/config/constants';
import OffSeasonBanner from '@/components/ui/OffSeasonBanner';
import PhaseStrip from '@/components/layout/PhaseStrip';

export const dynamic = 'force-dynamic';

type MatchupPreview = {
  leagueName: string;
  leagueShort: string;
  matchups: {
    team1: string;
    team1Score: number;
    team1Record: string;
    team2: string;
    team2Score: number;
    team2Record: string;
    final: boolean;
  }[];
  week: number;
};

type TransactionPreview = {
  type: 'TRADE' | 'WAIVER' | 'FA';
  playerNames: string[];
  leagueName: string;
  leagueShort: string;
};

async function getMatchupPreviews(
  seasonId: string,
  leagues: Awaited<ReturnType<typeof getSeasonLeagues>>,
): Promise<MatchupPreview[]> {
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
  for (const l of leagues) leagueLookup[l.sleeperId] = l;

  const results: MatchupPreview[] = [];
  for (const snap of snapshots) {
    const league = leagueLookup[snap.league_id];
    if (!league) continue;

    const rawMatchups = snap.matchups as Array<{
      matchup_id: number;
      team1?: { displayName?: string; teamName?: string; points?: number; wins?: number; losses?: number };
      team2?: { displayName?: string; teamName?: string; points?: number; wins?: number; losses?: number };
    }> | null;

    if (!rawMatchups || !Array.isArray(rawMatchups)) continue;

    const matchups = rawMatchups.slice(0, 3).map((m) => {
      const t1Score = m.team1?.points ?? 0;
      const t2Score = m.team2?.points ?? 0;
      const final = t1Score > 0 && t2Score > 0;
      return {
        team1: m.team1?.teamName || m.team1?.displayName || 'Team 1',
        team1Score: t1Score,
        team1Record: `${m.team1?.wins ?? 0}·${m.team1?.losses ?? 0}`,
        team2: m.team2?.teamName || m.team2?.displayName || 'Team 2',
        team2Score: t2Score,
        team2Record: `${m.team2?.wins ?? 0}·${m.team2?.losses ?? 0}`,
        final,
      };
    });

    results.push({
      leagueName: league.name,
      leagueShort: league.shortName.toUpperCase(),
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
  for (const l of leagues) leagueLookup[l.sleeperId] = l;

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
      for (const p of players) playerNames[p.player_id] = p.full_name;
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
        for (const id of Object.keys(txn.adds)) names.push(playerNames[id] || `Player ${id.slice(0, 6)}`);
      }
      if (names.length === 0 && txn.drops) {
        for (const id of Object.keys(txn.drops)) names.push(playerNames[id] || `Player ${id.slice(0, 6)}`);
      }
      const type: TransactionPreview['type'] =
        txn.type === 'trade' ? 'TRADE' : txn.type === 'waiver' ? 'WAIVER' : 'FA';
      results.push({
        type,
        playerNames: names.slice(0, 3),
        leagueName: league.name,
        leagueShort: league.shortName.toUpperCase(),
      });
      if (results.length >= 8) break;
    }
    if (results.length >= 8) break;
  }

  return results;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

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
  const allTeamsCount = matchupData
    ? matchupData.reduce((n, l) => n + l.matchups.length * 2, 0)
    : leagues.length * 10;

  const livePhase = status.phase === 'active' || status.phase === 'playoffs';

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>{ORG_NAME}</b>
        <span className="sep">·</span>
        <span>{status.year}</span>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <div className="wrap">
        {status.isOffSeason && (
          <div style={{ paddingTop: 24 }}>
            <OffSeasonBanner year={status.year} />
          </div>
        )}

        <section className="hero">
          <div className="hero-grid">
            <div>
              <div className="kicker" style={{ marginBottom: 24 }}>
                <span className="kicker__dot" />
                {livePhase
                  ? `Week ${currentWeek ?? '—'} · ${status.phase === 'playoffs' ? 'Playoffs' : 'Regular Season'}`
                  : `${status.year} Season · ${status.phase ? status.phase.replace('_', ' ') : 'Off-Season'}`}
              </div>
              <h1 className="hero-head">
                World&apos;s best<br />
                <em>league</em>.
              </h1>
              <p className="hero-sub">
                Every score, every waiver, every Jim-to-Dwight jab across all divisions — faxed
                straight to the bullpen. Ranked ladder, championship bracket, and the wire
                refresh in real time. Dwight is watching.
              </p>

              <div className="cohort-row">
                <span className="cohort-tab cohort-tab--active">
                  ALL · <b>{allTeamsCount}</b>
                  <span className="cohort-tab__count">&nbsp;TEAMS</span>
                </span>
                {leagues.map((l) => (
                  <Link
                    key={l.sleeperId || l.dbId}
                    href={`/leagues/${l.sleeperId}`}
                    className="cohort-tab"
                  >
                    {l.shortName.toUpperCase()}
                  </Link>
                ))}
              </div>
            </div>

            <div className="hero-stats">
              {topTeam ? (
                <div className="hs hs--live">
                  <span className="hs__lab">
                    <span className="livedot" style={{ marginRight: 6, verticalAlign: 'middle' }} />
                    Power Leader
                  </span>
                  <span className="hs__val">{topTeam.powerScore.toFixed(1)}</span>
                  <span className="hs__note">
                    <span className="hi">
                      {topTeam.team.teamName || topTeam.team.displayName}
                    </span>{' '}
                    · {topTeam.leagueName}
                  </span>
                </div>
              ) : (
                <div className="hs">
                  <span className="hs__lab">Power Leader</span>
                  <span className="hs__val">—</span>
                  <span className="hs__note">Rankings populate when season begins</span>
                </div>
              )}

              <div className="hs">
                <span className="hs__lab">Leagues</span>
                <span className="hs__val">{leagues.length}</span>
                <span className="hs__note">{leagues.map((l) => l.shortName).join(' · ')}</span>
              </div>

              {currentWeek !== null ? (
                <div className="hs">
                  <span className="hs__lab">Current Week</span>
                  <span className="hs__val">{String(currentWeek).padStart(2, '0')}</span>
                  <span className="hs__note">
                    {matchupData?.reduce((n, l) => n + l.matchups.length, 0) ?? 0} matchups tracked
                  </span>
                </div>
              ) : (
                <div className="hs">
                  <span className="hs__lab">Phase</span>
                  <span className="hs__val">
                    {status.phase ? status.phase.replace('_', ' ').toUpperCase() : '—'}
                  </span>
                  <span className="hs__note">Season status</span>
                </div>
              )}

              <div className="hs">
                <span className="hs__lab">Recent Moves</span>
                <span className="hs__val">{transactionsData?.length ?? 0}</span>
                <span className="hs__note">
                  {transactionsData && transactionsData.length > 0
                    ? `Across ${new Set(transactionsData.map((t) => t.leagueShort)).size} leagues`
                    : 'Wire is quiet'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="main-grid">
          {/* POWER LADDER — 5/12 */}
          <section className="panel" style={{ gridColumn: 'span 5' }}>
            <header className="panel__head">
              <span className="panel__title">Power Ladder</span>
              <Link href="/rankings" className="panel__link">Full rankings →</Link>
            </header>
            {rankingsData && rankingsData.length > 0 ? (
              <>
                <div className="rl">
                  {rankingsData.map((team, i) => (
                    <div
                      key={`${team.leagueId}-${team.team.rosterId}`}
                      className={`rl__row ${i === 0 ? 'rl__row--top' : ''}`}
                    >
                      <span className="rl__rank">{String(team.rank).padStart(2, '0')}</span>
                      <span className="ava">
                        {initials(team.team.teamName || team.team.displayName || '?')}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="rl__name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {team.team.teamName || team.team.displayName}
                        </div>
                        <div className="rl__meta">
                          {team.leagueName.toUpperCase()} · {team.team.wins}·{team.team.losses}
                        </div>
                      </div>
                      <div className="rl__score">
                        <span className="n">{team.powerScore.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    display: 'flex', gap: 8, paddingTop: 8,
                    borderTop: 'var(--hairline)',
                    font: '500 10px/1 var(--font-mono)',
                    color: 'var(--ink-5)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--tr-wider)',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>FORMULA:</span>
                  <span>WIN% <b style={{ color: 'var(--ink-8)' }}>40</b></span>
                  <span>·</span>
                  <span>PF <b style={{ color: 'var(--ink-8)' }}>35</b></span>
                  <span>·</span>
                  <span>LUCK <b style={{ color: 'var(--ink-8)' }}>15</b></span>
                  <span>·</span>
                  <span>STREAK <b style={{ color: 'var(--ink-8)' }}>10</b></span>
                </div>
              </>
            ) : (
              <p className="muted">Rankings populate once the season begins.</p>
            )}
          </section>

          {/* LIVE TICKER — 7/12 */}
          <section className="panel" style={{ gridColumn: 'span 7' }}>
            <header className="panel__head">
              <span className="panel__title">
                {currentWeek !== null ? `Week ${currentWeek} · Matchups` : 'Matchups'}
              </span>
              {livePhase ? (
                <span className="chip chip--live">
                  <span className="livedot" />
                  LIVE
                </span>
              ) : (
                <span className="chip">IDLE</span>
              )}
            </header>

            {matchupData && matchupData.length > 0 ? (
              <div className="tkr">
                {matchupData.flatMap((lg) =>
                  lg.matchups.map((m, i) => {
                    const winner =
                      m.team1Score === m.team2Score
                        ? null
                        : m.team1Score > m.team2Score
                          ? 1
                          : 2;
                    return (
                      <div
                        key={`${lg.leagueShort}-${i}`}
                        className={`tkr-match ${livePhase && !m.final ? 'tkr-match--live' : ''}`}
                      >
                        <div className="tkr-side">
                          <span className="tkr-name">{m.team1}</span>
                          <span className="tkr-sub">{lg.leagueShort} · {m.team1Record}</span>
                        </div>
                        <div className="tkr-mid">
                          <div className={`tkr-score ${winner === 1 ? 'tkr-score--win' : ''}`}>
                            {m.team1Score.toFixed(1)}
                          </div>
                          <div className={`tkr-tag ${livePhase && !m.final ? 'tkr-tag--live' : ''}`}>
                            {livePhase && !m.final ? (
                              <>
                                <span className="livedot" />
                                LIVE
                              </>
                            ) : (
                              'FINAL'
                            )}
                          </div>
                          <div className={`tkr-score ${winner === 2 ? 'tkr-score--win' : ''}`}>
                            {m.team2Score.toFixed(1)}
                          </div>
                        </div>
                        <div className="tkr-side tkr-side--r">
                          <span className="tkr-name">{m.team2}</span>
                          <span className="tkr-sub">{lg.leagueShort} · {m.team2Record}</span>
                        </div>
                      </div>
                    );
                  }),
                )}
              </div>
            ) : (
              <p className="muted">
                {status.isOffSeason
                  ? 'The season is complete. Live scores resume at kickoff.'
                  : 'Matchup scores appear here as games begin.'}
              </p>
            )}
          </section>

          {/* BRACKET PREVIEW — 7/12 */}
          <section className="panel" style={{ gridColumn: 'span 7' }}>
            <header className="panel__head">
              <span className="panel__title">Championship Bracket</span>
              <Link href="/bracket" className="panel__link">Open bracket →</Link>
            </header>
            {bracketData?.matchups ? (() => {
              const bracketStatus = computeBracketStatus(bracketData.matchups);
              const decided = bracketData.matchups.filter((m) => m.winningSeed !== null).length;
              const total = bracketData.matchups.length;
              const pct = total > 0 ? Math.round((decided / total) * 100) : 0;
              const champion = bracketData.champion;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {champion ? (
                    <div>
                      <div className="label" style={{ color: 'var(--accent-live)' }}>Champion</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 'clamp(32px, 4vw, 48px)',
                          lineHeight: 0.95,
                          color: 'var(--ink-8)',
                          textTransform: 'uppercase',
                          letterSpacing: 'var(--tr-wide)',
                          marginTop: 8,
                        }}
                      >
                        {champion.teamName}
                      </div>
                      <div className="rl__meta" style={{ marginTop: 6 }}>
                        {champion.leagueName}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                      <div className="hs__val" style={{ fontSize: '48px', color: 'var(--accent-live)' }}>
                        {pct}%
                      </div>
                      <div className="rl__meta">
                        {decided} of {total} matchups decided · {bracketStatus.toUpperCase()}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      height: 4, borderRadius: 2, background: 'var(--ink-3)', overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, var(--accent-live), var(--accent-clock))',
                        boxShadow: '0 0 8px var(--accent-live)',
                      }}
                    />
                  </div>
                </div>
              );
            })() : (
              <p className="muted">Bracket assembles at the start of playoffs.</p>
            )}
          </section>

          {/* WIRE — 5/12 */}
          <section className="panel" style={{ gridColumn: 'span 5' }}>
            <header className="panel__head">
              <span className="panel__title">Wire</span>
              <Link href="/transactions" className="panel__link">All moves →</Link>
            </header>

            {transactionsData && transactionsData.length > 0 ? (
              <div>
                {transactionsData.slice(0, 6).map((txn, i) => {
                  const cls =
                    txn.type === 'TRADE' ? 'wire-type--trade' :
                    txn.type === 'WAIVER' ? 'wire-type--waiver' :
                    'wire-type--fa';
                  return (
                    <div key={i} className="wire-row">
                      <span className={`wire-type ${cls}`}>{txn.type}</span>
                      <span className="wire-player">{txn.playerNames.join(', ') || '—'}</span>
                      <span className="wire-meta">{txn.leagueShort}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">No recent activity.</p>
            )}
          </section>

          {/* RECAP CTA — 12/12 */}
          <section className="panel" style={{ gridColumn: 'span 12' }}>
            <header className="panel__head">
              <span className="panel__title">Weekly Recap</span>
              <Link href="/recaps" className="panel__link">All recaps →</Link>
            </header>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: 24,
              }}
            >
              <div>
                <div className="label" style={{ marginBottom: 8 }}>Latest Issue</div>
                <p
                  className="font-serif"
                  style={{
                    color: 'var(--ink-7)',
                    fontSize: 'var(--fs-16)',
                    lineHeight: 1.5,
                    fontStyle: 'italic',
                  }}
                >
                  Matchups broken down, petty grievances aired, the wire dissected —
                  delivered every Tuesday morning.
                </p>
              </div>
              <Link href="/recaps" className="btn btn--primary">
                Read the recap →
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
