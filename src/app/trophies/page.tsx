import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

type ResultRow = {
  week: number;
  points: number;
  opponent_points: number | null;
  result: 'win' | 'loss' | 'tie' | null;
  member_season_id: string | null;
  is_bracket: boolean;
  is_playoff: boolean;
};

type MemberMeta = {
  id: string;
  name: string;
  leagueName: string;
  leagueColor: string;
};

type Award = {
  title: string;
  tagline: string;
  winner: string | null;
  value: string;
  sub: string;
  icon: string;
  league?: string;
  leagueColor?: string;
};

export default async function TrophyCasePage() {
  const supabase = createServiceClient();
  const seasonId = await getActiveSeasonId();

  if (!seasonId) {
    return <EmptyState />;
  }

  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('id, members(display_name, full_name), leagues(name, color)')
    .eq('season_id', seasonId);

  const meta = new Map<string, MemberMeta>();
  for (const ms of memberSeasons ?? []) {
    const m = ms.members as unknown as { display_name: string | null; full_name: string } | null;
    const l = ms.leagues as unknown as { name: string; color: string } | null;
    meta.set(ms.id, {
      id: ms.id,
      name: m?.display_name || m?.full_name || '\u2014',
      leagueName: l?.name ?? '',
      leagueColor: l?.color ?? '#888',
    });
  }

  const { data: raw } = await supabase
    .from('weekly_results')
    .select('week, points, opponent_points, result, member_season_id, is_bracket, is_playoff')
    .eq('season_id', seasonId)
    .eq('is_bracket', false);

  const results = (raw ?? []) as ResultRow[];

  const byMember = new Map<string, ResultRow[]>();
  for (const r of results) {
    if (!r.member_season_id) continue;
    const arr = byMember.get(r.member_season_id) ?? [];
    arr.push(r);
    byMember.set(r.member_season_id, arr);
  }
  Array.from(byMember.values()).forEach((arr) =>
    arr.sort((a: ResultRow, b: ResultRow) => a.week - b.week),
  );

  const awards: Award[] = [];

  let hi: ResultRow | null = null;
  for (const r of results) if (!hi || r.points > hi.points) hi = r;
  if (hi) {
    const m = meta.get(hi.member_season_id ?? '');
    awards.push({
      title: 'Bushiest Beaver',
      tagline: 'Highest single-week score',
      winner: m?.name ?? null,
      value: hi.points.toFixed(1),
      sub: `Week ${hi.week}`,
      icon: '\u{1F3C6}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  let lo: ResultRow | null = null;
  for (const r of results) if (!lo || r.points < lo.points) lo = r;
  if (lo && lo !== hi) {
    const m = meta.get(lo.member_season_id ?? '');
    awards.push({
      title: "World's Worst Boss",
      tagline: 'Lowest single-week score',
      winner: m?.name ?? null,
      value: lo.points.toFixed(1),
      sub: `Week ${lo.week}`,
      icon: '\u{1F4C9}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  let blow: { row: ResultRow; margin: number } | null = null;
  for (const r of results) {
    if (r.result !== 'win' || r.opponent_points == null) continue;
    const margin = r.points - r.opponent_points;
    if (!blow || margin > blow.margin) blow = { row: r, margin };
  }
  if (blow) {
    const m = meta.get(blow.row.member_season_id ?? '');
    awards.push({
      title: 'Spicy Curry',
      tagline: 'Biggest blowout',
      winner: m?.name ?? null,
      value: `+${blow.margin.toFixed(1)}`,
      sub: `Week ${blow.row.week} \u00b7 ${blow.row.points.toFixed(1)}\u2013${(blow.row.opponent_points ?? 0).toFixed(1)}`,
      icon: '\u{1F336}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  let squeak: { row: ResultRow; margin: number } | null = null;
  for (const r of results) {
    if (r.result !== 'win' || r.opponent_points == null) continue;
    const margin = r.points - r.opponent_points;
    if (margin <= 0) continue;
    if (!squeak || margin < squeak.margin) squeak = { row: r, margin };
  }
  if (squeak) {
    const m = meta.get(squeak.row.member_season_id ?? '');
    awards.push({
      title: 'Tight-Ass Award',
      tagline: 'Narrowest escape',
      winner: m?.name ?? null,
      value: `+${squeak.margin.toFixed(2)}`,
      sub: `Week ${squeak.row.week}`,
      icon: '\u{1F62C}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  let longestW: { memberSeasonId: string; len: number } = { memberSeasonId: '', len: 0 };
  let longestL: { memberSeasonId: string; len: number } = { memberSeasonId: '', len: 0 };
  Array.from(byMember.entries()).forEach(([msId, arr]: [string, ResultRow[]]) => {
    let w = 0;
    let l = 0;
    for (const r of arr) {
      if (r.result === 'win') {
        w++;
        l = 0;
        if (w > longestW.len) longestW = { memberSeasonId: msId, len: w };
      } else if (r.result === 'loss') {
        l++;
        w = 0;
        if (l > longestL.len) longestL = { memberSeasonId: msId, len: l };
      } else {
        w = 0;
        l = 0;
      }
    }
  });
  if (longestW.len > 0) {
    const m = meta.get(longestW.memberSeasonId);
    awards.push({
      title: 'Hottest In The Office',
      tagline: 'Longest win streak',
      winner: m?.name ?? null,
      value: `${longestW.len}-game`,
      sub: 'Unstoppable. That\u2019s what she said.',
      icon: '\u{1F525}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }
  if (longestL.len > 0) {
    const m = meta.get(longestL.memberSeasonId);
    awards.push({
      title: 'Toby Flenderson Memorial',
      tagline: 'Longest losing streak',
      winner: m?.name ?? null,
      value: `${longestL.len}-game`,
      sub: 'Just\u2026 please go home.',
      icon: '\u{1FA91}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  let topPF: { memberSeasonId: string; total: number } = { memberSeasonId: '', total: 0 };
  Array.from(byMember.entries()).forEach(([msId, arr]: [string, ResultRow[]]) => {
    const total = arr.reduce((s: number, r: ResultRow) => s + (r.points ?? 0), 0);
    if (total > topPF.total) topPF = { memberSeasonId: msId, total };
  });
  if (topPF.total > 0) {
    const m = meta.get(topPF.memberSeasonId);
    awards.push({
      title: 'Salesman of the Year',
      tagline: 'Most total points',
      winner: m?.name ?? null,
      value: topPF.total.toFixed(1),
      sub: `${(byMember.get(topPF.memberSeasonId)?.length ?? 0)} games`,
      icon: '\u{1F4BC}',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  return (
    <main className="col col--lg" style={{ maxWidth: 1200, padding: '40px 16px' }}>
      <div className="page-hero page-hero--center">
        <div className="page-hero__kicker">The Dundies</div>
        <h1 className="page-hero__title">Trophy Case</h1>
        <p className="page-hero__sub">
          The definitive, non-negotiable, Michael-Scott-approved awards for this season.
        </p>
      </div>

      {awards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="trophy-grid">
          {awards.map((a) => (
            <TrophyCard key={a.title} award={a} />
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Link
          href="/"
          style={{ color: 'var(--ink-5)', font: '500 var(--fs-13) / 1 var(--font-mono)' }}
        >
          &larr; Back to the bullpen
        </Link>
      </div>
    </main>
  );
}

function TrophyCard({ award }: { award: Award }) {
  const leagueColor = award.leagueColor ?? '#888';
  return (
    <div className="trophy-card">
      <div
        className="trophy-card__glow"
        style={{
          background: `radial-gradient(ellipse at top, ${leagueColor}20, transparent 60%)`,
        }}
      />
      <div className="trophy-card__body">
        <div className="trophy-card__top">
          <span className="trophy-card__icon">{award.icon}</span>
          {award.league && (
            <span
              className="trophy-card__league"
              style={{
                backgroundColor: `${leagueColor}1a`,
                color: leagueColor,
                border: `1px solid ${leagueColor}55`,
              }}
            >
              {award.league}
            </span>
          )}
        </div>
        <div className="trophy-card__title">{award.title}</div>
        <div className="trophy-card__winner">{award.winner ?? '\u2014'}</div>
        <div className="trophy-card__val">{award.value}</div>
        <div className="trophy-card__tagline">{award.tagline}</div>
        <div className="trophy-card__sub">{award.sub}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state" style={{ alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 40 }}>&#127942;</div>
      <div className="empty-state__title">Awards ceremony pending.</div>
      <div className="empty-state__body">
        Michael is still writing the speeches. Come back once Week 1 wraps.
      </div>
    </div>
  );
}
