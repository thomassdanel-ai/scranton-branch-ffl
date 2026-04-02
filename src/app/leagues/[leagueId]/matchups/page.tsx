import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync } from '@/lib/config';
import { getWeekMatchups, getLeagueRosterPositions, getLastPlayedWeek } from '@/lib/sleeper/league-data';
import { getNFLState } from '@/lib/sleeper/api';
import { getPlayerLookup } from '@/lib/players/cache';
import WeekSelector from '@/components/leagues/WeekSelector';
import MatchupCard from '@/components/leagues/MatchupCard';
import LiveScoreIndicator from '@/components/leagues/LiveScoreIndicator';

interface Props {
  params: { leagueId: string };
  searchParams: { week?: string };
}

export default async function MatchupsPage({ params, searchParams }: Props) {
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  const nflState = await getNFLState();
  const maxWeek = nflState.week > 0
    ? nflState.week
    : await getLastPlayedWeek(params.leagueId);
  const week = Number(searchParams.week) || maxWeek;

  // Games are "live" if viewing the current NFL week during the regular season
  const isLive = week === nflState.week && nflState.season_type === 'regular';

  const [matchups, rosterPositions, playerLookup] = await Promise.all([
    getWeekMatchups(params.leagueId, week),
    getLeagueRosterPositions(params.leagueId),
    getPlayerLookup(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Week {week}</h2>
        <LiveScoreIndicator leagueId={params.leagueId} week={week} isLive={isLive} />
      </div>

      <WeekSelector
        currentWeek={maxWeek}
        leagueId={params.leagueId}
        leagueColor={league.color}
      />

      {matchups.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted">No matchup data available for Week {week}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matchups.map((matchup) => (
            <MatchupCard
              key={matchup.matchupId}
              matchup={matchup}
              rosterPositions={rosterPositions}
              playerLookup={playerLookup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
