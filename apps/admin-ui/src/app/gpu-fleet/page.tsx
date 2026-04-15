'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useFleetStatus,
  useFleetNodes,
  useFleetProbe,
  useFleetLoadModel,
  useFleetUnloadModel,
  useModelProfile,
  useModelHealthCheck,
  useQuantRecommend,
  useDeployPipeline,
  useModelComparisons,
} from '@/lib/hooks';
import {
  Gauge,
  Server,
  HardDrive,
  Cpu,
  Activity,
  Download,
  Upload,
  RefreshCw,
  Zap,
  DollarSign,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

/* ── helper types ── */

type FleetNode = {
  id: string;
  name: string;
  endpoint: string;
  runtime: string;
  totalVramMb: number;
  healthy: boolean;
  lastProbe: string | null;
  gpus?: Array<{ name: string; vramTotalMb: number }>;
};

type NodeStatus = {
  node: FleetNode;
  vramUsedMb: number;
  vramFreeMb: number;
  loadedModels: Array<{ name: string; sizeMb: number }>;
};

type FleetStatusData = {
  totalVramMb: number;
  usedVramMb: number;
  freeVramMb: number;
  loadedModels: number;
  healthyNodes: number;
  degradedNodes: number;
  nodes: NodeStatus[];
};

type ProfileData = {
  modelName: string;
  tokensPerSecond: number;
  timeToFirstTokenMs: number;
  totalLatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  promptEvalRate: number | null;
};

type ComparisonData = {
  localModelId: string;
  cloudModelId: string;
  winner: string;
  qualityDelta: number;
  latencyDeltaMs: number;
  costSavingsUsd: number;
  recommendation: string;
};

/* ── safe casts ── */

function toFleetStatus(d: unknown): FleetStatusData | null {
  if (!d || typeof d !== 'object') return null;
  return d as FleetStatusData;
}

function toNodes(d: unknown): FleetNode[] {
  if (!Array.isArray(d)) return [];
  return d as FleetNode[];
}

function toComparisons(d: unknown): ComparisonData[] {
  if (!Array.isArray(d)) return [];
  return d as ComparisonData[];
}

/* ── page ── */

type Tab = 'overview' | 'deploy' | 'compare';

export default function GpuFleetPage() {
  const { data: statusRes, isLoading: statusLoading } = useFleetStatus();
  const { data: nodesRes, isLoading: nodesLoading } = useFleetNodes();
  const { data: comparisonsRes } = useModelComparisons();
  const probeMut = useFleetProbe();
  const loadMut = useFleetLoadModel();
  const unloadMut = useFleetUnloadModel();
  const profileMut = useModelProfile();
  const healthMut = useModelHealthCheck();
  const quantMut = useQuantRecommend();
  const deployMut = useDeployPipeline();

  const [tab, setTab] = useState<Tab>('overview');
  const [loadForm, setLoadForm] = useState({ nodeId: '', model: '' });
  const [deployForm, setDeployForm] = useState({
    model_name: '',
    target: 'ollama' as string,
    node_endpoint: '',
    parameter_count_b: '',
    available_vram_mb: '',
  });
  const [profileResult, setProfileResult] = useState<ProfileData | null>(null);

  if (statusLoading || nodesLoading) return <PageSpinner />;

  const fleet = toFleetStatus(statusRes?.data);
  const nodes = toNodes(nodesRes?.data);
  const comparisons = toComparisons(comparisonsRes?.data);

  const vramUsedPct = fleet && fleet.totalVramMb > 0
    ? Math.round((fleet.usedVramMb / fleet.totalVramMb) * 100)
    : 0;

  function handleProbeAll() {
    probeMut.mutate(undefined, {
      onSuccess: () => toast.success('Fleet probed'),
      onError: () => toast.error('Probe failed'),
    });
  }

  function handleLoad() {
    if (!loadForm.nodeId || !loadForm.model) { toast.error('Node and model required'); return; }
    loadMut.mutate(loadForm, {
      onSuccess: (res) => {
        const d = res?.data as Record<string, unknown> | undefined;
        toast.success(String(d?.message || 'Model loaded'));
        setLoadForm({ nodeId: '', model: '' });
      },
      onError: () => toast.error('Load failed'),
    });
  }

  function handleUnload(nodeId: string, model: string) {
    unloadMut.mutate({ nodeId, model }, {
      onSuccess: () => toast.success(`Unloaded ${model}`),
      onError: () => toast.error('Unload failed'),
    });
  }

  function handleProfile(modelName: string, endpoint: string, target: string) {
    profileMut.mutate({ model_name: modelName, node_endpoint: endpoint, target }, {
      onSuccess: (res) => {
        setProfileResult(res?.data as ProfileData);
        toast.success('Profile complete');
      },
      onError: () => toast.error('Profile failed'),
    });
  }

  function handleHealthCheck(modelName: string, endpoint: string, target: string) {
    healthMut.mutate({ model_name: modelName, node_endpoint: endpoint, target }, {
      onSuccess: (res) => {
        const d = res?.data as Record<string, unknown> | undefined;
        if (d?.healthy) toast.success(`${modelName} is healthy (${d.latencyMs}ms)`);
        else toast.error(`${modelName} unhealthy: ${d?.errorMessage || 'no response'}`);
      },
      onError: () => toast.error('Health check failed'),
    });
  }

  function handleDeploy() {
    if (!deployForm.model_name || !deployForm.target || !deployForm.node_endpoint) {
      toast.error('Model name, target, and endpoint required');
      return;
    }
    deployMut.mutate({
      model_name: deployForm.model_name,
      target: deployForm.target,
      node_endpoint: deployForm.node_endpoint,
      parameter_count_b: deployForm.parameter_count_b ? Number(deployForm.parameter_count_b) : undefined,
      available_vram_mb: deployForm.available_vram_mb ? Number(deployForm.available_vram_mb) : undefined,
    }, {
      onSuccess: (res) => {
        const d = res?.data as Record<string, unknown> | undefined;
        if (res?.success) toast.success('Deploy pipeline complete');
        else toast.error(String(d?.healthCheck && typeof d.healthCheck === 'object' ? (d.healthCheck as Record<string, unknown>).errorMessage : 'Pipeline failed'));
      },
      onError: () => toast.error('Deploy pipeline failed'),
    });
  }

  function handleQuantRecommend() {
    if (!deployForm.model_name || !deployForm.parameter_count_b || !deployForm.available_vram_mb) {
      toast.error('Model name, parameter count, and VRAM required');
      return;
    }
    quantMut.mutate({
      model_name: deployForm.model_name,
      parameter_count_b: Number(deployForm.parameter_count_b),
      available_vram_mb: Number(deployForm.available_vram_mb),
    }, {
      onSuccess: (res) => {
        const d = res?.data as Record<string, unknown> | undefined;
        toast.success(`Recommended: ${d?.recommended} — ${d?.reasoning}`);
      },
      onError: () => toast.error('Recommendation failed'),
    });
  }

  return (
    <>
      <PageHeader title="GPU Fleet" description="Monitor and manage local GPU inference nodes, VRAM, and model deployments">
        <button onClick={handleProbeAll} disabled={probeMut.isPending} className="btn-primary flex items-center gap-1">
          <RefreshCw className={`h-4 w-4 ${probeMut.isPending ? 'animate-spin' : ''}`} /> Probe All
        </button>
      </PageHeader>

      {/* Tab nav */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {(['overview', 'deploy', 'compare'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-brand-600 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {t === 'overview' ? 'Fleet Overview' : t === 'deploy' ? 'Deploy Model' : 'Comparisons'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <>
          {/* Stats */}
          {fleet && (
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total VRAM" value={`${((fleet.totalVramMb) / 1024).toFixed(1)} GB`} icon={HardDrive} />
              <StatCard label="VRAM Used" value={`${vramUsedPct}%`} change={`${(fleet.usedVramMb / 1024).toFixed(1)} / ${(fleet.totalVramMb / 1024).toFixed(1)} GB`} icon={Gauge} />
              <StatCard label="Loaded Models" value={fleet.loadedModels} icon={Cpu} />
              <StatCard label="Nodes" value={`${fleet.healthyNodes} healthy`} change={fleet.degradedNodes > 0 ? `${fleet.degradedNodes} degraded` : undefined} icon={Server} />
            </div>
          )}

          {/* VRAM Bar */}
          {fleet && fleet.totalVramMb > 0 && (
            <div className="card mb-6">
              <h3 className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Fleet VRAM Utilisation</h3>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className={`h-full rounded-full transition-all ${vramUsedPct > 90 ? 'bg-red-500' : vramUsedPct > 70 ? 'bg-amber-500' : 'bg-brand-600'}`}
                  style={{ width: `${vramUsedPct}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{(fleet.usedVramMb / 1024).toFixed(1)} GB used / {(fleet.freeVramMb / 1024).toFixed(1)} GB free</p>
            </div>
          )}

          {/* Node Cards */}
          <div className="space-y-4">
            {nodes.map((node) => {
              const ns = fleet?.nodes?.find((n) => n.node?.id === node.id);
              return (
                <div key={node.id} className="card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${node.healthy ? 'bg-green-500' : 'bg-red-500'}`} />
                      <h3 className="font-medium">{node.name}</h3>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{node.runtime}</span>
                    </div>
                    <span className="text-xs text-slate-500">{node.endpoint}</span>
                  </div>

                  {/* GPUs */}
                  {node.gpus && node.gpus.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {node.gpus.map((gpu, i) => (
                        <span key={i} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                          {gpu.name} ({(gpu.vramTotalMb / 1024).toFixed(1)} GB)
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Loaded models */}
                  {ns && ns.loadedModels.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-slate-500">Loaded Models</p>
                      <div className="flex flex-wrap gap-2">
                        {ns.loadedModels.map((m, i) => (
                          <div key={i} className="flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700">
                            <Cpu className="h-3 w-3" />
                            <span>{m.name}</span>
                            <span className="text-slate-400">({(m.sizeMb / 1024).toFixed(1)} GB)</span>
                            <button onClick={() => handleUnload(node.id, m.name)} className="ml-1 text-red-500 hover:text-red-700" title="Unload">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* VRAM bar per node */}
                  {ns && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>VRAM</span>
                        <span>{(ns.vramUsedMb / 1024).toFixed(1)} / {(node.totalVramMb / 1024).toFixed(1)} GB</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div className="h-full rounded-full bg-brand-600" style={{ width: `${node.totalVramMb > 0 ? (ns.vramUsedMb / node.totalVramMb) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    {node.runtime === 'ollama' && ns?.loadedModels?.[0] && (
                      <>
                        <button onClick={() => handleHealthCheck(ns.loadedModels[0].name, node.endpoint, node.runtime)}
                          className="btn-sm flex items-center gap-1" disabled={healthMut.isPending}>
                          <Activity className="h-3 w-3" /> Health
                        </button>
                        <button onClick={() => handleProfile(ns.loadedModels[0].name, node.endpoint, node.runtime)}
                          className="btn-sm flex items-center gap-1" disabled={profileMut.isPending}>
                          <Zap className="h-3 w-3" /> Profile
                        </button>
                      </>
                    )}
                    {node.runtime === 'llama-server' && (
                      <>
                        <button onClick={() => handleHealthCheck('default', node.endpoint, node.runtime)}
                          className="btn-sm flex items-center gap-1" disabled={healthMut.isPending}>
                          <Activity className="h-3 w-3" /> Health
                        </button>
                        <button onClick={() => handleProfile('default', node.endpoint, node.runtime)}
                          className="btn-sm flex items-center gap-1" disabled={profileMut.isPending}>
                          <Zap className="h-3 w-3" /> Profile
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Profile Result */}
          {profileResult && (
            <div className="card mt-6">
              <h3 className="mb-2 font-medium">Profile: {profileResult.modelName}</h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-slate-500">Tokens/sec</p><p className="text-lg font-semibold">{profileResult.tokensPerSecond}</p></div>
                <div><p className="text-xs text-slate-500">TTFT</p><p className="text-lg font-semibold">{profileResult.timeToFirstTokenMs} ms</p></div>
                <div><p className="text-xs text-slate-500">Total Latency</p><p className="text-lg font-semibold">{profileResult.totalLatencyMs} ms</p></div>
                <div><p className="text-xs text-slate-500">Prompt Eval</p><p className="text-lg font-semibold">{profileResult.promptEvalRate ?? 'N/A'} t/s</p></div>
              </div>
            </div>
          )}

          {/* Load Model */}
          <div className="card mt-6">
            <h3 className="mb-3 font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Load Model (Ollama)</h3>
            <div className="flex flex-wrap gap-3">
              <select value={loadForm.nodeId} onChange={(e) => setLoadForm((f) => ({ ...f, nodeId: e.target.value }))} className="input w-48">
                <option value="">Select node…</option>
                {nodes.filter((n) => n.runtime === 'ollama').map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
              <input type="text" placeholder="Model name (e.g. llama3.2:3b)" value={loadForm.model}
                onChange={(e) => setLoadForm((f) => ({ ...f, model: e.target.value }))} className="input w-64" />
              <button onClick={handleLoad} disabled={loadMut.isPending} className="btn-primary flex items-center gap-1">
                <Upload className="h-4 w-4" /> {loadMut.isPending ? 'Loading…' : 'Load'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Deploy Tab */}
      {tab === 'deploy' && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="mb-4 font-medium flex items-center gap-2"><Download className="h-4 w-4" /> Deploy Pipeline</h3>
            <p className="mb-4 text-sm text-slate-500">Download, quantize-recommend, health check, and profile a model in one step.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Model Name</label>
                <input type="text" placeholder="e.g. qwen2.5:7b" value={deployForm.model_name}
                  onChange={(e) => setDeployForm((f) => ({ ...f, model_name: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Target Runtime</label>
                <select value={deployForm.target} onChange={(e) => setDeployForm((f) => ({ ...f, target: e.target.value }))} className="input">
                  <option value="ollama">Ollama</option>
                  <option value="llama-server">llama-server</option>
                </select>
              </div>
              <div>
                <label className="label">Node Endpoint</label>
                <input type="text" placeholder="http://10.47.47.13:11434" value={deployForm.node_endpoint}
                  onChange={(e) => setDeployForm((f) => ({ ...f, node_endpoint: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Parameter Count (B)</label>
                <input type="number" placeholder="e.g. 7" value={deployForm.parameter_count_b}
                  onChange={(e) => setDeployForm((f) => ({ ...f, parameter_count_b: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="label">Available VRAM (MB)</label>
                <input type="number" placeholder="e.g. 12288" value={deployForm.available_vram_mb}
                  onChange={(e) => setDeployForm((f) => ({ ...f, available_vram_mb: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={handleDeploy} disabled={deployMut.isPending} className="btn-primary flex items-center gap-1">
                <Download className="h-4 w-4" /> {deployMut.isPending ? 'Running…' : 'Run Pipeline'}
              </button>
              <button onClick={handleQuantRecommend} disabled={quantMut.isPending} className="btn-secondary flex items-center gap-1">
                <Cpu className="h-4 w-4" /> Quant Recommend
              </button>
            </div>

            {/* Quant recommendation result */}
            {quantMut.data?.data && (
              <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950">
                <p className="text-sm font-medium">Recommended: <span className="text-brand-700 dark:text-brand-300">{String((quantMut.data.data as Record<string, unknown>).recommended)}</span></p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{String((quantMut.data.data as Record<string, unknown>).reasoning)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparisons Tab */}
      {tab === 'compare' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="mb-4 font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" /> Local vs Cloud Comparisons</h3>
            {comparisons.length === 0 ? (
              <p className="text-sm text-slate-500">No comparisons recorded yet. Run benchmarks against local and cloud models, then compare them.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2 text-left">Local Model</th>
                      <th className="px-3 py-2 text-left">Cloud Model</th>
                      <th className="px-3 py-2 text-center">Winner</th>
                      <th className="px-3 py-2 text-right">Quality Δ</th>
                      <th className="px-3 py-2 text-right">Latency Δ</th>
                      <th className="px-3 py-2 text-right">Cost Saved</th>
                      <th className="px-3 py-2 text-left">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisons.map((c, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">{c.localModelId}</td>
                        <td className="px-3 py-2">{c.cloudModelId}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.winner === 'local' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                            c.winner === 'cloud' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}>
                            {c.winner}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{c.qualityDelta > 0 ? '+' : ''}{c.qualityDelta.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right">{c.latencyDeltaMs > 0 ? '+' : ''}{c.latencyDeltaMs.toFixed(0)} ms</td>
                        <td className="px-3 py-2 text-right text-green-600">${c.costSavingsUsd.toFixed(4)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{c.recommendation}</td>
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
