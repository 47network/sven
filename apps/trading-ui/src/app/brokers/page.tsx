// ---------------------------------------------------------------------------
// /brokers — Connected Broker Health & Status
// ---------------------------------------------------------------------------
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Server, Activity, Wifi, WifiOff, RefreshCw,
  Clock, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchBrokers, fetchBrokerHealth } from '@/lib/api';
import Link from 'next/link';

interface BrokerInfo {
  name: string;
  connected: boolean;
  latencyMs?: number;
}

function brokerLabel(name: string): string {
  switch (name) {
    case 'ccxt_binance': return 'Binance';
    case 'ccxt_bybit': return 'Bybit';
    case 'alpaca': return 'Alpaca';
    case 'paper': return 'Paper Trading';
    default: return name;
  }
}

function latencyColor(ms?: number): string {
  if (ms == null) return 'text-gray-500';
  if (ms < 100) return 'text-bull';
  if (ms < 500) return 'text-yellow-400';
  return 'text-bear';
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [listRes, healthRes] = await Promise.all([
        fetchBrokers().catch(() => ({ brokers: [] })),
        fetchBrokerHealth().catch(() => ({})),
      ]);

      const names: string[] = Array.isArray(listRes)
        ? listRes.map((b: BrokerInfo) => b.name)
        : (listRes as { brokers: string[] }).brokers ?? [];
      const health = healthRes as Record<string, boolean>;

      // Merge — if list returns objects with latencyMs, use them; otherwise construct from health
      const merged: BrokerInfo[] = Array.isArray(listRes) && listRes.length > 0 && typeof listRes[0] === 'object' && 'name' in listRes[0]
        ? (listRes as BrokerInfo[])
        : names.map((name) => ({
            name,
            connected: health[name] ?? false,
          }));

      setBrokers(merged);
      setHealthMap(health);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const connectedCount = brokers.filter((b) => b.connected).length;
  const avgLatency = (() => {
    const withLatency = brokers.filter((b) => b.connected && b.latencyMs != null);
    if (withLatency.length === 0) return null;
    return Math.round(withLatency.reduce((s, b) => s + (b.latencyMs ?? 0), 0) / withLatency.length);
  })();

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Nav bar */}
      <nav className="h-12 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        <Link href="/sven" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sven AI</Link>
        <Link href="/backtest" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Backtest</Link>
        <Link href="/analytics" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Analytics</Link>
        <Link href="/alerts" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Alerts</Link>
        <Link href="/credentials" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Credentials</Link>
        <span className="text-sm text-brand-400 font-semibold">Brokers</span>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Server className="w-7 h-7 text-brand-400" />
            Broker Health
          </h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 rounded-md border border-gray-700 text-sm text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-900/30 border border-red-800/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-4">
            <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Connected</div>
            <div className={cn('text-2xl font-mono font-bold', connectedCount === brokers.length ? 'text-bull' : 'text-yellow-400')}>
              {connectedCount} / {brokers.length}
            </div>
          </div>
          <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-4">
            <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Avg Latency</div>
            <div className={cn('text-2xl font-mono font-bold', latencyColor(avgLatency ?? undefined))}>
              {avgLatency != null ? `${avgLatency}ms` : '—'}
            </div>
          </div>
          <div className="rounded-lg bg-surface-muted border border-gray-800/50 p-4">
            <div className="text-[10px] uppercase text-gray-500 tracking-wider mb-1">Status</div>
            <div className={cn('text-2xl font-bold', connectedCount > 0 ? 'text-bull' : 'text-gray-500')}>
              {connectedCount > 0 ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {/* Broker list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading brokers…</div>
        ) : brokers.length === 0 ? (
          <div className="text-center py-12">
            <WifiOff className="w-12 h-12 mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No brokers connected</p>
            <p className="text-gray-600 text-sm mt-1">
              <Link href="/credentials" className="text-brand-400 hover:text-brand-300">Add exchange credentials</Link> to connect a broker
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {brokers.map((broker) => (
              <div
                key={broker.name}
                className="p-4 rounded-lg bg-surface-muted border border-gray-800/50 flex items-center gap-4"
              >
                {/* Status dot */}
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  broker.connected ? 'bg-green-900/20' : 'bg-red-900/20',
                )}>
                  {broker.connected
                    ? <Wifi className="w-5 h-5 text-bull" />
                    : <WifiOff className="w-5 h-5 text-bear" />}
                </div>

                {/* Name + status */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{brokerLabel(broker.name)}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      'inline-block w-2 h-2 rounded-full',
                      broker.connected ? 'bg-bull' : 'bg-bear',
                    )} />
                    <span className="text-xs text-gray-500">
                      {broker.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                {/* Latency */}
                {broker.connected && broker.latencyMs != null && (
                  <div className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-mono font-semibold',
                    broker.latencyMs < 100
                      ? 'bg-green-900/20 text-bull'
                      : broker.latencyMs < 500
                        ? 'bg-yellow-900/20 text-yellow-400'
                        : 'bg-red-900/20 text-bear',
                  )}>
                    {broker.latencyMs}ms
                  </div>
                )}

                {/* Health from map */}
                {!broker.latencyMs && broker.name in healthMap && (
                  <div className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-semibold',
                    healthMap[broker.name]
                      ? 'bg-green-900/20 text-bull'
                      : 'bg-red-900/20 text-bear',
                  )}>
                    {healthMap[broker.name] ? 'Healthy' : 'Unhealthy'}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
