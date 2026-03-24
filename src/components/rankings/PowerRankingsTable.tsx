import type { RankedTeam } from '@/lib/rankings/compute';

interface Props {
  rankings: RankedTeam[];
}

export default function PowerRankingsTable({ rankings }: Props) {
  if (!rankings.length) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-text-muted">No ranking data available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rankings.map((entry) => {
        const { team, rank } = entry;
        const totalGames = team.wins + team.losses + team.ties;
        const winPct = totalGames > 0 ? (team.wins / totalGames * 100).toFixed(0) : '0';

        return (
          <div key={`${entry.leagueId}-${team.rosterId}`} className="glass-card p-4">
            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className="w-8 text-center">
                <span className="stat text-lg font-bold text-white">{rank}</span>
              </div>

              {/* Avatar */}
              {team.avatar ? (
                <img src={team.avatar} alt="" className="w-10 h-10 rounded-full bg-bg-tertiary shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-bg-tertiary shrink-0" />
              )}

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-white truncate">
                    {team.teamName ?? team.displayName}
                  </p>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      backgroundColor: `${entry.leagueColor}22`,
                      color: entry.leagueColor,
                      border: `1px solid ${entry.leagueColor}44`,
                    }}
                  >
                    {entry.leagueName}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                  <span>
                    <span className="text-accent-green">{team.wins}</span>
                    <span>-</span>
                    <span className="text-accent-red">{team.losses}</span>
                    {team.ties > 0 && <span>-{team.ties}</span>}
                  </span>
                  <span className="text-text-secondary">{winPct}%</span>
                  <span>PF: <span className="stat text-text-secondary">{team.pointsFor.toFixed(0)}</span></span>
                  <span>PA: <span className="stat text-text-secondary">{team.pointsAgainst.toFixed(0)}</span></span>
                </div>
              </div>

              {/* Power score */}
              <div className="text-right shrink-0">
                <p className="stat text-xl font-bold text-accent-gold">
                  {entry.powerScore.toFixed(1)}
                </p>
                <p className="text-xs text-text-muted mt-0.5">Power Score</p>
              </div>
            </div>

            {/* Score breakdown bar */}
            <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-bg-tertiary">
              <div
                className="bg-primary"
                style={{ width: `${(entry.winPctScore / entry.powerScore) * 100}%` }}
                title={`Win% (${entry.winPctScore.toFixed(1)})`}
              />
              <div
                className="bg-accent-purple"
                style={{ width: `${(entry.pointsForScore / entry.powerScore) * 100}%` }}
                title={`PF Rank (${entry.pointsForScore.toFixed(1)})`}
              />
              <div
                className="bg-accent-green"
                style={{ width: `${(entry.luckScore / entry.powerScore) * 100}%` }}
                title={`Luck (${entry.luckScore.toFixed(1)})`}
              />
              <div
                className="bg-accent-gold"
                style={{ width: `${(entry.streakScore / entry.powerScore) * 100}%` }}
                title={`Streak (${entry.streakScore.toFixed(1)})`}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-primary inline-block" /> Win%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-accent-purple inline-block" /> Points For
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-accent-green inline-block" /> Luck
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded-sm bg-accent-gold inline-block" /> Streak
        </span>
      </div>
    </div>
  );
}
