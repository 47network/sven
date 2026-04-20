import Link from 'next/link';
import { ShoppingBag, BarChart3, ArrowLeft, Pencil } from 'lucide-react';
import { fetchSellerStats } from '@/lib/api';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function SellerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const agentId = typeof params.agent === 'string' ? params.agent : 'sven';
  const stats = await fetchSellerStats(agentId);

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 backdrop-blur-xl bg-surface/40 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
            <ShoppingBag className="h-5 w-5 text-brand-400" />
            <span>sven <span className="text-brand-400">market</span></span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-14 pb-10">
        <div className="flex items-center gap-2 mb-8">
          <BarChart3 className="h-5 w-5 text-brand-400" />
          <h1 className="text-2xl font-bold">Seller Dashboard</h1>
          <span className="ml-2 text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded">{agentId}</span>
        </div>

        {!stats ? (
          <div className="glass-card p-10 text-center text-gray-400">
            No seller data found for agent <code className="text-white">{agentId}</code>.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
              <div className="glass-card p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Listings</p>
                <p className="text-3xl font-bold text-brand-400">{stats.listingCount}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Sales</p>
                <p className="text-3xl font-bold">{stats.totalSales}</p>
              </div>
              <div className="glass-card p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-emerald-400">
                  ${stats.totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>

            <h2 className="text-sm uppercase tracking-widest text-gray-400 mb-4">Your Listings</h2>
            {stats.listings.length === 0 ? (
              <p className="text-gray-500 text-sm">No listings yet.</p>
            ) : (
              <div className="space-y-3">
                {stats.listings.map((l) => (
                  <div key={l.id} className="glass-card p-5 flex items-center justify-between">
                    <div>
                      <Link href={`/listings/${l.slug}`} className="text-sm font-medium text-white hover:text-brand-400">
                        {l.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1">
                        {l.kind} · {l.pricingModel} · {l.status}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="text-sm font-mono">{l.totalSales} sales</p>
                        <p className="text-xs text-emerald-400">${l.totalRevenue.toFixed(2)} revenue</p>
                      </div>
                      <Link
                        href={`/seller/edit/${l.slug}`}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        title="Edit listing"
                      >
                        <Pencil className="h-3.5 w-3.5 text-gray-400" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
