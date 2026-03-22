'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useModels,
  useModelPolicies,
  useModelRollouts,
  useModelUsage,
  useCreateModel,
  useSetting,
  useSetSetting,
  useLiteLLMKeys,
  useCreateLiteLLMKey,
  useDeleteLiteLLMKey,
} from '@/lib/hooks';
import { Cpu, Plus, DollarSign, Route } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Tab = 'providers' | 'routing' | 'budgets';
type ModelRow = {
  id: string;
  name?: string;
  provider?: string;
  model_id?: string;
  enabled?: boolean;
  is_primary?: boolean;
};
type PolicyRow = {
  id: string;
  name?: string;
  strategy?: string;
  model_ids?: unknown[];
  enabled?: boolean;
};
type BudgetRow = {
  id: string;
  name?: string;
  spent?: number;
  limit?: number;
};
type UsageRow = {
  model_id: string;
  name?: string;
  total_cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  calls?: number;
};
type LiteKeyRow = {
  id: string;
  user_id?: string;
  agent_id?: string;
  key_alias?: string;
  key_last4?: string;
  max_daily_budget_usd?: number;
  last_used_at?: string;
};

type ProviderRotation = 'round_robin' | 'random' | 'least_recently_used';

function mapRows<T>(rows: unknown, mapper: (r: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map(mapper)
    .filter((r): r is T => r !== null);
}

export default function LlmPage() {
  const [tab, setTab] = useState<Tab>('providers');
  const { data: models, isLoading: mLoading } = useModels();
  const { data: policies, isLoading: pLoading } = useModelPolicies();
  const { data: rollouts, isLoading: rLoading } = useModelRollouts();
  const { data: usage, isLoading: uLoading } = useModelUsage(1);
  const { data: liteKeys, isLoading: kLoading } = useLiteLLMKeys();
  const createLiteKey = useCreateLiteLLMKey();
  const deleteLiteKey = useDeleteLiteLLMKey();
  const liteEnabled = useSetting('llm.litellm.enabled');
  const liteUrl = useSetting('llm.litellm.url');
  const liteApiKey = useSetting('llm.litellm.api_key');
  const liteUseKeys = useSetting('llm.litellm.use_virtual_keys');
  const [providerKeyProvider, setProviderKeyProvider] = useState('openai');
  const providerKeysSetting = useSetting(`llm.providerKeys.${providerKeyProvider}`);
  const providerRotationSetting = useSetting(`llm.providerKeyRotation.${providerKeyProvider}`);
  const setSetting = useSetSetting();
  const createModel = useCreateModel();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', provider: '', model_id: '', base_url: '', api_key: '' });
  const [liteEnabledValue, setLiteEnabledValue] = useState(false);
  const [liteUrlValue, setLiteUrlValue] = useState('http://litellm:4000');
  const [liteApiKeyValue, setLiteApiKeyValue] = useState('');
  const [liteUseKeysValue, setLiteUseKeysValue] = useState(false);
  const [keyForm, setKeyForm] = useState({
    user_id: '',
    agent_id: '',
    key_alias: '',
    virtual_key: '',
    max_daily_budget_usd: '',
  });
  const [providerKeyInput, setProviderKeyInput] = useState('');
  const [providerKeysDraft, setProviderKeysDraft] = useState<string[]>([]);
  const [providerRotationDraft, setProviderRotationDraft] = useState<ProviderRotation>('round_robin');

  useEffect(() => {
    const value = liteEnabled.data?.value;
    if (typeof value === 'boolean') setLiteEnabledValue(value);
    if (typeof value === 'string') setLiteEnabledValue(['true', '1', 'yes', 'on'].includes(value.toLowerCase()));
  }, [liteEnabled.data?.value]);

  useEffect(() => {
    const value = liteUrl.data?.value;
    if (typeof value === 'string' && value.trim().length > 0) {
      setLiteUrlValue(value);
    }
  }, [liteUrl.data?.value]);

  useEffect(() => {
    const value = liteApiKey.data?.value;
    if (typeof value === 'string') setLiteApiKeyValue(value);
  }, [liteApiKey.data?.value]);

  useEffect(() => {
    const value = liteUseKeys.data?.value;
    if (typeof value === 'boolean') setLiteUseKeysValue(value);
    if (typeof value === 'string') setLiteUseKeysValue(['true', '1', 'yes', 'on'].includes(value.toLowerCase()));
  }, [liteUseKeys.data?.value]);

  useEffect(() => {
    const raw = providerKeysSetting.data?.value;
    const parse = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        return value.map((v) => String(v || '').trim()).filter((v) => v.length > 0);
      }
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v || '').trim()).filter((v) => v.length > 0);
          }
        } catch {
          return [];
        }
      }
      return [];
    };
    setProviderKeysDraft(parse(raw));
  }, [providerKeysSetting.data?.value, providerKeyProvider]);

  useEffect(() => {
    const raw = String(providerRotationSetting.data?.value || '').trim().toLowerCase();
    if (raw === 'random' || raw === 'least_recently_used' || raw === 'round_robin') {
      setProviderRotationDraft(raw as ProviderRotation);
      return;
    }
    setProviderRotationDraft('round_robin');
  }, [providerRotationSetting.data?.value, providerKeyProvider]);

  const isLoading = mLoading || pLoading || rLoading || uLoading || kLoading
    || liteEnabled.isLoading || liteUrl.isLoading || liteApiKey.isLoading || liteUseKeys.isLoading;
  if (isLoading) return <PageSpinner />;

  const modelRows = mapRows<ModelRow>(models?.rows, (m) => {
    if (typeof m.id !== 'string') return null;
    return {
      id: m.id,
      name: typeof m.name === 'string' ? m.name : undefined,
      provider: typeof m.provider === 'string' ? m.provider : undefined,
      model_id: typeof m.model_id === 'string' ? m.model_id : undefined,
      enabled: Boolean(m.enabled),
      is_primary: Boolean(m.is_primary),
    };
  });
  const policyRows = mapRows<PolicyRow>(policies?.rows, (p) => {
    if (typeof p.id !== 'string') return null;
    return {
      id: p.id,
      name: typeof p.name === 'string' ? p.name : undefined,
      strategy: typeof p.strategy === 'string' ? p.strategy : undefined,
      model_ids: Array.isArray(p.model_ids) ? p.model_ids : [],
      enabled: Boolean(p.enabled),
    };
  });
  const budgetRows = mapRows<BudgetRow>(rollouts?.rows, (b) => {
    if (typeof b.id !== 'string') return null;
    return {
      id: b.id,
      name: typeof b.name === 'string' ? b.name : undefined,
      spent: typeof b.spent === 'number' ? b.spent : 0,
      limit: typeof b.limit === 'number' ? b.limit : undefined,
    };
  });
  const usageRows = mapRows<UsageRow>((usage as any)?.rows || (usage as any)?.data, (u) => {
    if (typeof u.model_id !== 'string') return null;
    return {
      model_id: u.model_id,
      name: typeof u.name === 'string' ? u.name : undefined,
      total_cost: typeof u.total_cost === 'number' ? u.total_cost : 0,
      prompt_tokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : 0,
      completion_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : 0,
      calls: typeof u.calls === 'number' ? u.calls : 0,
    };
  });
  const liteKeyRows = mapRows<LiteKeyRow>((liteKeys as any)?.rows || (liteKeys as any)?.data, (k) => {
    if (typeof k.id !== 'string') return null;
    return {
      id: k.id,
      user_id: typeof k.user_id === 'string' ? k.user_id : undefined,
      agent_id: typeof k.agent_id === 'string' ? k.agent_id : undefined,
      key_alias: typeof k.key_alias === 'string' ? k.key_alias : undefined,
      key_last4: typeof k.key_last4 === 'string' ? k.key_last4 : undefined,
      max_daily_budget_usd: typeof k.max_daily_budget_usd === 'number' ? k.max_daily_budget_usd : undefined,
      last_used_at: typeof k.last_used_at === 'string' ? k.last_used_at : undefined,
    };
  });

  function handleCreate() {
    createModel.mutate(form, {
      onSuccess: () => {
        toast.success('Model added');
        setForm({ name: '', provider: '', model_id: '', base_url: '', api_key: '' });
        setShowAdd(false);
      },
      onError: () => toast.error('Failed to add model'),
    });
  }

  async function saveLiteLLMSettings() {
    try {
      await setSetting.mutateAsync({ key: 'llm.litellm.enabled', value: liteEnabledValue });
      await setSetting.mutateAsync({ key: 'llm.litellm.url', value: liteUrlValue.trim() || 'http://litellm:4000' });
      await setSetting.mutateAsync({ key: 'llm.litellm.api_key', value: liteApiKeyValue.trim() });
      await setSetting.mutateAsync({ key: 'llm.litellm.use_virtual_keys', value: liteUseKeysValue });
      toast.success('LiteLLM settings saved');
    } catch {
      toast.error('Failed to save LiteLLM settings');
    }
  }

  function handleCreateKey() {
    if (keyForm.user_id.trim() && keyForm.agent_id.trim()) {
      toast.error('Choose either user ID or agent ID');
      return;
    }
    const payload: Record<string, unknown> = {
      key_alias: keyForm.key_alias.trim() || null,
      virtual_key: keyForm.virtual_key.trim(),
      max_daily_budget_usd: keyForm.max_daily_budget_usd ? Number(keyForm.max_daily_budget_usd) : null,
    };
    if (keyForm.user_id.trim()) payload.user_id = keyForm.user_id.trim();
    if (keyForm.agent_id.trim()) payload.agent_id = keyForm.agent_id.trim();

    createLiteKey.mutate(payload, {
      onSuccess: () => {
        toast.success('LiteLLM key saved');
        setKeyForm({ user_id: '', agent_id: '', key_alias: '', virtual_key: '', max_daily_budget_usd: '' });
      },
      onError: () => toast.error('Failed to save LiteLLM key'),
    });
  }

  async function saveProviderKeys() {
    try {
      await setSetting.mutateAsync({
        key: `llm.providerKeys.${providerKeyProvider}`,
        value: providerKeysDraft,
      });
      await setSetting.mutateAsync({
        key: `llm.providerKeyRotation.${providerKeyProvider}`,
        value: providerRotationDraft,
      });
      toast.success(`Saved ${providerKeyProvider} provider keys`);
    } catch {
      toast.error('Failed to save provider keys');
    }
  }

  function addProviderKey() {
    const value = providerKeyInput.trim();
    if (!value) return;
    if (providerKeysDraft.includes(value)) {
      toast.error('Key already added');
      return;
    }
    setProviderKeysDraft((prev) => [...prev, value]);
    setProviderKeyInput('');
  }

  function removeProviderKey(index: number) {
    setProviderKeysDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function rotateProviderKeysNow() {
    if (providerKeysDraft.length < 2) return;
    setProviderKeysDraft((prev) => [...prev.slice(1), prev[0]]);
  }

  function maskKey(value: string): string {
    if (!value) return '';
    if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  }

  return (
    <>
      <PageHeader title="LLM" description="Providers, routing policies, and budgets">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add Provider
        </button>
      </PageHeader>

      {showAdd && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-medium">New Provider</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Display Name</label>
              <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Provider</label>
              <select className="input w-full" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                <option value="">Select…</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="ollama">Ollama</option>
                <option value="vllm">vLLM</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Model ID</label>
              <input className="input w-full" value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} placeholder="gpt-4o" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Base URL</label>
              <input className="input w-full" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">API Key</label>
              <input type="password" className="input w-full" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={createModel.isPending}>Save</button>
          </div>
        </div>
      )}

      <div className="card mb-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">LiteLLM Proxy</h3>
            <p className="text-sm text-slate-500">
              Route model traffic through LiteLLM for provider aggregation, fallback routing, and budget controls.
            </p>
          </div>
          <span className={liteEnabledValue ? 'badge-success' : 'badge-neutral'}>
            {liteEnabledValue ? 'enabled' : 'disabled'}
          </span>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={liteEnabledValue}
            onChange={(e) => setLiteEnabledValue(e.target.checked)}
          />
          <span className="text-sm">Enable LiteLLM routing</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={liteUseKeysValue}
            onChange={(e) => setLiteUseKeysValue(e.target.checked)}
          />
          <span className="text-sm">Use virtual keys for per-user/agent budgets</span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">LiteLLM Base URL</label>
            <input
              className="input w-full"
              value={liteUrlValue}
              onChange={(e) => setLiteUrlValue(e.target.value)}
              placeholder="http://litellm:4000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">LiteLLM Master Key</label>
            <input
              type="password"
              className="input w-full"
              value={liteApiKeyValue}
              onChange={(e) => setLiteApiKeyValue(e.target.value)}
              placeholder="sk-litellm-..."
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={saveLiteLLMSettings} disabled={setSetting.isPending}>
            {setSetting.isPending ? 'Saving...' : 'Save LiteLLM Settings'}
          </button>
        </div>
      </div>

      <div className="card mb-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">Provider API Key Pools</h3>
            <p className="text-sm text-slate-500">
              Configure multiple API keys per provider and select key-rotation behavior.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Provider</label>
            <select
              className="input w-full"
              value={providerKeyProvider}
              onChange={(e) => setProviderKeyProvider(e.target.value)}
            >
              <option value="openai">openai</option>
              <option value="openai-compatible">openai-compatible</option>
              <option value="anthropic">anthropic</option>
              <option value="custom">custom</option>
              <option value="vllm">vllm</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Rotation Strategy</label>
            <select
              className="input w-full"
              value={providerRotationDraft}
              onChange={(e) => setProviderRotationDraft(e.target.value as ProviderRotation)}
            >
              <option value="round_robin">round_robin</option>
              <option value="random">random</option>
              <option value="least_recently_used">least_recently_used</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="password"
            className="input w-full"
            placeholder="sk-..."
            value={providerKeyInput}
            onChange={(e) => setProviderKeyInput(e.target.value)}
          />
          <button className="btn-secondary" onClick={addProviderKey}>Add Key</button>
          <button className="btn-secondary" onClick={rotateProviderKeysNow} disabled={providerKeysDraft.length < 2}>
            Rotate Now
          </button>
        </div>

        {providerKeysDraft.length === 0 ? (
          <p className="text-sm text-slate-500">No keys configured for this provider.</p>
        ) : (
          <div className="space-y-2">
            {providerKeysDraft.map((k, idx) => (
              <div key={`${k}-${idx}`} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm">
                <span>{maskKey(k)}</span>
                <button className="btn-ghost btn-sm" onClick={() => removeProviderKey(idx)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button className="btn-primary" onClick={saveProviderKeys} disabled={setSetting.isPending}>
            {setSetting.isPending ? 'Saving...' : 'Save Provider Keys'}
          </button>
        </div>
      </div>

      <div className="card mb-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">LiteLLM Virtual Keys</h3>
            <p className="text-sm text-slate-500">
              Map per-user or per-agent LiteLLM keys for budget isolation and auditing.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">User ID (optional)</label>
            <input className="input w-full" value={keyForm.user_id} onChange={(e) => setKeyForm({ ...keyForm, user_id: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Agent ID (optional)</label>
            <input className="input w-full" value={keyForm.agent_id} onChange={(e) => setKeyForm({ ...keyForm, agent_id: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Alias</label>
            <input className="input w-full" value={keyForm.key_alias} onChange={(e) => setKeyForm({ ...keyForm, key_alias: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Virtual Key</label>
            <input type="password" className="input w-full" value={keyForm.virtual_key} onChange={(e) => setKeyForm({ ...keyForm, virtual_key: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Max Daily Budget (USD)</label>
            <input className="input w-full" value={keyForm.max_daily_budget_usd} onChange={(e) => setKeyForm({ ...keyForm, max_daily_budget_usd: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn-primary" onClick={handleCreateKey} disabled={createLiteKey.isPending}>
            {createLiteKey.isPending ? 'Saving...' : 'Add Key'}
          </button>
        </div>

        {liteKeyRows.length === 0 ? (
          <EmptyState icon={Route} title="No virtual keys" description="Add a LiteLLM key to enforce per-user or per-agent budgets." />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {liteKeyRows.map((k) => (
              <div key={k.id} className="card py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{k.key_alias || 'LiteLLM Key'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {k.user_id ? `user ${k.user_id}` : `agent ${k.agent_id}`}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {k.key_last4 && <span className="badge-neutral">••••{k.key_last4}</span>}
                      {k.max_daily_budget_usd !== undefined && <span className="badge-neutral">${k.max_daily_budget_usd}/day</span>}
                    </div>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => deleteLiteKey.mutate(k.id)}
                    disabled={deleteLiteKey.isPending}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {[
          { key: 'providers' as Tab, label: 'Providers', count: models?.rows?.length ?? 0 },
          { key: 'routing' as Tab, label: 'Routing', count: policyRows.length },
          { key: 'budgets' as Tab, label: 'Budgets', count: budgetRows.length },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white shadow-sm dark:bg-slate-700' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'providers' && (
        <>
          {modelRows.length === 0 ? (
            <EmptyState icon={Cpu} title="No providers" description="Add an LLM provider to enable AI features." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {modelRows.map((m) => (
                <div key={m.id} className="card py-4">
                  <p className="font-medium">{m.name ?? 'model'}</p>
                  <p className="text-xs text-slate-500">{m.provider ?? 'provider'} &middot; {m.model_id ?? 'id'}</p>
                  <div className="mt-2 flex gap-2">
                    <span className={m.enabled ? 'badge-success' : 'badge-neutral'}>{m.enabled ? 'active' : 'disabled'}</span>
                    {m.is_primary && <span className="badge-info">primary</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'routing' && (
        <>
          {policyRows.length === 0 ? (
            <EmptyState icon={Route} title="No routing policies" description="Configure routing policies for model selection." />
          ) : (
            <div className="space-y-3">
              {policyRows.map((p) => (
                <div key={p.id} className="card flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{p.name ?? 'policy'}</p>
                    <p className="text-xs text-slate-500">{p.strategy ?? 'strategy'} &middot; {p.model_ids?.length ?? 0} models</p>
                  </div>
                  <span className={p.enabled ? 'badge-success' : 'badge-neutral'}>{p.enabled ? 'active' : 'off'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'budgets' && (
        <>
          <div className="card mb-4">
            <h3 className="font-medium mb-3">Model Costs (24h)</h3>
            {usageRows.length === 0 ? (
              <EmptyState icon={DollarSign} title="No usage yet" description="Cost summaries will appear after LLM traffic." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {usageRows.map((u) => (
                  <div key={u.model_id} className="card py-4">
                    <p className="font-medium">{u.name ?? 'model'}</p>
                    <p className="text-xs text-slate-500">Calls: {u.calls ?? 0}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="badge-neutral">${(u.total_cost ?? 0).toFixed(4)}</span>
                      <span className="badge-neutral">{u.prompt_tokens ?? 0} prompt</span>
                      <span className="badge-neutral">{u.completion_tokens ?? 0} completion</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {budgetRows.length === 0 ? (
            <EmptyState icon={DollarSign} title="No budgets" description="Budget limits will appear here." />
          ) : (
            <div className="space-y-3">
              {budgetRows.map((b) => (
                <div key={b.id} className="card py-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{b.name ?? 'budget'}</p>
                    <span className="text-sm font-mono">{b.spent ?? 0} / {b.limit ?? '∞'}</span>
                  </div>
                  {b.limit && (
                    <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${Math.min(((b.spent ?? 0) / b.limit) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
