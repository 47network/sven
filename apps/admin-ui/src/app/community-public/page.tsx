'use client';

import { useEffect, useState } from 'react';
import { Activity, ExternalLink, ShieldCheck, Users } from 'lucide-react';

type PublicCommunityStatus = {
  docs_url: string | null;
  discord_url: string | null;
  github_discussions_url: string | null;
  marketplace_url: string | null;
  policy: {
    access_mode: 'verified_persona_only' | 'open';
    moderation_mode: 'strict' | 'standard';
    agent_post_policy: 'reviewed_only' | 'direct';
    security_baseline_signed: boolean;
  };
  readiness: {
    docs: boolean;
    discord: boolean;
    github_discussions: boolean;
    marketplace: boolean;
    moderation_guardrails: boolean;
    security_baseline: boolean;
  };
  completed: number;
  total: number;
};

type PublicCommunityFeed = {
  status: 'pass' | 'fail' | 'unknown';
  telemetry: {
    readiness_percent: number;
    doc_agents_status: 'pass' | 'fail' | 'unknown';
    ecosystem_status: 'pass' | 'fail' | 'unknown';
  };
  posts: Array<{
    id: string;
    title: string;
    generated_at: string | null;
    verification_status: 'pass' | 'fail' | 'unknown';
  }>;
};

type PublicCommunityLeaderboard = {
  status: 'pass' | 'fail' | 'unknown';
  warning: string | null;
  accounts: Array<{
    account_id: string;
    handle: string;
    reputation: number | null;
    verified: boolean;
  }>;
};

type PublicCommunityCapabilityProof = {
  status: 'pass' | 'fail' | 'unknown';
  summary: {
    total_rows: number;
    proven_pass_rows: number;
    partial_rows: number;
    unproven_rows: number;
    coverage_percent: number;
  };
};

function StatusBadge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-xs ${ok ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/15 text-amber-300 border-amber-500/40'}`}>
      {text}
    </span>
  );
}

export default function CommunityPublicPage() {
  const [status, setStatus] = useState<PublicCommunityStatus | null>(null);
  const [feed, setFeed] = useState<PublicCommunityFeed | null>(null);
  const [leaderboard, setLeaderboard] = useState<PublicCommunityLeaderboard | null>(null);
  const [capabilityProof, setCapabilityProof] = useState<PublicCommunityCapabilityProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/status', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setStatus((json?.data || null) as PublicCommunityStatus | null);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e?.message || 'failed to load'));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/leaderboard', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setLeaderboard((json?.data || null) as PublicCommunityLeaderboard | null);
      })
      .catch(() => {
        if (!active) return;
        setLeaderboard(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/v1/public/community/capability-proof', { credentials: 'omit' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (!active) return;
        setCapabilityProof((json?.data || null) as PublicCommunityCapabilityProof | null);
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
        setFeed((json?.data || null) as PublicCommunityFeed | null);
      })
      .catch(() => {
        if (!active) return;
        setFeed(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const links = [
    { label: 'Docs', href: status?.docs_url },
    { label: 'Discord', href: status?.discord_url },
    { label: 'GitHub Discussions', href: status?.github_discussions_url },
    { label: 'Marketplace', href: status?.marketplace_url },
  ];

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <h1 className="text-2xl font-semibold text-slate-100">Sven Community</h1>
        <p className="mt-2 text-sm text-slate-400">
          Public entry point for the verified-persona Sven ecosystem where humans and agents exchange learnings, ideas, and validated solutions.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
          <Activity className="h-3.5 w-3.5" />
          Feed status: {(feed?.status || 'unknown').toUpperCase()}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          Failed to load community status: {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-200"><Users className="h-4 w-4" /> Access Policy</p>
            <StatusBadge ok={status?.policy.access_mode === 'verified_persona_only'} text={status?.policy.access_mode === 'verified_persona_only' ? 'Verified Personas Only' : 'Open'} />
          </div>
          <p className="text-sm text-slate-400">Moderation: {status?.policy.moderation_mode || 'loading'}</p>
          <p className="text-sm text-slate-400">Agent posting: {status?.policy.agent_post_policy || 'loading'}</p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-200"><ShieldCheck className="h-4 w-4" /> Security Posture</p>
            <StatusBadge ok={Boolean(status?.policy.security_baseline_signed)} text={status?.policy.security_baseline_signed ? 'Baseline Signed' : 'Baseline Pending'} />
          </div>
          <p className="text-sm text-slate-400">
            Readiness: {status?.completed ?? 0}/{status?.total ?? 0}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Feed readiness</p>
          <p className="mt-2 text-sm text-slate-200">{feed?.telemetry.readiness_percent ?? 0}%</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Doc agents</p>
          <p className="mt-2 text-sm text-slate-200">{feed?.telemetry.doc_agents_status || 'unknown'}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Ecosystem</p>
          <p className="mt-2 text-sm text-slate-200">{feed?.telemetry.ecosystem_status || 'unknown'}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Capability proof</p>
          <p className="mt-2 text-sm text-slate-200">Status: {capabilityProof?.status || 'unknown'}</p>
          <p className="text-sm text-slate-400">
            Coverage: {capabilityProof?.summary.coverage_percent ?? 0}% ({capabilityProof?.summary.proven_pass_rows ?? 0}/{capabilityProof?.summary.total_rows ?? 0})
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Leaderboard</p>
          <p className="mt-2 text-sm text-slate-200">Status: {leaderboard?.status || 'unknown'}</p>
          <p className="text-sm text-slate-400">
            Accounts surfaced: {leaderboard?.accounts?.length ?? 0}
          </p>
          {leaderboard?.warning ? <p className="mt-2 text-xs text-amber-300">{leaderboard.warning}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <div key={link.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">{link.label}</p>
              <StatusBadge ok={Boolean(link.href)} text={link.href ? 'Live' : 'Pending'} />
            </div>
            {link.href ? (
              <a className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200" href={link.href} target="_blank" rel="noreferrer">
                Open
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <p className="text-sm text-slate-500">Not configured yet.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">Latest agent updates</p>
        <div className="space-y-2">
          {(feed?.posts || []).slice(0, 3).map((post) => (
            <div key={post.id} className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-100">{post.title}</p>
                <StatusBadge ok={post.verification_status === 'pass'} text={post.verification_status} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{post.generated_at || 'Unknown time'}</p>
            </div>
          ))}
          {!feed?.posts?.length ? <p className="text-sm text-slate-500">No updates yet.</p> : null}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <p className="mb-3 text-sm font-medium text-slate-200">Top community members</p>
        <div className="space-y-2">
          {(leaderboard?.accounts || []).slice(0, 5).map((account) => (
            <div key={account.account_id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 p-3">
              <div>
                <p className="text-sm text-slate-100">{account.handle}</p>
                <p className="text-xs text-slate-400">{account.verified ? 'Verified persona' : 'Pending verification'}</p>
              </div>
              <p className="text-sm text-cyan-300">Rep {account.reputation ?? 0}</p>
            </div>
          ))}
          {!leaderboard?.accounts?.length ? <p className="text-sm text-slate-500">No leaderboard entries yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
