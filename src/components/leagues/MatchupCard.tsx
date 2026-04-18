'use client';

import { useState } from 'react';
import type { MatchupPair } from '@/lib/sleeper/league-data';

type PlayerLookup = Record<
  string,
  { player_id: string; full_name: string; position: string; team: string | null }
>;

interface Props {
  matchup: MatchupPair;
  rosterPositions: string[];
  playerLookup?: PlayerLookup;
}

function TeamSide({
  team,
  points,
  isWinner,
  isLoser,
}: {
  team: MatchupPair['team1']['team'];
  points: number;
  isWinner: boolean;
  isLoser: boolean;
}) {
  const cls = `mu-team ${isWinner ? 'mu-team--win' : ''} ${isLoser ? 'mu-team--loss' : ''}`.trim();
  return (
    <div className={cls}>
      <div className="mu-team__mark" aria-hidden />
      <div style={{ minWidth: 0 }}>
        <div className="mu-team__name">{team.teamName ?? team.displayName}</div>
        <span className="mu-team__rec">
          {team.wins}·{team.losses}
          {team.ties > 0 ? `·${team.ties}` : ''}
        </span>
      </div>
      <div className="mu-team__score">{points.toFixed(1)}</div>
    </div>
  );
}

export default function MatchupCard({ matchup, rosterPositions, playerLookup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { team1, team2 } = matchup;
  const isComplete = team1.points > 0 || team2.points > 0;
  const t1Wins = isComplete && team1.points > team2.points;
  const t2Wins = isComplete && team2.points > team1.points;

  return (
    <div className="mu-card" data-open={expanded ? 'true' : 'false'}>
      <button type="button" className="mu-card__hdr" onClick={() => setExpanded(!expanded)}>
        <TeamSide
          team={team1.team}
          points={team1.points}
          isWinner={t1Wins}
          isLoser={t2Wins}
        />
        <TeamSide
          team={team2.team}
          points={team2.points}
          isWinner={t2Wins}
          isLoser={t1Wins}
        />
        <div className="mu-card__arrow">{expanded ? '▴ COLLAPSE' : '▾ LINEUPS'}</div>
      </button>

      {expanded && (
        <div className="mu-card__body">
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

function StarterList({
  starters,
  startersPoints,
  positions,
  playerLookup,
}: {
  starters: string[];
  startersPoints: number[];
  positions: string[];
  playerLookup?: PlayerLookup;
}) {
  if (!starters.length) {
    return <p style={{ color: 'var(--ink-5)', fontSize: 12 }}>No lineup data</p>;
  }

  return (
    <div className="mu-lineup">
      <div className="mu-lineup__head">STARTERS</div>
      {starters.map((playerId, i) => (
        <div key={`${playerId}-${i}`} className="mu-line">
          <span className="mu-line__slot">{positions[i] ?? 'BN'}</span>
          <span className="mu-line__name">{getPlayerDisplay(playerId, playerLookup)}</span>
          <span className="mu-line__pts">{startersPoints[i]?.toFixed(1) ?? '0.0'}</span>
        </div>
      ))}
    </div>
  );
}

function BenchList({
  players,
  starters,
  playersPoints,
  startersPoints,
  rosterPositions,
  playerLookup,
}: {
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

  const FLEX_ELIGIBLE = new Set(['RB', 'WR', 'TE']);
  const SUPER_FLEX_ELIGIBLE = new Set(['QB', 'RB', 'WR', 'TE']);

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
    if (slotMinScore[pos] !== undefined && pts > slotMinScore[pos]) return true;
    if (FLEX_ELIGIBLE.has(pos) && slotMinScore['FLEX'] !== undefined && pts > slotMinScore['FLEX'])
      return true;
    if (
      SUPER_FLEX_ELIGIBLE.has(pos) &&
      slotMinScore['SUPER_FLEX'] !== undefined &&
      pts > slotMinScore['SUPER_FLEX']
    )
      return true;
    if (
      FLEX_ELIGIBLE.has(pos) &&
      slotMinScore['REC_FLEX'] !== undefined &&
      pts > slotMinScore['REC_FLEX']
    )
      return true;
    return false;
  }

  const sorted = [...benchPlayers].sort(
    (a, b) => (playersPoints[b] ?? 0) - (playersPoints[a] ?? 0)
  );

  return (
    <div className="mu-lineup" style={{ marginTop: 10 }}>
      <div className="mu-lineup__head">BENCH</div>
      {sorted.map((playerId) => {
        const pts = playersPoints[playerId] ?? 0;
        const player = playerLookup?.[playerId];
        const outscored = couldHaveOutscoredStarter(player?.position, pts);
        return (
          <div
            key={playerId}
            className={`mu-line mu-line--bench ${outscored ? 'mu-line--outscored' : ''}`}
          >
            <span className="mu-line__slot">{player?.position ?? 'BN'}</span>
            <span className="mu-line__name">{getPlayerDisplay(playerId, playerLookup)}</span>
            <span className="mu-line__pts">{pts.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}
