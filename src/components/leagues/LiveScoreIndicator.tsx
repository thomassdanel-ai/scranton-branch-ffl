'use client';

import { useLiveScores } from '@/hooks/useLiveScores';

interface Props {
  leagueId: string;
  week: number;
  isLive: boolean;
}

export default function LiveScoreIndicator({ leagueId, week, isLive }: Props) {
  useLiveScores(leagueId, week, isLive);

  if (!isLive) return null;

  return (
    <span className="chip chip--live">
      <span className="livedot" />
      LIVE · WK {week}
    </span>
  );
}
