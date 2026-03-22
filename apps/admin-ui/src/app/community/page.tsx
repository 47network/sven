'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { PageSpinner } from '@/components/Spinner';
import {
  useCommunityAccounts,
  useCommunityAccessRequests,
  useCommunityAccountsStatus,
  useCommunityStatus,
  useResolveCommunityAccessRequest,
  useUpdateCommunityAccount,
} from '@/lib/hooks';
import type {
  CommunityAccountRecord,
  CommunityAccountsStatusRecord,
  CommunityStatusRecord,
  CommunityAccessRequestRecord,
} from '@/lib/api';
import {
  RELEASE_NARRATIVE_COPY,
  RELEASE_NARRATIVE_LABELS,
  formatStatusLabel,
} from '@sven/shared/community/release-narrative';
import { Activity, CheckCircle2, ExternalLink, Radar, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';

function readinessTone(ok: boolean): string {
  return ok
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/40';
}

function itemLabel(key: 'docs' | 'discord' | 'github_discussions' | 'marketplace'): string {
  if (key === 'docs') return 'Docs Site';
  if (key === 'discord') return 'Discord Server';
  if (key === 'github_discussions') return 'GitHub Discussions';
  return 'Marketplace';
}

export default function CommunityPage() {
  const { data, isLoading } = useCommunityStatus();
  const accountsStatusQuery = useCommunityAccountsStatus();
  const [capabilityProof, setCapabilityProof] = useState<null | {
    status: 'pass' | 'fail' | 'unknown';
    summary: {
      total_rows: number;
      proven_pass_rows: number;
      partial_rows: number;
      unproven_rows: number;
      coverage_percent: number;
    };
    competitors?: Array<{
      id: string;
      total_rows: number;
      proven_pass_rows: number;
      partial_rows: number;
      unproven_rows: number;
    }>;
    waves?: Array<{
      wave: string;
      competitor: string;
      status: 'pass' | 'fail' | 'unknown';
    }>;
  }>(null);
  const [communityFeed, setCommunityFeed] = useState<null | {
    status: 'pass' | 'fail' | 'unknown';
    telemetry?: {
      readiness_percent?: number;
      doc_agents_status?: 'pass' | 'fail' | 'unknown';
      ecosystem_status?: 'pass' | 'fail' | 'unknown';
      required_failures?: number;
    };
  }>(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'pending_review' | 'approved' | 'rejected'>('pending_review');
  const accountsQuery = useCommunityAccounts({
    limit: 200,
    verified: verifiedFilter === 'all' ? undefined : verifiedFilter,
    q: accountSearch.trim() || undefined,
  });
  const updateCommunityAccountMutation = useUpdateCommunityAccount();
  const accessRequestsQuery = useCommunityAccessRequests({ limit: 50, status: requestStatusFilter });
  const resolveRequestMutation = useResolveCommunityAccessRequest();
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [accountReputationDraft, setAccountReputationDraft] = useState<Record<string, string>>({});
  const [accountVerifiedDraft, setAccountVerifiedDraft] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/capability-proof', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCapabilityProof((json?.data || null) as typeof capabilityProof);
      })
      .catch(() => {
        if (!active) return;
        setCapabilityProof(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/feed', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCommunityFeed((json?.data || null) as typeof communityFeed);
      })
      .catch(() => {
        if (!active) return;
        setCommunityFeed(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (isLoading) return <PageSpinner />;

  const fallbackStatus: CommunityStatusRecord = {
    docs_url: null,
    discord_url: null,
    github_discussions_url: null,
    marketplace_url: null,
    policy: {
      access_mode: 'verified_persona_only',
      persona_provider: null,
      persona_allowlist_configured: false,
      moderation_mode: 'strict',
      agent_post_policy: 'reviewed_only',
      security_baseline_signed: false,
    },
    readiness: {
      docs: false,
      discord: false,
      github_discussions: false,
      marketplace: false,
      verified_persona_provider: false,
      verified_persona_allowlist: false,
      moderation_guardrails: false,
      security_baseline: false,
    },
    completed: 0,
    total: 8,
  };
  const status: CommunityStatusRecord = (data as { data?: CommunityStatusRecord } | undefined)?.data || fallbackStatus;
  const fallbackAccounts: CommunityAccountsStatusRecord = {
    backend: 'disabled',
    source: 'COMMUNITY_DATABASE_URL not configured',
    connected: false,
    stats: { total_accounts: 0, verified_accounts: 0, avg_reputation: null, high_reputation_count: 0 },
    top_accounts: [],
    warning: null,
  };
  const accountsStatus: CommunityAccountsStatusRecord =
    (accountsStatusQuery.data as { data?: CommunityAccountsStatusRecord } | undefined)?.data || fallbackAccounts;
  const communityAccounts: CommunityAccountRecord[] =
    (accountsQuery.data as {
      data?: { rows?: CommunityAccountRecord[] };
    } | undefined)?.data?.rows || [];
  const communityAccountsSource =
    (accountsQuery.data as {
      data?: { source?: string; warning?: string | null };
    } | undefined)?.data?.source || 'community_accounts';
  const communityAccountsWarning =
    (accountsQuery.data as {
      data?: { source?: string; warning?: string | null };
    } | undefined)?.data?.warning || null;
  const accessRequests: CommunityAccessRequestRecord[] =
    (accessRequestsQuery.data as {
      data?: { rows?: CommunityAccessRequestRecord[] };
    } | undefined)?.data?.rows || [];

  const links: Array<{ key: 'docs' | 'discord' | 'github_discussions' | 'marketplace'; href: string | null }> = [
    { key: 'docs', href: status.docs_url },
    { key: 'discord', href: status.discord_url },
    { key: 'github_discussions', href: status.github_discussions_url },
    { key: 'marketplace', href: status.marketplace_url },
  ];
  const provenRows = capabilityProof?.summary.proven_pass_rows ?? 0;
  const totalRows = capabilityProof?.summary.total_rows ?? 0;
  const openRows = (capabilityProof?.summary.partial_rows ?? 0) + (capabilityProof?.summary.unproven_rows ?? 0);
  const competitorPerfect = (capabilityProof?.competitors || []).filter(
    (c) => c.total_rows > 0 && c.partial_rows === 0 && c.unproven_rows === 0,
  ).length;
  const competitorTotal = capabilityProof?.competitors?.length ?? 0;
  const wavePass = (capabilityProof?.waves || []).filter((w) => w.status === 'pass').length;
  const waveTotal = capabilityProof?.waves?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Community Hub"
        description={RELEASE_NARRATIVE_COPY.communityOperationsDescription}
      />

      <div className="card mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{RELEASE_NARRATIVE_LABELS.ecosystemReadiness}</p>
          <p className="text-lg font-semibold">
            {status.completed}/{status.total} configured
          </p>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Users className="h-5 w-5" />
          <span className="text-sm">Auto-refreshes every 30s</span>
        </div>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{RELEASE_NARRATIVE_LABELS.capabilityProof}</p>
            <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone((capabilityProof?.status || 'unknown') === 'pass')}`}>
              {formatStatusLabel(capabilityProof?.status)}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded border border-slate-800/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Proven rows</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300">
                <Trophy className="h-3.5 w-3.5" />
                {provenRows}/{totalRows}
              </p>
            </div>
            <div className="rounded border border-slate-800/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Competitors</p>
              <p className="mt-1 text-sm font-semibold text-emerald-300">
                {competitorPerfect}/{competitorTotal}
              </p>
            </div>
            <div className="rounded border border-slate-800/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{RELEASE_NARRATIVE_LABELS.waveLanes}</p>
              <p className="mt-1 text-sm font-semibold text-violet-300">
                {wavePass}/{waveTotal}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Coverage {capabilityProof?.summary.coverage_percent ?? 0}% | Open gaps: {openRows}
          </p>
        </div>

        <div className="card">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">{RELEASE_NARRATIVE_LABELS.docAgentVerificationFeed}</p>
            <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone((communityFeed?.status || 'unknown') === 'pass')}`}>
              {formatStatusLabel(communityFeed?.status)}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-slate-800/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Doc-agent verification</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300">
                <Activity className="h-3.5 w-3.5" />
                {formatStatusLabel(communityFeed?.telemetry?.doc_agents_status)}
              </p>
            </div>
            <div className="rounded border border-slate-800/70 bg-slate-950/60 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Ecosystem</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-300">
                <Radar className="h-3.5 w-3.5" />
                {formatStatusLabel(communityFeed?.telemetry?.ecosystem_status)}
              </p>
            </div>
          </div>
          <p className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            Feed readiness {communityFeed?.telemetry?.readiness_percent ?? 0}% | Required failures {communityFeed?.telemetry?.required_failures ?? 0}
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((item) => {
          const ok = Boolean(status.readiness?.[item.key]);
          return (
            <div key={item.key} className="card">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">{itemLabel(item.key)}</p>
                <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(ok)}`}>
                  {ok ? 'Configured' : 'Missing'}
                </span>
              </div>
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200"
                >
                  Open
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-sm text-slate-500">
                  Set corresponding `SVEN_COMMUNITY_*_URL` environment variable.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Access Control</p>
            <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(status.readiness.verified_persona_provider && status.readiness.verified_persona_allowlist)}`}>
              {status.policy.access_mode === 'verified_persona_only' ? 'Verified Personas Only' : 'Open'}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Persona provider: {status.policy.persona_provider || 'not configured'}
          </p>
          <p className="text-sm text-slate-400">
            Allowlist: {status.policy.persona_allowlist_configured ? 'configured' : 'missing'}
          </p>
        </div>

        <div className="card">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-medium">Trust & Safety</p>
            <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(status.readiness.moderation_guardrails && status.readiness.security_baseline)}`}>
              {status.readiness.moderation_guardrails && status.readiness.security_baseline ? 'Hardened' : 'Needs hardening'}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Moderation: {status.policy.moderation_mode}
          </p>
          <p className="text-sm text-slate-400">
            Agent posting: {status.policy.agent_post_policy}
          </p>
          <p className="text-sm text-slate-400">
            Security baseline signed: {status.policy.security_baseline_signed ? 'yes' : 'no'}
          </p>
        </div>
      </div>

      <div className="card mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-medium">Community Accounts Registry</p>
          <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(communityAccounts.length > 0 || !communityAccountsWarning)}`}>
            {communityAccounts.length} accounts
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Manage verified personas and reputation scoring. Source: {communityAccountsSource}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className="input h-9 w-64 text-sm"
            placeholder="Search handle or email"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
          />
          <select
            className="input h-9 w-44 text-sm"
            value={verifiedFilter}
            onChange={(e) => setVerifiedFilter(e.target.value as 'all' | 'true' | 'false')}
          >
            <option value="all">All accounts</option>
            <option value="true">Verified only</option>
            <option value="false">Unverified only</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => accountsQuery.refetch()}
          >
            Refresh
          </button>
        </div>
        {communityAccountsWarning ? (
          <p className="mt-3 text-xs text-amber-300">{communityAccountsWarning}</p>
        ) : null}
        {communityAccounts.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="text-slate-500">
                  <th className="pr-4">Handle</th>
                  <th className="pr-4">Email</th>
                  <th className="pr-4">Reputation</th>
                  <th className="pr-4">Verified</th>
                  <th className="pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {communityAccounts.map((account) => {
                  const repDraft = accountReputationDraft[account.account_id] ?? String(account.reputation ?? 0);
                  const verifiedDraft = accountVerifiedDraft[account.account_id] ?? account.verified;
                  return (
                    <tr key={account.account_id} className="border-t border-slate-800/70">
                      <td className="py-2 pr-4">{account.handle}</td>
                      <td className="py-2 pr-4">{account.email || '-'}</td>
                      <td className="py-2 pr-4">
                        <input
                          className="input h-8 w-24 text-xs"
                          type="number"
                          step="1"
                          value={repDraft}
                          onChange={(e) =>
                            setAccountReputationDraft((prev) => ({
                              ...prev,
                              [account.account_id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <label className="inline-flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={verifiedDraft}
                            onChange={(e) =>
                              setAccountVerifiedDraft((prev) => ({
                                ...prev,
                                [account.account_id]: e.target.checked,
                              }))
                            }
                          />
                          {verifiedDraft ? 'verified' : 'unverified'}
                        </label>
                      </td>
                      <td className="py-2 pr-4">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={updateCommunityAccountMutation.isPending}
                          onClick={() => {
                            const repValue = Number(repDraft);
                            updateCommunityAccountMutation.mutate({
                              accountId: account.account_id,
                              reputation: Number.isFinite(repValue) ? repValue : undefined,
                              verified: verifiedDraft,
                            });
                          }}
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No community accounts found for current filter.</p>
        )}
      </div>

      <div className="card mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Community Accounts & Reputation</p>
          <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(accountsStatus.connected)}`}>
            {accountsStatus.connected ? 'Connected' : accountsStatus.backend === 'disabled' ? 'Not configured' : 'Disconnected'}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Backend: {accountsStatus.backend} ({accountsStatus.source})
        </p>
        <p className="text-sm text-slate-400">
          Accounts: {accountsStatus.stats.total_accounts} total, {accountsStatus.stats.verified_accounts} verified, avg reputation {accountsStatus.stats.avg_reputation ?? 'n/a'}
        </p>
        {accountsStatus.warning ? (
          <p className="mt-2 text-xs text-amber-300">{accountsStatus.warning}</p>
        ) : null}
        {accountsStatus.top_accounts.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="text-slate-500">
                  <th className="pr-4">Handle</th>
                  <th className="pr-4">Reputation</th>
                  <th className="pr-4">Verified</th>
                </tr>
              </thead>
              <tbody>
                {accountsStatus.top_accounts.map((a) => (
                  <tr key={a.account_id} className="border-t border-slate-800/70">
                    <td className="py-1 pr-4">{a.handle}</td>
                    <td className="py-1 pr-4">{a.reputation ?? '-'}</td>
                    <td className="py-1 pr-4">{a.verified ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="card mt-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-medium">Access Requests Queue</p>
          <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(accessRequests.length > 0 || requestStatusFilter !== 'pending_review')}`}>
            {accessRequests.length} {requestStatusFilter.replace('_', ' ')}
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Public requests from `/community` intake. Only platform admins can approve/reject.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className="input h-9 w-48 text-sm"
            value={requestStatusFilter}
            onChange={(e) => setRequestStatusFilter(e.target.value as 'pending_review' | 'approved' | 'rejected')}
          >
            <option value="pending_review">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => accessRequestsQuery.refetch()}
          >
            Refresh
          </button>
        </div>
        {accessRequests.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No {requestStatusFilter.replace('_', ' ')} access requests.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="text-slate-500">
                  <th className="pr-4">Email</th>
                  <th className="pr-4">Display name</th>
                  <th className="pr-4">Motivation</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((r) => (
                  <tr key={r.request_id} className="border-t border-slate-800/70">
                    <td className="py-2 pr-4">{r.email}</td>
                    <td className="py-2 pr-4">{r.display_name}</td>
                    <td className="py-2 pr-4 max-w-[360px] whitespace-normal">{r.motivation}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded border px-2 py-0.5 text-xs ${readinessTone(r.status !== 'rejected')}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex min-w-[260px] items-center gap-2">
                        {r.status === 'pending_review' ? (
                          <>
                            <input
                              className="input h-8 w-44 text-xs"
                              placeholder="review note (optional)"
                              value={reviewNote[r.request_id] || ''}
                              onChange={(e) =>
                                setReviewNote((prev) => ({ ...prev, [r.request_id]: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={resolveRequestMutation.isPending}
                              onClick={() =>
                                resolveRequestMutation.mutate({
                                  requestId: r.request_id,
                                  status: 'approved',
                                  reviewNote: reviewNote[r.request_id] || '',
                                }, {
                                  onSuccess: (res) => {
                                    const payload = (res as { data?: { account_verified?: boolean; verification_evidence?: { reason?: string } } } | undefined)?.data;
                                    const verified = Boolean(payload?.account_verified);
                                    const reason = String(payload?.verification_evidence?.reason || '').trim();
                                    toast.success(
                                      verified
                                        ? 'Request approved and persona evidence verified'
                                        : `Request approved, verification pending${reason ? ` (${reason})` : ''}`,
                                    );
                                  },
                                  onError: () => toast.error('Failed to approve request'),
                                })
                              }
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={resolveRequestMutation.isPending}
                              onClick={() =>
                                resolveRequestMutation.mutate({
                                  requestId: r.request_id,
                                  status: 'rejected',
                                  reviewNote: reviewNote[r.request_id] || '',
                                }, {
                                  onSuccess: () => toast.success('Request rejected'),
                                  onError: () => toast.error('Failed to reject request'),
                                })
                              }
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {r.review_note ? `Review note: ${r.review_note}` : 'Resolved'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
