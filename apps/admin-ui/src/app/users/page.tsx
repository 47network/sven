'use client';

import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import { EmptyState } from '@/components/EmptyState';
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useUserIdentityLinks,
  useCreateUserIdentityLink,
  useVerifyUserIdentityLink,
  useDeleteUserIdentityLink,
} from '@/lib/hooks';
import { Users as UsersIcon, Plus, Trash2, ShieldCheck, User, Sparkles, Activity, Link2, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type UserRow = {
  id: string;
  username?: string;
  role?: string;
  created_at?: string;
};

export default function UsersPage() {
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();
  const createIdentityLink = useCreateUserIdentityLink();
  const verifyIdentityLink = useVerifyUserIdentityLink();
  const deleteIdentityLink = useDeleteUserIdentityLink();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [linkForm, setLinkForm] = useState({ channel_type: '', channel_user_id: '' });
  const [verifyCode, setVerifyCode] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'operator' | 'user'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'username'>('newest');
  const rows: UserRow[] = (data?.rows ?? []) as UserRow[];
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = rows
      .filter((u) => {
        if (roleFilter !== 'all' && (u.role || 'user') !== roleFilter) return false;
        if (!q) return true;
        return (u.username || '').toLowerCase().includes(q) || (u.id || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'username') return (a.username || '').localeCompare(b.username || '');
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortBy === 'newest' ? tb - ta : ta - tb;
      });
    return next;
  }, [rows, query, roleFilter, sortBy]);
  const adminCount = useMemo(() => rows.filter((u) => u.role === 'admin').length, [rows]);
  const userCount = rows.length - adminCount;
  const identityLinks = useUserIdentityLinks(selectedUserId, !!selectedUserId);

  if (isLoading) return <PageSpinner />;

  function handleCreate() {
    createUser.mutate(form, {
      onSuccess: () => {
        toast.success('User created');
        setForm({ username: '', password: '', role: 'user' });
        setShowAdd(false);
      },
      onError: () => toast.error('Failed to create user'),
    });
  }

  function handleDelete(id: string, username: string) {
    if (!confirm(`Delete user "${username}"?`)) return;
    deleteUser.mutate(id, {
      onSuccess: () => toast.success('User deleted'),
      onError: () => toast.error('Failed to delete user'),
    });
  }

  function handleCreateIdentityLink() {
    if (!selectedUserId || !linkForm.channel_type || !linkForm.channel_user_id) return;
    createIdentityLink.mutate(
      { userId: selectedUserId, data: linkForm },
      {
        onSuccess: (res) => {
          const code = String(res?.data?.verification_code || '');
          toast.success(code ? `Link created. Verification code: ${code}` : 'Identity link created');
          setLinkForm({ channel_type: '', channel_user_id: '' });
        },
        onError: () => toast.error('Failed to create identity link'),
      },
    );
  }

  function handleVerifyIdentityLink(linkId: string) {
    if (!selectedUserId) return;
    verifyIdentityLink.mutate(
      { userId: selectedUserId, linkId, code: verifyCode[linkId] || '' },
      {
        onSuccess: () => {
          toast.success('Identity link verified');
          setVerifyCode((prev) => ({ ...prev, [linkId]: '' }));
        },
        onError: () => toast.error('Verification failed'),
      },
    );
  }

  function handleDeleteIdentityLink(linkId: string) {
    if (!selectedUserId) return;
    deleteIdentityLink.mutate(
      { userId: selectedUserId, linkId },
      {
        onSuccess: () => toast.success('Identity link removed'),
        onError: () => toast.error('Failed to remove identity link'),
      },
    );
  }

  return (
    <>
      <PageHeader title="Users" description="Manage user identities and role boundaries">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary flex items-center gap-1">
          <Plus className="h-4 w-4" /> Add User
        </button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                <Sparkles className="h-3 w-3" />
                Identity Control
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">Account Access Surface</h2>
              <p className="mt-1 text-sm text-slate-400">Create operators and administrators with clear role separation.</p>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Total Users</div>
              <div className="text-lg font-semibold text-cyan-300">{rows.length}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Role Mix</h3>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-cyan-300" /> Admin</span>
              <span className="font-semibold">{adminCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm"><User className="h-4 w-4 text-slate-400" /> User</span>
              <span className="font-semibold">{userCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-700 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-sm"><Activity className="h-4 w-4 text-emerald-300" /> Directory</span>
              <span className={rows.length > 0 ? 'badge-success' : 'badge-neutral'}>{rows.length > 0 ? 'active' : 'empty'}</span>
            </div>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-6 space-y-4">
          <h3 className="font-medium">Create User</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input className="input w-full" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Password</label>
              <input type="password" className="input w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Role</label>
              <select className="input w-full" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">User</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleCreate} className="btn-primary" disabled={createUser.isPending || !form.username || !form.password}>Save</button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input w-56"
          placeholder="Search user or id…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-36" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'operator' | 'user')}>
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="operator">Operator</option>
          <option value="user">User</option>
        </select>
        <select className="input w-40" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'username')}>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="username">Sort: Username</option>
        </select>
        <span className="badge badge-neutral">{filteredRows.length} shown</span>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No matching users"
          description="Adjust filters or create a new user."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">Add User</button>}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border hover-lift">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {u.username?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{u.username}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs">
                      {u.role === 'admin' ? (
                        <><ShieldCheck className="h-3.5 w-3.5 text-brand-500" /> Admin</>
                      ) : u.role === 'operator' ? (
                        <><ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> Operator</>
                      ) : (
                        <><User className="h-3.5 w-3.5 text-slate-400" /> User</>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUserId((prev) => (prev === u.id ? '' : u.id))}
                      className="btn-ghost btn-sm mr-1"
                      title="Manage identity links"
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.username ?? u.id)}
                      disabled={deleteUser.isPending}
                      className="btn-ghost btn-sm text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedUserId && (
        <div className="card mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Identity Links</h3>
            <span className="badge badge-neutral">{selectedUserId}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              className="input"
              placeholder="channel_type (telegram)"
              value={linkForm.channel_type}
              onChange={(e) => setLinkForm((p) => ({ ...p, channel_type: e.target.value }))}
            />
            <input
              className="input"
              placeholder="channel_user_id"
              value={linkForm.channel_user_id}
              onChange={(e) => setLinkForm((p) => ({ ...p, channel_user_id: e.target.value }))}
            />
            <button
              className="btn-primary"
              onClick={handleCreateIdentityLink}
              disabled={createIdentityLink.isPending || !linkForm.channel_type || !linkForm.channel_user_id}
            >
              Add Link
            </button>
          </div>

          <div className="space-y-2">
            {(identityLinks.data?.data || []).length === 0 ? (
              <p className="text-sm text-slate-400">No identity links for this user.</p>
            ) : (
              (identityLinks.data?.data || []).map((link) => {
                const id = String(link.id || '');
                const verified = Boolean(link.verified);
                return (
                  <div key={id} className="rounded-lg border border-slate-700 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{String(link.channel_type || '-')}</span>
                      <span className="text-slate-400">{String(link.channel_user_id || '-')}</span>
                      <span className={verified ? 'badge-success' : 'badge-warning'}>
                        {verified ? 'verified' : 'pending'}
                      </span>
                    </div>
                    {!verified && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          className="input h-9 w-40"
                          placeholder="6-digit code"
                          value={verifyCode[id] || ''}
                          onChange={(e) => setVerifyCode((prev) => ({ ...prev, [id]: e.target.value }))}
                        />
                        <button className="btn-secondary btn-sm" onClick={() => handleVerifyIdentityLink(id)}>
                          <CheckCircle2 className="h-4 w-4" /> Verify
                        </button>
                      </div>
                    )}
                    <div className="mt-2">
                      <button className="btn-ghost btn-sm text-red-400" onClick={() => handleDeleteIdentityLink(id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
