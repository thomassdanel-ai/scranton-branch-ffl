'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEAGUE_CONFIG } from '@/config/leagues';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/rankings', label: 'Power Rankings' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/recaps', label: 'Recaps' },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg-primary/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-accent-gold text-xl">🏆</span>
            <span className="font-bold text-white">{LEAGUE_CONFIG.shortName}</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'bg-primary/20 text-primary'
                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                }`}
              >
                {label}
              </Link>
            ))}

            {/* League dropdown quick links */}
            <div className="ml-2 flex items-center gap-1">
              {LEAGUE_CONFIG.leagues.map((league) => (
                <Link
                  key={league.id}
                  href={`/leagues/${league.id}`}
                  className="px-2 py-1 rounded text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: `${league.color}22`, color: league.color, border: `1px solid ${league.color}44` }}
                >
                  {league.shortName}
                </Link>
              ))}
            </div>
          </nav>

          {/* Mobile menu — simplified */}
          <div className="md:hidden flex items-center gap-2">
            {LEAGUE_CONFIG.leagues.map((league) => (
              <Link
                key={league.id}
                href={`/leagues/${league.id}`}
                className="px-2 py-1 rounded text-xs font-semibold"
                style={{ backgroundColor: `${league.color}22`, color: league.color }}
              >
                {league.shortName}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile nav bar */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
