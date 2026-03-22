'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useCreateWebhook, useDeleteWebhook, useWebhooks } from '@/lib/hooks';
import { toast } from 'sonner';
import { Webhook, Trash2 } from 'lucide-react';

type WebhookRow = {
  id: string;
  name: string;
  path: string;
  handler: string;
};

function toWebhookRows(value: unknown): WebhookRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      path: String(item.path ?? ''),
      handler: String(item.handler ?? ''),
    }));
}

export default function WebhooksPage() {
  const { data, isLoading } = useWebhooks();
  const createWebhook = useCreateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const [form, setForm] = useState({
    name: '',
    path: '',
    handler: 'nats_event',
    secret: '',
  });

  if (isLoading) return <PageSpinner />;
  const hooks = toWebhookRows(data?.data);

  function addWebhook() {
    createWebhook.mutate(
      {
        name: form.name,
        path: form.path,
        handler: form.handler,
        secret: form.secret || undefined,
        config: {},
      },
      {
        onSuccess: () => {
          toast.success('Webhook created');
          setForm({ name: '', path: '', handler: 'nats_event', secret: '' });
        },
        onError: () => toast.error('Failed to create webhook'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Webhooks" description="Receive external events via signed webhook paths" />

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Create Webhook</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          <input
            className="input"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Path (e.g. github-push)"
            value={form.path}
            onChange={(e) => setForm((p) => ({ ...p, path: e.target.value }))}
          />
          <select
            className="input"
            value={form.handler}
            onChange={(e) => setForm((p) => ({ ...p, handler: e.target.value }))}
          >
            <option value="nats_event">nats_event</option>
            <option value="workflow">workflow</option>
            <option value="agent_message">agent_message</option>
          </select>
          <input
            className="input"
            placeholder="Optional secret"
            value={form.secret}
            onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))}
          />
          <button className="btn-primary" onClick={addWebhook} disabled={createWebhook.isPending}>
            Create
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {hooks.map((hook) => (
          <div key={hook.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium">
                <Webhook className="mr-1 inline h-4 w-4" /> {hook.name}
              </p>
              <p className="text-sm text-slate-500">
                /v1/webhooks/{hook.path} &middot; {hook.handler}
              </p>
            </div>
            <button
              className="btn-danger btn-sm"
              onClick={() => deleteWebhook.mutate(hook.id, { onSuccess: () => toast.success('Webhook deleted') })}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
