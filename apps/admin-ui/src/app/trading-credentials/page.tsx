// ---------------------------------------------------------------------------
// /trading-credentials — Admin Exchange Key Management
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/Skeleton';
import {
  useTradingCredentials,
  useAddTradingCredential,
  useRevokeTradingCredential,
} from '@/lib/hooks';
import { KeyRound, Plus, Trash2, ShieldCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const BROKER_OPTIONS = [
  { value: 'ccxt_binance', label: 'Binance' },
  { value: 'ccxt_bybit', label: 'Bybit' },
  { value: 'alpaca', label: 'Alpaca' },
];

function brokerLabel(b: string): string {
  return BROKER_OPTIONS.find((o) => o.value === b)?.label ?? b;
}

export default function TradingCredentialsPage() {
  const { data: rawData, isLoading } = useTradingCredentials();
  const addMutation = useAddTradingCredential();
  const revokeMutation = useRevokeTradingCredential();

  const rows = ((rawData as Record<string, unknown>)?.rows ?? []) as Array<Record<string, unknown>>;

  const [showForm, setShowForm] = useState(false);
  const [broker, setBroker] = useState('ccxt_binance');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [label, setLabel] = useState('');
  const [isPaper, setIsPaper] = useState(true);
  const [showSecret, setShowSecret] = useState(false);

  const handleAdd = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) return;
    await addMutation.mutateAsync({
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
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this credential? This cannot be undone.')) return;
    await revokeMutation.mutateAsync(id);
  };

  return (
    <>
      <PageHeader
        title="Exchange Keys"
        description="Manage API keys for connected exchanges"
      >
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Key
        </button>
      </PageHeader>

      {/* Add form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-6 mb-6">
          <h3 className="text-sm font-semibold mb-4">Add Exchange Credential</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Exchange</label>
              <select
                value={broker}
                onChange={(e) => setBroker(e.target.value)}
                className="input w-full"
              >
                {BROKER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main Trading"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter API key"
                className="input w-full font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">API Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter API secret"
                  className="input w-full font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                className="rounded"
              />
              Paper / Testnet mode
            </label>
            {!isPaper && (
              <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                REAL MONEY
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending || !apiKey.trim() || !apiSecret.trim()}
              className="btn btn-primary"
            >
              {addMutation.isPending ? 'Saving…' : 'Save Credential'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Credentials table */}
      {isLoading ? (
        <SkeletonCard />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No exchange credentials"
          description="Add Binance, Bybit, or Alpaca API keys to start trading"
        />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Exchange</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Label</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Mode</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((cred) => {
                const isRevoked = cred.status === 'revoked';
                return (
                  <tr key={String(cred.id)} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{brokerLabel(String(cred.broker))}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{String(cred.api_key_masked ?? '')}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(cred.label ?? '—')}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        cred.is_paper
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {cred.is_paper ? 'PAPER' : 'LIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isRevoked ? (
                        <ShieldAlert className="w-4 h-4 text-destructive mx-auto" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-green-500 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                      {cred.created_at ? new Date(String(cred.created_at)).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isRevoked && (
                        <button
                          onClick={() => handleRevoke(String(cred.id))}
                          disabled={revokeMutation.isPending}
                          className="p-1.5 rounded text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Revoke"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
