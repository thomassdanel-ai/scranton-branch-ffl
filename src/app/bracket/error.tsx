'use client';

import { useEffect } from 'react';

export default function BracketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Bracket error:', error);
  }, [error]);

  return (
    <div className="error-state">
      <span className="error-state__kicker">BRACKET · UNAVAILABLE</span>
      <h2 className="error-state__title">No field, no trophy.</h2>
      <p className="error-state__desc">
        The championship bracket couldn&apos;t be loaded. It may not be set up
        yet for this season.
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
