'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import {
  Activity,
  Boxes,
  Cloud,
  Compass,
  HardDrive,
  Radio,
  Settings2,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import {
  useBackupStatus,
  useBackupConfigs,
  useDeploymentConfig,
  useDiscoveryInstances,
  useEdgeAdmin47Access,
  useIntegrationRecoveryPlaybookRuns,
  useIntegrationRuntimeList,
  useSetDeploymentMode,
  useStartBackup,
  useTunnelStatus,
  useUpdateCheckerStatus,
  useRunIntegrationRecoveryPlaybook,
} from '@/lib/hooks';

const DEPLOYMENT_LINKS = [
  {
    title: 'Setup Center',
    description: 'Baseline install readiness, account setup, and operator prerequisites.',
    href: '/setup',
    icon: Activity,
  },
  {
    title: 'Canary Rollouts',
    description: 'Progressive delivery, rollout controls, and release gates.',
    href: '/canary-rollouts',
    icon: Cloud,
  },
  {
    title: 'Backup & Restore',
    description: 'Recovery posture, snapshots, restore jobs, and backup policy.',
    href: '/backup-restore',
    icon: HardDrive,
  },
  {
    title: 'Discovery',
    description: 'Runtime discovery, peer visibility, and deployment topology signals.',
    href: '/discovery',
    icon: Compass,
  },
  {
    title: 'Workflow Builder',
    description: 'Operational orchestration and scheduled runtime flows.',
    href: '/workflow-builder',
    icon: Workflow,
  },
  {
    title: 'Settings',
    description: 'Environment-level controls, security posture, and tenant configuration.',
    href: '/settings',
    icon: Settings2,
  },
];

