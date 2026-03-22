'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useCronJobs, useCreateCronJob, useRunCronJob, useDeleteCronJob } from '@/lib/hooks';
import { toast } from 'sonner';
import { Clock3, Play, Trash2 } from 'lucide-react';

type CronJob = {
  id: string;
  name?: string;
  expression?: string;
  handler?: string;
};

export default function CronPage() {
  const { data, isLoading } = useCronJobs();
  const createCron = useCreateCronJob();
  const runCron = useRunCronJob();
  const deleteCron = useDeleteCronJob();

  const [form, setForm] = useState({
    name: '',
    expression: '*/5 * * * *',
    handler: 'health_check',
  });

  if (isLoading) return <PageSpinner />;
  const jobs: CronJob[] = Array.isArray(data?.data)
    ? (data.data as Array<Record<string, unknown>>)
        .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
        .map((row) => ({
          id: typeof row.id === 'string' ? row.id : '',
          name: typeof row.name === 'string' ? row.name : undefined,
          expression: typeof row.expression === 'string' ? row.expression : undefined,
          handler: typeof row.handler === 'string' ? row.handler : undefined,
        }))
        .filter((row) => row.id.length > 0)
    : [];

  function addJob() {
    createCron.mutate(
      { ...form, payload: {} },
      {
        onSuccess: () => {
          toast.success('Cron job created');
          setForm({ name: '', expression: '*/5 * * * *', handler: 'health_check' });
        },
        onError: () => toast.error('Failed to create cron job'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Cron Jobs" description="Schedule recurring jobs and run on demand" />

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Create Cron Job</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="*/5 * * * *"
            value={form.expression}
            onChange={(e) => setForm((p) => ({ ...p, expression: e.target.value }))}
          />
          <select
            className="input"
            value={form.handler}
            onChange={(e) => setForm((p) => ({ ...p, handler: e.target.value }))}
          >
            <option value="health_check">health_check</option>
            <option value="backup">backup</option>
            <option value="rag_reindex">rag_reindex</option>
            <option value="digest_generation">digest_generation</option>
            <option value="workflow">workflow</option>
            <option value="send_message">send_message</option>
            <option value="run_tool">run_tool</option>
          </select>
          <button className="btn-primary" onClick={addJob} disabled={createCron.isPending}>
            Create
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">{job.name ?? 'job'}</p>
              <p className="text-sm text-slate-500">
                <Clock3 className="mr-1 inline h-3.5 w-3.5" />
                {job.expression ?? '—'} &middot; {job.handler ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary btn-sm"
                onClick={() => runCron.mutate(job.id, { onSuccess: () => toast.success('Cron executed') })}
              >
                <Play className="mr-1 h-3.5 w-3.5" /> Run
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => deleteCron.mutate(job.id, { onSuccess: () => toast.success('Cron deleted') })}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
