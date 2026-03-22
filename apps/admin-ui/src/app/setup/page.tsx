'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useBackupConfigs,
  useHealth,
  useIntegrationLibrary,
  useInstallIntegrationLibraryProfile,
  useIntegrationsCatalog,
  useNasList,
  useMcpServers,
  useMe,
  useModels,
  useSearchSettingsConfig,
  useSettings,
  useSsoSettings,
  useTestSearchConnectivity,
} from '@/lib/hooks';
import {
  Blocks,
  Bot,
  Cable,
  CheckCircle2,
  Database,
  HardDrive,
  KeyRound,
  Link2,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type SetupLink = {
  key: 'integrations' | 'mcp' | 'channels' | 'llm' | 'secrets' | 'search' | 'backup' | 'sso';
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SETUP_LINKS: SetupLink[] = [
  {
    key: 'integrations',
    title: 'Integration Catalog',
    description: 'Install and configure integrations from one place',
    href: '/integrations',
    icon: Blocks,
  },
  {
    key: 'mcp',
    title: 'MCP Servers',
    description: 'Preset-based MCP setup with policy controls',
    href: '/mcp-servers',
    icon: Link2,
  },
  {
    key: 'channels',
    title: 'Channels',
    description: 'Connect channels (adapter profile/env + secret refs may still be required)',
    href: '/channels',
    icon: Radio,
  },
  {
    key: 'llm',
    title: 'LLM Providers',
    description: 'Configure model backends and routing',
    href: '/llm',
    icon: Bot,
  },
  {
    key: 'secrets',
    title: 'Secrets',
    description: 'Store credentials safely for integrations',
    href: '/secrets',
    icon: KeyRound,
  },
  {
    key: 'search',
    title: 'Search Settings',
    description: 'Tune web/search retrieval behavior',
    href: '/search-settings',
    icon: Search,
  },
  {
    key: 'backup',
    title: 'Backup & Restore',
    description: 'Protect setup with snapshots and restore jobs',
    href: '/backup-restore',
    icon: HardDrive,
  },
  {
    key: 'sso',
    title: 'Security & SSO',
    description: 'Apply auth hardening and access controls',
    href: '/sso',
    icon: ShieldCheck,
  },
];

const POPULAR_INTEGRATIONS = [
  { name: 'Obsidian', anchor: 'obsidian' },
  { name: 'Home Assistant', anchor: 'ha' },
  { name: 'Calendar', anchor: 'calendar' },
  { name: 'Git', anchor: 'git' },
  { name: 'Web Fetch', anchor: 'web' },
] as const;

type SetupStatus = {
  state: 'ready' | 'connected' | 'configured' | 'needs_setup' | 'error';
  detail: string;
  configured: boolean;
  connected: boolean;
  healthy: boolean;
};

type CatalogSetupRow = {
  configured?: boolean;
  linked?: boolean;
  runtime_status?: string;
  runtime_hooks?: {
    executionEnabled?: boolean;
    deployConfigured?: boolean;
    statusConfigured?: boolean;
  };
};

function statusBadgeClass(state: SetupStatus['state']): string {
  if (state === 'ready') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (state === 'connected') return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300';
  if (state === 'configured') return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300';
  if (state === 'error') return 'border-red-500/40 bg-red-500/10 text-red-300';
  return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
}

function statusLabel(state: SetupStatus['state']): string {
  if (state === 'ready') return 'Ready';
  if (state === 'connected') return 'Connected';
  if (state === 'configured') return 'Configured';
  if (state === 'error') return 'Error';
  return 'Needs Setup';
}

function composeSetupStatus(configured: boolean, connected: boolean, healthy: boolean, detail: string): SetupStatus {
  const normalizedConfigured = Boolean(configured);
  const normalizedConnected = Boolean(connected);
  const normalizedHealthy = Boolean(healthy);
  const state: SetupStatus['state'] = normalizedHealthy
    ? 'ready'
    : normalizedConnected
    ? 'connected'
    : normalizedConfigured
    ? 'configured'
    : 'needs_setup';
  return {
    state,
    detail,
    configured: normalizedConfigured,
    connected: normalizedConnected,
    healthy: normalizedHealthy,
  };
}

function isRuntimeHookReady(row: CatalogSetupRow): boolean {
  return (
    row.runtime_hooks?.executionEnabled === true
    && row.runtime_hooks?.deployConfigured === true
    && row.runtime_hooks?.statusConfigured === true
  );
}

export default function SetupPage() {
  const me = useMe();
  const health = useHealth();
  const library = useIntegrationLibrary();
  const catalog = useIntegrationsCatalog();
  const installProfile = useInstallIntegrationLibraryProfile();
  const coreReady = !me.isLoading && !library.isLoading && !catalog.isLoading && !health.isLoading;
  const settingsStageEnabled = coreReady;
  const settings = useSettings(settingsStageEnabled);
  const sso = useSsoSettings(settingsStageEnabled);
  const followupStageEnabled =
    settingsStageEnabled
    && !settings.isLoading
    && !sso.isLoading;
  const mcpServers = useMcpServers(followupStageEnabled);
  const models = useModels(followupStageEnabled);
  const searchConfig = useSearchSettingsConfig(followupStageEnabled);
  const searchConnectivity = useTestSearchConnectivity();
  const nasRoot = useNasList('/nas/shared', followupStageEnabled);
  const backupConfigs = useBackupConfigs(followupStageEnabled);

  const accountLabel =
    me.data?.active_organization_name || me.data?.active_organization_slug || 'current account';

  const catalogRows =
    Array.isArray((catalog.data as { data?: unknown[] } | undefined)?.data)
      ? (((catalog.data as { data?: unknown[] }).data || []) as CatalogSetupRow[])
      : [];
  const configuredCount = catalogRows.filter((row) => Boolean(row?.configured)).length;
  const linkedCount = catalogRows.filter((row) => Boolean(row?.linked)).length;
  const runtimeActiveCount = catalogRows.filter(
    (row) => Boolean(row?.configured) && String(row?.runtime_status || '').toLowerCase() === 'running',
  ).length;
  const runtimeHookReadyCount = catalogRows.filter(
    (row) => Boolean(row?.configured) && isRuntimeHookReady(row),
  ).length;
  const fullyReadyIntegrationCount = catalogRows.filter(
    (row) =>
      Boolean(row?.configured)
      && Boolean(row?.linked)
      && String(row?.runtime_status || '').toLowerCase() === 'running'
      && isRuntimeHookReady(row),
  ).length;
  const configuredButRuntimeInactiveCount = catalogRows.filter(
    (row) =>
      Boolean(row?.configured)
      && String(row?.runtime_status || '').toLowerCase() !== 'running',
  ).length;
  const configuredWithHookGapCount = catalogRows.filter(
    (row) => Boolean(row?.configured) && !isRuntimeHookReady(row),
  ).length;

  const profiles =
    Array.isArray((library.data as { data?: unknown[] } | undefined)?.data)
      ? (((library.data as { data?: unknown[] }).data || []) as Array<{
          id: string;
          name: string;
          description?: string;
          integration_ids?: string[];
        }>)
      : [];

  const mcpRows =
    Array.isArray((mcpServers.data as { data?: unknown[] } | undefined)?.data)
      ? (((mcpServers.data as { data?: unknown[] }).data || []) as unknown[])
      : [];
  const modelRows = Array.isArray(models.data?.rows) ? models.data.rows : [];
  const settingsRows = Array.isArray(settings.data?.rows) ? settings.data.rows : [];
  const backupRows = Array.isArray((backupConfigs.data as { configs?: unknown[] } | undefined)?.configs)
    ? (((backupConfigs.data as { configs?: unknown[] }).configs || []) as unknown[])
    : [];
  const secretConfiguredCount = settingsRows.filter((row) => {
    const rec = row as { key?: unknown; value?: unknown };
    const key = String(rec.key || '');
    if (!key.includes('secret') && !key.includes('_ref') && !key.includes('token_ref')) return false;
    const value = rec.value;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return true;
    return false;
  }).length;
  const hasSearchSettings = settingsRows.some((row) => String((row as { key?: unknown }).key || '').startsWith('search.'));
  const hasNasSettings = settingsRows.some((row) => String((row as { key?: unknown }).key || '').startsWith('nas.'));
  const ssoEnabled = Boolean((sso.data as { data?: { enabled?: boolean } } | undefined)?.data?.enabled);
  const searchConnectivityReachable =
    Boolean(searchConnectivity.data?.data && typeof searchConnectivity.data.data === 'object' && (searchConnectivity.data.data as { reachable?: unknown }).reachable === true);
  const searchConnectivityAttempted = Boolean(searchConnectivity.data || searchConnectivity.isError);
  const healthChecksRaw = Array.isArray((health.data as { checks?: unknown[] } | undefined)?.checks)
    ? (((health.data as { checks?: unknown[] }).checks || []) as Array<{ name?: unknown; status?: unknown }>)
    : [];
  const postgresHealthy = healthChecksRaw.some((check) => String(check.name || '') === 'postgres' && String(check.status || '') === 'pass');
  const natsHealthy = healthChecksRaw.some((check) => String(check.name || '') === 'nats' && String(check.status || '') === 'pass');
  const mcpConnectedCount = mcpRows.filter((row) => String((row as { status?: unknown }).status || '').toLowerCase() === 'connected').length;
  const nasConnected = !nasRoot.isError;
  const nasHealthy = nasConnected && Array.isArray((nasRoot.data as { entries?: unknown[] } | undefined)?.entries);

  const setupStatusByKey: Record<SetupLink['key'], SetupStatus> = {
    integrations: catalog.isError
      ? { state: 'error', detail: 'Catalog unavailable', configured: false, connected: false, healthy: false }
      : configuredCount > 0
      ? composeSetupStatus(
          configuredCount > 0,
          runtimeActiveCount > 0,
          configuredCount > 0 && fullyReadyIntegrationCount === configuredCount,
          configuredButRuntimeInactiveCount > 0
            ? `${configuredCount}/${catalogRows.length || 0} configured, ${runtimeActiveCount} runtime active, ${configuredButRuntimeInactiveCount} configured but runtime not active`
            : configuredWithHookGapCount > 0
            ? `${configuredCount}/${catalogRows.length || 0} configured, ${runtimeHookReadyCount} runtime-hook ready, ${configuredWithHookGapCount} missing runtime hook execution readiness`
            : `${configuredCount}/${catalogRows.length || 0} configured, ${runtimeActiveCount} runtime active, ${linkedCount} linked`,
        )
      : composeSetupStatus(false, false, false, 'No integrations configured yet'),
    mcp: mcpServers.isError
      ? { state: 'error', detail: 'MCP service unavailable', configured: false, connected: false, healthy: false }
      : mcpRows.length > 0
      ? composeSetupStatus(
          mcpRows.length > 0,
          mcpConnectedCount > 0,
          mcpConnectedCount > 0,
          `${mcpRows.length} server(s), ${mcpConnectedCount} connected`,
        )
      : composeSetupStatus(false, false, false, 'No MCP servers configured yet'),
    channels: linkedCount > 0
      ? composeSetupStatus(
          linkedCount > 0,
          runtimeActiveCount > 0,
          runtimeActiveCount > 0,
          `${linkedCount} linked integration channel(s); open Channels for live routing inventory`,
        )
      : composeSetupStatus(false, false, false, 'No linked channels detected yet'),
    llm: models.isError
      ? { state: 'error', detail: 'Model registry unavailable', configured: false, connected: false, healthy: false }
      : modelRows.length > 0
      ? composeSetupStatus(modelRows.length > 0, modelRows.length > 0, modelRows.length > 0, `${modelRows.length} model(s) configured`)
      : composeSetupStatus(false, false, false, 'No model providers configured yet'),
    secrets: settings.isError
      ? { state: 'error', detail: 'Settings unavailable', configured: false, connected: false, healthy: false }
      : secretConfiguredCount > 0
      ? composeSetupStatus(secretConfiguredCount > 0, secretConfiguredCount > 0, secretConfiguredCount > 0, `${secretConfiguredCount} secret reference(s) found`)
      : composeSetupStatus(false, false, false, 'No secret refs detected yet'),
    search: searchConfig.isError
      ? { state: 'error', detail: 'Search settings API unavailable', configured: hasSearchSettings, connected: false, healthy: false }
      : composeSetupStatus(
          hasSearchSettings,
          Boolean(searchConfig.data),
          hasSearchSettings && searchConnectivityReachable,
          hasSearchSettings
              ? searchConnectivityReachable
              ? 'Search configured and connectivity probe passed'
              : searchConnectivityAttempted
              ? 'Configured, but connectivity probe failed'
              : 'Configured, connectivity probe available on demand from Search Settings'
            : 'Search settings not configured yet',
        ),
    backup: backupConfigs.isError
      ? { state: 'error', detail: 'Backup config API unavailable', configured: false, connected: false, healthy: false }
      : backupRows.length > 0
      ? composeSetupStatus(backupRows.length > 0, backupRows.length > 0, backupRows.length > 0, `${backupRows.length} backup config(s)`)
      : composeSetupStatus(false, false, false, 'No backup configs yet'),
    sso: sso.isError
      ? { state: 'error', detail: 'SSO config unavailable', configured: false, connected: false, healthy: false }
      : ssoEnabled
      ? composeSetupStatus(true, true, true, 'SSO enabled')
      : composeSetupStatus(false, false, false, 'SSO disabled or not configured'),
  };

  const infraCards = [
    {
      key: 'postgres',
      title: 'Postgres',
      href: '/overview',
      status: composeSetupStatus(true, Boolean(health.data), postgresHealthy, postgresHealthy ? 'healthz postgres check passed' : 'postgres dependency probe failing'),
    },
    {
      key: 'nats',
      title: 'NATS',
      href: '/overview',
      status: composeSetupStatus(true, Boolean(health.data), natsHealthy, natsHealthy ? 'healthz nats check passed' : 'nats dependency probe failing'),
    },
    {
      key: 'opensearch',
      title: 'OpenSearch / Search',
      href: '/search-settings',
      status: composeSetupStatus(
        hasSearchSettings,
        Boolean(searchConfig.data),
        hasSearchSettings && searchConnectivityReachable,
        hasSearchSettings
          ? searchConnectivityReachable
            ? 'search config + connectivity test passed'
            : searchConnectivityAttempted
            ? 'configured but search test failed'
            : 'configured, probe available on demand'
          : 'not configured',
      ),
    },
    {
      key: 'nas',
      title: 'NAS',
      href: '/integrations#nas',
      status: composeSetupStatus(hasNasSettings, nasConnected, hasNasSettings && nasHealthy, nasHealthy ? 'nas list probe passed' : 'nas probe failed or unavailable'),
    },
  ] as const;

  async function installProfileNow(profileId: string, profileName: string) {
    try {
      const res = await installProfile.mutateAsync({
        profileId,
        payload: {
          deploy_runtime: true,
          overwrite_existing: false,
        },
      });
      const summary = res?.data;
      const nonExecuted = Number(summary?.runtime_non_executed_deploys || 0);
      const executionGuard = summary?.execution_guard_triggered === true;
      const executionNote =
        nonExecuted > 0
          ? `, ${nonExecuted} runtime deploy${nonExecuted === 1 ? '' : 's'} not executed`
          : '';
      toast.success(
        `${profileName}: ${Number(summary?.succeeded || 0)} succeeded, ${Number(summary?.failed || 0)} failed${executionNote}`,
      );
      if (executionGuard) {
        toast.error(
          `${profileName}: runtime execution is required and one or more deploys were not executed`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile install failed';
      toast.error(message);
    }
  }

  if (me.isLoading || library.isLoading || catalog.isLoading || health.isLoading) return <PageSpinner />;

  return (
    <>
      <PageHeader
        title="Setup Center"
        description="Install and configure Sven from Admin UI, with explicit runtime profile/env and credential-ref prerequisites where required."
      >
        <div className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
          Active account: <span className="font-semibold">{accountLabel}</span>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Catalog Entries</p>
          <p className="mt-2 text-2xl font-semibold">{catalogRows.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Configured</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">{configuredCount}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-400">Linked Tools</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-400">{linkedCount}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {infraCards.map((card) => (
          <Link key={card.key} href={card.href} className="card transition hover:border-cyan-400/60 hover:bg-slate-900/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{card.status.detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className={card.status.configured ? 'text-emerald-300' : 'text-amber-300'}>Configured</span>
                  <span>·</span>
                  <span className={card.status.connected ? 'text-emerald-300' : 'text-amber-300'}>Connected</span>
                  <span>·</span>
                  <span className={card.status.healthy ? 'text-emerald-300' : 'text-amber-300'}>Healthy</span>
                </div>
              </div>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(card.status.state)}`}>
                {statusLabel(card.status.state)}
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {SETUP_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card transition hover:border-cyan-400/60 hover:bg-slate-900/70"
          >
            <div className="flex items-start gap-3">
              <item.icon className="mt-1 h-5 w-5 text-cyan-300" />
              <div className="w-full">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                      setupStatusByKey[item.key].state,
                    )}`}
                  >
                    {statusLabel(setupStatusByKey[item.key].state)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                <p className="mt-1 text-xs text-slate-500">{setupStatusByKey[item.key].detail}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                  <span className={setupStatusByKey[item.key].configured ? 'text-emerald-300' : 'text-amber-300'}>Configured</span>
                  <span>·</span>
                  <span className={setupStatusByKey[item.key].connected ? 'text-emerald-300' : 'text-amber-300'}>Connected</span>
                  <span>·</span>
                  <span className={setupStatusByKey[item.key].healthy ? 'text-emerald-300' : 'text-amber-300'}>Healthy</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mb-6 card">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          <h2 className="text-base font-semibold">One-Click Profile Installs</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Profile install automates baseline setup, but some integrations/channels still require credential refs and
          runtime profile/env deployment wiring before they are fully operational.
        </p>
        {profiles.length === 0 ? (
          <p className="text-sm text-slate-400">No install profiles published yet.</p>
        ) : (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-700/70 p-3 lg:flex-row lg:items-center lg:justify-between"
              >
                <div>
                  <p className="font-semibold">{profile.name}</p>
                  <p className="text-sm text-slate-400">{profile.description || 'No description provided.'}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Integrations: {(profile.integration_ids || []).join(', ') || 'n/a'}
                  </p>
                </div>
                <button
                  className="btn-primary inline-flex items-center gap-1"
                  onClick={() => installProfileNow(profile.id, profile.name)}
                  disabled={installProfile.isPending}
                >
                  <Cable className="h-4 w-4" />
                  Install Profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-300" />
          <h2 className="text-base font-semibold">Popular Integration Paths</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {POPULAR_INTEGRATIONS.map((item) => (
            <Link
              key={item.anchor}
              href={`/integrations#${item.anchor}`}
              className="rounded-lg border border-slate-700/70 px-3 py-2 text-sm transition hover:border-cyan-400/60 hover:bg-slate-900/70"
            >
              <div className="flex items-center justify-between">
                <span>{item.name}</span>
                <CheckCircle2 className="h-4 w-4 text-slate-500" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
