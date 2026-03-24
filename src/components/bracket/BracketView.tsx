'use client';

import type { BracketData, BracketMatchup, BracketTeam } from '@/lib/bracket/engine';

interface Props {
  bracket: BracketData;
}

function TeamSlot({
  team,
  score,
  isWinner,
  isEmpty,
  seed,
}: {
  team: BracketTeam | null;
  score: number | null;
  isWinner: boolean;
  isEmpty: boolean;
  seed: number | null;
}) {
  if (isEmpty || !team) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-bg-primary/50 rounded border border-white/5 min-w-[200px]">
        <span className="text-text-muted text-sm italic">
          {seed ? `Seed #${seed}` : 'TBD'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded border min-w-[200px] transition-colors ${
        isWinner
          ? 'bg-accent-green/10 border-accent-green/30'
          : score !== null
            ? 'bg-bg-primary/50 border-white/5 opacity-60'
            : 'bg-bg-primary/50 border-white/10'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-text-muted w-5 shrink-0 text-center">
          {team.seed}
        </span>
        {team.avatar ? (
          <img
            src={team.avatar}
            alt=""
            className="w-6 h-6 rounded-full bg-bg-tertiary shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-bg-tertiary shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {team.teamName}
          </p>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${team.leagueColor}22`,
              color: team.leagueColor,
            }}
          >
            {team.leagueName}
          </span>
        </div>
      </div>
      {score !== null && (
        <span className={`stat text-sm font-bold ml-2 shrink-0 ${isWinner ? 'text-accent-green' : 'text-text-secondary'}`}>
          {score.toFixed(2)}
        </span>
      )}
    </div>
  );
}

function MatchupBox({
  matchup,
  teams,
}: {
  matchup: BracketMatchup;
  teams: BracketTeam[];
}) {
  const team1 = matchup.team1Seed
    ? teams.find((t) => t.seed === matchup.team1Seed) ?? null
    : null;
  const team2 = matchup.team2Seed
    ? teams.find((t) => t.seed === matchup.team2Seed) ?? null
    : null;

  const hasResult = matchup.winningSeed !== null;
  const t1Wins = hasResult && matchup.winningSeed === matchup.team1Seed;
  const t2Wins = hasResult && matchup.winningSeed === matchup.team2Seed;

  return (
    <div className="space-y-1">
      <p className="text-xs text-text-muted font-semibold mb-1">
        {matchup.label}
      </p>
      <TeamSlot
        team={team1}
        score={matchup.team1Score}
        isWinner={t1Wins}
        isEmpty={!team1 && matchup.team1Seed === null}
        seed={matchup.team1Seed}
      />
      <TeamSlot
        team={team2}
        score={matchup.team2Score}
        isWinner={t2Wins}
        isEmpty={!team2 && matchup.team2Seed === null}
        seed={matchup.team2Seed}
      />
    </div>
  );
}

export default function BracketView({ bracket }: Props) {
  const { teams, matchups } = bracket;

  // Group matchups by round
  const rounds: Record<number, BracketMatchup[]> = {};
  for (const m of matchups) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }

  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);

  // Champion display
  const champion = bracket.champion;

  return (
    <div className="space-y-8">
      {/* Champion banner */}
      {champion && (
        <div className="glass-card p-6 text-center space-y-2 border border-accent-gold/30 bg-accent-gold/5">
          <p className="text-accent-gold text-sm font-semibold uppercase tracking-wider">
            Champion
          </p>
          <div className="flex items-center justify-center gap-3">
            {champion.avatar ? (
              <img src={champion.avatar} alt="" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-bg-tertiary" />
            )}
            <div>
              <p className="text-2xl font-extrabold text-white">
                {champion.teamName}
              </p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${champion.leagueColor}22`,
                  color: champion.leagueColor,
                }}
              >
                {champion.leagueName}
              </span>
            </div>
          </div>
          <p className="text-text-secondary text-sm">
            {champion.wins}-{champion.losses} | {champion.pointsFor.toFixed(1)} PF
          </p>
        </div>
      )}

      {/* Bracket rounds - horizontal scroll on mobile */}
      <div className="overflow-x-auto">
        <div className="flex gap-8 min-w-max pb-4">
          {roundNumbers.map((roundNum) => {
            const roundMatchups = rounds[roundNum];
            const isFinal = roundMatchups.length === 1 && roundMatchups[0].id === 'FINAL';

            return (
              <div key={roundNum} className="flex flex-col gap-6 justify-center">
                <h3 className={`text-xs font-bold uppercase tracking-wider text-center ${
                  isFinal ? 'text-accent-gold' : 'text-text-muted'
                }`}>
                  {roundMatchups[0]?.label.replace(/\s\d+$/, '') || `Round ${roundNum}`}
                </h3>
                {roundMatchups.map((matchup) => (
                  <MatchupBox
                    key={matchup.id}
                    matchup={matchup}
                    teams={teams}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Seed list */}
      {teams.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h3 className="text-sm font-bold text-white">Seedings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {teams
              .sort((a, b) => a.seed - b.seed)
              .map((team) => (
                <div
                  key={`${team.leagueId}-${team.rosterId}`}
                  className="flex items-center gap-3 p-2 rounded-lg bg-bg-primary/50"
                >
                  <span className="text-text-muted text-sm w-6 text-center font-bold">
                    #{team.seed}
                  </span>
                  {team.avatar ? (
                    <img src={team.avatar} alt="" className="w-7 h-7 rounded-full bg-bg-tertiary" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-bg-tertiary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">{team.teamName}</p>
                    <p className="text-xs text-text-muted">
                      {team.wins}-{team.losses} | {team.pointsFor.toFixed(1)} PF
                    </p>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: `${team.leagueColor}22`,
                      color: team.leagueColor,
                    }}
                  >
                    {team.leagueName}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
