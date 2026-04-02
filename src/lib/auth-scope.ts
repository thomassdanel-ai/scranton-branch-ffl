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
