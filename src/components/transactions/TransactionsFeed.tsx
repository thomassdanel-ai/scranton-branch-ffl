'use client';

import { useState, useMemo } from 'react';
import TransactionCard from './TransactionCard';
import type { EnrichedTransaction } from '@/lib/transactions/fetch';

type PlayerLookup = Record<string, { player_id: string; full_name: string; position: string; team: string | null }>;

type Props = {
  transactions: EnrichedTransaction[];
  leagues: Array<{ id: string; name: string; shortName: string; color: string }>;
  playerLookup: PlayerLookup;
};

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'trade', label: 'Trades' },
  { value: 'waiver', label: 'Waivers' },
  { value: 'free_agent', label: 'Free Agents' },
] as const;

export default function TransactionsFeed({ transactions, leagues, playerLookup }: Props) {
  const [selectedLeague, setSelectedLeague] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      if (selectedLeague !== 'all' && txn.leagueId !== selectedLeague) return false;
      if (selectedType !== 'all' && txn.type !== selectedType) return false;
      return true;
    });
  }, [transactions, selectedLeague, selectedType]);

  return (
    <div className="space-y-6">
      {/* Filter controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* League filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLeague('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedLeague === 'all'
                ? 'bg-white/15 text-text-primary'
                : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-secondary'
            }`}
          >
            All Leagues
          </button>
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setSelectedLeague(league.id)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                backgroundColor:
                  selectedLeague === league.id
                    ? `${league.color}33`
                    : 'rgba(255,255,255,0.05)',
                color:
                  selectedLeague === league.id
                    ? league.color
                    : 'var(--color-text-muted)',
                border:
                  selectedLeague === league.id
                    ? `1px solid ${league.color}55`
                    : '1px solid transparent',
              }}
            >
              {league.name}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setSelectedType(filter.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedType === filter.value
                  ? 'bg-white/15 text-text-primary'
                  : 'bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-secondary'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-text-muted">
        <span className="stat">{filtered.length}</span>{' '}
        transaction{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-text-muted">No transactions match the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((txn) => (
            <TransactionCard key={`${txn.leagueId}-${txn.transaction_id}`} transaction={txn} playerLookup={playerLookup} />
          ))}
        </div>
      )}
    </div>
  );
}
