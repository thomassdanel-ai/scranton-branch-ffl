import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireSuperAdmin, AuthError } from '@/lib/auth';

const RESETTABLE_STATUSES = ['setup', 'registering', 'confirming', 'pre_draft', 'drafting'];

export async function DELETE(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await req.json();
    const { seasonId, confirmPhrase } = body as { seasonId: string; confirmPhrase: string };

    if (!seasonId || !confirmPhrase) {
      return NextResponse.json({ error: 'Missing seasonId or confirmPhrase' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Fetch the season to validate
    const { data: season } = await supabase
      .from('seasons')
      .select('id, season_number, status')
      .eq('id', seasonId)
      .single();

    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    if (!RESETTABLE_STATUSES.includes(season.status)) {
      return NextResponse.json(
        { error: `Cannot reset a season in '${season.status}' status. Only seasons in setup, registering, confirming, pre_draft, or drafting can be reset.` },
        { status: 403 }
      );
    }

    const expectedPhrase = `RESET SEASON ${season.season_number}`;
    if (confirmPhrase !== expectedPhrase) {
      return NextResponse.json(
        { error: `Confirmation phrase must be exactly "${expectedPhrase}"` },
        { status: 400 }
      );
    }

    const deleted = {
      picks: 0,
      boards: 0,
      memberSeasons: 0,
      registrations: 0,
      cohorts: 0,
      leagues: 0,
      season: 0,
    };

    // 1. Delete draft_picks for boards in this season
    const { data: boards } = await supabase
      .from('draft_boards')
      .select('id')
      .eq('season_id', seasonId);

    if (boards && boards.length > 0) {
      const boardIds = boards.map((b) => b.id);
      const { data: picksData, error } = await supabase
        .from('draft_picks')
        .delete()
        .in('draft_board_id', boardIds)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: draft_picks', detail: error.message }, { status: 500 });
      }
      deleted.picks = picksData?.length ?? 0;
    }

    // 2. Delete draft_boards
    {
      const { data, error } = await supabase
        .from('draft_boards')
        .delete()
        .eq('season_id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: draft_boards', detail: error.message }, { status: 500 });
      }
      deleted.boards = data?.length ?? 0;
    }

    // 3. Delete member_seasons
    {
      const { data, error } = await supabase
        .from('member_seasons')
        .delete()
        .eq('season_id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: member_seasons', detail: error.message }, { status: 500 });
      }
      deleted.memberSeasons = data?.length ?? 0;
    }

    // 4. Delete season_registrations
    {
      const { data, error } = await supabase
        .from('season_registrations')
        .delete()
        .eq('season_id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: season_registrations', detail: error.message }, { status: 500 });
      }
      deleted.registrations = data?.length ?? 0;
    }

    // 5. Delete cohorts
    {
      const { data, error } = await supabase
        .from('cohorts')
        .delete()
        .eq('season_id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: cohorts', detail: error.message }, { status: 500 });
      }
      deleted.cohorts = data?.length ?? 0;
    }

    // 6. Delete leagues
    {
      const { data, error } = await supabase
        .from('leagues')
        .delete()
        .eq('season_id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: leagues', detail: error.message }, { status: 500 });
      }
      deleted.leagues = data?.length ?? 0;
    }

    // 7. Delete the season itself
    {
      const { data, error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', seasonId)
        .select('id');

      if (error) {
        return NextResponse.json({ error: 'Failed at step: seasons', detail: error.message }, { status: 500 });
      }
      deleted.season = data?.length ?? 0;
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
