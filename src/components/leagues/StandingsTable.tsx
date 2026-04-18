import type { StandingsTeam } from '@/lib/sleeper/league-data';

interface Props {
  standings: StandingsTeam[];
  leagueColor: string;
}

function formatStreak(streak: string | null) {
  if (!streak) return <span style={{ color: 'var(--ink-5)' }}>—</span>;
  const isWin = streak.toUpperCase().includes('W');
  return (
    <span style={{ color: isWin ? 'var(--accent-live)' : 'var(--accent-danger)' }}>
      {streak.toUpperCase()}
    </span>
  );
}

export default function StandingsTable({ standings, leagueColor }: Props) {
  if (!standings.length) {
    return (
      <div
        className="surface-raised"
        style={{ padding: 40, textAlign: 'center', margin: '16px 0' }}
      >
        <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>
          No standings data available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="std-table">
      <div className="std-table__accent" style={{ background: leagueColor }} />
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: 'center' }}>#</th>
            <th>TEAM</th>
            <th style={{ textAlign: 'center' }}>RECORD</th>
            <th style={{ textAlign: 'right' }}>PF</th>
            <th style={{ textAlign: 'right' }}>PA</th>
            <th style={{ textAlign: 'center' }}>STREAK</th>
            <th style={{ textAlign: 'center' }}>PO</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((team) => (
            <tr key={team.rosterId} className={team.inPlayoffPosition ? 'playoff' : ''}>
              <td className="rank">{String(team.rank).padStart(2, '0')}</td>
              <td className="team">
                {team.teamName ?? team.displayName}
                <span className="sub">{team.displayName}</span>
              </td>
              <td className="center">
                <span className="cw">{team.wins}</span>
                <span style={{ color: 'var(--ink-4)' }}> · </span>
                <span className="cl">{team.losses}</span>
                {team.ties > 0 && (
                  <>
                    <span style={{ color: 'var(--ink-4)' }}> · </span>
                    <span>{team.ties}</span>
                  </>
                )}
              </td>
              <td className="right">{team.pointsFor.toFixed(1)}</td>
              <td className="right" style={{ color: 'var(--ink-5)' }}>
                {team.pointsAgainst.toFixed(1)}
              </td>
              <td className="center">{formatStreak(team.streak)}</td>
              <td className="playoff-mark">
                {team.inPlayoffPosition && <span className="dot" title="Playoff position" />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
