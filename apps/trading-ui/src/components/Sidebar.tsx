'use client';

import { useTradingStore } from '@/lib/store';
import { cn, formatUsd, formatPct, formatCompact } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, Search, Star,
  List, Briefcase, ClipboardList, Activity,
} from 'lucide-react';
import type { WatchlistItem } from '@/lib/types';
import { useState } from 'react';

const SIDEBAR_TABS = [
  { key: 'watchlist' as const, icon: List, label: 'Watchlist' },
  { key: 'positions' as const, icon: Briefcase, label: 'Positions' },
  { key: 'orders' as const, icon: ClipboardList, label: 'Orders' },
  { key: 'activity' as const, icon: Activity, label: 'Activity' },
];

function WatchlistRow({ item, active, onClick }: { item: WatchlistItem; active: boolean; onClick: () => void }) {
  const isUp = item.changePct > 0;
  const isDown = item.changePct < 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors rounded-md',
        active ? 'bg-brand-400/10 border border-brand-400/20' : 'hover:bg-surface-raised/50 border border-transparent',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-100 truncate">{item.symbol}</span>
          <span className="text-[10px] text-gray-500 truncate">{item.name}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Vol {formatCompact(item.volume24h)}
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span className="text-sm font-mono font-medium text-gray-100">
          {item.price >= 1000 ? formatUsd(item.price, 0) : formatUsd(item.price, item.price < 10 ? 4 : 2)}
        </span>
        <span className={cn(
          'flex items-center gap-0.5 text-xs font-mono',
          isUp ? 'text-bull' : isDown ? 'text-bear' : 'text-neutral',
        )}>
          {isUp ? <TrendingUp className="w-3 h-3" /> :
            isDown ? <TrendingDown className="w-3 h-3" /> :
              <Minus className="w-3 h-3" />}
          {formatPct(item.changePct)}
        </span>
      </div>
    </button>
  );
}

