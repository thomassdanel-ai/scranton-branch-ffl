import { notFound } from 'next/navigation';
import { getLeagueStandings, findLeagueConfig } from '@/lib/sleeper/league-data';
import StandingsTable from '@/components/leagues/StandingsTable';

interface Props {
  params: { leagueId: string };
}

export default async function LeagueStandingsPage({ params }: Props) {
  const league = findLeagueConfig(params.leagueId);
  if (!league) notFound();

  const standings = await getLeagueStandings(params.leagueId);

  return <StandingsTable standings={standings} leagueColor={league.color} />;
}
