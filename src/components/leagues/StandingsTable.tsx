import type { StandingsTeam } from '@/lib/sleeper/league-data';

interface Props {
  standings: StandingsTeam[];
  leagueColor: string;
}

function formatStreak(streak: string | null) {
  if (!streak) return <span className="text-text-muted">—</span>;
  const isWin = streak.toUpperCase().includes('W');
  return (
    <span className={isWin ? 'text-accent-green' : 'text-accent-red'}>
      {streak.toUpperCase()}
    </span>
  );
}

export default function StandingsTable({ standings, leagueColor }: Props) {
  if (!standings.length) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-text-muted">No standings data available yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden" style={{ borderTop: `2px solid ${leagueColor}` }}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-text-secondary text-left">
              <th className="px-4 py-3 w-12 text-center">#</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3 text-center">Record</th>
              <th className="px-4 py-3 text-right">PF</th>
              <th className="px-4 py-3 text-right">PA</th>
              <th className="px-4 py-3 text-center">Streak</th>
              <th className="px-4 py-3 text-center w-12"></th>
            </tr>
          </thead>
          <tbody>
            {standings.map((team) => (
              <tr
                key={team.rosterId}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="px-4 py-3 text-center text-text-muted stat">
                  {team.rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {team.avatar ? (
                      <img
                        src={team.avatar}
                        alt=""
                        className="w-8 h-8 rounded-full bg-bg-tertiary"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-bg-tertiary" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate">
                        {team.teamName ?? team.displayName}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {team.displayName}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center stat">
                  <span className="text-accent-green">{team.wins}</span>
                  <span className="text-text-muted">-</span>
                  <span className="text-accent-red">{team.losses}</span>
                  {team.ties > 0 && (
                    <>
                      <span className="text-text-muted">-</span>
                      <span className="text-text-secondary">{team.ties}</span>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right stat text-white">
                  {team.pointsFor.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right stat text-text-secondary">
                  {team.pointsAgainst.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center stat">
                  {formatStreak(team.streak)}
                </td>
                <td className="px-4 py-3 text-center">
                  {team.inPlayoffPosition && (
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#f59e0b' }}
                      title="Playoff position"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
