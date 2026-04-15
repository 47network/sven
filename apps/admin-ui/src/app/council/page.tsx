'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useCouncilConfig,
  useUpdateCouncilConfig,
  useCouncilSessions,
  useCouncilSession,
  useCouncilDeliberate,
} from '@/lib/hooks';
import {
  Users,
  Settings,
  BarChart3,
  Play,
  Zap,
  Clock,
  DollarSign,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/* ── types ── */

type CouncilConfig = {
  council_mode?: boolean;
  council_models?: string[];
  council_chairman?: string;
  council_strategy?: string;
  council_rounds?: number;
};

type CouncilSession = {
  id: string;
  userId: string;
  query: string;
  config: Record<string, unknown>;
  status: string;
  synthesisPreview?: string;
  totalTokens?: { prompt: number; completion: number };
  totalCost?: number;
  elapsedMs?: number;
  createdAt: string;
  completedAt?: string;
};

type SessionDetail = CouncilSession & {
  synthesis?: string;
  opinions?: Array<{ model: string; response: string; tokensUsed?: number; latencyMs?: number }>;
  peerReviews?: Array<{ reviewer: string; reviewed: string; score: number; feedback: string }>;
  scores?: Record<string, number>;
};

/* ── safe casts ── */

function toConfig(d: unknown): CouncilConfig {
  if (!d || typeof d !== 'object') return {};
  return d as CouncilConfig;
}

function toSessions(d: unknown): CouncilSession[] {
  if (!Array.isArray(d)) return [];
  return d as CouncilSession[];
}

function toSessionDetail(d: unknown): SessionDetail | null {
  if (!d || typeof d !== 'object') return null;
  return d as SessionDetail;
}

/* ── strategies ── */

const STRATEGIES = [
  { value: 'best_of_n', label: 'Best of N', description: 'Pick the highest-scored response' },
  { value: 'majority_vote', label: 'Majority Vote', description: 'Consensus-based selection' },
  { value: 'debate', label: 'Debate', description: 'Models argue positions, chairman synthesises' },
  { value: 'weighted', label: 'Weighted', description: 'Score-weighted blend of all responses' },
] as const;

/* ── page ── */

type Tab = 'config' | 'sessions' | 'analytics';

export default function CouncilPage() {
  const { data: configRes, isLoading: configLoading } = useCouncilConfig();
  const { data: sessionsRes, isLoading: sessionsLoading } = useCouncilSessions({ limit: 50 });
  const updateConfigMut = useUpdateCouncilConfig();
  const deliberateMut = useCouncilDeliberate();

  const [tab, setTab] = useState<Tab>('config');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  /* config form state */
  const [configForm, setConfigForm] = useState<{
    enabled: boolean;
    models: string;
    chairman: string;
    strategy: string;
    rounds: number;
    dirty: boolean;
  } | null>(null);

  /* deliberate form */
  const [deliberateQuery, setDeliberateQuery] = useState('');

  if (configLoading || sessionsLoading) return <PageSpinner />;

  const config = toConfig(configRes?.config);
  const sessions = toSessions(sessionsRes?.sessions);
  const total = (sessionsRes as Record<string, unknown>)?.total as number || 0;

  /* init form from server config on first render */
  if (!configForm && config) {
    const c = config;
    setConfigForm({
      enabled: c.council_mode ?? false,
      models: (c.council_models ?? []).join(', '),
      chairman: c.council_chairman ?? '',
      strategy: c.council_strategy ?? 'debate',
      rounds: c.council_rounds ?? 2,
      dirty: false,
    });
  }

  /* ── analytics aggregation ── */
  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const failedSessions = sessions.filter((s) => s.status === 'error');
  const totalCost = completedSessions.reduce((sum, s) => sum + (s.totalCost ?? 0), 0);
  const avgLatency = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((sum, s) => sum + (s.elapsedMs ?? 0), 0) / completedSessions.length)
    : 0;
  const totalTokens = completedSessions.reduce(
    (acc, s) => ({
      prompt: acc.prompt + (s.totalTokens?.prompt ?? 0),
      completion: acc.completion + (s.totalTokens?.completion ?? 0),
    }),
    { prompt: 0, completion: 0 },
  );

  /* model usage frequency */
  const modelUsage: Record<string, number> = {};
  for (const s of completedSessions) {
    const cfg = s.config as Record<string, unknown>;
    const models = cfg?.models as string[] | undefined;
    if (models) {
      for (const m of models) {
        modelUsage[m] = (modelUsage[m] ?? 0) + 1;
      }
    }
  }
  const modelUsageSorted = Object.entries(modelUsage).sort((a, b) => b[1] - a[1]);

  /* strategy usage */
  const strategyUsage: Record<string, number> = {};
  for (const s of completedSessions) {
    const cfg = s.config as Record<string, unknown>;
    const strat = cfg?.strategy as string | undefined;
    if (strat) strategyUsage[strat] = (strategyUsage[strat] ?? 0) + 1;
  }

  /* ── handlers ── */

  function handleSaveConfig() {
    if (!configForm) return;
    const models = configForm.models
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    updateConfigMut.mutate(
      {
        enabled: configForm.enabled,
        models: models.length > 0 ? models : undefined,
        chairman: configForm.chairman || undefined,
        strategy: configForm.strategy || undefined,
        rounds: configForm.rounds,
      },
      {
        onSuccess: () => {
          toast.success('Council configuration saved');
          setConfigForm((f) => f && { ...f, dirty: false });
        },
        onError: () => toast.error('Failed to save configuration'),
      },
    );
  }

  function handleDeliberate() {
    if (!deliberateQuery.trim()) {
      toast.error('Enter a query for the council');
      return;
    }
    deliberateMut.mutate(
      { query: deliberateQuery.trim() },
      {
        onSuccess: (res) => {
          toast.success(`Council session started: ${res.sessionId}`);
          setDeliberateQuery('');
          setTab('sessions');
        },
        onError: () => toast.error('Failed to start deliberation'),
      },
    );
  }

  return (
    <>
      <PageHeader title="LLM Council" description="Multi-model deliberation with peer review and synthesis">
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => setTab('config')}
        >
          <Settings className="h-4 w-4" />
          Configure
        </button>
      </PageHeader>

      {/* stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Sessions" value={total} icon={MessageSquare} />
        <StatCard label="Success Rate" value={total > 0 ? `${Math.round((completedSessions.length / total) * 100)}%` : '—'} icon={CheckCircle} />
        <StatCard label="Avg Latency" value={avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'} icon={Clock} />
        <StatCard label="Total Cost" value={`$${totalCost.toFixed(4)}`} icon={DollarSign} />
      </div>

      {/* tab bar */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {([
          { key: 'config' as Tab, label: 'Configuration' },
          { key: 'sessions' as Tab, label: 'Sessions' },
          { key: 'analytics' as Tab, label: 'Analytics' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSelectedSessionId(null); }}
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

      {/* ── Tab: Configuration (A.4.3) ── */}
      {tab === 'config' && configForm && (
        <div className="space-y-6">
          {/* enabled toggle */}
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Council Mode</h3>
                <p className="text-sm text-slate-400 mt-1">
                  When enabled, queries are deliberated by multiple models instead of a single model.
                </p>
              </div>
              <button
                onClick={() => setConfigForm({ ...configForm, enabled: !configForm.enabled, dirty: true })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  configForm.enabled ? 'bg-brand-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    configForm.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* strategy */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Deliberation Strategy</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {STRATEGIES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setConfigForm({ ...configForm, strategy: s.value, dirty: true })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    configForm.strategy === s.value
                      ? 'border-brand-400 bg-brand-500/10'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                >
                  <div className="font-medium text-slate-200">{s.label}</div>
                  <div className="text-sm text-slate-400 mt-1">{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* models + chairman + rounds */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Model Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Models (comma-separated)
                </label>
                <input
                  className="input w-full"
                  value={configForm.models}
                  onChange={(e) => setConfigForm({ ...configForm, models: e.target.value, dirty: true })}
                  placeholder="gpt-4o, claude-3-5-sonnet, qwen3-coder-30b"
                />
                <p className="text-xs text-slate-500 mt-1">
                  These models participate in every council deliberation.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Chairman Model</label>
                  <input
                    className="input w-full"
                    value={configForm.chairman}
                    onChange={(e) => setConfigForm({ ...configForm, chairman: e.target.value, dirty: true })}
                    placeholder="gpt-4o (synthesises final answer)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Deliberation Rounds
                  </label>
                  <input
                    className="input w-full"
                    type="number"
                    min={1}
                    max={5}
                    value={configForm.rounds}
                    onChange={(e) => setConfigForm({ ...configForm, rounds: Number(e.target.value) || 1, dirty: true })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* save */}
          <div className="flex justify-end gap-3">
            <button
              className="btn-primary"
              disabled={!configForm.dirty || updateConfigMut.isPending}
              onClick={handleSaveConfig}
            >
              {updateConfigMut.isPending ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>

          {/* quick deliberation */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Quick Deliberation</h3>
            <p className="text-sm text-slate-400 mb-3">
              Start a council deliberation with the current configuration.
            </p>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                value={deliberateQuery}
                onChange={(e) => setDeliberateQuery(e.target.value)}
                placeholder="Enter a query for the council to deliberate…"
                onKeyDown={(e) => e.key === 'Enter' && handleDeliberate()}
              />
              <button
                className="btn-primary flex items-center gap-2"
                disabled={deliberateMut.isPending}
                onClick={handleDeliberate}
              >
                <Play className="h-4 w-4" />
                {deliberateMut.isPending ? 'Starting…' : 'Deliberate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Sessions ── */}
      {tab === 'sessions' && !selectedSessionId && (
        <div className="card">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Deliberation Sessions</h3>
          {sessions.length === 0 ? (
            <p className="text-slate-400 text-sm">No council sessions yet. Start a deliberation above.</p>
          ) : (
            <div className="divide-y divide-slate-700">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  className="w-full flex items-center justify-between py-3 px-2 hover:bg-slate-800/50 rounded transition-colors text-left"
                  onClick={() => setSelectedSessionId(s.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${
                        s.status === 'completed' ? 'bg-green-400' :
                        s.status === 'error' ? 'bg-red-400' :
                        s.status === 'pending' ? 'bg-yellow-400' :
                        'bg-blue-400'
                      }`} />
                      <span className="text-sm font-medium text-slate-200 truncate">{s.query}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                      <span>{s.status}</span>
                      {s.elapsedMs != null && <span>{(s.elapsedMs / 1000).toFixed(1)}s</span>}
                      {s.totalCost != null && <span>${s.totalCost.toFixed(4)}</span>}
                      <span>{new Date(s.createdAt).toLocaleString()}</span>
                    </div>
                    {s.synthesisPreview && (
                      <p className="text-xs text-slate-400 mt-1 truncate">{s.synthesisPreview}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Session Detail ── */}
      {tab === 'sessions' && selectedSessionId && (
        <SessionDetailView
          sessionId={selectedSessionId}
          onBack={() => setSelectedSessionId(null)}
        />
      )}

      {/* ── Tab: Analytics (A.4.4) ── */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {/* token usage */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Token Usage</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div className="text-sm text-slate-400">Prompt Tokens</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {totalTokens.prompt.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div className="text-sm text-slate-400">Completion Tokens</div>
                <div className="text-2xl font-bold text-slate-100 mt-1">
                  {totalTokens.completion.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg bg-slate-800/50 p-4">
                <div className="text-sm text-slate-400">Total Tokens</div>
                <div className="text-2xl font-bold text-brand-400 mt-1">
                  {(totalTokens.prompt + totalTokens.completion).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* model performance */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Model Usage</h3>
            {modelUsageSorted.length === 0 ? (
              <p className="text-slate-400 text-sm">No completed sessions to analyse.</p>
            ) : (
              <div className="space-y-3">
                {modelUsageSorted.map(([model, count]) => {
                  const maxCount = modelUsageSorted[0][1];
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={model}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-200 font-mono">{model}</span>
                        <span className="text-slate-400">{count} session{count !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* strategy breakdown */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Strategy Breakdown</h3>
            {Object.keys(strategyUsage).length === 0 ? (
              <p className="text-slate-400 text-sm">No data yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(strategyUsage).map(([strategy, count]) => (
                  <div key={strategy} className="rounded-lg bg-slate-800/50 p-3 text-center">
                    <div className="text-lg font-bold text-slate-100">{count}</div>
                    <div className="text-xs text-slate-400 mt-1 capitalize">{strategy.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* session outcomes */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Session Outcomes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-4">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-slate-100">{completedSessions.length}</div>
                  <div className="text-sm text-slate-400">Completed</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-4">
                <XCircle className="h-8 w-8 text-red-400" />
                <div>
                  <div className="text-2xl font-bold text-slate-100">{failedSessions.length}</div>
                  <div className="text-sm text-slate-400">Failed</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-slate-800/50 p-4">
                <Zap className="h-8 w-8 text-yellow-400" />
                <div>
                  <div className="text-2xl font-bold text-slate-100">
                    {sessions.filter((s) => s.status === 'pending' || s.status === 'in_progress').length}
                  </div>
                  <div className="text-sm text-slate-400">In Progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* cost timeline */}
          <div className="card">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Cost per Session</h3>
            {completedSessions.length === 0 ? (
              <p className="text-slate-400 text-sm">No cost data available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Query</th>
                      <th className="pb-2 pr-4">Latency</th>
                      <th className="pb-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {completedSessions.slice(0, 20).map((s) => (
                      <tr key={s.id} className="text-slate-300">
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-2 pr-4 truncate max-w-xs">{s.query}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {s.elapsedMs != null ? `${(s.elapsedMs / 1000).toFixed(1)}s` : '—'}
                        </td>
                        <td className="py-2 text-right font-mono">
                          ${(s.totalCost ?? 0).toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Session Detail Component ── */

function SessionDetailView({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const { data: detailRes, isLoading } = useCouncilSession(sessionId);
  const [opinionsExpanded, setOpinionsExpanded] = useState(true);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);

  if (isLoading) return <PageSpinner />;

  const detail = toSessionDetail(detailRes);
  if (!detail) return <p className="text-slate-400">Session not found.</p>;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-400 hover:text-brand-400 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to sessions
      </button>

      {/* header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{detail.query}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                detail.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                detail.status === 'error' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {detail.status}
              </span>
              {detail.elapsedMs != null && <span>{(detail.elapsedMs / 1000).toFixed(1)}s</span>}
              {detail.totalCost != null && <span>${detail.totalCost.toFixed(4)}</span>}
              <span>{new Date(detail.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* synthesis */}
      {detail.synthesis && (
        <div className="card">
          <h4 className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-3">
            Council Synthesis
          </h4>
          <div className="text-slate-200 whitespace-pre-wrap text-sm leading-relaxed">
            {detail.synthesis}
          </div>
        </div>
      )}

      {/* scores */}
      {detail.scores && Object.keys(detail.scores).length > 0 && (
        <div className="card">
          <h4 className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-3">
            Model Scores
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(detail.scores)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([model, score]) => (
                <div key={model} className="rounded-lg bg-slate-800/50 p-3 text-center">
                  <div className="text-lg font-bold text-slate-100">{(score as number).toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-1 font-mono truncate">{model}</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* opinions */}
      {detail.opinions && detail.opinions.length > 0 && (
        <div className="card">
          <button
            onClick={() => setOpinionsExpanded(!opinionsExpanded)}
            className="w-full flex items-center justify-between"
          >
            <h4 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">
              Individual Opinions ({detail.opinions.length})
            </h4>
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${opinionsExpanded ? 'rotate-90' : ''}`} />
          </button>
          {opinionsExpanded && (
            <div className="mt-4 space-y-4">
              {detail.opinions.map((op, i) => (
                <div key={i} className="rounded-lg bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-200 font-mono">{op.model}</span>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      {op.tokensUsed != null && <span>{op.tokensUsed.toLocaleString()} tokens</span>}
                      {op.latencyMs != null && <span>{(op.latencyMs / 1000).toFixed(1)}s</span>}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{op.response}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* peer reviews */}
      {detail.peerReviews && detail.peerReviews.length > 0 && (
        <div className="card">
          <button
            onClick={() => setReviewsExpanded(!reviewsExpanded)}
            className="w-full flex items-center justify-between"
          >
            <h4 className="text-sm font-semibold text-brand-400 uppercase tracking-wider">
              Peer Reviews ({detail.peerReviews.length})
            </h4>
            <ChevronRight className={`h-4 w-4 text-slate-400 transition-transform ${reviewsExpanded ? 'rotate-90' : ''}`} />
          </button>
          {reviewsExpanded && (
            <div className="mt-4 space-y-3">
              {detail.peerReviews.map((pr, i) => (
                <div key={i} className="rounded-lg bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-300">
                      <span className="font-mono text-slate-200">{pr.reviewer}</span>
                      {' → '}
                      <span className="font-mono text-slate-200">{pr.reviewed}</span>
                    </span>
                    <span className={`text-sm font-bold ${
                      pr.score >= 8 ? 'text-green-400' :
                      pr.score >= 5 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {pr.score}/10
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{pr.feedback}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
