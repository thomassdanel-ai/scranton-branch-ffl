import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync } from '@/lib/config';
import {
  getWeekMatchups,
  getLeagueRosterPositions,
  getLastPlayedWeek,
} from '@/lib/sleeper/league-data';
import { getNFLState } from '@/lib/sleeper/api';
import { getPlayerLookup } from '@/lib/players/cache';
import WeekSelector from '@/components/leagues/WeekSelector';
import MatchupCard from '@/components/leagues/MatchupCard';
import LiveScoreIndicator from '@/components/leagues/LiveScoreIndicator';

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function MatchupsPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  const nflState = await getNFLState();
  const maxWeek =
    nflState.week > 0 ? nflState.week : await getLastPlayedWeek(params.leagueId);
  const week = Number(searchParams.week) || maxWeek;

  const isLive = week === nflState.week && nflState.season_type === 'regular';

  const [matchups, rosterPositions, playerLookup] = await Promise.all([
    getWeekMatchups(params.leagueId, week),
    getLeagueRosterPositions(params.leagueId),
    getPlayerLookup(),
  ]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '16px 0 4px',
          flexWrap: 'wrap',
        }}
      >
        <div
          className="font-display"
          style={{
            fontSize: 28,
            color: 'var(--ink-8)',
            letterSpacing: 'var(--tr-wide)',
            textTransform: 'uppercase',
          }}
        >
          WEEK {week}
        </div>
        <LiveScoreIndicator leagueId={params.leagueId} week={week} isLive={isLive} />
      </div>

      <WeekSelector
        currentWeek={maxWeek}
        leagueId={params.leagueId}
        leagueColor={league.color}
      />

      {matchups.length === 0 ? (
        <div
          className="surface-raised"
          style={{ padding: 40, textAlign: 'center', margin: '16px 0' }}
        >
          <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>
            No matchup data available for Week {week}.
          </p>
        </div>
      ) : (
        <div className="mu-list">
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
    </>
  );
}
