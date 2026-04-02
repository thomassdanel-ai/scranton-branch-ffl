import Link from 'next/link';
import { getSeasonLeagues, getSeasonStatus, getActiveSeasonId } from '@/lib/config';
import { computePowerRankings } from '@/lib/rankings/compute';
import { loadBracket, computeBracketStatus } from '@/lib/bracket/engine';
import { createServiceClient } from '@/lib/supabase/server';
import { ORG_NAME } from '@/config/constants';
import OffSeasonBanner from '@/components/ui/OffSeasonBanner';

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

async function getMatchupPreviews(seasonId: string, leagues: Awaited<ReturnType<typeof getSeasonLeagues>>): Promise<MatchupData[]> {
  const supabase = createServiceClient();

  // Get the latest week from league_snapshots
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

async function getRecentTransactions(seasonId: string, leagues: Awaited<ReturnType<typeof getSeasonLeagues>>): Promise<TransactionPreview[]> {
  const supabase = createServiceClient();

  const leagueSleeperIds = leagues.map((l) => l.sleeperId).filter(Boolean);

  // Get latest transactions from cache
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

  // Get player names for display
  const playerIdSet = new Set<string>();
  for (const row of data) {
    const txns = row.transactions as Array<{ type: string; status: string; adds?: Record<string, number> | null; drops?: Record<string, number> | null }>;
    if (!Array.isArray(txns)) continue;
    for (const txn of txns) {
      if (txn.status !== 'complete') continue;
      if (txn.adds) Object.keys(txn.adds).forEach((id) => playerIdSet.add(id));
      if (txn.drops) Object.keys(txn.drops).forEach((id) => playerIdSet.add(id));
    }
  }

  const playerIds = Array.from(playerIdSet).slice(0, 100);
  let playerNames: Record<string, string> = {};
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
    const txns = row.transactions as Array<{ type: string; status: string; adds?: Record<string, number> | null; drops?: Record<string, number> | null; created: number }>;
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

export default async function HomePage() {
  const [leagues, status] = await Promise.all([
    getSeasonLeagues(),
    getSeasonStatus(),
  ]);

  const seasonId = await getActiveSeasonId();

  // Fetch all card data in parallel, each with error handling
  const [matchupData, rankingsData, transactionsData, bracketData] = await Promise.all([
    // Card 1: Matchups
    (async () => {
      if (!seasonId || status.isOffSeason) return null;
      try {
        return await getMatchupPreviews(seasonId, leagues);
      } catch { return null; }
    })(),
    // Card 2: Power Rankings
    (async () => {
      try {
        const rankings = await computePowerRankings();
        return rankings.slice(0, 5);
      } catch { return null; }
    })(),
    // Card 3: Transactions
    (async () => {
      if (!seasonId) return null;
      try {
        return await getRecentTransactions(seasonId, leagues);
      } catch { return null; }
    })(),
    // Card 4: Bracket
    (async () => {
      try {
        return await loadBracket();
      } catch { return null; }
    })(),
  ]);

  const TYPE_COLORS: Record<string, string> = {
    TRADE: 'bg-accent-purple/20 text-accent-purple',
    WAIVER: 'bg-blue-500/20 text-blue-300',
    FA: 'bg-green-500/20 text-green-300',
  };

  return (
    <div className="space-y-8">
      {status.isOffSeason && <OffSeasonBanner year={status.year} />}
      {/* Hero */}
      <section className="text-center py-12">
        <p className="text-accent-gold text-sm font-semibold uppercase tracking-widest mb-3">
          {status.year} Season
        </p>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
          {ORG_NAME}
        </h1>
        <p className="text-text-secondary text-lg max-w-xl mx-auto">
          Your cross-league fantasy hub — scores, power rankings, and trash talk, all in one place.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          {leagues.map((league) => (
            <a
              key={league.sleeperId || league.dbId}
              href={`/leagues/${league.sleeperId}`}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                backgroundColor: `${league.color}22`,
                color: league.color,
                border: `1px solid ${league.color}44`,
              }}
            >
              {league.name} League
            </a>
          ))}
        </div>
      </section>

      {/* Data cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Live Scores / Matchups */}
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-3">Live Scores</h2>
          {matchupData && matchupData.length > 0 ? (
            <div className="space-y-3">
              {matchupData.map((league) => (
                <div key={league.leagueSleeperIds}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: league.leagueColor }} />
                    <span className="text-text-secondary text-xs font-semibold">{league.leagueName} — Week {league.week}</span>
                  </div>
                  {league.matchups.map((m, i) => (
                    <div key={i} className="flex items-center justify-between py-1 text-sm">
                      <span className="text-white truncate flex-1">{m.team1}</span>
                      <span className="text-text-muted font-mono mx-2">{m.team1Score.toFixed(1)} - {m.team2Score.toFixed(1)}</span>
                      <span className="text-white truncate flex-1 text-right">{m.team2}</span>
                    </div>
                  ))}
                </div>
              ))}
              <Link href={`/leagues/${leagues[0]?.sleeperId}`} className="text-primary text-xs hover:underline">
                See all matchups &rarr;
              </Link>
            </div>
          ) : (
            <p className="text-text-muted text-sm">
              {status.isOffSeason ? "Season hasn't started yet" : 'Matchup scores will appear here during the season.'}
            </p>
          )}
        </div>

        {/* Card 2: Power Rankings */}
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-3">Power Rankings</h2>
          {rankingsData && rankingsData.length > 0 ? (
            <div className="space-y-2">
              {rankingsData.map((team) => (
                <div key={`${team.leagueId}-${team.team.rosterId}`} className="flex items-center gap-3 py-1">
                  <span className="text-accent-gold font-bold text-sm w-5">#{team.rank}</span>
                  <span className="text-white text-sm flex-1 truncate">{team.team.teamName || team.team.displayName}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${team.leagueColor}22`, color: team.leagueColor }}
                  >
                    {team.leagueName}
                  </span>
                  <span className="text-text-muted font-mono text-xs">{team.powerScore.toFixed(1)}</span>
                </div>
              ))}
              <Link href="/rankings" className="text-primary text-xs hover:underline">
                Full rankings &rarr;
              </Link>
            </div>
          ) : (
            <p className="text-text-muted text-sm">Rankings will appear once the season begins.</p>
          )}
        </div>

        {/* Card 3: Activity Feed / Transactions */}
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-3">Activity Feed</h2>
          {transactionsData && transactionsData.length > 0 ? (
            <div className="space-y-2">
              {transactionsData.map((txn, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${TYPE_COLORS[txn.type] || 'bg-white/10 text-white'}`}>
                    {txn.type}
                  </span>
                  <span className="text-white text-sm truncate flex-1">
                    {txn.playerNames.join(', ')}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${txn.leagueColor}22`, color: txn.leagueColor }}
                  >
                    {txn.leagueName}
                  </span>
                </div>
              ))}
              <Link href="/transactions" className="text-primary text-xs hover:underline">
                All transactions &rarr;
              </Link>
            </div>
          ) : (
            <p className="text-text-muted text-sm">No recent activity.</p>
          )}
        </div>

        {/* Card 4: Championship Bracket */}
        <div className="glass-card p-6">
          <h2 className="font-bold text-white mb-3">Championship Bracket</h2>
          {bracketData?.matchups ? (() => {
            const bracketStatus = computeBracketStatus(bracketData.matchups);
            const decided = bracketData.matchups.filter((m) => m.winningSeed !== null).length;
            const total = bracketData.matchups.length;
            const finalMatch = bracketData.matchups.find((m) => m.id === 'FINAL');
            const champion = bracketData.champion;

            return (
              <div className="space-y-3">
                {champion ? (
                  <div className="p-3 rounded-lg bg-accent-gold/10 border border-accent-gold/20 text-center">
                    <p className="text-accent-gold text-xs font-semibold">Champion</p>
                    <p className="text-white font-bold">{champion.teamName}</p>
                    <p className="text-text-muted text-xs">{champion.leagueName}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-text-secondary text-sm">
                      {bracketStatus === 'in_progress'
                        ? `${decided} of ${total} matchups decided`
                        : 'Bracket is set up, awaiting results'}
                    </p>
                    {finalMatch && finalMatch.team1Seed && finalMatch.team2Seed && (
                      <p className="text-text-muted text-xs mt-1">
                        Championship: Seed #{finalMatch.team1Seed} vs Seed #{finalMatch.team2Seed}
                      </p>
                    )}
                  </div>
                )}
                <Link href="/bracket" className="text-primary text-xs hover:underline">
                  View bracket &rarr;
                </Link>
              </div>
            );
          })() : (
            <p className="text-text-muted text-sm">Bracket will be set up during playoffs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
