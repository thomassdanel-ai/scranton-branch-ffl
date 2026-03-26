import { LEAGUE_CONFIG } from '@/config/leagues';
import { createServiceClient } from '@/lib/supabase/server';

export type DynamicLeagueConfig = typeof LEAGUE_CONFIG;

/**
 * Get the active league config.
 * Checks Supabase `seasons` table for a current season override,
 * falls back to the static config file.
 */
export async function getActiveConfig(): Promise<DynamicLeagueConfig> {
  try {
    const supabase = createServiceClient();

    // Try status-based lookup first
    const { data: byStatus } = await supabase
      .from('seasons')
      .select('config')
      .in('status', ['active', 'drafting'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (byStatus?.config) return byStatus.config as DynamicLeagueConfig;

    // Fallback: old is_current boolean
    const { data } = await supabase
      .from('seasons')
      .select('config')
      .eq('is_current', true)
      .single();

    if (data?.config) return data.config as DynamicLeagueConfig;
  } catch {
    // Supabase unavailable or no current season — use static config
  }

  return LEAGUE_CONFIG;
}
