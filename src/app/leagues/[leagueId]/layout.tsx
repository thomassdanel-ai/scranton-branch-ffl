import Link from 'next/link';
import { notFound } from 'next/navigation';
import { findLeagueBySleeperIdAsync, getSeasonStatus } from '@/lib/config';
import LeagueNav from '@/components/leagues/LeagueNav';
import PhaseStrip from '@/components/layout/PhaseStrip';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ leagueId: string }>;
  children: React.ReactNode;
}

export async function generateMetadata(props: {
  params: Promise<{ leagueId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) return {};
  return { title: `${league.name} League` };
}

export default async function LeagueLayout(props: Props) {
  const params = await props.params;
  const { children } = props;

  const league = await findLeagueBySleeperIdAsync(params.leagueId);
  if (!league) notFound();

  const status = await getSeasonStatus();

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>{league.name.toUpperCase()}</b>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <div className="wrap">
        <section className="lg-head">
          <div className="lg-head__rail">
            <span className="dot" style={{ background: league.color }} />
            <span className="label">DIVISION</span>
          </div>
          <h1>{league.name}</h1>
          <LeagueNav leagueId={params.leagueId} leagueColor={league.color} />
        </section>

        {children}
      </div>
    </>
  );
}
