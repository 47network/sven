'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useChats, useHealth, useMcpServers, useModels, useNasList, useSearchSettingsConfig, useSettings, useTestSearchConnectivity } from '@/lib/hooks';

type WizardStep = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  blocker: string;
};

function normalizeBool(value: unknown): boolean {
  return value === true;
}

export default function SetupWizardPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const health = useHealth();
  const settings = useSettings();
  const mcpServers = useMcpServers();
  const models = useModels();
  const chats = useChats();
  const searchConfig = useSearchSettingsConfig();
  const nasRoot = useNasList('/nas/shared');
  const searchProbe = useTestSearchConnectivity();

  const settingsRows = Array.isArray(settings.data?.rows) ? settings.data.rows : [];
  const mcpRows = Array.isArray((mcpServers.data as { data?: unknown[] } | undefined)?.data)
    ? (((mcpServers.data as { data?: unknown[] }).data || []) as unknown[])
    : [];
  const modelRows = Array.isArray(models.data?.rows) ? models.data.rows : [];
  const chatRows = Array.isArray(chats.data?.rows) ? chats.data.rows : [];
  const healthChecksRaw = Array.isArray((health.data as { checks?: unknown[] } | undefined)?.checks)
    ? (((health.data as { checks?: unknown[] }).checks || []) as Array<{ name?: unknown; status?: unknown }>)
    : [];

  const postgresHealthy = healthChecksRaw.some((check) => String(check.name || '') === 'postgres' && String(check.status || '') === 'pass');
  const natsHealthy = healthChecksRaw.some((check) => String(check.name || '') === 'nats' && String(check.status || '') === 'pass');
  const hasSearchSettings = settingsRows.some((row) => String((row as { key?: unknown }).key || '').startsWith('search.'));
  const hasNasSettings = settingsRows.some((row) => String((row as { key?: unknown }).key || '').startsWith('nas.'));
  const secretConfiguredCount = settingsRows.filter((row) => {
    const rec = row as { key?: unknown; value?: unknown };
    const key = String(rec.key || '');
    if (!key.includes('secret') && !key.includes('_ref') && !key.includes('token_ref')) return false;
    const value = rec.value;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return true;
    return false;
  }).length;

  const mcpConnectedCount = mcpRows.filter((row) => String((row as { status?: unknown }).status || '').toLowerCase() === 'connected').length;
  const nasReady = hasNasSettings && !nasRoot.isError && Array.isArray((nasRoot.data as { entries?: unknown[] } | undefined)?.entries);
  const searchReady = normalizeBool(searchProbe.data?.data && typeof searchProbe.data.data === 'object' && (searchProbe.data.data as { reachable?: unknown }).reachable);

  const steps = useMemo<WizardStep[]>(() => {
    return [
      {
        id: 'infra-core',
        title: 'Core Runtime Health',
        description: 'Verify PostgreSQL and NATS are healthy through live health checks.',
        complete: postgresHealthy && natsHealthy,
        blocker: 'Postgres and NATS must both be healthy.',
      },
      {
        id: 'infra-extensions',
        title: 'Search and NAS Connectivity',
        description: 'Confirm search backend and NAS probes are connected and reachable.',
        complete: searchReady && nasReady,
        blocker: 'Search connectivity and NAS probe must both pass.',
      },
      {
        id: 'platform-config',
        title: 'Platform Configuration',
        description: 'Ensure MCP, channels, LLM providers, and secret refs are configured.',
        complete: mcpRows.length > 0 && mcpConnectedCount > 0 && chatRows.length > 0 && modelRows.length > 0 && secretConfiguredCount > 0,
        blocker: 'Configure MCP, channels, LLM providers, and secret refs before finishing.',
      },
      {
        id: 'finish',
        title: 'Finish and Review',
        description: 'Review Setup Center and continue to operations pages.',
        complete: true,
        blocker: '',
      },
    ];
  }, [
    chatRows.length,
    mcpConnectedCount,
    mcpRows.length,
    modelRows.length,
    nasReady,
    natsHealthy,
    postgresHealthy,
    searchReady,
    secretConfiguredCount,
  ]);

  if (health.isLoading || settings.isLoading || mcpServers.isLoading || models.isLoading || chats.isLoading || searchConfig.isLoading) {
    return <PageSpinner />;
  }

  const current = steps[stepIndex];
  const canAdvance = current.complete || current.id === 'finish';

  return (
    <>
      <PageHeader
        title="Setup Wizard"
        description="Guided setup with blocking validation for infrastructure health and core platform readiness."
      />

      <div className="card mb-6">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`rounded border px-3 py-2 text-xs ${
                idx === stepIndex
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-200'
                  : step.complete
                  ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                  : 'border-slate-700 bg-slate-900/60 text-slate-300'
              }`}
            >
              {idx + 1}. {step.title}
            </div>
          ))}
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="text-lg font-semibold">{current.title}</h2>
        <p className="mt-2 text-sm text-slate-400">{current.description}</p>

        {current.id === 'infra-core' ? (
          <div className="mt-4 space-y-2 text-sm">
            <div>Postgres: {postgresHealthy ? 'Healthy' : 'Not healthy'}</div>
            <div>NATS: {natsHealthy ? 'Healthy' : 'Not healthy'}</div>
            <div className="mt-2 text-xs text-slate-500">Source: `/healthz` dependency checks.</div>
          </div>
        ) : null}

        {current.id === 'infra-extensions' ? (
          <div className="mt-4 space-y-3 text-sm">
            <div>Search configured: {hasSearchSettings ? 'Yes' : 'No'}</div>
            <div>Search connectivity: {searchReady ? 'Healthy' : 'Not verified'}</div>
            <div>NAS configured: {hasNasSettings ? 'Yes' : 'No'}</div>
            <div>NAS connectivity: {nasReady ? 'Healthy' : 'Not healthy'}</div>
            <button
              className="btn-secondary btn-sm"
              onClick={() => searchProbe.mutate()}
              disabled={searchProbe.isPending}
            >
              {searchProbe.isPending ? 'Running search probe...' : 'Run search connectivity probe'}
            </button>
          </div>
        ) : null}

        {current.id === 'platform-config' ? (
          <div className="mt-4 space-y-2 text-sm">
            <div>MCP servers: {mcpRows.length} (connected: {mcpConnectedCount})</div>
            <div>Channels/chats: {chatRows.length}</div>
            <div>LLM models: {modelRows.length}</div>
            <div>Secret refs: {secretConfiguredCount}</div>
          </div>
        ) : null}

        {current.id === 'finish' ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/setup" className="btn-secondary btn-sm">Open Setup Center</Link>
            <Link href="/overview" className="btn-secondary btn-sm">Open Overview</Link>
            <Link href="/integrations" className="btn-secondary btn-sm">Open Integrations</Link>
          </div>
        ) : null}

        {!current.complete && current.id !== 'finish' ? (
          <p className="mt-4 text-xs text-amber-300">Blocking requirement: {current.blocker}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn-secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
        >
          Back
        </button>
        <button
          className="btn-primary"
          disabled={stepIndex >= steps.length - 1 || !canAdvance}
          onClick={() => setStepIndex((prev) => Math.min(steps.length - 1, prev + 1))}
        >
          Next
        </button>
      </div>
    </>
  );
}
