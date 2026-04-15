'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useEvolutionRun,
  useEvolutionBest,
  useStopEvolutionRun,
  useInjectEvolutionKnowledge,
} from '@/lib/hooks';
import {
  ArrowLeft,
  Dna,
  Trophy,
  Layers,
  FlaskConical,
  Brain,
  Square,
  Plus,
  Activity,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

/* ── types ── */

type EvolutionRun = {
  id: string;
  org_id?: string;
  user_id?: string;
  domain: string;
  name?: string;
  status: string;
  current_gen: number;
  best_score: number;
  total_evals: number;
  config?: Record<string, unknown>;
  experiment?: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  completed_at?: string;
};

type EvolutionNode = {
  id: string;
  run_id: string;
  generation: number;
  parent_id?: string;
  genotype?: Record<string, unknown>;
  phenotype?: Record<string, unknown>;
  fitness_score: number;
  evaluation_details?: Record<string, unknown>;
  status: string;
  created_at: string;
};

type CognitionEntry = {
  id: string;
  run_id: string;
  title: string;
  content: string;
  source?: string;
  created_at: string;
};

/* ── safe casts ── */

function toRun(d: unknown): EvolutionRun | null {
  if (!d || typeof d !== 'object') return null;
  return d as EvolutionRun;
}

function toNodes(d: unknown): EvolutionNode[] {
  if (!Array.isArray(d)) return [];
  return d as EvolutionNode[];
}

function toCognition(d: unknown): CognitionEntry[] {
  if (!Array.isArray(d)) return [];
  return d as CognitionEntry[];
}

/* ── page ── */

type Tab = 'overview' | 'nodes' | 'cognition';

export default function EvolutionRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = (params?.id ?? '') as string;

  const { data: runRes, isLoading } = useEvolutionRun(runId);
  const { data: bestRes } = useEvolutionBest(runId);
  const stopMut = useStopEvolutionRun();
  const knowledgeMut = useInjectEvolutionKnowledge();

  const [tab, setTab] = useState<Tab>('overview');
  const [knowledgeForm, setKnowledgeForm] = useState({ title: '', content: '' });
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [genFilter, setGenFilter] = useState<number | null>(null);

  if (isLoading) return <PageSpinner />;

  const run = toRun(runRes?.run);
  const nodes = toNodes(runRes?.nodes);
  const cognition = toCognition(runRes?.cognition);
  const nodeCount = runRes?.node_count ?? nodes.length;
  const cognitionCount = runRes?.cognition_count ?? cognition.length;
  const bestNode = bestRes?.best as EvolutionNode | undefined;

  if (!run) {
    return (
      <div className="text-center py-20">
        <Dna className="h-16 w-16 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400 text-lg">Run not found</p>
        <button className="btn-primary mt-4" onClick={() => router.push('/evolution')}>
          Back to Evolution
        </button>
      </div>
    );
  }

  const isActive = run.status === 'running' || run.status === 'pending';
  const elapsed = run.completed_at
    ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
    : Date.now() - new Date(run.started_at).getTime();

  /* generation list */
  const generations = new Set(nodes.map((n) => n.generation));
  const sortedGens = Array.from(generations).sort((a, b) => b - a);

  /* filtered nodes */
  const filteredNodes = genFilter != null
    ? nodes.filter((n) => n.generation === genFilter)
    : nodes;
  const sortedNodes = [...filteredNodes].sort((a, b) => b.fitness_score - a.fitness_score);

  /* ── handlers ── */

  function handleStop() {
    stopMut.mutate(run!.id, {
      onSuccess: () => toast.success('Run stopped'),
      onError: () => toast.error('Failed to stop run'),
    });
  }

  function handleInjectKnowledge() {
    if (!knowledgeForm.title.trim() || !knowledgeForm.content.trim()) {
      toast.error('Title and content required');
      return;
    }
    knowledgeMut.mutate(
      { id: runId, title: knowledgeForm.title.trim(), content: knowledgeForm.content.trim() },
      {
        onSuccess: () => {
          toast.success('Knowledge injected');
          setKnowledgeForm({ title: '', content: '' });
        },
        onError: () => toast.error('Failed to inject knowledge'),
      },
    );
  }

  return (
    <>
      <PageHeader
        title={run.name || run.domain || `Run ${run.id.slice(0, 8)}`}
        description={`Domain: ${run.domain} · Status: ${run.status}`}
      >
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => router.push('/evolution')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {isActive && (
            <button
              className="btn-danger flex items-center gap-2"
              onClick={handleStop}
              disabled={stopMut.isPending}
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          )}
        </div>
      </PageHeader>

      {/* stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Status"
          value={
            <span className={`inline-flex items-center gap-1.5 ${
              isActive ? 'text-blue-400' :
              run.status === 'completed' ? 'text-green-400' :
              run.status === 'error' ? 'text-red-400' :
              'text-yellow-400'
            }`}>
              {isActive && <Activity className="h-4 w-4 animate-pulse" />}
              {run.status}
            </span>
          }
          icon={Dna}
        />
        <StatCard label="Generation" value={run.current_gen} icon={Layers} />
        <StatCard label="Best Score" value={run.best_score?.toFixed(4) ?? '—'} icon={Trophy} />
        <StatCard label="Evaluations" value={run.total_evals} icon={FlaskConical} />
        <StatCard
          label="Duration"
          value={`${Math.round(elapsed / 60000)}m`}
          icon={Clock}
        />
      </div>

      {/* tab bar */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {([
          { key: 'overview' as Tab, label: 'Overview' },
          { key: 'nodes' as Tab, label: `Nodes (${nodeCount})` },
          { key: 'cognition' as Tab, label: `Cognition (${cognitionCount})` },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* best candidate */}
          {bestNode && (
            <div className="card border-l-4 border-l-brand-400">
              <h3 className="text-lg font-semibold text-brand-400 flex items-center gap-2 mb-3">
                <Trophy className="h-5 w-5" />
                Best Candidate
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-xs text-slate-400">Fitness Score</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">
                    {bestNode.fitness_score?.toFixed(4)}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-xs text-slate-400">Generation</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{bestNode.generation}</div>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-xs text-slate-400">Status</div>
                  <div className="text-lg font-bold text-slate-100 mt-1">{bestNode.status}</div>
                </div>
                <div className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-xs text-slate-400">Node ID</div>
                  <div className="text-sm font-mono text-slate-100 mt-1 truncate">{bestNode.id}</div>
                </div>
              </div>
              {bestNode.phenotype && (
                <details className="mt-2">
                  <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                    Phenotype Details
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-800/50 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                    {JSON.stringify(bestNode.phenotype, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* run configuration */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Configuration</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {run.config && Object.entries(run.config).map(([key, val]) => (
                <div key={key} className="rounded-lg bg-slate-800/50 p-3">
                  <div className="text-xs text-slate-400">{key.replace(/_/g, ' ')}</div>
                  <div className="text-slate-100 mt-1 font-mono">{String(val)}</div>
                </div>
              ))}
            </div>
            {run.experiment && (
              <details className="mt-4">
                <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-300">
                  Experiment Definition
                </summary>
                <pre className="mt-2 p-3 bg-slate-800/50 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
                  {JSON.stringify(run.experiment, null, 2)}
                </pre>
              </details>
            )}
          </div>

          {/* generation progress */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Generation Progress</h3>
            {sortedGens.length === 0 ? (
              <p className="text-slate-400 text-sm">No generations yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedGens.slice(0, 10).map((gen) => {
                  const genNodes = nodes.filter((n) => n.generation === gen);
                  const maxScore = Math.max(...genNodes.map((n) => n.fitness_score));
                  const avgScore = genNodes.reduce((s, n) => s + n.fitness_score, 0) / genNodes.length;
                  const pct = run.best_score > 0 ? (maxScore / run.best_score) * 100 : 0;
                  return (
                    <div key={gen}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300">Gen {gen}</span>
                        <span className="text-slate-400">
                          Best: {maxScore.toFixed(3)} · Avg: {avgScore.toFixed(3)} · {genNodes.length} nodes
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {sortedGens.length > 10 && (
                  <p className="text-xs text-slate-500 mt-2">
                    + {sortedGens.length - 10} more generations
                  </p>
                )}
              </div>
            )}
          </div>

          {/* inject knowledge */}
          {isActive && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-3 flex items-center gap-2">
                <Brain className="h-5 w-5 text-brand-400" />
                Inject Knowledge
              </h3>
              <p className="text-sm text-slate-400 mb-3">
                Feed domain knowledge into the active run to guide evolution.
              </p>
              <div className="space-y-3">
                <input
                  className="input w-full"
                  value={knowledgeForm.title}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                  placeholder="Knowledge title"
                />
                <textarea
                  className="input w-full h-24"
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                  placeholder="Knowledge content — domain insights, constraints, heuristics…"
                />
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={knowledgeMut.isPending}
                  onClick={handleInjectKnowledge}
                >
                  <Plus className="h-4 w-4" />
                  {knowledgeMut.isPending ? 'Injecting…' : 'Inject'}
                </button>
              </div>
            </div>
          )}

          {/* timestamps */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Started</span>
                <span className="text-slate-200">{new Date(run.started_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Updated</span>
                <span className="text-slate-200">{new Date(run.updated_at).toLocaleString()}</span>
              </div>
              {run.completed_at && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed</span>
                  <span className="text-slate-200">{new Date(run.completed_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Nodes (Generation Tree) ── */}
      {tab === 'nodes' && (
        <div className="space-y-4">
          {/* gen filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setGenFilter(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                genFilter === null
                  ? 'bg-brand-500/20 text-brand-400 border border-brand-400/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
              }`}
            >
              All ({nodeCount})
            </button>
            {sortedGens.map((gen) => (
              <button
                key={gen}
                onClick={() => setGenFilter(gen)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  genFilter === gen
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-400/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                }`}
              >
                Gen {gen} ({nodes.filter((n) => n.generation === gen).length})
              </button>
            ))}
          </div>

          {/* node list */}
          {sortedNodes.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-slate-400">No nodes in this generation.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedNodes.map((node, i) => {
                const isBest = bestNode && node.id === bestNode.id;
                return (
                  <div
                    key={node.id}
                    className={`card transition-all ${isBest ? 'ring-1 ring-brand-400/50' : ''}`}
                  >
                    <button
                      className="w-full flex items-center justify-between text-left"
                      onClick={() => setExpandedNode(expandedNode === node.id ? null : node.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-bold text-slate-500 w-6 text-right">
                          #{i + 1}
                        </span>
                        {isBest && <Trophy className="h-4 w-4 text-brand-400 flex-shrink-0" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-slate-200">
                              {node.id.slice(0, 12)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              node.status === 'evaluated' ? 'bg-green-500/20 text-green-400' :
                              node.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-600/50 text-slate-400'
                            }`}>
                              {node.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>Gen {node.generation}</span>
                            <span>Score: {node.fitness_score?.toFixed(4) ?? '—'}</span>
                            {node.parent_id && (
                              <span>Parent: {node.parent_id.slice(0, 8)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform flex-shrink-0 ${
                        expandedNode === node.id ? 'rotate-90' : ''
                      }`} />
                    </button>
                    {expandedNode === node.id && (
                      <div className="mt-3 pt-3 border-t border-slate-700 space-y-3">
                        {node.genotype && (
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Genotype</div>
                            <pre className="p-2 bg-slate-800/50 rounded text-xs font-mono text-slate-300 overflow-x-auto">
                              {JSON.stringify(node.genotype, null, 2)}
                            </pre>
                          </div>
                        )}
                        {node.phenotype && (
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Phenotype</div>
                            <pre className="p-2 bg-slate-800/50 rounded text-xs font-mono text-slate-300 overflow-x-auto">
                              {JSON.stringify(node.phenotype, null, 2)}
                            </pre>
                          </div>
                        )}
                        {node.evaluation_details && (
                          <div>
                            <div className="text-xs text-slate-400 mb-1">Evaluation Details</div>
                            <pre className="p-2 bg-slate-800/50 rounded text-xs font-mono text-slate-300 overflow-x-auto">
                              {JSON.stringify(node.evaluation_details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Cognition (Analysis Logs) ── */}
      {tab === 'cognition' && (
        <div className="space-y-4">
          {cognition.length === 0 ? (
            <div className="card text-center py-8">
              <Brain className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No cognition entries yet.</p>
              {isActive && (
                <p className="text-sm text-slate-500 mt-2">
                  Knowledge will appear here as the run progresses, or you can inject knowledge manually.
                </p>
              )}
            </div>
          ) : (
            cognition.map((c) => (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">{c.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      {c.source && <span className="font-mono">{c.source}</span>}
                      <span>{new Date(c.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap mt-2">{c.content}</p>
              </div>
            ))
          )}

          {/* inject knowledge inline */}
          {isActive && (
            <div className="card border-t-2 border-t-brand-400/50">
              <h4 className="text-sm font-semibold text-slate-100 mb-3">Inject Knowledge</h4>
              <div className="space-y-3">
                <input
                  className="input w-full"
                  value={knowledgeForm.title}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                  placeholder="Knowledge title"
                />
                <textarea
                  className="input w-full h-24"
                  value={knowledgeForm.content}
                  onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                  placeholder="Domain knowledge, constraints, insights…"
                />
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={knowledgeMut.isPending}
                  onClick={handleInjectKnowledge}
                >
                  <Plus className="h-4 w-4" />
                  {knowledgeMut.isPending ? 'Injecting…' : 'Inject'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
