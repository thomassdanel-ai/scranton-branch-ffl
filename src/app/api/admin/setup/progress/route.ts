import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { getScopedCohortIds } from '@/lib/auth-scope';

async function getOrgId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();
  if (!data) throw new Error('Organization not found');
  return data.id;
}

function computeCurrentStep(
  season: { status: string } | null,
  cohortsCount: number,
  confirmedMemberCount: number,
  memberSeasonsCount: number,
  draftBoardsCount: number,
): number {
  if (!season) return 1;
  // Season exists
  if (cohortsCount === 0) return 2;
  if (confirmedMemberCount === 0 && memberSeasonsCount === 0) return 3;
  if (memberSeasonsCount === 0) return 4;
  if (season.status === 'pre_draft') return 5;
  if (season.status === 'drafting') return 6;
  if (['active', 'playoffs', 'completed', 'archived'].includes(season.status)) return 7;
  // Fallback for setup/registering/confirming with member_seasons
  if (draftBoardsCount === 0) return 5;
  return 6;
}

// GET: Return complete wizard progress state in a single call
export async function GET() {
  try {
    const user = await requireAuth();
    const supabase = createServiceClient();
    const orgId = await getOrgId(supabase);

    // Find season in setup-through-active status
    const { data: season } = await supabase
      .from('seasons')
      .select('*')
      .eq('org_id', orgId)
      .in('status', ['setup', 'registering', 'confirming', 'pre_draft', 'drafting', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!season) {
      // Get next season number
      const { data: latest } = await supabase
        .from('seasons')
        .select('season_number')
        .eq('org_id', orgId)
        .order('season_number', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        season: null,
        nextSeasonNumber: (latest?.season_number || 0) + 1,
        leagues: [],
        cohorts: [],
        registrationsByCohort: {},
        confirmedMemberCount: 0,
        members: [],
        memberSeasons: [],
        draftBoards: [],
        currentStep: 1,
        stepCompletionStatus: {
          step1_season: false,
          step2_cohorts: false,
          step3_registrations: false,
          step4_leagues: false,
          step5_draft: false,
          step6_sleeper: false,
        },
      });
    }

    // Fetch all data in parallel
    const scopedIds = await getScopedCohortIds(user, season.id);

    const [
      { data: leagues },
      { data: members },
      { data: memberSeasons },
      { data: draftBoards },
    ] = await Promise.all([
      supabase
        .from('leagues')
        .select('*')
        .eq('season_id', season.id)
        .order('position', { ascending: true }),
      supabase
        .from('members')
        .select('*')
        .eq('org_id', orgId)
        .in('status', ['active', 'inactive'])
        .order('full_name'),
      supabase
        .from('member_seasons')
        .select('*')
        .eq('season_id', season.id),
      supabase
        .from('draft_boards')
        .select('*')
        .eq('season_id', season.id)
        .order('created_at'),
    ]);

    // Fetch cohorts (scoped)
    let cohortQuery = supabase
      .from('cohorts')
      .select('*, season_registrations(count)')
      .eq('season_id', season.id)
      .order('created_at', { ascending: true });

    if (scopedIds !== null) {
      cohortQuery = cohortQuery.in('id', scopedIds);
    }

    const { data: cohorts } = await cohortQuery;
    const cohortList = cohorts || [];

    // Fetch registrations per cohort
    const registrationsByCohort: Record<string, unknown[]> = {};
    let confirmedMemberCount = 0;

    if (cohortList.length > 0) {
      const cohortIds = cohortList.map((c: { id: string }) => c.id);
      const { data: allRegs } = await supabase
        .from('season_registrations')
        .select('*, members(full_name, display_name, email)')
        .in('cohort_id', cohortIds)
        .order('registered_at', { ascending: true });

      for (const reg of allRegs || []) {
        const cid = reg.cohort_id as string;
        if (!registrationsByCohort[cid]) registrationsByCohort[cid] = [];
        registrationsByCohort[cid].push(reg);
        if (reg.status === 'confirmed' || reg.status === 'promoted') {
          confirmedMemberCount++;
        }
      }
    }

    // Get next season number
    const { data: latest } = await supabase
      .from('seasons')
      .select('season_number')
      .eq('org_id', orgId)
      .order('season_number', { ascending: false })
      .limit(1)
      .single();

    const leagueList = leagues || [];
    const memberSeasonList = memberSeasons || [];
    const draftBoardList = draftBoards || [];

    const currentStep = computeCurrentStep(
      season,
      cohortList.length,
      confirmedMemberCount,
      memberSeasonList.length,
      draftBoardList.length,
    );

    // Step completion status
    const allLeaguesLinked = leagueList.length > 0 && leagueList.every((l: { sleeper_league_id: string | null }) => !!l.sleeper_league_id);
    const allRostersMapped = memberSeasonList.length > 0 && memberSeasonList.every((ms: { sleeper_roster_id: string | null }) => !!ms.sleeper_roster_id);

    const stepCompletionStatus = {
      step1_season: true,
      step2_cohorts: cohortList.length > 0,
      step3_registrations: confirmedMemberCount > 0,
      step4_leagues: memberSeasonList.length > 0,
      step5_draft: draftBoardList.length > 0 && draftBoardList.every((b: { status: string }) => b.status !== 'pending'),
      step6_sleeper: allLeaguesLinked && allRostersMapped,
    };

    return NextResponse.json({
      season,
      nextSeasonNumber: (latest?.season_number || 0) + 1,
      leagues: leagueList,
      cohorts: cohortList,
      registrationsByCohort,
      confirmedMemberCount,
      members: members || [],
      memberSeasons: memberSeasonList,
      draftBoards: draftBoardList,
      currentStep,
      stepCompletionStatus,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
