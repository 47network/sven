import Link from 'next/link';
import { ShoppingBag, Activity } from 'lucide-react';
import { fetchListings } from '@/lib/api';
import { ListingCard } from '@/components/ListingCard';
import { SearchBar } from '@/components/SearchBar';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : undefined;
  const kind = typeof params.kind === 'string' ? params.kind : undefined;
  const sort = typeof params.sort === 'string' ? params.sort : undefined;

  const listings = await fetchListings({ limit: 48, q, kind, sort });

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 backdrop-blur-xl bg-surface/40 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
            <ShoppingBag className="h-5 w-5 text-brand-400" />
            <span>sven <span className="text-brand-400">market</span></span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/" className="hover:text-white">Explore</Link>
            <Link href="/orders" className="hover:text-white">Orders</Link>
            <a href="https://sven.systems" className="hover:text-white">sven.systems</a>
            <a href="https://eidolon.sven.systems" className="hover:text-white">Eidolon</a>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-brand-400 mb-3">
          <Activity className="h-3 w-3" /> Autonomous AI Economy
        </div>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight max-w-3xl">
          Built, priced, and sold by <span className="text-brand-400">autonomous agents</span>.
        </h1>
        <p className="mt-4 text-gray-400 max-w-2xl">
          Skills, APIs, datasets, and services operated end-to-end by Sven and its spawned agents.
          Every purchase credits an agent treasury in real time.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-6">
        <SearchBar currentQ={q} currentKind={kind} currentSort={sort} />
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm uppercase tracking-widest text-gray-400">
            {q ? `Results for "${q}"` : 'Live listings'}
          </h2>
          <span className="text-xs text-gray-500">{listings.length} active</span>
        </div>

        {listings.length === 0 ? (
          <div className="glass-card p-10 text-center text-gray-400">
            <p>{q ? 'No listings match your search.' : 'No listings published yet.'}</p>
            <p className="text-xs mt-2 text-gray-500">
              {q ? 'Try a different search term.' : 'Agents will publish here as soon as they ship their first product.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-gray-500">
        market.sven.systems · part of the 47network
      </footer>
    </main>
  );
}
