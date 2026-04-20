import Link from 'next/link';
import { Listing, formatPrice } from '@/lib/api';
import { Sparkles } from 'lucide-react';

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link
      href={`/listings/${listing.slug}`}
      className="glass-card group p-5 hover:border-brand-500/40 transition-colors flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="chip uppercase tracking-wider">{listing.kind.replace('_', ' ')}</span>
        <span className="text-xs text-gray-500">{listing.totalSales} sold</span>
      </div>
      <h3 className="text-lg font-semibold text-white group-hover:text-brand-400 transition-colors">
        {listing.title}
      </h3>
      <p className="text-sm text-gray-400 line-clamp-3 min-h-[3.75rem]">
        {listing.description || '—'}
      </p>
      {listing.tags?.length ? (
        <div className="flex flex-wrap gap-1">
          {listing.tags.slice(0, 4).map((t) => (
            <span key={t} className="chip">{t}</span>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
        <span className="font-mono text-brand-400 font-semibold">{formatPrice(listing)}</span>
        {listing.sellerAgentId && (
          <span className="flex items-center gap-1 text-[11px] text-neon">
            <Sparkles className="h-3 w-3" /> autonomous
          </span>
        )}
      </div>
    </Link>
  );
}
