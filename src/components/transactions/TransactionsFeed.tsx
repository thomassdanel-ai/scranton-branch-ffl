'use client';

import { useState, useMemo } from 'react';
import TransactionCard from './TransactionCard';
import type { EnrichedTransaction } from '@/lib/transactions/fetch';

type PlayerLookup = Record<
  string,
  { player_id: string; full_name: string; position: string; team: string | null }
>;

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
    <>
      <div className="txn-filter-bar">
        <div className="txn-filter-group">
          <button
            type="button"
            onClick={() => setSelectedLeague('all')}
            className={`txn-pill ${selectedLeague === 'all' ? 'txn-pill--on' : ''}`}
          >
            ALL LEAGUES
          </button>
          {leagues.map((league) => {
            const on = selectedLeague === league.id;
            return (
              <button
                key={league.id}
                type="button"
                onClick={() => setSelectedLeague(league.id)}
                className="txn-pill"
                style={
                  on
                    ? {
                        color: league.color,
                        background: `${league.color}22`,
                        borderColor: `${league.color}66`,
                      }
                    : undefined
                }
              >
                {league.shortName}
              </button>
            );
          })}
        </div>

        <div className="txn-filter-group">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setSelectedType(filter.value)}
              className={`txn-pill ${selectedType === filter.value ? 'txn-pill--on' : ''}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="txn-count" style={{ padding: '8px 0 16px' }}>
        <span className="n">{filtered.length}</span>{' '}
        {filtered.length === 1 ? 'MOVE' : 'MOVES'}
      </div>

      {filtered.length === 0 ? (
        <div
          className="surface-raised"
          style={{
            padding: 40,
            textAlign: 'center',
            marginBottom: 48,
          }}
        >
          <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>
            No transactions match the selected filters.
          </p>
        </div>
      ) : (
        <div className="txn-list">
          {filtered.map((txn) => (
            <TransactionCard
              key={`${txn.leagueId}-${txn.transaction_id}`}
              transaction={txn}
              playerLookup={playerLookup}
            />
          ))}
        </div>
      )}
    </>
  );
}
