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
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-6xl mb-4">📉</p>
      <h1 className="text-3xl font-extrabold text-white mb-2">
        Fumble!
      </h1>
      <p className="text-xl font-semibold text-accent-gold mb-2">
        Something went wrong.
      </p>
      <p className="text-text-secondary mb-6 max-w-md">
        Looks like we dropped the ball on that play. The commissioner has been notified.
        {error.digest && (
          <span className="block text-text-muted text-xs mt-2">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
