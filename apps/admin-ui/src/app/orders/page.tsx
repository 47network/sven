'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-300',
  paid: 'bg-emerald-500/20 text-emerald-300',
  fulfilled: 'bg-blue-500/20 text-blue-300',
  refunded: 'bg-red-500/20 text-red-300',
  failed: 'bg-zinc-500/20 text-zinc-300',
  cancelled: 'bg-zinc-500/20 text-zinc-300',
};

function statusBadge(s: string) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[s] ?? 'bg-zinc-500/20 text-zinc-300'}`}>
      {s}
    </span>
  );
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(v: unknown): string {
  if (!v) return '—';
  try { return new Date(String(v)).toLocaleString(); }
  catch { return String(v); }
}

export default function OrderManagementPage() {
  const qc = useQueryClient();
  const [refunding, setRefunding] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const ordersQ = useQuery({
    queryKey: ['admin', 'orders'],
    queryFn: () => api.economy.adminOrders(),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const refundMut = useMutation({
    mutationFn: ({ orderId, reason: r }: { orderId: string; reason?: string }) =>
      api.economy.adminRefundOrder(orderId, r),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setRefunding(null);
      setReason('');
    },
  });

  if (ordersQ.isLoading) return <PageSpinner />;

  const orders = (ordersQ.data?.data?.orders ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <PageHeader title="Order Management" description="View and manage marketplace orders. Refund paid or fulfilled orders." />

      <div className="rounded-xl border border-white/5 bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/5">
            <tr className="text-xs text-gray-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">Order ID</th>
              <th className="text-left px-4 py-3">Listing</th>
              <th className="text-left px-4 py-3">Buyer</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500">No orders yet.</td>
              </tr>
            ) : (
              orders.map((o) => {
                const id = String(o.id);
                const canRefund = o.status === 'paid' || o.status === 'fulfilled';
                return (
                  <tr key={id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{id.slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs text-gray-300">{String(o.listingId ?? '').slice(0, 8)}…</td>
                    <td className="px-4 py-3 text-xs">{String(o.buyerEmail ?? o.buyerId ?? '—')}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmtUsd(Number(o.total ?? o.subtotal ?? 0))}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(String(o.status))}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {canRefund && refunding !== id && (
                        <button
                          onClick={() => setRefunding(id)}
                          className="text-xs px-3 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
                        >
                          Refund
                        </button>
                      )}
                      {refunding === id && (
                        <div className="flex items-center gap-2 justify-end">
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-40 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                          />
                          <button
                            onClick={() => refundMut.mutate({ orderId: id, reason: reason || undefined })}
                            disabled={refundMut.isPending}
                            className="text-xs px-3 py-1 rounded bg-red-500 text-white hover:bg-red-400 disabled:opacity-50"
                          >
                            {refundMut.isPending ? 'Processing…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => { setRefunding(null); setReason(''); }}
                            className="text-xs text-gray-500 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
