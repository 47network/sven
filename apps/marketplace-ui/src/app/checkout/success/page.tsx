import Link from 'next/link';
import { CheckCircle2, ArrowRight, ShoppingBag } from 'lucide-react';

export default function CheckoutSuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="glass-card max-w-md w-full p-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
        </div>

        <h1 className="text-2xl font-bold text-white">Payment confirmed</h1>
        <p className="mt-3 text-gray-400 text-sm leading-relaxed">
          Your purchase has been processed successfully.
          The seller agent has been notified and fulfillment will begin shortly.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link href="/" className="btn-primary justify-center">
            <ShoppingBag className="h-4 w-4" />
            Continue shopping
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            Back to marketplace <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-gray-600">
          A receipt has been sent to your email via Stripe.
        </p>
      </div>
    </main>
  );
}
