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
            <div>
              <StarterList
                starters={team1.starters}
                startersPoints={team1.startersPoints}
                positions={rosterPositions}
                playerLookup={playerLookup}
              />
              <BenchList
                players={team1.players}
                starters={team1.starters}
                playersPoints={team1.playersPoints}
                startersPoints={team1.startersPoints}
                rosterPositions={rosterPositions}
                playerLookup={playerLookup}
              />
            </div>
            <div>
              <StarterList
                starters={team2.starters}
                startersPoints={team2.startersPoints}
                positions={rosterPositions}
                playerLookup={playerLookup}
              />
              <BenchList
                players={team2.players}
                starters={team2.starters}
                playersPoints={team2.playersPoints}
                startersPoints={team2.startersPoints}
                rosterPositions={rosterPositions}
                playerLookup={playerLookup}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getPlayerDisplay(playerId: string, playerLookup?: PlayerLookup): string {
  if (playerId === '0') return 'Empty';
  if (!playerLookup) return playerId;
  const player = playerLookup[playerId];
  if (!player) return `#${playerId}`;
  return player.full_name;
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

  return (
    <div className="space-y-1">
      {starters.map((playerId, i) => (
        <div key={`${playerId}-${i}`} className="flex items-center justify-between text-xs">
          <span className="text-text-muted w-10 shrink-0">
            {positions[i] ?? 'BN'}
          </span>
          <span className="text-text-secondary truncate flex-1 mx-2">
            {getPlayerDisplay(playerId, playerLookup)}
          </span>
          <span className="stat text-white shrink-0">
            {startersPoints[i]?.toFixed(2) ?? '0.00'}
          </span>
        </div>
      ))}
    </div>
  );
}

function BenchList({ players, starters, playersPoints, startersPoints, rosterPositions, playerLookup }: {
  players: string[];
  starters: string[];
  playersPoints: Record<string, number>;
  startersPoints: number[];
  rosterPositions: string[];
  playerLookup?: PlayerLookup;
}) {
  const starterSet = new Set(starters);
  const benchPlayers = players.filter((id) => !starterSet.has(id) && id !== '0');

  if (!benchPlayers.length) return null;

  // FLEX-eligible positions (RB, WR, TE can fill FLEX; SUPER_FLEX adds QB)
  const FLEX_ELIGIBLE = new Set(['RB', 'WR', 'TE']);
  const SUPER_FLEX_ELIGIBLE = new Set(['QB', 'RB', 'WR', 'TE']);

  // Build lowest starter score per SLOT position (QB, RB, WR, TE, FLEX, K, DEF)
  // A slot can appear multiple times (e.g., two RB slots) — track the min across all of that slot
  const slotMinScore: Record<string, number> = {};
  for (let i = 0; i < starters.length; i++) {
    const slot = rosterPositions[i];
    if (!slot) continue;
    const pts = startersPoints[i] ?? 0;
    if (slotMinScore[slot] === undefined || pts < slotMinScore[slot]) {
      slotMinScore[slot] = pts;
    }
  }

  function couldHaveOutscoredStarter(pos: string | undefined, pts: number): boolean {
    if (!pos || pts <= 0) return false;

    // Check direct slot match (e.g., bench WR vs weakest started WR)
    if (slotMinScore[pos] !== undefined && pts > slotMinScore[pos]) return true;

    // Check FLEX slot — RB/WR/TE can fill FLEX
    if (FLEX_ELIGIBLE.has(pos) && slotMinScore['FLEX'] !== undefined && pts > slotMinScore['FLEX']) return true;

    // Check SUPER_FLEX / REC_FLEX if league uses them
    if (SUPER_FLEX_ELIGIBLE.has(pos) && slotMinScore['SUPER_FLEX'] !== undefined && pts > slotMinScore['SUPER_FLEX']) return true;
    if (FLEX_ELIGIBLE.has(pos) && slotMinScore['REC_FLEX'] !== undefined && pts > slotMinScore['REC_FLEX']) return true;

    return false;
  }

  // Sort bench by points descending
  const sorted = [...benchPlayers].sort(
    (a, b) => (playersPoints[b] ?? 0) - (playersPoints[a] ?? 0)
  );

  return (
    <div className="mt-2 pt-2 border-t border-white/5">
      <p className="text-text-muted text-[10px] uppercase tracking-wider mb-1">Bench</p>
      <div className="space-y-1">
        {sorted.map((playerId) => {
          const pts = playersPoints[playerId] ?? 0;
          const player = playerLookup?.[playerId];
          const outscoredStarter = couldHaveOutscoredStarter(player?.position, pts);

          return (
            <div key={playerId} className="flex items-center justify-between text-xs">
              <span className="text-text-muted w-10 shrink-0">BN</span>
              <span className={`truncate flex-1 mx-2 ${outscoredStarter ? 'text-accent-green' : 'text-text-muted'}`}>
                {getPlayerDisplay(playerId, playerLookup)}
              </span>
              <span className={`stat shrink-0 ${outscoredStarter ? 'text-accent-green font-semibold' : 'text-text-muted'}`}>
                {pts.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
