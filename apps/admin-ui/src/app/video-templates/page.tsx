'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useVideoTemplates,
  useCreateVideoTemplate,
  useVideoStats,
} from '@/lib/hooks';
import { toast } from 'sonner';

/* ── helpers ── */
function safe<T>(d: unknown, key: string): T { return ((d as Record<string, unknown>)?.[key] ?? []) as T; }

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3'] as const;

export default function VideoTemplatesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', aspect_ratio: '16:9', specJson: '{\n  "scenes": []\n}' });

  const templatesQ = useVideoTemplates();
  const statsQ = useVideoStats();
  const createTemplate = useCreateVideoTemplate();

  if (templatesQ.isLoading) return <PageSpinner />;

  const templates = safe<Array<Record<string, unknown>>>(templatesQ.data, 'templates');
  const stats = statsQ.data as Record<string, unknown> | undefined;
  const builtInCount = templates.filter((t) => String(t.type) === 'built-in').length;
  const customCount = templates.filter((t) => String(t.type) === 'custom').length;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Template name required'); return; }
    let spec: Record<string, unknown>;
    try { spec = JSON.parse(form.specJson); } catch { toast.error('Invalid JSON spec'); return; }
    createTemplate.mutate({ name: form.name.trim(), description: form.description.trim() || undefined, aspect_ratio: form.aspect_ratio, spec }, {
      onSuccess: () => { toast.success('Template created'); setForm({ name: '', description: '', aspect_ratio: '16:9', specJson: '{\n  "scenes": []\n}' }); setShowCreate(false); },
      onError: () => toast.error('Failed to create template'),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Video Templates" description="Built-in and custom video render templates" />
        <button className="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ New Template'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Built-in" value={String(builtInCount)} />
        <StatCard label="Custom" value={String(customCount)} />
        <StatCard label="Total Jobs" value={String(stats?.total_jobs ?? 0)} />
        <StatCard label="Completed" value={String(stats?.completed ?? 0)} valueClassName="text-emerald-400" />
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">New Custom Template</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <input className="input" placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select className="input" value={form.aspect_ratio} onChange={(e) => setForm({ ...form, aspect_ratio: e.target.value })}>
                {ASPECT_RATIOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Template Spec (JSON)</label>
              <textarea
                className="input w-full font-mono text-xs"
                rows={8}
                value={form.specJson}
                onChange={(e) => setForm({ ...form, specJson: e.target.value })}
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createTemplate.isPending}>Create Template</button>
          </form>
        </div>
      )}

      {/* template grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t, i) => {
          const isBuiltIn = String(t.type) === 'built-in';
          return (
            <div key={String(t.id ?? t.domain ?? i)} className="card p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">{String(t.name)}</h4>
                  {t.description ? <p className="text-xs text-zinc-400 mt-0.5">{String(t.description)}</p> : null}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${isBuiltIn ? 'bg-cyan-500/20 text-cyan-300' : 'bg-purple-500/20 text-purple-300'}`}>
                  {isBuiltIn ? 'Built-in' : 'Custom'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-sm text-zinc-400">
                {t.domain ? <span>Domain: <span className="text-zinc-200">{String(t.domain)}</span></span> : null}
                <span>Aspect: <span className="text-zinc-200">{String(t.aspectRatio ?? t.aspect_ratio ?? '16:9')}</span></span>
              </div>

              {!isBuiltIn && t.created_at ? (
                <p className="text-xs text-zinc-500">Created: {new Date(String(t.created_at)).toLocaleDateString()}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
