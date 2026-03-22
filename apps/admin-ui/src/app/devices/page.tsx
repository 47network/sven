'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  Laptop2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { PageSpinner } from '@/components/Spinner';
import type { AdminDeviceDetailRecord, AdminDeviceRecord } from '@/lib/api';
import {
  useConfirmDevicePairing,
  useCreateDevice,
  useDeleteDevice,
  useDeviceDetail,
  useDevices,
  useRegenerateDeviceApiKey,
  useSendDeviceCommand,
} from '@/lib/hooks';

const DEVICE_CAPABILITIES = [
  { key: 'display', label: 'Display' },
  { key: 'camera', label: 'Camera' },
  { key: 'audio', label: 'Audio' },
  { key: 'sensors', label: 'Sensors' },
  { key: 'desktop_control', label: 'Desktop Control' },
] as const;

const DEVICE_TYPES = [
  { value: 'mirror', label: 'Mirror' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'sensor_hub', label: 'Sensor Hub' },
] as const;

function toneForStatus(status: string): string {
  if (status === 'online') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
  if (status === 'pairing') return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
  return 'border-slate-700 bg-slate-900/70 text-slate-300';
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
}

function deviceTypeLabel(value?: string): string {
  return DEVICE_TYPES.find((row) => row.value === value)?.label || String(value || 'Device');
}

