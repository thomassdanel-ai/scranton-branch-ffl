'use client';

import { useLiveScores } from '@/hooks/useLiveScores';

interface Props {
  leagueId: string;
  week: number;
  isLive: boolean;
}

/**
 * Mounts the Realtime subscription for live score updates.
 * Shows a pulsing live indicator when games are in progress.
 */
export default function LiveScoreIndicator({ leagueId, week, isLive }: Props) {
  useLiveScores(leagueId, week, isLive);

  if (!isLive) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-green/10 border border-accent-green/20">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-green" />
      </span>
      <span className="text-accent-green text-xs font-semibold uppercase tracking-wider">
        Live
      </span>
    </div>
  );
}
