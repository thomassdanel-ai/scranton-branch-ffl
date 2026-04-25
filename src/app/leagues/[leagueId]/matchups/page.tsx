import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync, getSeasonStatus } from '@/lib/config';
import {
  getCachedWeekMatchups,
  getCachedMaxWeek,
  getCachedRosterPositions,
  getLatestSnapshotInfo,
  isSnapshotFresh,
} from '@/lib/leagues/cached-matchups';
import { getPlayerLookup } from '@/lib/players/cache';
import WeekSelector from '@/components/leagues/WeekSelector';
import MatchupCard from '@/components/leagues/MatchupCard';
import LiveScoreIndicator from '@/components/leagues/LiveScoreIndicator';

interface Props {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ week?: string }>;
}

// Treat the most recent snapshot as "live" if it was refreshed within this
// window. The cron writes snapshots every few minutes during game windows.
const LIVE_SNAPSHOT_WINDOW_MS = 30 * 60 * 1000;

export default async function MatchupsPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  const [seasonStatus, latestSnapshot] = await Promise.all([
    getSeasonStatus(),
    getLatestSnapshotInfo(params.leagueId),
  ]);

  const maxWeek = latestSnapshot?.week ?? (await getCachedMaxWeek(params.leagueId));
  const week = Number(searchParams.week) || maxWeek;

  const isLive =
    week === maxWeek &&
    !seasonStatus.isOffSeason &&
    seasonStatus.phase === 'active' &&
    !!latestSnapshot &&
    isSnapshotFresh(latestSnapshot.fetchedAt, LIVE_SNAPSHOT_WINDOW_MS);

  const [matchups, rosterPositions, playerLookup] = await Promise.all([
    getCachedWeekMatchups(params.leagueId, week),
    getCachedRosterPositions(league.dbId),
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
