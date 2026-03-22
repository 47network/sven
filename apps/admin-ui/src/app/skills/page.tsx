'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useRegistryInstalled,
  useSetInstalledSkillTrust,
  useRemoveInstalledSkill,
  useRegistryCatalog,
  useInstallSkill,
  useRegistrySources,
  useCreateRegistrySource,
} from '@/lib/hooks';
import { Puzzle, Sparkles, ArrowUpRight, Trash2, Search, Download } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useMemo, useState } from 'react';

type SkillRow = {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  trust_level: 'trusted' | 'quarantined' | 'blocked';
  tool_id: string;
};

function toSkillRows(value: unknown): SkillRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? item.catalog_entry_id ?? 'Installed skill'),
      description: String(item.description ?? item.tool_id ?? 'No description'),
      version: String(item.version ?? '0.0.0'),
      enabled: Boolean(item.enabled ?? String(item.trust_level ?? '') !== 'blocked'),
      trust_level:
        String(item.trust_level ?? 'quarantined') === 'trusted'
          ? 'trusted'
          : String(item.trust_level ?? 'quarantined') === 'blocked'
            ? 'blocked'
            : 'quarantined',
      tool_id: String(item.tool_id ?? ''),
    }));
}

const SKILL_PACKS: Array<{ id: string; label: string; hints: string[] }> = [
  {
    id: 'productivity',
    label: 'Productivity',
    hints: ['obsidian', 'calendar', 'gmail', 'email', 'notion', 'trello', 'task', 'todo', 'productivity'],
  },
  {
    id: 'research-web',
    label: 'Research & Web',
    hints: ['search', 'web', 'brave', 'crawl', 'rag', 'knowledge', 'wiki', 'research'],
  },
  {
    id: 'media',
    label: 'Media',
    hints: ['spotify', 'sonos', 'shazam', 'gif', 'giphy', 'tenor', 'audio', 'image', 'video'],
  },
  {
    id: 'social-comms',
    label: 'Social & Comms',
    hints: ['x', 'twitter', 'discord', 'slack', 'telegram', 'matrix', 'chat', 'message'],
  },
];

