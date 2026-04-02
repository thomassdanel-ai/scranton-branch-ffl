import { createServiceClient } from '@/lib/supabase/server';

/**
 * Given a Sleeper league_id and roster_id, find the member_season record.
 * Used by the cron sync to populate member_season_id on weekly_results.
 */
export async function resolveMemberSeason(
  seasonId: string,
  sleeperLeagueId: string,
  sleeperRosterId: number
): Promise<string | null> {
  const supabase = createServiceClient();

  // Find the league record by sleeper_league_id and season_id
  const { data: league } = await supabase
    .from('leagues')
    .select('id')
    .eq('season_id', seasonId)
    .eq('sleeper_league_id', sleeperLeagueId)
    .single();

  if (!league) return null;

  // Find the member_season by league_id and sleeper_roster_id
  const { data: ms } = await supabase
    .from('member_seasons')
    .select('id')
    .eq('league_id', league.id)
    .eq('sleeper_roster_id', String(sleeperRosterId))
    .single();

  return ms?.id ?? null;
}

/**
 * Batch version for cron efficiency.
 * Returns Map<roster_id, member_season_id> for all rosters in a league.
 */
export async function resolveMemberSeasonsBatch(
  seasonId: string,
  sleeperLeagueId: string
): Promise<Map<number, string>> {
  const supabase = createServiceClient();
  const result = new Map<number, string>();

  // Find the league
  const { data: league } = await supabase
    .from('leagues')
    .select('id')
    .eq('season_id', seasonId)
    .eq('sleeper_league_id', sleeperLeagueId)
    .single();

  if (!league) return result;

  // Get all member_seasons for this league
  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('id, sleeper_roster_id')
    .eq('league_id', league.id);

  if (!memberSeasons) return result;

  for (const ms of memberSeasons) {
    if (ms.sleeper_roster_id) {
      result.set(Number(ms.sleeper_roster_id), ms.id);
    }
  }

  return result;
}
