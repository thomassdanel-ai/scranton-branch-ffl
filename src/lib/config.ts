import { createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_CHAMPIONSHIP, SEASON_STATUS_TRANSITIONS, type SeasonStatusValue } from '@/config/constants';

export type LeagueInfo = {
  dbId: string;
  sleeperId: string;
  name: string;
  shortName: string;
  color: string;
};

export type ChampionshipConfig = {
  qualifiersPerLeague: number;
  format: string;
};

export type SeasonStatus = {
  seasonId: string | null;
  year: string;
  isOffSeason: boolean;
};

/**
 * Find the active season ID by status.
 */
export async function getActiveSeasonId(): Promise<string | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('seasons')
    .select('id')
    .in('status', ['active', 'drafting', 'playoffs', 'pre_draft', 'setup'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.id ?? null;
}

/**
 * Get the most recent season ID regardless of status.
 * Used as fallback when no active season exists (off-season).
 */
async function getLatestSeasonId(): Promise<string | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('seasons')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data?.id ?? null;
}

/**
 * Get the current season status — whether we're in an active season or off-season.
 */
export async function getSeasonStatus(): Promise<SeasonStatus> {
  const activeId = await getActiveSeasonId();
  if (activeId) {
    const year = await getActiveSeasonYear();
    return { seasonId: activeId, year, isOffSeason: false };
  }

  // No active season — off-season, fall back to latest
  const latestId = await getLatestSeasonId();
  const year = await getActiveSeasonYear(); // already falls back to latest
  return { seasonId: latestId, year, isOffSeason: true };
}

/**
 * Get leagues for a season from the DB.
 * If no seasonId provided, uses the active season.
 * Returns empty array if no season/leagues found.
 */
export async function getSeasonLeagues(seasonId?: string): Promise<LeagueInfo[]> {
  const supabase = createServiceClient();

  let sid = seasonId ?? await getActiveSeasonId();
  // Off-season fallback: show last archived season's leagues
  if (!sid) sid = await getLatestSeasonId();
  if (!sid) return [];

  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, short_name, color, sleeper_league_id, position')
    .eq('season_id', sid)
    .order('position', { ascending: true });

  if (error || !data) return [];

  return data.map((l) => ({
    dbId: l.id,
    sleeperId: l.sleeper_league_id ?? '',
    name: l.name,
    shortName: l.short_name ?? l.name,
    color: l.color ?? '#6b7280',
  }));
}

/**
 * Find a league by its Sleeper league ID for the active season.
 */
export async function findLeagueBySleeperIdAsync(sleeperId: string): Promise<LeagueInfo | null> {
  const supabase = createServiceClient();

  let sid = await getActiveSeasonId();
  // Off-season fallback: resolve against last archived season
  if (!sid) sid = await getLatestSeasonId();
  if (!sid) return null;

  const { data } = await supabase
    .from('leagues')
    .select('id, name, short_name, color, sleeper_league_id, position')
    .eq('season_id', sid)
    .eq('sleeper_league_id', sleeperId)
    .single();

  if (!data) return null;

  return {
    dbId: data.id,
    sleeperId: data.sleeper_league_id ?? '',
    name: data.name,
    shortName: data.short_name ?? data.name,
    color: data.color ?? '#6b7280',
  };
}

/**
 * Get the active season's year from the DB.
 * Falls back to current calendar year if no season found.
 */
export async function getActiveSeasonYear(): Promise<string> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('seasons')
    .select('year')
    .in('status', ['active', 'drafting', 'playoffs', 'pre_draft', 'setup'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (data?.year) return String(data.year);

  // No active season — fall back to most recent season's year
  const { data: latest } = await supabase
    .from('seasons')
    .select('year')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return latest?.year ? String(latest.year) : new Date().getFullYear().toString();
}

/**
 * Get championship config for a season.
 * Reads from seasons.settings JSONB, falls back to defaults.
 */
export async function getChampionshipConfig(seasonId?: string): Promise<ChampionshipConfig> {
  const supabase = createServiceClient();

  const sid = seasonId ?? await getActiveSeasonId();
  if (!sid) return DEFAULT_CHAMPIONSHIP;

  const { data } = await supabase
    .from('seasons')
    .select('settings')
    .eq('id', sid)
    .single();

  const settings = data?.settings as Record<string, unknown> | null;
  const championship = settings?.championship as Record<string, unknown> | null;

  return {
    qualifiersPerLeague:
      (championship?.qualifiersPerLeague as number) ?? DEFAULT_CHAMPIONSHIP.qualifiersPerLeague,
    format:
      (championship?.format as string) ?? DEFAULT_CHAMPIONSHIP.format,
  };
}

/**
 * Validate a season status transition.
 * Throws if the transition is not allowed.
 */
export function validateStatusTransition(from: SeasonStatusValue, to: SeasonStatusValue): void {
  const allowed = SEASON_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}. Allowed: ${allowed.join(', ') || 'none'}`);
  }
}
