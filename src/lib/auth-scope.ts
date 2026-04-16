import { createServiceClient } from '@/lib/supabase/server';
import type { AuthUser } from '@/lib/auth';

/**
 * Get the cohort IDs an admin user can manage.
 * Super admins get 'all', commissioners get their assigned cohorts.
 */
export async function getCohortScope(user: AuthUser): Promise<string[] | 'all'> {
  if (user.role === 'super_admin') return 'all';

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('admin_cohort_assignments')
    .select('cohort_id')
    .eq('admin_user_id', user.id);

  return (data ?? []).map((row) => row.cohort_id);
}

/**
 * Check that an admin user has access to a specific cohort.
 * Throws 403 if not.
 */
export async function requireCohortAccess(user: AuthUser, cohortId: string): Promise<void> {
  const scope = await getCohortScope(user);
  if (scope === 'all') return;
  if (!scope.includes(cohortId)) {
    throw new Error('Forbidden: no access to this cohort');
  }
}

/**
 * Filter a query's cohort IDs to only those the user can access.
 * Returns null if user has access to all (super_admin).
 */
export async function getScopedCohortIds(user: AuthUser, seasonId: string): Promise<string[] | null> {
  if (user.role === 'super_admin') return null; // no filter needed

  const supabase = createServiceClient();

  // Get cohorts for this season that the user is assigned to
  const { data: assignments } = await supabase
    .from('admin_cohort_assignments')
    .select('cohort_id')
    .eq('admin_user_id', user.id);

  const assignedIds = (assignments ?? []).map((a) => a.cohort_id);

  // Filter to only cohorts in this season
  const { data: cohorts } = await supabase
    .from('cohorts')
    .select('id')
    .eq('season_id', seasonId)
    .in('id', assignedIds);

  return (cohorts ?? []).map((c) => c.id);
}

/**
 * Check that an admin user has access to a given member.
 *
 * Access rule: the user must share at least one cohort with the member.
 * A member is "in" a cohort if any of their `member_seasons.league_id` rows
 * link to a league with that cohort_id.
 *
 * Super admins always pass. A member with no cohort assignments is visible
 * only to super_admin (e.g. alumni with no current leagues).
 */
export async function userCanAccessMember(user: AuthUser, memberId: string): Promise<boolean> {
  if (user.role === 'super_admin') return true;

  const supabase = createServiceClient();

  // Pull cohort_ids for every league the member has ever played in.
  const { data: rows } = await supabase
    .from('member_seasons')
    .select('leagues!inner(cohort_id)')
    .eq('member_id', memberId);

  // Flatten — Supabase returns the joined table as either an object or array
  const memberCohortIds = new Set<string>();
  for (const row of rows ?? []) {
    const league = row.leagues as unknown as { cohort_id: string | null } | { cohort_id: string | null }[];
    const leagueRows = Array.isArray(league) ? league : league ? [league] : [];
    for (const l of leagueRows) {
      if (l.cohort_id) memberCohortIds.add(l.cohort_id);
    }
  }

  if (memberCohortIds.size === 0) return false;

  const scope = await getCohortScope(user);
  if (scope === 'all') return true;

  return scope.some((cid) => memberCohortIds.has(cid));
}

/**
 * Return the set of member IDs the caller is allowed to see.
 * Returns null when the caller has access to all members (super_admin).
 * Used for GET list endpoints to filter at the DB layer.
 */
export async function getScopedMemberIds(user: AuthUser): Promise<string[] | null> {
  if (user.role === 'super_admin') return null;

  const scope = await getCohortScope(user);
  if (scope === 'all') return null;
  if (scope.length === 0) return [];

  const supabase = createServiceClient();

  // Members whose leagues sit inside the user's cohort scope.
  const { data: memberships } = await supabase
    .from('member_seasons')
    .select('member_id, leagues!inner(cohort_id)')
    .in('leagues.cohort_id', scope);

  const ids = new Set<string>();
  for (const row of memberships ?? []) {
    if (row.member_id) ids.add(row.member_id);
  }

  return Array.from(ids);
}
