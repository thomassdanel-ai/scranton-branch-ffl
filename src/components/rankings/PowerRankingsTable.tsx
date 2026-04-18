import type { RankedTeam } from '@/lib/rankings/compute';

interface Props {
  rankings: RankedTeam[];
}

const SEGMENT_LABELS = ['Win %', 'Points For', 'Luck', 'Streak'] as const;
// Accent ramp: live (lime), clock (amber), neutral (cyan), danger (rose)
const SEGMENT_VARS = [
  'var(--accent-live)',
  'var(--accent-clock)',
  'var(--accent-neutral)',
  'var(--accent-danger)',
] as const;

export default function PowerRankingsTable({ rankings }: Props) {
  if (!rankings.length) {
    return (
      <div
        className="surface-raised"
        style={{
          padding: 48,
          textAlign: 'center',
          margin: '24px 0',
        }}
      >
        <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>
          No ranking data available yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rnk-list">
        {rankings.map((entry, idx) => {
          const { team, rank } = entry;
          const totalGames = team.wins + team.losses + team.ties;
          const winPct = totalGames > 0 ? ((team.wins / totalGames) * 100).toFixed(0) : '0';
          const segments = [
            entry.winPctScore,
            entry.pointsForScore,
            entry.luckScore,
            entry.streakScore,
          ];
          const total = segments.reduce((a, b) => a + b, 0) || 1;
          const isTop = idx === 0;
          const isPodium = idx > 0 && idx < 3;
          const rowCls = [
            'rnk-row',
            isTop ? 'rnk-row--top' : '',
            isPodium ? 'rnk-row--podium' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <div
              key={`${entry.leagueId}-${team.rosterId}`}
              className={rowCls}
              style={{ gridTemplateColumns: '56px 1fr auto', gridAutoRows: 'auto' }}
            >
              <div className="rnk-row__rank">{String(rank).padStart(2, '0')}</div>
              <div className="rnk-row__body">
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}
                >
                  <span className="rnk-row__name">{team.teamName ?? team.displayName}</span>
                  <span
                    className="chip"
                    style={{
                      background: `${entry.leagueColor}22`,
                      color: entry.leagueColor,
                      borderColor: `${entry.leagueColor}55`,
                    }}
                  >
                    {entry.leagueName}
                  </span>
                </div>
                <div className="rnk-row__meta">
                  <span>
                    <span className="w">{team.wins}</span>
                    <span className="pipe"> · </span>
                    <span className="l">{team.losses}</span>
                    {team.ties > 0 && (
                      <>
                        <span className="pipe"> · </span>
                        <span>{team.ties}</span>
                      </>
                    )}
                  </span>
                  <span>
                    WIN <span className="stat">{winPct}%</span>
                  </span>
                  <span>
                    PF <span className="stat">{team.pointsFor.toFixed(0)}</span>
                  </span>
                  <span style={{ display: 'none' }} className="pa-hidden" />
                  <span>
                    PA <span className="stat">{team.pointsAgainst.toFixed(0)}</span>
                  </span>
                </div>
              </div>
              <div className="rnk-row__score">
                <span className="v">{entry.powerScore.toFixed(1)}</span>
                <span className="l">POWER</span>
              </div>
              <div className="rnk-row__bar">
                {segments.map((v, i) => (
                  <div
                    key={i}
                    className="rnk-row__seg"
                    title={`${SEGMENT_LABELS[i]} (${v.toFixed(1)})`}
                    style={{
                      width: `${(v / total) * 100}%`,
                      background: SEGMENT_VARS[i],
                      opacity: idx < 3 ? 1 : 0.7,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '12px 24px',
          padding: '8px 0 40px',
        }}
      >
        {SEGMENT_LABELS.map((label, i) => (
          <span
            key={label}
            className="label"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <span
              style={{
                width: 16,
                height: 3,
                background: SEGMENT_VARS[i],
                borderRadius: 2,
                display: 'inline-block',
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </>
  );
}
