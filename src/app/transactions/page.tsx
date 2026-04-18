import Link from 'next/link';
import { getAllTransactions } from '@/lib/transactions/fetch';
import { getSeasonLeagues, getSeasonStatus } from '@/lib/config';
import TransactionsFeed from '@/components/transactions/TransactionsFeed';
import { getPlayerLookup } from '@/lib/players/cache';
import PhaseStrip from '@/components/layout/PhaseStrip';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Transactions',
  description: 'All trades, waivers, and free agent pickups across leagues.',
  openGraph: {
    title: 'Transactions | Scranton Branch FFL',
    description: 'Every trade, waiver claim, and free agent pickup across all leagues.',
  },
};

export default async function TransactionsPage() {
  const [transactions, playerLookup, leagues, status] = await Promise.all([
    getAllTransactions(),
    getPlayerLookup(),
    getSeasonLeagues(),
    getSeasonStatus(),
  ]);

  const leagueProps = leagues.map((l) => ({
    id: l.sleeperId,
    name: l.name,
    shortName: l.shortName,
    color: l.color,
  }));

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>TRANSACTIONS</b>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <div className="wrap">
        <section className="txn-head">
          <div className="kicker">
            <span className="kicker__dot" />
            THE WIRE · {leagues.length} LEAGUES · {status.year}
          </div>
          <h1>
            THE <em>WIRE.</em>
          </h1>
          <p className="sub">
            Every trade, waiver claim, and free agent pickup across{' '}
            {leagues.map((l) => l.name).join(' & ')}. Receipts included.
          </p>
        </section>

        <TransactionsFeed
          transactions={transactions}
          leagues={leagueProps}
          playerLookup={playerLookup}
        />
      </div>
    </>
  );
}