function metricTone(value: 'good' | 'warn' | 'neutral'): string {
  if (value === 'good') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  if (value === 'warn') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function countRunningRuntimes(rows: unknown): { total: number; running: number; failing: number } {
  const list = Array.isArray((rows as { data?: unknown })?.data) ? ((rows as { data: unknown[] }).data) : [];
  let running = 0;
  let failing = 0;
  for (const row of list) {
    const status = String((row as { status?: unknown })?.status || '').trim().toLowerCase();
    if (status === 'running') running += 1;
    if (status === 'error') failing += 1;
  }
  return { total: list.length, running, failing };
}

function countDiscoveryPeers(payload: unknown): number {
  return Array.isArray((payload as { data?: { instances?: unknown[] } })?.data?.instances)
    ? (((payload as { data: { instances: unknown[] } }).data.instances).length)
    : 0;
}

export default function DeploymentPage() {
  const deploymentConfig = useDeploymentConfig();
  const setDeploymentMode = useSetDeploymentMode();
  const backupStatus = useBackupStatus();
  const backupConfigs = useBackupConfigs();
  const discovery = useDiscoveryInstances();
  const tunnel = useTunnelStatus();
  const edgeAccess = useEdgeAdmin47Access();
  const updateChecker = useUpdateCheckerStatus();
  const integrationRuntime = useIntegrationRuntimeList();
  const recoveryRuns = useIntegrationRecoveryPlaybookRuns({ limit: 1, page: 1, order: 'desc', sort: 'created_at' });
  const startBackup = useStartBackup();
  const runRecoveryPlaybook = useRunIntegrationRecoveryPlaybook();

  const deploymentMode = deploymentConfig.data?.data?.mode || 'multi_user';
  const setupComplete = Boolean(deploymentConfig.data?.data?.setup_complete);
  const backupHealthy = Boolean((backupStatus.data as { success?: boolean })?.success);
  const discoveryPeers = countDiscoveryPeers(discovery.data);
  const tunnelEnabled = Boolean((tunnel.data as { data?: { enabled?: boolean } })?.data?.enabled);
  const publicUrl = (tunnel.data as { data?: { public_url?: string | null } })?.data?.public_url || null;
  const edgeSynced = Boolean((edgeAccess.data as { data?: { include_hook_detected?: boolean } })?.data?.include_hook_detected);
  const updateAvailable = Boolean((updateChecker.data as { data?: { updateAvailable?: boolean } })?.data?.updateAvailable);
  const runtimeCounts = countRunningRuntimes(integrationRuntime.data);
  const backupConfigsPayload = (backupConfigs.data as { configs?: Array<{ id?: string }> } | undefined)?.configs
    || (backupConfigs.data as { data?: { configs?: Array<{ id?: string }> } } | undefined)?.data?.configs
    || [];
  const primaryBackupConfigId = String(
    backupConfigsPayload.find((row) => String(row?.id || '') === 'default-daily-backup')?.id
      || backupConfigsPayload[0]?.id
      || '',
  ).trim();
  const latestRecoveryRun =
    ((recoveryRuns.data as { data?: Array<{ run_id?: string; run_status?: string; created_at?: string; summary?: Record<string, { succeeded?: number; failed?: number }> }> })?.data || [])[0]
    || null;

  async function changeMode(mode: 'personal' | 'multi_user') {
    try {
      await setDeploymentMode.mutateAsync(mode);
      toast.success(`Deployment mode set to ${mode === 'multi_user' ? 'multi-user' : 'personal'}`);
    } catch {
      toast.error('Failed to update deployment mode');
    }
  }

  async function triggerBackup() {
    if (!primaryBackupConfigId) {
      toast.error('No backup configuration is available on this deployment');
      return;
    }
    try {
      await startBackup.mutateAsync({ configId: primaryBackupConfigId });
      toast.success('Backup started from deployment checkpoint');
    } catch {
      toast.error('Failed to start backup from deployment checkpoint');
    }
  }

  async function triggerRecoveryPlaybook() {
    try {
      await runRecoveryPlaybook.mutateAsync({
        retry_failed: true,
        deploy_stopped: true,
        apply_templates_unconfigured: true,
        validate_unconfigured: true,
      });
      toast.success('Recovery playbook started from deployment checkpoint');
    } catch {
      toast.error('Failed to start recovery playbook');
    }
  }

  return (
    <>
      <PageHeader
        title="Deployment"
        description="Live deployment posture, rollout-adjacent state, and operator entry points."
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="card space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
                <Boxes className="h-3.5 w-3.5" />
                Live Deployment State
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">Operator checkpoint</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                This page now reflects live deployment posture instead of only linking elsewhere. Use it to verify account mode,
                ingress exposure, runtime health, discovery visibility, and backup posture before you move deeper into rollout work.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-right text-sm text-emerald-300">
              <div className="font-medium">{setupComplete ? 'Setup complete' : 'Setup pending'}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                {deploymentMode === 'multi_user' ? 'Multi-user mode' : 'Personal mode'}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-2xl border p-4 ${metricTone(setupComplete ? 'good' : 'warn')}`}>
              <div className="text-xs uppercase tracking-[0.18em]">Deployment Mode</div>
              <div className="mt-2 text-lg font-semibold">{deploymentMode === 'multi_user' ? 'Multi-user' : 'Personal'}</div>
              <div className="mt-1 text-sm">{setupComplete ? 'Initial setup completed' : 'Initial setup still required'}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${metricTone(runtimeCounts.failing > 0 ? 'warn' : runtimeCounts.running > 0 ? 'good' : 'neutral')}`}>
              <div className="text-xs uppercase tracking-[0.18em]">Integration Runtime</div>
              <div className="mt-2 text-lg font-semibold">{runtimeCounts.running}/{runtimeCounts.total}</div>
              <div className="mt-1 text-sm">{runtimeCounts.failing > 0 ? `${runtimeCounts.failing} runtime(s) in error` : 'No active runtime errors detected'}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${metricTone(backupHealthy ? 'good' : 'warn')}`}>
              <div className="text-xs uppercase tracking-[0.18em]">Recovery Posture</div>
              <div className="mt-2 text-lg font-semibold">{backupHealthy ? 'Healthy' : 'Degraded'}</div>
              <div className="mt-1 text-sm">{backupHealthy ? 'Backup status endpoint responding' : 'Backup status needs operator attention'}</div>
            </div>
            <div className={`rounded-2xl border p-4 ${metricTone(edgeSynced ? 'good' : 'warn')}`}>
              <div className="text-xs uppercase tracking-[0.18em]">Admin Edge</div>
              <div className="mt-2 text-lg font-semibold">{edgeSynced ? 'Synced' : 'Check access sync'}</div>
              <div className="mt-1 text-sm">{publicUrl ? publicUrl : 'No tunnel public URL detected'}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Mode control</div>
                <p className="mt-1 text-sm text-slate-400">
                  Change the runtime account model without leaving this operator checkpoint.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn-secondary btn-sm"
                  disabled={setDeploymentMode.isPending || deploymentMode === 'personal'}
                  onClick={() => changeMode('personal')}
                >
                  Set personal
                </button>
                <button
                  className="btn-primary btn-sm"
                  disabled={setDeploymentMode.isPending || deploymentMode === 'multi_user'}
                  onClick={() => changeMode('multi_user')}
                >
                  Set multi-user
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="card space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            Runtime Signals
          </div>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-medium text-white">Discovery</div>
              <div className="mt-1 text-slate-400">{discoveryPeers} peer instance(s) currently visible</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-medium text-white">Tunnel</div>
              <div className="mt-1 text-slate-400">
                {tunnelEnabled ? `Enabled${publicUrl ? ` · ${publicUrl}` : ''}` : 'Disabled'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-medium text-white">Update Channel</div>
              <div className="mt-1 text-slate-400">
                {updateAvailable ? 'Update available for this deployment' : 'No update currently advertised'}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <div className="font-medium text-white">Ingress Health</div>
              <div className="mt-1 text-slate-400">{edgeSynced ? 'admin47 edge hook detected' : 'admin47 edge sync should be checked'}</div>
            </div>
          </div>
        </aside>
      </div>

      <section className="card mt-4">
        <div className="mb-4 flex items-center gap-2 text-cyan-300">
          <Workflow className="h-4 w-4" />
          <h2 className="text-lg font-semibold text-white">Deployment actions</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Recovery playbook</div>
                <p className="mt-1 text-sm text-slate-400">
                  Retry failed runtimes, deploy stopped instances, apply templates, and validate unconfigured integrations.
                </p>
              </div>
              <button className="btn-primary btn-sm" onClick={triggerRecoveryPlaybook} disabled={runRecoveryPlaybook.isPending}>
                {runRecoveryPlaybook.isPending ? 'Starting...' : 'Run now'}
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {latestRecoveryRun
                ? `Latest run ${String(latestRecoveryRun.run_status || 'unknown')} · ${String(latestRecoveryRun.created_at || 'unknown time')}`
                : 'No recovery runs recorded yet'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Backup snapshot</div>
                <p className="mt-1 text-sm text-slate-400">
                  Trigger the primary backup configuration directly from the deployment checkpoint.
                </p>
              </div>
              <button className="btn-primary btn-sm" onClick={triggerBackup} disabled={startBackup.isPending || !primaryBackupConfigId}>
                {startBackup.isPending ? 'Starting...' : 'Start backup'}
              </button>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {primaryBackupConfigId ? `Using config ${primaryBackupConfigId}` : 'No backup configuration available'}
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-4">
        <div className="flex items-center gap-2 text-cyan-300">
          <Radio className="h-4 w-4" />
          <h2 className="text-lg font-semibold text-white">Operational surfaces</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {DEPLOYMENT_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-cyan-400/40 hover:bg-slate-950"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white group-hover:text-cyan-300">{item.title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
