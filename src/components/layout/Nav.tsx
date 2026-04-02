'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLeagueConfig } from '@/components/providers/ConfigProvider';
import { ORG_SHORT_NAME } from '@/config/constants';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/rankings', label: 'Power Rankings' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/history', label: 'History' },
  { href: '/recaps', label: 'Recaps' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { leagues, member } = useLeagueConfig();

  async function handleClearIdentity() {
    await fetch('/api/identify', { method: 'DELETE' });
    router.push('/identify');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-bg-primary/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-accent-gold text-xl">&#127942;</span>
            <span className="font-bold text-white">{ORG_SHORT_NAME}</span>
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
              {leagues.map((league) => (
                <Link
                  key={league.sleeperId || league.dbId}
                  href={`/leagues/${league.sleeperId}`}
                  className="px-2 py-1 rounded text-xs font-semibold transition-colors hover:opacity-80"
                  style={{ backgroundColor: `${league.color}22`, color: league.color, border: `1px solid ${league.color}44` }}
                >
                  {league.shortName}
                </Link>
              ))}
            </div>

            {/* Member identity */}
            {member ? (
              <div className="ml-3 flex items-center gap-2 pl-3 border-l border-white/10">
                <span className="text-xs text-text-secondary">
                  Your League: <span className="text-white font-semibold">{member.leagueName}</span>
                </span>
                <button
                  onClick={handleClearIdentity}
                  className="text-xs text-text-muted hover:text-primary transition-colors"
                >
                  Not you?
                </button>
              </div>
            ) : (
              <Link
                href="/identify"
                className="ml-3 pl-3 border-l border-white/10 text-xs text-text-muted hover:text-primary transition-colors"
              >
                Find Your League
              </Link>
            )}
          </nav>

          {/* Mobile menu */}
          <div className="md:hidden flex items-center gap-2">
            {member && (
              <span className="text-xs text-primary font-semibold mr-1">{member.leagueName}</span>
            )}
            {leagues.map((league) => (
              <Link
                key={league.sleeperId || league.dbId}
                href={`/leagues/${league.sleeperId}`}
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
          {!member && (
            <Link href="/identify" className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-primary">
              Identify
            </Link>
          )}
          {member && (
            <button
              onClick={handleClearIdentity}
              className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-text-muted"
            >
              Not you?
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
