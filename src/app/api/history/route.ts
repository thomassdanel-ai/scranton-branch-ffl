import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET: List all archived seasons.
 */
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('season_archives')
    .select(`
      id,
      season_id,
      champion,
      awards,
      archived_at,
      seasons!inner(year, config)
    `)
    .order('archived_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ archives: data ?? [] });
}
