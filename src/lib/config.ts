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
    const { data } = await supabase
      .from('seasons')
      .select('config')
      .eq('is_current', true)
      .single();

    if (data?.config) {
      return data.config as DynamicLeagueConfig;
    }
  } catch {
    // Supabase unavailable or no current season — use static config
  }

  return LEAGUE_CONFIG;
}
