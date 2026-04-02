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
    <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
      <p className="text-5xl mb-4">🏆</p>
      <h2 className="text-2xl font-extrabold text-white mb-2">
        Bracket Unavailable
      </h2>
      <p className="text-text-secondary mb-6 max-w-md">
        The championship bracket couldn&apos;t be loaded. It may not be set up yet for this season.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
