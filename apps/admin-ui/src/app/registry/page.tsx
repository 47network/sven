'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useRegistrySources,
  useRegistryCatalog,
  useRegistryQuarantine,
  useInstallSkill,
  usePromoteSkill,
  useCreateRegistrySource,
  useDeleteRegistrySource,
} from '@/lib/hooks';
import { Package, Download, ShieldCheck, AlertTriangle, Search, Sparkles, ArrowUpRight, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

type Tab = 'catalog' | 'sources' | 'quarantine';
type Row = Record<string, unknown>;

function rows(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  if (Array.isArray(rec.rows)) {
    return rec.rows.filter((v): v is Row => typeof v === 'object' && v !== null);
  }
  if (Array.isArray(rec.data)) {
    return rec.data.filter((v): v is Row => typeof v === 'object' && v !== null);
  }
  return [];
}

function s(row: Row, key: string, fallback = ''): string {
  const v = row[key];
  return typeof v === 'string' ? v : fallback;
}

export default function RegistryPage() {
  const [tab, setTab] = useState<Tab>('catalog');
  const [search, setSearch] = useState('');
  const { data: catalog, isLoading: catLoading } = useRegistryCatalog(search.trim() || undefined);
  const { data: sources, isLoading: srcLoading } = useRegistrySources();
  const { data: quarantine, isLoading: qLoading } = useRegistryQuarantine();
  const installSkill = useInstallSkill();
  const promoteSkill = usePromoteSkill();
  const createSource = useCreateRegistrySource();
  const deleteSource = useDeleteRegistrySource();
  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'public' as 'public' | 'private' | 'local',
    url: '',
    path: '',
  });
  const catalogRows = rows(catalog);
  const sourceRows = rows(sources);
  const quarantineRows = rows(quarantine);

  const isLoading = catLoading || srcLoading || qLoading;
  if (isLoading) return <PageSpinner />;

  function handleInstall(id: string) {
    installSkill.mutate(id, {
      onSuccess: () => toast.success('Skill installed'),
      onError: () => toast.error('Install failed'),
    });
  }

  function handlePromote(id: string) {
    const reviewReason = window.prompt('Enter review reason for trusted promotion');
    if (reviewReason === null) return;
    const normalizedReason = reviewReason.trim();
    if (!normalizedReason) {
      toast.error('Review reason is required');
      return;
    }
    promoteSkill.mutate({ id, reviewReason: normalizedReason }, {
      onSuccess: () => toast.success('Skill promoted from quarantine'),
      onError: () => toast.error('Promote failed'),
    });
  }

  function handleCreateSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sourceForm.name.trim()) {
      toast.error('Source name is required');
      return;
    }

    const payload: {
      name: string;
      type: 'public' | 'private' | 'local';
      url?: string;
      path?: string;
      enabled: boolean;
    } = {
      name: sourceForm.name.trim(),
      type: sourceForm.type,
      enabled: true,
    };

    if (sourceForm.type === 'local') {
      if (!sourceForm.path.trim()) {
        toast.error('Local sources require a filesystem path');
        return;
      }
      payload.path = sourceForm.path.trim();
    } else {
      if (!sourceForm.url.trim()) {
        toast.error('Remote sources require a URL');
        return;
      }
      payload.url = sourceForm.url.trim();
    }

    createSource.mutate(payload, {
      onSuccess: () => {
        toast.success('Source created');
        setSourceForm({ name: '', type: 'public', url: '', path: '' });
      },
      onError: () => toast.error('Failed to create source'),
    });
  }

  function handleDeleteSource(id: string) {
    if (!window.confirm('Delete this source?')) return;
    deleteSource.mutate(id, {
      onSuccess: () => toast.success('Source deleted'),
      onError: () => toast.error('Failed to delete source'),
    });
  }

  function handleInstallLocalSourcePreset() {
    const presetName = 'Local Repository Skills';
    const presetPath = 'skills';
    const exists = sourceRows.some((row) => s(row, 'name').trim().toLowerCase() === presetName.toLowerCase());
    if (exists) {
      toast.info('Local skills source preset already exists');
      return;
    }
    createSource.mutate(
      {
        name: presetName,
        type: 'local',
        path: presetPath,
        enabled: true,
      },
      {
        onSuccess: () => toast.success('Local skills source preset added'),
        onError: () => toast.error('Failed to add local skills source preset'),
      },
    );
  }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'catalog', label: 'Catalog', count: catalogRows.length },
    { key: 'sources', label: 'Sources', count: sourceRows.length },
    { key: 'quarantine', label: 'Quarantine', count: quarantineRows.length },
  ];

  return (
    <>
      <PageHeader title="Registry" description="Sources, skill catalog, quarantine, and promotion" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Capability Supply
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Skill Registry Hub</h2>
              <p className="mt-1 text-sm text-slate-400">
                Curate installable skills, validate sources, and promote quarantined packages.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Catalog</p>
              <p className="text-lg font-semibold text-cyan-300">{catalogRows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Sources</p>
              <p className="text-lg font-semibold text-emerald-300">{sourceRows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Quarantine</p>
              <p className="text-lg font-semibold text-amber-300">{quarantineRows.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/skills" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Installed Skills</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/policy-simulator" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Policy Sim</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/trace-view" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Trace View</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white shadow-sm dark:bg-slate-700'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Search catalog</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by skill name..."
                className="input w-full pl-9"
              />
            </div>
          </div>
          {catalogRows.length === 0 ? (
            <EmptyState icon={Package} title="Empty catalog" description="No skills available in registered sources." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {catalogRows.map((sk) => (
                <div key={s(sk, 'id', crypto.randomUUID())} className="card py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{s(sk, 'name', 'skill')}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{s(sk, 'description', '—')}</p>
                    </div>
                    <button
                      onClick={() => s(sk, 'id') && handleInstall(s(sk, 'id'))}
                      disabled={installSkill.isPending}
                      className="btn-primary btn-sm flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" /> Install
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'sources' && (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-semibold">Quick Presets</p>
              <p className="text-xs text-slate-500">Bootstrap local installable skills from repository path <code>skills</code>.</p>
            </div>
            <button className="btn-secondary btn-sm" onClick={handleInstallLocalSourcePreset} disabled={createSource.isPending}>
              Add local source preset
            </button>
          </div>

          <form onSubmit={handleCreateSource} className="card mb-4 space-y-3 py-4">
            <p className="text-sm font-semibold">Add Source</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                className="input"
                placeholder="Source name"
                value={sourceForm.name}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <select
                className="input"
                value={sourceForm.type}
                onChange={(e) =>
                  setSourceForm((prev) => ({
                    ...prev,
                    type: e.target.value as 'public' | 'private' | 'local',
                  }))
                }
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="local">Local</option>
              </select>
            </div>
            {sourceForm.type === 'local' ? (
              <input
                className="input"
                placeholder="/opt/sven/skills"
                value={sourceForm.path}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, path: e.target.value }))}
              />
            ) : (
              <input
                className="input"
                placeholder="https://registry.example.com"
                value={sourceForm.url}
                onChange={(e) => setSourceForm((prev) => ({ ...prev, url: e.target.value }))}
              />
            )}
            <div className="flex justify-end">
              <button type="submit" disabled={createSource.isPending} className="btn-primary btn-sm">
                Add Source
              </button>
            </div>
          </form>

          {sourceRows.length === 0 ? (
            <EmptyState icon={Package} title="No sources" description="Add a registry source to discover skills." />
          ) : (
            <div className="space-y-3">
              {sourceRows.map((src) => (
                <div key={s(src, 'id', crypto.randomUUID())} className="card flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{s(src, 'name', 'source')}</p>
                    <p className="text-xs text-slate-500">{s(src, 'url', '—')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={src.healthy ? 'badge-success' : 'badge-danger'}>
                      {src.healthy ? 'reachable' : 'unreachable'}
                    </span>
                    <button
                      onClick={() => s(src, 'id') && handleDeleteSource(s(src, 'id'))}
                      disabled={deleteSource.isPending}
                      className="btn-secondary btn-sm"
                      title="Delete source"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'quarantine' && (
        <>
          {quarantineRows.length === 0 ? (
            <EmptyState icon={AlertTriangle} title="Quarantine empty" description="No skills are quarantined." />
          ) : (
            <div className="space-y-3">
              {quarantineRows.map((sk) => (
                <div key={s(sk, 'id', crypto.randomUUID())} className="card flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{s(sk, 'name', 'skill')}</p>
                    <p className="text-xs text-slate-500">{s(sk, 'reason', 'Awaiting review')}</p>
                  </div>
                  <button
                    onClick={() => {
                      const promoteId = s(sk, 'skill_id') || s(sk, 'id');
                      if (promoteId) handlePromote(promoteId);
                    }}
                    disabled={promoteSkill.isPending}
                    className="btn-primary btn-sm flex items-center gap-1"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Promote
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
