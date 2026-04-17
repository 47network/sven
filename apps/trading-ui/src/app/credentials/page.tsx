// ---------------------------------------------------------------------------
// /credentials — Exchange API Key Management
// ---------------------------------------------------------------------------
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Plus, Trash2, ShieldCheck, ShieldAlert,
  RefreshCw, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchExchangeCredentials,
  addExchangeCredential,
  revokeExchangeCredential,
  type ExchangeCredentialData,
} from '@/lib/api';
import Link from 'next/link';

const BROKER_OPTIONS = [
  { value: 'ccxt_binance', label: 'Binance' },
  { value: 'ccxt_bybit', label: 'Bybit' },
  { value: 'alpaca', label: 'Alpaca' },
];

function brokerLabel(broker: string): string {
  return BROKER_OPTIONS.find((b) => b.value === broker)?.label ?? broker;
}

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<ExchangeCredentialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Form state
  const [broker, setBroker] = useState('ccxt_binance');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label, setLabel] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchExchangeCredentials();
      setCredentials(res.data ?? []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  const handleAdd = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    setSaving(true);
    try {
      await addExchangeCredential({
        broker,
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        isPaper,
        label: label.trim() || undefined,
      });
      setApiKey('');
      setApiSecret('');
      setLabel('');
      setShowForm(false);
      await loadCredentials();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this credential? This cannot be undone.')) return;
    setRevoking(id);
    try {
      await revokeExchangeCredential(id);
      await loadCredentials();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface text-gray-100">
      {/* Nav bar */}
      <nav className="h-12 border-b border-gray-800/60 bg-surface/90 backdrop-blur-sm flex items-center px-4 gap-4">
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Dashboard</Link>
        <Link href="/sven" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Sven AI</Link>
        <Link href="/backtest" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Backtest</Link>
        <Link href="/analytics" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Analytics</Link>
        <Link href="/alerts" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Alerts</Link>
        <span className="text-sm text-brand-400 font-semibold">Credentials</span>
        <Link href="/brokers" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">Brokers</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-brand-400" />
            Exchange Credentials
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCredentials}
              className="px-3 py-2 rounded-md border border-gray-700 text-sm text-gray-300 hover:text-gray-100 hover:border-gray-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 rounded-md bg-brand-500 hover:bg-brand-600 text-sm font-medium text-white flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Key
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-900/30 border border-red-800/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mb-8 p-6 rounded-lg bg-surface-muted border border-gray-800/50">
            <h2 className="text-lg font-semibold mb-4">Add Exchange Key</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Exchange</label>
                <select
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                >
                  {BROKER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Label (optional)</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Main Trading"
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Key</label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 font-mono focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">API Secret</label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="Enter API secret"
                    className="w-full bg-surface border border-gray-700 rounded-md px-3 py-2 pr-10 text-sm text-gray-100 font-mono focus:outline-none focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPaper}
                  onChange={(e) => setIsPaper(e.target.checked)}
                  className="rounded border-gray-600 bg-surface accent-brand-400"
                />
                Paper / Testnet mode
              </label>
              {!isPaper && (
                <span className="text-xs font-semibold text-red-400 bg-red-900/30 px-2 py-0.5 rounded">
                  REAL MONEY
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleAdd}
                disabled={saving || !apiKey.trim() || !apiSecret.trim()}
                className={cn(
                  'px-5 py-2 rounded-md text-sm font-medium transition-colors',
                  saving || !apiKey.trim() || !apiSecret.trim()
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-brand-500 hover:bg-brand-600 text-white',
                )}
              >
                {saving ? 'Saving…' : 'Save Credential'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-md text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Credentials list */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading credentials…</div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-12">
            <KeyRound className="w-12 h-12 mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500">No exchange credentials configured</p>
            <p className="text-gray-600 text-sm mt-1">Add Binance, Bybit, or Alpaca API keys to start trading</p>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => {
              const isRevoked = cred.status === 'revoked';
              return (
                <div
                  key={cred.id}
                  className={cn(
                    'p-4 rounded-lg border flex items-center gap-4',
                    isRevoked
                      ? 'bg-surface-muted/50 border-red-900/30'
                      : 'bg-surface-muted border-gray-800/50',
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    isRevoked ? 'bg-red-900/20' : 'bg-brand-400/10',
                  )}>
                    {isRevoked
                      ? <ShieldAlert className="w-5 h-5 text-red-400" />
                      : <ShieldCheck className="w-5 h-5 text-brand-400" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{brokerLabel(cred.broker)}</span>
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded',
                        cred.is_paper
                          ? 'bg-blue-900/30 text-blue-400'
                          : 'bg-orange-900/30 text-orange-400',
                      )}>
                        {cred.is_paper ? 'PAPER' : 'LIVE'}
                      </span>
                      {isRevoked && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-900/30 text-red-400">
                          REVOKED
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">
                      {cred.api_key_masked}
                      {cred.label && <span className="text-gray-600 ml-2">• {cred.label}</span>}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-xs text-gray-600">
                    {new Date(cred.created_at).toLocaleDateString()}
                  </div>

                  {/* Revoke button */}
                  {!isRevoked && (
                    <button
                      onClick={() => handleRevoke(cred.id)}
                      disabled={revoking === cred.id}
                      className="p-2 rounded-md text-red-400/60 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title="Revoke"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
