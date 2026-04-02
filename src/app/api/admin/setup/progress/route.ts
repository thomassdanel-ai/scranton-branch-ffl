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
  leaguesCount: number,
  cohortsCount: number,
  confirmedMemberCount: number,
  memberSeasonsCount: number,
): number {
  if (!season) return 1;
  // Season exists — cohorts require season_id, so they come after season creation
  if (cohortsCount === 0) return 2;
  // Cohorts exist but no confirmed members yet — review registrations
  if (confirmedMemberCount === 0 && memberSeasonsCount === 0) return 3;
  // Confirmed members exist but leagues not yet configured
  if (leaguesCount === 0) return 4;
  // Leagues configured but not yet assigned (no member_seasons)
  if (memberSeasonsCount === 0) return 4;
  // Leagues assigned — draft order next
  if (season.status === 'pre_draft') return 5;
  // Draft locked — Sleeper linking
  if (season.status === 'drafting') return 6;
  // Season active or beyond — wizard complete
  if (['active', 'playoffs', 'completed', 'archived'].includes(season.status)) return 7;
  // Fallback
  return 5;
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

    // Get next season number
    const { data: latest } = await supabase
      .from('seasons')
      .select('season_number')
      .eq('org_id', orgId)
      .order('season_number', { ascending: false })
      .limit(1)
      .single();

    const nextSeasonNumber = (latest?.season_number || 0) + 1;

    if (!season) {
      return NextResponse.json({
        season: null,
        nextSeasonNumber,
        leagues: [],
        cohorts: [],
        registrationsByCohort: {},
        confirmedMemberCount: 0,
        totalRegisteredCount: 0,
        members: [],
        memberSeasons: [],
        draftBoards: [],
        currentStep: 1,
        stepCompletion: {
          season: false,
          cohorts: false,
          registrations: false,
          leagues: false,
          draft: false,
          sleeper: false,
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
    let totalRegisteredCount = 0;

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
        totalRegisteredCount++;
        if (reg.status === 'confirmed' || reg.status === 'promoted') {
          confirmedMemberCount++;
        }
      }
    }

    const leagueList = leagues || [];
    const memberSeasonList = memberSeasons || [];
    const draftBoardList = draftBoards || [];

    const currentStep = computeCurrentStep(
      season,
      leagueList.length,
      cohortList.length,
      confirmedMemberCount,
      memberSeasonList.length,
    );

    // Step completion
    const allLeaguesLinked = leagueList.length > 0 &&
      leagueList.every((l: { sleeper_league_id: string | null }) => !!l.sleeper_league_id);

    const stepCompletion = {
      season: true,
      cohorts: cohortList.length > 0,
      registrations: confirmedMemberCount > 0,
      leagues: memberSeasonList.length > 0,
      draft: draftBoardList.length > 0 &&
        draftBoardList.every((b: { status: string; is_mock: boolean | null }) => b.is_mock || b.status !== 'pending'),
      sleeper: allLeaguesLinked,
    };

    return NextResponse.json({
      season,
      nextSeasonNumber,
      leagues: leagueList,
      cohorts: cohortList,
      registrationsByCohort,
      confirmedMemberCount,
      totalRegisteredCount,
      members: members || [],
      memberSeasons: memberSeasonList,
      draftBoards: draftBoardList,
      currentStep,
      stepCompletion,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