function PositionRow({ position }: { position: { symbol: string; side: string; quantity: number; entryPrice: number; currentPrice: number; stopLoss?: number; takeProfit?: number } }) {
  const unrealizedPnl = (position.currentPrice - position.entryPrice) * position.quantity * (position.side === 'buy' ? 1 : -1);
  const pnlPct = ((position.currentPrice - position.entryPrice) / position.entryPrice) * 100 * (position.side === 'buy' ? 1 : -1);

  return (
    <div className="px-3 py-2.5 border-b border-gray-800/30 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-gray-100">{position.symbol}</span>
          <span className={cn('ml-2 text-xs font-medium', position.side === 'buy' ? 'text-bull' : 'text-bear')}>
            {position.side.toUpperCase()}
          </span>
        </div>
        <span className={cn('text-sm font-mono font-medium', unrealizedPnl >= 0 ? 'text-bull' : 'text-bear')}>
          {formatUsd(unrealizedPnl)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
        <span>Qty: {position.quantity} @ {formatUsd(position.entryPrice)}</span>
        <span className={cn(unrealizedPnl >= 0 ? 'text-green-500' : 'text-red-500')}>
          {formatPct(pnlPct)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-600">
        {position.stopLoss && <span>SL: {formatUsd(position.stopLoss)}</span>}
        {position.takeProfit && <span>TP: {formatUsd(position.takeProfit)}</span>}
      </div>
    </div>
  );
}

function OrderRow({ order }: { order: { id: string; symbol: string; side: string; type: string; quantity: number; price?: number; status: string } }) {
  return (
    <div className="px-3 py-2.5 border-b border-gray-800/30 last:border-0">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold text-gray-100">{order.symbol}</span>
          <span className={cn('ml-2 text-xs font-medium', order.side === 'buy' ? 'text-bull' : 'text-bear')}>
            {order.side.toUpperCase()} {order.type.toUpperCase()}
          </span>
        </div>
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full',
          order.status === 'filled' ? 'bg-green-500/15 text-green-400' :
            order.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
              'bg-gray-500/15 text-gray-400',
        )}>
          {order.status}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
        <span>Qty: {order.quantity}</span>
        {order.price && <span>@ {formatUsd(order.price)}</span>}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: { type: string; message: string; timestamp: number } }) {
  const typeColors: Record<string, string> = {
    signal: 'bg-brand-400/20 text-brand-300',
    order: 'bg-green-500/20 text-green-400',
    risk_check: 'bg-amber-500/20 text-amber-400',
    prediction: 'bg-purple-500/20 text-purple-400',
    news: 'bg-blue-500/20 text-blue-400',
    strategy: 'bg-indigo-500/20 text-indigo-400',
    rebalance: 'bg-orange-500/20 text-orange-400',
  };

  const age = Math.floor((Date.now() - activity.timestamp) / 1000);
  const timeStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`;

  return (
    <div className="px-3 py-2 border-b border-gray-800/30 last:border-0">
      <div className="flex items-start gap-2">
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 shrink-0', typeColors[activity.type] ?? 'bg-gray-500/20 text-gray-400')}>
          {activity.type}
        </span>
        <p className="text-[11px] text-gray-300 leading-relaxed flex-1">{activity.message}</p>
        <span className="text-[10px] text-gray-600 shrink-0">{timeStr}</span>
      </div>
    </div>
  );
}

export function Sidebar() {
  const {
    watchlist, activeSymbol, setActiveSymbol,
    positions, orders, activities,
    sidebarPanel, setSidebarPanel,
  } = useTradingStore();
  const [search, setSearch] = useState('');

  const filteredWatchlist = search
    ? watchlist.filter((w) => w.symbol.toLowerCase().includes(search.toLowerCase()) || w.name.toLowerCase().includes(search.toLowerCase()))
    : watchlist;

  return (
    <aside className="w-72 border-r border-gray-800/60 bg-surface/50 flex flex-col shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-800/40">
        {SIDEBAR_TABS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setSidebarPanel(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              sidebarPanel === key
                ? 'text-brand-400 border-b-2 border-brand-400 bg-brand-400/5'
                : 'text-gray-500 hover:text-gray-300',
            )}
            aria-label={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Search (watchlist only) */}
      {sidebarPanel === 'watchlist' && (
        <div className="p-2 border-b border-gray-800/30">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search symbols…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-surface-raised/50 border border-gray-800/50 rounded-md text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400/40"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarPanel === 'watchlist' && (
          <div className="p-1.5 space-y-0.5">
            {filteredWatchlist.map((item) => (
              <WatchlistRow
                key={item.symbol}
                item={item}
                active={item.symbol === activeSymbol}
                onClick={() => setActiveSymbol(item.symbol)}
              />
            ))}
          </div>
        )}

        {sidebarPanel === 'positions' && (
          <div>
            <div className="px-3 py-2 border-b border-gray-800/30">
              <span className="text-[10px] uppercase text-gray-500 tracking-wider">
                Open Positions ({positions.length})
              </span>
            </div>
            {positions.map((p) => (
              <PositionRow key={p.orderId} position={p} />
            ))}
            {positions.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-600">No open positions</div>
            )}
          </div>
        )}

        {sidebarPanel === 'orders' && (
          <div>
            <div className="px-3 py-2 border-b border-gray-800/30">
              <span className="text-[10px] uppercase text-gray-500 tracking-wider">
                Orders ({orders.length})
              </span>
            </div>
            {orders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
            {orders.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-600">No orders</div>
            )}
          </div>
        )}

        {sidebarPanel === 'activity' && (
          <div>
            <div className="px-3 py-2 border-b border-gray-800/30">
              <span className="text-[10px] uppercase text-gray-500 tracking-wider">
                Sven Activity Feed
              </span>
            </div>
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
            {activities.length === 0 && (
              <div className="px-3 py-8 text-center text-xs text-gray-600">No recent activity</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
