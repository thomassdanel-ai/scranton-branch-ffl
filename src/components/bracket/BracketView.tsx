'use client';

import type { BracketData, BracketMatchup, BracketTeam } from '@/lib/bracket/engine';

interface Props {
  bracket: BracketData;
  leagueCount?: number;
}

function roundName(roundNum: number, totalRounds: number): { name: string; sub: string } {
  const fromFinal = totalRounds - roundNum;
  if (fromFinal === 0) return { name: 'FINAL', sub: 'CHAMPIONSHIP WEEK' };
  if (fromFinal === 1) return { name: 'SEMIFINALS', sub: `ROUND ${roundNum}` };
  if (fromFinal === 2) return { name: 'QUARTERFINALS', sub: `ROUND ${roundNum}` };
  return { name: `ROUND ${roundNum}`, sub: `ROUND ${roundNum}` };
}

function matchState(m: BracketMatchup): 'done' | 'live' | 'next' | 'pending' {
  const hasScore = m.team1Score !== null || m.team2Score !== null;
  const hasWinner = m.winningSeed !== null;
  if (hasWinner) return 'done';
  if (hasScore) return 'live';
  if (m.team1Seed !== null && m.team2Seed !== null) return 'next';
  return 'pending';
}

function MatchRow({
  team,
  score,
  seed,
  isWinner,
  isTbd,
}: {
  team: BracketTeam | null;
  score: number | null;
  seed: number | null;
  isWinner: boolean;
  isTbd: boolean;
}) {
  const cls = isWinner ? 'match-row mr--win' : isTbd ? 'match-row mr--tbd' : 'match-row';
  return (
    <div className={cls}>
      <span className="mr__seed">{seed ? `#${String(seed).padStart(2, '0')}` : '—'}</span>
      <span className="mr__name" title={team?.teamName ?? 'TBD'}>
        {team?.teamName ?? (seed ? `Seed #${seed}` : 'TBD')}
      </span>
      <span className="mr__score">
        {score !== null ? score.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function Match({
  matchup,
  teams,
  totalRounds,
}: {
  matchup: BracketMatchup;
  teams: BracketTeam[];
  totalRounds: number;
}) {
  const team1 = matchup.team1Seed ? teams.find((t) => t.seed === matchup.team1Seed) ?? null : null;
  const team2 = matchup.team2Seed ? teams.find((t) => t.seed === matchup.team2Seed) ?? null : null;
  const state = matchState(matchup);
  const isFinal = matchup.id === 'FINAL' || matchup.round === totalRounds;
  const t1Win = matchup.winningSeed !== null && matchup.winningSeed === matchup.team1Seed;
  const t2Win = matchup.winningSeed !== null && matchup.winningSeed === matchup.team2Seed;
  const t1Tbd = matchup.team1Seed === null;
  const t2Tbd = matchup.team2Seed === null;

  const cls = [
    'match',
    state === 'done' ? 'match--done' : '',
    state === 'live' ? 'match--live' : '',
    state === 'next' ? 'match--next' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const hdrCls = [
    'match__hdr',
    state === 'live' ? 'match__hdr--live' : '',
    state === 'next' ? 'match__hdr--next' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls}>
      <div className={hdrCls}>
        <span>
          {state === 'live' && <span className="livedot" />}
          {isFinal ? 'FINAL' : matchup.label.toUpperCase()}
        </span>
        <span>
          {state === 'live' ? 'LIVE' : state === 'done' ? 'FINAL' : state === 'next' ? 'ON DECK' : 'TBD'}
        </span>
      </div>
      <MatchRow
        team={team1}
        score={matchup.team1Score}
        seed={matchup.team1Seed}
        isWinner={t1Win}
        isTbd={t1Tbd}
      />
      <MatchRow
        team={team2}
        score={matchup.team2Score}
        seed={matchup.team2Seed}
        isWinner={t2Win}
        isTbd={t2Tbd}
      />
    </div>
  );
}

export default function BracketView({ bracket, leagueCount = 0 }: Props) {
  const { teams, matchups, champion } = bracket;

  const rounds: Record<number, BracketMatchup[]> = {};
  for (const m of matchups) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  }
  const roundNumbers = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);
  const totalRounds = roundNumbers.length > 0 ? Math.max(...roundNumbers) : bracket.rounds;

  const hasChampion = !!champion;
  const showChampCell = totalRounds >= 1;

  const gridCols = `repeat(${totalRounds + (showChampCell ? 1 : 0)}, 1fr)`;

  // Group teams by league for qualifiers display
  const byLeague: Record<string, BracketTeam[]> = {};
  for (const t of teams) {
    if (!byLeague[t.leagueId]) byLeague[t.leagueId] = [];
    byLeague[t.leagueId].push(t);
  }
  const leagueGroups = Object.values(byLeague);
  const gridColsQ = leagueCount > 0 || leagueGroups.length > 1 ? '1fr 1fr' : '1fr';

  const isLive = bracket.status === 'in_progress';

  return (
    <>
      {/* Qualifiers */}
      {leagueGroups.length > 0 && (
        <section className="qualifiers" style={{ gridTemplateColumns: gridColsQ }}>
          {leagueGroups.map((group) => {
            const leagueName = group[0]?.leagueName.toUpperCase() ?? 'LEAGUE';
            const sorted = [...group].sort((a, b) => a.seed - b.seed);
            return (
              <div key={group[0].leagueId} className="q-col">
                <h3>{leagueName} · QUALIFIED</h3>
                <div className="q-list">
                  {sorted.map((t, i) => {
                    const isBye = i === 0 && totalRounds > 1 && sorted.length > 1;
                    return (
                      <div
                        key={`${t.leagueId}-${t.rosterId}`}
                        className={isBye ? 'q-row q-row--bye' : 'q-row'}
                      >
                        <span className="s">#{String(t.seed).padStart(2, '0')}</span>
                        <span className="n">{t.teamName}</span>
                        <span className="p">
                          {t.wins}·{t.losses} · {t.pointsFor.toFixed(0)} PF
                        </span>
                        {isBye && <span className="q-row__bye">BYE</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Bracket */}
      <section className="bracket-wrap">
        <div className="bracket-head">
          <h2>THE LADDER</h2>
          {isLive ? (
            <span className="chip chip--live">
              <span className="livedot" /> LIVE · PLAYOFFS
            </span>
          ) : hasChampion ? (
            <span className="chip">
              COMPLETE · {bracket.seasonYear}
            </span>
          ) : (
            <span className="chip">
              SEEDED · {teams.length} TEAMS
            </span>
          )}
        </div>

        <div className="round-labels" style={{ gridTemplateColumns: gridCols }}>
          {roundNumbers.map((r) => {
            const { name, sub } = roundName(r, totalRounds);
            const onRound = isLive && rounds[r].some((m) => matchState(m) === 'live');
            const isChamp = r === totalRounds;
            const cls = [
              'rnd',
              onRound ? 'rnd--on' : '',
              isChamp && hasChampion ? 'rnd--champ' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={r} className={cls}>
                <span className="rnd__n">{name}</span>
                <span className="rnd__m">{sub}</span>
              </div>
            );
          })}
          {showChampCell && (
            <div className={`rnd ${hasChampion ? 'rnd--champ' : ''}`}>
              <span className="rnd__n">THE DUNDIE</span>
              <span className="rnd__m">CHAMPION</span>
            </div>
          )}
        </div>

        <div className="bracket-grid" style={{ gridTemplateColumns: gridCols }}>
          {roundNumbers.map((r, idx) => {
            const colCls = [
              'b-col',
              idx === 0 ? 'b-col--r1' : '',
              r === totalRounds ? 'b-col--center' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <div key={r} className={colCls}>
                {rounds[r].map((m) => (
                  <Match key={m.id} matchup={m} teams={teams} totalRounds={totalRounds} />
                ))}
              </div>
            );
          })}

          {showChampCell && (
            <div className="b-col b-col--center">
              <div className="match match--champ">
                <div className="match__hdr">
                  <span>DUNDIE AWARD</span>
                  <span>🏆</span>
                </div>
                {champion ? (
                  <div className="match__champ-body">
                    <div className="n">{champion.teamName}</div>
                    <span className="m">
                      {bracket.seasonYear} · {champion.leagueName}
                    </span>
                    <span className="m">
                      {champion.wins}·{champion.losses} · {champion.pointsFor.toFixed(0)} PF
                    </span>
                  </div>
                ) : (
                  <div className="match__champ-body">
                    <div className="n" style={{ color: 'var(--ink-4)' }}>
                      TBD
                    </div>
                    <span className="m">{bracket.seasonYear} · AWAITING</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
