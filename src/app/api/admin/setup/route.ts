import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth, AuthError } from '@/lib/auth';
import { DEFAULT_LEAGUE_COLORS, DEFAULT_LEAGUE_SHORT_NAMES, DEFAULT_CHAMPIONSHIP } from '@/config/constants';

async function getOrgId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', 'scranton-branch-ffl')
    .single();
  if (!data) throw new Error('Organization not found');
  return data.id;
}

// GET: Return current setup-phase season with all related data
export async function GET() {
  try {
    await requireAuth();

    const supabase = createServiceClient();
    const orgId = await getOrgId(supabase);

  // Find a season in setup, pre_draft, or drafting status
  const { data: season } = await supabase
    .from('seasons')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ['setup', 'registering', 'confirming', 'pre_draft', 'drafting'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!season) {
    // Get latest season number for auto-increment
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
    });
  }

  // Fetch leagues for this season
  const { data: leagues } = await supabase
    .from('leagues')
    .select('*')
    .eq('season_id', season.id)
    .order('position', { ascending: true });

  // Fetch all active/inactive members
  const { data: members } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', orgId)
    .in('status', ['active', 'inactive'])
    .order('full_name');

  // Fetch member_seasons for this season
  const { data: memberSeasons } = await supabase
    .from('member_seasons')
    .select('*')
    .eq('season_id', season.id);

    return NextResponse.json({
      season,
      leagues: leagues || [],
      members: members || [],
      memberSeasons: memberSeasons || [],
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

// POST: Create a new season (Step 1)
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
  const { year, numLeagues, leagueNames, rosterSize } = body as {
    year: number;
    numLeagues: number;
    leagueNames: string[];
    rosterSize: number;
  };

  if (!year || year < 2020 || year > 2040) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
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
  const orgId = await getOrgId(supabase);

  // Check no season already in setup/registering/confirming/pre_draft/drafting/active
  const { data: existing } = await supabase
    .from('seasons')
    .select('id, season_number, year, status')
    .eq('org_id', orgId)
    .in('status', ['setup', 'registering', 'confirming', 'pre_draft', 'drafting', 'active']);

  if (existing && existing.length > 0) {
    const s = existing[0];
    return NextResponse.json(
      { error: `Season ${s.season_number} (${s.year}) is already in progress with status '${s.status}'. Archive or complete it before creating a new season.` },
      { status: 409 }
    );
  }

  // Get next season number
  const { data: latest } = await supabase
    .from('seasons')
    .select('season_number')
    .eq('org_id', orgId)
    .order('season_number', { ascending: false })
    .limit(1)
    .single();

  const seasonNumber = (latest?.season_number || 0) + 1;

  // Create season with championship settings
  const { data: season, error: seasonErr } = await supabase
    .from('seasons')
    .insert({
      org_id: orgId,
      season_number: seasonNumber,
      year,
      status: 'setup',
      num_leagues: numLeagues,
      roster_size_per_league: rosterSize,
      settings: { championship: DEFAULT_CHAMPIONSHIP },
    })
    .select()
    .single();

  if (seasonErr || !season) {
    return NextResponse.json({ error: 'Failed to create season' }, { status: 500 });
  }

  // Create league rows with color, short_name, position
  const leagueRows = leagueNames.map((name: string, i: number) => ({
    org_id: orgId,
    season_id: season.id,
    name: name.trim(),
    short_name: DEFAULT_LEAGUE_SHORT_NAMES[i] ?? name.trim().slice(0, 4),
    color: DEFAULT_LEAGUE_COLORS[i] ?? '#6b7280',
    position: i,
  }));

  const { error: leagueErr } = await supabase.from('leagues').insert(leagueRows);

  if (leagueErr) {
    // Rollback season
    await supabase.from('seasons').delete().eq('id', season.id);
    return NextResponse.json({ error: 'Failed to create leagues' }, { status: 500 });
  }

    return NextResponse.json({ season }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
