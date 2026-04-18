import type { EnrichedTransaction } from '@/lib/transactions/fetch';

type PlayerLookup = Record<
  string,
  { player_id: string; full_name: string; position: string; team: string | null }
>;

type Props = {
  transaction: EnrichedTransaction;
  playerLookup: PlayerLookup;
};

const TYPE_TO_WIRE: Record<string, { label: string; cls: string }> = {
  trade: { label: 'TRADE', cls: 'wire-type--trade' },
  waiver: { label: 'WAIVER', cls: 'wire-type--waiver' },
  free_agent: { label: 'FREE AGENT', cls: 'wire-type--fa' },
};

function playerLine(
  playerId: string,
  playerLookup: PlayerLookup
): { name: string; meta: string | null } {
  const player = playerLookup[playerId];
  if (!player) return { name: `#${playerId}`, meta: null };
  return {
    name: player.full_name,
    meta: player.team ? `${player.position} · ${player.team}` : player.position,
  };
}

function formatTimestamp(ms: number): string {
  const now = Date.now();
  const diff = now - ms;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) {
    return new Date(ms)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .toUpperCase();
  }
  if (days > 0) return `${days}D AGO`;
  if (hours > 0) return `${hours}H AGO`;
  if (minutes > 0) return `${minutes}M AGO`;
  return 'JUST NOW';
}

function getTeamName(transaction: EnrichedTransaction, rosterId: number): string {
  const team = transaction.teams[rosterId];
  if (!team) return `Roster ${rosterId}`;
  return team.teamName || team.displayName;
}

function Line({
  tag,
  variant,
  name,
  meta,
}: {
  tag: string;
  variant: 'add' | 'drop' | 'pick';
  name: string;
  meta?: string | null;
}) {
  return (
    <div className="txn-line">
      <span className={`txn-line__tag txn-line__tag--${variant}`}>{tag}</span>
      <span className="txn-line__player">
        {name}
        {meta && <span className="txn-line__meta">{meta}</span>}
      </span>
    </div>
  );
}

function TradeView({ transaction, playerLookup }: Props) {
  const rosterAdds: Record<number, string[]> = {};
  const rosterDrops: Record<number, string[]> = {};

  if (transaction.adds) {
    for (const [playerId, rosterId] of Object.entries(transaction.adds)) {
      if (!rosterAdds[rosterId]) rosterAdds[rosterId] = [];
      rosterAdds[rosterId].push(playerId);
    }
  }
  if (transaction.drops) {
    for (const [playerId, rosterId] of Object.entries(transaction.drops)) {
      if (!rosterDrops[rosterId]) rosterDrops[rosterId] = [];
      rosterDrops[rosterId].push(playerId);
    }
  }

  return (
    <div className="txn-card__body txn-card__body--trade">
      {transaction.roster_ids.map((rosterId) => (
        <div key={rosterId} className="txn-roster">
          <div className="txn-roster__name">{getTeamName(transaction, rosterId)}</div>
          {(rosterAdds[rosterId] || []).map((pid) => {
            const info = playerLine(pid, playerLookup);
            return <Line key={`add-${pid}`} tag="+ IN" variant="add" name={info.name} meta={info.meta} />;
          })}
          {(rosterDrops[rosterId] || []).map((pid) => {
            const info = playerLine(pid, playerLookup);
            return <Line key={`drop-${pid}`} tag="– OUT" variant="drop" name={info.name} meta={info.meta} />;
          })}
          {transaction.draft_picks
            .filter((pick) => pick.owner_id === rosterId)
            .map((pick, idx) => (
              <Line
                key={`pick-${idx}`}
                tag="+ PICK"
                variant="pick"
                name={`${pick.season} Round ${pick.round}`}
              />
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
    <div className="txn-card__body">
      <div className="txn-roster">
        <div className="txn-roster__name">{getTeamName(transaction, creatorRosterId)}</div>
        {adds.map(([pid]) => {
          const info = playerLine(pid, playerLookup);
          return <Line key={`add-${pid}`} tag="+ ADD" variant="add" name={info.name} meta={info.meta} />;
        })}
        {drops.map(([pid]) => {
          const info = playerLine(pid, playerLookup);
          return <Line key={`drop-${pid}`} tag="– DROP" variant="drop" name={info.name} meta={info.meta} />;
        })}
        {transaction.waiver_budget.length > 0 && (
          <div className="txn-faab">FAAB · ${transaction.waiver_budget[0]?.amount ?? 0}</div>
        )}
      </div>
    </div>
  );
}

export default function TransactionCard({ transaction, playerLookup }: Props) {
  const wire = TYPE_TO_WIRE[transaction.type] ?? TYPE_TO_WIRE.free_agent;

  return (
    <div className="txn-card">
      <div className="txn-card__hdr">
        <span className={`wire-type ${wire.cls}`}>{wire.label}</span>
        <span
          className="chip"
          style={{
            background: `${transaction.leagueColor}22`,
            color: transaction.leagueColor,
            borderColor: `${transaction.leagueColor}55`,
          }}
        >
          {transaction.leagueShortName}
        </span>
        <span className="label">WK {transaction.leg}</span>
        <span className="txn-card__time">{formatTimestamp(transaction.created)}</span>
      </div>

      {transaction.type === 'trade' ? (
        <TradeView transaction={transaction} playerLookup={playerLookup} />
      ) : (
        <WaiverFreeAgentView transaction={transaction} playerLookup={playerLookup} />
      )}
    </div>
  );
}
