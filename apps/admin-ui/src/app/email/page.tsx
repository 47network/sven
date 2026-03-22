'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useCreateEmailSubscription,
  useDeleteEmailSubscription,
  useEmailConfig,
  useEmailSubscriptionEvents,
  useEmailSubscriptions,
  useSetEmailConfig,
  useTestEmailSubscription,
} from '@/lib/hooks';
import { toast } from 'sonner';
import { Mail, FlaskConical, Trash2, Sparkles, Activity } from 'lucide-react';

type SubscriptionRow = {
  id: string;
  name?: string;
  pubsub_subscription?: string;
  handler?: string;
};

type EventRow = {
  id: string;
  status?: string;
  created_at?: string;
  error?: string;
};

export default function EmailPage() {
  const { data: cfgData, isLoading: cfgLoading } = useEmailConfig();
  const { data: subData, isLoading: subLoading } = useEmailSubscriptions();
  const setConfig = useSetEmailConfig();
  const createSub = useCreateEmailSubscription();
  const deleteSub = useDeleteEmailSubscription();
  const testSub = useTestEmailSubscription();

  const subscriptions: SubscriptionRow[] = (subData?.data ?? [])
    .filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
    .map((row) => ({
      id: typeof row.id === 'string' ? row.id : '',
      name: typeof row.name === 'string' ? row.name : undefined,
      pubsub_subscription:
        typeof row.pubsub_subscription === 'string' ? row.pubsub_subscription : undefined,
      handler: typeof row.handler === 'string' ? row.handler : undefined,
    }))
    .filter((row) => row.id.length > 0);
  const [selectedId, setSelectedId] = useState<string>('');
  const selectedSub = useMemo(
    () => subscriptions.find((s) => s.id === selectedId) || subscriptions[0] || null,
    [selectedId, subscriptions],
  );
  const events = useEmailSubscriptionEvents(selectedSub?.id ?? '', 20);

  const configMap = useMemo(() => {
    const map: Record<string, unknown> = {};
    for (const row of cfgData?.data ?? []) {
      if (typeof row !== 'object' || row === null) continue;
      const rec = row as Record<string, unknown>;
      if (typeof rec.key === 'string') map[rec.key] = rec.value;
    }
    return map;
  }, [cfgData]);

  const [token, setToken] = useState(String(configMap['gmail.pubsub.verification_token'] || ''));
  const [accessTokenRef, setAccessTokenRef] = useState(String(configMap['gmail.access_token_ref'] || ''));

  const [name, setName] = useState('');
  const [pubsubSubscription, setPubsubSubscription] = useState('');
  const [handler, setHandler] = useState('nats_event');

  if (cfgLoading || subLoading) return <PageSpinner />;

  const successEvents = ((events.data?.data ?? []) as EventRow[]).filter((e) => e.status === 'success').length;

  return (
    <>
      <PageHeader title="Email Triggers" description="Gmail Pub/Sub routing, tests, and event diagnostics" />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3 w-3" /> Event Ingestion
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Email Automation Gateway</h2>
          <p className="mt-1 text-sm text-slate-400">Connect inbox signals to workflows and verify delivery with test events.</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Pipeline</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Subscriptions</span><span className="font-semibold">{subscriptions.length}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Recent Success</span><span className="font-semibold text-emerald-300">{successEvents}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Status</span><span className={subscriptions.length > 0 ? 'badge-success' : 'badge-neutral'}>{subscriptions.length > 0 ? 'active' : 'empty'}</span></div>
          </div>
        </div>
      </div>

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Gmail Configuration</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input className="input" placeholder="gmail.pubsub.verification_token" value={token} onChange={(e) => setToken(e.target.value)} />
          <input className="input" placeholder="gmail.access_token_ref (secret ref)" value={accessTokenRef} onChange={(e) => setAccessTokenRef(e.target.value)} />
          <button
            className="btn-primary"
            onClick={() =>
              setConfig.mutate(
                {
                  'gmail.pubsub.verification_token': token || null,
                  'gmail.access_token_ref': accessTokenRef || null,
                },
                {
                  onSuccess: () => toast.success('Email config saved'),
                  onError: () => toast.error('Failed to save email config'),
                },
              )
            }
          >
            Save Config
          </button>
        </div>
      </div>

      <div className="card mb-6 space-y-3">
        <h3 className="font-medium">Create Subscription</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="projects/.../subscriptions/..." value={pubsubSubscription} onChange={(e) => setPubsubSubscription(e.target.value)} />
          <select className="input" value={handler} onChange={(e) => setHandler(e.target.value)}>
            <option value="nats_event">nats_event</option>
            <option value="workflow">workflow</option>
            <option value="agent_message">agent_message</option>
          </select>
          <button
            className="btn-primary"
            disabled={createSub.isPending || !name || !pubsubSubscription}
            onClick={() =>
              createSub.mutate(
                { name, pubsub_subscription: pubsubSubscription, handler, config: {} },
                {
                  onSuccess: () => {
                    toast.success('Email subscription created');
                    setName('');
                    setPubsubSubscription('');
                    setHandler('nats_event');
                  },
                  onError: () => toast.error('Failed to create subscription'),
                },
              )
            }
          >
            Create
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <div key={sub.id} className={`card cursor-pointer ${selectedSub?.id === sub.id ? 'ring-1 ring-brand-400' : ''}`} onClick={() => setSelectedId(sub.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium inline-flex items-center gap-2"><Mail className="h-4 w-4" /> {sub.name}</p>
                  <p className="text-sm text-slate-500">{sub.pubsub_subscription} · {sub.handler}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      testSub.mutate(
                        { id: sub.id, payload: { test: true, at: new Date().toISOString() } },
                        { onSuccess: () => toast.success('Test event logged') },
                      );
                    }}
                  >
                    <FlaskConical className="mr-1 h-3.5 w-3.5" /> Test
                  </button>
                  <button
                    className="btn-danger btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSub.mutate(sub.id, { onSuccess: () => toast.success('Subscription deleted') });
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {subscriptions.length === 0 && <p className="text-sm text-slate-500">No subscriptions yet.</p>}
        </div>

        <div className="card space-y-2">
          <h3 className="font-medium inline-flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-300" /> Event Logs</h3>
          {((events.data?.data ?? []) as EventRow[]).map((ev) => (
            <div key={ev.id} className="rounded border p-2 text-sm">
              <div className="flex items-center justify-between">
                <span className={ev.status === 'success' ? 'text-emerald-600' : 'text-red-600'}>{ev.status}</span>
                <span className="text-slate-500">{String(ev.created_at || '')}</span>
              </div>
              {ev.error && <div className="text-red-600">{String(ev.error)}</div>}
            </div>
          ))}
          {!selectedSub && <p className="text-sm text-slate-500">Select a subscription to view logs.</p>}
        </div>
      </div>
    </>
  );
}
