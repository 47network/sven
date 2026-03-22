'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useRagCollections, useRagSources, useRagJobs, useTriggerRagIndex } from '@/lib/hooks';
import { Database, RefreshCw, FileText, Zap } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'collections' | 'sources' | 'jobs';

type CollectionRow = {
  id: string;
  name: string;
  document_count: number;
  chunk_count: number;
};

type SourceRow = {
  id: string;
  name: string;
  type: string;
  path: string;
  url: string;
  enabled: boolean;
};

type JobRow = {
  id: string;
  collection_name: string;
  collection_id: string;
  status: string;
  document_count: number | null;
  started_at: string;
  duration_ms: number | null;
};

function toRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null);
}

export default function RagPage() {
  const [tab, setTab] = useState<Tab>('collections');
  const { data: collections, isLoading: cLoading } = useRagCollections();
  const { data: sources, isLoading: sLoading } = useRagSources();
  const { data: jobs, isLoading: jLoading } = useRagJobs();
  const triggerIndex = useTriggerRagIndex();

  const isLoading = cLoading || sLoading || jLoading;
  if (isLoading) return <PageSpinner />;

  function handleReindex(collectionId: string) {
    triggerIndex.mutate(collectionId, {
      onSuccess: () => toast.success('Indexing started'),
      onError: () => toast.error('Failed to trigger indexing'),
    });
  }

  const collectionRows: CollectionRow[] = toRows(collections?.rows).map((row) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Unnamed collection'),
    document_count: Number(row.document_count ?? 0),
    chunk_count: Number(row.chunk_count ?? 0),
  }));

  const sourceRows: SourceRow[] = toRows(sources?.rows).map((row) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Unnamed source'),
    type: String(row.type ?? 'unknown'),
    path: String(row.path ?? ''),
    url: String(row.url ?? ''),
    enabled: Boolean(row.enabled),
  }));

  const jobRows: JobRow[] = toRows(jobs?.rows).map((row) => ({
    id: String(row.id ?? ''),
    collection_name: String(row.collection_name ?? ''),
    collection_id: String(row.collection_id ?? ''),
    status: String(row.status ?? 'unknown'),
    document_count: typeof row.document_count === 'number' ? row.document_count : null,
    started_at: String(row.started_at ?? ''),
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
  }));

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'collections', label: 'Collections', count: collectionRows.length },
    { key: 'sources', label: 'Sources', count: sourceRows.length },
    { key: 'jobs', label: 'Jobs', count: jobRows.length },
  ];

  return (
    <>
      <PageHeader title="RAG" description="Collections, document sources, and indexing jobs" />

      <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((t) => (
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

      {tab === 'collections' && (
        <>
          {collectionRows.length === 0 ? (
            <EmptyState icon={Database} title="No collections" description="Create a RAG collection to start indexing documents." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collectionRows.map((col) => (
                <div key={col.id} className="card py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{col.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{col.document_count ?? 0} documents</p>
                      <p className="text-xs text-slate-400">{col.chunk_count ?? 0} chunks</p>
                    </div>
                    <button
                      onClick={() => handleReindex(col.id)}
                      disabled={triggerIndex.isPending}
                      className="btn-secondary btn-sm flex items-center gap-1"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Reindex
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
          {sourceRows.length === 0 ? (
            <EmptyState icon={FileText} title="No sources" description="Add document sources to feed into collections." />
          ) : (
            <div className="space-y-3">
              {sourceRows.map((src) => (
                <div key={src.id} className="card flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{src.name}</p>
                    <p className="text-xs text-slate-500">{src.type} &middot; {src.path || src.url}</p>
                  </div>
                  <span className={src.enabled ? 'badge-success' : 'badge-neutral'}>
                    {src.enabled ? 'active' : 'disabled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'jobs' && (
        <>
          {jobRows.length === 0 ? (
            <EmptyState icon={Zap} title="No jobs" description="Indexing jobs will appear here when triggered." />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Collection</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Documents</th>
                    <th className="px-4 py-3 text-left font-medium">Started</th>
                    <th className="px-4 py-3 text-left font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobRows.map((j) => (
                    <tr key={j.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium">{j.collection_name || j.collection_id.slice(0, 8)}</td>
                      <td className="px-4 py-3">
                        <span className={j.status === 'completed' ? 'badge-success' : j.status === 'running' ? 'badge-warning' : 'badge-danger'}>
                          {j.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{j.document_count ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{j.started_at ? new Date(j.started_at).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{j.duration_ms ? `${j.duration_ms}ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
