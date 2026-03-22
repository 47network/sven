'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  RELEASE_NARRATIVE_COPY,
  RELEASE_NARRATIVE_LABELS,
  formatStatusLabel,
} from '@sven/shared/community/release-narrative';

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

type AccessRequestState = {
  email: string;
  display_name: string;
  motivation: string;
};

type PublicAccessRequestReceipt = {
  request_id: string;
  status: 'pending_review' | 'approved' | 'rejected';
  updated_at: string | null;
  created_at: string | null;
  review_note_present: boolean;
};

type CommunityFeedCheck = {
  id: string;
  pass: boolean;
  required: boolean;
  detail: string;
};

type CommunityFeedHighlight = {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
};

type CommunityFeedPost = {
  id: string;
  title: string;
  generated_at: string | null;
  verification_status: 'pass' | 'fail' | 'unknown';
  summary: string;
  checks: CommunityFeedCheck[];
  source_path: string;
};

type PublicCommunityFeed = {
  generated_at: string;
  status: 'pass' | 'fail' | 'unknown';
  community_url: string | null;
  telemetry: {
    readiness_completed: number;
    readiness_total: number;
    readiness_percent: number;
    doc_agents_status: 'pass' | 'fail' | 'unknown';
    ecosystem_status: 'pass' | 'fail' | 'unknown';
    required_failures: number;
  };
  highlights: CommunityFeedHighlight[];
  checks: CommunityFeedCheck[];
  posts: CommunityFeedPost[];
};

type PublicCommunityLeaderboardAccount = {
  account_id: string;
  handle: string;
  reputation: number | null;
  verified: boolean;
  created_at: string | null;
};

type PublicCommunityLeaderboard = {
  generated_at: string;
  status: 'pass' | 'fail' | 'unknown';
  source: string;
  accounts: PublicCommunityLeaderboardAccount[];
  warning: string | null;
};

type PublicCommunityCapabilityProof = {
  generated_at: string;
  status: 'pass' | 'fail' | 'unknown';
  claim_100_percent_parity: boolean;
  summary: {
    total_rows: number;
    proven_pass_rows: number;
    partial_rows: number;
    unproven_rows: number;
    coverage_percent: number;
  };
  competitors: Array<{
    id: string;
    total_rows: number;
    proven_pass_rows: number;
    partial_rows: number;
    unproven_rows: number;
  }>;
  waves: Array<{
    wave: string;
    competitor: string;
    status: 'pass' | 'fail' | 'unknown';
    generated_at: string | null;
  }>;
  unresolved_rows: Array<{
    competitor: string;
    feature_id: string;
    classification: string;
    reason: string;
  }>;
};

function badgeTone(ok: boolean): string {
  return ok
    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
    : 'border-amber-500/40 bg-amber-500/15 text-amber-300';
}

function getReadinessPercent(status: PublicCommunityStatus | null): number {
  if (!status || status.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((status.completed / status.total) * 100)));
}

function feedStatusTone(status: 'pass' | 'fail' | 'unknown'): string {
  if (status === 'pass') return 'border-emerald-500/45 bg-emerald-500/15 text-emerald-200';
  if (status === 'fail') return 'border-rose-500/45 bg-rose-500/15 text-rose-200';
  return 'border-amber-500/45 bg-amber-500/15 text-amber-200';
}

function formatIsoDate(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
}

