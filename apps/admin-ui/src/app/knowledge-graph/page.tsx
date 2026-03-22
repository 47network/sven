'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { useKnowledgeGraphEntities, useKnowledgeGraphRelations } from '@/lib/hooks';
import { Network } from 'lucide-react';

type EntityNode = {
  id: string;
  name: string;
  type: string;
  confidence: number;
};

type RelationEdge = {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
};

function toEntityRows(value: unknown): EntityNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === 'object' ? row as Record<string, unknown> : null))
    .filter((row): row is Record<string, unknown> => !!row)
    .map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || 'Unnamed'),
      type: String(row.type || 'unknown'),
      confidence: Number(row.confidence || 0),
    }))
    .filter((row) => row.id.length > 0);
}

function toRelationRows(value: unknown): RelationEdge[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === 'object' ? row as Record<string, unknown> : null))
    .filter((row): row is Record<string, unknown> => !!row)
    .map((row) => ({
      id: String(row.id || ''),
      source_entity_id: String(row.source_entity_id || ''),
      target_entity_id: String(row.target_entity_id || ''),
      relation_type: String(row.relation_type || 'related_to'),
      confidence: Number(row.confidence || 0),
    }))
    .filter((row) => row.id.length > 0 && row.source_entity_id && row.target_entity_id);
}

export default function KnowledgeGraphPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const entitiesQuery = useKnowledgeGraphEntities({ type: typeFilter || undefined, limit: 120, offset: 0 });
  const relationsQuery = useKnowledgeGraphRelations();

  const loading = entitiesQuery.isLoading || relationsQuery.isLoading;
  const entities = toEntityRows((entitiesQuery.data as { entities?: unknown[] } | undefined)?.entities);
  const relations = toRelationRows((relationsQuery.data as { relations?: unknown[] } | undefined)?.relations);

  const counts = useMemo(() => {
    const byType = new Map<string, number>();
    for (const e of entities) byType.set(e.type, (byType.get(e.type) || 0) + 1);
    return byType;
  }, [entities]);

  const typeOptions = useMemo(() => Array.from(new Set(entities.map((e) => e.type))).sort(), [entities]);

  const width = 1100;
  const height = 620;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.36;
  const posById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    const total = Math.max(entities.length, 1);
    entities.forEach((e, i) => {
      const angle = (2 * Math.PI * i) / total;
      map.set(e.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });
    return map;
  }, [entities, centerX, centerY, radius]);

  if (loading) return <PageSpinner />;

  return (
    <>
      <PageHeader title="Knowledge Graph" description="Graph visualization of entities and their relations" />

      {entities.length === 0 ? (
        <EmptyState icon={Network} title="No graph entities" description="Create entities or run extraction jobs to populate the graph." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="card py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Entities</p>
              <p className="mt-1 text-2xl font-semibold">{entities.length}</p>
            </div>
            <div className="card py-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Relations</p>
              <p className="mt-1 text-2xl font-semibold">{relations.length}</p>
            </div>
            <div className="card py-4">
              <label className="text-xs uppercase tracking-wide text-slate-500">Entity Type Filter</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card overflow-auto p-2">
            <svg width={width} height={height} className="mx-auto block">
              <rect x={0} y={0} width={width} height={height} fill="transparent" />

              {relations.map((r) => {
                const s = posById.get(r.source_entity_id);
                const t = posById.get(r.target_entity_id);
                if (!s || !t) return null;
                return (
                  <g key={r.id}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke="rgba(100,116,139,0.55)"
                      strokeWidth={Math.max(1, Math.min(3, 1 + r.confidence * 1.5))}
                    />
                  </g>
                );
              })}

              {entities.map((e) => {
                const p = posById.get(e.id);
                if (!p) return null;
                const fill = e.type === 'person'
                  ? '#0ea5e9'
                  : e.type === 'device'
                    ? '#22c55e'
                    : e.type === 'location'
                      ? '#f59e0b'
                      : '#a78bfa';
                return (
                  <g key={e.id}>
                    <circle cx={p.x} cy={p.y} r={8 + Math.max(0, Math.min(8, e.confidence * 6))} fill={fill} fillOpacity={0.85} />
                    <text x={p.x + 11} y={p.y - 10} fontSize={11} fill="currentColor">{e.name}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="card py-4">
            <p className="mb-2 text-sm font-medium">Entity Types</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {Array.from(counts.entries()).map(([type, count]) => (
                <span key={type} className="rounded-full border border-slate-300 px-2 py-1 dark:border-slate-700">
                  {type}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
