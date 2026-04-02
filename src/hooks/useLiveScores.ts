'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Subscribes to Supabase Realtime changes on league_snapshots.
 * When the cron sync writes new matchup data, this triggers a
 * router.refresh() so server components re-fetch fresh data.
 *
 * Falls back to polling every 60s for resilience.
 *
 * @param leagueId - Sleeper league ID to filter updates
 * @param week - Current week number
 * @param enabled - Set false during off-season or when scores are final
 */
export function useLiveScores(
  leagueId: string,
  week: number,
  enabled: boolean = true
) {
  const router = useRouter();
  const lastRefresh = useRef(Date.now());

  const refresh = useCallback(() => {
    // Debounce: don't refresh more than once per 10 seconds
    if (Date.now() - lastRefresh.current < 10_000) return;
    lastRefresh.current = Date.now();
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    // Subscribe to league_snapshots changes for this league + week
    const channel = supabase
      .channel(`live-scores-${leagueId}-${week}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'league_snapshots',
          filter: `sleeper_league_id=eq.${leagueId}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    // Polling fallback: refresh every 60s during active games
    const pollInterval = setInterval(refresh, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [leagueId, week, enabled, refresh]);
}
