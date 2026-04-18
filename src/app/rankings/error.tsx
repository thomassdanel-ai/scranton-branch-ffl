'use client';

import { useEffect } from 'react';

export default function RankingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Rankings error:', error);
  }, [error]);

  return (
    <div className="error-state">
      <span className="error-state__kicker">LADDER · UNAVAILABLE</span>
      <h2 className="error-state__title">Numbers aren&apos;t in.</h2>
      <p className="error-state__desc">
        Power rankings couldn&apos;t be computed right now. This usually
        resolves after the next data sync.
        {error.digest && (
          <span className="error-state__incident">INCIDENT {error.digest}</span>
        )}
      </p>
      <div className="error-state__actions">
        <button type="button" onClick={reset} className="btn btn--primary btn--sm">
          Try again
        </button>
      </div>
    </div>
  );
}
