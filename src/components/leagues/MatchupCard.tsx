'use client';

import { useState } from 'react';
import type { MatchupPair } from '@/lib/sleeper/league-data';

type PlayerLookup = Record<string, { player_id: string; full_name: string; position: string; team: string | null }>;

interface Props {
  matchup: MatchupPair;
  rosterPositions: string[];
  playerLookup?: PlayerLookup;
}

function TeamSide({ team, points, isWinner, isComplete }: {
  team: MatchupPair['team1']['team'];
  points: number;
  isWinner: boolean;
  isComplete: boolean;
}) {
  const scoreColor = !isComplete
    ? 'text-white'
    : isWinner
      ? 'text-accent-green'
      : 'text-accent-red';

  return (
    <div className="flex items-center gap-3 flex-1 min-w-0">
      {team.avatar ? (
        <img src={team.avatar} alt="" className="w-10 h-10 rounded-full bg-bg-tertiary shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-bg-tertiary shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white truncate text-sm">
          {team.teamName ?? team.displayName}
        </p>
        <p className="text-xs text-text-muted">
          {team.wins}-{team.losses}{team.ties > 0 ? `-${team.ties}` : ''}
        </p>
      </div>
      <p className={`stat text-xl font-bold shrink-0 ${scoreColor}`}>
        {points.toFixed(2)}
      </p>
    </div>
  );
}

export default function MatchupCard({ matchup, rosterPositions, playerLookup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { team1, team2 } = matchup;
  const isComplete = team1.points > 0 || team2.points > 0;
  const t1Wins = team1.points > team2.points;
  const t2Wins = team2.points > team1.points;

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex flex-col gap-3">
          <TeamSide team={team1.team} points={team1.points} isWinner={t1Wins} isComplete={isComplete} />
          <div className="border-t border-white/5" />
          <TeamSide team={team2.team} points={team2.points} isWinner={t2Wins} isComplete={isComplete} />
        </div>
        <div className="flex justify-center mt-2">
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-4">
          <div className="grid grid-cols-2 gap-4">
            <StarterList
              starters={team1.starters}
              startersPoints={team1.startersPoints}
              positions={rosterPositions}
              playerLookup={playerLookup}
            />
            <StarterList
              starters={team2.starters}
              startersPoints={team2.startersPoints}
              positions={rosterPositions}
              playerLookup={playerLookup}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StarterList({ starters, startersPoints, positions, playerLookup }: {
  starters: string[];
  startersPoints: number[];
  positions: string[];
  playerLookup?: PlayerLookup;
}) {
  if (!starters.length) {
    return <p className="text-text-muted text-xs">No lineup data</p>;
  }

  function getPlayerDisplay(playerId: string): string {
    if (playerId === '0') return 'Empty';
    if (!playerLookup) return playerId;
    const player = playerLookup[playerId];
    if (!player) return `#${playerId}`;
    return player.full_name;
  }

  return (
    <div className="space-y-1">
      {starters.map((playerId, i) => (
        <div key={`${playerId}-${i}`} className="flex items-center justify-between text-xs">
          <span className="text-text-muted w-10 shrink-0">
            {positions[i] ?? 'BN'}
          </span>
          <span className="text-text-secondary truncate flex-1 mx-2">
            {getPlayerDisplay(playerId)}
          </span>
          <span className="stat text-white shrink-0">
            {startersPoints[i]?.toFixed(2) ?? '0.00'}
          </span>
        </div>
      ))}
    </div>
  );
}
