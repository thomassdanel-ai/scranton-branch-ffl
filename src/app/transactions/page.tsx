import { getAllTransactions } from '@/lib/transactions/fetch';
import { LEAGUE_CONFIG } from '@/config/leagues';
import TransactionsFeed from '@/components/transactions/TransactionsFeed';
import { getPlayerLookup } from '@/lib/players/cache';

export const metadata = {
  title: 'Transactions | Scranton Branch FFL',
  description: 'All trades, waivers, and free agent pickups across leagues.',
};

export default async function TransactionsPage() {
  const [transactions, playerLookup] = await Promise.all([
    getAllTransactions(),
    getPlayerLookup(),
  ]);

  const leagues = LEAGUE_CONFIG.leagues.map((l) => ({
    id: l.id,
    name: l.name,
    shortName: l.shortName,
    color: l.color,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white">Transactions</h1>
        <p className="text-text-secondary mt-1">
          All moves across{' '}
          {LEAGUE_CONFIG.leagues.map((l) => l.name).join(' & ')}{' '}
          leagues.
        </p>
      </div>

      <TransactionsFeed transactions={transactions} leagues={leagues} playerLookup={playerLookup} />
    </div>
  );
}
