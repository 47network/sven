'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useAllowlists,
  useCreateAllowlist,
  useDeleteAllowlist,
  useAllowlistOrphans,
  useAdoptAllowlistOrphans,
  useHaConfig,
  useHaDiscoveryEntities,
  useHaSubscriptions,
  useHaAutomations,
  useCreateHaAutomation,
  useDeleteHaAutomation,
  useCalendarAccounts,
  useCalendarSubscriptions,
  useAddCalendarAccount,
  useSubscribeCalendar,
  useUnsubscribeCalendar,
  useGitRepos,
  useWebAllowlist,
  useSettings,
  useSetSetting,
  useIntegrationRuntimeList,
  useIntegrationRuntimeBootEvents,
  useDeployIntegrationRuntime,
  useStopIntegrationRuntime,
  useReconcileIntegrationRuntime,
  useIntegrationsCatalog,
  useIntegrationLibrary,
  useIntegrationRecoveryPlaybookRuns,
  useIntegrationRecoveryPlaybookRun,
  useInstallIntegrationLibraryProfile,
  useApplyIntegrationTemplate,
  useValidateIntegration,
  useRunIntegrationRecoveryPlaybook,
  useMe,
  useObsidianSyncStatus,
  useObsidianExportMemories,
  useObsidianImportMemories,
} from '@/lib/hooks';
import { ApiError, api } from '@/lib/api';
import { Home, Calendar, GitBranch, Globe, Trash2, Plus, Sparkles } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Row = Record<string, unknown>;
type IntegrationStat = { label: string; value: number };
type IntegrationCard = {
  name: string;
  icon: typeof Home;
  connected: boolean;
  stats: IntegrationStat[];
  href: string;
  color: string;
};

type RuntimeStatus = 'stopped' | 'deploying' | 'running' | 'error';
type RuntimeRow = {
  integration_type: string;
  status?: RuntimeStatus;
  runtime_mode?: 'container' | 'local_worker';
  storage_path?: string | null;
};

type CatalogRow = {
  id: string;
  name: string;
  runtime_type: string;
  configuration_mode: 'settings' | 'table' | 'hybrid' | 'none';
  linked: boolean;
  configured: boolean;
  available_tools_count: number;
  required_settings: Array<{ key: string; configured: boolean; value_present: boolean }>;
  table_name?: string | null;
  table_count?: number;
  runtime_status: string;
};

type RetrySummary = {
  attempted: number;
  skipped: number;
  ready: number;
  failed: number;
  elapsedSec: number;
  completedAt: string;
};

const RECOMMENDED_INTEGRATION_IDS = ['obsidian', 'device', 'web', 'nas', 'ha'] as const;

function rowList(payload: unknown): Row[] {
  if (!payload || typeof payload !== 'object') return [];
  const rec = payload as Record<string, unknown>;
  const candidates = [rec.rows, rec.data, rec.accounts, rec.subscriptions, rec.entries];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((v): v is Row => typeof v === 'object' && v !== null);
    }
  }
  return [];
}

function rowStr(row: Row, key: string): string | undefined {
  const v = row[key];
  return typeof v === 'string' ? v : undefined;
}

function rowNum(row: Row, key: string): number | undefined {
  const v = row[key];
  return typeof v === 'number' ? v : undefined;
}

function runtimeBadgeClass(status: RuntimeStatus | undefined): string {
  if (status === 'running') return 'badge-success';
  if (status === 'deploying') return 'badge-warning';
  if (status === 'error') return 'badge-danger';
  return 'badge-neutral';
}

function installStageBadgeClass(stage?: string): string {
  const normalized = String(stage || '').toLowerCase();
  if (!normalized) return 'badge-neutral';
  if (normalized.includes('ready') || normalized.includes('complete')) return 'badge-success';
  if (normalized.includes('partial')) return 'badge-warning';
  if (normalized.includes('failed') || normalized.includes('error')) return 'badge-danger';
  if (
    normalized.includes('install') ||
    normalized.includes('template') ||
    normalized.includes('validat') ||
    normalized.includes('deploy')
  ) {
    return 'badge-warning';
  }
  return 'badge-neutral';
}

function bootEventIntegration(row: Record<string, unknown>): string {
  const toolName = String(row.tool_name || '');
  return String(row.integration_type || toolName.replace(/^integration\.runtime\./, '') || toolName).trim();
}

