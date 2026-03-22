'use client';

import { PageHeader } from '@/components/PageHeader';
import { api } from '@/lib/api';
import { Link2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface VerificationResult {
  status: 'pass' | 'fail' | 'pending';
  chain_length: number;
  file_change_events: number;
  gaps: string[];
  tampered: string[];
  checked_at: string;
}

export default function AuditVerifierPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  async function handleVerify() {
    setRunning(true);
    try {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const res = await api.toolRuns.auditExport({ from, to: now.toISOString() });
      const rows = Array.isArray(res.data) ? res.data : [];
      const gaps: string[] = [];
      const tampered: string[] = [];

      const ids = new Set<string>();
      let prevTs = 0;
      let prevHash = '';
      let fileChangeEvents = 0;
      for (const row of rows) {
        const id = String(row.id ?? '');
        const createdAt = String(row.created_at ?? '');
        const parsedTs = Date.parse(createdAt);
        const rowPrevHash = String(row.prev_hash ?? '');
        const rowEntryHash = String(row.entry_hash ?? '');
        const fileChanges = Array.isArray(row.file_changes) ? row.file_changes : [];

        if (!id) {
          gaps.push('Record missing id');
        } else if (ids.has(id)) {
          tampered.push(`Duplicate id detected: ${id}`);
        } else {
          ids.add(id);
        }

        if (!Number.isFinite(parsedTs)) {
          gaps.push(`Invalid timestamp on ${id || 'unknown'}`);
        } else if (prevTs > 0 && parsedTs < prevTs) {
          tampered.push(`Out-of-order timestamp on ${id || 'unknown'}`);
        } else {
          prevTs = parsedTs;
        }

        if (!rowEntryHash) {
          gaps.push(`Missing entry hash on ${id || 'unknown'}`);
        } else if (!/^[a-f0-9]{64}$/i.test(rowEntryHash)) {
          tampered.push(`Invalid entry hash format on ${id || 'unknown'}`);
        }

        if (prevHash && rowPrevHash !== prevHash) {
          tampered.push(`Hash chain mismatch on ${id || 'unknown'}`);
        }
        prevHash = rowEntryHash || prevHash;

        if (fileChanges.length > 0) {
          fileChangeEvents += 1;
        }
      }

      const status: VerificationResult['status'] = gaps.length === 0 && tampered.length === 0 ? 'pass' : 'fail';
      setResult({
        status,
        chain_length: rows.length,
        file_change_events: fileChangeEvents,
        gaps,
        tampered,
        checked_at: new Date().toISOString(),
      });
      if (status === 'pass') toast.success('Audit verification complete');
      else toast.error('Audit verification found issues');
    } catch {
      toast.error('Verification failed');
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <PageHeader title="Audit Chain Verifier" description="Verify integrity of the append-only audit log">
        <button onClick={handleVerify} disabled={running} className="btn-primary flex items-center gap-1">
          <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} />
          {running ? 'Verifying…' : 'Verify Chain'}
        </button>
      </PageHeader>

      {result === null ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center text-slate-400">
          <Link2 className="mb-3 h-12 w-12" />
          <p className="text-sm">Click "Verify Chain" to check audit log integrity</p>
          <p className="mt-1 text-xs text-slate-400">
            This verifies hash chain continuity and detects gaps or tampering.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card py-4">
            <p className="text-sm text-slate-500">Status</p>
            <div className="mt-1 flex items-center gap-2">
              {result.status === 'pass' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="text-lg font-semibold">
                {result.status === 'pass' ? 'Verified' : 'FAILED'}
              </span>
            </div>
          </div>

          <div className="card py-4">
            <p className="text-sm text-slate-500">Chain Length</p>
            <p className="mt-1 text-2xl font-semibold">{result.chain_length.toLocaleString()}</p>
          </div>

          <div className="card py-4">
            <p className="text-sm text-slate-500">Gaps Detected</p>
            <p className={`mt-1 text-2xl font-semibold ${result.gaps.length > 0 ? 'text-red-600' : ''}`}>
              {result.gaps.length}
            </p>
          </div>

          <div className="card py-4">
            <p className="text-sm text-slate-500">Tampered Records</p>
            <p className={`mt-1 text-2xl font-semibold ${result.tampered.length > 0 ? 'text-red-600' : ''}`}>
              {result.tampered.length}
            </p>
          </div>

          <div className="card py-4">
            <p className="text-sm text-slate-500">File Change Events</p>
            <p className="mt-1 text-2xl font-semibold">{result.file_change_events}</p>
          </div>

          {/* Detail sections */}
          {result.gaps.length > 0 && (
            <div className="card sm:col-span-2 lg:col-span-4">
              <h3 className="mb-2 font-medium text-red-600">Gaps</h3>
              <div className="space-y-1">
                {result.gaps.map((gap, i) => (
                  <div key={i} className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
                    {gap}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tampered.length > 0 && (
            <div className="card sm:col-span-2 lg:col-span-4">
              <h3 className="mb-2 font-medium text-red-600">Tampered Records</h3>
              <div className="space-y-1">
                {result.tampered.map((rec, i) => (
                  <div key={i} className="rounded-md bg-red-50 px-3 py-2 text-sm font-mono text-red-800 dark:bg-red-950 dark:text-red-300">
                    {rec}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-slate-400 sm:col-span-2 lg:col-span-4">
            Last checked: {new Date(result.checked_at).toLocaleString()}
          </div>
        </div>
      )}
    </>
  );
}
