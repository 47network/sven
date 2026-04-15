'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { StatCard } from '@/components/StatCard';
import {
  useInfraNodes,
  useInfraDeployments,
  useInfraCosts,
  useInfraStats,
  useInfraGoals,
  useUpdateInfraNodeStatus,
  useUpdateInfraGoalProgress,
} from '@/lib/hooks';
import { toast } from 'sonner';

/* ── helpers ── */
function safe<T>(d: unknown, key: string): T { return ((d as Record<string, unknown>)?.[key] ?? []) as T; }
function fmtUsd(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }

const STATUS_DOT: Record<string, string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  down: 'bg-red-400',
  maintenance: 'bg-blue-400',
  provisioning: 'bg-zinc-400',
  running: 'bg-emerald-400',
  stopped: 'bg-zinc-400',
  failed: 'bg-red-400',
};

function statusDot(s: string) {
  return <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${STATUS_DOT[s] ?? 'bg-zinc-500'}`} />;
}

export default function InfraPage() {
  const [tab, setTab] = useState<'nodes' | 'deployments' | 'costs' | 'goals'>('nodes');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodesQ = useInfraNodes();
  const deploymentsQ = useInfraDeployments();
  const costsQ = useInfraCosts();
  const statsQ = useInfraStats();
  const goalsQ = useInfraGoals();
  const updateNodeStatus = useUpdateInfraNodeStatus();
  const updateGoalProgress = useUpdateInfraGoalProgress();

  if (nodesQ.isLoading || statsQ.isLoading) return <PageSpinner />;

  const nodes = safe<Array<Record<string, unknown>>>((nodesQ.data as Record<string, unknown>)?.data, 'nodes');
  const deployments = safe<Array<Record<string, unknown>>>((deploymentsQ.data as Record<string, unknown>)?.data, 'deployments');
  const costsData = (costsQ.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const totalMonthlyCost = Number(costsData?.totalMonthlyCost ?? 0);
  const costByNode = (costsData?.byNode ?? []) as Array<{ nodeId: string; hostname: string; cost: number }>;
  const goals = safe<Array<Record<string, unknown>>>((goalsQ.data as Record<string, unknown>)?.data, 'goals');

  const statsData = (statsQ.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const nodeStats = (statsData?.nodes ?? []) as Array<{ status: string; count: number }>;
  const deployStats = (statsData?.deployments ?? []) as Array<{ status: string; count: number }>;

  const totalNodes = nodeStats.reduce((s, n) => s + n.count, 0);
  const healthyNodes = nodeStats.find((n) => n.status === 'healthy')?.count ?? 0;
  const totalDeploys = deployStats.reduce((s, d) => s + d.count, 0);

  function handleNodeStatus(id: string, status: string) {
    updateNodeStatus.mutate({ id, status }, {
      onSuccess: () => toast.success(`Node status → ${status}`),
      onError: () => toast.error('Failed to update node status'),
    });
  }

  function handleGoalProgress(id: string, currentValue: number) {
    updateGoalProgress.mutate({ id, currentValue }, {
      onSuccess: () => toast.success('Goal progress updated'),
      onError: () => toast.error('Failed to update goal'),
    });
  }

  const TABS = ['nodes', 'deployments', 'costs', 'goals'] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="Infrastructure" description="Servers, capacity, deployments, and costs" />

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Nodes" value={String(totalNodes)} />
        <StatCard label="Healthy" value={String(healthyNodes)} valueClassName="text-emerald-400" />
        <StatCard label="Deployments" value={String(totalDeploys)} />
        <StatCard label="Monthly Cost" value={fmtUsd(totalMonthlyCost)} />
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-white/10 pb-1">
        {TABS.map((t) => (
          <button key={t} className={`px-3 py-1.5 text-sm rounded-t ${tab === t ? 'bg-white/10 text-white font-medium' : 'text-zinc-400 hover:text-white'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── NODES ── */}
      {tab === 'nodes' && (
        <div className="space-y-3">
          {nodes.length === 0 ? <p className="text-zinc-500 text-sm card p-4">No infrastructure nodes registered</p> : (
            nodes.map((n) => {
              const isSelected = selectedNode === String(n.id);
              const resources = (n.resources ?? {}) as Record<string, unknown>;
              const services = (n.services ?? []) as string[];
              const tags = (n.tags ?? []) as string[];
              return (
                <div key={String(n.id)} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setSelectedNode(isSelected ? null : String(n.id))}>
                    <div className="flex items-center gap-3">
                      {statusDot(String(n.status))}
                      <span className="font-semibold">{String(n.hostname)}</span>
                      <span className="text-zinc-400 text-xs">{String(n.domain)}</span>
                      <span className="badge-info text-xs">{String(n.provider)}</span>
                      {String(n.region) && <span className="text-zinc-500 text-xs">{String(n.region)}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {tags.map((t) => <span key={t} className="badge-info text-xs">{t}</span>)}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${String(n.status) === 'healthy' ? 'bg-emerald-500/20 text-emerald-300' : String(n.status) === 'degraded' ? 'bg-amber-500/20 text-amber-300' : String(n.status) === 'down' ? 'bg-red-500/20 text-red-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
                        {String(n.status)}
                      </span>
                    </div>
                  </div>

                  {isSelected ?(
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                      {/* Resources */}
                      {Object.keys(resources).length > 0 ? (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 mb-1">Resources</h4>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            {Object.entries(resources).map(([k, v]) => (
                              <div key={k} className="bg-white/5 rounded px-2 py-1">
                                <span className="text-zinc-400">{k}:</span> <span className="font-mono">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Services */}
                      {(services.length > 0) ? (
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400 mb-1">Services</h4>
                          <div className="flex flex-wrap gap-1">
                            {services.map((s) => <span key={s} className="badge-info text-xs">{s}</span>)}
                          </div>
                        </div>
                      ) : null}

                      {/* Status actions */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Set status:</span>
                        {['healthy', 'degraded', 'maintenance', 'down'].map((s) => (
                          <button key={s} className="btn-secondary text-xs py-1 px-2" onClick={() => handleNodeStatus(String(n.id), s)} disabled={String(n.status) === s || updateNodeStatus.isPending}>
                            {s}
                          </button>
                        ))}
                      </div>

                      {/* Last health check */}
                      {n.last_health_check ? (
                        <p className="text-xs text-zinc-500">Last health check: {new Date(String(n.last_health_check)).toLocaleString()}</p>
                      ) : null}
                    </div>
                  ) : null : null}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── DEPLOYMENTS ── */}
      {tab === 'deployments' && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Active Deployments</h3>
          {deployments.length === 0 ? <p className="text-zinc-500 text-sm">No deployments</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-400 border-b border-white/10">
                    <th className="text-left py-2 pr-3">Service</th>
                    <th className="text-left py-2 pr-3">Node</th>
                    <th className="text-left py-2 pr-3">Version</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Port</th>
                    <th className="text-left py-2 pr-3">Replicas</th>
                    <th className="text-left py-2">Resources</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d) => (
                    <tr key={String(d.id)} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3 font-medium">{String(d.service_name)}</td>
                      <td className="py-2 pr-3 text-xs text-zinc-400">{String(d.node_id).slice(0, 16)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{String(d.version ?? '-')}</td>
                      <td className="py-2 pr-3">{statusDot(String(d.status))} {String(d.status)}</td>
                      <td className="py-2 pr-3 font-mono text-xs">{String(d.port ?? '-')}</td>
                      <td className="py-2 pr-3 text-center">{String(d.replicas ?? 1)}</td>
                      <td className="py-2 text-xs text-zinc-400">CPU: {String(d.cpu_limit ?? '-')} | Mem: {String(d.memory_limit ?? '-')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── COSTS ── */}
      {tab === 'costs' && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">Monthly Cost by Node</h3>
            <div className="text-2xl font-bold text-cyan-400 mb-4">{fmtUsd(totalMonthlyCost)}<span className="text-sm text-zinc-400 ml-1">/month</span></div>
            {costByNode.length === 0 ? <p className="text-zinc-500 text-sm">No cost data</p> : (
              <div className="space-y-2">
                {costByNode.map((c) => {
                  const pct = totalMonthlyCost > 0 ? (c.cost / totalMonthlyCost) * 100 : 0;
                  return (
                    <div key={c.nodeId} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{c.hostname}</span>
                        <span className="font-mono text-zinc-300">{fmtUsd(c.cost)}</span>
                      </div>
                      <div className="w-full h-2 rounded bg-white/10">
                        <div className="h-full rounded bg-cyan-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GOALS ── */}
      {tab === 'goals' && (
        <div className="space-y-3">
          {goals.length === 0 ? <p className="text-zinc-500 text-sm card p-4">No economy goals configured</p> : (
            goals.map((g) => {
              const target = Number(g.target_value ?? 0);
              const current = Number(g.current_value ?? 0);
              const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
              const milestones = (g.milestones ?? []) as Array<{ label?: string; targetValue?: number; achieved?: boolean; achievedAt?: string }>;
              return (
                <div key={String(g.id)} className="card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{String(g.title)}</h4>
                      <p className="text-xs text-zinc-400">{String(g.type)} · Deadline: {g.deadline ? new Date(String(g.deadline)).toLocaleDateString() : 'None'}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${String(g.status) === 'achieved' ? 'bg-emerald-500/20 text-emerald-300' : String(g.status) === 'active' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-zinc-500/20 text-zinc-300'}`}>
                      {String(g.status)}
                    </span>
                  </div>
                  {g.description ? <p className="text-sm text-zinc-400">{String(g.description)}</p> : null}

                  {/* progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>{current.toLocaleString()} {String(g.unit ?? '')}</span>
                      <span>{target.toLocaleString()} {String(g.unit ?? '')} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full h-3 rounded bg-white/10">
                      <div className="h-full rounded bg-cyan-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* milestones */}
                  {milestones.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {milestones.map((m, i) => (
                        <span key={i} className={`text-xs px-2 py-0.5 rounded ${m.achieved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-400'}`}>
                          {m.label ?? `Milestone ${i + 1}`} {m.achieved ? '✓' : `(${m.targetValue})`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* manual progress update */}
                  {String(g.status) === 'active' && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        className="input w-32"
                        type="number"
                        placeholder="New value"
                        defaultValue={current}
                        id={`goal-${String(g.id)}`}
                      />
                      <button
                        className="btn-secondary text-xs"
                        onClick={() => {
                          const inp = document.getElementById(`goal-${String(g.id)}`) as HTMLInputElement;
                          handleGoalProgress(String(g.id), Number(inp?.value ?? 0));
                        }}
                        disabled={updateGoalProgress.isPending}
                      >
                        Update
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