function IntegrationsPageContent() {
  const RETRY_SUMMARY_STORAGE_KEY_PREFIX = 'sven.admin47.integrations.lastBulkRetrySummary';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams?.toString() ?? '';
  const [allowType, setAllowType] = useState<'ha_entity' | 'ha_service'>('ha_entity');
  const [allowPattern, setAllowPattern] = useState('');
  const [allowTier, setAllowTier] = useState(1);
  const [haDiscoveryDomain, setHaDiscoveryDomain] = useState('');

  const [automationName, setAutomationName] = useState('');
  const [automationChatId, setAutomationChatId] = useState('');
  const [automationDescription, setAutomationDescription] = useState('');

  const [calendarProvider, setCalendarProvider] = useState<'radicale' | 'google'>('radicale');
  const [calendarAccountName, setCalendarAccountName] = useState('');
  const [calendarUsername, setCalendarUsername] = useState('');
  const [calendarPasswordRef, setCalendarPasswordRef] = useState('');
  const [calendarGoogleEmail, setCalendarGoogleEmail] = useState('');

  const [subscriptionAccountId, setSubscriptionAccountId] = useState('');
  const [subscriptionCalendarId, setSubscriptionCalendarId] = useState('');
  const [subscriptionCalendarName, setSubscriptionCalendarName] = useState('');

  const [obsidianVaultPath, setObsidianVaultPath] = useState('');
  const [obsidianSyncFolder, setObsidianSyncFolder] = useState('Sven Memories');
  const [frigateBaseUrl, setFrigateBaseUrl] = useState('');
  const [frigateTokenRef, setFrigateTokenRef] = useState('');
  const [spotifyClientId, setSpotifyClientId] = useState('');
  const [spotifySecretRef, setSpotifySecretRef] = useState('');
  const [sonosTokenRef, setSonosTokenRef] = useState('');
  const [shazamTokenRef, setShazamTokenRef] = useState('');
  const [autoStartOnToolUse, setAutoStartOnToolUse] = useState(true);
  const [autoConfigureOnToolUse, setAutoConfigureOnToolUse] = useState(true);
  const [appStoreQuery, setAppStoreQuery] = useState('');
  const [bootFilterStatus, setBootFilterStatus] = useState('');
  const [bootFilterIntegration, setBootFilterIntegration] = useState('');
  const [bootFilterChatId, setBootFilterChatId] = useState('');
  const [bulkTemplateOverwrite, setBulkTemplateOverwrite] = useState(false);
  const [selectedRecoveryRunId, setSelectedRecoveryRunId] = useState('');
  const [historyHasFailures, setHistoryHasFailures] = useState<'all' | 'true' | 'false'>('all');
  const [historyRunStatus, setHistoryRunStatus] = useState<'all' | 'in_progress' | 'completed' | 'failed'>('all');
  const [historyActorUserId, setHistoryActorUserId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(25);
  const [historyOrder, setHistoryOrder] = useState<'asc' | 'desc'>('desc');
  const [historyRefreshMs, setHistoryRefreshMs] = useState(15_000);
  const [playbookCooldownActive, setPlaybookCooldownActive] = useState(false);
  const [historyUrlHydrated, setHistoryUrlHydrated] = useState(false);
  const [historyLastUpdatedAt, setHistoryLastUpdatedAt] = useState('');
  const [prepareInFlightId, setPrepareInFlightId] = useState('');
  const [prepareAllInFlight, setPrepareAllInFlight] = useState(false);
  const [installPrepareProfileInFlight, setInstallPrepareProfileInFlight] = useState('');
  const [installPrepareRowInFlightId, setInstallPrepareRowInFlightId] = useState('');
  const [installPrepareRowStageById, setInstallPrepareRowStageById] = useState<Record<string, string>>({});
  const [installPrepareRowDetailById, setInstallPrepareRowDetailById] = useState<Record<string, string>>({});
  const [installPrepareRowUpdatedAtById, setInstallPrepareRowUpdatedAtById] = useState<Record<string, string>>({});
  const [showOnlyFailedDiagnostics, setShowOnlyFailedDiagnostics] = useState(false);
  const [diagnosticFocusedRowId, setDiagnosticFocusedRowId] = useState('');
  const [lastBulkRetrySummary, setLastBulkRetrySummary] = useState<RetrySummary | null>(null);
  const actorFilterInputRef = useRef<HTMLInputElement | null>(null);

  const { data: haConfig, isLoading: haL } = useHaConfig();
  const haDiscovery = useHaDiscoveryEntities({
    domain: haDiscoveryDomain.trim() || undefined,
    limit: 50,
    enabled: false,
  });
  const { data: allowlists } = useAllowlists();
  const { data: orphanData } = useAllowlistOrphans({ limit: 100 });
  const adoptOrphans = useAdoptAllowlistOrphans();
  const createAllowlist = useCreateAllowlist();
  const deleteAllowlist = useDeleteAllowlist();

  const { data: haSubs } = useHaSubscriptions();
  const { data: haAuto } = useHaAutomations();
  const createAutomation = useCreateHaAutomation();
  const deleteAutomation = useDeleteHaAutomation();

  const { data: calAccounts, isLoading: calL } = useCalendarAccounts();
  const { data: calSubs } = useCalendarSubscriptions();
  const addCalendarAccount = useAddCalendarAccount();
  const subscribeCalendar = useSubscribeCalendar();
  const unsubscribeCalendar = useUnsubscribeCalendar();

  const { data: gitRepos, isLoading: gitL } = useGitRepos();
  const { data: webAllow, isLoading: webL } = useWebAllowlist();
  const { data: settingsData, isLoading: settingsL } = useSettings();
  const { data: runtimeListData, isLoading: runtimeL } = useIntegrationRuntimeList();
  const { data: bootEventsData } = useIntegrationRuntimeBootEvents({
    limit: 25,
    status: bootFilterStatus || undefined,
    integration_type: bootFilterIntegration || undefined,
    chat_id: bootFilterChatId || undefined,
  });
  const { data: catalogData, isLoading: catalogL } = useIntegrationsCatalog();
  const { data: integrationLibraryData } = useIntegrationLibrary();
  const { data: recoveryRunData, refetch: refetchRecoveryRuns } = useIntegrationRecoveryPlaybookRuns({
    limit: historyLimit,
    page: historyPage,
    has_failures: historyHasFailures === 'all' ? undefined : historyHasFailures === 'true',
    run_status: historyRunStatus === 'all' ? undefined : historyRunStatus,
    actor_user_id: historyActorUserId.trim() || undefined,
    from: historyFrom || undefined,
    to: historyTo || undefined,
    sort: 'created_at',
    order: historyOrder,
    refetch_interval_ms: historyRefreshMs,
  });
  const { data: selectedRecoveryRunData } = useIntegrationRecoveryPlaybookRun(selectedRecoveryRunId || undefined);
  const deployRuntime = useDeployIntegrationRuntime();
  const stopRuntime = useStopIntegrationRuntime();
  const reconcileRuntime = useReconcileIntegrationRuntime();
  const installLibraryProfile = useInstallIntegrationLibraryProfile();
  const applyTemplate = useApplyIntegrationTemplate();
  const validateIntegration = useValidateIntegration();
  const runRecoveryPlaybookMutation = useRunIntegrationRecoveryPlaybook();
  const obsidianSyncStatus = useObsidianSyncStatus(true);
  const exportObsidianMemories = useObsidianExportMemories();
  const importObsidianMemories = useObsidianImportMemories();
  const setSetting = useSetSetting();
  const me = useMe();
  const activeAccountStorageScope =
    String(
      (me.data as Record<string, unknown> | undefined)?.active_organization_id ||
      (me.data as Record<string, unknown> | undefined)?.active_account_id ||
      'global',
    ).trim() || 'global';
  const retrySummaryStorageKey = `${RETRY_SUMMARY_STORAGE_KEY_PREFIX}.${activeAccountStorageScope}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(retrySummaryStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<RetrySummary>;
      if (
        typeof parsed.attempted === 'number' &&
        typeof parsed.skipped === 'number' &&
        typeof parsed.ready === 'number' &&
        typeof parsed.failed === 'number' &&
        typeof parsed.elapsedSec === 'number' &&
        typeof parsed.completedAt === 'string'
      ) {
        setLastBulkRetrySummary({
          attempted: parsed.attempted,
          skipped: parsed.skipped,
          ready: parsed.ready,
          failed: parsed.failed,
          elapsedSec: parsed.elapsedSec,
          completedAt: parsed.completedAt,
        });
      }
    } catch {
      // Ignore malformed persisted state.
    }
  }, [retrySummaryStorageKey]);

  useEffect(() => {
    const rows = Array.isArray(settingsData?.rows) ? settingsData.rows : [];
    const map = new Map<string, unknown>();
    for (const row of rows) {
      if (row && typeof row === 'object') {
        const rec = row as Record<string, unknown>;
        if (typeof rec.key === 'string') map.set(rec.key, rec.value);
      }
    }
    const readString = (key: string) => {
      const raw = map.get(key);
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      return '';
    };
    const readBool = (key: string, fallback: boolean) => {
      const raw = map.get(key);
      if (typeof raw === 'boolean') return raw;
      if (typeof raw === 'number') return raw !== 0;
      if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      }
      return fallback;
    };

    setObsidianVaultPath(readString('obsidian.vault_path'));
    setFrigateBaseUrl(readString('frigate.base_url'));
    setFrigateTokenRef(readString('frigate.token_ref'));
    setSpotifyClientId(readString('spotify.client_id'));
    setSpotifySecretRef(readString('spotify.client_secret_ref'));
    setSonosTokenRef(readString('sonos.access_token_ref'));
    setShazamTokenRef(readString('shazam.api_token_ref'));
    setAutoStartOnToolUse(readBool('integrations.runtime.auto_start_on_tool_use', true));
    setAutoConfigureOnToolUse(readBool('integrations.runtime.auto_configure_on_tool_use', true));
  }, [settingsData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (!lastBulkRetrySummary) {
        window.localStorage.removeItem(retrySummaryStorageKey);
        return;
      }
      window.localStorage.setItem(retrySummaryStorageKey, JSON.stringify(lastBulkRetrySummary));
    } catch {
      // Ignore storage errors.
    }
  }, [lastBulkRetrySummary, retrySummaryStorageKey]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyHasFailures, historyRunStatus, historyActorUserId, historyFrom, historyTo, historyOrder, historyLimit]);

  useEffect(() => {
    const readParam = (key: string, fallback = '') => String(searchParams?.get(key) || fallback);
    const hasFailures = readParam('hist_failures', 'all');
    const runStatus = readParam('hist_status', 'all');
    const selectedRun = readParam('hist_run');
    const actor = readParam('hist_actor');
    const from = readParam('hist_from');
    const to = readParam('hist_to');
    const order = readParam('hist_order', 'desc');
    const live = Number(readParam('hist_live', '15000'));
    const limit = Number(readParam('hist_limit', '25'));
    const page = Number(readParam('hist_page', '1'));

    if (hasFailures === 'all' || hasFailures === 'true' || hasFailures === 'false') {
      setHistoryHasFailures(hasFailures as 'all' | 'true' | 'false');
    }
    if (runStatus === 'all' || runStatus === 'in_progress' || runStatus === 'completed' || runStatus === 'failed') {
      setHistoryRunStatus(runStatus as 'all' | 'in_progress' | 'completed' | 'failed');
    }
    setSelectedRecoveryRunId(selectedRun);
    setHistoryActorUserId(actor);
    setHistoryFrom(from);
    setHistoryTo(to);
    if (order === 'asc' || order === 'desc') setHistoryOrder(order);
    if (Number.isFinite(live)) setHistoryRefreshMs(Math.max(0, Math.min(30000, Math.trunc(live))));
    if (Number.isFinite(limit)) setHistoryLimit(Math.max(5, Math.min(100, Math.trunc(limit))));
    if (Number.isFinite(page)) setHistoryPage(Math.max(1, Math.trunc(page)));
    setHistoryUrlHydrated(true);
  }, [searchParams]);

  useEffect(() => {
    if (!historyUrlHydrated) return;
    const qs = new URLSearchParams(searchParamsString);
    qs.set('hist_failures', historyHasFailures);
    qs.set('hist_status', historyRunStatus);
    if (historyActorUserId.trim()) qs.set('hist_actor', historyActorUserId.trim());
    else qs.delete('hist_actor');
    if (historyFrom) qs.set('hist_from', historyFrom);
    else qs.delete('hist_from');
    if (historyTo) qs.set('hist_to', historyTo);
    else qs.delete('hist_to');
    if (selectedRecoveryRunId) qs.set('hist_run', selectedRecoveryRunId);
    else qs.delete('hist_run');
    qs.set('hist_order', historyOrder);
    qs.set('hist_live', String(historyRefreshMs));
    qs.set('hist_limit', String(historyLimit));
    qs.set('hist_page', String(historyPage));
    const nextQuery = qs.toString();
    const currentQuery = searchParamsString;
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [
    historyUrlHydrated,
    historyHasFailures,
    historyRunStatus,
    historyActorUserId,
    historyFrom,
    historyTo,
    selectedRecoveryRunId,
    historyOrder,
    historyRefreshMs,
    historyLimit,
    historyPage,
    pathname,
    router,
    searchParamsString,
  ]);

  const runtimeRows = useMemo(() => {
    const payload = runtimeListData && typeof runtimeListData === 'object' ? (runtimeListData as Record<string, unknown>) : {};
    const entries = Array.isArray(payload.data) ? payload.data : [];
    return entries.filter((entry): entry is RuntimeRow => typeof entry === 'object' && entry !== null);
  }, [runtimeListData]);

  const runtimeByType = useMemo(() => {
    const map = new Map<string, RuntimeRow>();
    for (const row of runtimeRows) {
      const type = String(row.integration_type || '').trim().toLowerCase();
      if (type) map.set(type, row);
    }
    return map;
  }, [runtimeRows]);

  const isLoading = haL || calL || gitL || webL || settingsL || runtimeL || catalogL;

  async function applySettings(entries: Array<{ key: string; value: unknown }>, successMessage: string) {
    try {
      for (const entry of entries) {
        await setSetting.mutateAsync({ key: entry.key, value: entry.value });
      }
      toast.success(successMessage);
    } catch {
      toast.error('Failed to apply integration settings');
    }
  }

  const haConfigRecord =
    haConfig && typeof haConfig === 'object' ? (haConfig as Record<string, unknown>) : {};
  const haConfigData =
    haConfigRecord.data && typeof haConfigRecord.data === 'object'
      ? (haConfigRecord.data as Record<string, unknown>)
      : {};
  const hasHaConfigured =
    Boolean(haConfigData.configured) ||
    Boolean(haConfigRecord.configured) ||
    Boolean(haConfigRecord.url);

  const allowlistRows = rowList(allowlists).filter((entry) => {
    const type = rowStr(entry, 'type');
    return type === 'ha_entity' || type === 'ha_service';
  });
  const haDiscoveryPayload =
    haDiscovery.data && typeof haDiscovery.data === 'object'
      ? (haDiscovery.data as Record<string, unknown>)
      : {};
  const haDiscoveryData =
    haDiscoveryPayload.data && typeof haDiscoveryPayload.data === 'object'
      ? (haDiscoveryPayload.data as Record<string, unknown>)
      : {};
  const discoveredHaEntities = Array.isArray(haDiscoveryData.rows)
    ? (haDiscoveryData.rows as Row[])
    : [];
  const orphanPayload =
    orphanData && typeof orphanData === 'object' ? (orphanData as Record<string, unknown>) : {};
  const orphanNode =
    orphanPayload.data && typeof orphanPayload.data === 'object'
      ? (orphanPayload.data as Record<string, unknown>)
      : {};
  const orphanRows = Array.isArray(orphanNode.rows) ? (orphanNode.rows as Row[]) : [];
  const orphanTotal = Number(orphanNode.total || 0);
  const automationRows = rowList(haAuto);
  const calendarAccountRows = rowList(calAccounts);
  const calendarSubscriptionRows = rowList(calSubs);
  const gitRows = rowList(gitRepos);
  const webRows = rowList(webAllow);
  const catalogRows = Array.isArray((catalogData as Record<string, unknown> | undefined)?.data)
    ? ((catalogData as Record<string, unknown>).data as CatalogRow[])
    : [];
  const bootEvents = Array.isArray((bootEventsData as Record<string, unknown> | undefined)?.data)
    ? ((bootEventsData as Record<string, unknown>).data as Array<Record<string, unknown>>)
    : [];
  const libraryProfiles = Array.isArray((integrationLibraryData as Record<string, unknown> | undefined)?.data)
    ? (((integrationLibraryData as Record<string, unknown>).data as Array<Record<string, unknown>>).filter(
        (row): row is Record<string, unknown> => !!row && typeof row === 'object',
      ))
    : [];
  const recommendedProfile = libraryProfiles.find((profile) => String(profile.id || '') === 'recommended-local');
  const fullProfile = libraryProfiles.find((profile) => String(profile.id || '') === 'full-ecosystem');
  const recoveryRuns = Array.isArray((recoveryRunData as Record<string, unknown> | undefined)?.data)
    ? ((recoveryRunData as Record<string, unknown>).data as Array<Record<string, unknown>>)
    : [];
  useEffect(() => {
    setHistoryLastUpdatedAt(new Date().toISOString());
  }, [recoveryRunData]);
  const recoveryRunsMeta =
    recoveryRunData && typeof recoveryRunData === 'object'
      ? (((recoveryRunData as Record<string, unknown>).meta as Record<string, unknown> | undefined) || undefined)
      : undefined;
  const selectedRecoveryRun =
    selectedRecoveryRunData && typeof selectedRecoveryRunData === 'object'
      ? ((selectedRecoveryRunData as Record<string, unknown>).data as Record<string, unknown> | undefined)
      : undefined;
  const recoveryStatusCounts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let failed = 0;
    const metaCounts =
      recoveryRunsMeta &&
      typeof recoveryRunsMeta === 'object' &&
      recoveryRunsMeta.status_counts &&
      typeof recoveryRunsMeta.status_counts === 'object'
        ? (recoveryRunsMeta.status_counts as Record<string, unknown>)
        : null;
    if (metaCounts) {
      return {
        inProgress: Number(metaCounts.in_progress || 0),
        completed: Number(metaCounts.completed || 0),
        failed: Number(metaCounts.failed || 0),
      };
    }
    for (const row of recoveryRuns) {
      const status = String(row.run_status || 'completed').toLowerCase();
      if (status === 'in_progress') inProgress += 1;
      else if (status === 'failed') failed += 1;
      else completed += 1;
    }
    return { inProgress, completed, failed };
  }, [recoveryRuns, recoveryRunsMeta]);
  const recoveryRunsCsvUrl = api.integrations.recoveryPlaybookRunsCsvUrl({
    limit: historyLimit,
    page: historyPage,
    has_failures: historyHasFailures === 'all' ? undefined : historyHasFailures === 'true',
    run_status: historyRunStatus === 'all' ? undefined : historyRunStatus,
    actor_user_id: historyActorUserId.trim() || undefined,
    from: historyFrom || undefined,
    to: historyTo || undefined,
    sort: 'created_at',
    order: historyOrder,
  });
  const stoppedCatalogRuntimeTypes = useMemo(
    () =>
      [...new Set(
        catalogRows
          .filter((row) => String(row.runtime_status || '').toLowerCase() === 'stopped')
          .map((row) => String(row.runtime_type || '').trim())
          .filter(Boolean),
      )],
    [catalogRows],
  );
  const unconfiguredIntegrationIds = useMemo(
    () =>
      catalogRows
        .filter((row) => !row.configured)
        .map((row) => String(row.id || '').trim())
        .filter(Boolean),
    [catalogRows],
  );
  const failedBootIntegrations = useMemo(() => {
    const failed = bootEvents
      .filter((row) => String(row.status || '').toLowerCase() === 'error')
      .map((row) => bootEventIntegration(row))
      .filter(Boolean);
    return [...new Set(failed)];
  }, [bootEvents]);
  const failedOrPartialDiagnosticRows = useMemo(
    () =>
      catalogRows.filter((row) => {
        const stage = String(installPrepareRowStageById[row.id] || '').toLowerCase();
        return stage === 'partial readiness' || stage === 'failed';
      }),
    [catalogRows, installPrepareRowStageById],
  );
  const visibleCatalogRows = useMemo(
    () => (showOnlyFailedDiagnostics ? failedOrPartialDiagnosticRows : catalogRows),
    [showOnlyFailedDiagnostics, failedOrPartialDiagnosticRows, catalogRows],
  );
  const filteredAppStoreRows = useMemo(() => {
    const q = appStoreQuery.trim().toLowerCase();
    if (!q) return catalogRows;
    return catalogRows.filter((row) =>
      [row.id, row.name, row.runtime_type, row.configuration_mode]
        .map((value) => String(value || '').toLowerCase())
        .some((value) => value.includes(q)),
    );
  }, [appStoreQuery, catalogRows]);

  function activatePlaybookCooldown(ms = 3000) {
    setPlaybookCooldownActive(true);
    window.setTimeout(() => setPlaybookCooldownActive(false), ms);
  }

  async function deployIntegrationRuntime(integrationType: string, imageRef?: string, options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    try {
      await deployRuntime.mutateAsync({
        integrationType,
        payload: {
          runtime_mode: 'container',
          image_ref: imageRef,
        },
      });
      if (!silent) toast.success(`${integrationType} runtime deployed`);
    } catch {
      if (!silent) toast.error(`Failed to deploy ${integrationType} runtime`);
      throw new Error(`deploy failed: ${integrationType}`);
    }
  }

  async function stopIntegrationRuntime(integrationType: string) {
    try {
      await stopRuntime.mutateAsync(integrationType);
      toast.success(`${integrationType} runtime stopped`);
    } catch {
      toast.error(`Failed to stop ${integrationType} runtime`);
    }
  }

  async function reconcileIntegrationRuntime() {
    try {
      const result = await reconcileRuntime.mutateAsync();
      const report = result.data;
      const drift = Number(report?.drift_detected || 0);
      const healed = Number(report?.autoheal_succeeded || 0);
      const scanned = Number(report?.scanned || 0);
      toast.success(`Reconciled ${scanned} runtime(s) | drift=${drift} | healed=${healed}`);
    } catch {
      toast.error('Failed to reconcile integration runtimes');
    }
  }

  async function retryAllFailedDeploys() {
    if (failedBootIntegrations.length === 0) {
      toast.message('No failed boot events to retry.');
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    for (const integrationType of failedBootIntegrations) {
      try {
        await deployIntegrationRuntime(integrationType, undefined, { silent: true });
        successCount += 1;
      } catch {
        errorCount += 1;
      }
    }
    if (errorCount > 0) {
      toast.error(`Retried ${successCount} runtime(s), ${errorCount} failed.`);
    } else {
      toast.success(`Retried ${successCount} failed runtime(s).`);
    }
  }

  async function deployAllStoppedRuntimes() {
    if (stoppedCatalogRuntimeTypes.length === 0) {
      toast.message('No stopped runtimes to deploy.');
      return;
    }
    let successCount = 0;
    let errorCount = 0;
    for (const runtimeType of stoppedCatalogRuntimeTypes) {
      try {
        await deployIntegrationRuntime(runtimeType, undefined, { silent: true });
        successCount += 1;
      } catch {
        errorCount += 1;
      }
    }
    if (errorCount > 0) {
      toast.error(`Deployed ${successCount} runtime(s), ${errorCount} failed.`);
    } else {
      toast.success(`Deployed ${successCount} stopped runtime(s).`);
    }
  }

  async function applyIntegrationTemplateCore(
    integrationId: string,
    options?: { silent?: boolean; overwriteExisting?: boolean; deployRuntime?: boolean },
  ) {
    const silent = options?.silent === true;
    try {
      const result = await applyTemplate.mutateAsync({
        integrationId,
        payload: {
          deploy_runtime: options?.deployRuntime === true,
          overwrite_existing: options?.overwriteExisting === true,
        },
      });
      const applied = Array.isArray(result.data?.applied_settings) ? result.data.applied_settings.length : 0;
      if (!silent) toast.success(`Template applied (${applied} setting${applied === 1 ? '' : 's'})`);
      return { ok: true, applied };
    } catch {
      if (!silent) toast.error(`Failed to apply template for ${integrationId}`);
      return { ok: false, applied: 0 };
    }
  }

  async function applyIntegrationTemplate(integrationId: string) {
    await applyIntegrationTemplateCore(integrationId, {
      silent: false,
      overwriteExisting: bulkTemplateOverwrite,
      deployRuntime: false,
    });
  }

  async function prepareIntegrationForSven(row: CatalogRow, options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    const label = row.name || row.id;
    if (!silent) setPrepareInFlightId(row.id);
    try {
      let templateOk = true;
      let validatedOk = false;
      let deployOk = true;

      if (!row.configured || bulkTemplateOverwrite) {
        const templateResult = await applyIntegrationTemplateCore(row.id, {
          silent: true,
          overwriteExisting: bulkTemplateOverwrite,
          deployRuntime: false,
        });
        templateOk = templateResult.ok;
      }

      const validationResult = await runIntegrationValidation(row.id, { silent: true });
      validatedOk = Boolean(validationResult?.ok);

      if (String(row.runtime_status || '').toLowerCase() !== 'running') {
        try {
          await deployIntegrationRuntime(row.runtime_type, undefined, { silent: true });
          deployOk = true;
        } catch {
          deployOk = false;
        }
      }

      const ok = templateOk && validatedOk && deployOk;
      if (!silent) {
        if (ok) {
          toast.success(`${label}: ready for Sven (template, validate, deploy complete)`);
        } else {
          const parts = [
            `template:${templateOk ? 'ok' : 'failed'}`,
            `validate:${validatedOk ? 'ok' : 'failed'}`,
            `deploy:${deployOk ? 'ok' : 'failed'}`,
          ];
          toast.warning(`${label}: partial readiness (${parts.join(' | ')})`);
        }
      }
      return { ok, templateOk, validatedOk, deployOk };
    } finally {
      if (!silent) setPrepareInFlightId('');
    }
  }

  async function prepareAllIntegrationsForSven() {
    if (catalogRows.length === 0) {
      toast.info('No integrations available to prepare');
      return;
    }
    setPrepareAllInFlight(true);
    let ready = 0;
    let partial = 0;
    try {
      for (const row of catalogRows) {
        const result = await prepareIntegrationForSven(row, { silent: true });
        if (result.ok) ready += 1;
        else partial += 1;
      }
    } finally {
      setPrepareAllInFlight(false);
    }
    if (partial === 0) {
      toast.success(`All integrations ready for Sven (${ready}/${catalogRows.length})`);
      return;
    }
    toast.warning(`Preparation complete: ready ${ready}/${catalogRows.length}, partial ${partial}`);
  }

  async function installAndPrepareSingleIntegration(row: CatalogRow, options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    const touch = (stage: string, detail = '') => {
      setInstallPrepareRowStageById((prev) => ({ ...prev, [row.id]: stage }));
      setInstallPrepareRowDetailById((prev) => ({ ...prev, [row.id]: detail }));
      setInstallPrepareRowUpdatedAtById((prev) => ({ ...prev, [row.id]: new Date().toISOString() }));
    };
    setInstallPrepareRowInFlightId(row.id);
    touch('installing profile');
    try {
      await installLibraryProfile.mutateAsync({
        profileId: 'full-ecosystem',
        payload: {
          deploy_runtime: true,
          overwrite_existing: false,
          integration_ids: [row.id],
        },
      });
      const latestCatalogResult = await api.integrations.catalog();
      const latestCatalogRows = Array.isArray(latestCatalogResult?.data)
        ? (latestCatalogResult.data as CatalogRow[])
        : [];
      const target = latestCatalogRows.find((entry) => String(entry.id || '') === row.id) || row;
      let templateOk = true;
      let validatedOk = false;
      let deployOk = true;

      if (!target.configured || bulkTemplateOverwrite) {
        touch('applying template');
        const templateResult = await applyIntegrationTemplateCore(target.id, {
          silent: true,
          overwriteExisting: bulkTemplateOverwrite,
          deployRuntime: false,
        });
        templateOk = templateResult.ok;
      }

      touch('validating');
      const validationResult = await runIntegrationValidation(target.id, { silent: true });
      validatedOk = Boolean(validationResult?.ok);
      const validationFailed = Array.isArray(validationResult?.failedLabels)
        ? validationResult.failedLabels.filter(Boolean)
        : [];

      if (String(target.runtime_status || '').toLowerCase() !== 'running') {
        touch('deploying runtime');
        try {
          await deployIntegrationRuntime(target.runtime_type, undefined, { silent: true });
          deployOk = true;
        } catch {
          deployOk = false;
        }
      }

      const ok = templateOk && validatedOk && deployOk;
      if (ok) {
        touch('ready');
        if (!silent) toast.success(`${row.name || row.id}: install + prepare complete`);
      } else {
        const reasons: string[] = [];
        if (!templateOk) reasons.push('template apply failed');
        if (!validatedOk) {
          reasons.push(
            validationFailed.length > 0
              ? `validation failed (${validationFailed.join(', ')})`
              : 'validation failed',
          );
        }
        if (!deployOk) reasons.push('runtime deploy failed');
        touch('partial readiness', reasons.join(' | '));
        if (!silent) toast.warning(`${row.name || row.id}: install complete, prepare partial`);
      }
      return ok;
    } catch {
      touch('failed', 'install or preparation request failed');
      if (!silent) toast.error(`${row.name || row.id}: install + prepare failed`);
      return false;
    } finally {
      setInstallPrepareRowInFlightId('');
    }
  }

  async function copyRowDiagnostics(row: CatalogRow) {
    try {
      if (typeof window === 'undefined') return;
      const stage = installPrepareRowStageById[row.id] || 'n/a';
      const detail = installPrepareRowDetailById[row.id] || 'none';
      const updatedAt = installPrepareRowUpdatedAtById[row.id] || new Date().toISOString();
      const text = [
        `integration_id=${row.id}`,
        `integration_name=${row.name}`,
        `runtime_type=${row.runtime_type}`,
        `stage=${stage}`,
        `detail=${detail}`,
        `updated_at=${updatedAt}`,
      ].join('\n');
      await navigator.clipboard.writeText(text);
      toast.success(`${row.name || row.id}: diagnostics copied`);
    } catch {
      toast.error(`${row.name || row.id}: failed to copy diagnostics`);
    }
  }

  async function copyAllFailedDiagnostics() {
    try {
      if (typeof window === 'undefined') return;
      const failedRows = failedOrPartialDiagnosticRows;
      if (failedRows.length === 0) {
        toast.info('No failed/partial integration diagnostics to copy');
        return;
      }
      const sections = failedRows.map((row) => {
        const stage = installPrepareRowStageById[row.id] || 'n/a';
        const detail = installPrepareRowDetailById[row.id] || 'none';
        const updatedAt = installPrepareRowUpdatedAtById[row.id] || '';
        return [
          `integration_id=${row.id}`,
          `integration_name=${row.name}`,
          `runtime_type=${row.runtime_type}`,
          `stage=${stage}`,
          `detail=${detail}`,
          `updated_at=${updatedAt}`,
        ].join('\n');
      });
      await navigator.clipboard.writeText(sections.join('\n\n---\n\n'));
      toast.success(`Copied diagnostics for ${failedRows.length} failed/partial integration(s)`);
    } catch {
      toast.error('Failed to copy failed diagnostics');
    }
  }

  function focusIntegrationDiagnosticRow(row: CatalogRow) {
    if (typeof window === 'undefined') return;
    setDiagnosticFocusedRowId(row.id);
    window.setTimeout(() => {
      const target = document.getElementById(`catalog-row-${encodeURIComponent(row.id)}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    window.setTimeout(() => setDiagnosticFocusedRowId(''), 3500);
  }

  async function retryFailedDiagnosticsRows() {
    const startedAt = Date.now();
    const targets = failedOrPartialDiagnosticRows;
    if (targets.length === 0) {
      toast.info('No failed/partial rows to retry');
      return;
    }
    let ready = 0;
    let skipped = 0;
    const stillFailedRows: CatalogRow[] = [];
    for (const row of targets) {
      const latestStage = String(installPrepareRowStageById[row.id] || '').toLowerCase();
      const stillFailing = latestStage === 'partial readiness' || latestStage === 'failed';
      if (!stillFailing || installPrepareRowInFlightId === row.id) {
        skipped += 1;
        continue;
      }
      const ok = await installAndPrepareSingleIntegration(row, { silent: true });
      if (ok) ready += 1;
      else stillFailedRows.push(row);
    }
    const failed = stillFailedRows.length;
    const attempted = targets.length - skipped;
    const elapsedSec = Math.max(0, Math.round((Date.now() - startedAt) / 100) / 10);
    setLastBulkRetrySummary({
      attempted,
      skipped,
      ready,
      failed,
      elapsedSec,
      completedAt: new Date().toISOString(),
    });
    if (failed === 0) {
      toast.success(
        `Retry complete: ready ${ready}/${attempted} attempted, skipped ${skipped}, in ${elapsedSec}s`,
      );
      return;
    }
    toast.warning(
      `Retry complete: ready ${ready}/${attempted} attempted, skipped ${skipped}, ${failed} still partial/failed, in ${elapsedSec}s`,
    );
    setShowOnlyFailedDiagnostics(true);
    if (stillFailedRows[0]) {
      focusIntegrationDiagnosticRow(stillFailedRows[0]);
    }
  }

  async function installTemplateBatch(options: { integrationIds: string[]; label: string; overwriteExisting: boolean }) {
    const available = new Set(catalogRows.map((row) => row.id));
    const targets = options.integrationIds.filter((id) => available.has(id));
    if (targets.length === 0) {
      toast.info(`No integrations available for ${options.label.toLowerCase()}`);
      return;
    }

    let installed = 0;
    let failed = 0;
    const failedIds: string[] = [];
    for (const integrationId of targets) {
      try {
        await applyTemplate.mutateAsync({
          integrationId,
          payload: { deploy_runtime: true, overwrite_existing: options.overwriteExisting },
        });
        installed += 1;
      } catch {
        failed += 1;
        failedIds.push(integrationId);
      }
    }

    if (failed === 0) {
      toast.success(`${options.label}: installed ${installed}/${targets.length}`);
      return;
    }
    toast.warning(
      `${options.label}: installed ${installed}/${targets.length}, failed ${failed} (${failedIds.join(', ')})`,
    );
  }

  async function installLibrary(profileId: string, label: string) {
    try {
      const result = await installLibraryProfile.mutateAsync({
        profileId,
        payload: { deploy_runtime: true, overwrite_existing: false },
      });
      const summary = result.data;
      const succeeded = Number(summary?.succeeded || 0);
      const attempted = Number(summary?.attempted || 0);
      const failed = Number(summary?.failed || 0);
      if (failed === 0) {
        toast.success(`${label}: installed ${succeeded}/${attempted}`);
        return;
      }
      const failedIds = Array.isArray(summary?.results)
        ? summary.results.filter((row) => !row.ok).map((row) => row.integration_id)
        : [];
      toast.warning(`${label}: installed ${succeeded}/${attempted}, failed ${failed} (${failedIds.join(', ')})`);
    } catch {
      toast.error(`Failed to install ${label.toLowerCase()}`);
    }
  }

  async function installAndPrepareLibraryProfile(profileId: string, label: string) {
    setInstallPrepareProfileInFlight(profileId);
    try {
      const installResult = await installLibraryProfile.mutateAsync({
        profileId,
        payload: { deploy_runtime: true, overwrite_existing: false },
      });
      const installSummary = installResult.data;
      const installedIds = new Set(
        Array.isArray(installSummary?.results)
          ? installSummary.results
              .filter((row) => row && row.ok)
              .map((row) => String(row.integration_id || '').trim())
              .filter(Boolean)
          : [],
      );

      const latestCatalogResult = await api.integrations.catalog();
      const latestCatalogRows = Array.isArray(latestCatalogResult?.data)
        ? (latestCatalogResult.data as CatalogRow[])
        : [];
      const targets =
        installedIds.size > 0
          ? latestCatalogRows.filter((row) => installedIds.has(String(row.id || '').trim()))
          : latestCatalogRows;

      let ready = 0;
      let partial = 0;
      for (const row of targets) {
        const prep = await prepareIntegrationForSven(row, { silent: true });
        if (prep.ok) ready += 1;
        else partial += 1;
      }

      const attempted = Number(installSummary?.attempted || 0);
      const installed = Number(installSummary?.succeeded || 0);
      if (partial === 0) {
        toast.success(`${label}: installed ${installed}/${attempted}, prepared ${ready}/${targets.length}`);
      } else {
        toast.warning(
          `${label}: installed ${installed}/${attempted}, prepared ${ready}/${targets.length} (partial ${partial})`,
        );
      }
    } catch {
      toast.error(`Failed to install + prepare ${label.toLowerCase()}`);
    } finally {
      setInstallPrepareProfileInFlight('');
    }
  }

  async function runIntegrationValidation(integrationId: string, options?: { silent?: boolean }) {
    const silent = options?.silent === true;
    try {
      const result = await validateIntegration.mutateAsync(integrationId);
      const checks = Array.isArray(result.data?.checks) ? result.data.checks : [];
      const passed = checks.filter((check) => check.pass).length;
      const allPassed = passed === checks.length && checks.length > 0;
      const failedLabels = checks.filter((check) => !check.pass).map((check) => check.label);
      if (passed === checks.length && checks.length > 0) {
        if (!silent) toast.success(`${integrationId}: validation passed (${passed}/${checks.length})`);
      } else {
        const failed = failedLabels.join(', ');
        if (!silent) {
          toast.warning(`${integrationId}: ${passed}/${checks.length} checks passed${failed ? ` | Failed: ${failed}` : ''}`);
        }
      }
      return { ok: allPassed, failedLabels };
    } catch {
      if (!silent) toast.error(`Failed to validate ${integrationId}`);
      return { ok: false, failedLabels: ['validation request failed'] };
    }
  }

  async function validateAllUnconfiguredIntegrations() {
    if (unconfiguredIntegrationIds.length === 0) {
      toast.message('No unconfigured integrations to validate.');
      return;
    }
    let passCount = 0;
    let failCount = 0;
    for (const integrationId of unconfiguredIntegrationIds) {
      const result = await runIntegrationValidation(integrationId, { silent: true });
      if (result?.ok) passCount += 1;
      else failCount += 1;
    }
    if (failCount > 0) {
      toast.warning(`Validated ${unconfiguredIntegrationIds.length} unconfigured integration(s): ${passCount} passed, ${failCount} need setup.`);
    } else {
      toast.success(`All ${passCount} unconfigured integration(s) passed validation.`);
    }
  }

  async function applyTemplatesToUnconfiguredIntegrations() {
    await installTemplateBatch({
      integrationIds: unconfiguredIntegrationIds,
      label: 'Apply templates to unconfigured',
      overwriteExisting: bulkTemplateOverwrite,
    });
  }

  async function runRecoveryPlaybook() {
    try {
      const result = await runRecoveryPlaybookMutation.mutateAsync({
        overwrite_existing: bulkTemplateOverwrite,
      });
      const summary = result.data?.summary || {};
      const parts = Object.entries(summary).map(([key, value]) => {
        const typed = value as { attempted: number; succeeded: number; failed: number };
        return `${key}: ${typed.succeeded}/${typed.attempted}${typed.failed > 0 ? ` (failed ${typed.failed})` : ''}`;
      });
      if (typeof result.data?.run_id === 'string' && result.data.run_id.trim()) {
        setSelectedRecoveryRunId(result.data.run_id);
      }
      toast.success(`Recovery playbook complete | ${parts.join(' | ')}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: { code?: string; message?: string } } | null;
        const code = String(body?.error?.code || '').trim().toUpperCase();
        if (code === 'PLAYBOOK_IN_PROGRESS') {
          activatePlaybookCooldown();
          toast.message('Recovery playbook is already running for this account.');
          return;
        }
      }
      toast.error('Recovery playbook failed');
    }
  }

  async function rerunSelectedRecoveryPlaybook() {
    if (!selectedRecoveryRun) return;
    const opts =
      selectedRecoveryRun.requested_options && typeof selectedRecoveryRun.requested_options === 'object'
        ? (selectedRecoveryRun.requested_options as Record<string, unknown>)
        : {};
    try {
      const result = await runRecoveryPlaybookMutation.mutateAsync({
        retry_failed: Boolean(opts.retry_failed),
        deploy_stopped: Boolean(opts.deploy_stopped),
        apply_templates_unconfigured: Boolean(opts.apply_templates_unconfigured),
        validate_unconfigured: Boolean(opts.validate_unconfigured),
        overwrite_existing: Boolean(opts.overwrite_existing),
      });
      const summary = result.data?.summary || {};
      const parts = Object.entries(summary).map(([key, value]) => {
        const typed = value as { attempted: number; succeeded: number; failed: number };
        return `${key}: ${typed.succeeded}/${typed.attempted}${typed.failed > 0 ? ` (failed ${typed.failed})` : ''}`;
      });
      if (typeof result.data?.run_id === 'string' && result.data.run_id.trim()) {
        setSelectedRecoveryRunId(result.data.run_id);
      }
      toast.success(`Recovery replay complete | ${parts.join(' | ')}`);
    } catch (error) {
      if (error instanceof ApiError) {
        const body = error.body as { error?: { code?: string; message?: string } } | null;
        const code = String(body?.error?.code || '').trim().toUpperCase();
        if (code === 'PLAYBOOK_IN_PROGRESS') {
          activatePlaybookCooldown();
          toast.message('Recovery playbook is already running for this account.');
          return;
        }
      }
      toast.error('Recovery replay failed');
    }
  }

  async function copyHistoryShareLink() {
    try {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Share link copied');
    } catch {
      toast.error('Failed to copy share link');
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target?.isContentEditable);
      if (isTyping) return;

      if (event.key === '/') {
        event.preventDefault();
        actorFilterInputRef.current?.focus();
        actorFilterInputRef.current?.select();
        return;
      }
      if (event.key.toLowerCase() === 'c') {
        event.preventDefault();
        void copyHistoryShareLink();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function adoptLegacyAllowlists() {
    try {
      const result = await adoptOrphans.mutateAsync({ confirm: true });
      const adopted = Number(result.data?.adopted || 0);
      if (adopted > 0) toast.success(`Adopted ${adopted} orphan allowlist row(s)`);
      else toast.info('No orphan allowlist rows to adopt');
    } catch {
      toast.error('Failed to adopt orphan allowlist rows');
    }
  }

  const integrations: IntegrationCard[] = [
    {
      name: 'Home Assistant',
      icon: Home,
      connected: hasHaConfigured,
      stats: [
        { label: 'Subscriptions', value: rowList(haSubs).length },
        { label: 'Automations', value: automationRows.length },
      ],
      href: '/integrations#ha',
      color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    },
    {
      name: 'Calendar (CalDAV/Google)',
      icon: Calendar,
      connected: calendarAccountRows.length > 0,
      stats: [
        { label: 'Accounts', value: calendarAccountRows.length },
        { label: 'Subscriptions', value: calendarSubscriptionRows.length },
      ],
      href: '/integrations#calendar',
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    },
    {
      name: 'Git (Forgejo/GitHub)',
      icon: GitBranch,
      connected: gitRows.length > 0,
      stats: [{ label: 'Repos', value: gitRows.length }],
      href: '/integrations#git',
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    },
    {
      name: 'Web Fetch',
      icon: Globe,
      connected: webRows.length > 0,
      stats: [{ label: 'Allowed domains', value: webRows.length }],
      href: '/integrations#web',
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
  ];

  return isLoading ? (
    <PageSpinner />
  ) : (
    <>
      <PageHeader title="Integrations" description="HA, calendar, Git, and web-fetch control plane" />

      <div className="mb-6 card">
        <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
          <Sparkles className="h-3 w-3" /> Integration Mesh
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight">Connected Systems</h2>
        <p className="mt-1 text-sm text-slate-400">Manage allowlists, automations, subscriptions, and external fetch boundaries from one view.</p>
      </div>

      <div className="card mb-6 space-y-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold">App Integrations Quick Setup</h3>
            <p className="text-sm text-slate-500">One-click style setup for Sven-supported apps and tools.</p>
            <p className="mt-1 text-xs text-slate-500">
              Auto-start on tool use: <span className={autoStartOnToolUse ? 'text-emerald-400' : 'text-amber-300'}>{autoStartOnToolUse ? 'enabled' : 'disabled'}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Auto-configure defaults on tool use:{' '}
              <span className={autoConfigureOnToolUse ? 'text-emerald-400' : 'text-amber-300'}>
                {autoConfigureOnToolUse ? 'enabled' : 'disabled'}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary btn-sm"
              disabled={setSetting.isPending}
              onClick={() =>
                applySettings(
                  [{ key: 'integrations.runtime.auto_start_on_tool_use', value: true }],
                  'Auto-start on tool use enabled',
                )
              }
            >
              Enable auto-start
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={setSetting.isPending}
              onClick={() =>
                applySettings(
                  [{ key: 'integrations.runtime.auto_start_on_tool_use', value: false }],
                  'Auto-start on tool use disabled',
                )
              }
            >
              Disable auto-start
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={setSetting.isPending}
              onClick={() =>
                applySettings(
                  [{ key: 'integrations.runtime.auto_configure_on_tool_use', value: true }],
                  'Auto-configure defaults on tool use enabled',
                )
              }
            >
              Enable auto-configure
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={setSetting.isPending}
              onClick={() =>
                applySettings(
                  [{ key: 'integrations.runtime.auto_configure_on_tool_use', value: false }],
                  'Auto-configure defaults on tool use disabled',
                )
              }
            >
              Disable auto-configure
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={applyTemplate.isPending || installLibraryProfile.isPending || catalogRows.length === 0}
              onClick={() => {
                if (recommendedProfile) {
                  void installLibrary(String(recommendedProfile.id), String(recommendedProfile.name || 'Recommended stack'));
                  return;
                }
                void installTemplateBatch({
                  integrationIds: [...RECOMMENDED_INTEGRATION_IDS],
                  label: 'Recommended stack',
                  overwriteExisting: false,
                });
              }}
            >
              Install recommended stack
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={applyTemplate.isPending || installLibraryProfile.isPending || catalogRows.length === 0}
              onClick={() => {
                if (fullProfile) {
                  void installLibrary(String(fullProfile.id), String(fullProfile.name || 'All supported templates'));
                  return;
                }
                void installTemplateBatch({
                  integrationIds: catalogRows.map((row) => row.id),
                  label: 'All supported templates',
                  overwriteExisting: false,
                });
              }}
            >
              Install all supported
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={
                !!installPrepareProfileInFlight ||
                applyTemplate.isPending ||
                installLibraryProfile.isPending ||
                validateIntegration.isPending ||
                deployRuntime.isPending ||
                catalogRows.length === 0
              }
              onClick={() => {
                const profileId = recommendedProfile ? String(recommendedProfile.id) : 'recommended-local';
                void installAndPrepareLibraryProfile(profileId, 'Recommended stack');
              }}
            >
              {installPrepareProfileInFlight === (recommendedProfile ? String(recommendedProfile.id) : 'recommended-local')
                ? 'Installing + preparing...'
                : 'Install + prepare recommended'}
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={
                !!installPrepareProfileInFlight ||
                applyTemplate.isPending ||
                installLibraryProfile.isPending ||
                validateIntegration.isPending ||
                deployRuntime.isPending ||
                catalogRows.length === 0
              }
              onClick={() => {
                const profileId = fullProfile ? String(fullProfile.id) : 'full-ecosystem';
                void installAndPrepareLibraryProfile(profileId, 'Full ecosystem');
              }}
            >
              {installPrepareProfileInFlight === (fullProfile ? String(fullProfile.id) : 'full-ecosystem')
                ? 'Installing + preparing...'
                : 'Install + prepare full ecosystem'}
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={
                prepareAllInFlight ||
                applyTemplate.isPending ||
                validateIntegration.isPending ||
                deployRuntime.isPending ||
                catalogRows.length === 0
              }
              onClick={prepareAllIntegrationsForSven}
            >
              {prepareAllInFlight ? 'Preparing all...' : 'Prepare all (runtime/env required)'}
            </button>
            <Link href="/skills" className="btn-secondary btn-sm">Installed Skills</Link>
            <Link href="/registry" className="btn-secondary btn-sm">Skill Registry</Link>
            <Link href="/channels" className="btn-secondary btn-sm">Channels</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Obsidian</p>
            <p className="text-xs text-slate-500">Configures local vault path for `obsidian.*` tools.</p>
            <input
              className="input mt-2"
              placeholder="X:\\Notes\\ObsidianVault"
              value={obsidianVaultPath}
              onChange={(e) => setObsidianVaultPath(e.target.value)}
            />
            <button
              className="btn-primary btn-sm mt-2"
              disabled={setSetting.isPending || !obsidianVaultPath.trim()}
              onClick={() =>
                applySettings(
                  [{ key: 'obsidian.vault_path', value: obsidianVaultPath.trim() }],
                  'Obsidian configured',
                )
              }
            >
              Apply Obsidian
            </button>
            <input
              className="input mt-2"
              placeholder="Sven Memories"
              value={obsidianSyncFolder}
              onChange={(e) => setObsidianSyncFolder(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                className="btn-secondary btn-sm"
                disabled={exportObsidianMemories.isPending || !obsidianVaultPath.trim()}
                onClick={() =>
                  exportObsidianMemories.mutate(
                    { folder: obsidianSyncFolder.trim() || 'Sven Memories', limit: 500 },
                    {
                      onSuccess: (result) => {
                        const data =
                          result && typeof result === 'object'
                            ? ((result as Record<string, unknown>).data as Record<string, unknown> | undefined)
                            : undefined;
                        toast.success(`Exported ${Number(data?.exported || 0)} memories to vault`);
                      },
                      onError: () => toast.error('Obsidian memory export failed'),
                    },
                  )
                }
              >
                Export memories to vault
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={importObsidianMemories.isPending || !obsidianVaultPath.trim()}
                onClick={() =>
                  importObsidianMemories.mutate(
                    { folder: obsidianSyncFolder.trim() || 'Sven Memories', limit: 500 },
                    {
                      onSuccess: (result) => {
                        const data =
                          result && typeof result === 'object'
                            ? ((result as Record<string, unknown>).data as Record<string, unknown> | undefined)
                            : undefined;
                        toast.success(
                          `Imported ${Number(data?.imported || 0)} memories (${Number(data?.skipped || 0)} skipped)`,
                        );
                      },
                      onError: () => toast.error('Obsidian memory import failed'),
                    },
                  )
                }
              >
                Import notes to memories
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Sync status:{' '}
              {String(
                ((obsidianSyncStatus.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)
                  ?.configured || false,
              ) === 'true'
                ? 'ready'
                : 'missing vault path'}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={runtimeBadgeClass(runtimeByType.get('obsidian')?.status)}>
                {runtimeByType.get('obsidian')?.status || 'stopped'}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={deployRuntime.isPending}
                onClick={() => deployIntegrationRuntime('obsidian', 'sven/integration-obsidian:latest')}
              >
                Deploy isolated runtime
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={stopRuntime.isPending}
                onClick={() => stopIntegrationRuntime('obsidian')}
              >
                Stop
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Frigate</p>
            <p className="text-xs text-slate-500">Camera NVR integration (`frigate.*` tools).</p>
            <input
              className="input mt-2"
              placeholder="https://frigate.local"
              value={frigateBaseUrl}
              onChange={(e) => setFrigateBaseUrl(e.target.value)}
            />
            <input
              className="input mt-2"
              placeholder="env://FRIGATE_TOKEN"
              value={frigateTokenRef}
              onChange={(e) => setFrigateTokenRef(e.target.value)}
            />
            <button
              className="btn-primary btn-sm mt-2"
              disabled={setSetting.isPending || !frigateBaseUrl.trim() || !frigateTokenRef.trim()}
              onClick={() =>
                applySettings(
                  [
                    { key: 'frigate.base_url', value: frigateBaseUrl.trim() },
                    { key: 'frigate.token_ref', value: frigateTokenRef.trim() },
                  ],
                  'Frigate configured',
                )
              }
            >
              Apply Frigate
            </button>
            <div className="mt-2 flex items-center gap-2">
              <span className={runtimeBadgeClass(runtimeByType.get('frigate')?.status)}>
                {runtimeByType.get('frigate')?.status || 'stopped'}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={deployRuntime.isPending}
                onClick={() => deployIntegrationRuntime('frigate', 'sven/integration-frigate:latest')}
              >
                Deploy isolated runtime
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={stopRuntime.isPending}
                onClick={() => stopIntegrationRuntime('frigate')}
              >
                Stop
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Spotify</p>
            <p className="text-xs text-slate-500">Enables `spotify.*` search/playback tools.</p>
            <input
              className="input mt-2"
              placeholder="Spotify client id"
              value={spotifyClientId}
              onChange={(e) => setSpotifyClientId(e.target.value)}
            />
            <input
              className="input mt-2"
              placeholder="env://SPOTIFY_CLIENT_SECRET"
              value={spotifySecretRef}
              onChange={(e) => setSpotifySecretRef(e.target.value)}
            />
            <button
              className="btn-primary btn-sm mt-2"
              disabled={setSetting.isPending || !spotifyClientId.trim() || !spotifySecretRef.trim()}
              onClick={() =>
                applySettings(
                  [
                    { key: 'spotify.client_id', value: spotifyClientId.trim() },
                    { key: 'spotify.client_secret_ref', value: spotifySecretRef.trim() },
                  ],
                  'Spotify configured',
                )
              }
            >
              Apply Spotify
            </button>
            <div className="mt-2 flex items-center gap-2">
              <span className={runtimeBadgeClass(runtimeByType.get('spotify')?.status)}>
                {runtimeByType.get('spotify')?.status || 'stopped'}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={deployRuntime.isPending}
                onClick={() => deployIntegrationRuntime('spotify', 'sven/integration-spotify:latest')}
              >
                Deploy isolated runtime
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={stopRuntime.isPending}
                onClick={() => stopIntegrationRuntime('spotify')}
              >
                Stop
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Sonos + Shazam</p>
            <p className="text-xs text-slate-500">Token refs for `sonos.*` and `shazam.recognize` tools.</p>
            <input
              className="input mt-2"
              placeholder="env://SONOS_ACCESS_TOKEN"
              value={sonosTokenRef}
              onChange={(e) => setSonosTokenRef(e.target.value)}
            />
            <input
              className="input mt-2"
              placeholder="env://SHAZAM_API_TOKEN"
              value={shazamTokenRef}
              onChange={(e) => setShazamTokenRef(e.target.value)}
            />
            <button
              className="btn-primary btn-sm mt-2"
              disabled={setSetting.isPending || !sonosTokenRef.trim() || !shazamTokenRef.trim()}
              onClick={() =>
                applySettings(
                  [
                    { key: 'sonos.access_token_ref', value: sonosTokenRef.trim() },
                    { key: 'shazam.api_token_ref', value: shazamTokenRef.trim() },
                  ],
                  'Sonos + Shazam configured',
                )
              }
            >
              Apply Sonos + Shazam
            </button>
            <div className="mt-2 flex items-center gap-2">
              <span className={runtimeBadgeClass(runtimeByType.get('sonos-shazam')?.status)}>
                {runtimeByType.get('sonos-shazam')?.status || 'stopped'}
              </span>
              <button
                className="btn-secondary btn-sm"
                disabled={deployRuntime.isPending}
                onClick={() => deployIntegrationRuntime('sonos-shazam', 'sven/integration-sonos-shazam:latest')}
              >
                Deploy isolated runtime
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={stopRuntime.isPending}
                onClick={() => stopIntegrationRuntime('sonos-shazam')}
              >
                Stop
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Magic Mirror / Peekaboo</p>
            <p className="text-xs text-slate-500">
              Device ecosystem is supported via Sven mirror/device stack. Use guided setup flows.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link href="/setup" className="btn-secondary btn-sm">Open Setup Wizard</Link>
              <Link href="/channels" className="btn-secondary btn-sm">Open Channels</Link>
              <button
                className="btn-secondary btn-sm"
                disabled={deployRuntime.isPending}
                onClick={() => deployIntegrationRuntime('magic-mirror-peekaboo', 'sven/integration-mirror-peekaboo:latest')}
              >
                Deploy isolated runtime
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 p-3">
            <p className="font-medium">Voice Call</p>
            <p className="text-xs text-slate-500">Enable/disable outbound voice-call integration.</p>
            <div className="mt-2 flex gap-2">
              <button
                className="btn-primary btn-sm"
                disabled={setSetting.isPending}
                onClick={() =>
                  applySettings([{ key: 'voice.call.enabled', value: true }], 'Voice call enabled')
                }
              >
                Enable
              </button>
              <button
                className="btn-secondary btn-sm"
                disabled={setSetting.isPending}
                onClick={() =>
                  applySettings([{ key: 'voice.call.enabled', value: false }], 'Voice call disabled')
                }
              >
                Disable
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-6 space-y-3 py-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Integration Boot Queue</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{bootEvents.length} recent event(s)</span>
            <button
              className="btn-secondary btn-sm"
              disabled={deployRuntime.isPending || failedBootIntegrations.length === 0}
              onClick={retryAllFailedDeploys}
            >
              Retry all failed ({failedBootIntegrations.length})
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setBootFilterStatus((prev) => (prev === 'error' ? '' : 'error'))}
            >
              {bootFilterStatus === 'error' ? 'Show all statuses' : 'Focus failures'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select
            className="input"
            value={bootFilterStatus}
            onChange={(e) => setBootFilterStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="running">running</option>
            <option value="success">success</option>
            <option value="error">error</option>
          </select>
          <select
            className="input"
            value={bootFilterIntegration}
            onChange={(e) => setBootFilterIntegration(e.target.value)}
          >
            <option value="">All integrations</option>
            {[...new Set(catalogRows.map((row) => String(row.runtime_type || '')).filter(Boolean))].map((runtimeType) => (
              <option key={runtimeType} value={runtimeType}>{runtimeType}</option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Filter by chat id"
            value={bootFilterChatId}
            onChange={(e) => setBootFilterChatId(e.target.value)}
          />
          <button
            className="btn-secondary"
            onClick={() => {
              setBootFilterStatus('');
              setBootFilterIntegration('');
              setBootFilterChatId('');
            }}
          >
            Clear filters
          </button>
        </div>
        {bootEvents.length === 0 ? (
          <p className="text-sm text-slate-500">No recent integration boot events.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Integration</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Detail</th>
                  <th className="px-2 py-2">Chat</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bootEvents.map((row) => {
                  const integration = bootEventIntegration(row);
                  const status = String(row.status || 'unknown');
                  return (
                    <tr
                      key={`${String(row.message_id || '')}:${String(row.created_at || '')}:${integration}:${status}`}
                      className="border-b border-slate-800"
                    >
                      <td className="px-2 py-2 text-xs text-slate-400">{String(row.created_at || '').replace('T', ' ').replace('Z', '')}</td>
                      <td className="px-2 py-2 font-medium">{integration}</td>
                      <td className="px-2 py-2">
                        <span className={runtimeBadgeClass(status as RuntimeStatus)}>
                          {status}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-300">{String(row.detail || '—')}</td>
                      <td className="px-2 py-2 text-xs">
                        <Link href={`/chats/${encodeURIComponent(String(row.chat_id || ''))}`} className="text-cyan-400 hover:underline">
                          {String(row.chat_id || '').slice(0, 8) || '—'}
                        </Link>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn-secondary btn-sm"
                            disabled={deployRuntime.isPending || !integration}
                            onClick={() => deployIntegrationRuntime(integration)}
                          >
                            Retry deploy
                          </button>
                          <a
                            href={`#catalog-${encodeURIComponent(integration)}`}
                            className="btn-secondary btn-sm"
                          >
                            Jump to row
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {integrations.map((int) => (
          <a key={int.name} href={int.href} className="card py-5 block">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${int.color}`}>
                  <int.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">{int.name}</p>
                  <span className={int.connected ? 'badge-success' : 'badge-neutral'}>
                    {int.connected ? 'connected' : 'not configured'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-6">
              {int.stats.map((s) => (
                <div key={s.label}>
                  <p className="text-xl font-semibold">{s.value}</p>
                  <p className="text-xs text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </a>
        ))}
      </div>

      <div className="mt-8 card py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Integration App Store</h3>
            <p className="text-xs text-slate-500">
              Search, install, and prepare integrations in one click. Some integrations still require credential refs
              and runtime profile/env setup.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input h-8 w-64 text-xs"
              placeholder="Search app integrations..."
              value={appStoreQuery}
              onChange={(e) => setAppStoreQuery(e.target.value)}
            />
            <span className="text-xs text-slate-500">
              {filteredAppStoreRows.length}/{catalogRows.length}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredAppStoreRows.map((row) => (
            <div key={`app-store-${row.id}`} className="rounded-lg border border-slate-800 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.runtime_type}</p>
                </div>
                <span className={row.configured ? 'badge-success' : 'badge-warning'}>
                  {row.configured ? 'ready' : 'needs setup'}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                <span className={runtimeBadgeClass(row.runtime_status as RuntimeStatus)}>{row.runtime_status}</span>
                <span className={row.linked ? 'badge-success' : 'badge-danger'}>
                  {row.linked ? `${row.available_tools_count} tools` : 'not linked'}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {row.required_settings.length > 0
                  ? `${row.required_settings.filter((s) => s.configured).length}/${row.required_settings.length} required settings configured`
                  : 'No required settings'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="btn-primary btn-sm"
                  disabled={
                    !!installPrepareRowInFlightId ||
                    !!installPrepareProfileInFlight ||
                    prepareAllInFlight ||
                    applyTemplate.isPending ||
                    validateIntegration.isPending ||
                    deployRuntime.isPending ||
                    installLibraryProfile.isPending
                  }
                  onClick={() => installAndPrepareSingleIntegration(row)}
                >
                  {installPrepareRowInFlightId === row.id ? 'Installing...' : 'Install + prepare'}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => focusIntegrationDiagnosticRow(row)}>
                  View in catalog
                </button>
              </div>
            </div>
          ))}
        </div>
        {filteredAppStoreRows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No integrations match this search.</p>
        ) : null}
      </div>

      <div className="mt-8 card py-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">All Supported Integrations (Code-Linked)</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{catalogRows.length} total</span>
            <label className="inline-flex items-center gap-1 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={bulkTemplateOverwrite}
                onChange={(e) => setBulkTemplateOverwrite(e.target.checked)}
              />
              overwrite
            </label>
            <button
              className="btn-secondary btn-sm"
              disabled={applyTemplate.isPending || unconfiguredIntegrationIds.length === 0}
              onClick={applyTemplatesToUnconfiguredIntegrations}
            >
              Apply templates to unconfigured ({unconfiguredIntegrationIds.length})
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={deployRuntime.isPending || stoppedCatalogRuntimeTypes.length === 0}
              onClick={deployAllStoppedRuntimes}
            >
              Deploy all stopped ({stoppedCatalogRuntimeTypes.length})
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={validateIntegration.isPending || unconfiguredIntegrationIds.length === 0}
              onClick={validateAllUnconfiguredIntegrations}
            >
              Validate unconfigured ({unconfiguredIntegrationIds.length})
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={reconcileRuntime.isPending}
              onClick={reconcileIntegrationRuntime}
            >
              Reconcile runtimes
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={
                prepareAllInFlight ||
                deployRuntime.isPending ||
                applyTemplate.isPending ||
                validateIntegration.isPending ||
                reconcileRuntime.isPending ||
                runRecoveryPlaybookMutation.isPending ||
                playbookCooldownActive
              }
              onClick={runRecoveryPlaybook}
            >
              {playbookCooldownActive ? 'Playbook already running...' : 'Run recovery playbook'}
            </button>
            <button
              className="btn-primary btn-sm"
              disabled={
                prepareAllInFlight ||
                applyTemplate.isPending ||
                validateIntegration.isPending ||
                deployRuntime.isPending ||
                catalogRows.length === 0
              }
              onClick={prepareAllIntegrationsForSven}
            >
              {prepareAllInFlight ? 'Preparing all...' : 'Prepare all (runtime/env required)'}
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={copyAllFailedDiagnostics}
            >
              Copy all failed diagnostics
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={
                failedOrPartialDiagnosticRows.length === 0 ||
                !!installPrepareRowInFlightId ||
                !!installPrepareProfileInFlight ||
                installLibraryProfile.isPending ||
                applyTemplate.isPending ||
                validateIntegration.isPending ||
                deployRuntime.isPending
              }
              onClick={retryFailedDiagnosticsRows}
            >
              Retry failed only ({failedOrPartialDiagnosticRows.length})
            </button>
            <button
              className="btn-secondary btn-sm"
              onClick={() => setShowOnlyFailedDiagnostics((prev) => !prev)}
            >
              {showOnlyFailedDiagnostics
                ? `Show all rows (${catalogRows.length})`
                : `Show failed only (${failedOrPartialDiagnosticRows.length})`}
            </button>
          </div>
        </div>
        {lastBulkRetrySummary ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="badge-neutral">
              Last retry: ready {lastBulkRetrySummary.ready}/{lastBulkRetrySummary.attempted}
            </span>
            <span className="badge-neutral">failed {lastBulkRetrySummary.failed}</span>
            <span className="badge-neutral">skipped {lastBulkRetrySummary.skipped}</span>
            <span className="badge-neutral">{lastBulkRetrySummary.elapsedSec}s</span>
            <span>
              {lastBulkRetrySummary.completedAt.replace('T', ' ').replace('Z', '')}
            </span>
            <button className="btn-secondary btn-sm" onClick={() => setLastBulkRetrySummary(null)}>
              Clear
            </button>
          </div>
        ) : null}
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="px-2 py-2">Integration</th>
                <th className="px-2 py-2">Linked Tools</th>
                <th className="px-2 py-2">Configured</th>
                <th className="px-2 py-2">Runtime</th>
                <th className="px-2 py-2">Settings/Table</th>
                <th className="px-2 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCatalogRows.map((row) => (
                <tr
                  id={`catalog-${encodeURIComponent(row.runtime_type)}`}
                  key={row.id}
                  className={`border-b border-slate-800 ${diagnosticFocusedRowId === row.id ? 'bg-amber-500/10' : ''}`}
                >
                  <td className="px-2 py-2">
                    <div id={`catalog-row-${encodeURIComponent(row.id)}`} />
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-slate-500">{row.runtime_type}</p>
                  </td>
                  <td className="px-2 py-2">
                    <span className={row.linked ? 'badge-success' : 'badge-danger'}>
                      {row.linked ? `${row.available_tools_count} tools` : 'not linked'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={row.configured ? 'badge-success' : 'badge-warning'}>
                      {row.configured ? 'configured' : 'partial'}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={runtimeBadgeClass(row.runtime_status as RuntimeStatus)}>
                      {row.runtime_status}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-400">
                    {row.required_settings.length > 0 ? (
                      <p>{row.required_settings.filter((s) => s.configured).length}/{row.required_settings.length} settings</p>
                    ) : (
                      <p>no required settings</p>
                    )}
                    {row.table_name ? <p>{row.table_name}: {row.table_count || 0}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-primary btn-sm"
                        disabled={
                          !!installPrepareRowInFlightId ||
                          !!installPrepareProfileInFlight ||
                          prepareAllInFlight ||
                          applyTemplate.isPending ||
                          validateIntegration.isPending ||
                          deployRuntime.isPending ||
                          installLibraryProfile.isPending
                        }
                        onClick={() => installAndPrepareSingleIntegration(row)}
                      >
                        {installPrepareRowInFlightId === row.id ? 'Installing...' : 'Install + prepare'}
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        disabled={
                          prepareAllInFlight ||
                          !!prepareInFlightId ||
                          !!installPrepareRowInFlightId ||
                          applyTemplate.isPending ||
                          validateIntegration.isPending ||
                          deployRuntime.isPending
                        }
                        onClick={() => prepareIntegrationForSven(row)}
                      >
                        {prepareInFlightId === row.id ? 'Preparing...' : 'Prepare for Sven'}
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={applyTemplate.isPending}
                        onClick={() => applyIntegrationTemplate(row.id)}
                      >
                        Apply template
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={validateIntegration.isPending}
                        onClick={() => runIntegrationValidation(row.id)}
                      >
                        Validate
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={deployRuntime.isPending}
                        onClick={() => deployIntegrationRuntime(row.runtime_type)}
                      >
                        Deploy
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        disabled={stopRuntime.isPending}
                        onClick={() => stopIntegrationRuntime(row.runtime_type)}
                      >
                        Stop
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => copyRowDiagnostics(row)}
                      >
                        Copy diagnostics
                      </button>
                    </div>
                    {installPrepareRowStageById[row.id] ? (
                      <div className="mt-2">
                        <span className={installStageBadgeClass(installPrepareRowStageById[row.id])}>
                          {installPrepareRowStageById[row.id]}
                        </span>
                        {installPrepareRowDetailById[row.id] ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {installPrepareRowDetailById[row.id]}
                          </p>
                        ) : null}
                        {installPrepareRowUpdatedAtById[row.id] ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            Updated {installPrepareRowUpdatedAtById[row.id].replace('T', ' ').replace('Z', '')}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {visibleCatalogRows.length === 0 ? (
                <tr>
                  <td className="px-2 py-3 text-sm text-slate-500" colSpan={6}>
                    {showOnlyFailedDiagnostics
                      ? 'No partial/failed diagnostics rows right now.'
                      : 'No integrations found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 card py-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Recovery Playbook History</h3>
            <p className="text-xs text-slate-500">Shortcuts: <kbd>/</kbd> focus actor filter, <kbd>c</kbd> copy share link</p>
            <p className="text-xs text-slate-500">
              Last updated: {historyLastUpdatedAt ? historyLastUpdatedAt.replace('T', ' ').replace('Z', '') : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">{recoveryRuns.length} recent run(s)</span>
            <select
              className="input h-8 w-28 text-xs"
              value={String(historyRefreshMs)}
              onChange={(e) => setHistoryRefreshMs(Math.max(0, Number(e.target.value) || 0))}
            >
              <option value="0">Live: Off</option>
              <option value="5000">Live: 5s</option>
              <option value="15000">Live: 15s</option>
              <option value="30000">Live: 30s</option>
            </select>
            <button
              className="btn-secondary btn-sm"
              onClick={async () => {
                await refetchRecoveryRuns();
                setHistoryLastUpdatedAt(new Date().toISOString());
              }}
            >
              Refresh now
            </button>
            <button className="btn-secondary btn-sm" onClick={copyHistoryShareLink}>
              Copy share link
            </button>
            <a className="btn-secondary btn-sm" href={recoveryRunsCsvUrl} target="_blank" rel="noreferrer">
              Export CSV
            </a>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <button
            className={runtimeBadgeClass(historyRunStatus === 'in_progress' ? 'deploying' : 'stopped')}
            onClick={() => setHistoryRunStatus((prev) => (prev === 'in_progress' ? 'all' : 'in_progress'))}
          >
            in_progress: {recoveryStatusCounts.inProgress}
          </button>
          <button
            className={runtimeBadgeClass(historyRunStatus === 'completed' ? 'running' : 'stopped')}
            onClick={() => setHistoryRunStatus((prev) => (prev === 'completed' ? 'all' : 'completed'))}
          >
            completed: {recoveryStatusCounts.completed}
          </button>
          <button
            className={runtimeBadgeClass(historyRunStatus === 'failed' ? 'error' : 'stopped')}
            onClick={() => setHistoryRunStatus((prev) => (prev === 'failed' ? 'all' : 'failed'))}
          >
            failed: {recoveryStatusCounts.failed}
          </button>
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-6">
          <select
            className="input"
            value={historyHasFailures}
            onChange={(e) => setHistoryHasFailures(e.target.value as 'all' | 'true' | 'false')}
          >
            <option value="all">All runs</option>
            <option value="true">Failures only</option>
            <option value="false">No-failure runs</option>
          </select>
          <select
            className="input"
            value={historyRunStatus}
            onChange={(e) => setHistoryRunStatus(e.target.value as 'all' | 'in_progress' | 'completed' | 'failed')}
          >
            <option value="all">All statuses</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
          </select>
          <input
            ref={actorFilterInputRef}
            className="input"
            placeholder="Actor user id"
            value={historyActorUserId}
            onChange={(e) => setHistoryActorUserId(e.target.value)}
          />
          <input
            className="input"
            type="datetime-local"
            value={historyFrom}
            onChange={(e) => setHistoryFrom(e.target.value)}
          />
          <input
            className="input"
            type="datetime-local"
            value={historyTo}
            onChange={(e) => setHistoryTo(e.target.value)}
          />
          <select
            className="input"
            value={historyOrder}
            onChange={(e) => setHistoryOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
          <select
            className="input"
            value={String(historyLimit)}
            onChange={(e) => setHistoryLimit(Math.max(5, Math.min(100, Number(e.target.value) || 25)))}
          >
            <option value="10">10 / page</option>
            <option value="25">25 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
          <button
            className="btn-secondary"
            onClick={() => {
              setHistoryHasFailures('all');
              setHistoryRunStatus('all');
              setHistoryActorUserId('');
              setHistoryFrom('');
              setHistoryTo('');
              setHistoryOrder('desc');
              setHistoryPage(1);
              setHistoryLimit(25);
            }}
          >
            Clear filters
          </button>
        </div>
        {recoveryRuns.length === 0 ? (
          <p className="text-sm text-slate-500">No recovery playbook runs yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-2 py-2">Time</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Retry Failed</th>
                  <th className="px-2 py-2">Deploy Stopped</th>
                  <th className="px-2 py-2">Apply Templates</th>
                  <th className="px-2 py-2">Validate</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {recoveryRuns.map((row) => {
                  const summary = (row.summary && typeof row.summary === 'object' ? row.summary : {}) as Record<
                    string,
                    { attempted?: number; succeeded?: number; failed?: number }
                  >;
                  const fmt = (key: string) => {
                    const stage = summary[key] || {};
                    const attempted = Number(stage.attempted || 0);
                    const succeeded = Number(stage.succeeded || 0);
                    const failed = Number(stage.failed || 0);
                    if (attempted === 0) return '—';
                    return `${succeeded}/${attempted}${failed > 0 ? ` (f${failed})` : ''}`;
                  };
                  return (
                    <tr key={String(row.id || '')} className="border-b border-slate-800">
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {String(row.created_at || '').replace('T', ' ').replace('Z', '')}
                      </td>
                      <td className="px-2 py-2">
                        <span className={runtimeBadgeClass((String(row.run_status || 'completed').toLowerCase() === 'failed' ? 'error' : String(row.run_status || 'completed').toLowerCase() === 'in_progress' ? 'deploying' : 'running') as RuntimeStatus)}>
                          {String(row.run_status || 'completed')}
                        </span>
                      </td>
                      <td className="px-2 py-2">{fmt('retry_failed')}</td>
                      <td className="px-2 py-2">{fmt('deploy_stopped')}</td>
                      <td className="px-2 py-2">{fmt('apply_templates_unconfigured')}</td>
                      <td className="px-2 py-2">{fmt('validate_unconfigured')}</td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {String(row.actor_user_id || 'system').slice(0, 12)}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() =>
                            setSelectedRecoveryRunId((prev) => (prev === String(row.id || '') ? '' : String(row.id || '')))
                          }
                        >
                          {selectedRecoveryRunId === String(row.id || '') ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {Number(recoveryRunsMeta?.page || historyPage)} / {Number(recoveryRunsMeta?.total_pages || 1)} | total {Number(recoveryRunsMeta?.total || recoveryRuns.length)}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary btn-sm"
              disabled={historyPage <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              className="btn-secondary btn-sm"
              disabled={historyPage >= Number(recoveryRunsMeta?.total_pages || 1)}
              onClick={() => setHistoryPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
        {selectedRecoveryRun ? (
          <div className="mt-3 rounded-md border border-slate-700 p-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-slate-300">Run Detail: {String(selectedRecoveryRun.id || '')}</p>
                <p className="mt-1 text-slate-400">
                  {String(selectedRecoveryRun.created_at || '').replace('T', ' ').replace('Z', '')}
                </p>
              </div>
              <button
                className="btn-secondary btn-sm"
                disabled={runRecoveryPlaybookMutation.isPending || playbookCooldownActive}
                onClick={rerunSelectedRecoveryPlaybook}
              >
                {playbookCooldownActive ? 'Wait...' : 'Rerun with same options'}
              </button>
            </div>
            <div className="mt-2 rounded border border-slate-700/70 p-2 text-[11px] text-slate-300">
              {(() => {
                const result =
                  selectedRecoveryRun.result && typeof selectedRecoveryRun.result === 'object'
                    ? (selectedRecoveryRun.result as Record<string, unknown>)
                    : {};
                const failedFrom = (key: string) => {
                  const rows = Array.isArray(result[key]) ? (result[key] as Array<Record<string, unknown>>) : [];
                  return rows
                    .filter((row) => row && typeof row === 'object' && row.ok !== true)
                    .map((row) => String(row.integration_id || row.integration_type || '').trim())
                    .filter(Boolean);
                };
                const failed = [
                  ...failedFrom('retry_failed_results'),
                  ...failedFrom('deploy_stopped_results'),
                  ...failedFrom('template_results'),
                  ...failedFrom('validation_results'),
                ];
                const deduped = [...new Set(failed)];
                return deduped.length > 0
                  ? `Failed integrations: ${deduped.join(', ')}`
                  : 'No failed integration entries recorded in this run.';
              })()}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <p className="font-medium text-slate-300">Failed Deploy Retries</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900/60 p-2 text-[11px] text-slate-300">
{JSON.stringify(
  ((selectedRecoveryRun.result as Record<string, unknown> | undefined)?.retry_failed_results || []) as unknown[],
  null,
  2,
)}
                </pre>
              </div>
              <div>
                <p className="font-medium text-slate-300">Template Apply Results</p>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-900/60 p-2 text-[11px] text-slate-300">
{JSON.stringify(
  ((selectedRecoveryRun.result as Record<string, unknown> | undefined)?.template_results || []) as unknown[],
  null,
  2,
)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 card py-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Legacy Allowlist Repair</h3>
            <p className="text-xs text-slate-500">
              Repairs pre-tenant allowlist rows (`organization_id IS NULL`) by assigning them to the current account.
            </p>
          </div>
          <span className={orphanTotal > 0 ? 'badge-warning' : 'badge-success'}>
            {orphanTotal} orphan row{orphanTotal === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-secondary btn-sm"
            disabled={adoptOrphans.isPending}
            onClick={adoptLegacyAllowlists}
          >
            Adopt orphan rows to current account
          </button>
        </div>
        {orphanRows.length > 0 ? (
          <div className="mt-3 overflow-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Pattern</th>
                  <th className="px-2 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {orphanRows.slice(0, 10).map((row) => (
                  <tr key={rowStr(row, 'id') || crypto.randomUUID()} className="border-b border-slate-800">
                    <td className="px-2 py-2">{rowStr(row, 'type') || '—'}</td>
                    <td className="px-2 py-2">{rowStr(row, 'pattern') || '—'}</td>
                    <td className="px-2 py-2">{rowStr(row, 'created_at') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div id="ha" className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">HA Allowlists</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={allowType} onChange={(e) => setAllowType(e.target.value as 'ha_entity' | 'ha_service')} className="input">
              <option value="ha_entity">ha_entity</option>
              <option value="ha_service">ha_service</option>
            </select>
            <input className="input sm:col-span-2" value={allowPattern} onChange={(e) => setAllowPattern(e.target.value)} placeholder="Pattern (entity id or service)" />
            <select value={allowTier} onChange={(e) => setAllowTier(Number(e.target.value))} className="input">
              <option value={1}>Tier 1</option>
              <option value={2}>Tier 2</option>
              <option value={3}>Tier 3</option>
            </select>
            <button
              className="btn-primary sm:col-span-2"
              onClick={() =>
                createAllowlist.mutate(
                  { type: allowType, pattern: allowPattern.trim(), danger_tier: allowTier, enabled: true },
                  {
                    onSuccess: () => {
                      setAllowPattern('');
                      toast.success('Allowlist entry created');
                    },
                    onError: () => toast.error('Failed to create allowlist entry'),
                  },
                )
              }
              disabled={!allowPattern.trim() || createAllowlist.isPending}
            >
              <Plus className="mr-1 inline h-4 w-4" /> Add Allowlist
            </button>
          </div>

          <div className="rounded-md border border-slate-700 p-3">
            <p className="text-sm font-medium">Auto-discover HA entities</p>
            <p className="text-xs text-slate-500">
              Pulls live entities from Home Assistant and suggests danger tier defaults for approval workflow.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                className="input sm:col-span-2"
                value={haDiscoveryDomain}
                onChange={(e) => setHaDiscoveryDomain(e.target.value)}
                placeholder="Optional domain filter (e.g. lock)"
              />
              <button
                className="btn-secondary"
                disabled={haDiscovery.isFetching}
                onClick={() => {
                  void haDiscovery.refetch().then((res) => {
                    if (res.error) {
                      toast.error('HA discovery failed');
                    } else {
                      const rows =
                        res.data &&
                        typeof res.data === 'object' &&
                        (res.data as Record<string, unknown>).data &&
                        typeof (res.data as Record<string, unknown>).data === 'object' &&
                        Array.isArray(((res.data as Record<string, unknown>).data as Record<string, unknown>).rows)
                          ? (((res.data as Record<string, unknown>).data as Record<string, unknown>).rows as unknown[]).length
                          : 0;
                      toast.success(`Discovered ${rows} HA entities`);
                    }
                  });
                }}
              >
                {haDiscovery.isFetching ? 'Discovering…' : 'Discover entities'}
              </button>
            </div>
            {discoveredHaEntities.length > 0 ? (
              <div className="mt-3 space-y-2">
                {discoveredHaEntities.slice(0, 10).map((row) => {
                  const entityId = rowStr(row, 'entity_id') || '—';
                  const tier = rowNum(row, 'danger_tier') || 1;
                  return (
                    <div
                      key={`${entityId}-${rowStr(row, 'state') || ''}`}
                      className="flex items-center justify-between rounded-md border border-slate-700 px-2 py-1"
                    >
                      <div>
                        <p className="text-sm font-medium">{entityId}</p>
                        <p className="text-xs text-slate-500">
                          {rowStr(row, 'state') || 'unknown'} • tier {tier}
                        </p>
                      </div>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() =>
                          createAllowlist.mutate(
                            { type: 'ha_entity', pattern: entityId, danger_tier: tier, enabled: true },
                            {
                              onSuccess: () => toast.success(`Allowlisted ${entityId}`),
                              onError: () => toast.error('Failed to create allowlist entry'),
                            },
                          )
                        }
                        disabled={createAllowlist.isPending || entityId === '—'}
                      >
                        Add tier {tier}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {allowlistRows.length === 0 ? (
              <p className="text-sm text-slate-500">No HA allowlist entries yet.</p>
            ) : (
              allowlistRows.map((row) => (
                <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium">{rowStr(row, 'pattern') ?? '—'}</p>
                    <p className="text-xs text-slate-500">{rowStr(row, 'type') ?? 'unknown'} • tier {rowNum(row, 'danger_tier') ?? '-'}</p>
                  </div>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      rowStr(row, 'id') &&
                      deleteAllowlist.mutate(rowStr(row, 'id') as string, {
                        onSuccess: () => toast.success('Allowlist removed'),
                        onError: () => toast.error('Failed to remove allowlist'),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">HA Automations</h3>
          <input className="input" value={automationName} onChange={(e) => setAutomationName(e.target.value)} placeholder="Automation name" />
          <input className="input" value={automationChatId} onChange={(e) => setAutomationChatId(e.target.value)} placeholder="Chat ID" />
          <input className="input" value={automationDescription} onChange={(e) => setAutomationDescription(e.target.value)} placeholder="Description (optional)" />
          <button
            className="btn-primary"
            onClick={() =>
              createAutomation.mutate(
                {
                  name: automationName.trim(),
                  chat_id: automationChatId.trim(),
                  description: automationDescription.trim(),
                  enabled: true,
                  trigger: {},
                  conditions: [],
                  actions: [],
                },
                {
                  onSuccess: () => {
                    setAutomationName('');
                    setAutomationChatId('');
                    setAutomationDescription('');
                    toast.success('Automation created');
                  },
                  onError: () => toast.error('Failed to create automation'),
                },
              )
            }
            disabled={!automationName.trim() || !automationChatId.trim() || createAutomation.isPending}
          >
            <Plus className="mr-1 inline h-4 w-4" /> Create Automation
          </button>

          <div className="space-y-2">
            {automationRows.length === 0 ? (
              <p className="text-sm text-slate-500">No automations configured yet.</p>
            ) : (
              automationRows.map((row) => (
                <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium">{rowStr(row, 'name') ?? 'automation'}</p>
                    <p className="text-xs text-slate-500">{rowStr(row, 'chat_id') ?? '—'}</p>
                  </div>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      rowStr(row, 'id') &&
                      deleteAutomation.mutate(rowStr(row, 'id') as string, {
                        onSuccess: () => toast.success('Automation deleted'),
                        onError: () => toast.error('Failed to delete automation'),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div id="calendar" className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">Calendar Accounts</h3>
          <select value={calendarProvider} onChange={(e) => setCalendarProvider(e.target.value as 'radicale' | 'google')} className="input">
            <option value="radicale">radicale</option>
            <option value="google">google</option>
          </select>
          <input className="input" value={calendarAccountName} onChange={(e) => setCalendarAccountName(e.target.value)} placeholder="Account name" />
          {calendarProvider === 'radicale' ? (
            <>
              <input className="input" value={calendarUsername} onChange={(e) => setCalendarUsername(e.target.value)} placeholder="Username" />
              <input className="input" value={calendarPasswordRef} onChange={(e) => setCalendarPasswordRef(e.target.value)} placeholder="Password ref (env://...)" />
            </>
          ) : (
            <input className="input" value={calendarGoogleEmail} onChange={(e) => setCalendarGoogleEmail(e.target.value)} placeholder="Google email (optional)" />
          )}
          <button
            className="btn-primary"
            onClick={() =>
              addCalendarAccount.mutate(
                {
                  provider: calendarProvider,
                  account_name: calendarAccountName || undefined,
                  username: calendarProvider === 'radicale' ? calendarUsername || undefined : undefined,
                  password_ref: calendarProvider === 'radicale' ? calendarPasswordRef || undefined : undefined,
                  google_email: calendarProvider === 'google' ? calendarGoogleEmail || undefined : undefined,
                },
                {
                  onSuccess: () => {
                    setCalendarAccountName('');
                    setCalendarUsername('');
                    setCalendarPasswordRef('');
                    setCalendarGoogleEmail('');
                    toast.success('Calendar account added');
                  },
                  onError: () => toast.error('Failed to add calendar account'),
                },
              )
            }
            disabled={
              addCalendarAccount.isPending ||
              (calendarProvider === 'radicale' && (!calendarUsername.trim() || !calendarPasswordRef.trim()))
            }
          >
            <Plus className="mr-1 inline h-4 w-4" /> Add Account
          </button>

          <div className="space-y-2">
            {calendarAccountRows.length === 0 ? (
              <p className="text-sm text-slate-500">No calendar accounts yet.</p>
            ) : (
              calendarAccountRows.map((row) => (
                <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <p className="font-medium">{rowStr(row, 'account_name') || rowStr(row, 'provider') || 'account'}</p>
                  <p className="text-xs text-slate-500">{rowStr(row, 'provider') ?? 'unknown'}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card space-y-3 py-5">
          <h3 className="text-base font-semibold">Calendar Subscriptions</h3>
          <select value={subscriptionAccountId} onChange={(e) => setSubscriptionAccountId(e.target.value)} className="input">
            <option value="">Select account</option>
            {calendarAccountRows.map((row) => (
              <option key={rowStr(row, 'id') ?? crypto.randomUUID()} value={rowStr(row, 'id') ?? ''}>
                {rowStr(row, 'account_name') || rowStr(row, 'id') || 'account'}
              </option>
            ))}
          </select>
          <input className="input" value={subscriptionCalendarId} onChange={(e) => setSubscriptionCalendarId(e.target.value)} placeholder="Calendar ID" />
          <input className="input" value={subscriptionCalendarName} onChange={(e) => setSubscriptionCalendarName(e.target.value)} placeholder="Calendar name (optional)" />
          <button
            className="btn-primary"
            onClick={() =>
              subscribeCalendar.mutate(
                {
                  account_id: subscriptionAccountId,
                  calendar_id: subscriptionCalendarId.trim(),
                  calendar_name: subscriptionCalendarName.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    setSubscriptionCalendarId('');
                    setSubscriptionCalendarName('');
                    toast.success('Calendar subscription created');
                  },
                  onError: () => toast.error('Failed to subscribe calendar'),
                },
              )
            }
            disabled={!subscriptionAccountId || !subscriptionCalendarId.trim() || subscribeCalendar.isPending}
          >
            <Plus className="mr-1 inline h-4 w-4" /> Subscribe
          </button>

          <div className="space-y-2">
            {calendarSubscriptionRows.length === 0 ? (
              <p className="text-sm text-slate-500">No subscriptions yet.</p>
            ) : (
              calendarSubscriptionRows.map((row) => (
                <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-medium">{rowStr(row, 'calendar_name') || rowStr(row, 'calendar_id') || 'calendar'}</p>
                    <p className="text-xs text-slate-500">{rowStr(row, 'provider') || 'calendar'}</p>
                  </div>
                  <button
                    className="btn-danger btn-sm"
                    onClick={() =>
                      rowStr(row, 'id') &&
                      unsubscribeCalendar.mutate(rowStr(row, 'id') as string, {
                        onSuccess: () => toast.success('Subscription removed'),
                        onError: () => toast.error('Failed to remove subscription'),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div id="git" className="mt-8 card">
        <h3 className="text-base font-semibold">Git Repositories</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {gitRows.length === 0 ? (
            <p className="text-sm text-slate-500">No repositories registered.</p>
          ) : (
            gitRows.map((row) => (
              <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <p className="font-medium">{rowStr(row, 'name') || rowStr(row, 'repo') || 'repository'}</p>
                <p className="text-xs text-slate-500">{rowStr(row, 'provider') || rowStr(row, 'url') || 'git source'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div id="web" className="mt-8 card">
        <h3 className="text-base font-semibold">Web Fetch Allowlist</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {webRows.length === 0 ? (
            <p className="text-sm text-slate-500">No allowlisted domains.</p>
          ) : (
            webRows.map((row) => (
              <div key={rowStr(row, 'id') ?? crypto.randomUUID()} className="rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                <p className="font-medium">{rowStr(row, 'domain') || rowStr(row, 'host') || rowStr(row, 'pattern') || 'domain'}</p>
                <p className="text-xs text-slate-500">{rowStr(row, 'scope') || 'web fetch policy'}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <IntegrationsPageContent />
    </Suspense>
  );
}
