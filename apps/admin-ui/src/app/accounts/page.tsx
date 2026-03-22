'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import {
  useAccounts,
  useCreateAccount,
  useActivateAccount,
  useAddAccountMember,
  useMe,
} from '@/lib/hooks';
import { toast } from 'sonner';

type AccountRow = {
  id: string;
  slug: string;
  name: string;
  member_count: number;
};

export default function AccountsPage() {
  const { data: me } = useMe();
  const { data: accounts = [], isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const activateAccount = useActivateAccount();
  const addMember = useAddAccountMember();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState('member');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await createAccount.mutateAsync({ name: name.trim(), slug: slug.trim() || undefined });
      setName('');
      setSlug('');
      toast.success('Account created');
    } catch {
      toast.error('Failed to create account');
    }
  }

  async function onActivate(accountId: string) {
    try {
      await activateAccount.mutateAsync(accountId);
      toast.success('Switched active account');
    } catch {
      toast.error('Failed to switch account');
    }
  }

  async function onAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAccountId || !memberUserId.trim()) {
      toast.error('Select account and user id');
      return;
    }
    try {
      await addMember.mutateAsync({
        accountId: selectedAccountId,
        data: { user_id: memberUserId.trim(), role: memberRole },
      });
      setMemberUserId('');
      toast.success('Member added');
    } catch {
      toast.error('Failed to add member');
    }
  }

  const accountRows = accounts as AccountRow[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        description="Multi-tenant workspaces, membership, and active account switching for Sven."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Create Account</h2>
          <form className="space-y-3" onSubmit={onCreate}>
            <div>
              <label className="mb-1 block text-sm">Name</label>
              <input
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Research"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Slug (optional)</label>
              <input
                className="input w-full"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-research"
              />
            </div>
            <button className="btn-primary" type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-semibold">Add Member</h2>
          <form className="space-y-3" onSubmit={onAddMember}>
            <div>
              <label className="mb-1 block text-sm">Account</label>
              <select
                className="input w-full"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                <option value="">Select account</option>
                {accountRows.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm">User ID</label>
              <input
                className="input w-full"
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                placeholder="UUID of existing user"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm">Role</label>
              <select
                className="input w-full"
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value)}
              >
                <option value="viewer">viewer</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </div>
            <button className="btn-secondary" type="submit" disabled={addMember.isPending}>
              {addMember.isPending ? 'Adding…' : 'Add Member'}
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workspace Directory</h2>
          <span className="badge badge-info">
            Active: {me?.active_organization_slug || 'none'}
          </span>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading accounts…</p>
        ) : accountRows.length === 0 ? (
          <p className="text-sm text-slate-500">No accounts yet.</p>
        ) : (
          <div className="space-y-2">
            {accountRows.map((a) => {
              const active = me?.active_organization_id === a.id;
              return (
                <div
                  key={a.id}
                  className={`flex items-center justify-between rounded-md border p-3 ${
                    active ? 'border-brand-500/50 bg-brand-500/10' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">
                      {a.slug} · {a.member_count} members
                    </div>
                  </div>
                  <button
                    className={active ? 'btn-ghost btn-sm' : 'btn-secondary btn-sm'}
                    disabled={active || activateAccount.isPending}
                    onClick={() => onActivate(a.id)}
                  >
                    {active ? 'Active' : 'Set Active'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
