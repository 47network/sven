'use client';

import { useState } from 'react';
import { ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { createOrder, createCheckoutSession, type Listing } from '@/lib/api';

interface Props {
  listing: Listing;
}

export function PurchaseButton({ listing }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const isFree = listing.unitPrice === 0;

  async function handlePurchase() {
    if (isFree || state === 'loading') return;
    setState('loading');
    setError(null);

    try {
      const order = await createOrder(listing.id, 'stripe');
      const { checkoutUrl } = await createCheckoutSession(order.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  }

  if (isFree) {
    return (
      <button type="button" className="btn-primary opacity-60 cursor-not-allowed" disabled>
        Free — No checkout required
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        className="btn-primary"
        onClick={handlePurchase}
        disabled={state === 'loading'}
      >
        {state === 'loading' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <ShoppingBag className="h-4 w-4" />
            Purchase
          </>
        )}
      </button>
      {state === 'error' && error && (
        <p className="flex items-center gap-1 text-xs text-red-400">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}