export default function SkillsPage() {
  const { data, isLoading } = useRegistryInstalled();
  const [galleryQuery, setGalleryQuery] = useState('');
  const { data: catalogData, isLoading: catalogLoading } = useRegistryCatalog(galleryQuery.trim() || undefined);
  const { data: sourcesData } = useRegistrySources();
  const setTrust = useSetInstalledSkillTrust();
  const removeSkill = useRemoveInstalledSkill();
  const installSkill = useInstallSkill();
  const createSource = useCreateRegistrySource();

  if (isLoading || catalogLoading) return <PageSpinner />;

  const rows = toSkillRows(data?.rows);
  const catalogRows = Array.isArray((catalogData as Record<string, unknown> | undefined)?.rows)
    ? ((catalogData as Record<string, unknown>).rows as Array<Record<string, unknown>>)
    : Array.isArray((catalogData as Record<string, unknown> | undefined)?.data)
      ? ((catalogData as Record<string, unknown>).data as Array<Record<string, unknown>>)
      : [];
  const sourceRows = Array.isArray((sourcesData as Record<string, unknown> | undefined)?.rows)
    ? ((sourcesData as Record<string, unknown>).rows as Array<Record<string, unknown>>)
    : [];
  const activeCount = rows.filter((row) => row.enabled).length;
  const disabledCount = rows.length - activeCount;
  const installedByName = useMemo(() => {
    const map = new Map<string, SkillRow>();
    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      if (key) map.set(key, row);
    }
    return map;
  }, [rows]);
  const hasLocalSource = sourceRows.some(
    (row) =>
      String(row.name ?? '').trim().toLowerCase() === 'local repository skills' ||
      (String(row.type ?? '').trim().toLowerCase() === 'local' && String(row.path ?? '').trim() === 'skills'),
  );

  const packRows = useMemo(() => {
    const byPack = new Map<string, Array<Record<string, unknown>>>();
    for (const pack of SKILL_PACKS) {
      const matches = catalogRows.filter((row) => {
        const haystack = `${String(row.id ?? '')} ${String(row.name ?? '')} ${String(row.description ?? '')}`.toLowerCase();
        return pack.hints.some((hint) => haystack.includes(hint));
      });
      byPack.set(pack.id, matches);
    }
    return byPack;
  }, [catalogRows]);

  async function installCatalogBatch(targets: Array<Record<string, unknown>>, label: string) {
    if (targets.length === 0) {
      toast.info(`No skills matched ${label.toLowerCase()}`);
      return;
    }
    let installed = 0;
    let failed = 0;
    for (const row of targets) {
      const id = String(row.id ?? '').trim();
      const name = String(row.name ?? id ?? 'skill');
      if (!id) continue;
      const alreadyInstalled = installedByName.get(name.trim().toLowerCase());
      if (alreadyInstalled) continue;
      try {
        await installSkill.mutateAsync(id);
        installed += 1;
      } catch {
        failed += 1;
      }
    }
    if (failed === 0) {
      toast.success(`${label}: installed ${installed}`);
    } else {
      toast.warning(`${label}: installed ${installed}, failed ${failed}`);
    }
  }

  function addLocalGallerySource() {
    if (hasLocalSource) {
      toast.info('Built-in local skills source is already enabled');
      return;
    }
    createSource.mutate(
      {
        name: 'Local Repository Skills',
        type: 'local',
        path: 'skills',
        enabled: true,
      },
      {
        onSuccess: () => toast.success('Built-in skills gallery source enabled'),
        onError: () => toast.error('Failed to enable built-in gallery source'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Skills" description="Installed skills — enable, disable, or manage" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Runtime Capability
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Installed Skill Fleet</h2>
              <p className="mt-1 text-sm text-slate-400">
                Govern active runtime abilities with clear state and version visibility.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
              <p className="text-lg font-semibold text-cyan-300">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Active</p>
              <p className="text-lg font-semibold text-emerald-300">{activeCount}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Disabled</p>
              <p className="text-lg font-semibold text-amber-300">{disabledCount}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/registry" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Skill Registry</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/runs" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Tool Runs</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/trace-view" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Trace View</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-6 card py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Built-in Skills Gallery</h3>
            <p className="text-xs text-slate-500">Install and activate local/registry skills in one click.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SKILL_PACKS.map((pack) => {
              const targets = packRows.get(pack.id) || [];
              const installedCount = targets.filter((row) =>
                installedByName.has(String(row.name ?? row.id ?? '').trim().toLowerCase()),
              ).length;
              return (
                <button
                  key={pack.id}
                  className="btn-primary btn-sm"
                  disabled={installSkill.isPending}
                  onClick={() => void installCatalogBatch(targets, `${pack.label} pack`)}
                >
                  Install {pack.label.toLowerCase()} ({installedCount}/{targets.length})
                </button>
              );
            })}
            <button
              className="btn-secondary btn-sm"
              disabled={createSource.isPending}
              onClick={addLocalGallerySource}
            >
              {hasLocalSource ? 'Local source enabled' : 'Enable built-in local source'}
            </button>
            <Link href="/registry" className="btn-secondary btn-sm">
              Open Registry
            </Link>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input w-full pl-9"
            placeholder="Search skills gallery..."
            value={galleryQuery}
            onChange={(e) => setGalleryQuery(e.target.value)}
          />
        </div>
        {catalogRows.length === 0 ? (
          <EmptyState
            icon={Puzzle}
            title="No gallery skills available"
            description={
              hasLocalSource
                ? 'No skills found in connected sources.'
                : 'Enable the built-in local source to populate the gallery from this repo.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {catalogRows.map((row) => {
              const id = String(row.id ?? '');
              const name = String(row.name ?? id ?? 'Skill');
              const description = String(row.description ?? 'No description');
              const installed = installedByName.get(name.trim().toLowerCase());
              return (
                <div key={id || name} className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{description}</p>
                    </div>
                    <span className={installed ? 'badge-success' : 'badge-neutral'}>
                      {installed ? installed.trust_level : 'not installed'}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-primary btn-sm"
                      disabled={installSkill.isPending || Boolean(installed) || !id}
                      onClick={() =>
                        installSkill.mutate(id, {
                          onSuccess: () => toast.success(`${name} installed`),
                          onError: () => toast.error(`Failed to install ${name}`),
                        })
                      }
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      {installed ? 'Installed' : 'Install'}
                    </button>
                    <Link href="/registry" className="btn-secondary btn-sm">
                      Details
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Puzzle}
          title="No skills installed"
          description="Go to the Registry page to browse and install skills."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((sk) => (
            <div key={sk.id} className="card flex items-start justify-between py-4">
              <div>
                <p className="font-medium">{sk.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{sk.description}</p>
                <p className="mt-1 text-xs text-slate-400">v{sk.version}</p>
                {sk.tool_id && <p className="mt-1 text-xs text-slate-500">Tool: {sk.tool_id}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      setTrust.mutate(
                        { id: sk.id, trustLevel: 'trusted' },
                        {
                          onSuccess: () => toast.success('Skill marked trusted'),
                          onError: () => toast.error('Failed to update trust level'),
                        },
                      )
                    }
                    disabled={setTrust.isPending || sk.trust_level === 'trusted'}
                    className="btn-secondary btn-sm"
                  >
                    Trust
                  </button>
                  <button
                    onClick={() =>
                      setTrust.mutate(
                        { id: sk.id, trustLevel: 'quarantined' },
                        {
                          onSuccess: () => toast.success('Skill quarantined'),
                          onError: () => toast.error('Failed to update trust level'),
                        },
                      )
                    }
                    disabled={setTrust.isPending || sk.trust_level === 'quarantined'}
                    className="btn-secondary btn-sm"
                  >
                    Quarantine
                  </button>
                  <button
                    onClick={() =>
                      setTrust.mutate(
                        { id: sk.id, trustLevel: 'blocked' },
                        {
                          onSuccess: () => toast.success('Skill blocked'),
                          onError: () => toast.error('Failed to update trust level'),
                        },
                      )
                    }
                    disabled={setTrust.isPending || sk.trust_level === 'blocked'}
                    className="btn-secondary btn-sm"
                  >
                    Block
                  </button>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className={sk.enabled ? 'badge-success' : 'badge-neutral'}>
                  {sk.enabled ? sk.trust_level : 'blocked'}
                </span>
                <button
                  onClick={() => {
                    if (!window.confirm('Remove this installed skill?')) return;
                    removeSkill.mutate(sk.id, {
                      onSuccess: () => toast.success('Skill removed'),
                      onError: () => toast.error('Failed to remove skill'),
                    });
                  }}
                  disabled={removeSkill.isPending}
                  className="btn-secondary btn-sm"
                  title="Remove skill"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
