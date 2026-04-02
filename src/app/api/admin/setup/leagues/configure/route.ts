import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { DEFAULT_LEAGUE_COLORS, DEFAULT_LEAGUE_SHORT_NAMES } from '@/config/constants';

async function getOrgId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();
  if (!data) throw new Error('Organization not found');
  return data.id;
}

// POST: Configure leagues for an existing season (Step 4)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const { seasonId, numLeagues, leagueNames, rosterSize } = body as {
      seasonId: string;
      numLeagues: number;
      leagueNames: string[];
      rosterSize: number;
    };

    if (!seasonId) {
      return NextResponse.json({ error: 'Missing seasonId' }, { status: 400 });
    }
    if (!numLeagues || numLeagues < 1 || numLeagues > 4) {
      return NextResponse.json({ error: 'Number of leagues must be 1-4' }, { status: 400 });
    }
    if (!leagueNames || leagueNames.length !== numLeagues) {
      return NextResponse.json({ error: 'League names must match number of leagues' }, { status: 400 });
    }
    if (!rosterSize || rosterSize < 4 || rosterSize > 16) {
      return NextResponse.json({ error: 'Roster size must be 4-16' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Verify season exists and is in setup phase
    const { data: season } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    if (!season || !['setup', 'registering', 'confirming'].includes(season.status)) {
      return NextResponse.json({ error: 'Season is not in a setup phase' }, { status: 400 });
    }

    // Check no leagues already exist for this season
    const { data: existingLeagues } = await supabase
      .from('leagues')
      .select('id')
      .eq('season_id', seasonId);

    if (existingLeagues && existingLeagues.length > 0) {
      return NextResponse.json(
        { error: 'Leagues already configured for this season. Delete existing leagues first or use a different endpoint to modify.' },
        { status: 409 }
      );
    }

    const orgId = await getOrgId(supabase);

    // Update season with league config
    const { error: updateErr } = await supabase
      .from('seasons')
      .update({
        num_leagues: numLeagues,
        roster_size_per_league: rosterSize,
        updated_at: new Date().toISOString(),
      })
      .eq('id', seasonId);

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to update season config' }, { status: 500 });
    }

    // Create league rows
    const leagueRows = leagueNames.map((name: string, i: number) => ({
      org_id: orgId,
      season_id: seasonId,
      name: name.trim(),
      short_name: DEFAULT_LEAGUE_SHORT_NAMES[i] ?? name.trim().slice(0, 4),
      color: DEFAULT_LEAGUE_COLORS[i] ?? '#6b7280',
      position: i,
    }));

    const { data: leagues, error: leagueErr } = await supabase
      .from('leagues')
      .insert(leagueRows)
      .select();

    if (leagueErr) {
      // Rollback season field updates
      await supabase
        .from('seasons')
        .update({
          num_leagues: 0,
          roster_size_per_league: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', seasonId);
      return NextResponse.json({ error: 'Failed to create leagues' }, { status: 500 });
    }

    // Refetch season to return updated fields
    const { data: updatedSeason } = await supabase
      .from('seasons')
      .select('*')
      .eq('id', seasonId)
      .single();

    return NextResponse.json({ season: updatedSeason, leagues }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
