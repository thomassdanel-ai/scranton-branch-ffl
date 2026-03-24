import type { EnrichedTransaction } from '@/lib/transactions/fetch';

type PlayerLookup = Record<string, { player_id: string; full_name: string; position: string; team: string | null }>;

type Props = {
  transaction: EnrichedTransaction;
  playerLookup: PlayerLookup;
};

const TYPE_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  trade: { label: 'Trade', bg: 'bg-accent-purple/20', text: 'text-accent-purple' },
  waiver: { label: 'Waiver', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  free_agent: { label: 'Free Agent', bg: 'bg-accent-green/20', text: 'text-accent-green' },
};

function formatPlayerName(playerId: string, playerLookup: PlayerLookup): string {
  const player = playerLookup[playerId];
  if (!player) return `#${playerId}`;
  const team = player.team ? ` (${player.team})` : '';
  return `${player.full_name}${team}`;
}

function formatTimestamp(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return new Date(ms).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getTeamName(
  transaction: EnrichedTransaction,
  rosterId: number
): string {
  const team = transaction.teams[rosterId];
  if (!team) return `Roster ${rosterId}`;
  return team.teamName || team.displayName;
}

function TradeView({ transaction, playerLookup }: Props) {
  // Group adds and drops by roster_id
  const rosterAdds: Record<number, string[]> = {};
  const rosterDrops: Record<number, string[]> = {};

  if (transaction.adds) {
    const addEntries = Object.entries(transaction.adds);
    for (let i = 0; i < addEntries.length; i++) {
      const [playerId, rosterId] = addEntries[i];
      if (!rosterAdds[rosterId]) rosterAdds[rosterId] = [];
      rosterAdds[rosterId].push(playerId);
    }
  }

  if (transaction.drops) {
    const dropEntries = Object.entries(transaction.drops);
    for (let i = 0; i < dropEntries.length; i++) {
      const [playerId, rosterId] = dropEntries[i];
      if (!rosterDrops[rosterId]) rosterDrops[rosterId] = [];
      rosterDrops[rosterId].push(playerId);
    }
  }

  const rosterIds = transaction.roster_ids;

  return (
    <div className="space-y-3">
      {rosterIds.map((rosterId) => (
        <div key={rosterId} className="bg-bg-primary/50 rounded-lg p-3">
          <p className="text-sm font-semibold text-text-primary mb-2">
            {getTeamName(transaction, rosterId)}
          </p>
          <div className="space-y-1">
            {(rosterAdds[rosterId] || []).map((pid) => (
              <div key={`add-${pid}`} className="flex items-center gap-2 text-sm">
                <span className="text-accent-green text-xs font-bold">+ ADD</span>
                <span className="stat text-text-secondary">{formatPlayerName(pid, playerLookup)}</span>
              </div>
            ))}
            {(rosterDrops[rosterId] || []).map((pid) => (
              <div key={`drop-${pid}`} className="flex items-center gap-2 text-sm">
                <span className="text-accent-red text-xs font-bold">- DROP</span>
                <span className="stat text-text-secondary">{formatPlayerName(pid, playerLookup)}</span>
              </div>
            ))}
          </div>
          {/* Show draft picks received */}
          {transaction.draft_picks
            .filter((pick) => pick.owner_id === rosterId)
            .map((pick, idx) => (
              <div key={`pick-${idx}`} className="flex items-center gap-2 text-sm mt-1">
                <span className="text-accent-gold text-xs font-bold">+ PICK</span>
                <span className="stat text-text-secondary">
                  {pick.season} Round {pick.round}
                </span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function WaiverFreeAgentView({ transaction, playerLookup }: Props) {
  const creatorRosterId = transaction.roster_ids[0];
  const adds = transaction.adds ? Object.entries(transaction.adds) : [];
  const drops = transaction.drops ? Object.entries(transaction.drops) : [];

  return (
    <div className="bg-bg-primary/50 rounded-lg p-3">
      <p className="text-sm font-semibold text-text-primary mb-2">
        {getTeamName(transaction, creatorRosterId)}
      </p>
      <div className="space-y-1">
        {adds.map(([pid]) => (
          <div key={`add-${pid}`} className="flex items-center gap-2 text-sm">
            <span className="text-accent-green text-xs font-bold">+ ADD</span>
            <span className="stat text-text-secondary">{formatPlayerName(pid, playerLookup)}</span>
          </div>
        ))}
        {drops.map(([pid]) => (
          <div key={`drop-${pid}`} className="flex items-center gap-2 text-sm">
            <span className="text-accent-red text-xs font-bold">- DROP</span>
            <span className="stat text-text-secondary">{formatPlayerName(pid, playerLookup)}</span>
          </div>
        ))}
      </div>
      {transaction.waiver_budget.length > 0 && (
        <div className="mt-2 text-xs text-text-muted">
          FAAB: ${transaction.waiver_budget[0]?.amount ?? 0}
        </div>
      )}
    </div>
  );
}

export default function TransactionCard({ transaction, playerLookup }: Props) {
  const typeStyle = TYPE_STYLES[transaction.type] || TYPE_STYLES.free_agent;

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header row: badges + timestamp */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Type badge */}
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeStyle.bg} ${typeStyle.text}`}
        >
          {typeStyle.label}
        </span>

        {/* League badge */}
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
          style={{
            backgroundColor: `${transaction.leagueColor}22`,
            color: transaction.leagueColor,
            border: `1px solid ${transaction.leagueColor}44`,
          }}
        >
          {transaction.leagueShortName}
        </span>

        {/* Week */}
        <span className="text-xs text-text-muted">
          Week {transaction.leg}
        </span>

        {/* Timestamp */}
        <span className="text-xs text-text-muted ml-auto">
          {formatTimestamp(transaction.created)}
        </span>
      </div>

      {/* Body */}
      {transaction.type === 'trade' ? (
        <TradeView transaction={transaction} playerLookup={playerLookup} />
      ) : (
        <WaiverFreeAgentView transaction={transaction} playerLookup={playerLookup} />
      )}
    </div>
  );
}
