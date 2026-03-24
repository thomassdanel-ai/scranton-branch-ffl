import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * GET: Fetch a single archived season by archive ID.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('season_archives')
    .select(`
      *,
      seasons!inner(year, config)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Archive not found' }, { status: 404 });
  }

  return NextResponse.json({ archive: data });
}
