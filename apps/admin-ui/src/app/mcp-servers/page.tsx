'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import Link from 'next/link';
import {
  useChats,
  useCreateMcpServer,
  useDeleteMcpServer,
  useMcpCatalog,
  useMcpChatOverrides,
  useMcpPresets,
  useMcpSharedTokenConfig,
  useMcpServers,
  useReconnectMcpServers,
  useInstallIntegrationLibraryProfile,
  useRunIntegrationRecoveryPlaybook,
  useTestMcpServer,
  useUpdateMcpSharedTokenConfig,
  useUpsertMcpChatOverride,
} from '@/lib/hooks';
import { ApiError } from '@/lib/api';

type McpServerRow = {
  id: string;
  name?: string;
  transport?: string;
  url?: string;
  status?: string;
};
type ChatRow = {
  id: string;
  name?: string;
};
type OverrideRow = {
  server_id?: string;
  enabled?: boolean;
};
type CatalogRow = {
  id: string;
  qualified_name?: string;
  server_name?: string;
  tool_name?: string;
};
type McpPreset = {
  id: string;
  name: string;
  transport: 'http' | 'sse' | 'stdio';
  url: string;
  description: string;
  mode: 'install' | 'template';
  badge: string;
  installed?: boolean;
  connected?: boolean;
  verification_unavailable?: boolean;
};

const FALLBACK_PRESET_CATALOG: McpPreset[] = [
  {
    id: 'local-sven-gateway',
    name: 'Local Sven Gateway MCP',
    transport: 'http',
    url: 'http://localhost:3000/v1/mcp',
    description: 'Best default for this machine. Uses your local gateway.',
    mode: 'install',
    badge: 'Local Ready',
  },
];

function mapRows<T>(rows: unknown, mapper: (r: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null)
    .map(mapper)
    .filter((r): r is T => r !== null);
}

function describeApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const body = error.body as { error?: { message?: unknown } } | null;
    const message = body?.error?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }
  return fallback;
}

