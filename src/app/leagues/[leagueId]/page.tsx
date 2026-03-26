import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync } from '@/lib/config';
import { getLeagueStandings } from '@/lib/sleeper/league-data';
import StandingsTable from '@/components/leagues/StandingsTable';

interface Props {
  params: { leagueId: string };
}

export default async function LeagueStandingsPage({ params }: Props) {
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  const standings = await getLeagueStandings(params.leagueId);

  return <StandingsTable standings={standings} leagueColor={league.color} />;
}
