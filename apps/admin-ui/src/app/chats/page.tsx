'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import { ActiveAccountPill } from '@/components/ActiveAccountPill';
import { useChats, useMe } from '@/lib/hooks';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useMemo, useState } from 'react';

type ChatRow = {
  id: string;
  name?: string | null;
  channel_type?: string | null;
  member_count?: number | null;
  message_count?: number | null;
  last_message_at?: string | null;
};

export default function ChatsPage() {
  const { data: me } = useMe();
  const { data, isLoading } = useChats();
  const activeAccountName = me?.active_organization_name || me?.active_organization_slug || 'active account';
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'last_active' | 'messages' | 'members'>('last_active');
  const rows = (data?.rows ?? []) as ChatRow[];
  const channels = useMemo(() => {
    return Array.from(new Set(rows.map((r) => String(r.channel_type || 'unknown')))).sort();
  }, [rows]);
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((c) => {
        if (channelFilter !== 'all' && String(c.channel_type || 'unknown') !== channelFilter) return false;
        if (!q) return true;
        return (c.name || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'messages') return Number(b.message_count || 0) - Number(a.message_count || 0);
        if (sortBy === 'members') return Number(b.member_count || 0) - Number(a.member_count || 0);
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });
  }, [rows, query, channelFilter, sortBy]);

  if (isLoading) return <PageSpinner />;

  return (
    <>
      <PageHeader title="Chats" description="Chat policies, members, and message history">
        <ActiveAccountPill />
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input w-60"
          placeholder="Search chat name or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-44" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="all">All channels</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>
        <select className="input w-44" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'last_active' | 'messages' | 'members')}>
          <option value="last_active">Sort: Last active</option>
          <option value="messages">Sort: Messages</option>
          <option value="members">Sort: Members</option>
        </select>
        <span className="badge badge-neutral">{filteredRows.length} shown</span>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No matching chats"
          description={`No chats match filters in ${activeAccountName}.`}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border hover-lift">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Chat</th>
                <th className="px-4 py-3 text-left font-medium">Channel</th>
                <th className="px-4 py-3 text-left font-medium">Members</th>
                <th className="px-4 py-3 text-left font-medium">Messages</th>
                <th className="px-4 py-3 text-left font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <Link href={`/chats/${c.id}`} className="hover:underline">
                        {c.name || c.id.slice(0, 8)}
                      </Link>
                      <span className="badge badge-neutral text-[10px]">{activeAccountName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    <span className="badge badge-info text-[10px]">{c.channel_type ?? 'unknown'}</span>
                  </td>
                  <td className="px-4 py-3">{c.member_count ?? '—'}</td>
                  <td className="px-4 py-3">{c.message_count ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleString() : '—'}
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