export default function McpServersPage() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [transport, setTransport] = useState<'http' | 'sse' | 'stdio'>('http');
  const [chatId, setChatId] = useState('');
  const [overrideServerId, setOverrideServerId] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [sharedTokenEnabled, setSharedTokenEnabled] = useState(false);
  const [sharedTokenEnabledDirty, setSharedTokenEnabledDirty] = useState(false);
  const [sharedToken, setSharedToken] = useState('');
  const [sharedTokenDirty, setSharedTokenDirty] = useState(false);

  const servers = useMcpServers();
  const presetRows = useMcpPresets();
  const sharedTokenConfig = useMcpSharedTokenConfig();
  const chats = useChats();
  const overrides = useMcpChatOverrides(chatId || undefined);
  const catalog = useMcpCatalog(chatId || undefined);
  const createServer = useCreateMcpServer();
  const deleteServer = useDeleteMcpServer();
  const testServer = useTestMcpServer();
  const updateSharedTokenConfig = useUpdateMcpSharedTokenConfig();
  const reconnect = useReconnectMcpServers();
  const installLibraryProfile = useInstallIntegrationLibraryProfile();
  const runRecoveryPlaybook = useRunIntegrationRecoveryPlaybook();
  const upsertOverride = useUpsertMcpChatOverride();
  const [provisioningInFlight, setProvisioningInFlight] = useState<'starter' | 'full' | ''>('');

  const localPresets: Array<{ name: string; transport: 'http' | 'sse' | 'stdio'; url: string; auth_token?: string }> = [
    {
      name: 'Local Sven Gateway MCP',
      transport: 'http',
      url: 'http://localhost:3000/v1/mcp',
    },
  ];

  const rows = mapRows<McpServerRow>(servers.data?.data, (row) => {
    if (typeof row.id !== 'string') return null;
    return {
      id: row.id,
      name: typeof row.name === 'string' ? row.name : undefined,
      transport: typeof row.transport === 'string' ? row.transport : undefined,
      url: typeof row.url === 'string' ? row.url : undefined,
      status: typeof row.status === 'string' ? row.status : undefined,
    };
  });
  const chatRows = mapRows<ChatRow>(chats.data?.rows, (chat) => {
    if (typeof chat.id !== 'string') return null;
    return { id: chat.id, name: typeof chat.name === 'string' ? chat.name : undefined };
  });
  const overrideRows = mapRows<OverrideRow>(overrides.data?.data, (row) => ({
    server_id: typeof row.server_id === 'string' ? row.server_id : undefined,
    enabled: Boolean(row.enabled),
  }));
  const catalogRows = mapRows<CatalogRow>(catalog.data?.data, (row) => {
    if (typeof row.id !== 'string') return null;
    return {
      id: row.id,
      qualified_name: typeof row.qualified_name === 'string' ? row.qualified_name : undefined,
      server_name: typeof row.server_name === 'string' ? row.server_name : undefined,
      tool_name: typeof row.tool_name === 'string' ? row.tool_name : undefined,
    };
  });

  const overrideMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of overrideRows) map.set(String(row.server_id), Boolean(row.enabled));
    return map;
  }, [overrideRows]);

  const presetCatalog = useMemo(() => {
    const resolved = mapRows<McpPreset>(presetRows.data?.data, (row) => {
      if (typeof row.id !== 'string') return null;
      const transport = row.transport;
      if (transport !== 'http' && transport !== 'sse' && transport !== 'stdio') return null;
      return {
        id: row.id,
        name: typeof row.name === 'string' ? row.name : row.id,
        transport,
        url: typeof row.url === 'string' ? row.url : '',
        description: typeof row.description === 'string' ? row.description : '',
        mode: row.mode === 'install' ? 'install' : 'template',
        badge: typeof row.badge === 'string' ? row.badge : 'Template',
        installed: typeof row.installed === 'boolean' ? row.installed : undefined,
        connected: typeof row.connected === 'boolean' ? row.connected : undefined,
        verification_unavailable: typeof row.verification_unavailable === 'boolean' ? row.verification_unavailable : undefined,
      };
    });
    return resolved.length > 0 ? resolved : FALLBACK_PRESET_CATALOG;
  }, [presetRows.data?.data]);

  const sharedTokenConfigData = sharedTokenConfig.data?.data;

  useEffect(() => {
    if (!sharedTokenConfigData) return;
    if (!sharedTokenEnabledDirty) {
      setSharedTokenEnabled(Boolean(sharedTokenConfigData.enabled));
    }
    if (!sharedTokenDirty) setSharedToken('');
  }, [sharedTokenConfigData, sharedTokenDirty, sharedTokenEnabledDirty]);

  async function installLocalPresets() {
    const existingNames = new Set(rows.map((r) => String(r.name || '').trim().toLowerCase()).filter(Boolean));
    const missing = localPresets.filter((preset) => !existingNames.has(preset.name.trim().toLowerCase()));
    if (missing.length === 0) {
      toast.info('Local MCP presets already installed');
      return;
    }

    let installed = 0;
    let failed = 0;
    for (const preset of missing) {
      try {
        await createServer.mutateAsync(preset);
        installed += 1;
      } catch {
        failed += 1;
      }
    }

    if (installed > 0 && failed === 0) {
      toast.success(`Installed ${installed} MCP preset${installed === 1 ? '' : 's'}`);
      return;
    }
    if (installed > 0 && failed > 0) {
      toast.warning(`Installed ${installed}, failed ${failed}. Check server uniqueness and endpoint reachability.`);
      return;
    }
    toast.error('Failed to install local MCP presets');
  }

  async function installOnePreset(preset: McpPreset) {
    const exists = rows.some((r) => String(r.name || '').trim().toLowerCase() === preset.name.trim().toLowerCase());
    if (exists) {
      toast.info(`${preset.name} is already installed`);
      return;
    }
    try {
      const created = await createServer.mutateAsync({
        name: preset.name,
        transport: preset.transport,
        url: preset.url,
      });
      const createdRecord =
        created && typeof created === 'object' ? (created as Record<string, unknown>) : null;
      const createdData =
        createdRecord && createdRecord.data && typeof createdRecord.data === 'object'
          ? (createdRecord.data as Record<string, unknown>)
          : null;
      const createdId =
        createdData && typeof createdData.id === 'string'
          ? String(createdData.id)
          : '';
      if (!createdId || preset.verification_unavailable) {
        toast.success(
          preset.verification_unavailable
            ? `Installed: ${preset.name} (manual MCP auth required for verification)`
            : `Installed: ${preset.name} (verification pending)`,
        );
        return;
      }
      await testServer.mutateAsync(createdId);
      toast.success(`Installed + verified: ${preset.name}`);
    } catch {
      toast.warning(`Installed ${preset.name}, but verification failed. Use "Test" from Registered Servers.`);
    }
  }

  async function verifyPresetConnection(preset: McpPreset) {
    const server = rows.find((r) => String(r.name || '').trim().toLowerCase() === preset.name.trim().toLowerCase());
    if (!server?.id) {
      toast.error(`Cannot verify ${preset.name}: server not found`);
      return;
    }
    try {
      await testServer.mutateAsync(server.id);
      toast.success(`Verified: ${preset.name}`);
    } catch (error) {
      toast.error(describeApiError(error, `Verification failed: ${preset.name}`));
    }
  }

  function applyTemplatePreset(preset: McpPreset) {
    setName(preset.name);
    setTransport(preset.transport);
    setUrl(preset.url);
    toast.success(`Template loaded: ${preset.name}`);
  }

  function generateSharedToken() {
    const uuid = globalThis.crypto?.randomUUID?.() || Array.from(globalThis.crypto?.getRandomValues?.(new Uint8Array(16)) ?? new Uint8Array(16), (b) => b.toString(16).padStart(2, '0')).join('');
    setSharedToken(`sven-mcp-${uuid.replace(/-/g, '')}`);
    setSharedTokenDirty(true);
  }

  async function saveSharedTokenConfig() {
    if (sharedTokenEnabled && !sharedTokenConfigData?.token_configured && sharedToken.trim().length < 16) {
      toast.error('Set a shared MCP token with at least 16 characters before enabling verification');
      return;
    }
    try {
      await updateSharedTokenConfig.mutateAsync({
        enabled: sharedTokenEnabled,
        token: sharedTokenDirty ? sharedToken : undefined,
      });
      setSharedTokenEnabledDirty(false);
      setSharedToken('');
      setSharedTokenDirty(false);
      toast.success('Shared MCP auth updated');
    } catch (error) {
      toast.error(describeApiError(error, 'Failed to update shared MCP auth'));
    }
  }

  async function installStarterPack() {
    setProvisioningInFlight('starter');
    await installLocalPresets();
    try {
      const result = await installLibraryProfile.mutateAsync({
        profileId: 'recommended-local',
        payload: { deploy_runtime: true, overwrite_existing: false },
      });
      const data = result.data;
      const attempted = Number(data?.attempted || 0);
      const succeeded = Number(data?.succeeded || 0);
      const failed = Number(data?.failed || 0);
      if (failed === 0) {
        toast.success(`Starter pack ready: ${succeeded}/${attempted} integrations installed`);
      } else {
        toast.warning(`Starter pack partial: ${succeeded}/${attempted} integrations installed`);
      }
      await runRecoveryPlaybook.mutateAsync({
        retry_failed: true,
        deploy_stopped: true,
        apply_templates_unconfigured: true,
        validate_unconfigured: true,
      });
      toast.success('Starter pack prepared for Sven (recovery playbook complete)');
    } catch {
      toast.error('Failed to install recommended integration starter pack');
    } finally {
      setProvisioningInFlight('');
    }
  }

  async function installFullEcosystem() {
    setProvisioningInFlight('full');
    await installLocalPresets();
    try {
      const result = await installLibraryProfile.mutateAsync({
        profileId: 'full-ecosystem',
        payload: { deploy_runtime: true, overwrite_existing: false },
      });
      const data = result.data;
      const attempted = Number(data?.attempted || 0);
      const succeeded = Number(data?.succeeded || 0);
      const failed = Number(data?.failed || 0);
      if (failed === 0) {
        toast.success(`Full ecosystem installed: ${succeeded}/${attempted}`);
      } else {
        toast.warning(`Full ecosystem partial: ${succeeded}/${attempted} installed`);
      }
      await runRecoveryPlaybook.mutateAsync({
        retry_failed: true,
        deploy_stopped: true,
        apply_templates_unconfigured: true,
        validate_unconfigured: true,
      });
      toast.success('Full ecosystem prepared for Sven (recovery playbook complete)');
    } catch {
      toast.error('Failed to install full ecosystem');
    } finally {
      setProvisioningInFlight('');
    }
  }

  return (
    <>
      <PageHeader title="MCP Servers" description="Manage MCP client servers, per-chat overrides, and catalog sync" />

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Shared Gateway MCP Auth</h3>
          <span className={sharedTokenConfigData?.enabled && sharedTokenConfigData?.token_configured ? 'badge-success' : 'badge-neutral'}>
            {sharedTokenConfigData?.enabled && sharedTokenConfigData?.token_configured
              ? `Ready${sharedTokenConfigData?.token_preview ? ` · ${sharedTokenConfigData.token_preview}` : ''}`
              : 'Not configured'}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Configure one shared local MCP token so the built-in <code>Local Sven Gateway MCP</code> preset can verify without per-server secrets.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr_auto_auto] md:items-center">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sharedTokenEnabled}
              onChange={(e) => {
                setSharedTokenEnabled(e.target.checked);
                setSharedTokenEnabledDirty(true);
              }}
            />
            Enable shared gateway auth
          </label>
          <input
            className="input"
            type="text"
            placeholder={sharedTokenConfigData?.token_configured ? `Leave blank to keep ${sharedTokenConfigData.token_preview || 'current token'}` : 'Paste or generate shared token'}
            value={sharedToken}
            onChange={(e) => {
              setSharedToken(e.target.value);
              setSharedTokenDirty(true);
            }}
          />
          <button className="btn-secondary btn-sm" onClick={generateSharedToken}>
            Generate token
          </button>
          <button className="btn-primary btn-sm" onClick={saveSharedTokenConfig} disabled={updateSharedTokenConfig.isPending}>
            {updateSharedTokenConfig.isPending ? 'Saving...' : 'Save auth'}
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Quick Setup Presets</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-primary"
              onClick={installStarterPack}
              disabled={createServer.isPending || installLibraryProfile.isPending || runRecoveryPlaybook.isPending || !!provisioningInFlight}
            >
              {provisioningInFlight === 'starter' ? 'Installing starter pack...' : 'Install starter pack'}
            </button>
            <button
              className="btn-primary"
              onClick={installFullEcosystem}
              disabled={createServer.isPending || installLibraryProfile.isPending || runRecoveryPlaybook.isPending || !!provisioningInFlight}
            >
              {provisioningInFlight === 'full' ? 'Installing full ecosystem...' : 'Install full ecosystem'}
            </button>
            <button className="btn-secondary" onClick={installLocalPresets} disabled={createServer.isPending}>
              Install local presets
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-500">Install with one click, or load a template into the form below.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {presetCatalog.map((preset) => {
            const rowMatch = rows.find((r) => String(r.name || '').trim().toLowerCase() === preset.name.trim().toLowerCase());
            const installed = preset.installed ?? Boolean(rowMatch);
            const connected = preset.connected ?? String(rowMatch?.status || '').trim().toLowerCase() === 'connected';
            const verificationUnavailable = Boolean(preset.verification_unavailable);
            return (
              <div key={preset.id} className="rounded border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{preset.name}</p>
                    <p className="text-xs text-slate-500">{preset.description}</p>
                  </div>
                  <span className={connected ? 'badge-success' : installed ? 'badge-neutral' : 'badge-neutral'}>
                    {connected
                      ? 'Installed + Verified'
                      : installed
                      ? verificationUnavailable
                        ? 'Installed (Verification Unavailable)'
                        : 'Installed (Unverified)'
                      : preset.badge}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  <span className="mr-2 rounded border px-2 py-0.5">{preset.transport}</span>
                  <code>{preset.url}</code>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {preset.mode === 'install' ? (
                    connected ? (
                      <button className="btn-primary btn-sm" disabled>
                        Installed
                      </button>
                    ) : installed ? (
                      <button
                        className="btn-secondary btn-sm"
                        disabled={testServer.isPending || verificationUnavailable}
                        onClick={() => verifyPresetConnection(preset)}
                      >
                        {verificationUnavailable ? 'Manual auth required' : 'Verify connection'}
                      </button>
                    ) : (
                      <button
                        className="btn-primary btn-sm"
                        disabled={createServer.isPending}
                        onClick={() => installOnePreset(preset)}
                      >
                        Install now
                      </button>
                    )
                  ) : (
                    <button className="btn-secondary btn-sm" onClick={() => applyTemplatePreset(preset)}>
                      Use template
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Integration Shortcuts</h3>
        <p className="text-xs text-slate-500">Use these pages for app integrations, skill installs, and policy control.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/integrations" className="btn-secondary btn-sm">Open Integrations</Link>
          <Link href="/registry" className="btn-secondary btn-sm">Open Registry</Link>
          <Link href="/skills" className="btn-secondary btn-sm">Open Installed Skills</Link>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Add MCP Server</h3>
          <button className="btn-secondary" onClick={installLocalPresets} disabled={createServer.isPending}>
            Install local presets
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Preset installs <code>Local Sven Gateway MCP</code> at <code>http://localhost:3000/v1/mcp</code>. Automatic verification uses the shared gateway token above unless a server-specific token is configured.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input className="input" placeholder="name" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="input"
            value={transport}
            onChange={(e) => setTransport(e.target.value as 'http' | 'sse' | 'stdio')}
          >
            <option value="http">http</option>
            <option value="sse">sse</option>
            <option value="stdio">stdio</option>
          </select>
          <input className="input md:col-span-2" placeholder="url or stdio command" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <button
          className="btn-primary"
          onClick={() =>
            createServer.mutate(
              { name, transport, url },
              {
                onSuccess: () => {
                  toast.success('MCP server created');
                  setName('');
                  setUrl('');
                },
                onError: () => toast.error('Failed to create MCP server'),
              },
            )
          }
        >
          Add server
        </button>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Registered Servers</h3>
          <button
            className="btn-secondary"
            onClick={() => reconnect.mutate(undefined, { onSuccess: () => toast.success('Reconnect run complete'), onError: () => toast.error('Reconnect failed') })}
          >
            Reconnect all
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-sm">
              <span className="font-medium">{row.name ?? 'server'}</span>
              <span className="badge-neutral">{row.transport ?? '—'}</span>
              <span className="text-slate-500">{row.url ?? '—'}</span>
              <span className={row.status === 'connected' ? 'badge-success' : 'badge-neutral'}>{row.status || 'unknown'}</span>
              <button
                className="btn-secondary"
                onClick={() =>
                  testServer.mutate(row.id, {
                    onSuccess: () => toast.success(`Test passed: ${row.name}`),
                    onError: (error) => toast.error(describeApiError(error, `Test failed: ${row.name}`)),
                  })
                }
              >
                Test
              </button>
              <button
                className="btn-danger"
                onClick={() => deleteServer.mutate(row.id, { onSuccess: () => toast.success('Server removed'), onError: () => toast.error('Delete failed') })}
              >
                Remove
              </button>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-sm text-slate-500">No MCP servers configured.</p> : null}
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="font-semibold">Per-chat Overrides</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <select className="input" value={chatId} onChange={(e) => setChatId(e.target.value)}>
            <option value="">Select chat</option>
            {chatRows.map((chat) => (
              <option key={chat.id} value={chat.id}>
                {chat.name || chat.id}
              </option>
            ))}
          </select>
          <select className="input" value={overrideServerId} onChange={(e) => setOverrideServerId(e.target.value)}>
            <option value="">Select server</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name ?? row.id}
              </option>
            ))}
          </select>
          <select className="input" value={overrideEnabled ? 'enabled' : 'disabled'} onChange={(e) => setOverrideEnabled(e.target.value === 'enabled')}>
            <option value="enabled">enabled</option>
            <option value="disabled">disabled</option>
          </select>
          <button
            className="btn-primary"
            onClick={() =>
              upsertOverride.mutate(
                { chatId, serverId: overrideServerId, enabled: overrideEnabled },
                { onSuccess: () => toast.success('Override saved'), onError: () => toast.error('Failed to save override') },
              )
            }
            disabled={!chatId || !overrideServerId}
          >
            Save override
          </button>
        </div>
        <div className="space-y-1 text-sm">
          {rows.map((row) => (
            <div key={`ovr-${row.id}`} className="flex items-center gap-2">
              <span className="w-48">{row.name ?? row.id}</span>
              <span className={overrideMap.get(String(row.id)) ? 'badge-success' : 'badge-neutral'}>
                {overrideMap.has(String(row.id)) ? (overrideMap.get(String(row.id)) ? 'enabled' : 'disabled') : 'default'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-semibold">Effective MCP Tool Catalog</h3>
        <p className="text-sm text-slate-500">Shows tools visible to the selected chat (or global default if no chat selected).</p>
        <div className="max-h-72 space-y-1 overflow-auto rounded border p-2 text-sm">
          {catalogRows.map((row) => (
            <div key={row.id} className="rounded border px-2 py-1">
              <div className="font-mono">{row.qualified_name ?? row.id}</div>
              <div className="text-slate-500">{row.server_name ?? 'server'} • {row.tool_name ?? 'tool'}</div>
            </div>
          ))}
          {catalogRows.length === 0 ? <p className="text-slate-500">No catalog entries yet. Run Test/Reconnect to discover tools.</p> : null}
        </div>
      </div>
    </>
  );
}
