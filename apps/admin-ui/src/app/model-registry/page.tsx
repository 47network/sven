'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useModels, useCreateModel } from '@/lib/hooks';
import { Boxes, Plus, TestTube2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type ModelRow = {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  enabled: boolean;
  is_primary: boolean;
  max_tokens: number | null;
  base_url: string;
  cost_per_1k_tokens?: number | null;
};

function toModelRows(value: unknown): ModelRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? 'Unnamed model'),
      provider: String(item.provider ?? 'unknown'),
      model_id: String(item.model_id ?? ''),
      enabled: Boolean(item.enabled),
      is_primary: Boolean(item.is_primary),
      max_tokens: typeof item.max_tokens === 'number' ? item.max_tokens : null,
      base_url: String(item.base_url ?? ''),
      cost_per_1k_tokens: typeof item.cost_per_1k_tokens === 'number' ? item.cost_per_1k_tokens : null,
    }));
}

export default function ModelRegistryPage() {
  const { data, isLoading } = useModels();
  const createModel = useCreateModel();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    provider: '',
    model_id: '',
    base_url: '',
    api_key: '',
    max_tokens: 4096,
    temperature: 0.7,
    cost_per_1k_tokens: 0,
  });

  if (isLoading) return <PageSpinner />;

  const rows = toModelRows(data?.rows);

  function handleCreate() {
    createModel.mutate(form, {
      onSuccess: () => {
        toast.success('Model registered');
        setForm({ name: '', provider: '', model_id: '', base_url: '', api_key: '', max_tokens: 4096, temperature: 0.7, cost_per_1k_tokens: 0 });
        setShowAdd(false);
      },
      onError: () => toast.error('Failed to register model'),
    });
  }

  return (
    <>
      <PageHeader title="Model Registry" description="Register, test, and manage LLM model configurations">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Register Model
        </button>
      </PageHeader>

      {showAdd && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-medium">Register New Model</h3>
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
              <label className="mb-1 block text-sm font-medium">Max Tokens</label>
              <input type="number" className="input w-full" value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Temperature</label>
              <input type="number" step="0.1" className="input w-full" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Cost per 1K Tokens (USD)</label>
              <input type="number" step="0.000001" className="input w-full" value={form.cost_per_1k_tokens} onChange={(e) => setForm({ ...form, cost_per_1k_tokens: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={createModel.isPending}>Save</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="No models registered" description="Register an LLM model to enable inference." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((m) => (
            <div key={m.id} className="card py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{m.provider} / {m.model_id}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={m.enabled ? 'badge-success' : 'badge-neutral'}>{m.enabled ? 'active' : 'disabled'}</span>
                    {m.is_primary && <span className="badge-info">primary</span>}
                    {m.max_tokens && <span className="badge-neutral">{m.max_tokens} tokens</span>}
                    {m.cost_per_1k_tokens !== null && m.cost_per_1k_tokens !== undefined && (
                      <span className="badge-neutral">${m.cost_per_1k_tokens}/1k</span>
                    )}
                  </div>
                </div>
                <button className="btn-ghost btn-sm" title="Test model">
                  <TestTube2 className="h-4 w-4" />
                </button>
              </div>
              {m.base_url && (
                <p className="mt-2 text-xs text-slate-400 font-mono truncate">{m.base_url}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