function prettyJson(value: unknown): string {
  if (value == null) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function initialCreateState() {
  return {
    name: '',
    deviceType: 'mirror',
    capabilities: ['display'] as string[],
  };
}

export default function DevicesPage() {
  const devicesQuery = useDevices();
  const createDevice = useCreateDevice();
  const confirmPairing = useConfirmDevicePairing();
  const regenerateApiKey = useRegenerateDeviceApiKey();
  const sendCommand = useSendDeviceCommand();
  const deleteDevice = useDeleteDevice();

  const devices = devicesQuery.data?.data || [];
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [createState, setCreateState] = useState(initialCreateState);
  const [pairingInputs, setPairingInputs] = useState<Record<string, string>>({});
  const [latestApiKey, setLatestApiKey] = useState('');
  const [commandDrafts, setCommandDrafts] = useState<Record<string, { command: string; payload: string }>>({});

  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(String(devices[0].id || ''));
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (!selectedDeviceId) return;
    if (devices.some((device) => device.id === selectedDeviceId)) return;
    setSelectedDeviceId(devices[0]?.id ? String(devices[0].id) : '');
  }, [devices, selectedDeviceId]);

  const detailQuery = useDeviceDetail(selectedDeviceId);
  const selectedDetail = detailQuery.data?.data;

  const deviceCount = devices.length;
  const onlineCount = devices.filter((row) => String(row.status) === 'online').length;
  const pairingCount = devices.filter((row) => String(row.status) === 'pairing').length;
  const selectedDraft = useMemo(() => ensureCommandDraft(selectedDeviceId), [commandDrafts, selectedDeviceId]);

  const loading = devicesQuery.isLoading && devices.length === 0;
  if (loading) return <PageSpinner />;

  function updateCreateCapability(capability: string, checked: boolean) {
    setCreateState((current) => ({
      ...current,
      capabilities: checked
        ? Array.from(new Set([...current.capabilities, capability]))
        : current.capabilities.filter((value) => value !== capability),
    }));
  }

  function handleCreateDevice() {
    const name = createState.name.trim();
    if (!name) {
      toast.error('Device name is required');
      return;
    }
    if (createState.capabilities.length === 0) {
      toast.error('Select at least one capability');
      return;
    }
    createDevice.mutate(
      {
        name,
        device_type: createState.deviceType as 'mirror' | 'tablet' | 'kiosk' | 'sensor_hub',
        capabilities: createState.capabilities,
      },
      {
        onSuccess: (res) => {
          const created = res.data;
          const createdId = String(created.id || '');
          setSelectedDeviceId(createdId);
          setPairingInputs((current) => ({ ...current, [createdId]: String(created.pairing_code || '') }));
          setCreateState(initialCreateState());
          toast.success('Device registered in pairing mode');
        },
        onError: () => toast.error('Failed to register device'),
      },
    );
  }

  function handleConfirmPairing(device: AdminDeviceRecord) {
    const pairingCode = String(pairingInputs[device.id] || '').trim().toUpperCase();
    if (!pairingCode) {
      toast.error('Pairing code is required');
      return;
    }
    confirmPairing.mutate(
      { id: device.id, pairingCode },
      {
        onSuccess: (res) => {
          setLatestApiKey(String(res.data.api_key || ''));
          toast.success('Device paired');
        },
        onError: () => toast.error('Pairing failed'),
      },
    );
  }

  function handleRegenerateApiKey(deviceId: string) {
    regenerateApiKey.mutate(deviceId, {
      onSuccess: (res) => {
        setLatestApiKey(String(res.data.api_key || ''));
        toast.success('New API key generated');
      },
      onError: () => toast.error('Failed to regenerate API key'),
    });
  }

  function ensureCommandDraft(deviceId: string) {
    return commandDrafts[deviceId] || { command: 'ping', payload: '{}' };
  }

  function setCommandDraft(deviceId: string, patch: Partial<{ command: string; payload: string }>) {
    setCommandDrafts((current) => ({
      ...current,
      [deviceId]: {
        ...ensureCommandDraft(deviceId),
        ...patch,
      },
    }));
  }

  function handleSendCommand(deviceId: string) {
    const draft = ensureCommandDraft(deviceId);
    const command = String(draft.command || '').trim();
    if (!command) {
      toast.error('Command is required');
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(String(draft.payload || '{}'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Payload must be a JSON object');
      }
      payload = parsed as Record<string, unknown>;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Invalid JSON payload');
      return;
    }
    sendCommand.mutate(
      { id: deviceId, command, payload },
      {
        onSuccess: () => toast.success(`Command queued: ${command}`),
        onError: () => toast.error('Failed to queue command'),
      },
    );
  }

  async function copyApiKey() {
    if (!latestApiKey) return;
    try {
      await navigator.clipboard.writeText(latestApiKey);
      toast.success('API key copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  function handleDeleteDevice(deviceId: string) {
    if (!window.confirm('Delete this device?')) return;
    deleteDevice.mutate(deviceId, {
      onSuccess: () => {
        if (selectedDeviceId === deviceId) setSelectedDeviceId('');
        toast.success('Device deleted');
      },
      onError: () => toast.error('Delete failed'),
    });
  }

  return (
    <>
      <PageHeader
        title="Devices"
        description="Register edge devices, complete pairing, issue commands, and inspect command/event history."
      />

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="card">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Fleet</p>
          <p className="mt-1 text-2xl font-semibold text-cyan-300">{deviceCount}</p>
        </div>
        <div className="card">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Online</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{onlineCount}</p>
        </div>
        <div className="card">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Pairing</p>
          <p className="mt-1 text-2xl font-semibold text-amber-300">{pairingCount}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <section className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Register Device</h2>
              <p className="text-sm text-slate-400">Create a device record, then confirm pairing with the code shown on the target device.</p>
            </div>
            <button
              className="btn flex items-center gap-1"
              onClick={() => devicesQuery.refetch()}
              disabled={devicesQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${devicesQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Device name</span>
              <input
                className="input"
                value={createState.name}
                onChange={(e) => setCreateState((current) => ({ ...current, name: e.target.value }))}
                placeholder="Kitchen Mirror"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-slate-400">Device type</span>
              <select
                className="input"
                value={createState.deviceType}
                onChange={(e) => setCreateState((current) => ({ ...current, deviceType: e.target.value }))}
              >
                {DEVICE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm text-slate-400">Capabilities</p>
            <div className="flex flex-wrap gap-2">
              {DEVICE_CAPABILITIES.map((capability) => {
                const checked = createState.capabilities.includes(capability.key);
                return (
                  <label
                    key={capability.key}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                      checked ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200' : 'border-slate-700 bg-slate-900/60 text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={(e) => updateCreateCapability(capability.key, e.target.checked)}
                    />
                    {capability.label}
                  </label>
                );
              })}
            </div>
          </div>
          <button className="btn-primary inline-flex items-center gap-1" onClick={handleCreateDevice} disabled={createDevice.isPending}>
            <Plus className="h-4 w-4" />
            Register Device
          </button>
        </section>

        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">API Key Vault</h2>
          <p className="text-sm text-slate-400">
            Device API keys are shown once after pairing or regeneration. Copy them immediately into the actual device agent.
          </p>
          <textarea
            className="input min-h-[180px] font-mono text-xs"
            readOnly
            value={latestApiKey}
            placeholder="Pair or regenerate a device to reveal its API key here."
          />
          <button className="btn inline-flex items-center gap-1" onClick={() => void copyApiKey()} disabled={!latestApiKey}>
            <Copy className="h-4 w-4" />
            Copy API Key
          </button>
        </section>
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={MonitorSmartphone}
          title="No devices registered"
          description="Register a device to start pairing, command delivery, and live fleet monitoring."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-3">
            {devices.map((device) => {
              const selected = device.id === selectedDeviceId;
              return (
                <div
                  key={device.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDeviceId(device.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedDeviceId(device.id);
                    }
                  }}
                  className={`card w-full text-left transition ${selected ? 'border-cyan-400/40 bg-slate-900/85' : ''}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{device.name}</span>
                        <span className={`rounded border px-2 py-0.5 text-xs ${toneForStatus(device.status)}`}>
                          {String(device.status || 'unknown').toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {deviceTypeLabel(device.device_type)} | Last seen {formatDate(device.last_seen_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                        {(device.capabilities || []).map((capability) => (
                          <span key={capability} className="rounded-full border border-slate-700 bg-slate-900/60 px-2 py-0.5">
                            {capability}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {String(device.status) === 'online' ? <Wifi className="h-4 w-4 text-emerald-300" /> : <WifiOff className="h-4 w-4 text-slate-500" />}
                      <button
                        className="btn-danger btn-sm inline-flex items-center gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDevice(device.id);
                        }}
                        disabled={deleteDevice.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>

                  {String(device.status) === 'pairing' ? (
                    <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
                      <p className="text-sm font-medium text-amber-200">Pairing pending</p>
                      <p className="mt-1 text-xs text-slate-400">Enter the code shown on the device, or use the prefilled code returned by registration.</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          className="input max-w-[220px] font-mono uppercase tracking-[0.35em]"
                          value={pairingInputs[device.id] || ''}
                          onChange={(e) => setPairingInputs((current) => ({ ...current, [device.id]: e.target.value.toUpperCase() }))}
                          placeholder="ABC123"
                        />
                        <button
                          className="btn-primary btn-sm inline-flex items-center gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmPairing(device);
                          }}
                          disabled={confirmPairing.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirm Pairing
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <section className="card space-y-4">
            {!selectedDeviceId ? (
              <EmptyState
                icon={Laptop2}
                title="Select a device"
                description="Pick a registered device to inspect history, rotate keys, and queue commands."
              />
            ) : detailQuery.isLoading && !selectedDetail ? (
              <PageSpinner />
            ) : selectedDetail ? (
              <DeviceInspector
                detail={selectedDetail}
                commandDraft={selectedDraft}
                onCommandDraftChange={(patch) => setCommandDraft(selectedDetail.id, patch)}
                onQueueCommand={() => handleSendCommand(selectedDetail.id)}
                queueing={sendCommand.isPending}
                onRegenerateApiKey={() => handleRegenerateApiKey(selectedDetail.id)}
                regenerating={regenerateApiKey.isPending}
              />
            ) : (
              <EmptyState
                icon={Laptop2}
                title="Device detail unavailable"
                description="Refresh the fleet and select the device again."
              />
            )}
          </section>
        </div>
      )}
    </>
  );
}

function DeviceInspector({
  detail,
  commandDraft,
  onCommandDraftChange,
  onQueueCommand,
  queueing,
  onRegenerateApiKey,
  regenerating,
}: {
  detail: AdminDeviceDetailRecord;
  commandDraft: { command: string; payload: string };
  onCommandDraftChange: (patch: Partial<{ command: string; payload: string }>) => void;
  onQueueCommand: () => void;
  queueing: boolean;
  onRegenerateApiKey: () => void;
  regenerating: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{detail.name}</h2>
          <p className="text-sm text-slate-400">
            {deviceTypeLabel(detail.device_type)} | Paired {formatDate(detail.paired_at)} | Last seen {formatDate(detail.last_seen_at)}
          </p>
        </div>
        <button className="btn btn-sm" onClick={onRegenerateApiKey} disabled={regenerating}>
          Rotate API Key
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Capabilities</p>
          <p className="mt-2 text-sm text-slate-200">{(detail.capabilities || []).join(', ') || '—'}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Config</p>
          <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-300">{prettyJson(detail.config)}</pre>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Queue Command</p>
          <span className="text-xs text-slate-500">Valid commands include ping, display, open_url, tts_speak, reboot</span>
        </div>
        <div className="grid gap-3">
          <input
            className="input"
            value={commandDraft.command}
            onChange={(e) => onCommandDraftChange({ command: e.target.value })}
            placeholder="ping"
          />
          <textarea
            className="input min-h-[120px] font-mono text-xs"
            value={commandDraft.payload}
            onChange={(e) => onCommandDraftChange({ payload: e.target.value })}
          />
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={onQueueCommand} disabled={queueing}>
              Queue Command
            </button>
            <button className="btn btn-sm" onClick={() => onCommandDraftChange({ command: 'ping', payload: '{}' })}>
              Quick Ping
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="font-medium">Recent Commands</p>
          {detail.recent_commands?.length ? detail.recent_commands.map((command) => (
            <div key={command.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{command.command}</span>
                <span className={`rounded border px-2 py-0.5 text-xs ${toneForStatus(command.status)}`}>
                  {String(command.status || '').toUpperCase()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{formatDate(command.created_at)}</p>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-300">{prettyJson(command.result_payload || command.payload)}</pre>
              {command.error_message ? <p className="mt-2 text-xs text-rose-300">{command.error_message}</p> : null}
            </div>
          )) : (
            <EmptyState icon={MonitorSmartphone} title="No commands yet" description="Queued commands and acknowledgements will appear here." />
          )}
        </div>

        <div className="space-y-2">
          <p className="font-medium">Recent Events</p>
          {detail.recent_events?.length ? detail.recent_events.map((event) => (
            <div key={event.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{event.event_type}</span>
                <span className="text-xs text-slate-500">{formatDate(event.created_at)}</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-300">{prettyJson(event.payload)}</pre>
            </div>
          )) : (
            <EmptyState icon={Smartphone} title="No events yet" description="Device heartbeats, telemetry, and relay events will appear here." />
          )}
        </div>
      </div>
    </>
  );
}
