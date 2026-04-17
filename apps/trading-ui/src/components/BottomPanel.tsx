'use client';

import { useTradingStore } from '@/lib/store';
import { cn, formatUsd, formatPct, timeAgo, directionColor } from '@/lib/utils';
import {
  ArrowUpDown, Signal, Brain, Newspaper,
  TrendingUp, TrendingDown, Minus, Shield, AlertTriangle,
} from 'lucide-react';

type BottomTab = 'trades' | 'signals' | 'predictions' | 'news';

const TABS: { key: BottomTab; icon: typeof ArrowUpDown; label: string }[] = [
  { key: 'trades', icon: ArrowUpDown, label: 'Trade History' },
  { key: 'signals', icon: Signal, label: 'Signals' },
  { key: 'predictions', icon: Brain, label: 'Predictions' },
  { key: 'news', icon: Newspaper, label: 'News Feed' },
];

function TradesPanel() {
  const { orders } = useTradingStore();
  const filled = orders.filter((o) => o.status === 'filled');

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800/30">
            <th className="text-left py-2 px-3 font-medium">Symbol</th>
            <th className="text-left py-2 px-3 font-medium">Side</th>
            <th className="text-left py-2 px-3 font-medium">Type</th>
            <th className="text-right py-2 px-3 font-medium">Qty</th>
            <th className="text-right py-2 px-3 font-medium">Price</th>
            <th className="text-right py-2 px-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {filled.map((order) => (
            <tr key={order.id} className="border-b border-gray-800/20 hover:bg-surface-raised/20 transition-colors">
              <td className="py-2 px-3 font-medium text-gray-200">{order.symbol}</td>
              <td className="py-2 px-3">
                <span className={cn('font-medium', order.side === 'buy' ? 'text-bull' : 'text-bear')}>
                  {order.side.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400">{order.type}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-300">{order.quantity}</td>
              <td className="py-2 px-3 text-right font-mono text-gray-300">
                {order.price ? formatUsd(order.price) : 'MKT'}
              </td>
              <td className="py-2 px-3 text-right text-gray-500">
                {order.filledAt ? timeAgo(order.filledAt) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filled.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-600">No filled orders</div>
      )}
    </div>
  );
}

