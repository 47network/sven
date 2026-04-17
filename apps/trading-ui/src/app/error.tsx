'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[trading-ui] Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-gray-100">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
        <p className="text-sm text-gray-400">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
