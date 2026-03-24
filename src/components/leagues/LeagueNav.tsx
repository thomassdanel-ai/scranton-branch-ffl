'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface LeagueNavProps {
  leagueId: string;
  leagueColor: string;
}

const tabs = [
  { label: 'Standings', path: '' },
  { label: 'Matchups', path: '/matchups' },
];

export default function LeagueNav({ leagueId, leagueColor }: LeagueNavProps) {
  const pathname = usePathname();
  const base = `/leagues/${leagueId}`;

  return (
    <nav className="flex items-center gap-1">
      {tabs.map(({ label, path }) => {
        const href = `${base}${path}`;
        const isActive = pathname === href;
        return (
          <Link
            key={path}
            href={href}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={
              isActive
                ? { backgroundColor: `${leagueColor}22`, color: leagueColor }
                : { color: '#9ca3af' }
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
