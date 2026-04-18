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
    <div className="week-sel">
      {Array.from({ length: currentWeek }, (_, i) => i + 1).map((week) => {
        const isActive = week === selectedWeek;
        return (
          <button
            type="button"
            key={week}
            onClick={() => router.push(`/leagues/${leagueId}/matchups?week=${week}`)}
            className={`week-cell ${isActive ? 'week-cell--on' : ''}`}
            style={
              isActive
                ? {
                    color: leagueColor,
                    background: `${leagueColor}22`,
                    borderColor: `${leagueColor}55`,
                  }
                : undefined
            }
          >
            {week}
          </button>
        );
      })}
    </div>
  );
}
