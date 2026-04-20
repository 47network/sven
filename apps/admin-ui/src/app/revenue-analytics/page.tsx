'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try {
    return new Date(String(v)).toLocaleString();
  } catch {
    return String(v);
  }
}

const KIND_COLORS: Record<string, string> = {
  revenue: 'text-emerald-400',
  seed: 'text-emerald-400',
  compute_cost: 'text-red-400',
  upgrade: 'text-red-400',
  fee: 'text-amber-400',
  transfer: 'text-cyan-400',
  refund: 'text-orange-400',
  payout: 'text-violet-400',
};

export default function RevenueAnalyticsPage() {
  const summaryQ = useQuery({
    queryKey: ['economy', 'summary'],
    queryFn: () => api.economy.summary(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const txnQ = useQuery({
    queryKey: ['economy', 'transactions'],
    queryFn: () => api.economy.transactions({ limit: 50 }),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const topQ = useQuery({
    queryKey: ['economy', 'top-listings'],
    queryFn: () => api.economy.topListings(),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  if (summaryQ.isLoading) return <PageSpinner />;

  const s = summaryQ.data?.data ?? {} as Record<string, unknown>;
  const totalBalance = Number(s.totalBalance ?? 0);
  const totalRevenue = Number(s.totalRevenue ?? 0);
  const totalCost = Number(s.totalCost ?? 0);
  const netProfit = Number(s.netProfit ?? 0);
  const publishedListings = Number(s.publishedListings ?? 0);
  const completedOrders = Number(s.completedOrders ?? 0);

  const transactions = (txnQ.data?.transactions ?? []) as Array<Record<string, unknown>>;
  const topListings = (topQ.data ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue Analytics"
        description="Sven's autonomous economy: treasury balance, revenue streams, and marketplace performance."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Treasury Balance" value={fmtUsd(totalBalance)} />
        <StatCard label="Total Revenue" value={fmtUsd(totalRevenue)} />
        <StatCard label="Total Cost" value={fmtUsd(totalCost)} />
        <StatCard label="Net Profit" value={fmtUsd(netProfit)} />
        <StatCard label="Published Listings" value={String(publishedListings)} />
        <StatCard label="Completed Orders" value={String(completedOrders)} />
      </div>

      {/* Top Listings */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Top Listings by Revenue</h2>
        <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Unit Price</th>
                <th className="px-3 py-2 font-medium">Sales</th>
                <th className="px-3 py-2 font-medium">Revenue</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {topListings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No marketplace listings yet.
                  </td>
                </tr>
              )}
              {topListings.map((l) => (
                <tr key={String(l.id)} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-medium">{String(l.title)}</td>
                  <td className="px-3 py-2 text-zinc-400">{String(l.kind)}</td>
                  <td className="px-3 py-2">{fmtUsd(Number(l.unitPrice ?? 0))}</td>
                  <td className="px-3 py-2">{String(l.totalSales ?? 0)}</td>
                  <td className="px-3 py-2 text-emerald-400">{fmtUsd(Number(l.totalRevenue ?? 0))}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs ${l.status === 'published' ? 'text-emerald-400' : 'text-zinc-400'}`}>
                      {String(l.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-2">Recent Transactions</h2>
        <div className="rounded-xl border border-white/10 bg-black/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                    No transactions yet. Economy is warming up.
                  </td>
                </tr>
              )}
              {transactions.map((tx) => {
                const kind = String(tx.kind ?? '');
                return (
                  <tr key={String(tx.id)} className="border-t border-white/5 hover:bg-white/5">
                    <td className="px-3 py-2 font-mono text-xs">{String(tx.id).slice(0, 12)}…</td>
                    <td className={`px-3 py-2 ${KIND_COLORS[kind] ?? 'text-zinc-300'}`}>{kind}</td>
                    <td className="px-3 py-2">{fmtUsd(Number(tx.amount ?? 0))}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{String(tx.source ?? '—')}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                      {String(tx.accountId ?? '').slice(0, 10)}…
                    </td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{fmtDate(tx.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        Revenue flows through the Treasury ledger. Marketplace listings earn on every sale.
        Automatons use this revenue to pay for compute and self-replicate.
      </p>
    </div>
  );
}
