import type { RankedTeam } from '@/lib/rankings/compute';
import Card from '@/components/ui/Card';

interface Props {
  rankings: RankedTeam[];
}

// Aurora palette for the breakdown bar segments. Order matches Win%, PF, Luck, Streak.
const SEGMENT_COLORS = ['#E056FF', '#56F0FF', '#CCFF56', '#9D7FFF'] as const;
const SEGMENT_LABELS = ['Win %', 'Points For', 'Luck', 'Streak'] as const;

export default function PowerRankingsTable({ rankings }: Props) {
  if (!rankings.length) {
    return (
      <Card padding="lg" className="text-center">
        <p className="text-text-muted">No ranking data available yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rankings.map((entry, idx) => {
        const { team, rank } = entry;
        const totalGames = team.wins + team.losses + team.ties;
        const winPct = totalGames > 0 ? ((team.wins / totalGames) * 100).toFixed(0) : '0';

        // Leader gets magenta edge, top 3 keeps a subtler tint.
        const edge = idx === 0 ? 'mag' : idx === 1 ? 'cyan' : idx === 2 ? 'lime' : 'none';

        const segments = [
          entry.winPctScore,
          entry.pointsForScore,
          entry.luckScore,
          entry.streakScore,
        ];
        const total = segments.reduce((a, b) => a + b, 0) || 1;

        return (
          <Card
            key={`${entry.leagueId}-${team.rosterId}`}
            edge={edge}
            padding="md"
            className="relative overflow-hidden"
          >
            <div className="flex items-center gap-4">
              {/* Rank — oversized display numeral */}
              <div className="w-14 shrink-0 text-right">
                <span
                  className={`stat font-display font-bold leading-none tracking-[-0.04em] ${
                    idx === 0
                      ? 'text-5xl text-aurora-mag-cyan'
                      : idx < 3
                        ? 'text-4xl text-text-primary'
                        : 'text-3xl text-text-muted'
                  }`}
                >
                  {String(rank).padStart(2, '0')}
                </span>
              </div>

              {/* Avatar */}
              {team.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={team.avatar}
                  alt=""
                  className="w-11 h-11 rounded-full bg-bg-tertiary shrink-0 border border-hairline"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-bg-tertiary shrink-0 border border-hairline" />
              )}

              {/* Team info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={`truncate ${
                      idx === 0
                        ? 'font-display font-bold text-lg text-text-primary tracking-tight'
                        : 'font-semibold text-text-primary'
                    }`}
                  >
                    {team.teamName ?? team.displayName}
                  </p>
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-full font-mono text-[10px] tracking-[0.14em] uppercase font-semibold"
                    style={{
                      backgroundColor: `${entry.leagueColor}1f`,
                      color: entry.leagueColor,
                      border: `1px solid ${entry.leagueColor}55`,
                    }}
                  >
                    {entry.leagueName}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 font-mono text-[11px] text-text-muted tracking-wide">
                  <span>
                    <span className="text-aurora-lime">{team.wins}</span>
                    <span className="opacity-60">·</span>
                    <span className="text-aurora-pink">{team.losses}</span>
                    {team.ties > 0 && (
                      <>
                        <span className="opacity-60">·</span>
                        <span>{team.ties}</span>
                      </>
                    )}
                  </span>
                  <span>
                    <span className="text-text-muted opacity-60">WIN</span>{' '}
                    <span className="stat text-text-secondary">{winPct}%</span>
                  </span>
                  <span>
                    <span className="text-text-muted opacity-60">PF</span>{' '}
                    <span className="stat text-text-secondary">{team.pointsFor.toFixed(0)}</span>
                  </span>
                  <span className="hidden sm:inline">
                    <span className="text-text-muted opacity-60">PA</span>{' '}
                    <span className="stat text-text-secondary">
                      {team.pointsAgainst.toFixed(0)}
                    </span>
                  </span>
                </div>
              </div>

              {/* Power score */}
              <div className="text-right shrink-0">
                <p
                  className={`stat font-display font-bold leading-none tracking-[-0.03em] ${
                    idx === 0 ? 'text-3xl text-aurora-mag-cyan' : 'text-2xl text-text-primary'
                  }`}
                >
                  {entry.powerScore.toFixed(1)}
                </p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-text-muted mt-1">
                  Power
                </p>
              </div>
            </div>

            {/* Score breakdown bar */}
            <div className="mt-4 flex h-[3px] rounded-full overflow-hidden bg-white/[0.05]">
              {segments.map((v, i) => (
                <div
                  key={i}
                  style={{
                    width: `${(v / total) * 100}%`,
                    backgroundColor: SEGMENT_COLORS[i],
                    boxShadow: idx < 3 ? `0 0 8px ${SEGMENT_COLORS[i]}66` : undefined,
                  }}
                  title={`${SEGMENT_LABELS[i]} (${v.toFixed(1)})`}
                />
              ))}
            </div>
          </Card>
        );
      })}

      {/* Legend */}
      <div className="flex items-center justify-center flex-wrap gap-x-5 gap-y-2 pt-4">
        {SEGMENT_LABELS.map((label, i) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted"
          >
            <span
              className="w-4 h-[3px] rounded-full inline-block"
              style={{ backgroundColor: SEGMENT_COLORS[i] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
