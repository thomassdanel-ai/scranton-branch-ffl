'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface Props {
  currentWeek: number;
  leagueId: string;
  leagueColor: string;
}

export default function WeekSelector({ currentWeek, leagueId, leagueColor }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedWeek = Number(searchParams.get('week')) || currentWeek;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {Array.from({ length: currentWeek }, (_, i) => i + 1).map((week) => {
        const isActive = week === selectedWeek;
        return (
          <button
            key={week}
            onClick={() => router.push(`/leagues/${leagueId}/matchups?week=${week}`)}
            className="shrink-0 w-9 h-9 rounded-lg text-sm font-semibold transition-colors"
            style={
              isActive
                ? { backgroundColor: `${leagueColor}22`, color: leagueColor }
                : { color: '#9ca3af' }
            }
          >
            {week}
          </button>
        );
      })}
    </div>
  );
}
