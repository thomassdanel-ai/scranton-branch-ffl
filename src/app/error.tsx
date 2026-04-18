'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="error-state">
      <span className="error-state__kicker">INCIDENT · UNHANDLED</span>
      <h1 className="error-state__title">Wrong.</h1>
      <p className="error-state__desc">
        Something broke on that play. Michael is on the phone with Corporate.
        Dwight is already writing an incident report. Try again — and if it
        happens twice, tell the commissioner.
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
