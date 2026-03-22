'use client';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { PageSpinner } from '@/components/Spinner';
import {
  useBackups,
  useBackupConfigs,
  useBackupStatus,
  useRestoreJobs,
  useStartBackup,
  useStartRestore,
  useUpdateBackupConfig,
  useUploadBackup,
  useVerifyBackup,
} from '@/lib/hooks';
import { HardDrive, Download, Upload, Play, Clock, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type BackupRow = {
  id: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  totalSizeBytes?: number;
  backupLocation?: string;
};

type BackupConfig = {
  id: string;
  schedule_cron?: string;
  enabled?: boolean;
  retention_days?: number | null;
  storage_path?: string | null;
};

type ScheduleState = {
  mode: 'daily' | 'weekly';
  time: string;
  weekday: string;
};

function unwrapData<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const nested = record.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as T;
  }
  return record as T;
}

function toRows(value: unknown): BackupRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      status: String(item.status ?? 'unknown'),
      startedAt: typeof item.startedAt === 'string' ? item.startedAt : undefined,
      completedAt: typeof item.completedAt === 'string' ? item.completedAt : undefined,
      totalSizeBytes:
        typeof item.totalSizeBytes === 'number'
          ? item.totalSizeBytes
          : typeof item.totalSizeBytes === 'string'
            ? Number(item.totalSizeBytes)
            : undefined,
      backupLocation: typeof item.backupLocation === 'string' ? item.backupLocation : undefined,
    }));
}

function parseCron(expr?: string | null): ScheduleState {
  if (!expr) return { mode: 'daily', time: '02:00', weekday: '1' };
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { mode: 'daily', time: '02:00', weekday: '1' };
  const [min, hour, , , dow] = parts;
  const time = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  if (dow !== '*') {
    return { mode: 'weekly', time, weekday: String(dow) };
  }
  return { mode: 'daily', time, weekday: '1' };
}

