'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { api, type AdminChannelRecord } from '@/lib/api';
import { useSettings, useSetSetting } from '@/lib/hooks';
import { Radio, Plus, Power, PowerOff, Sparkles, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type SettingRow = { key: string; value: unknown };
type ChannelPolicy = 'pairing' | 'open' | 'deny';
export default function ChannelsPage() {
  const { data, isLoading } = useSettings();
  const setSetting = useSetSetting();
  const [channels, setChannels] = useState<AdminChannelRecord[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(true);
  const [channelsSaving, setChannelsSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newChannel, setNewChannel] = useState({ type: 'discord', name: '', token: '' });

  const settingRows: SettingRow[] = (data?.rows ?? []) as SettingRow[];

  async function refreshChannels() {
    setChannelsLoading(true);
    try {
      const response = await api.channels.list();
      setChannels(Array.isArray(response?.data?.channels) ? response.data.channels : []);
    } catch {
      toast.error('Failed to load channel control plane');
      setChannels([]);
    } finally {
      setChannelsLoading(false);
    }
  }

  useEffect(() => {
    void refreshChannels();
  }, []);

  const channelTypes = Array.from(
    new Set(
      [
        ...channels.map((c) => String(c.channel || '').trim()).filter(Boolean),
        'discord',
        'slack',
        'telegram',
        'whatsapp',
        'teams',
        'google-chat',
        'signal',
        'imessage',
        'webchat',
        'line',
        'voice_call',
      ],
    ),
  );

  const dmPolicyByChannel = Object.fromEntries(
    channelTypes.map((channel) => {
      const key = `adapter.${channel}.dm.policy`;
      const row = settingRows.find((s) => s.key === key);
      const value = String(row?.value || 'pairing');
      return [channel, value];
    }),
  );

  const enabledCount = useMemo(() => channels.filter((c) => c.enabled).length, [channels]);

  if (isLoading || channelsLoading) return <PageSpinner />;

  async function handleAdd() {
    if (!newChannel.type) return;
    setChannelsSaving(true);
    try {
      const payload: Record<string, unknown> = { enabled: true };
      if (newChannel.name.trim()) payload.name = newChannel.name.trim();
      if (newChannel.token.trim()) payload.token = newChannel.token.trim();
      await api.channels.update(newChannel.type, payload);
      await refreshChannels();
      toast.success('Channel updated');
      setNewChannel({ type: 'discord', name: '', token: '' });
      setShowAdd(false);
    } catch {
      toast.error('Failed to update channel');
    } finally {
      setChannelsSaving(false);
    }
  }

  async function handleToggle(channel: string, enabled: boolean) {
    setChannelsSaving(true);
    try {
      await api.channels.update(channel, { enabled: !enabled });
      await refreshChannels();
      toast.success('Channel updated');
    } catch {
      toast.error('Failed to update channel');
    } finally {
      setChannelsSaving(false);
    }
  }

  function handleDmPolicy(channel: string, policy: ChannelPolicy) {
    setSetting.mutate(
      { key: `adapter.${channel}.dm.policy`, value: policy },
      {
        onSuccess: () => toast.success(`${channel} DM policy set to ${policy}`),
        onError: () => toast.error('Failed to update DM policy'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Channels" description="Adapter lifecycle, DM posture, and connection status">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add Channel
        </button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            <Sparkles className="h-3 w-3" /> Adapter Fabric
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">Channel Control Plane</h2>
          <p className="mt-1 text-sm text-slate-400">Enable or isolate adapters quickly while keeping unknown DM behavior controlled.</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Status</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Total</span><span className="font-semibold">{channels.length}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Enabled</span><span className="font-semibold text-emerald-300">{enabledCount}</span></div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2 text-sm"><span>Policies</span><span className="font-semibold">{channelTypes.length}</span></div>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-medium">New Channel</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <select className="input w-full" value={newChannel.type} onChange={(e) => setNewChannel({ ...newChannel, type: e.target.value })}>
                <option value="discord">Discord</option>
                <option value="telegram">Telegram</option>
                <option value="matrix">Matrix</option>
                <option value="slack">Slack</option>
                <option value="line">LINE</option>
                <option value="voice_call">Voice Call</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input className="input w-full" value={newChannel.name} onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })} placeholder="My Server" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bot Token</label>
              <input type="password" className="input w-full" value={newChannel.token} onChange={(e) => setNewChannel({ ...newChannel, token: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleAdd} className="btn-primary" disabled={channelsSaving || !newChannel.type}>Save</button>
          </div>
        </div>
      )}

      {channels.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No channels configured"
          description="Add an adapter (Discord, Telegram, Matrix, Slack, LINE, Voice Call) to get started."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">Add Channel</button>}
        />
      ) : (
        <div className="space-y-3">
          {channels.map((ch) => (
            <div key={ch.channel} className="card flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold ${
                  ch.enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}>
                  {ch.channel?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{ch.channel}</p>
                  <p className="text-xs text-slate-500">
                    {ch.configured ? 'configured' : 'not configured'} • {ch.has_token ? 'token present' : 'no token'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge-neutral text-[11px]">
                  chats {ch.stats?.chats || 0} • ids {ch.stats?.identities || 0}
                </span>
                <span className={ch.enabled ? 'badge-success' : 'badge-neutral'}>{ch.enabled ? 'enabled' : 'disabled'}</span>
                <button onClick={() => handleToggle(ch.channel, ch.enabled)} className="btn-ghost btn-sm" title={ch.enabled ? 'Disable' : 'Enable'}>
                  {ch.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 card">
        <h3 className="mb-3 font-medium">DM Policy by Channel</h3>
        <p className="mb-4 text-sm text-slate-500">Control behavior for unknown direct-message senders.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {channelTypes.map((channel) => (
            <div key={channel} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium capitalize inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" /> {channel}</p>
                <p className="text-xs text-slate-500">pairing | open | deny</p>
              </div>
              <select className="input w-40" value={dmPolicyByChannel[channel] || 'pairing'} onChange={(e) => handleDmPolicy(channel, e.target.value as ChannelPolicy)}>
                <option value="pairing">pairing</option>
                <option value="open">open</option>
                <option value="deny">deny</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
