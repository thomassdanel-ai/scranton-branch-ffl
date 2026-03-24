import Link from 'next/link';
import { LEAGUE_CONFIG } from '@/config/leagues';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/10 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-text-muted text-sm">
            {LEAGUE_CONFIG.name} — {LEAGUE_CONFIG.currentSeason} Season
          </p>
          <p className="text-text-muted text-xs">
            Scranton Branch —{' '}
            <span className="italic">A Dunder Mifflin Production</span>
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Link
              href="/admin"
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Commissioner Panel
            </Link>
            <span className="text-text-muted text-xs">•</span>
            <span className="text-xs text-text-muted">
              Powered by Sleeper API
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
