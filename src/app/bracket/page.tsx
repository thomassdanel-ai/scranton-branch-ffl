import Link from 'next/link';
import { loadBracket } from '@/lib/bracket/engine';
import { getSeasonLeagues, getChampionshipConfig, getSeasonStatus } from '@/lib/config';
import BracketView from '@/components/bracket/BracketView';
import PhaseStrip from '@/components/layout/PhaseStrip';
import { ORG_SHORT_NAME } from '@/config/constants';

export const metadata = {
  title: 'Championship Bracket',
  description: 'Cross-league championship playoff bracket — the best from each league compete for the title.',
  openGraph: {
    title: `Championship Bracket | ${ORG_SHORT_NAME}`,
    description: 'Cross-league championship playoff bracket — the best from each league compete for the title.',
  },
};

export const revalidate = 300;

export default async function BracketPage() {
  const [bracket, leagues, championship, status] = await Promise.all([
    loadBracket(),
    getSeasonLeagues(),
    getChampionshipConfig(),
    getSeasonStatus(),
  ]);

  const qualifiers = leagues.length * championship.qualifiersPerLeague;
  const isLive = status.phase === 'playoffs';

  return (
    <>
      <div className="crumb-bar">
        <Link href="/">HOME</Link>
        <span className="sep">/</span>
        <b>BRACKET</b>
      </div>

      <PhaseStrip year={status.year} phase={status.phase} />

      <div className="wrap">
        <section className="bkt-head">
          <div className="bkt-head__l">
            <div className="kicker" style={{ marginBottom: 20 }}>
              <span className="kicker__dot" />
              PLAYOFFS · CROSS-LEAGUE · TOP {championship.qualifiersPerLeague} / LEAGUE
            </div>
            <h1>
              THE <em>DUNDIE</em>
              <br />
              BRACKET.
            </h1>
            <p className="sub">
              {qualifiers} teams, {bracket?.rounds ?? 3} weeks, one trophy.
              Top {championship.qualifiersPerLeague} from each league qualify, seeded by record with
              Points For as tiebreaker. The bracket lives here until someone raises the Dundie.
            </p>
          </div>
          <div className="hero-stats">
            <div className="hs">
              <span className="hs__lab">FIELD</span>
              <span className="hs__val">{bracket?.teams.length ?? qualifiers}</span>
              <span className="hs__note">
                <span className="hi">TEAMS</span> QUALIFIED
              </span>
            </div>
            <div className="hs">
              <span className="hs__lab">ROUNDS</span>
              <span className="hs__val">{bracket?.rounds ?? 3}</span>
              <span className="hs__note">
                <span className="hi">SINGLE</span> ELIM
              </span>
            </div>
            <div className={`hs ${isLive ? 'hs--live' : ''}`}>
              <span className="hs__lab">{isLive ? 'STATUS' : 'FORMAT'}</span>
              <span className="hs__val">
                {bracket
                  ? bracket.status === 'complete'
                    ? 'DONE'
                    : bracket.status === 'in_progress'
                      ? 'LIVE'
                      : 'SET'
                  : 'TBD'}
              </span>
              <span className="hs__note">
                {isLive ? (
                  <>
                    <span className="hi">PLAYOFFS</span> ACTIVE
                  </>
                ) : (
                  <>
                    <span className="hi">SEEDED</span> 1–{qualifiers || '—'}
                  </>
                )}
              </span>
            </div>
          </div>
        </section>

        {!bracket ? (
          <section
            className="surface-raised"
            style={{
              padding: 40,
              textAlign: 'center',
              margin: '32px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div
              className="font-display"
              style={{
                fontSize: 40,
                letterSpacing: 'var(--tr-wide)',
                color: 'var(--ink-8)',
                textTransform: 'uppercase',
              }}
            >
              BRACKET NOT SET
            </div>
            <p style={{ color: 'var(--ink-6)', maxWidth: 520, fontSize: 'var(--fs-14)', lineHeight: 1.5 }}>
              The commissioner will seed the {qualifiers}-team championship bracket once the
              regular season wraps up.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12 }}>
              {leagues.map((league) => (
                <span key={league.dbId} className="chip">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: league.color,
                      display: 'inline-block',
                    }}
                  />
                  TOP {championship.qualifiersPerLeague} · {league.name.toUpperCase()}
                </span>
              ))}
            </div>
          </section>
        ) : (
          <BracketView bracket={bracket} leagueCount={leagues.length} />
        )}

        <section className="bkt-below">
          <div className="bkt-panel">
            <div className="bkt-panel__h">
              <h4>BRACKET RULES</h4>
              <span className="label">CROSS-LEAGUE FORMAT</span>
            </div>
            <div className="rules-list">
              <div className="rule">
                <div className="k">QUALIFIERS</div>
                <div className="v">
                  Top {championship.qualifiersPerLeague} finishers from each league by W/L record.
                  Ties broken by Points For.
                </div>
              </div>
              <div className="rule">
                <div className="k">SEEDING</div>
                <div className="v">
                  Seeds 1–{qualifiers || '—'} ordered by regular-season record across all leagues combined.
                </div>
              </div>
              <div className="rule">
                <div className="k">BYES</div>
                <div className="v">
                  Top seeds auto-advance past the first round when the field is uneven.
                </div>
              </div>
              <div className="rule">
                <div className="k">SCORING</div>
                <div className="v">
                  Each round = one Sleeper matchup week. Cumulative points do not carry over.
                </div>
              </div>
              <div className="rule">
                <div className="k">TIES</div>
                <div className="v">
                  Highest-scoring starter at RB wins. If still tied, coin flip by commissioner.
                </div>
              </div>
              <div className="rule">
                <div className="k">PRIZE</div>
                <div className="v">
                  The Dundie Award, annual glory, and one free HR Compliance pass (non-transferable).
                </div>
              </div>
            </div>
          </div>

          <div className="bkt-panel">
            <div className="bkt-panel__h">
              <h4>LEAGUES IN PLAY</h4>
              <span className="label">{leagues.length} DIVISIONS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {leagues.map((league) => (
                <div
                  key={league.dbId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '10px 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--ink-0)',
                    border: 'var(--hairline-subtle)',
                    borderRadius: 'var(--r-3)',
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: league.color,
                    }}
                  />
                  <span style={{ color: 'var(--ink-8)', fontWeight: 500, fontSize: 'var(--fs-14)' }}>
                    {league.name}
                  </span>
                  <span className="label">
                    TOP {championship.qualifiersPerLeague}
                  </span>
                </div>
              ))}
              {leagues.length === 0 && (
                <p style={{ color: 'var(--ink-5)', fontSize: 'var(--fs-14)' }}>
                  No leagues configured for this season yet.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
