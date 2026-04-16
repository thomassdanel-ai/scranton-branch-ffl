import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

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

  // Member identity map for every member_season in the active season.
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
      name: m?.display_name || m?.full_name || '—',
      leagueName: l?.name ?? '',
      leagueColor: l?.color ?? '#888',
    });
  }

  // Regular-season rows only; bracket games are their own category.
  const { data: raw } = await supabase
    .from('weekly_results')
    .select('week, points, opponent_points, result, member_season_id, is_bracket, is_playoff')
    .eq('season_id', seasonId)
    .eq('is_bracket', false);

  const results = (raw ?? []) as ResultRow[];

  // Build per-member timeline for streak + accumulations.
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

  // Highest single-game score
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
      icon: '🏆',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  // Lowest single-game score (World's Worst Boss)
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
      icon: '📉',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  // Biggest blowout (largest margin of victory, winner's perspective)
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
      sub: `Week ${blow.row.week} · ${blow.row.points.toFixed(1)}–${(blow.row.opponent_points ?? 0).toFixed(1)}`,
      icon: '🌶️',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  // Narrowest escape (smallest positive margin)
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
      icon: '😬',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  // Longest win streak
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
      sub: 'Unstoppable. That’s what she said.',
      icon: '🔥',
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
      sub: 'Just… please go home.',
      icon: '🪑',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  // Most points scored (season-long)
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
      icon: '💼',
      league: m?.leagueName,
      leagueColor: m?.leagueColor,
    });
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-text-muted text-xs uppercase tracking-[0.3em] mb-2">
          The Dundies
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2">
          Trophy Case
        </h1>
        <p className="text-text-secondary">
          The definitive, non-negotiable, Michael-Scott-approved awards for this season.
        </p>
      </div>

      {awards.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {awards.map((a) => (
            <TrophyCard key={a.title} award={a} />
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link href="/" className="text-text-muted hover:text-white text-sm">
          ← Back to the bullpen
        </Link>
      </div>
    </main>
  );
}

function TrophyCard({ award }: { award: Award }) {
  return (
    <div className="group relative bg-bg-secondary/60 border border-bg-tertiary rounded-2xl p-5 overflow-hidden transition-transform hover:-translate-y-0.5">
      {/* Aurora glow on hover */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top, ${award.leagueColor ?? '#E056FF'}20, transparent 60%)`,
        }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl">{award.icon}</span>
          {award.league && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider"
              style={{
                backgroundColor: `${award.leagueColor}1a`,
                color: award.leagueColor,
                border: `1px solid ${award.leagueColor}55`,
              }}
            >
              {award.league}
            </span>
          )}
        </div>
        <div className="text-[11px] uppercase tracking-widest text-text-muted font-semibold mb-1">
          {award.title}
        </div>
        <div className="text-lg font-bold text-white mb-0.5">
          {award.winner ?? '—'}
        </div>
        <div className="text-2xl font-mono font-bold text-accent-gold mb-2">
          {award.value}
        </div>
        <div className="text-xs text-text-muted">{award.tagline}</div>
        <div className="text-xs text-text-secondary mt-1">{award.sub}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-bg-secondary/60 border border-bg-tertiary rounded-xl p-10 text-center">
      <div className="text-4xl mb-3">🏆</div>
      <div className="text-white font-semibold text-lg mb-1">Awards ceremony pending.</div>
      <div className="text-text-muted text-sm">
        Michael is still writing the speeches. Come back once Week 1 wraps.
      </div>
    </div>
  );
}
