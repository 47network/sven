// ---------------------------------------------------------------------------
// /trading-brokers — Admin Broker Health & Status
// ---------------------------------------------------------------------------
'use client';

import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonStatGrid, SkeletonCard } from '@/components/Skeleton';
import { useTradingBrokers, useTradingBrokerHealth } from '@/lib/hooks';
import { Server, Wifi, WifiOff, Activity } from 'lucide-react';

const BROKER_LABELS: Record<string, string> = {
  ccxt_binance: 'Binance',
  ccxt_bybit: 'Bybit',
  alpaca: 'Alpaca',
  paper: 'Paper Trading',
};

function brokerLabel(name: string): string {
  return BROKER_LABELS[name] ?? name;
}

export default function TradingBrokersPage() {
  const { data: brokersRaw, isLoading } = useTradingBrokers();
  const { data: healthRaw } = useTradingBrokerHealth();

  const brokerList: Array<Record<string, unknown>> = (() => {
    if (!brokersRaw) return [];
    const raw = brokersRaw as Record<string, unknown>;
    if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
    if (raw.rows && Array.isArray(raw.rows)) return raw.rows as Array<Record<string, unknown>>;
    if (raw.brokers && Array.isArray(raw.brokers))
      return (raw.brokers as string[]).map((n) => ({ name: n } as Record<string, unknown>));
    return [];
  })();

  const healthMap = (healthRaw ?? {}) as Record<string, boolean>;

  const connectedCount = brokerList.filter(
    (b) => b.connected || healthMap[String(b.name)] === true,
  ).length;

  return (
    <>
      <PageHeader
        title="Brokers"
        description="Connected exchanges and broker health status"
      />

      {isLoading ? (
        <>
          <SkeletonStatGrid count={3} />
          <SkeletonCard />
        </>
      ) : brokerList.length === 0 ? (
        <EmptyState
          icon={WifiOff}
          title="No brokers connected"
          description="Add exchange credentials to connect a broker"
        />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <StatCard
              label="Connected"
              value={`${connectedCount} / ${brokerList.length}`}
              icon={Wifi}
            />
            <StatCard
              label="Total Brokers"
              value={String(brokerList.length)}
              icon={Server}
            />
            <StatCard
              label="Status"
              value={connectedCount > 0 ? 'Online' : 'Offline'}
              icon={Activity}
            />
          </div>

          {/* Broker list */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Broker</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Health</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Latency</th>
                </tr>
              </thead>
              <tbody>
                {brokerList.map((broker) => {
                  const name = String(broker.name ?? broker.broker ?? '');
                  const connected = Boolean(broker.connected) || healthMap[name] === true;
                  const latency = typeof broker.latencyMs === 'number' ? broker.latencyMs : null;

                  return (
                    <tr key={name} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{brokerLabel(name)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${
                          connected
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {connected ? (
                            <><Wifi className="w-3 h-3" /> Connected</>
                          ) : (
                            <><WifiOff className="w-3 h-3" /> Disconnected</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {name in healthMap ? (
                          <span className={`text-xs font-semibold ${
                            healthMap[name] ? 'text-green-500' : 'text-destructive'
                          }`}>
                            {healthMap[name] ? 'Healthy' : 'Unhealthy'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-sm">
                        {latency != null ? (
                          <span className={
                            latency < 100 ? 'text-green-500' : latency < 500 ? 'text-yellow-500' : 'text-destructive'
                          }>
                            {latency}ms
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
