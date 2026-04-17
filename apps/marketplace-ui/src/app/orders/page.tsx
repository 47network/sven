'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Package, ArrowLeft } from 'lucide-react';
import { fetchOrders, type Order } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  paid: 'text-emerald-400 bg-emerald-400/10',
  fulfilled: 'text-blue-400 bg-blue-400/10',
  refunded: 'text-red-400 bg-red-400/10',
  failed: 'text-gray-400 bg-gray-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10',
};

export default function OrdersPage() {
  const [email, setEmail] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const result = await fetchOrders(email.trim());
      setOrders(result);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/5 backdrop-blur-xl bg-surface/40 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-wide">
            <ShoppingBag className="h-5 w-5 text-brand-400" />
            <span>sven <span className="text-brand-400">market</span></span>
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:text-white flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to listings
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-14 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Package className="h-5 w-5 text-brand-400" />
          <h1 className="text-2xl font-bold">Order History</h1>
        </div>

        <form onSubmit={search} className="flex gap-3 mb-10">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email to find orders…"
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-brand-400/50"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-brand-400 text-black rounded-lg font-medium text-sm hover:bg-brand-300 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Searching…' : 'Look up'}
          </button>
        </form>

        {searched && orders.length === 0 && (
          <div className="glass-card p-10 text-center text-gray-400">
            No orders found for that email.
          </div>
        )}

        {orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className="glass-card p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{o.listingId}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {o.paymentMethod} · qty {o.quantity} · {o.id}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-mono">
                    {o.currency} {o.total.toFixed(2)}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? 'text-gray-400'}`}>
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
