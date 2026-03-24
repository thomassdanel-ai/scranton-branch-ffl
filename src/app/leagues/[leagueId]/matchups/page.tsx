import { notFound } from 'next/navigation';
import { findLeagueConfig, getWeekMatchups, getLeagueRosterPositions, getLastPlayedWeek } from '@/lib/sleeper/league-data';
import { getNFLState } from '@/lib/sleeper/api';
import WeekSelector from '@/components/leagues/WeekSelector';
import MatchupCard from '@/components/leagues/MatchupCard';

interface Props {
  params: { leagueId: string };
  searchParams: { week?: string };
}

export default async function MatchupsPage({ params, searchParams }: Props) {
  const league = findLeagueConfig(params.leagueId);
  if (!league) notFound();

  const nflState = await getNFLState();
  // During offseason (week 0), derive max week from games played
  const maxWeek = nflState.week > 0
    ? nflState.week
    : await getLastPlayedWeek(params.leagueId);
  const week = Number(searchParams.week) || maxWeek;
  const [matchups, rosterPositions] = await Promise.all([
    getWeekMatchups(params.leagueId, week),
    getLeagueRosterPositions(params.leagueId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Week {week}</h2>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
