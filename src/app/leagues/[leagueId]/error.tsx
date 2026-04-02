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
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
      <p className="text-5xl mb-4">🏟️</p>
      <h2 className="text-2xl font-extrabold text-white mb-2">
        League Data Unavailable
      </h2>
      <p className="text-text-secondary mb-6 max-w-md">
        We couldn&apos;t load this league&apos;s data. This may be a temporary issue with the data source.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
        >
          Retry
        </button>
        <Link
          href="/"
          className="px-5 py-2 bg-bg-tertiary text-text-secondary rounded-lg font-semibold hover:bg-bg-secondary transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
