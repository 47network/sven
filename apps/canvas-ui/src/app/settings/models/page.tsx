'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Settings, Download, Trash2, Plus, RefreshCw,
  Cpu, HardDrive, Zap, ToggleLeft, ToggleRight,
  Eye, Mic, Wrench, Globe, ChevronDown, ChevronUp,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';

/**
 * 6.9 Settings UI — Model Management
 * Toggle on/off, model download/update, disk usage, inference speed stats,
 * module management. Calls existing admin/gemma4 routes.
 */

const API_BASE = '/api/v1/admin';

interface ModelProfile {
  id: string;
  model_key: string;
  model_name: string;
  provider: string;
  platform_type: string;
  parameter_count: string;
  quantization: string;
  context_window: number;
  supports_audio: boolean;
  supports_vision: boolean;
  supports_function_calling: boolean;
  license: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

interface ModuleInstall {
  id: string;
  module_id: string;
  module_name?: string;
  category?: string;
  installed_version?: string;
  download_progress?: number;
  disk_usage_bytes?: number;
  status?: string;
  installed_at?: string;
}

interface RoutingPolicy {
  local_threshold: number;
  offline_mode: string;
  max_cloud_tokens_per_day: number;
}

interface PipelineStats {
  total_jobs?: number;
  completed?: number;
  failed?: number;
  escalated?: number;
  local_processed?: number;
  server_processed?: number;
  avg_processing_ms?: number;
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const json = await res.json();
  return json.data ?? json;
}

const PLATFORM_LABELS: Record<string, string> = {
  flutter_mobile: 'Mobile (Flutter)',
  tauri_desktop: 'Desktop (Tauri)',
  server: 'Server',
  web: 'Web',
  cli: 'CLI',
};

const PROVIDER_ICONS: Record<string, string> = {
  on_device: 'On-Device',
  ollama: 'Ollama',
  litellm: 'LiteLLM',
  custom: 'Custom',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatContext(ctx: number): string {
  if (ctx >= 1000) return `${(ctx / 1000).toFixed(0)}K`;
  return String(ctx);
}

export default function SettingsModelsPage() {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [modules, setModules] = useState<ModuleInstall[]>([]);
  const [routing, setRouting] = useState<RoutingPolicy | null>(null);
  const [imageStats, setImageStats] = useState<PipelineStats | null>(null);
  const [scribeStats, setScribeStats] = useState<Record<string, unknown> | null>(null);
  const [actionStats, setActionStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [modelsRes, routingRes, imgStatsRes, scbStatsRes, actStatsRes] = await Promise.allSettled([
        apiFetch<ModelProfile[]>('/gemma4/models'),
        apiFetch<RoutingPolicy>('/gemma4/routing/policy'),
        apiFetch<PipelineStats>('/pipeline/image/stats'),
        apiFetch<Record<string, unknown>>('/pipeline/scribe/stats'),
        apiFetch<Record<string, unknown>>('/pipeline/actions/stats'),
      ]);
      if (modelsRes.status === 'fulfilled') setModels(Array.isArray(modelsRes.value) ? modelsRes.value : []);
      if (routingRes.status === 'fulfilled') setRouting(routingRes.value);
      if (imgStatsRes.status === 'fulfilled') setImageStats(imgStatsRes.value);
      if (scbStatsRes.status === 'fulfilled') setScribeStats(scbStatsRes.value);
      if (actStatsRes.status === 'fulfilled') setActionStats(actStatsRes.value);

      try {
        const modsRes = await apiFetch<ModuleInstall[]>('/gemma4/modules/installed');
        setModules(Array.isArray(modsRes) ? modsRes : []);
      } catch {
        setModules([]);
      }
    } catch {
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSeedDefaults = async () => {
    setSeedingDefaults(true);
    try {
      await apiFetch('/gemma4/models/seed', { method: 'POST' });
      toast.success('Default models seeded');
      await loadData();
    } catch {
      toast.error('Failed to seed defaults');
    } finally {
      setSeedingDefaults(false);
    }
  };

  const handleDeactivate = async (profileId: string) => {
    try {
      await apiFetch(`/gemma4/models/${profileId}`, { method: 'DELETE' });
      toast.success('Model deactivated');
      setModels((prev) => prev.map((m) => m.id === profileId ? { ...m, is_active: false } : m));
    } catch {
      toast.error('Failed to deactivate model');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-6 w-6 animate-spin text-[var(--fg-muted)]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-[var(--accent)]" />
            <div>
              <h1 className="text-xl font-semibold">Model Management</h1>
              <p className="text-sm text-[var(--fg-muted)]">
                Configure AI models, modules, and processing pipelines
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeedDefaults}
              disabled={seedingDefaults}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)] disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {seedingDefaults ? 'Seeding...' : 'Seed Defaults'}
            </button>
            <button
              type="button"
              onClick={loadData}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--bg-hover)]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Model Profiles */}
        <section>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Model Profiles ({models.length})
          </h2>
          {models.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] p-6 text-center text-sm text-[var(--fg-muted)]">
              No models configured. Click &quot;Seed Defaults&quot; to initialize.
            </div>
          ) : (
            <div className="space-y-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className={`rounded-lg border transition-colors ${
                    model.is_active
                      ? 'border-[var(--border)] bg-[var(--bg-card)]'
                      : 'border-[var(--border)] bg-[var(--bg-subtle)] opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${model.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="text-sm font-medium">{model.model_name}</div>
                        <div className="text-xs text-[var(--fg-muted)]">
                          {PLATFORM_LABELS[model.platform_type] || model.platform_type}
                          {' · '}
                          {PROVIDER_ICONS[model.provider] || model.provider}
                          {' · '}
                          {model.parameter_count}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.supports_vision && <Eye className="h-3.5 w-3.5 text-blue-400" title="Vision" />}
                      {model.supports_audio && <Mic className="h-3.5 w-3.5 text-amber-400" title="Audio" />}
                      {model.supports_function_calling && <Wrench className="h-3.5 w-3.5 text-purple-400" title="Function Calling" />}
                      {expandedModel === model.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>

                  {expandedModel === model.id && (
                    <div className="border-t border-[var(--border)] px-4 py-3 space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[var(--fg-muted)]">Model Key:</span>{' '}
                          <span className="font-mono">{model.model_key}</span>
                        </div>
                        <div>
                          <span className="text-[var(--fg-muted)]">Quantization:</span>{' '}
                          {model.quantization}
                        </div>
                        <div>
                          <span className="text-[var(--fg-muted)]">Context Window:</span>{' '}
                          {formatContext(model.context_window)} tokens
                        </div>
                        <div>
                          <span className="text-[var(--fg-muted)]">License:</span>{' '}
                          {model.license}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        {model.is_default && (
                          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-400 font-medium">
                            Default
                          </span>
                        )}
                        {model.is_active && !model.is_default && (
                          <button
                            type="button"
                            onClick={() => handleDeactivate(model.id)}
                            className="flex items-center gap-1 rounded border border-red-500/30 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-3 w-3" />
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Smart Routing */}
        {routing && (
          <section>
            <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Smart Routing Policy
            </h2>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-[var(--fg-muted)] text-xs mb-1">Local Threshold</div>
                <div className="font-medium">{routing.local_threshold}</div>
              </div>
              <div>
                <div className="text-[var(--fg-muted)] text-xs mb-1">Offline Mode</div>
                <div className="font-medium capitalize">{routing.offline_mode}</div>
              </div>
              <div>
                <div className="text-[var(--fg-muted)] text-xs mb-1">Max Cloud Tokens/Day</div>
                <div className="font-medium">{routing.max_cloud_tokens_per_day?.toLocaleString() || 'Unlimited'}</div>
              </div>
            </div>
          </section>
        )}

        {/* Installed Modules */}
        <section>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Installed Modules ({modules.length})
          </h2>
          {modules.length === 0 ? (
            <div className="rounded-lg border border-[var(--border)] p-4 text-center text-sm text-[var(--fg-muted)]">
              No modules installed yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3"
                >
                  <div className="text-sm font-medium">{mod.module_name || mod.module_id}</div>
                  <div className="text-xs text-[var(--fg-muted)] mt-1 space-x-2">
                    {mod.category && <span>{mod.category}</span>}
                    {mod.installed_version && <span>v{mod.installed_version}</span>}
                    {mod.disk_usage_bytes != null && <span>{formatBytes(mod.disk_usage_bytes)}</span>}
                  </div>
                  {mod.download_progress != null && mod.download_progress < 100 && (
                    <div className="mt-2 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${mod.download_progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pipeline Stats */}
        <section>
          <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Pipeline Statistics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Image Processing */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="text-xs text-[var(--fg-muted)] mb-2">Image Processing</div>
              {imageStats ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Total Jobs</span>
                    <span className="font-medium">{imageStats.total_jobs || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Local</span>
                    <span className="font-medium text-green-400">{imageStats.local_processed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server</span>
                    <span className="font-medium text-blue-400">{imageStats.server_processed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Speed</span>
                    <span className="font-medium">{imageStats.avg_processing_ms || 0}ms</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--fg-muted)]">No data</div>
              )}
            </div>

            {/* Audio Scribe */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="text-xs text-[var(--fg-muted)] mb-2">Audio Scribe</div>
              {scribeStats ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Sessions</span>
                    <span className="font-medium">{(scribeStats as any).total_sessions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Audio (sec)</span>
                    <span className="font-medium">{(scribeStats as any).total_audio_seconds || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Words</span>
                    <span className="font-medium">{(scribeStats as any).total_words || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence</span>
                    <span className="font-medium">{(scribeStats as any).avg_confidence || '—'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--fg-muted)]">No data</div>
              )}
            </div>

            {/* Device Actions */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
              <div className="text-xs text-[var(--fg-muted)] mb-2">Device Actions</div>
              {actionStats ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Executions</span>
                    <span className="font-medium">{(actionStats as any).total_executions || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed</span>
                    <span className="font-medium text-green-400">{(actionStats as any).completed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Devices</span>
                    <span className="font-medium">{(actionStats as any).unique_devices || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Speed</span>
                    <span className="font-medium">{(actionStats as any).avg_execution_ms || 0}ms</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--fg-muted)]">No data</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