function SignalsPanel() {
  const { signals } = useTradingStore();

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800/30">
            <th className="text-left py-2 px-3 font-medium">Symbol</th>
            <th className="text-left py-2 px-3 font-medium">Direction</th>
            <th className="text-left py-2 px-3 font-medium">Source</th>
            <th className="text-right py-2 px-3 font-medium">Strength</th>
            <th className="text-right py-2 px-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((sig) => (
            <tr key={sig.id} className="border-b border-gray-800/20 hover:bg-surface-raised/20 transition-colors">
              <td className="py-2 px-3 font-medium text-gray-200">{sig.symbol}</td>
              <td className="py-2 px-3">
                <span className={cn('flex items-center gap-1 font-medium', directionColor(sig.direction))}>
                  {sig.direction === 'long' ? <TrendingUp className="w-3 h-3" /> :
                    sig.direction === 'short' ? <TrendingDown className="w-3 h-3" /> :
                      <Minus className="w-3 h-3" />}
                  {sig.direction.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-3 text-gray-400 font-mono">{sig.source}</td>
              <td className="py-2 px-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', sig.strength > 0.7 ? 'bg-green-500' : sig.strength > 0.4 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${sig.strength * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-gray-300 w-8 text-right">{(sig.strength * 100).toFixed(0)}%</span>
                </div>
              </td>
              <td className="py-2 px-3 text-right text-gray-500">{timeAgo(sig.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {signals.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-600">No signals</div>
      )}
    </div>
  );
}

function PredictionsPanel() {
  const { predictions } = useTradingStore();

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 text-[10px] uppercase tracking-wider border-b border-gray-800/30">
            <th className="text-left py-2 px-3 font-medium">Symbol</th>
            <th className="text-left py-2 px-3 font-medium">Model</th>
            <th className="text-left py-2 px-3 font-medium">Direction</th>
            <th className="text-right py-2 px-3 font-medium">Target</th>
            <th className="text-right py-2 px-3 font-medium">Confidence</th>
            <th className="text-right py-2 px-3 font-medium">Horizon</th>
            <th className="text-right py-2 px-3 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {predictions.map((pred) => (
            <tr key={pred.id} className="border-b border-gray-800/20 hover:bg-surface-raised/20 transition-colors">
              <td className="py-2 px-3 font-medium text-gray-200">{pred.symbol}</td>
              <td className="py-2 px-3 text-gray-400 font-mono text-[10px]">{pred.model}</td>
              <td className="py-2 px-3">
                <span className={cn('flex items-center gap-1 font-medium', directionColor(pred.predictedDirection))}>
                  {pred.predictedDirection === 'long' ? <TrendingUp className="w-3 h-3" /> :
                    pred.predictedDirection === 'short' ? <TrendingDown className="w-3 h-3" /> :
                      <Minus className="w-3 h-3" />}
                  {pred.predictedDirection.toUpperCase()}
                </span>
              </td>
              <td className="py-2 px-3 text-right font-mono text-gray-300">{formatUsd(pred.predictedClose)}</td>
              <td className="py-2 px-3 text-right">
                <span className={cn(
                  'font-mono',
                  pred.confidence > 0.7 ? 'text-green-400' : pred.confidence > 0.5 ? 'text-amber-400' : 'text-red-400',
                )}>
                  {(pred.confidence * 100).toFixed(0)}%
                </span>
              </td>
              <td className="py-2 px-3 text-right text-gray-400 font-mono">
                {pred.horizonCandles} × {pred.timeframe}
              </td>
              <td className="py-2 px-3 text-right text-gray-500">{timeAgo(pred.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {predictions.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-600">No predictions</div>
      )}
    </div>
  );
}

function NewsPanel() {
  const { newsItems } = useTradingStore();
  const IMPACT_COLORS = ['', 'text-gray-400', 'text-blue-400', 'text-amber-400', 'text-orange-400', 'text-red-400'];

  return (
    <div className="overflow-auto divide-y divide-gray-800/30">
      {newsItems.map((item, i) => (
        <div key={i} className="px-3 py-2.5 hover:bg-surface-raised/20 transition-colors">
          <div className="flex items-start gap-2">
            <div className={cn('shrink-0 mt-0.5', item.sentimentScore > 0.3 ? 'text-green-400' : item.sentimentScore < -0.3 ? 'text-red-400' : 'text-gray-400')}>
              {item.sentimentScore > 0.3 ? <TrendingUp className="w-3.5 h-3.5" /> :
                item.sentimentScore < -0.3 ? <TrendingDown className="w-3.5 h-3.5" /> :
                  <Minus className="w-3.5 h-3.5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-200 leading-relaxed">{item.event}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn('text-[10px] font-medium', IMPACT_COLORS[item.impact.level] ?? 'text-gray-400')}>
                  Impact {item.impact.level}/5
                </span>
                <span className="text-[10px] text-gray-600">{item.impact.category}</span>
                <span className="text-[10px] text-gray-600">
                  {item.entities.symbols.join(', ')}
                </span>
                <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(item.timestamp)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
      {newsItems.length === 0 && (
        <div className="py-8 text-center text-xs text-gray-600">No news</div>
      )}
    </div>
  );
}

export function BottomPanel() {
  const { bottomPanel, setBottomPanel, signals, predictions, newsItems, orders } = useTradingStore();
  const filledCount = orders.filter((o) => o.status === 'filled').length;

  const counts: Record<BottomTab, number> = {
    trades: filledCount,
    signals: signals.length,
    predictions: predictions.length,
    news: newsItems.length,
  };

  return (
    <div className="border-t border-gray-800/60 bg-surface/50 flex flex-col" style={{ height: 260 }}>
      {/* Tabs */}
      <div className="flex border-b border-gray-800/30 shrink-0">
        {TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setBottomPanel(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors',
              bottomPanel === key
                ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-400/5'
                : 'text-gray-500 hover:text-gray-300',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {counts[key] > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-raised text-gray-400">
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {bottomPanel === 'trades' && <TradesPanel />}
        {bottomPanel === 'signals' && <SignalsPanel />}
        {bottomPanel === 'predictions' && <PredictionsPanel />}
        {bottomPanel === 'news' && <NewsPanel />}
      </div>
    </div>
  );
}
