'use client';

/* ── Order Entry / Trade Ticket Form ─────────────────────── */
import { useState, useCallback } from 'react';
import { useTradingStore } from '@/lib/store';
import { placeOrder } from '@/lib/api';
import { cn, formatUsd } from '@/lib/utils';
import { ShoppingCart, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit' | 'stop';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function OrderTicket({ open, onClose }: Props) {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const ticker = useTradingStore((s) => s.ticker);
  const addOrder = useTradingStore((s) => s.addOrder);

  const [side, setSide] = useState<Side>('buy');
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const currentPrice = ticker?.price ?? 0;
  const estimatedTotal = Number(quantity || 0) * (orderType === 'market' ? currentPrice : Number(price || 0));

  const handleSubmit = useCallback(async () => {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity');
      return;
    }
    if (orderType !== 'market' && (!price || Number(price) <= 0)) {
      toast.error('Enter a valid price');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        symbol: activeSymbol,
        side,
        type: orderType,
        quantity: qty,
      };
      if (orderType === 'limit') body.price = Number(price);
      if (orderType === 'stop') {
        body.price = Number(stopPrice || price);
      }

      const res = await placeOrder(body as any);
      const order = (res as any)?.data ?? res;

      addOrder({
        id: order.id ?? crypto.randomUUID(),
        symbol: activeSymbol,
        side,
        type: orderType,
        quantity: qty,
        price: orderType !== 'market' ? Number(price) : undefined,
        status: order.status ?? 'pending',
        createdAt: Date.now(),
      });

      toast.success(`${side.toUpperCase()} ${orderType} order placed for ${activeSymbol}`, {
        description: `${qty} @ ${orderType === 'market' ? 'MKT' : formatUsd(Number(price))}`,
      });

      /* Reset form */
      setQuantity('');
      setPrice('');
      setStopPrice('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Order failed';
      toast.error('Order rejected', { description: msg });
    } finally {
      setSubmitting(false);
    }
  }, [activeSymbol, side, orderType, quantity, price, stopPrice, addOrder, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-surface-700 bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-gray-100">New Order</span>
            <span className="text-xs text-gray-400 ml-1">{activeSymbol}</span>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-md" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current price */}
          <div className="text-center">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Current Price</span>
            <div className="text-xl font-mono font-bold text-gray-100">
              {currentPrice > 0 ? formatUsd(currentPrice, currentPrice < 10 ? 4 : 2) : '—'}
            </div>
          </div>

          {/* Side selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-surface-800">
            <button
              onClick={() => setSide('buy')}
              className={cn(
                'py-2 rounded-md text-sm font-semibold transition-all',
                side === 'buy'
                  ? 'bg-bull/20 text-bull shadow-sm'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              BUY
            </button>
            <button
              onClick={() => setSide('sell')}
              className={cn(
                'py-2 rounded-md text-sm font-semibold transition-all',
                side === 'sell'
                  ? 'bg-bear/20 text-bear shadow-sm'
                  : 'text-gray-400 hover:text-gray-200',
              )}
            >
              SELL
            </button>
          </div>

          {/* Order type */}
          <div className="flex gap-1.5 p-1 rounded-lg bg-surface-800">
            {(['market', 'limit', 'stop'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                  orderType === t
                    ? 'bg-brand-400/15 text-brand-300 border border-brand-400/20'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-mono text-gray-100 placeholder:text-gray-600 outline-none focus:border-brand-400/40 focus:ring-1 focus:ring-brand-400/20"
            />
          </div>

          {/* Price (limit/stop only) */}
          {orderType !== 'market' && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                {orderType === 'limit' ? 'Limit Price' : 'Stop Price'}
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={currentPrice > 0 ? currentPrice.toFixed(2) : '0.00'}
                className="w-full rounded-md border border-surface-700 bg-surface-800 px-3 py-2 text-sm font-mono text-gray-100 placeholder:text-gray-600 outline-none focus:border-brand-400/40 focus:ring-1 focus:ring-brand-400/20"
              />
            </div>
          )}

          {/* Estimated total */}
          <div className="flex items-center justify-between rounded-md bg-surface-800/60 px-3 py-2 border border-surface-700">
            <span className="text-xs text-gray-500">Est. Total</span>
            <span className="text-sm font-mono font-medium text-gray-200">
              {estimatedTotal > 0 ? formatUsd(estimatedTotal) : '—'}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !quantity}
            className={cn(
              'w-full py-2.5 rounded-md text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              side === 'buy'
                ? 'bg-bull text-white hover:bg-green-600 active:bg-green-700'
                : 'bg-bear text-white hover:bg-red-600 active:bg-red-700',
            )}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mx-auto animate-spin" />
            ) : (
              `${side === 'buy' ? 'Buy' : 'Sell'} ${activeSymbol}`
            )}
          </button>

          {/* Risk notice */}
          <p className="text-[10px] text-gray-600 text-center leading-relaxed">
            Orders are processed through Sven&apos;s risk engine. Paper trading mode — no real funds at risk.
          </p>
        </div>
      </div>
    </div>
  );
}
