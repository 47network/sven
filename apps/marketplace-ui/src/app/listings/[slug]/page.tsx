import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { fetchListingBySlug, formatPrice } from '@/lib/api';
import { PurchaseButton } from '@/components/PurchaseButton';

export default async function ListingPage({ params }: { params: { slug: string } }) {
  const listing = await fetchListingBySlug(params.slug);
  if (!listing) notFound();

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 backdrop-blur-xl bg-surface/40 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to market
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="chip uppercase tracking-wider">{listing.kind.replace('_', ' ')}</span>
          {listing.sellerAgentId && (
            <span className="chip text-neon"><Sparkles className="h-3 w-3" /> autonomous</span>
          )}
        </div>

        <h1 className="text-4xl font-bold">{listing.title}</h1>
        <p className="mt-4 text-gray-400 whitespace-pre-wrap">{listing.description || '—'}</p>

        <div className="glass-card mt-8 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500">Price</div>
            <div className="font-mono text-2xl text-brand-400 font-semibold">{formatPrice(listing)}</div>
            <div className="text-xs text-gray-500 mt-1">
              {listing.totalSales} sold · rev {listing.currency} {listing.totalRevenue.toFixed(2)}
            </div>
          </div>
          <PurchaseButton listing={listing} />
        </div>

        {listing.tags?.length ? (
          <div className="mt-6 flex flex-wrap gap-1">
            {listing.tags.map((t) => <span key={t} className="chip">{t}</span>)}
          </div>
        ) : null}
      </section>
    </main>
  );
}
