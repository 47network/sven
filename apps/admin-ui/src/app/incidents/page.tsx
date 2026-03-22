'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useIncidentsStatus,
  useKillSwitch,
  useLockdown,
  useForensics,
  useExecuteEscalationRules,
  useEmergencyNotify,
} from '@/lib/hooks';
import { AlertTriangle, ShieldOff, Lock, FileSearch, Power, Siren, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useState } from 'react';

type IncidentEvent = {
  type?: string;
  action?: string;
  user?: string;
  timestamp?: string;
};

export default function IncidentsPage() {
  const { data, isLoading } = useIncidentsStatus();
  const killSwitch = useKillSwitch();
  const lockdown = useLockdown();
  const forensics = useForensics();
  const executeEscalationRules = useExecuteEscalationRules();
  const emergencyNotify = useEmergencyNotify();
  const [emergencyTitle, setEmergencyTitle] = useState('Emergency Incident Notification');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [emergencyRecipients, setEmergencyRecipients] = useState('');

  if (isLoading) return <PageSpinner />;

  const response = (data ?? {}) as Record<string, unknown>;
  const statusPayload =
    response.data && typeof response.data === 'object'
      ? (response.data as Record<string, unknown>)
      : response;
  const isKillSwitchOn = Boolean(statusPayload.killSwitchActive);
  const isLockdownOn = Boolean(statusPayload.lockdownActive);
  const isForensicsOn = Boolean(statusPayload.forensicsActive);
  const recentEvents: IncidentEvent[] = Array.isArray(statusPayload.recent_events)
    ? (statusPayload.recent_events as IncidentEvent[])
    : [];

  function handleKillSwitch() {
    const next = !isKillSwitchOn;
    if (next && !confirm('DANGER: This will shut down all AI processing. Continue?')) return;
    killSwitch.mutate(next, {
      onSuccess: () => toast.success(`Kill switch ${next ? 'activated' : 'deactivated'}`),
      onError: () => toast.error('Kill switch toggle failed'),
    });
  }

  function handleLockdown() {
    const next = !isLockdownOn;
    if (next && !confirm('WARNING: Lockdown blocks all non-admin operations. Continue?')) return;
    lockdown.mutate(next, {
      onSuccess: () => toast.success(`Lockdown ${next ? 'engaged' : 'lifted'}`),
      onError: () => toast.error('Lockdown toggle failed'),
    });
  }

  function handleForensics() {
    const next = !isForensicsOn;
    if (next && !confirm('Forensics mode increases detailed logging. Continue?')) return;
    forensics.mutate(next, {
      onSuccess: () => toast.success(`Forensics ${next ? 'enabled' : 'disabled'}`),
      onError: () => toast.error('Forensics toggle failed'),
    });
  }

  function handleExecuteEscalationRules() {
    executeEscalationRules.mutate(undefined, {
      onSuccess: (result) => {
        const data =
          result && typeof result === 'object' && 'data' in result && result.data && typeof result.data === 'object'
            ? (result.data as Record<string, unknown>)
            : {};
        const rules = Number(data.rulesExecuted ?? 0);
        const escalations = Number(data.escalationsTriggered ?? 0);
        toast.success(`Escalation scan complete: rules=${rules}, escalations=${escalations}`);
      },
      onError: () => toast.error('Failed to execute escalation rules'),
    });
  }

  function handleEmergencyNotify() {
    const message = emergencyMessage.trim();
    const recipients = emergencyRecipients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!message || recipients.length === 0) {
      toast.error('Recipients and message are required');
      return;
    }

    emergencyNotify.mutate(
      {
        channel: 'ops',
        recipients,
        title: emergencyTitle.trim() || 'Emergency Incident Notification',
        message,
        severity: 'critical',
      },
      {
        onSuccess: () => {
          toast.success('Emergency notification queued');
          setEmergencyMessage('');
        },
        onError: () => toast.error('Emergency notification failed'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Incidents" description="Kill switch, lockdown mode, and forensic tools" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-300">
                <Siren className="h-3 w-3" />
                Incident Command
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Emergency Operations</h2>
              <p className="mt-1 text-sm text-slate-400">
                Use kill switch and lockdown only for verified incidents. Every action is auditable.
              </p>
            </div>
            <span className={isKillSwitchOn || isLockdownOn ? 'badge-danger' : 'badge-success'}>
              {isKillSwitchOn || isLockdownOn ? 'degraded mode' : 'normal mode'}
            </span>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Related Ops</h3>
          <div className="mt-3 space-y-2">
            <Link href="/approvals" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Approval Queue</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/trace-view" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Trace View</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
            <Link href="/audit-verifier" className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm hover:border-cyan-400/60 hover:bg-slate-900/70">
              <span>Audit Verifier</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {(isKillSwitchOn || isLockdownOn) && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          {isKillSwitchOn && 'Kill switch is ACTIVE — all AI processing stopped. '}
          {isLockdownOn && 'Lockdown mode — non-admin operations blocked.'}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Kill Switch */}
        <div className="card py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isKillSwitchOn
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}>
              <ShieldOff className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Kill Switch</p>
              <p className="text-xs text-slate-500">Stops all AI processing immediately</p>
            </div>
          </div>
          <button
            onClick={handleKillSwitch}
            disabled={killSwitch.isPending}
            className={`w-full flex items-center justify-center gap-2 ${
              isKillSwitchOn ? 'btn-primary' : 'btn-danger'
            }`}
          >
            <Power className="h-4 w-4" />
            {isKillSwitchOn ? 'Deactivate' : 'Activate Kill Switch'}
          </button>
        </div>

        {/* Lockdown */}
        <div className="card py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              isLockdownOn
                ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}>
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Lockdown Mode</p>
              <p className="text-xs text-slate-500">Blocks non-admin operations</p>
            </div>
          </div>
          <button
            onClick={handleLockdown}
            disabled={lockdown.isPending}
            className={`w-full flex items-center justify-center gap-2 ${
              isLockdownOn ? 'btn-primary' : 'btn-danger'
            }`}
          >
            <Lock className="h-4 w-4" />
            {isLockdownOn ? 'Lift Lockdown' : 'Engage Lockdown'}
          </button>
        </div>

        {/* Forensics */}
        <div className="card py-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Forensic Mode</p>
              <p className="text-xs text-slate-500">Enhanced logging for investigation</p>
            </div>
          </div>
          <div className="space-y-2">
            <span className={isForensicsOn ? 'badge-info' : 'badge-neutral'}>
              {isForensicsOn ? 'recording' : 'off'}
            </span>
            <p className="text-xs text-slate-500">
              {isForensicsOn
                ? 'All operations logged in detail for post-incident analysis.'
                : 'Enable to capture detailed traces for investigation.'}
            </p>
            <button
              onClick={handleForensics}
              disabled={forensics.isPending}
              className={`w-full flex items-center justify-center gap-2 ${
                isForensicsOn ? 'btn-primary' : 'btn-danger'
              }`}
            >
              <FileSearch className="h-4 w-4" />
              {isForensicsOn ? 'Disable Forensics' : 'Enable Forensics'}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Escalation Engine</h3>
          <p className="mt-2 text-sm text-slate-500">
            Run escalation rules immediately to process overdue approvals/incidents outside scheduled intervals.
          </p>
          <button
            onClick={handleExecuteEscalationRules}
            disabled={executeEscalationRules.isPending}
            className="mt-4 btn-primary w-full"
          >
            Execute Escalation Rules
          </button>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Emergency Notify</h3>
          <p className="mt-2 text-sm text-slate-500">
            Send urgent broadcast to emergency contacts (comma-separated recipients).
          </p>
          <label className="mt-3 block text-xs font-medium text-slate-500">Recipients</label>
          <input
            value={emergencyRecipients}
            onChange={(e) => setEmergencyRecipients(e.target.value)}
            placeholder="oncall@company.com, secops@company.com"
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <label className="mt-3 block text-xs font-medium text-slate-500">Title</label>
          <input
            value={emergencyTitle}
            onChange={(e) => setEmergencyTitle(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <label className="mt-3 block text-xs font-medium text-slate-500">Message</label>
          <textarea
            value={emergencyMessage}
            onChange={(e) => setEmergencyMessage(e.target.value)}
            rows={4}
            placeholder="Describe the incident impact and immediate actions."
            className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            onClick={handleEmergencyNotify}
            disabled={emergencyNotify.isPending}
            className="mt-3 btn-danger w-full"
          >
            Send Emergency Notification
          </button>
        </div>
      </div>

      {/* Recent events */}
      {recentEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Recent Incident Events</h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Event</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                  <th className="px-4 py-3 text-left font-medium">By</th>
                  <th className="px-4 py-3 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentEvents.map((evt, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-medium">{evt.type ?? 'event'}</td>
                    <td className="px-4 py-3">{evt.action ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{evt.user ?? 'system'}</td>
                    <td className="px-4 py-3 text-slate-500">{evt.timestamp ? new Date(evt.timestamp).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