function buildCron(state: ScheduleState): string {
  const [hour, minute] = state.time.split(':');
  if (state.mode === 'weekly') {
    return `${Number(minute)} ${Number(hour)} * * ${state.weekday}`;
  }
  return `${Number(minute)} ${Number(hour)} * * *`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[idx]}`;
}

export default function BackupRestorePage() {
  const { data: statusData, isLoading: statusLoading } = useBackupStatus();
  const { data: backupsData, isLoading: backupsLoading } = useBackups(50);
  const { data: configsData, isLoading: configsLoading } = useBackupConfigs();
  const { data: restoresData } = useRestoreJobs(50);
  const startBackup = useStartBackup();
  const verifyBackup = useVerifyBackup();
  const startRestore = useStartRestore();
  const updateConfig = useUpdateBackupConfig();
  const uploadBackup = useUploadBackup();

  const configsPayload = unwrapData<{ configs?: BackupConfig[] }>(configsData);
  const backupsPayload = unwrapData<{ backups?: unknown[] }>(backupsData);
  const statusPayload = unwrapData<{ metrics?: Record<string, unknown> }>(statusData);
  const restoresPayload = unwrapData<{ restores?: Array<Record<string, unknown>> }>(restoresData);

  const configs = Array.isArray(configsPayload?.configs)
    ? configsPayload.configs
    : [];
  const primaryConfig = configs.find((c) => c.id === 'default-daily-backup') || configs[0];
  const [activeConfigId, setActiveConfigId] = useState(primaryConfig?.id || '');
  const activeConfig = configs.find((c) => c.id === activeConfigId) || primaryConfig;
  const [schedule, setSchedule] = useState<ScheduleState>(() => parseCron(activeConfig?.schedule_cron));

  useEffect(() => {
    if (!activeConfigId && primaryConfig?.id) {
      setActiveConfigId(primaryConfig.id);
    }
  }, [activeConfigId, primaryConfig?.id]);

  useEffect(() => {
    setSchedule(parseCron(activeConfig?.schedule_cron));
  }, [activeConfig?.schedule_cron]);

  const snapshots = useMemo(() => toRows(backupsPayload?.backups), [backupsPayload?.backups]);
  const restoreRows = Array.isArray(restoresPayload?.restores)
    ? restoresPayload.restores
    : [];
  const lastRestore = restoreRows[0];
  const lastBackupIso = snapshots[0]?.completedAt || snapshots[0]?.startedAt;
  const backupHealth = String(statusPayload?.metrics?.healthStatus || 'unknown');

  function handleCreate() {
    if (!activeConfigId.trim()) {
      toast.error('Select a backup configuration');
      return;
    }
    startBackup.mutate(
      { configId: activeConfigId.trim() },
      {
        onSuccess: () => toast.success('Backup job started'),
        onError: () => toast.error('Backup start failed'),
      },
    );
  }

  function handleVerify(backupId: string) {
    verifyBackup.mutate(
      { backupId },
      {
        onSuccess: (res) => {
          if (res.verified) toast.success('Backup verified');
          else toast.error('Verification failed');
        },
        onError: () => toast.error('Verification failed'),
      },
    );
  }

  function handleRestore(backupId: string) {
    const confirm = window.prompt('Type RESTORE to confirm destructive restore.');
    if (confirm !== 'RESTORE') {
      toast.error('Restore cancelled');
      return;
    }
    startRestore.mutate(
      {
        backupJobId: backupId,
        targetEnvironment: 'production',
        reason: 'manual restore from admin ui',
      },
      {
        onSuccess: () => toast.success('Restore started'),
        onError: () => toast.error('Restore failed to start'),
      },
    );
  }

  async function handleDownload(backupId: string) {
    try {
      const res = await fetch(`/v1/admin/backup/${encodeURIComponent(backupId)}/download`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!res.ok) {
        toast.error('Download failed');
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match ? match[1] : `backup-${backupId}.tar.gz`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = String(reader.result || '');
      const base64 = content.split(',').pop() || '';
      uploadBackup.mutate(
        { fileName: file.name, contentBase64: base64 },
        {
          onSuccess: () => toast.success('Backup uploaded'),
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Upload failed'),
        },
      );
    };
    reader.readAsDataURL(file);
  }

  function handleScheduleSave() {
    if (!activeConfigId) return;
    const cron = buildCron(schedule);
    updateConfig.mutate(
      { configId: activeConfigId, data: { scheduleCron: cron, enabled: true } },
      {
        onSuccess: () => toast.success('Schedule updated'),
        onError: () => toast.error('Failed to update schedule'),
      },
    );
  }

  if (statusLoading || backupsLoading || configsLoading) return <PageSpinner />;

  return (
    <>
      <PageHeader title="Backup & Restore" description="One-click backups, restores, and schedules">
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-56"
            value={activeConfigId}
            onChange={(e) => setActiveConfigId(e.target.value)}
          >
            {configs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.id}
              </option>
            ))}
          </select>
          <button onClick={handleCreate} className="btn-primary flex items-center gap-1" disabled={startBackup.isPending}>
            <Download className="h-4 w-4" /> {startBackup.isPending ? 'Starting…' : 'Backup Now'}
          </button>
        </div>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Backups</p>
              <p className="text-xl font-semibold">{snapshots.length}</p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Last Backup</p>
              <p className="text-xl font-semibold">
                {lastBackupIso
                  ? new Date(lastBackupIso).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
        <div className="card py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Last Restore</p>
              <p className="text-xl font-semibold">
                {lastRestore?.status ? String(lastRestore.status) : '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">{backupHealth}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-4">
          <h3 className="text-sm font-semibold">Auto-backup Schedule</h3>
          <p className="text-xs text-slate-500">Daily or weekly backups with a time selector.</p>
          <div className="mt-4 space-y-3">
            <select
              className="input w-full"
              value={schedule.mode}
              onChange={(e) =>
                setSchedule((prev) => ({ ...prev, mode: e.target.value as ScheduleState['mode'] }))
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            {schedule.mode === 'weekly' && (
              <select
                className="input w-full"
                value={schedule.weekday}
                onChange={(e) => setSchedule((prev) => ({ ...prev, weekday: e.target.value }))}
              >
                <option value="0">Sunday</option>
                <option value="1">Monday</option>
                <option value="2">Tuesday</option>
                <option value="3">Wednesday</option>
                <option value="4">Thursday</option>
                <option value="5">Friday</option>
                <option value="6">Saturday</option>
              </select>
            )}
            <input
              className="input w-full"
              type="time"
              value={schedule.time}
              onChange={(e) => setSchedule((prev) => ({ ...prev, time: e.target.value }))}
            />
            <button className="btn-secondary w-full" onClick={handleScheduleSave} disabled={updateConfig.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {updateConfig.isPending ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold">Upload Backup</h3>
          <p className="text-xs text-slate-500">Upload a backup archive for restore.</p>
          <div className="mt-4 space-y-3">
            <input
              type="file"
              className="w-full text-sm"
              accept=".tar.gz"
              onChange={(e) => handleUpload(e.target.files?.[0] || null)}
              disabled={uploadBackup.isPending}
            />
            <p className="text-xs text-slate-500">
              Uploads are validated before restore.
            </p>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold">Retention</h3>
          <p className="text-xs text-slate-500">Current retention policy.</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Retention Days</span>
              <span>{activeConfig?.retention_days ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Storage Path</span>
              <span className="max-w-[180px] truncate text-right">{activeConfig?.storage_path ?? '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No backups"
          description="Start your first backup job to enable restore workflows."
          action={
            <button onClick={handleCreate} className="btn-primary btn-sm flex items-center gap-1">
              <Download className="h-3.5 w-3.5" /> Backup Now
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Backup ID</th>
                <th className="px-4 py-3 text-left font-medium">Size</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {snapshots.map((snap) => (
                <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium">{snap.id.slice(0, 12)}</td>
                  <td className="px-4 py-3 text-slate-500">{formatBytes(snap.totalSizeBytes)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {snap.completedAt || snap.startedAt
                      ? new Date(snap.completedAt || snap.startedAt || '').toLocaleString()
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={snap.status === 'completed' || snap.status === 'verified' ? 'badge-success' : 'badge-warning'}>
                      {snap.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => handleDownload(snap.id)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-secondary btn-sm"
                        onClick={() => handleVerify(snap.id)}
                        disabled={verifyBackup.isPending}
                      >
                        Verify
                      </button>
                      <button
                        className="btn-secondary btn-sm flex items-center gap-1"
                        onClick={() => handleRestore(snap.id)}
                        disabled={startRestore.isPending}
                      >
                        <Upload className="h-3.5 w-3.5" /> Restore
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
