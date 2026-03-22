'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { PageSpinner } from '@/components/Spinner';
import { useCommunityStatus, useHealth, useSelfCorrectionMetrics } from '@/lib/hooks';
import Link from 'next/link';
import {
  RELEASE_NARRATIVE_COPY,
  RELEASE_NARRATIVE_LABELS,
  formatStatusLabel,
} from '@sven/shared/community/release-narrative';
import {
  Activity,
  Users,
  MessageSquare,
  ShieldCheck,
  AlertTriangle,
  Play,
  Cpu,
  HardDrive,
  Shield,
  ArrowUpRight,
  Sparkles,
  Trophy,
  Radar,
  CheckCircle2,
} from 'lucide-react';

type ServiceHealth = {
  healthy?: boolean;
  version?: string;
};

type CapabilityProof = {
  status: 'pass' | 'fail' | 'unknown';
  summary: {
    total_rows: number;
    proven_pass_rows: number;
    partial_rows: number;
    unproven_rows: number;
    coverage_percent: number;
  };
  competitors?: Array<{
    id: string;
    total_rows: number;
    proven_pass_rows: number;
    partial_rows: number;
    unproven_rows: number;
  }>;
  waves?: Array<{
    wave: string;
    competitor: string;
    status: 'pass' | 'fail' | 'unknown';
  }>;
};

function numberOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export default function OverviewPage() {
  const { data: health, isLoading } = useHealth();
  const { data: selfCorrection } = useSelfCorrectionMetrics(168);
  const { data: communityStatus } = useCommunityStatus();
  const [capabilityProof, setCapabilityProof] = useState<CapabilityProof | null>(null);
  const [communityFeed, setCommunityFeed] = useState<null | {
    status: 'pass' | 'fail' | 'unknown';
    telemetry?: {
      doc_agents_status?: 'pass' | 'fail' | 'unknown';
      ecosystem_status?: 'pass' | 'fail' | 'unknown';
      required_failures?: number;
    };
  }>(null);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/capability-proof', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCapabilityProof((json?.data || null) as CapabilityProof | null);
      })
      .catch(() => {
        if (!active) return;
        setCapabilityProof(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/feed', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCommunityFeed((json?.data || null) as typeof communityFeed);
      })
      .catch(() => {
        if (!active) return;
        setCommunityFeed(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) return <PageSpinner />;

  const h = (health ?? {}) as Record<string, unknown>;
  const services = (h.services ?? {}) as Record<string, ServiceHealth>;
  const healthyCount = Object.values(services).filter((s) => s?.healthy).length;
  const totalCount = Object.keys(services).length;
  const healthRatio = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;
  const scData = ((selfCorrection as Record<string, unknown> | undefined)?.data || {}) as Record<string, unknown>;
  const scClass = (scData.classification || {}) as Record<string, unknown>;
  const scRetriesTotal = numberOr(scData.retries_total);
  const scSuccessRate = numberOr(scData.success_rate_pct);
  const scTransient = numberOr(scClass.transient);
  const scStrategy = numberOr(scClass.strategy);
  const scFatal = numberOr(scClass.fatal);
  const communityData = ((communityStatus as { data?: Record<string, unknown> } | undefined)?.data || {}) as Record<string, unknown>;
  const communityCompleted = numberOr(communityData.completed);
  const communityTotal = numberOr(communityData.total);
  const communityReadinessPct = communityTotal > 0 ? Math.round((communityCompleted / communityTotal) * 100) : 0;
  const provenRows = capabilityProof?.summary.proven_pass_rows ?? 0;
  const totalRows = capabilityProof?.summary.total_rows ?? 0;
  const openRows = (capabilityProof?.summary.partial_rows ?? 0) + (capabilityProof?.summary.unproven_rows ?? 0);
  const competitorPerfect = (capabilityProof?.competitors || []).filter(
    (c) => c.total_rows > 0 && c.partial_rows === 0 && c.unproven_rows === 0,
  ).length;
  const competitorTotal = capabilityProof?.competitors?.length ?? 0;
  const wavePass = (capabilityProof?.waves || []).filter((w) => w.status === 'pass').length;
  const waveTotal = capabilityProof?.waves?.length ?? 0;
  const docAgentStatus = formatStatusLabel(communityFeed?.telemetry?.doc_agents_status);
  const ecosystemStatus = formatStatusLabel(communityFeed?.telemetry?.ecosystem_status);
  const requiredFailures = communityFeed?.telemetry?.required_failures ?? 0;

  return (
    <>
      <PageHeader title="Overview" description="System health, queues, and error rates at a glance" />

      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card hover-lift motion-reveal xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Operations Pulse
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Sven Control Surface</h2>
              <p className="mt-1 text-sm text-slate-400">
                Live account-aware operations, safety controls, and execution telemetry.
              </p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Health</div>
              <div className="text-lg font-semibold text-cyan-300">{healthRatio}%</div>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${healthRatio}%` }}
            />
          </div>
        </div>

        <div className="card hover-lift motion-reveal motion-delay-1">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Priority Actions</h3>
          <div className="mt-3 space-y-2">
            <Link href="/incidents" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span className="inline-flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-400" /> Incidents</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/approvals" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-cyan-300" /> Approvals</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/runs" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span className="inline-flex items-center gap-2"><Play className="h-4 w-4 text-emerald-300" /> Tool Runs</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Health banner */}
      {totalCount > 0 && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            healthyCount === totalCount
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300'
              : 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-300'
          }`}
        >
          <Activity className="h-4 w-4" />
          {healthyCount === totalCount
            ? 'All systems operational'
            : `${healthyCount}/${totalCount} services healthy — check incidents`}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 motion-reveal motion-delay-1">
        <div className="hover-lift rounded-xl"><StatCard label="Services" value={`${healthyCount}/${totalCount}`} icon={Activity} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Active Users" value={numberOr(h.active_users)} icon={Users} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Chats" value={numberOr(h.total_chats)} icon={MessageSquare} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Pending Approvals" value={numberOr(h.pending_approvals)} icon={ShieldCheck} /></div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 motion-reveal motion-delay-2">
        <div className="hover-lift rounded-xl"><StatCard label="Tool Runs (24h)" value={numberOr(h.tool_runs_24h)} icon={Play} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Error Rate" value={textOr(h.error_rate, '0%')} icon={AlertTriangle} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Inference Calls" value={numberOr(h.inference_calls)} icon={Cpu} /></div>
        <div className="hover-lift rounded-xl"><StatCard label="Disk Usage" value={textOr(h.disk_usage, '—')} icon={HardDrive} /></div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3 motion-reveal motion-delay-2">
        <div className="card hover-lift lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">{RELEASE_NARRATIVE_LABELS.capabilityProof}</div>
              <h2 className="mt-1 text-base font-semibold">{RELEASE_NARRATIVE_COPY.machineVerifiedCoverage}</h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              <Trophy className="h-3.5 w-3.5" />
              {formatStatusLabel(capabilityProof?.status)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Proven rows</div>
              <div className="text-lg font-semibold text-cyan-300">{provenRows}/{totalRows}</div>
              <div className="text-xs text-slate-400">Coverage {capabilityProof?.summary.coverage_percent ?? 0}%</div>
            </div>
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Competitor lanes</div>
              <div className="text-lg font-semibold text-emerald-300">{competitorPerfect}/{competitorTotal}</div>
              <div className="text-xs text-slate-400">Fully proven lanes</div>
            </div>
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">{RELEASE_NARRATIVE_LABELS.waveLanes}</div>
              <div className="text-lg font-semibold text-violet-300">{wavePass}/{waveTotal}</div>
              <div className="text-xs text-slate-400">Pass status lanes</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            Open gaps: {openRows}
          </div>
        </div>

        <div className="card hover-lift">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">{RELEASE_NARRATIVE_LABELS.ecosystemReadiness}</div>
          <div className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-cyan-300">
            <Radar className="h-4 w-4" />
            {communityReadinessPct}%
          </div>
          <div className="mt-1 text-xs text-slate-400">{communityCompleted}/{communityTotal} readiness checks complete</div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">Doc-Agent Verification: {docAgentStatus}</span>
            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">Ecosystem Gate: {ecosystemStatus}</span>
            <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-slate-300">Required failures: {requiredFailures}</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {RELEASE_NARRATIVE_LABELS.verifiedPersonaControls}
          </div>
          <Link href="/community" className="mt-4 inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
            Open {RELEASE_NARRATIVE_LABELS.communityOperations}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3 motion-reveal motion-delay-2">
        <div className="card hover-lift lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Self-Correction (7d)</h2>
            <span className="text-xs text-slate-400">{scRetriesTotal} retries</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Transient</div>
              <div className="text-lg font-semibold text-cyan-300">{scTransient}</div>
            </div>
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Strategy</div>
              <div className="text-lg font-semibold text-emerald-300">{scStrategy}</div>
            </div>
            <div className="rounded-lg border border-slate-700 px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Fatal</div>
              <div className="text-lg font-semibold text-rose-300">{scFatal}</div>
            </div>
          </div>
        </div>
        <div className="card hover-lift">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">Success After Retry</div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">{scSuccessRate.toFixed(1)}%</div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${Math.max(0, Math.min(100, scSuccessRate))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Service detail cards */}
      {totalCount > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Services</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 motion-reveal motion-delay-3">
            {Object.entries(services).map(([name, svc]) => (
              <div key={name} className="card hover-lift flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-slate-500">{svc.version ?? '—'}</p>
                </div>
                <span className={svc.healthy ? 'badge-success' : 'badge-danger'}>
                  {svc.healthy ? 'healthy' : 'down'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
