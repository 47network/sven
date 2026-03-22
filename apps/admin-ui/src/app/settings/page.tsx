'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useSettings, useSetSetting, useSyncEdgeAdmin47Access, useEdgeAdmin47Access, useTunnelStatus } from '@/lib/hooks';
import { Save, Sparkles, ArrowUpRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

type SettingValue = string | number | boolean | string[] | Record<string, unknown> | null;

interface SettingRow {
  key: string;
  value: SettingValue;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'toggle';
  category: string;
}

const SETTING_DEFS: Omit<SettingRow, 'value'>[] = [
  { key: 'identity.name', label: 'Assistant Name', type: 'text', category: 'Identity' },
  { key: 'identity.persona', label: 'Persona Document', type: 'textarea', category: 'Identity' },
  { key: 'identity.buddy_name', label: 'Buddy Name', type: 'text', category: 'Identity' },
  { key: 'performance.max_concurrent_runs', label: 'Max Concurrent Tool Runs', type: 'number', category: 'Performance' },
  { key: 'performance.tool_timeout_ms', label: 'Tool Timeout (ms)', type: 'number', category: 'Performance' },
  { key: 'performance.max_tokens', label: 'Max Response Tokens', type: 'number', category: 'Performance' },
  { key: 'chat.think.default', label: 'Default Thinking Level (off|low|medium|high)', type: 'text', category: 'LLM' },
  { key: 'streaming.chunkSize', label: 'Streaming Chunk Size', type: 'number', category: 'LLM' },
  { key: 'streaming.humanDelay', label: 'Streaming Human Delay (ms/char)', type: 'number', category: 'LLM' },
  { key: 'streaming.coalesce', label: 'Streaming Coalesce', type: 'toggle', category: 'LLM' },
  { key: 'logging.redactSensitive', label: 'Log Redaction Enabled', type: 'toggle', category: 'Security' },
  { key: 'logging.redactPatterns', label: 'Log Redaction Patterns (regex array/CSV)', type: 'textarea', category: 'Security' },
  { key: 'chat.actionButtons.enabled', label: 'Chat Action Buttons Enabled', type: 'toggle', category: 'Chat' },
  { key: 'memory.consolidation.enabled', label: 'Memory Consolidation Enabled', type: 'toggle', category: 'Memory' },
  { key: 'memory.consolidation.threshold', label: 'Memory Consolidation Threshold (0.0-1.0)', type: 'number', category: 'Memory' },
  { key: 'memory.indexSessions.enabled', label: 'Index Session Transcripts (Compaction)', type: 'toggle', category: 'Memory' },
  { key: 'memory.delayedRecall.enabled', label: 'Delayed Memory Recall Enabled', type: 'toggle', category: 'Memory' },
  { key: 'memory.delayedRecall.everyNTurns', label: 'Delayed Recall Frequency (every N user turns)', type: 'number', category: 'Memory' },
  { key: 'memory.temporalDecay.curve', label: 'Memory Decay Curve (exponential|linear|step)', type: 'text', category: 'Memory' },
  { key: 'memory.temporalDecay.stepDays', label: 'Memory Decay Step Days (for step curve)', type: 'number', category: 'Memory' },
  { key: 'projectContext.fileTree.enabled', label: 'Project Tree Injection Enabled', type: 'toggle', category: 'Project Context' },
  { key: 'projectContext.fileTree.maxDepth', label: 'Project Tree Max Depth', type: 'number', category: 'Project Context' },
  { key: 'projectContext.fileTree.maxFilesPerDir', label: 'Project Tree Max Files Per Directory', type: 'number', category: 'Project Context' },
  { key: 'projectContext.fileTree.excludePatterns', label: 'Project Tree Exclude Patterns (array/CSV)', type: 'textarea', category: 'Project Context' },
  { key: 'projectContext.fileTree.debounceMs', label: 'Project Tree Refresh Debounce (ms)', type: 'number', category: 'Project Context' },
  { key: 'agent.subordinate.maxNestingDepth', label: 'Subagent Max Nesting Depth', type: 'number', category: 'Chat' },
  { key: 'agent.research.enabled', label: 'Deep Research Mode Enabled', type: 'toggle', category: 'Chat' },
  { key: 'agent.research.maxSteps', label: 'Deep Research Max Steps', type: 'number', category: 'Chat' },
  { key: 'webFetch.firecrawlEnabled', label: 'Web Fetch Firecrawl Fallback Enabled', type: 'toggle', category: 'Web' },
  { key: 'webFetch.firecrawlApiUrl', label: 'Web Fetch Firecrawl API URL', type: 'text', category: 'Web' },
  { key: 'souls.require_signature', label: 'Require Signed SOULs', type: 'toggle', category: 'SOUL Security' },
  { key: 'souls.trusted_key_fingerprints', label: 'Trusted SOUL Key Fingerprints (comma-separated)', type: 'textarea', category: 'SOUL Security' },
  { key: 'buddy.enabled', label: 'Buddy System Enabled', type: 'toggle', category: 'Buddy System' },
  { key: 'buddy.partner_url', label: 'Buddy Partner URL', type: 'text', category: 'Buddy System' },
  { key: 'edge.admin47.ip_lock_enabled', label: 'Lock /admin47 to Allowlisted IPs', type: 'toggle', category: 'Edge Security' },
  { key: 'edge.admin47.allowed_ips', label: 'Admin Allowlisted IPs/CIDRs (comma-separated)', type: 'textarea', category: 'Edge Security' },
  { key: 'ui.futuristic_mode_enabled', label: 'Futuristic UI Theme Enabled', type: 'toggle', category: 'Experience' },
  { key: 'ui.animations_enabled', label: 'UI Animations Enabled', type: 'toggle', category: 'Experience' },
];

export default function SettingsPage() {
  const { data, isLoading } = useSettings();
  const edgeAccess = useEdgeAdmin47Access();
  const tunnelStatus = useTunnelStatus();
  const setSetting = useSetSetting();
  const syncEdgeAccess = useSyncEdgeAdmin47Access();
  const [values, setValues] = useState<Record<string, SettingValue>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [edgeSyncReason, setEdgeSyncReason] = useState('');

  useEffect(() => {
    if (data?.rows) {
      const map: Record<string, SettingValue> = {};
      for (const row of data.rows) {
        const key = typeof row.key === 'string' ? row.key : '';
        if (!key) continue;
        map[key] = (row.value as SettingValue) ?? null;
      }
      setValues(map);
    }
  }, [data]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pending = window.localStorage.getItem('sven-trust-fingerprint');
    if (!pending) return;
    window.localStorage.removeItem('sven-trust-fingerprint');
    const key = 'souls.trusted_key_fingerprints';
    const existingRaw = values[key];
    const existingList = normalizeFingerprintList(existingRaw);
    if (!existingList.includes(pending)) {
      const nextValue = [...existingList, pending].join(', ');
      setValues((prev) => ({ ...prev, [key]: nextValue }));
      setDirty((prev) => new Set([...prev, key]));
      toast.success('Fingerprint added to trusted list. Saving...');
      setSetting.mutate(
        { key, value: nextValue },
        {
          onSuccess: () => {
            toast.success('Trusted fingerprints saved');
            setDirty((prev) => {
              const next = new Set(prev);
              next.delete(key);
              return next;
            });
          },
          onError: () => toast.error('Failed to save trusted fingerprints'),
        },
      );
    }
  }, [values]);

  function handleChange(key: string, value: SettingValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty((prev) => new Set([...prev, key]));
  }

  async function handleSave(key: string) {
    try {
      await setSetting.mutateAsync({ key, value: values[key] });
      toast.success(`${key} saved`);
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } catch {
      toast.error(`Failed to save ${key}`);
    }
  }

  async function handleSaveAll() {
    const keys = Array.from(dirty);
    for (const key of keys) {
      // Sequential writes avoid stale/racing update states in the UI.
      await handleSave(key);
    }
  }

  async function handleApplyEdgePolicy(reload: boolean) {
    const reason = edgeSyncReason.trim();
    if (reason.length < 8) {
      toast.error('Edge sync reason must be at least 8 characters');
      return;
    }
    const edgeKeys = ['edge.admin47.ip_lock_enabled', 'edge.admin47.allowed_ips'];
    const keysToSave = edgeKeys.filter((k) => dirty.has(k));
    for (const key of keysToSave) {
      await handleSave(key);
    }
    try {
      const res = await syncEdgeAccess.mutateAsync({ reload, reason });
      const includeDetected = res?.data?.include_hook_detected !== false;
      if (!includeDetected) {
        toast.error('Edge policy synced, but nginx include hook was not detected in active config');
        return;
      }
      toast.success(reload ? 'Edge policy synced and nginx reloaded' : 'Edge policy synced (reload skipped)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sync edge admin access policy';
      toast.error(msg);
    }
  }

  if (isLoading) return <PageSpinner />;

  const categories = [...new Set(SETTING_DEFS.map((s) => s.category))];
  const totalSettings = SETTING_DEFS.length;

  return (
    <>
      <PageHeader title="Settings" description="Identity docs, performance tuning, buddy system">
        <div className="flex items-center gap-2">
          <input
            value={edgeSyncReason}
            onChange={(e) => setEdgeSyncReason(e.target.value)}
            placeholder="Edge sync reason (required)"
            className="input w-72"
          />
          {dirty.size > 0 && (
            <button onClick={handleSaveAll} className="btn-primary flex items-center gap-1">
              <Save className="h-4 w-4" /> Save All ({dirty.size})
            </button>
          )}
          <button
            onClick={() => void handleApplyEdgePolicy(true)}
            disabled={syncEdgeAccess.isPending || setSetting.isPending}
            className="btn-secondary flex items-center gap-1"
          >
            Sync Edge Policy + Reload
          </button>
          <button
            onClick={() => void handleApplyEdgePolicy(false)}
            disabled={syncEdgeAccess.isPending || setSetting.isPending}
            className="btn-secondary flex items-center gap-1"
          >
            Sync Only (No Reload)
          </button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Control Plane
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Runtime Configuration</h2>
              <p className="mt-1 text-sm text-slate-400">
                Tune identity, performance, SOUL trust, and buddy settings with auditable writes.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Note: Edge Security IP allowlist settings must be synced to nginx include files on the edge host.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Categories</p>
              <p className="text-lg font-semibold text-cyan-300">{categories.length}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Settings</p>
              <p className="text-lg font-semibold text-emerald-300">{totalSettings}</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Unsaved</p>
              <p className="text-lg font-semibold text-amber-300">{dirty.size}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Ops Links</h3>
          <div className="mt-3 space-y-2">
            <Link href="/secrets" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Secrets</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/souls" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>SOULs</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/policy-simulator" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Policy Sim</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="card mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Dev Tunnel</h3>
        <p className="mt-2 text-xs text-slate-500">
          Cloudflare quick tunnel URL + QR for fast mobile access.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Status</p>
            <p className="text-sm font-semibold text-cyan-300">
              {tunnelStatus.data?.data?.enabled ? 'Active' : 'Not detected'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Provider</p>
            <p className="text-sm font-semibold text-emerald-300">
              {tunnelStatus.data?.data?.provider || 'cloudflare'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Source</p>
            <p className="text-sm font-semibold text-amber-300">
              {tunnelStatus.data?.data?.source || 'none'}
            </p>
          </div>
        </div>
        {tunnelStatus.data?.data?.public_url && (
          <p className="mt-3 break-all text-sm text-slate-300">{tunnelStatus.data.data.public_url}</p>
        )}
        {tunnelStatus.data?.data?.qr_image_url && (
          <div className="mt-3 inline-flex rounded-lg border border-slate-700 bg-white p-2">
            <img
              src={tunnelStatus.data.data.qr_image_url}
              alt="Tunnel QR code"
              className="h-44 w-44"
            />
          </div>
        )}
      </div>

      <div className="card mb-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Admin47 Edge Access</h3>
        <p className="mt-2 text-xs text-slate-500">
          Source of truth is settings keys `edge.admin47.ip_lock_enabled` and `edge.admin47.allowed_ips`.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Current Lock</p>
            <p className="text-sm font-semibold text-cyan-300">
              {edgeAccess.data?.data?.enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Allow Entries</p>
            <p className="text-sm font-semibold text-emerald-300">
              {(edgeAccess.data?.data?.allowed_ips || []).length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Validation</p>
            <p className="text-sm font-semibold text-amber-300">
              {countInvalidEntries(values['edge.admin47.allowed_ips']) > 0
                ? `${countInvalidEntries(values['edge.admin47.allowed_ips'])} invalid`
                : 'Valid format'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {categories.map((cat) => (
          <div key={cat}>
            <h2 className="mb-4 text-lg font-semibold">{cat}</h2>
            <div className="card space-y-5">
              {SETTING_DEFS.filter((s) => s.category === cat).map((def) => (
                <div key={def.key} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-6">
                  <label className="w-48 shrink-0 pt-2 text-sm font-medium">{def.label}</label>
                  <div className="flex flex-1 items-start gap-2">
                    {def.type === 'text' && (
                      <input
                        className="input flex-1"
                        value={toTextInputValue(values[def.key])}
                        onChange={(e) => handleChange(def.key, e.target.value)}
                      />
                    )}
                    {def.type === 'number' && (
                      <input
                        type="number"
                        className="input w-40"
                        value={toNumberInputValue(values[def.key])}
                        onChange={(e) => handleChange(def.key, Number(e.target.value))}
                      />
                    )}
                    {def.type === 'textarea' && (
                      <textarea
                        className="input flex-1 min-h-[80px]"
                        value={toTextInputValue(values[def.key])}
                        onChange={(e) => handleChange(def.key, e.target.value)}
                      />
                    )}
                    {def.type === 'toggle' && (
                      <button
                        onClick={() => handleChange(def.key, !toBoolean(values[def.key]))}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          toBoolean(values[def.key]) ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            toBoolean(values[def.key]) ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}
                    {def.key === 'edge.admin47.allowed_ips' && countInvalidEntries(values[def.key]) > 0 && (
                      <p className="pt-2 text-xs text-rose-400">
                        Contains invalid entries. Use IPv4/IPv6 and optional CIDR, comma or newline separated.
                      </p>
                    )}
                    {dirty.has(def.key) && (
                      <button
                        onClick={() => void handleSave(def.key)}
                        disabled={setSetting.isPending}
                        className="btn-primary btn-sm"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function normalizeFingerprintList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

function toTextInputValue(value: SettingValue): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
}

function toNumberInputValue(value: SettingValue): number | '' {
  return typeof value === 'number' ? value : '';
}

function toBoolean(value: SettingValue): boolean {
  return value === true;
}

function countInvalidEntries(value: SettingValue): number {
  const raw = String(value || '');
  if (!raw.trim()) return 0;
  const entries = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const isValid = (candidate: string) => /^[0-9A-Fa-f:./]+$/.test(candidate) &&
    !candidate.includes('..') &&
    !candidate.includes('//') &&
    !candidate.startsWith('/') &&
    !candidate.endsWith('/');
  return entries.filter((e) => !isValid(e)).length;
}
