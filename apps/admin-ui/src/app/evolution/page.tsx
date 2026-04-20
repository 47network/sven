'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useEvolutionRuns,
  useEvolutionStats,
  useEvolutionTemplates,
  useCreateEvolutionRun,
  useStopEvolutionRun,
} from '@/lib/hooks';
import {
  Dna,
  Play,
  Square,
  Activity,
  Trophy,
  FlaskConical,
  Layers,
  ChevronRight,
  Plus,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  started_at: string;
  updated_at: string;
  completed_at?: string;
};

type EvolutionStats = {
  total_runs: number;
  active_runs: number;
  completed_runs: number;
  total_evaluations: number;
  avg_best_score: number;
};

type EvolutionTemplate = {
  id: string;
  name: string;
  domain: string;
  description: string;
  config: Record<string, unknown>;
  experiment: Record<string, unknown>;
};

/* ── safe casts ── */

function toRuns(d: unknown): EvolutionRun[] {
  if (!Array.isArray(d)) return [];
  return d as EvolutionRun[];
}

function toStats(d: unknown): EvolutionStats | null {
  if (!d || typeof d !== 'object') return null;
  return d as EvolutionStats;
}

function toTemplates(d: unknown): EvolutionTemplate[] {
  if (!Array.isArray(d)) return [];
  return d as EvolutionTemplate[];
}

/* ── page ── */

type Tab = 'runs' | 'create';

