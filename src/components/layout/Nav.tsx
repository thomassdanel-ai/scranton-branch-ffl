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

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-bg-primary/60 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Brand mark — aurora dot + wordmark */}
          <Link href="/" className="group flex items-center gap-3 shrink-0">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <span
                className="absolute inset-0 rounded-full blur-md opacity-80 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    'conic-gradient(from 180deg at 50% 50%, #E056FF, #56F0FF, #CCFF56, #E056FF)',
                }}
              />
              <span className="relative h-4 w-4 rounded-full bg-bg-primary border border-hairline-strong" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display font-bold tracking-tight text-base text-text-primary">
                {ORG_SHORT_NAME}
              </span>
              <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted">
                Fantasy Console
              </span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {navLinks.filter((l) => !l.memberOnly || !!member).map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative px-3 py-2 rounded-full text-sm font-medium transition-colors font-mono tracking-wide uppercase text-[11.5px] ${
                    active
                      ? 'text-text-primary'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full border border-hairline-strong"
                      style={{ background: 'var(--surface)' }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right cluster: league chips + identity */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              {leagues.map((league) => (
                <Link
                  key={league.sleeperId || league.dbId}
                  href={`/leagues/${league.sleeperId}`}
                  className="px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold tracking-[0.12em] uppercase transition-all hover:-translate-y-px"
                  style={{
                    backgroundColor: `${league.color}1a`,
                    color: league.color,
                    border: `1px solid ${league.color}55`,
                  }}
                >
                  {league.shortName}
                </Link>
              ))}
            </div>

            {member ? (
              <div className="flex items-center gap-2 pl-3 border-l border-hairline">
                <div className="flex flex-col leading-tight text-right">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-text-muted">
                    Identity
                  </span>
                  <span className="text-[12.5px] font-semibold text-text-primary">
                    {member.leagueName}
                  </span>
                </div>
                <button
                  onClick={handleClearIdentity}
                  className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-aurora-magenta transition-colors"
                  title="Clear your saved identity"
                >
                  ⌫
                </button>
              </div>
            ) : (
              <Link
                href="/identify"
                className="pl-3 border-l border-hairline font-mono text-[10.5px] uppercase tracking-[0.15em] text-text-muted hover:text-aurora-cyan transition-colors"
              >
                Find league →
              </Link>
            )}
          </div>

          {/* Mobile — just league chips on top row */}
          <div className="md:hidden flex items-center gap-1.5">
            {leagues.slice(0, 3).map((league) => (
              <Link
                key={league.sleeperId || league.dbId}
                href={`/leagues/${league.sleeperId}`}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold"
                style={{
                  backgroundColor: `${league.color}22`,
                  color: league.color,
                }}
              >
                {league.shortName}
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile nav scroll row */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto -mx-1 px-1">
          {navLinks.filter((l) => !l.memberOnly || !!member).map(({ href, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide transition-colors ${
                  active
                    ? 'bg-white/5 text-text-primary border border-hairline-strong'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </Link>
            );
          })}
          {!member ? (
            <Link
              href="/identify"
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide text-aurora-cyan"
            >
              Identify
            </Link>
          ) : (
            <button
              onClick={handleClearIdentity}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide text-text-muted"
            >
              {member.leagueName} · ⌫
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