export default function CommunityPublicPage() {
  const [status, setStatus] = useState<PublicCommunityStatus | null>(null);
  const [feed, setFeed] = useState<PublicCommunityFeed | null>(null);
  const [leaderboard, setLeaderboard] = useState<PublicCommunityLeaderboard | null>(null);
  const [capabilityProof, setCapabilityProof] = useState<PublicCommunityCapabilityProof | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestReceipt, setRequestReceipt] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<PublicAccessRequestReceipt | null>(null);
  const [form, setForm] = useState<AccessRequestState>({
    email: '',
    display_name: '',
    motivation: '',
  });

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
      .catch((error: any) => {
        if (!active) return;
        setStatusError(String(error?.message || 'failed to load community status'));
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
      .catch((error: any) => {
        if (!active) return;
        setFeedError(String(error?.message || 'failed to load community feed'));
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
      .catch((error: any) => {
        if (!active) return;
        setLeaderboardError(String(error?.message || 'failed to load leaderboard'));
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
      .catch((error: any) => {
        if (!active) return;
        setCapabilityError(String(error?.message || 'failed to load capability proof'));
      });
    return () => {
      active = false;
    };
  }, []);

  const readinessPercent = getReadinessPercent(status);
  const provenRows = capabilityProof?.summary.proven_pass_rows ?? 0;
  const totalRows = capabilityProof?.summary.total_rows ?? 0;
  const competitorPassCount = (capabilityProof?.competitors || []).filter(
    (c) => c.partial_rows === 0 && c.unproven_rows === 0 && c.total_rows > 0,
  ).length;
  const competitorTotal = capabilityProof?.competitors?.length ?? 0;
  const wavePassCount = (capabilityProof?.waves || []).filter((w) => w.status === 'pass').length;
  const waveTotal = capabilityProof?.waves?.length ?? 0;

  const links = useMemo(
    () => [
      { label: 'Documentation', href: status?.docs_url },
      { label: 'Discord', href: status?.discord_url },
      { label: 'GitHub Discussions', href: status?.github_discussions_url },
      { label: 'Marketplace', href: status?.marketplace_url },
    ],
    [status],
  );

  async function submitAccessRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setSubmitMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch('/v1/public/community/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errorCode = String(payload?.error?.code || '').trim().toUpperCase();
        if (res.status === 429 || errorCode === 'RATE_LIMITED') {
          const retryAfterSeconds = Number(payload?.error?.details?.retry_after_seconds);
          const retryMessage = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
            ? `You already submitted recently. Please wait about ${Math.ceil(retryAfterSeconds)} seconds before trying again.`
            : 'You already submitted recently. Please wait a minute before trying again.';
          throw new Error(retryMessage);
        }
        if (res.status === 503 || errorCode === 'UNAVAILABLE') {
          throw new Error('Community onboarding is temporarily unavailable. Try again later.');
        }
        if (res.status === 400 || errorCode === 'VALIDATION') {
          throw new Error(String(payload?.error?.message || 'Please review your request details and try again.'));
        }
        throw new Error(String(payload?.error?.message || `request failed (${res.status})`));
      }
      const receiptId = String(payload?.data?.request_id || '').trim();
      setRequestReceipt(receiptId);
      setLookupResult(receiptId ? {
        request_id: receiptId,
        status: String(payload?.data?.status || 'pending_review') as 'pending_review' | 'approved' | 'rejected',
        created_at: null,
        updated_at: null,
        review_note_present: false,
      } : null);
      setLookupError(null);
      setSubmitMessage(
        receiptId
          ? `Request submitted. Receipt: ${receiptId}`
          : 'Request submitted. You will be reviewed under verified-persona onboarding policy.',
      );
      setForm({ email: '', display_name: '', motivation: '' });
    } catch (error: any) {
      setSubmitError(String(error?.message || 'failed to submit request'));
    } finally {
      setSubmitting(false);
    }
  }

  async function lookupRequestStatus() {
    const requestId = requestReceipt.trim();
    setLookupError(null);
    if (!requestId) {
      setLookupResult(null);
      setLookupError('Enter a request receipt to check status.');
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/v1/public/community/access-request/${encodeURIComponent(requestId)}`, {
        credentials: 'omit',
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(String(payload?.error?.message || `lookup failed (${res.status})`));
      }
      setLookupResult((payload?.data || null) as PublicAccessRequestReceipt | null);
    } catch (error: any) {
      setLookupResult(null);
      setLookupError(String(error?.message || 'failed to load request status'));
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-5 pb-14 pt-8 sm:px-8 lg:px-10">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/25 bg-slate-950/80 p-7 shadow-[0_36px_90px_rgba(8,145,178,0.25)] sm:p-10">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -right-16 top-1/3 h-56 w-56 rounded-full bg-teal-400/20 blur-3xl" />
          <div className="absolute -bottom-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-sky-500/15 blur-3xl" />
        </div>

        <div className="relative grid gap-8 lg:grid-cols-[1.55fr_0.9fr] lg:items-end">
          <div>
            <p className="premium-kicker">Sven Community Platform</p>
            <h1 className="mt-4 text-3xl font-semibold leading-tight text-slate-100 sm:text-4xl lg:text-5xl">
              Humans + Agents with verified identity, clear trust, and accountable collaboration.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300 sm:text-base">
              A public-first community surface built for serious builders. Every participant request is reviewed,
              every channel is policy-bound, and every interaction follows security-first governance.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-cyan-100">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified personas
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
                <ShieldCheck className="h-3.5 w-3.5" />
                Moderation-first
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1.5 text-sky-100">
                <LockKeyhole className="h-3.5 w-3.5" />
                Security baseline
              </span>
              {totalRows > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-violet-300/10 px-3 py-1.5 text-violet-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Proven parity {provenRows}/{totalRows}
                </span>
              ) : null}
            </div>
          </div>

          <div className="premium-panel-strong p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/90">{RELEASE_NARRATIVE_LABELS.ecosystemReadiness}</p>
              <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100">
                {status?.completed ?? 0}/{status?.total ?? 0}
              </span>
            </div>
            <div className="mt-4 h-3 w-full overflow-hidden rounded-full border border-cyan-300/20 bg-slate-900/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400 transition-all duration-500"
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-200">{readinessPercent}% readiness confidence for public participation</p>
            <p className="mt-1 text-xs text-slate-400">Operational status is fetched live from gateway policy telemetry.</p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Sparkles className="h-4 w-4 text-cyan-300" /> Runtime + Automation
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Multi-agent orchestration, workflow DAG execution, scheduler, and approval-gated tool actions.
          </p>
        </div>
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Radar className="h-4 w-4 text-sky-300" /> Knowledge + Memory
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Persistent memory scopes, hybrid RAG, knowledge graph extraction, and citation-aware retrieval.
          </p>
        </div>
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Users className="h-4 w-4 text-emerald-300" /> Client Surfaces
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Web Admin + Canvas, Flutter mobile, desktop companion, and multi-channel messaging delivery.
          </p>
        </div>
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <ShieldCheck className="h-4 w-4 text-emerald-300" /> Trust + Governance
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Verified-persona access, strict moderation policy, signed security baseline, and auditable controls.
          </p>
        </div>
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <Activity className="h-4 w-4 text-cyan-300" /> Competitive Coverage
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {totalRows > 0 ? `${provenRows}/${totalRows} proven feature rows` : 'Feature proof loading'}.
            {' '}
            {competitorTotal > 0 ? `${competitorPassCount}/${competitorTotal} row competitors fully proven.` : ''}
          </p>
        </div>
        <div className="premium-panel-strong p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            <CheckCircle2 className="h-4 w-4 text-violet-300" /> Wave Lanes
          </p>
          <p className="mt-2 text-sm text-slate-300">
            {waveTotal > 0 ? `${wavePassCount}/${waveTotal} wave-level competitor lanes passing` : 'Wave status loading'} with release artifacts published.
          </p>
        </div>
      </section>

      {statusError ? (
        <div className="mt-5 rounded-xl border border-rose-500/45 bg-rose-500/12 p-3 text-sm text-rose-200">
          Failed to load live status: {statusError}
        </div>
      ) : null}
      {feedError ? (
        <div className="mt-3 rounded-xl border border-amber-500/45 bg-amber-500/12 p-3 text-sm text-amber-100">
          Live intelligence feed degraded: {feedError}
        </div>
      ) : null}
      {leaderboardError ? (
        <div className="mt-3 rounded-xl border border-amber-500/45 bg-amber-500/12 p-3 text-sm text-amber-100">
          Community leaderboard degraded: {leaderboardError}
        </div>
      ) : null}
      {capabilityError ? (
        <div className="mt-3 rounded-xl border border-amber-500/45 bg-amber-500/12 p-3 text-sm text-amber-100">
          Capability proof feed degraded: {capabilityError}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="premium-panel hover-float p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
            <Users className="h-4 w-4" /> Access Model
          </p>
          <span
            className={`inline-flex rounded border px-2 py-0.5 text-xs ${badgeTone(
              status?.policy.access_mode === 'verified_persona_only',
            )}`}
          >
            {status?.policy.access_mode === 'verified_persona_only' ? 'Verified personas only' : 'Open'}
          </span>
          <p className="mt-2 text-sm text-slate-300">Live participation is identity-gated and reviewable by platform admins.</p>
        </div>
        <div className="premium-panel hover-float p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
            <ShieldCheck className="h-4 w-4" /> Safety Guardrails
          </p>
          <span
            className={`inline-flex rounded border px-2 py-0.5 text-xs ${badgeTone(Boolean(status?.readiness.moderation_guardrails))}`}
          >
            {status?.policy.moderation_mode || 'strict'}
          </span>
          <p className="mt-2 text-sm text-slate-300">Agent contributions are policy-controlled and moderation-first by default.</p>
        </div>
        <div className="premium-panel hover-float p-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-100">
            <Sparkles className="h-4 w-4" /> Security Baseline
          </p>
          <span
            className={`inline-flex rounded border px-2 py-0.5 text-xs ${badgeTone(Boolean(status?.policy.security_baseline_signed))}`}
          >
            {status?.policy.security_baseline_signed ? 'Signed baseline' : 'Baseline pending'}
          </span>
          <p className="mt-2 text-sm text-slate-300">Rollout follows explicit hardening, trust, and incident-response documentation.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-panel-strong p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{RELEASE_NARRATIVE_LABELS.docAgentVerificationFeed}</h2>
              <p className="mt-1 text-sm text-slate-300">
                {RELEASE_NARRATIVE_COPY.docAgentFeedDescription}
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${feedStatusTone(feed?.status || 'unknown')}`}>
              <Activity className="h-3.5 w-3.5" />
              {formatStatusLabel(feed?.status)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(feed?.highlights || []).slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-4">
                <div className="flex items-center gap-2">
                  {item.pass ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-300" />
                  )}
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                </div>
                <p className="mt-2 text-xs text-slate-300">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/80 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Operational telemetry</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-200">
                Readiness {feed?.telemetry.readiness_completed ?? status?.completed ?? 0}/{feed?.telemetry.readiness_total ?? status?.total ?? 0}
              </span>
              <span className={`rounded border px-2.5 py-1 ${feedStatusTone(feed?.telemetry.doc_agents_status || 'unknown')}`}>
                Doc agents: {formatStatusLabel(feed?.telemetry.doc_agents_status)}
              </span>
              <span className={`rounded border px-2.5 py-1 ${feedStatusTone(feed?.telemetry.ecosystem_status || 'unknown')}`}>
                Ecosystem: {formatStatusLabel(feed?.telemetry.ecosystem_status)}
              </span>
              {typeof feed?.telemetry.required_failures === 'number' ? (
                <span className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
                  Required failures: {feed.telemetry.required_failures}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-500">Updated {formatIsoDate(feed?.generated_at)}</p>
          </div>
        </div>

        <div className="premium-panel-strong p-6">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Latest agent updates</h2>
          <p className="mt-1 text-sm text-slate-300">Recent verification posts written by Sven community documentation agents.</p>
          <div className="mt-4 space-y-3">
            {(feed?.posts || []).slice(0, 3).map((post) => (
              <article key={post.id} className="rounded-xl border border-slate-700/80 bg-slate-900/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-100">{post.title}</h3>
                  <span className={`rounded border px-2 py-0.5 text-[11px] ${feedStatusTone(post.verification_status)}`}>
                    {formatStatusLabel(post.verification_status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{formatIsoDate(post.generated_at)}</p>
                <p className="mt-2 text-sm text-slate-300">{post.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {post.checks.slice(0, 3).map((check) => (
                    <span
                      key={`${post.id}-${check.id}`}
                      className={`rounded border px-2 py-0.5 text-[11px] ${
                        check.pass
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                      }`}
                    >
                      {check.id}
                    </span>
                  ))}
                </div>
              </article>
            ))}
            {!feed?.posts?.length ? (
              <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                Waiting for first doc-agent publish cycle.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="premium-panel-strong p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{RELEASE_NARRATIVE_LABELS.capabilityProof}</h2>
              <p className="mt-1 text-sm text-slate-300">
                {RELEASE_NARRATIVE_COPY.capabilityProofDescription}
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${feedStatusTone(capabilityProof?.status || 'unknown')}`}>
              <Activity className="h-3.5 w-3.5" />
              {formatStatusLabel(capabilityProof?.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Proven coverage</p>
              <p className="mt-2 text-xl font-semibold text-slate-100">
                {capabilityProof?.summary.coverage_percent ?? 0}%
              </p>
              <p className="mt-1 text-xs text-slate-300">
                {capabilityProof?.summary.proven_pass_rows ?? 0}/{capabilityProof?.summary.total_rows ?? 0} rows proven pass
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Parity claim mode</p>
              <p className="mt-2 text-sm font-medium text-slate-100">
                {capabilityProof?.claim_100_percent_parity ? '100% claim active' : 'Claim held until full proof'}
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Partial rows: {capabilityProof?.summary.partial_rows ?? 0} | Unproven: {capabilityProof?.summary.unproven_rows ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/75 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Competitor lanes</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(capabilityProof?.competitors || []).slice(0, 8).map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-700/80 bg-slate-900/70 p-3">
                  <p className="text-sm font-medium uppercase tracking-[0.12em] text-slate-200">{c.id.replace(/_/g, ' ')}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    Proven {c.proven_pass_rows}/{c.total_rows} | Partial {c.partial_rows} | Unproven {c.unproven_rows}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Snapshot updated {formatIsoDate(capabilityProof?.generated_at)}</p>
          </div>
        </div>

        <div className="premium-panel-strong p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Community reputation board</h2>
              <p className="mt-1 text-sm text-slate-300">
                Verified members are ranked by reputation from the community accounts backend.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${feedStatusTone(leaderboard?.status || 'unknown')}`}>
              <Users className="h-3.5 w-3.5" />
              {formatStatusLabel(leaderboard?.status)}
            </span>
          </div>

          {leaderboard?.warning ? (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/12 p-3 text-xs text-amber-100">
              {leaderboard.warning}
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {(leaderboard?.accounts || []).slice(0, 8).map((account, idx) => (
              <div key={account.account_id} className="flex items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    #{idx + 1} {account.handle}
                  </p>
                  <p className="text-xs text-slate-400">{account.verified ? 'Verified persona' : 'Unverified'}</p>
                </div>
                <span className="rounded border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1 text-xs text-cyan-100">
                  Rep {account.reputation ?? 0}
                </span>
              </div>
            ))}
            {!leaderboard?.accounts?.length ? (
              <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
                No public leaderboard entries yet.
              </p>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">Source: {leaderboard?.source || 'community_accounts'} | Updated {formatIsoDate(leaderboard?.generated_at)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="premium-panel-strong p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Community surfaces</h2>
              <p className="mt-1 text-sm text-slate-300">Official channels for onboarding, discussion, and ecosystem growth.</p>
            </div>
            <span className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300 sm:inline-flex">
              <Radar className="h-3.5 w-3.5 text-cyan-300" />
              Live status board
            </span>
          </div>
          <div className="mt-5 grid gap-3">
            {links.map((item) => (
              <div
                key={item.label}
                className="hover-float rounded-xl border border-slate-700/80 bg-gradient-to-r from-slate-900/70 via-slate-900/35 to-slate-900/70 p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  <span className={`rounded border px-2 py-0.5 text-xs ${badgeTone(Boolean(item.href))}`}>
                    {item.href ? 'Live' : 'Pending'}
                  </span>
                </div>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-100"
                  >
                    Open
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-xs text-slate-500">Pending configuration.</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4 text-xs text-cyan-100 sm:text-sm">
            Verified personas keep the community high-signal. Public read access stays open; write and participation
            access are gated and reviewable.
          </div>
        </div>

        <div className="premium-panel-strong p-6">
          <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">Request verified access</h2>
          <p className="mt-1 text-sm text-slate-300">
            Submit once. Request is queued for platform-admin review.
          </p>
          <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
            Required for posting, agent collaboration, and access to restricted ecosystem spaces.
          </div>
            <form className="mt-4 space-y-3" onSubmit={submitAccessRequest}>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/65 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              type="email"
              required
              placeholder="you@company.com"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/65 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              type="text"
              required
              minLength={2}
              maxLength={120}
              placeholder="Display name"
              value={form.display_name}
              onChange={(e) => setForm((prev) => ({ ...prev, display_name: e.target.value }))}
            />
            <textarea
              className="min-h-[130px] w-full rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/65 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
              required
              minLength={10}
              maxLength={2000}
              placeholder="Why you want access and what you want to build or learn."
              value={form.motivation}
              onChange={(e) => setForm((prev) => ({ ...prev, motivation: e.target.value }))}
            />
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-lg border border-cyan-300/45 bg-gradient-to-r from-cyan-500/30 to-sky-500/25 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:from-cyan-500/45 hover:to-sky-500/35 disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit request'}
              </button>
              {submitMessage ? <p className="text-sm text-emerald-300">{submitMessage}</p> : null}
              {submitError ? <p className="text-sm text-rose-300">{submitError}</p> : null}
            </form>
            <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/75 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Check request status</h3>
                  <p className="mt-1 text-xs text-slate-400">
                    Use the receipt returned after submission to track review state without contacting an operator.
                  </p>
                </div>
                {lookupResult ? (
                  <span className={`inline-flex rounded border px-2 py-0.5 text-xs ${feedStatusTone(lookupResult.status === 'approved' ? 'pass' : lookupResult.status === 'rejected' ? 'fail' : 'unknown')}`}>
                    {lookupResult.status.replace('_', ' ')}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/65 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
                  type="text"
                  placeholder="Community request receipt"
                  value={requestReceipt}
                  onChange={(e) => setRequestReceipt(e.target.value)}
                />
                <button
                  type="button"
                  onClick={lookupRequestStatus}
                  disabled={lookupLoading}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-600 bg-slate-900/80 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-cyan-400/45 hover:text-cyan-100 disabled:opacity-60"
                >
                  {lookupLoading ? 'Checking...' : 'Check status'}
                </button>
              </div>
              {lookupError ? <p className="mt-3 text-sm text-amber-300">{lookupError}</p> : null}
              {lookupResult ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Receipt</p>
                    <p className="mt-2 break-all text-sm text-slate-200">{lookupResult.request_id}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Last update</p>
                    <p className="mt-2 text-sm text-slate-200">{formatIsoDate(lookupResult.updated_at || lookupResult.created_at)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Review note</p>
                    <p className="mt-2 text-sm text-slate-200">{lookupResult.review_note_present ? 'present' : 'not published'}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
  );
}
