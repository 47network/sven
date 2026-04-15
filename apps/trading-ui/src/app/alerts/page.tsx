// ---------------------------------------------------------------------------
// /alerts — Trading Alert Management
// ---------------------------------------------------------------------------
'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Bell, Plus, Trash2, Power, PowerOff,
  TrendingUp, TrendingDown, AlertTriangle, Newspaper,
  Activity, Zap, Shield,
} from 'lucide-react';
import { cn, formatUsd } from '@/lib/utils';
import {
  fetchAlerts, createAlert, deleteAlert, disableAlert, enableAlert,
  type AlertData,
} from '@/lib/api';
import { useTradingStore } from '@/lib/store';
import Link from 'next/link';

const ALERT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  price: { label: 'Price', icon: TrendingUp, color: 'text-green-400' },
  signal: { label: 'Signal', icon: Zap, color: 'text-amber-400' },
  drawdown: { label: 'Drawdown', icon: AlertTriangle, color: 'text-red-400' },
  volatility: { label: 'Volatility', icon: Activity, color: 'text-purple-400' },
  news: { label: 'News', icon: Newspaper, color: 'text-blue-400' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400 bg-gray-500/10',
  medium: 'text-amber-400 bg-amber-500/10',
  high: 'text-orange-400 bg-orange-500/10',
  critical: 'text-red-400 bg-red-500/10',
};

const STATUS_STYLES: Record<string, string> = {
  active: 'text-green-400 bg-green-500/10',
  triggered: 'text-amber-400 bg-amber-500/10',
  expired: 'text-gray-500 bg-gray-500/10',
  disabled: 'text-gray-600 bg-gray-800/50',
};

export default function AlertsPage() {
  const activeSymbol = useTradingStore((s) => s.activeSymbol);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [formType, setFormType] = useState('price');
  const [formSymbol, setFormSymbol] = useState('');
  const [formCondition, setFormCondition] = useState('above');
  const [formThreshold, setFormThreshold] = useState('');
  const [formName, setFormName] = useState('');
  const [formPriority, setFormPriority] = useState('medium');

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetchAlerts();
      setAlerts(res.alerts);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleCreate = useCallback(async () => {
    if (!formThreshold) return;
    try {
      setError(null);
      const res = await createAlert({
        type: formType,
        symbol: formSymbol || undefined,
        condition: formType === 'price' ? formCondition : undefined,
        threshold: Number(formThreshold),
        name: formName || undefined,
        priority: formPriority,
      });
      setAlerts((prev) => [res, ...prev]);
      setShowCreate(false);
      setFormName('');
      setFormThreshold('');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [formType, formSymbol, formCondition, formThreshold, formName, formPriority]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const handleToggle = useCallback(async (alert: AlertData) => {
    try {
      if (alert.status === 'active') {
        await disableAlert(alert.id);
        setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, status: 'disabled' } : a));
      } else if (alert.status === 'disabled') {
        await enableAlert(alert.id);
        setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, status: 'active' } : a));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const triggeredCount = alerts.filter((a) => a.status === 'triggered').length;

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Nav bar */}
      <nav className="h-12 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        <Link href="/sven" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sven AI</Link>
        <Link href="/backtest" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Backtest</Link>
        <Link href="/analytics" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Analytics</Link>
        <span className="text-sm text-brand-400 font-semibold">Alerts</span>
        <Link href="/credentials" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Credentials</Link>
        <Link href="/brokers" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Brokers</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Bell className="w-7 h-7 text-brand-400" />
            Trading Alerts
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              {activeCount} active · {triggeredCount} triggered
            </span>
            <button
              onClick={() => { setShowCreate(!showCreate); setFormSymbol(activeSymbol); }}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" />
              New Alert
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Create Alert Form */}
        {showCreate && (
          <div className="mb-6 rounded-lg bg-surface-muted border border-gray-800/50 p-6">
            <h2 className="text-sm font-semibold text-gray-300 mb-4">Create Alert</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                >
                  <option value="price">Price Alert</option>
                  <option value="signal">Signal Alert</option>
                  <option value="drawdown">Drawdown Alert</option>
                  <option value="volatility">Volatility Alert</option>
                  <option value="news">News Alert</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Symbol</label>
                <input
                  type="text"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value)}
                  placeholder="BTC/USDT"
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                />
              </div>
              {formType === 'price' && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Condition</label>
                  <select
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                  >
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                    <option value="crosses_above">Crosses Above</option>
                    <option value="crosses_below">Crosses Below</option>
                    <option value="pct_change">% Change</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  {formType === 'price' ? 'Price' : formType === 'signal' ? 'Min Confidence' : formType === 'drawdown' ? 'Max DD %' : 'Threshold'}
                </label>
                <input
                  type="number"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  placeholder={formType === 'signal' ? '0.7' : formType === 'drawdown' ? '10' : '50000'}
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Priority</label>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My custom alert"
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreate}
                className="px-5 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-all"
              >
                Create
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-5 py-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Alert List */}
        {loading ? (
          <div className="text-center text-gray-500 py-12">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16">
            <Bell className="w-12 h-12 text-gray-700 mx-auto mb-4" />
            <p className="text-gray-500">No alerts configured yet</p>
            <p className="text-xs text-gray-600 mt-1">Create price, signal, or drawdown alerts to get notified</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const typeConf = ALERT_TYPE_CONFIG[alert.type] ?? { label: alert.type, icon: Bell, color: 'text-gray-400' };
              const TypeIcon = typeConf.icon;
              return (
                <div
                  key={alert.id}
                  className={cn(
                    'rounded-lg border p-4 flex items-center gap-4 transition-colors',
                    alert.status === 'disabled' ? 'bg-gray-900/30 border-gray-800/30' : 'bg-surface-muted border-gray-800/50',
                  )}
                >
                  <TypeIcon className={cn('w-5 h-5 shrink-0', typeConf.color)} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('text-sm font-semibold', alert.status === 'disabled' ? 'text-gray-600' : 'text-gray-100')}>
                        {alert.name}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_STYLES[alert.status] ?? STATUS_STYLES.active)}>
                        {alert.status}
                      </span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[alert.priority] ?? PRIORITY_COLORS.medium)}>
                        {alert.priority}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-3">
                      {alert.symbol && <span className="font-mono">{alert.symbol}</span>}
                      <span>{alert.condition} {alert.threshold}</span>
                      <span>Triggered: {alert.triggerCount}×</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggle(alert)}
                      className="p-2 rounded-md hover:bg-gray-800 transition-colors"
                      title={alert.status === 'active' ? 'Disable' : 'Enable'}
                      aria-label={alert.status === 'active' ? 'Disable alert' : 'Enable alert'}
                    >
                      {alert.status === 'active'
                        ? <Power className="w-4 h-4 text-green-400" />
                        : <PowerOff className="w-4 h-4 text-gray-600" />}
                    </button>
                    <button
                      onClick={() => handleDelete(alert.id)}
                      className="p-2 rounded-md hover:bg-red-500/10 transition-colors"
                      title="Delete alert"
                      aria-label="Delete alert"
                    >
                      <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
