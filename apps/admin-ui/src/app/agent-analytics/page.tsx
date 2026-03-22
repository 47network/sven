'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useAgentAnalyticsSummary,
  useAgentAnalyticsAlerts,
  useSetAgentAnalyticsAlerts,
  useEvaluateAgentAnalyticsAlerts,
} from '@/lib/hooks';
import { api } from '@/lib/api';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, BellRing } from 'lucide-react';

type Range = '24h' | '7d' | '30d' | 'custom';

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function AgentAnalyticsPage() {
  const [range, setRange] = useState<Range>('7d');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const params = useMemo(
    () => (range === 'custom' ? { range, start, end } : { range }),
    [range, start, end],
  );

  const { data: summaryData, isLoading } = useAgentAnalyticsSummary(params);
  const { data: alertConfigData, isLoading: alertsLoading } = useAgentAnalyticsAlerts();
  const { data: alertEvalData, refetch: refetchEval, isFetching: evaluating } = useEvaluateAgentAnalyticsAlerts(params);
  const setAlerts = useSetAgentAnalyticsAlerts();

  const [localAlerts, setLocalAlerts] = useState({
    success_rate_below: 75,
    error_rate_above: 25,
    avg_response_ms_above: 9000,
    self_correction_below: 50,
    cost_usd_above: 25,
  });

  const rows = (summaryData?.data?.rows || []) as Array<Record<string, unknown>>;
  const windowLabel = summaryData?.data?.window?.label || range;
  const exportUrl = api.agentAnalytics.exportCsvUrl(params);
  const triggered = (alertEvalData?.data?.triggered || []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (!alertsLoading && alertConfigData?.data) {
      setLocalAlerts(alertConfigData.data);
    }
  }, [alertsLoading, alertConfigData]);

  async function saveAlerts() {
    try {
      await setAlerts.mutateAsync(localAlerts);
      toast.success('Alert thresholds saved');
      await refetchEval();
    } catch {
      toast.error('Failed to save alert thresholds');
    }
  }

  async function evaluateNow() {
    try {
      await refetchEval();
      toast.success('Alert evaluation refreshed');
    } catch {
      toast.error('Failed to evaluate alerts');
    }
  }

  if (isLoading) return <PageSpinner />;

  return (
    <>
      <PageHeader title="Agent Analytics" description="Agent performance, cost, reliability, and alert thresholds" />

      <div className="card mb-4 space-y-3 py-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <select className="input" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
            <option value="custom">custom</option>
          </select>
          <input
            className="input"
            type="datetime-local"
            value={start}
            disabled={range !== 'custom'}
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            className="input"
            type="datetime-local"
            value={end}
            disabled={range !== 'custom'}
            onChange={(e) => setEnd(e.target.value)}
          />
          <button className="btn-secondary" onClick={evaluateNow} disabled={evaluating}>
            <BellRing className="mr-1 inline h-4 w-4" />
            Evaluate Alerts
          </button>
          <a className="btn-primary inline-flex items-center justify-center" href={exportUrl}>
            <Download className="mr-1 h-4 w-4" />
            Export CSV ({windowLabel})
          </a>
        </div>
      </div>

      <div className="card mb-4 space-y-3 py-5">
        <h3 className="text-base font-semibold">Alert Thresholds</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            className="input"
            type="number"
            value={localAlerts.success_rate_below}
            onChange={(e) => setLocalAlerts((p) => ({ ...p, success_rate_below: toNumber(e.target.value) }))}
            placeholder="Success rate below %"
          />
          <input
            className="input"
            type="number"
            value={localAlerts.error_rate_above}
            onChange={(e) => setLocalAlerts((p) => ({ ...p, error_rate_above: toNumber(e.target.value) }))}
            placeholder="Error rate above %"
          />
          <input
            className="input"
            type="number"
            value={localAlerts.avg_response_ms_above}
            onChange={(e) => setLocalAlerts((p) => ({ ...p, avg_response_ms_above: toNumber(e.target.value) }))}
            placeholder="Avg response ms above"
          />
          <input
            className="input"
            type="number"
            value={localAlerts.self_correction_below}
            onChange={(e) => setLocalAlerts((p) => ({ ...p, self_correction_below: toNumber(e.target.value) }))}
            placeholder="Self-correction below %"
          />
          <input
            className="input"
            type="number"
            value={localAlerts.cost_usd_above}
            onChange={(e) => setLocalAlerts((p) => ({ ...p, cost_usd_above: toNumber(e.target.value) }))}
            placeholder="Cost above USD"
          />
        </div>
        <div>
          <button className="btn-primary" onClick={saveAlerts} disabled={setAlerts.isPending}>
            Save Alert Thresholds
          </button>
        </div>
      </div>

      <div className="card mb-4 py-5">
        <h3 className="mb-3 text-base font-semibold">Triggered Alerts ({triggered.length})</h3>
        {triggered.length === 0 ? (
          <p className="text-sm text-slate-500">No threshold alerts for the selected time window.</p>
        ) : (
          <div className="space-y-2">
            {triggered.map((item) => (
              <div key={String(item.agent_id)} className="rounded border border-slate-700 p-3">
                <p className="font-medium">{String(item.agent_name || item.agent_id)}</p>
                <p className="mt-1 text-xs text-slate-400">{Array.isArray(item.triggers) ? item.triggers.join(' | ') : ''}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-auto py-5">
        <h3 className="mb-3 text-base font-semibold">Per-Agent Metrics</h3>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-slate-400">
              <th className="px-2 py-2">Agent</th>
              <th className="px-2 py-2">Success %</th>
              <th className="px-2 py-2">Avg Response ms</th>
              <th className="px-2 py-2">Cost USD</th>
              <th className="px-2 py-2">Tokens</th>
              <th className="px-2 py-2">Error %</th>
              <th className="px-2 py-2">Self-Correct %</th>
              <th className="px-2 py-2">Avg Conv Length</th>
              <th className="px-2 py-2">Avg Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.agent_id)} className="border-b border-slate-800">
                <td className="px-2 py-2">{String(row.agent_name || row.agent_id)}</td>
                <td className="px-2 py-2">{toNumber(row.task_success_rate_pct).toFixed(2)}</td>
                <td className="px-2 py-2">{toNumber(row.avg_response_ms).toFixed(2)}</td>
                <td className="px-2 py-2">{toNumber(row.total_cost_usd).toFixed(6)}</td>
                <td className="px-2 py-2">{Math.round(toNumber(row.total_tokens))}</td>
                <td className="px-2 py-2">{toNumber(row.error_rate_pct).toFixed(2)}</td>
                <td className="px-2 py-2">{toNumber(row.self_correction_success_rate_pct).toFixed(2)}</td>
                <td className="px-2 py-2">{toNumber(row.avg_conversation_length).toFixed(2)}</td>
                <td className="px-2 py-2">{toNumber(row.avg_follow_up_count).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
