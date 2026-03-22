'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useBulkDeleteMemories,
  useDeleteMemory,
  useExportMemories,
  useImportMemories,
  useMemory,
  useMemoryDetail,
  useMemoryStats,
  useSemanticMemorySearch,
  useUpdateMemory,
} from '@/lib/hooks';
import { toast } from 'sonner';

const CATEGORY_OPTIONS = ['user_private', 'chat_shared', 'global', 'knowledge_graph', 'improvement_items'];

type Row = Record<string, any>;

export default function MemoriesPage() {
  const [visibility, setVisibility] = useState('');
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const [exact, setExact] = useState('');
  const [sortBy, setSortBy] = useState('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [editValue, setEditValue] = useState('');

  const list = useMemory({
    visibility: visibility || undefined,
    source: source || undefined,
    search: search || undefined,
    exact: exact || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
    page,
    per_page: perPage,
  });
  const stats = useMemoryStats();
  const detail = useMemoryDetail(selectedId || undefined);
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const bulkDelete = useBulkDeleteMemories();
  const importMemories = useImportMemories();
  const semanticSearch = useSemanticMemorySearch();
  const exportMemories = useExportMemories();

  const rows = (list.data?.data || []) as Row[];
  const meta = (list.data?.meta || {}) as { page?: number; total_pages?: number; total?: number };
  const semanticRows = (semanticSearch.data?.data || []) as Row[];

  const selectedDetail = detail.data?.data as Row | undefined;

  const activeRows = semanticRows.length > 0 ? semanticRows : rows;

  const sourceCounts = useMemo(() => {
    const bySource = (stats.data?.data?.by_source || []) as Array<{ source: string; count: number }>;
    return bySource;
  }, [stats.data]);

  if (list.isLoading || stats.isLoading) return <PageSpinner />;

  const onToggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((v) => v !== id)));
  };

  const onSaveEdit = () => {
    if (!selectedId) return;
    updateMemory.mutate(
      { id: selectedId, data: { value: editValue } },
      {
        onSuccess: () => toast.success('Memory updated'),
        onError: () => toast.error('Failed to update memory'),
      },
    );
  };

  const onDeleteSingle = (id: string) => {
    if (!confirm('Delete this memory?')) return;
    deleteMemory.mutate(id, {
      onSuccess: () => {
        toast.success('Memory deleted');
        setSelectedIds((prev) => prev.filter((x) => x !== id));
        if (selectedId === id) setSelectedId('');
      },
      onError: () => toast.error('Failed to delete memory'),
    });
  };

  const onBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} selected memories?`)) return;
    bulkDelete.mutate(selectedIds, {
      onSuccess: () => {
        toast.success(`Deleted ${selectedIds.length} memories`);
        setSelectedIds([]);
      },
      onError: () => toast.error('Bulk delete failed'),
    });
  };

  const onImportJsonFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const memories = Array.isArray(parsed?.memories) ? parsed.memories : Array.isArray(parsed) ? parsed : [];
      if (!Array.isArray(memories) || memories.length === 0) {
        toast.error('No memories array found in file');
        return;
      }
      importMemories.mutate(memories, {
        onSuccess: () => toast.success('Import completed'),
        onError: () => toast.error('Import failed'),
      });
    } catch {
      toast.error('Invalid JSON file');
    }
  };

  const onExport = (format: 'json' | 'csv') => {
    exportMemories.mutate(
      { format, params: { visibility: visibility || undefined } },
      {
        onSuccess: (text) => {
          const blob = new Blob([text], { type: format === 'csv' ? 'text/csv' : 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = format === 'csv' ? 'memories-export.csv' : 'memories-export.json';
          a.click();
          URL.revokeObjectURL(url);
        },
        onError: () => toast.error('Export failed'),
      },
    );
  };

  return (
    <>
      <PageHeader title="Memories" description="Browse, search, edit, export, import, and monitor memory health" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <section className="card xl:col-span-1">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">Category Filter</h3>
          <div className="space-y-2">
            <button className={`btn w-full justify-start ${visibility === '' ? 'btn-primary' : ''}`} onClick={() => { setVisibility(''); setSource(''); }}>All</button>
            {CATEGORY_OPTIONS.map((c) => (
              <button
                key={c}
                className={`btn w-full justify-start ${visibility === c || source === c ? 'btn-primary' : ''}`}
                onClick={() => {
                  if (c === 'user_private' || c === 'chat_shared' || c === 'global') {
                    setVisibility(c);
                    setSource('');
                  } else {
                    setVisibility('');
                    setSource(c);
                  }
                  setPage(1);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </section>

        <section className="card xl:col-span-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
            <input className="input md:col-span-2" placeholder="Full-text search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            <input className="input" placeholder="Exact match" value={exact} onChange={(e) => { setExact(e.target.value); setPage(1); }} />
            <select className="input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="updated_at">Date (updated)</option>
              <option value="created_at">Date (created)</option>
              <option value="importance">Relevance</option>
              <option value="visibility">Category</option>
            </select>
            <select className="input" value={sortDir} onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}>
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5">
            <input className="input md:col-span-3" placeholder="Semantic search query" value={semanticQuery} onChange={(e) => setSemanticQuery(e.target.value)} />
            <button
              className="btn"
              onClick={() =>
                semanticSearch.mutate(
                  { query: semanticQuery, visibility: visibility || undefined, top_k: 20 },
                  { onError: () => toast.error('Semantic search failed') },
                )
              }
              disabled={!semanticQuery.trim() || semanticSearch.isPending}
            >
              Semantic Search
            </button>
            <button className="btn" onClick={() => { setSemanticQuery(''); semanticSearch.reset(); }}>Clear Semantic</button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => onExport('json')}>Export JSON</button>
            <button className="btn" onClick={() => onExport('csv')}>Export CSV</button>
            <label className="btn cursor-pointer">
              Import JSON
              <input className="hidden" type="file" accept="application/json" onChange={(e) => onImportJsonFile(e.target.files?.[0] || null)} />
            </label>
            <button className="btn-danger" disabled={selectedIds.length === 0} onClick={onBulkDelete}>
              Bulk Delete ({selectedIds.length})
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="p-2 text-left"></th>
                  <th className="p-2 text-left">Content Preview</th>
                  <th className="p-2 text-left">Category</th>
                  <th className="p-2 text-left">Scope</th>
                  <th className="p-2 text-left">Created</th>
                  <th className="p-2 text-left">Updated</th>
                  <th className="p-2 text-left">Source</th>
                  <th className="p-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row) => {
                  const id = String(row.id || '');
                  const preview = String(row.value || '').slice(0, 80);
                  return (
                    <tr key={id} className="border-b border-slate-800/70">
                      <td className="p-2">
                        <input type="checkbox" checked={selectedIds.includes(id)} onChange={(e) => onToggleSelected(id, e.target.checked)} />
                      </td>
                      <td className="p-2">{preview}</td>
                      <td className="p-2">{String(row.visibility || row.source || '')}</td>
                      <td className="p-2">{row.chat_id ? 'chat' : row.user_id ? 'user' : 'global'}</td>
                      <td className="p-2">{String(row.created_at || '').slice(0, 19).replace('T', ' ')}</td>
                      <td className="p-2">{String(row.updated_at || '').slice(0, 19).replace('T', ' ')}</td>
                      <td className="p-2">{String(row.source || '')}</td>
                      <td className="p-2">
                        <div className="flex gap-1">
                          <button className="btn" onClick={() => { setSelectedId(id); setEditValue(String(row.value || '')); }}>View/Edit</button>
                          <button className="btn-danger" onClick={() => onDeleteSingle(id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-xs text-slate-500">Total: {meta.total || activeRows.length}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Page size</label>
              <select className="input" value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
              <span className="text-sm">{meta.page || page} / {meta.total_pages || 1}</span>
              <button className="btn" disabled={(meta.total_pages || 1) <= page} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="card xl:col-span-2">
          <h3 className="text-base font-semibold">Memory Detail</h3>
          {!selectedDetail ? (
            <p className="mt-2 text-sm text-slate-500">Select a memory row to inspect details.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-500">id: {String(selectedDetail.id || '')}</p>
              <p className="text-xs text-slate-500">key: {String(selectedDetail.key || '')}</p>
              <textarea className="input min-h-[140px]" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary" onClick={onSaveEdit} disabled={!selectedId || updateMemory.isPending}>Save</button>
                <button className="btn-danger" onClick={() => onDeleteSingle(String(selectedDetail.id || ''))}>Delete</button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h3 className="text-base font-semibold">Memory Stats</h3>
          <div className="mt-2 space-y-2 text-sm">
            <p>Total: {String(stats.data?.data?.total || 0)}</p>
            <p>Avg Importance: {Number(stats.data?.data?.avg_importance || 0).toFixed(2)}</p>
            <p>Total Accesses: {String(stats.data?.data?.total_accesses || 0)}</p>
            <div>
              <p className="font-medium">Count by Category</p>
              {((stats.data?.data?.by_visibility || []) as Array<{ visibility: string; count: number }>).map((r) => (
                <div key={r.visibility} className="flex justify-between">
                  <span>{r.visibility}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium">Storage by Category (bytes)</p>
              {((stats.data?.data?.storage_by_visibility || []) as Array<{ visibility: string; bytes: number }>).map((r) => (
                <div key={r.visibility} className="flex justify-between">
                  <span>{r.visibility}</span>
                  <span>{r.bytes}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium">Age Distribution</p>
              {((stats.data?.data?.age_distribution || []) as Array<{ bucket: string; count: number }>).map((r) => (
                <div key={r.bucket} className="flex justify-between">
                  <span>{r.bucket}</span>
                  <span>{r.count}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium">Growth (last 30d)</p>
              <p className="text-xs text-slate-500">{((stats.data?.data?.growth_over_time || []) as Array<{ day: string; count: number }>).slice(-7).map((r) => `${String(r.day).slice(5, 10)}:${r.count}`).join(' | ') || 'No data'}</p>
            </div>
            <div>
              <p className="font-medium">Most Accessed</p>
              {((stats.data?.data?.top_accessed || []) as Array<{ id: string; key: string; access_count: number }>).slice(0, 5).map((r) => (
                <div key={r.id} className="flex justify-between">
                  <span className="truncate pr-2">{r.key}</span>
                  <span>{r.access_count}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="font-medium">Source Breakdown</p>
              {sourceCounts.slice(0, 6).map((r: any) => (
                <div key={String(r.source)} className="flex justify-between">
                  <span>{String(r.source)}</span>
                  <span>{Number(r.count || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
