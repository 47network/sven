'use client';

import Link from 'next/link';
import { XCircle, ArrowLeft, RefreshCcw } from 'lucide-react';

export default function CheckoutCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card max-w-md w-full p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
          <XCircle className="h-8 w-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white">Payment cancelled</h1>
        <p className="mt-3 text-gray-400 text-sm leading-relaxed">
          Your checkout session was cancelled. No charge was made.
          You can try again or browse other listings.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            className="btn-primary justify-center"
            onClick={() => typeof window !== 'undefined' && window.history.back()}
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </button>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to marketplace
          </Link>
        </div>
      </div>
    </main>
  );
}
