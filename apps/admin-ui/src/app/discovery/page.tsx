'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { useDiscoveryInstances } from '@/lib/hooks';
import { Radar } from 'lucide-react';

type InstanceRow = {
  id: string;
  name: string;
  host?: string | null;
  address?: string | null;
  port?: number | null;
  url?: string | null;
  version?: string | null;
  last_seen?: string;
  self?: boolean;
};

type NatsLeafPeerRow = {
  instance_id: string;
  instance_name: string;
  nats_leaf_url: string;
  last_seen?: string;
};

function toRows(value: unknown): InstanceRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      id: String(item.id ?? ''),
      name: String(item.name ?? ''),
      host: typeof item.host === 'string' ? item.host : null,
      address: typeof item.address === 'string' ? item.address : null,
      port: typeof item.port === 'number' ? item.port : null,
      url: typeof item.url === 'string' && item.url ? item.url : null,
      version: typeof item.version === 'string' ? item.version : null,
      last_seen: typeof item.last_seen === 'string' ? item.last_seen : undefined,
      self: Boolean(item.self),
    }));
}

function toNatsLeafPeers(value: unknown): NatsLeafPeerRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item) => ({
      instance_id: String(item.instance_id ?? ''),
      instance_name: String(item.instance_name ?? ''),
      nats_leaf_url: String(item.nats_leaf_url ?? ''),
      last_seen: typeof item.last_seen === 'string' ? item.last_seen : undefined,
    }))
    .filter((peer) => peer.instance_id && peer.nats_leaf_url);
}

export default function DiscoveryPage() {
  const { data, isLoading } = useDiscoveryInstances();

  if (isLoading) return <PageSpinner />;

  const enabled = Boolean((data as any)?.data?.enabled);
  const rows = toRows((data as any)?.data?.instances);
  const natsLeafAutoPeerEnabled = Boolean((data as any)?.data?.nats_leaf_auto_peer_enabled);
  const natsLeafPeers = toNatsLeafPeers((data as any)?.data?.nats_leaf_peers);

  return (
    <>
      <PageHeader
        title="Discovery"
        description="LAN discovery for other Sven instances via mDNS/DNS-SD"
      />

      <div className="card mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Status</p>
          <p className="text-lg font-semibold">{enabled ? 'Enabled' : 'Disabled'}</p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Radar className="h-5 w-5" />
          <span className="text-sm">Auto-refreshes every 15s</span>
        </div>
      </div>

      <div className="space-y-3">
        {rows.length === 0 && (
          <div className="card text-sm text-slate-500">No instances discovered yet.</div>
        )}
        {rows.map((row) => (
          <div key={row.id} className="card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">
                {row.name || row.id}
                {row.self && <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-200">Self</span>}
              </p>
              <p className="text-sm text-slate-500">
                {row.url || `${row.address || row.host || 'unknown'}:${row.port ?? ''}`} &middot; {row.version || 'unknown version'}
              </p>
              {row.last_seen && (
                <p className="text-xs text-slate-500">Last seen: {new Date(row.last_seen).toLocaleString()}</p>
              )}
            </div>
            <div className="flex gap-2">
              {row.url && (
                <a
                  className="btn-primary btn-sm"
                  href={row.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-2 text-base font-semibold">NATS Leaf Auto-Peer Candidates</h2>
        <p className="mb-3 text-sm text-slate-500">
          {natsLeafAutoPeerEnabled
            ? 'Enabled: discovered instances can advertise NATS leaf URLs for optional peering.'
            : 'Disabled: set discovery.natsLeafAutoPeer.enabled=true to collect NATS leaf peer candidates.'}
        </p>
        <div className="space-y-3">
          {natsLeafPeers.length === 0 && (
            <div className="card text-sm text-slate-500">No NATS leaf peer candidates discovered yet.</div>
          )}
          {natsLeafPeers.map((peer) => (
            <div key={peer.instance_id} className="card flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{peer.instance_name || peer.instance_id}</p>
                <p className="text-sm text-slate-500 font-mono">{peer.nats_leaf_url}</p>
                {peer.last_seen && (
                  <p className="text-xs text-slate-500">Last seen: {new Date(peer.last_seen).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
