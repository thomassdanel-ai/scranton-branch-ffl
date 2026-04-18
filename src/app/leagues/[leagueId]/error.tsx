'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function LeagueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('League page error:', error);
  }, [error]);

  return (
    <div className="error-state">
      <span className="error-state__kicker">DIVISION · OFFLINE</span>
      <h2 className="error-state__title">Signal lost.</h2>
      <p className="error-state__desc">
        We couldn&apos;t load this league&apos;s data. This may be a temporary
        issue with the data source.
        {error.digest && (
          <span className="error-state__incident">INCIDENT {error.digest}</span>
        )}
      </p>
      <div className="error-state__actions">
        <button type="button" onClick={reset} className="btn btn--primary btn--sm">
          Retry
        </button>
        <Link href="/" className="btn btn--ghost btn--sm">
          Back to HQ
        </Link>
      </div>
    </div>
  );
}
