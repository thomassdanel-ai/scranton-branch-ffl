import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync } from '@/lib/config';
import LeagueNav from '@/components/leagues/LeagueNav';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ leagueId: string }>;
  children: React.ReactNode;
}

export async function generateMetadata(props: { params: Promise<{ leagueId: string }> }): Promise<Metadata> {
  const params = await props.params;
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) return {};
  return {
    title: `${league.name} League`,
  };
}

export default async function LeagueLayout(props: Props) {
  const params = await props.params;

  const {
    children
  } = props;

  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  return (
    <div className="space-y-6">
      {/* League header */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-1 h-8 rounded-full"
            style={{ backgroundColor: league.color }}
          />
          <h1 className="text-2xl font-extrabold text-white">
            {league.name} League
          </h1>
        </div>
        <LeagueNav leagueId={params.leagueId} leagueColor={league.color} />
      </div>

      {children}
    </div>
  );
}
