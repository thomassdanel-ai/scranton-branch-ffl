'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLeagueConfig } from '@/components/providers/ConfigProvider';
import { ORG_SHORT_NAME } from '@/config/constants';

type NavLink = { href: string; label: string; memberOnly?: boolean };

const navLinks: NavLink[] = [
  { href: '/', label: 'Home' },
  { href: '/rankings', label: 'Rankings' },
  { href: '/bracket', label: 'Bracket' },
  { href: '/trophies', label: 'Dundies' },
  { href: '/transactions', label: 'Moves' },
  { href: '/history', label: 'History' },
  { href: '/recaps', label: 'Recaps' },
  { href: '/team/me', label: 'My Team', memberOnly: true },
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

  const visibleLinks = navLinks.filter((l) => !l.memberOnly || !!member);

  return (
    <>
      <header className="topnav">
        <div className="topnav__left">
          <Link href="/" className="topnav__brand">
            <span className="topnav__brand-mark" aria-hidden />
            <span className="hidden sm:inline">{ORG_SHORT_NAME}</span>
          </Link>

          <nav className="topnav__links hidden md:flex">
            {visibleLinks.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`topnav__link ${active ? 'topnav__link--active' : ''}`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="topnav__right">
          <div className="hidden lg:flex items-center gap-1">
            {leagues.map((league) => (
              <Link
                key={league.sleeperId || league.dbId}
                href={`/leagues/${league.sleeperId}`}
                className="chip"
                title={league.name}
              >
                {league.shortName}
              </Link>
            ))}
          </div>

          {member ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="label">Your league</span>
              <span
                className="font-mono text-[12px] font-semibold"
                style={{ color: 'var(--ink-8)' }}
              >
                {member.leagueName}
              </span>
              <button
                type="button"
                onClick={handleClearIdentity}
                className="btn btn--ghost btn--sm"
                title="Not you? Clear saved identity"
              >
                Not you?
              </button>
            </div>
          ) : (
            <Link href="/identify" className="btn btn--primary btn--sm hidden md:inline-flex">
              Find my league →
            </Link>
          )}
        </div>
      </header>

      {/* Mobile nav row */}
      <nav
        className="md:hidden flex items-center gap-1 px-4 py-2 overflow-x-auto"
        style={{
          background: 'var(--ink-1)',
          borderBottom: 'var(--hairline)',
        }}
      >
        {visibleLinks.map(({ href, label }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`topnav__link ${active ? 'topnav__link--active' : ''} shrink-0`}
              style={{ fontSize: '12px' }}
            >
              {label}
            </Link>
          );
        })}
        {member ? (
          <button
            type="button"
            onClick={handleClearIdentity}
            className="chip shrink-0 ml-auto"
            title="Clear identity"
          >
            {member.leagueName} ×
          </button>
        ) : (
          <Link href="/identify" className="chip chip--live shrink-0 ml-auto">
            Find league
          </Link>
        )}
      </nav>
    </>
  );
}
