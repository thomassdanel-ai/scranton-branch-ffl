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
    <nav className="lg-tabs">
      {tabs.map(({ label, path }) => {
        const href = `${base}${path}`;
        const isActive = pathname === href;
        return (
          <Link
            key={path}
            href={href}
            className={`lg-tab ${isActive ? 'lg-tab--on' : ''}`}
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
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