export default function EvolutionPage() {
  const { data: runsRes, isLoading: runsLoading } = useEvolutionRuns({ limit: 50 });
  const { data: statsRes, isLoading: statsLoading } = useEvolutionStats();
  const { data: templateRes } = useEvolutionTemplates();
  const createMut = useCreateEvolutionRun();
  const stopMut = useStopEvolutionRun();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('runs');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  /* create wizard state */
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardForm, setWizardForm] = useState({
    template: '',
    domain: '',
    name: '',
    populationSize: 10,
    maxGenerations: 20,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    elitismCount: 2,
    fitnessThreshold: 0.95,
    customExperiment: '',
  });

  if (runsLoading || statsLoading) return <PageSpinner />;

  const runs = toRuns(runsRes?.runs);
  const stats = toStats(statsRes?.stats);
  const templates = toTemplates(templateRes?.templates);
  const total = (runsRes as Record<string, unknown>)?.total as number || 0;

  const filteredRuns = statusFilter === 'all'
    ? runs
    : runs.filter((r) => r.status === statusFilter);

  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'pending');
  const bestScore = runs.reduce((max, r) => Math.max(max, r.best_score ?? 0), 0);

  /* ── handlers ── */

  function handleStop(runId: string) {
    stopMut.mutate(runId, {
      onSuccess: () => toast.success('Run stopped'),
      onError: () => toast.error('Failed to stop run'),
    });
  }

  function handleCreateFromTemplate(tmpl: EvolutionTemplate) {
    setWizardForm({
      ...wizardForm,
      template: tmpl.id,
      domain: tmpl.domain,
      name: tmpl.name,
    });
    setWizardStep(2);
    setTab('create');
  }

  function handleCreateRun() {
    const config: Record<string, unknown> = {
      population_size: wizardForm.populationSize,
      max_generations: wizardForm.maxGenerations,
      mutation_rate: wizardForm.mutationRate,
      crossover_rate: wizardForm.crossoverRate,
      elitism_count: wizardForm.elitismCount,
      fitness_threshold: wizardForm.fitnessThreshold,
    };

    let experiment: Record<string, unknown> | undefined;
    if (wizardForm.customExperiment.trim()) {
      try {
        experiment = JSON.parse(wizardForm.customExperiment);
      } catch {
        toast.error('Invalid JSON in experiment definition');
        return;
      }
    }

    createMut.mutate(
      {
        domain: wizardForm.domain || undefined,
        config,
        experiment,
      },
      {
        onSuccess: (res) => {
          toast.success(`Evolution run created: ${res.run_id}`);
          setTab('runs');
          setWizardStep(0);
          setWizardForm({
            template: '', domain: '', name: '',
            populationSize: 10, maxGenerations: 20, mutationRate: 0.1,
            crossoverRate: 0.7, elitismCount: 2, fitnessThreshold: 0.95,
            customExperiment: '',
          });
        },
        onError: () => toast.error('Failed to create evolution run'),
      },
    );
  }

  /* wizard steps */
  const wizardSteps = [
    { label: 'Template', description: 'Choose a starting template or custom' },
    { label: 'Problem', description: 'Define the problem domain' },
    { label: 'Parameters', description: 'Configure evolution parameters' },
    { label: 'Launch', description: 'Review and start' },
  ];

  return (
    <>
      <PageHeader title="ASI-Evolve" description="Evolutionary self-improvement engine — Learn → Design → Experiment → Analyze">
        <button
          className="btn-primary flex items-center gap-2"
          onClick={() => { setTab('create'); setWizardStep(0); }}
        >
          <Plus className="h-4 w-4" />
          New Experiment
        </button>
      </PageHeader>

      {/* stat cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Runs" value={stats?.total_runs ?? total} icon={Dna} />
        <StatCard label="Active" value={stats?.active_runs ?? activeRuns.length} icon={Activity} />
        <StatCard label="Completed" value={stats?.completed_runs ?? 0} icon={Trophy} />
        <StatCard label="Total Evaluations" value={(stats?.total_evaluations ?? 0).toLocaleString()} icon={FlaskConical} />
        <StatCard label="Best Score" value={stats?.avg_best_score != null ? stats.avg_best_score.toFixed(3) : bestScore.toFixed(3)} icon={Sparkles} />
      </div>

      {/* tab bar */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {([
          { key: 'runs' as Tab, label: 'Runs' },
          { key: 'create' as Tab, label: 'Create Experiment' },
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

      {/* ── Tab: Runs (B.5.1) ── */}
      {tab === 'runs' && (
        <div className="space-y-4">
          {/* status filter */}
          <div className="flex gap-2">
            {['all', 'running', 'pending', 'completed', 'stopped', 'error'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-brand-500/20 text-brand-400 border border-brand-400/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* runs list */}
          {filteredRuns.length === 0 ? (
            <div className="card text-center py-12">
              <Dna className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No evolution runs found.</p>
              <button
                className="btn-primary mt-4"
                onClick={() => { setTab('create'); setWizardStep(0); }}
              >
                Create your first experiment
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredRuns.map((run) => (
                <button
                  key={run.id}
                  className="card flex items-center justify-between hover:ring-1 hover:ring-brand-400/30 transition-all text-left"
                  onClick={() => router.push(`/evolution/${run.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                        run.status === 'running' ? 'bg-blue-400 animate-pulse' :
                        run.status === 'completed' ? 'bg-green-400' :
                        run.status === 'error' ? 'bg-red-400' :
                        run.status === 'stopped' ? 'bg-yellow-400' :
                        'bg-slate-500'
                      }`} />
                      <span className="text-sm font-semibold text-slate-100">
                        {run.name || run.domain || `Run ${run.id.slice(0, 8)}`}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 font-mono">
                        {run.domain}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Layers className="h-3 w-3" />
                        Gen {run.current_gen}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        Score: {run.best_score?.toFixed(3) ?? '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" />
                        {run.total_evals} evals
                      </span>
                      <span>{new Date(run.started_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    {(run.status === 'running' || run.status === 'pending') && (
                      <button
                        className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Stop run"
                        onClick={(e) => { e.stopPropagation(); handleStop(run.id); }}
                      >
                        <Square className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Create Experiment Wizard (B.5.2) ── */}
      {tab === 'create' && (
        <div className="space-y-6">
          {/* wizard stepper */}
          <div className="flex items-center gap-2">
            {wizardSteps.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setWizardStep(i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    wizardStep === i
                      ? 'bg-brand-500/20 text-brand-400 font-medium'
                      : wizardStep > i
                      ? 'text-green-400'
                      : 'text-slate-500'
                  }`}
                >
                  <span className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold ${
                    wizardStep === i
                      ? 'bg-brand-400 text-slate-900'
                      : wizardStep > i
                      ? 'bg-green-400/20 text-green-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {wizardStep > i ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < wizardSteps.length - 1 && (
                  <div className={`h-px w-8 ${wizardStep > i ? 'bg-green-400/50' : 'bg-slate-700'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Template Selection */}
          {wizardStep === 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-2">Choose a Template</h3>
              <p className="text-sm text-slate-400 mb-6">
                Start from a pre-configured template or create a custom experiment.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* custom */}
                <button
                  className={`p-4 rounded-lg border text-left transition-all hover:border-brand-400/50 ${
                    wizardForm.template === '' ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700'
                  }`}
                  onClick={() => {
                    setWizardForm({ ...wizardForm, template: '', domain: '', name: '' });
                    setWizardStep(1);
                  }}
                >
                  <Plus className="h-8 w-8 text-brand-400 mb-2" />
                  <div className="font-medium text-slate-200">Custom Experiment</div>
                  <div className="text-sm text-slate-400 mt-1">Define your own problem domain and evaluator.</div>
                </button>
                {/* templates */}
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    className={`p-4 rounded-lg border text-left transition-all hover:border-brand-400/50 ${
                      wizardForm.template === tmpl.id ? 'border-brand-400 bg-brand-500/10' : 'border-slate-700'
                    }`}
                    onClick={() => handleCreateFromTemplate(tmpl)}
                  >
                    <FlaskConical className="h-8 w-8 text-slate-400 mb-2" />
                    <div className="font-medium text-slate-200">{tmpl.name}</div>
                    <div className="text-sm text-slate-400 mt-1">{tmpl.description}</div>
                    <div className="mt-2 px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 font-mono inline-block">
                      {tmpl.domain}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Problem Domain */}
          {wizardStep === 1 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Define the Problem</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Experiment Name</label>
                  <input
                    className="input w-full"
                    value={wizardForm.name}
                    onChange={(e) => setWizardForm({ ...wizardForm, name: e.target.value })}
                    placeholder="My optimization strategy"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Domain</label>
                  <select
                    className="input w-full"
                    value={wizardForm.domain}
                    onChange={(e) => setWizardForm({ ...wizardForm, domain: e.target.value })}
                  >
                    <option value="">Select a domain…</option>
                    <option value="rag_retrieval">RAG Retrieval</option>
                    <option value="model_routing">Model Routing</option>
                    <option value="prompt_engineering">Prompt Engineering</option>
                    <option value="scheduling">Scheduling</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Experiment Definition (optional JSON)
                  </label>
                  <textarea
                    className="input w-full h-32 font-mono text-sm"
                    value={wizardForm.customExperiment}
                    onChange={(e) => setWizardForm({ ...wizardForm, customExperiment: e.target.value })}
                    placeholder='{"evaluator": "sharpe_ratio", "baseline": {...}}'
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Optional JSON object defining the evaluator, baseline, and cognition strategy.
                  </p>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn-secondary" onClick={() => setWizardStep(0)}>
                  <ArrowLeft className="h-4 w-4 mr-1 inline" />
                  Back
                </button>
                <button
                  className="btn-primary"
                  onClick={() => setWizardStep(2)}
                  disabled={!wizardForm.domain}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Parameters */}
          {wizardStep === 2 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Evolution Parameters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Population Size</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={2}
                    max={100}
                    value={wizardForm.populationSize}
                    onChange={(e) => setWizardForm({ ...wizardForm, populationSize: Number(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Number of candidate solutions per generation.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Max Generations</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={1}
                    max={500}
                    value={wizardForm.maxGenerations}
                    onChange={(e) => setWizardForm({ ...wizardForm, maxGenerations: Number(e.target.value) || 20 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Stop after this many generations.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Mutation Rate</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={wizardForm.mutationRate}
                    onChange={(e) => setWizardForm({ ...wizardForm, mutationRate: Number(e.target.value) || 0.1 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Crossover Rate</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={wizardForm.crossoverRate}
                    onChange={(e) => setWizardForm({ ...wizardForm, crossoverRate: Number(e.target.value) || 0.7 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Elitism Count</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={0}
                    max={20}
                    value={wizardForm.elitismCount}
                    onChange={(e) => setWizardForm({ ...wizardForm, elitismCount: Number(e.target.value) || 2 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Top N candidates preserved unchanged per generation.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Fitness Threshold</label>
                  <input
                    className="input w-full"
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={wizardForm.fitnessThreshold}
                    onChange={(e) => setWizardForm({ ...wizardForm, fitnessThreshold: Number(e.target.value) || 0.95 })}
                  />
                  <p className="text-xs text-slate-500 mt-1">Stop early when best score exceeds this.</p>
                </div>
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn-secondary" onClick={() => setWizardStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1 inline" />
                  Back
                </button>
                <button className="btn-primary" onClick={() => setWizardStep(3)}>
                  Review & Launch
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Launch */}
          {wizardStep === 3 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Review & Launch</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Domain</div>
                    <div className="text-slate-100 font-mono mt-1">{wizardForm.domain || '—'}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Template</div>
                    <div className="text-slate-100 mt-1">{wizardForm.template || 'Custom'}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Population</div>
                    <div className="text-slate-100 mt-1">{wizardForm.populationSize}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Max Generations</div>
                    <div className="text-slate-100 mt-1">{wizardForm.maxGenerations}</div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Mutation / Crossover</div>
                    <div className="text-slate-100 mt-1">
                      {wizardForm.mutationRate} / {wizardForm.crossoverRate}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400">Elitism / Threshold</div>
                    <div className="text-slate-100 mt-1">
                      {wizardForm.elitismCount} / {wizardForm.fitnessThreshold}
                    </div>
                  </div>
                </div>
                {wizardForm.customExperiment && (
                  <div className="rounded-lg bg-slate-800/50 p-3">
                    <div className="text-slate-400 text-sm mb-1">Experiment JSON</div>
                    <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                      {wizardForm.customExperiment}
                    </pre>
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-6">
                <button className="btn-secondary" onClick={() => setWizardStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-1 inline" />
                  Back
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  disabled={createMut.isPending}
                  onClick={handleCreateRun}
                >
                  <Play className="h-4 w-4" />
                  {createMut.isPending ? 'Creating…' : 'Launch Evolution'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
