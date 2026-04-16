import { cookies } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/server';
import { getActiveSeasonId } from '@/lib/config';

const MEMBER_COOKIE = 'member_id';

export type MemberScope = {
  memberId: string;
  memberName: string;
  memberSeasonId: string;
  leagueId: string;
  leagueName: string;
  cohortId: string | null;
};

/**
 * Read the member_id cookie and resolve to active season membership.
 * Returns null if no cookie or no active membership found.
 * Used by server components and API routes.
 */
export async function getMemberScope(): Promise<MemberScope | null> {
  const cookieStore = await cookies();
  const memberId = cookieStore.get(MEMBER_COOKIE)?.value;
  if (!memberId) return null;

  const supabase = createServiceClient();

  // Verify member exists
  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, display_name')
    .eq('id', memberId)
    .single();

  if (!member) return null;

  // Find active season membership
  const seasonId = await getActiveSeasonId();
  if (!seasonId) return null;

  const { data: memberSeason } = await supabase
    .from('member_seasons')
    .select('id, league_id')
    .eq('member_id', member.id)
    .eq('season_id', seasonId)
    .single();

  if (!memberSeason) return null;

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, cohort_id')
    .eq('id', memberSeason.league_id)
    .single();

  return {
    memberId: member.id,
    memberName: member.display_name || member.full_name,
    memberSeasonId: memberSeason.id,
    leagueId: league?.id || memberSeason.league_id,
    leagueName: league?.name || 'Unknown',
    cohortId: league?.cohort_id || null,
  };
}
