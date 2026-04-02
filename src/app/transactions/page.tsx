import { getAllTransactions } from '@/lib/transactions/fetch';
import { getSeasonLeagues, getSeasonStatus } from '@/lib/config';
import TransactionsFeed from '@/components/transactions/TransactionsFeed';
import { getPlayerLookup } from '@/lib/players/cache';
import OffSeasonBanner from '@/components/ui/OffSeasonBanner';

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
    <div className="space-y-6">
      {status.isOffSeason && <OffSeasonBanner year={status.year} />}
      <div>
        <h1 className="text-3xl font-extrabold text-white">Transactions</h1>
        <p className="text-text-secondary mt-1">
          All moves across{' '}
          {leagues.map((l) => l.name).join(' & ')}{' '}
          leagues.
        </p>
      </div>

      <TransactionsFeed transactions={transactions} leagues={leagueProps} playerLookup={playerLookup} />
    </div>
  );
}
