import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { randomUUID } from 'crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type CommunityStatus = {
  docs_url: string | null;
  discord_url: string | null;
  github_discussions_url: string | null;
  marketplace_url: string | null;
  policy: {
    access_mode: 'verified_persona_only' | 'open';
    persona_provider: string | null;
    persona_allowlist_configured: boolean;
    moderation_mode: 'strict' | 'standard';
    agent_post_policy: 'reviewed_only' | 'direct';
    security_baseline_signed: boolean;
  };
  readiness: {
    docs: boolean;
    discord: boolean;
    github_discussions: boolean;
    marketplace: boolean;
    verified_persona_provider: boolean;
    verified_persona_allowlist: boolean;
    moderation_guardrails: boolean;
    security_baseline: boolean;
  };
  completed: number;
  total: number;
};

type CommunityAccountsStatus = {
  backend: 'separate_db' | 'disabled';
  source: string;
  connected: boolean;
  stats: {
    total_accounts: number;
    verified_accounts: number;
    avg_reputation: number | null;
    high_reputation_count: number;
  };
  top_accounts: Array<{
    account_id: string;
    handle: string;
    reputation: number | null;
    verified: boolean;
    created_at: string | null;
  }>;
  warning: string | null;
};

type CommunityAccountRecord = {
  account_id: string;
  handle: string;
  email: string | null;
  reputation: number | null;
  verified: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type CommunityAccessRequestRecord = {
  request_id: string;
  email: string;
  display_name: string;
  motivation: string;
  status: 'pending_review' | 'approved' | 'rejected';
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type CommunityAccessRequestSubmitResult = {
  accepted: boolean;
  request_id: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'unavailable';
  message: string;
};

type PublicCommunityAccessRequestStatus = {
  request_id: string;
  status: 'pending_review' | 'approved' | 'rejected';
  updated_at: string | null;
  created_at: string | null;
  review_note_present: boolean;
};

type CommunityPersonaVerificationEvidence = {
  verified: boolean;
  reason: string;
  access_mode: 'verified_persona_only' | 'open';
  provider: string | null;
  email: string | null;
  identity_found: boolean;
  session_link_found: boolean;
  allowlist_required: boolean;
  allowlist_configured: boolean;
  allowlist_matched: boolean;
  matched_allowlist_entry: string | null;
  subject: string | null;
  user_id: string | null;
  organization_id: string | null;
};

type CommunityPersonaIdentityCandidate = {
  organization_id: string;
  user_id: string;
  provider: 'oidc' | 'saml';
  subject: string;
  email: string | null;
  groups: string[];
  has_unrevoked_session_link: boolean;
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
  provenance: {
    source_artifact: string;
    source_generated_at: string | null;
    source_run_id: string | null;
    head_sha: string | null;
  };
};

type QueryExecutor = {
  query: (text: string, values?: unknown[]) => Promise<any>;
};

type CommunityAccountConfig = {
  tableName: string;
  accountIdCol: string;
  handleCol: string;
  emailCol: string;
  reputationCol: string;
  verifiedCol: string;
  createdAtCol: string;
  updatedAtCol: string;
};

let cachedCommunityPool: pg.Pool | null = null;
let cachedCommunityPoolUrl = '';
const accessRequestRateLimit = new Map<string, number>();
let cachedPublicCommunityFeed: { expiresAt: number; data: PublicCommunityFeed } | null = null;
let cachedPublicCommunityLeaderboard: { expiresAt: number; data: PublicCommunityLeaderboard } | null = null;
let cachedPublicCommunityCapabilityProof: { expiresAt: number; data: PublicCommunityCapabilityProof } | null = null;

const PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS = 30_000;
const DOC_AGENT_STATUS_RELATIVE_PATH = path.join('docs', 'release', 'status', 'community-doc-agents-latest.json');
const ECOSYSTEM_STATUS_RELATIVE_PATH = path.join('docs', 'release', 'status', 'community-ecosystem-readiness-latest.json');
const CAPABILITY_PROOF_RELATIVE_PATH = path.join('docs', 'release', 'status', 'competitor-capability-proof-latest.json');
const COMMUNITY_POSTS_RELATIVE_DIR = path.join('docs', 'community', 'posts');

function normalizeHttpUrl(raw: string | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const externalTlsPort = String(process.env.SVEN_EXTERNAL_TLS_PORT || '44747').trim();
    const host = String(url.hostname || '').toLowerCase();
    const isManagedExternalHost =
      host.endsWith('.47matrix.online')
      || host === 'sven.systems'
      || host.endsWith('.sven.systems');
    const shouldForceExternalPort = url.protocol === 'https:'
      && isManagedExternalHost
      && (url.port === '' || url.port === '443');
    if (shouldForceExternalPort && /^[0-9]{2,5}$/.test(externalTlsPort)) {
      url.port = externalTlsPort;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeAccessMode(raw: string | undefined): 'verified_persona_only' | 'open' {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'open') return 'open';
  return 'verified_persona_only';
}

function normalizeModerationMode(raw: string | undefined): 'strict' | 'standard' {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'standard') return 'standard';
  return 'strict';
}

function normalizeAgentPostPolicy(raw: string | undefined): 'reviewed_only' | 'direct' {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'direct') return 'direct';
  return 'reviewed_only';
}

function isTruthy(raw: string | undefined): boolean {
  const value = String(raw || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return Math.floor(value);
}

function normalizeEmail(raw: string | undefined): string {
  return String(raw || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSchemaCompatError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code || '');
  return code === '42P01' || code === '42703';
}

function normalizePersonaProvider(raw: string | null | undefined): 'oidc' | 'saml' | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'oidc' || value === 'saml') return value;
  return null;
}

function parseStringList(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item || '').trim())
          .filter(Boolean);
      }
    } catch {
      // ignore malformed json in permissive parser
    }
    return [];
  }
  return [];
}

function parseCommunityPersonaAllowlist(raw: string | undefined): string[] {
  return parseStringList(raw).map((entry) => entry.toLowerCase());
}

function resolveAllowlistMatch(
  allowlist: string[],
  candidate: CommunityPersonaIdentityCandidate,
): string | null {
  const candidateEmail = normalizeEmail(candidate.email || '');
  const candidateDomain = candidateEmail.includes('@') ? candidateEmail.split('@')[1] : '';
  const candidateUserId = String(candidate.user_id || '').trim().toLowerCase();
  const candidateSubject = String(candidate.subject || '').trim().toLowerCase();
  const candidateGroups = candidate.groups.map((group) => String(group || '').trim().toLowerCase()).filter(Boolean);

  for (const rawEntry of allowlist) {
    const entry = String(rawEntry || '').trim().toLowerCase();
    if (!entry) continue;

    if (entry === '*') return entry;

    if (entry.startsWith('email:')) {
      const expectedEmail = normalizeEmail(entry.slice('email:'.length));
      if (expectedEmail && expectedEmail === candidateEmail) return entry;
      continue;
    }

    if (entry.startsWith('@')) {
      const expectedDomain = entry.slice(1).trim();
      if (expectedDomain && candidateDomain === expectedDomain) return entry;
      continue;
    }

    if (entry.startsWith('domain:')) {
      const expectedDomain = entry.slice('domain:'.length).trim();
      if (expectedDomain && candidateDomain === expectedDomain) return entry;
      continue;
    }

    if (entry.startsWith('user:') || entry.startsWith('user_id:')) {
      const expectedUserId = entry.includes(':') ? entry.split(':', 2)[1].trim() : '';
      if (expectedUserId && expectedUserId === candidateUserId) return entry;
      continue;
    }

    if (entry.startsWith('subject:')) {
      const expectedSubject = entry.slice('subject:'.length).trim();
      if (expectedSubject && expectedSubject === candidateSubject) return entry;
      continue;
    }

    if (entry.startsWith('group:')) {
      const expectedGroup = entry.slice('group:'.length).trim();
      if (expectedGroup && candidateGroups.includes(expectedGroup)) return entry;
      continue;
    }

    if (entry.includes('@')) {
      if (entry === candidateEmail) return entry;
      continue;
    }

    if (candidateDomain && entry === candidateDomain) return entry;
  }

  return null;
}

async function resolvePersonaIdentityCandidate(
  pool: pg.Pool,
  email: string,
  provider: 'oidc' | 'saml' | null,
): Promise<CommunityPersonaIdentityCandidate | null> {
  if (!email) return null;

  const values: unknown[] = [email];
  const providerFilter = provider
    ? (() => {
      values.push(provider);
      return `AND si.provider = $${values.length}`;
    })()
    : '';

  try {
    const res = await pool.query(
      `SELECT
         si.organization_id::text,
         si.user_id::text,
         si.provider::text,
         si.subject::text,
         si.email::text,
         si.groups AS groups_json,
         EXISTS(
           SELECT 1
           FROM sso_session_links ssl
           WHERE ssl.organization_id = si.organization_id
             AND ssl.user_id = si.user_id
             AND ssl.provider = si.provider
             AND ssl.subject = si.subject
             AND ssl.revoked_at IS NULL
         ) AS has_unrevoked_session_link
       FROM sso_identities si
       WHERE LOWER(COALESCE(si.email, '')) = $1
         ${providerFilter}
       ORDER BY COALESCE(si.last_login_at, si.updated_at, si.created_at) DESC
       LIMIT 1`,
      values,
    );

    const row = res.rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const normalizedProvider = normalizePersonaProvider(String(row.provider || '').trim());
    if (!normalizedProvider) return null;

    return {
      organization_id: String(row.organization_id || '').trim(),
      user_id: String(row.user_id || '').trim(),
      provider: normalizedProvider,
      subject: String(row.subject || '').trim(),
      email: row.email ? normalizeEmail(String(row.email)) : null,
      groups: parseJsonStringArray(row.groups_json),
      has_unrevoked_session_link: Boolean(row.has_unrevoked_session_link),
    };
  } catch (error) {
    if (isSchemaCompatError(error)) return null;
    throw error;
  }
}

export async function resolvePersonaVerificationEvidence(
  pool: pg.Pool,
  emailInput: string,
): Promise<CommunityPersonaVerificationEvidence> {
  const status = resolveCommunityStatus();
  const accessMode = status.policy.access_mode;
  const provider = normalizePersonaProvider(status.policy.persona_provider);
  const email = normalizeEmail(emailInput);
  const allowlist = parseCommunityPersonaAllowlist(process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST);
  const allowlistRequired = accessMode === 'verified_persona_only';
  const allowlistConfigured = allowlist.length > 0;

  if (!email || !isValidEmail(email)) {
    return {
      verified: false,
      reason: 'invalid_email',
      access_mode: accessMode,
      provider,
      email: email || null,
      identity_found: false,
      session_link_found: false,
      allowlist_required: allowlistRequired,
      allowlist_configured: allowlistConfigured,
      allowlist_matched: false,
      matched_allowlist_entry: null,
      subject: null,
      user_id: null,
      organization_id: null,
    };
  }

  if (accessMode === 'verified_persona_only' && !provider) {
    return {
      verified: false,
      reason: 'persona_provider_missing',
      access_mode: accessMode,
      provider,
      email,
      identity_found: false,
      session_link_found: false,
      allowlist_required: allowlistRequired,
      allowlist_configured: allowlistConfigured,
      allowlist_matched: false,
      matched_allowlist_entry: null,
      subject: null,
      user_id: null,
      organization_id: null,
    };
  }

  if (allowlistRequired && !allowlistConfigured) {
    return {
      verified: false,
      reason: 'allowlist_missing',
      access_mode: accessMode,
      provider,
      email,
      identity_found: false,
      session_link_found: false,
      allowlist_required: allowlistRequired,
      allowlist_configured: false,
      allowlist_matched: false,
      matched_allowlist_entry: null,
      subject: null,
      user_id: null,
      organization_id: null,
    };
  }

  const candidate = await resolvePersonaIdentityCandidate(pool, email, provider);
  if (!candidate) {
    return {
      verified: false,
      reason: 'identity_not_found',
      access_mode: accessMode,
      provider,
      email,
      identity_found: false,
      session_link_found: false,
      allowlist_required: allowlistRequired,
      allowlist_configured: allowlistConfigured,
      allowlist_matched: false,
      matched_allowlist_entry: null,
      subject: null,
      user_id: null,
      organization_id: null,
    };
  }

  const matchedAllowlistEntry = allowlistConfigured ? resolveAllowlistMatch(allowlist, candidate) : null;
  const allowlistMatched = allowlistConfigured ? Boolean(matchedAllowlistEntry) : !allowlistRequired;
  const verified = allowlistMatched;
  const reason = verified
    ? 'persona_evidence_verified'
    : allowlistConfigured
      ? 'allowlist_mismatch'
      : 'allowlist_required';

  return {
    verified,
    reason,
    access_mode: accessMode,
    provider: candidate.provider,
    email,
    identity_found: true,
    session_link_found: candidate.has_unrevoked_session_link,
    allowlist_required: allowlistRequired,
    allowlist_configured: allowlistConfigured,
    allowlist_matched: allowlistMatched,
    matched_allowlist_entry: matchedAllowlistEntry,
    subject: candidate.subject || null,
    user_id: candidate.user_id || null,
    organization_id: candidate.organization_id || null,
  };
}

function consumeAccessRequestQuota(ip: string): boolean {
  const now = Date.now();
  const key = String(ip || '').trim() || 'unknown';
  const windowMs = 60_000;
  const last = accessRequestRateLimit.get(key) || 0;
  if (now - last < windowMs) return false;
  accessRequestRateLimit.set(key, now);

  if (accessRequestRateLimit.size > 5000) {
    for (const [k, ts] of accessRequestRateLimit.entries()) {
      if (now - ts > windowMs * 10) accessRequestRateLimit.delete(k);
    }
  }
  return true;
}

function sanitizeIdentifier(name: string | undefined, fallback: string): string {
  const value = String(name || '').trim() || fallback;
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) return fallback;
  return value;
}

function sanitizeHandle(raw: string): string {
  const normalized = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return 'member';
  if (normalized.length >= 3) return normalized.slice(0, 28);
  return `${normalized}_member`.slice(0, 28);
}

function resolveCommunityAccountConfig(): CommunityAccountConfig {
  return {
    tableName: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_TABLE, 'community_accounts'),
    accountIdCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_ACCOUNT_ID_COL, 'account_id'),
    handleCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_HANDLE_COL, 'handle'),
    emailCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_EMAIL_COL, 'email'),
    reputationCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_REPUTATION_COL, 'reputation'),
    verifiedCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_VERIFIED_COL, 'verified'),
    createdAtCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_CREATED_AT_COL, 'created_at'),
    updatedAtCol: sanitizeIdentifier(process.env.COMMUNITY_ACCOUNTS_UPDATED_AT_COL, 'updated_at'),
  };
}

function normalizeFeedStatus(raw: unknown): 'pass' | 'fail' | 'unknown' {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'pass') return 'pass';
  if (value === 'fail') return 'fail';
  return 'unknown';
}

function toNumber(raw: unknown, fallback = 0): number {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function resolveRepoRootCandidates(): string[] {
  const envCandidates = [
    process.env.SVEN_COMMUNITY_FEED_ROOT,
    process.env.SVEN_WORKSPACE_ROOT,
    process.env.SVEN_REPO_ROOT,
    process.env.SVEN_PROJECT_ROOT,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const cwd = process.cwd();
  const candidates = [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    ...envCandidates,
  ];

  const unique = new Set<string>();
  const normalized: string[] = [];
  for (const candidate of candidates) {
    const abs = path.resolve(candidate);
    if (unique.has(abs)) continue;
    unique.add(abs);
    normalized.push(abs);
  }
  return normalized;
}

async function readRepoFileUtf8(relativePath: string): Promise<{ content: string; absolutePath: string } | null> {
  const roots = resolveRepoRootCandidates();
  for (const root of roots) {
    const target = path.join(root, relativePath);
    try {
      const content = await fs.readFile(target, 'utf8');
      return { content, absolutePath: target };
    } catch {
      // continue
    }
  }
  return null;
}

async function readRepoJson(relativePath: string): Promise<{ data: any; absolutePath: string } | null> {
  const loaded = await readRepoFileUtf8(relativePath);
  if (!loaded) return null;
  try {
    return {
      data: JSON.parse(loaded.content),
      absolutePath: loaded.absolutePath,
    };
  } catch {
    return null;
  }
}

async function resolveRepoDirectory(relativePath: string): Promise<string | null> {
  const roots = resolveRepoRootCandidates();
  for (const root of roots) {
    const target = path.join(root, relativePath);
    try {
      const st = await fs.stat(target);
      if (st.isDirectory()) return target;
    } catch {
      // continue
    }
  }
  return null;
}

function inferSummaryFromMarkdown(markdown: string): string {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith('#')) continue;
    if (line.startsWith('Generated:')) continue;
    if (line.startsWith('Verification status:')) continue;
    if (line.startsWith('Status:')) continue;
    if (line.startsWith('##')) continue;
    if (line.startsWith('- ')) continue;
    return line;
  }
  return 'Automated Sven community intelligence update.';
}

function parseMarkdownChecks(markdown: string): CommunityFeedCheck[] {
  const lines = markdown.split(/\r?\n/);
  const checks: CommunityFeedCheck[] = [];
  let inChecks = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!inChecks) {
      if (/^##\s+Checks\b/i.test(line)) inChecks = true;
      continue;
    }
    if (/^##\s+/.test(line)) break;
    if (!line.startsWith('- ')) continue;

    const match = line.match(/^- ([^:]+): (pass|fail)(?: \((optional)\))?(?: \| (.+))?$/i);
    if (match) {
      checks.push({
        id: String(match[1] || '').trim(),
        pass: String(match[2] || '').toLowerCase() === 'pass',
        required: !String(match[3] || '').trim(),
        detail: String(match[4] || '').trim(),
      });
      continue;
    }

    checks.push({
      id: line.slice(2, 80),
      pass: true,
      required: false,
      detail: '',
    });
  }

  return checks.slice(0, 6);
}

function parseDocAgentPostMarkdown(markdown: string, sourcePath: string): CommunityFeedPost {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const generatedMatch = markdown.match(/^Generated:\s*(.+)$/m);
  const statusMatch = markdown.match(/^(?:Verification status|Status):\s*(pass|fail|unknown)\b/im);
  const checks = parseMarkdownChecks(markdown);
  const id = path.basename(sourcePath).replace(/\.md$/i, '');
  return {
    id,
    title: String(titleMatch?.[1] || 'Sven Community Update').trim(),
    generated_at: generatedMatch?.[1] ? String(generatedMatch[1]).trim() : null,
    verification_status: normalizeFeedStatus(statusMatch?.[1] || ''),
    summary: inferSummaryFromMarkdown(markdown),
    checks,
    source_path: sourcePath.replace(/\\/g, '/'),
  };
}

async function resolveDocAgentPosts(limit: number): Promise<CommunityFeedPost[]> {
  const dir = await resolveRepoDirectory(COMMUNITY_POSTS_RELATIVE_DIR);
  if (!dir) return [];

  let entries: string[] = [];
  try {
    entries = (await fs.readdir(dir))
      .filter((name) => /^community-doc-agent-post-.*\.md$/i.test(name))
      .sort((a, b) => b.localeCompare(a));
  } catch {
    return [];
  }

  const posts: CommunityFeedPost[] = [];
  for (const fileName of entries.slice(0, Math.max(1, limit))) {
    const fullPath = path.join(dir, fileName);
    try {
      const markdown = await fs.readFile(fullPath, 'utf8');
      posts.push(
        parseDocAgentPostMarkdown(markdown, path.join('docs', 'community', 'posts', fileName)),
      );
    } catch {
      // skip unreadable file
    }
  }
  return posts;
}

function resolveCommunityPublicUrl(): string | null {
  const raw = String(
    process.env.SVEN_COMMUNITY_URL
    || process.env.SVEN_PUBLIC_COMMUNITY_URL
    || process.env.PUBLIC_BASE_URL
    || '',
  ).trim();
  if (!raw) return null;
  const normalized = normalizeHttpUrl(raw);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    if (!/\/community\/?$/i.test(url.pathname)) {
      url.pathname = `${url.pathname.replace(/\/+$/, '')}/community`;
    }
    return url.toString();
  } catch {
    return normalized;
  }
}

async function resolvePublicCommunityFeed(status: CommunityStatus): Promise<PublicCommunityFeed> {
  const now = Date.now();
  if (cachedPublicCommunityFeed && cachedPublicCommunityFeed.expiresAt > now) {
    return cachedPublicCommunityFeed.data;
  }

  const docAgentJson = await readRepoJson(DOC_AGENT_STATUS_RELATIVE_PATH);
  const ecosystemJson = await readRepoJson(ECOSYSTEM_STATUS_RELATIVE_PATH);
  const posts = await resolveDocAgentPosts(6);

  const docAgentStatus = normalizeFeedStatus(docAgentJson?.data?.status);
  const ecosystemStatus = normalizeFeedStatus(ecosystemJson?.data?.status);
  const readinessPercent = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;
  const requiredFailures = Number(docAgentJson?.data?.required_failure_count || 0);

  const checks: CommunityFeedCheck[] = Array.isArray(docAgentJson?.data?.checks)
    ? docAgentJson!.data.checks.slice(0, 10).map((check: any) => ({
      id: String(check?.id || 'unknown_check'),
      pass: Boolean(check?.pass),
      required: check?.required !== false,
      detail: String(check?.detail || '').trim(),
    }))
    : [];

  const highlights: CommunityFeedHighlight[] = [
    {
      id: 'doc_agents_status',
      label: 'Doc-Agent Verification',
      pass: docAgentStatus === 'pass',
      detail: docAgentJson?.data?.generated_at
        ? `status=${docAgentStatus}; updated=${String(docAgentJson.data.generated_at)}`
        : `status=${docAgentStatus}`,
    },
    {
      id: 'ecosystem_readiness',
      label: 'Community Ecosystem Readiness',
      pass: ecosystemStatus === 'pass',
      detail: ecosystemJson?.data?.generated_at
        ? `status=${ecosystemStatus}; updated=${String(ecosystemJson.data.generated_at)}`
        : `status=${ecosystemStatus}`,
    },
    {
      id: 'public_policy_posture',
      label: 'Policy Guardrails',
      pass: status.policy.access_mode === 'verified_persona_only'
        && status.policy.moderation_mode === 'strict'
        && status.policy.agent_post_policy === 'reviewed_only',
      detail: `access=${status.policy.access_mode}; moderation=${status.policy.moderation_mode}; posts=${status.policy.agent_post_policy}`,
    },
    {
      id: 'public_readiness_percent',
      label: 'Public Readiness',
      pass: readinessPercent >= 80,
      detail: `${status.completed}/${status.total} (${readinessPercent}%)`,
    },
  ];

  const overallStatus: 'pass' | 'fail' | 'unknown' = (() => {
    if (docAgentStatus === 'fail' || ecosystemStatus === 'fail') return 'fail';
    if (docAgentStatus === 'pass' && ecosystemStatus === 'pass') return 'pass';
    return 'unknown';
  })();

  const feed: PublicCommunityFeed = {
    generated_at: new Date().toISOString(),
    status: overallStatus,
    community_url: resolveCommunityPublicUrl(),
    telemetry: {
      readiness_completed: status.completed,
      readiness_total: status.total,
      readiness_percent: readinessPercent,
      doc_agents_status: docAgentStatus,
      ecosystem_status: ecosystemStatus,
      required_failures: Number.isFinite(requiredFailures) ? requiredFailures : 0,
    },
    highlights,
    checks,
    posts,
  };

  cachedPublicCommunityFeed = {
    expiresAt: now + PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS,
    data: feed,
  };

  return feed;
}

async function resolvePublicCommunityCapabilityProof(): Promise<PublicCommunityCapabilityProof> {
  const now = Date.now();
  if (cachedPublicCommunityCapabilityProof && cachedPublicCommunityCapabilityProof.expiresAt > now) {
    return cachedPublicCommunityCapabilityProof.data;
  }

  const source = await readRepoJson(CAPABILITY_PROOF_RELATIVE_PATH);
  const sourceData = source?.data || {};
  const summary = sourceData.summary || {};
  const totalRows = Math.max(0, toNumber(summary.total_rows, 0));
  const provenRows = Math.max(0, toNumber(summary.proven_pass_rows, 0));
  const partialRows = Math.max(0, toNumber(summary.partial_rows, 0));
  const unprovenRows = Math.max(0, toNumber(summary.unproven_rows, 0));
  const coveragePercent = totalRows > 0 ? Math.round((provenRows / totalRows) * 1000) / 10 : 0;

  const competitors = Object.entries(sourceData.competitors || {}).map(([id, item]: [string, any]) => ({
    id: String(id || '').trim(),
    total_rows: Math.max(0, toNumber(item?.total_rows, 0)),
    proven_pass_rows: Math.max(0, toNumber(item?.proven_pass_rows, 0)),
    partial_rows: Math.max(0, toNumber(item?.partial_rows, 0)),
    unproven_rows: Math.max(0, toNumber(item?.unproven_rows, 0)),
  }));

  const waves = Array.isArray(sourceData.waves)
    ? sourceData.waves.slice(0, 16).map((wave: any) => ({
      wave: String(wave?.wave || '').trim(),
      competitor: String(wave?.competitor || '').trim(),
      status: normalizeFeedStatus(wave?.status),
      generated_at: wave?.generated_at ? String(wave.generated_at) : null,
    }))
    : [];

  const unresolvedRows: PublicCommunityCapabilityProof['unresolved_rows'] = [];
  if (sourceData.unresolved_rows && typeof sourceData.unresolved_rows === 'object') {
    for (const [competitor, rows] of Object.entries(sourceData.unresolved_rows)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows.slice(0, 40)) {
        unresolvedRows.push({
          competitor: String(competitor || '').trim(),
          feature_id: String((row as any)?.feature_id || '').trim(),
          classification: String((row as any)?.classification || '').trim() || 'unknown',
          reason: String((row as any)?.reason || '').trim(),
        });
      }
    }
  }

  const payload: PublicCommunityCapabilityProof = {
    generated_at: new Date().toISOString(),
    status: normalizeFeedStatus(sourceData.status),
    claim_100_percent_parity: Boolean(sourceData?.summary?.claim_100_percent_parity),
    summary: {
      total_rows: totalRows,
      proven_pass_rows: provenRows,
      partial_rows: partialRows,
      unproven_rows: unprovenRows,
      coverage_percent: coveragePercent,
    },
    competitors,
    waves,
    unresolved_rows: unresolvedRows,
    provenance: {
      source_artifact: CAPABILITY_PROOF_RELATIVE_PATH.replace(/\\/g, '/'),
      source_generated_at: sourceData?.generated_at ? String(sourceData.generated_at) : null,
      source_run_id: sourceData?.provenance?.source_run_id ? String(sourceData.provenance.source_run_id) : null,
      head_sha: sourceData?.provenance?.head_sha ? String(sourceData.provenance.head_sha) : null,
    },
  };

  cachedPublicCommunityCapabilityProof = {
    expiresAt: now + PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS,
    data: payload,
  };

  return payload;
}

function getCommunityDbPool(): pg.Pool | null {
  const url = String(process.env.COMMUNITY_DATABASE_URL || '').trim();
  if (!url) return null;
  if (cachedCommunityPool && cachedCommunityPoolUrl === url) return cachedCommunityPool;
  cachedCommunityPoolUrl = url;
  cachedCommunityPool = new pg.Pool({
    connectionString: url,
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 4_000,
  });
  return cachedCommunityPool;
}

async function resolvePublicCommunityLeaderboard(): Promise<PublicCommunityLeaderboard> {
  const now = Date.now();
  if (cachedPublicCommunityLeaderboard && cachedPublicCommunityLeaderboard.expiresAt > now) {
    return cachedPublicCommunityLeaderboard.data;
  }

  const pool = getCommunityDbPool();
  if (!pool) {
    const disabled: PublicCommunityLeaderboard = {
      generated_at: new Date().toISOString(),
      status: 'unknown',
      source: 'COMMUNITY_DATABASE_URL not configured',
      accounts: [],
      warning: 'Community accounts backend is not configured yet',
    };
    cachedPublicCommunityLeaderboard = {
      expiresAt: now + PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS,
      data: disabled,
    };
    return disabled;
  }

  const config = resolveCommunityAccountConfig();
  try {
    await ensureCommunityAccountsTable(pool, config);
    const limit = clamp(Number(process.env.SVEN_COMMUNITY_LEADERBOARD_LIMIT || 20), 1, 100);
    const res = await pool.query(
      `SELECT
         ${config.accountIdCol}::text AS account_id,
         ${config.handleCol}::text AS handle,
         ${config.reputationCol}::float AS reputation,
         COALESCE(${config.verifiedCol}, FALSE) AS verified,
         ${config.createdAtCol}::text AS created_at
       FROM ${config.tableName}
       ORDER BY COALESCE(${config.verifiedCol}, FALSE) DESC,
                COALESCE(${config.reputationCol}, 0) DESC,
                ${config.createdAtCol} ASC
       LIMIT $1`,
      [limit],
    );

    const payload: PublicCommunityLeaderboard = {
      generated_at: new Date().toISOString(),
      status: 'pass',
      source: config.tableName,
      accounts: res.rows.map((row: any) => ({
        account_id: String(row.account_id || ''),
        handle: String(row.handle || ''),
        reputation: row.reputation === null || row.reputation === undefined ? null : Number(row.reputation),
        verified: Boolean(row.verified),
        created_at: row.created_at ? String(row.created_at) : null,
      })),
      warning: null,
    };

    cachedPublicCommunityLeaderboard = {
      expiresAt: now + PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS,
      data: payload,
    };
    return payload;
  } catch (error: any) {
    const failure: PublicCommunityLeaderboard = {
      generated_at: new Date().toISOString(),
      status: 'fail',
      source: config.tableName,
      accounts: [],
      warning: `leaderboard unavailable: ${String(error?.message || 'unknown error')}`,
    };
    cachedPublicCommunityLeaderboard = {
      expiresAt: now + PUBLIC_COMMUNITY_FEED_CACHE_TTL_MS,
      data: failure,
    };
    return failure;
  }
}

async function listCommunityAccounts(params: {
  limit: number;
  verified?: boolean;
  query?: string;
}): Promise<{ source: string; rows: CommunityAccountRecord[]; warning: string | null }> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      source: 'COMMUNITY_DATABASE_URL not configured',
      rows: [],
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community accounts management',
    };
  }

  const config = resolveCommunityAccountConfig();
  await ensureCommunityAccountsTable(pool, config);

  const values: unknown[] = [];
  const filters: string[] = [];

  if (typeof params.verified === 'boolean') {
    values.push(params.verified);
    filters.push(`${config.verifiedCol} = $${values.length}`);
  }

  const queryText = String(params.query || '').trim().toLowerCase();
  if (queryText) {
    values.push(`%${queryText}%`);
    filters.push(`(LOWER(${config.handleCol}::text) LIKE $${values.length} OR LOWER(COALESCE(${config.emailCol}::text, '')) LIKE $${values.length})`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  values.push(params.limit);

  const res = await pool.query(
    `SELECT
       ${config.accountIdCol}::text AS account_id,
       ${config.handleCol}::text AS handle,
       ${config.emailCol}::text AS email,
       ${config.reputationCol}::float AS reputation,
       COALESCE(${config.verifiedCol}, FALSE) AS verified,
       ${config.createdAtCol}::text AS created_at,
       ${config.updatedAtCol}::text AS updated_at
     FROM ${config.tableName}
     ${whereClause}
     ORDER BY COALESCE(${config.verifiedCol}, FALSE) DESC,
              COALESCE(${config.reputationCol}, 0) DESC,
              ${config.createdAtCol} ASC
     LIMIT $${values.length}`,
    values,
  );

  return {
    source: config.tableName,
    rows: res.rows.map((row: any) => ({
      account_id: String(row.account_id || ''),
      handle: String(row.handle || ''),
      email: row.email ? String(row.email) : null,
      reputation: row.reputation === null || row.reputation === undefined ? null : Number(row.reputation),
      verified: Boolean(row.verified),
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    })),
    warning: null,
  };
}

async function updateCommunityAccount(
  accountId: string,
  patch: { reputation?: number; verified?: boolean },
): Promise<{
  ok: boolean;
  source: string;
  warning: string | null;
  row: CommunityAccountRecord | null;
}> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      ok: false,
      source: 'COMMUNITY_DATABASE_URL not configured',
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community accounts management',
      row: null,
    };
  }

  const config = resolveCommunityAccountConfig();
  await ensureCommunityAccountsTable(pool, config);

  const values: unknown[] = [accountId];
  const updates: string[] = [];

  if (typeof patch.reputation === 'number' && Number.isFinite(patch.reputation)) {
    const normalized = Math.max(-1000, Math.min(100000, patch.reputation));
    values.push(normalized);
    updates.push(`${config.reputationCol} = $${values.length}`);
  }

  if (typeof patch.verified === 'boolean') {
    values.push(patch.verified);
    updates.push(`${config.verifiedCol} = $${values.length}`);
  }

  if (updates.length === 0) {
    return {
      ok: false,
      source: config.tableName,
      warning: 'no fields to update',
      row: null,
    };
  }

  updates.push(`${config.updatedAtCol} = now()`);

  const res = await pool.query(
    `UPDATE ${config.tableName}
     SET ${updates.join(', ')}
     WHERE ${config.accountIdCol} = $1
     RETURNING
       ${config.accountIdCol}::text AS account_id,
       ${config.handleCol}::text AS handle,
       ${config.emailCol}::text AS email,
       ${config.reputationCol}::float AS reputation,
       COALESCE(${config.verifiedCol}, FALSE) AS verified,
       ${config.createdAtCol}::text AS created_at,
       ${config.updatedAtCol}::text AS updated_at`,
    values,
  );

  const row = res.rows?.[0];
  if (!row) {
    return {
      ok: false,
      source: config.tableName,
      warning: 'account not found',
      row: null,
    };
  }

  cachedPublicCommunityLeaderboard = null;

  return {
    ok: true,
    source: config.tableName,
    warning: null,
    row: {
      account_id: String(row.account_id || ''),
      handle: String(row.handle || ''),
      email: row.email ? String(row.email) : null,
      reputation: row.reputation === null || row.reputation === undefined ? null : Number(row.reputation),
      verified: Boolean(row.verified),
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    },
  };
}

async function ensureCommunityAccessRequestsTable(executor: QueryExecutor, tableName: string): Promise<void> {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS ${tableName} (
      request_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      motivation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_review',
      review_note TEXT,
      source_ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );
  await executor.query(
    `CREATE INDEX IF NOT EXISTS idx_${tableName}_status_updated
     ON ${tableName} (status, updated_at DESC)`,
  );
}

async function ensureCommunityAccountsTable(
  executor: QueryExecutor,
  config: CommunityAccountConfig,
): Promise<void> {
  await executor.query(
    `CREATE TABLE IF NOT EXISTS ${config.tableName} (
      ${config.accountIdCol} TEXT PRIMARY KEY,
      ${config.handleCol} TEXT NOT NULL UNIQUE,
      ${config.emailCol} TEXT,
      ${config.reputationCol} NUMERIC NOT NULL DEFAULT 0,
      ${config.verifiedCol} BOOLEAN NOT NULL DEFAULT FALSE,
      ${config.createdAtCol} TIMESTAMPTZ NOT NULL DEFAULT now(),
      ${config.updatedAtCol} TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  );

  await executor.query(`ALTER TABLE ${config.tableName} ADD COLUMN IF NOT EXISTS ${config.emailCol} TEXT`);
  await executor.query(`ALTER TABLE ${config.tableName} ADD COLUMN IF NOT EXISTS ${config.updatedAtCol} TIMESTAMPTZ NOT NULL DEFAULT now()`);
  await executor.query(`ALTER TABLE ${config.tableName} ADD COLUMN IF NOT EXISTS ${config.reputationCol} NUMERIC NOT NULL DEFAULT 0`);
  await executor.query(`ALTER TABLE ${config.tableName} ADD COLUMN IF NOT EXISTS ${config.verifiedCol} BOOLEAN NOT NULL DEFAULT FALSE`);
  await executor.query(`ALTER TABLE ${config.tableName} ADD COLUMN IF NOT EXISTS ${config.createdAtCol} TIMESTAMPTZ NOT NULL DEFAULT now()`);

  const repIdx = sanitizeIdentifier(`idx_${config.tableName}_reputation`, 'idx_community_accounts_reputation').slice(0, 63);
  const verifiedIdx = sanitizeIdentifier(`idx_${config.tableName}_verified_rep`, 'idx_community_accounts_verified_rep').slice(0, 63);
  await executor.query(
    `CREATE INDEX IF NOT EXISTS ${repIdx}
     ON ${config.tableName} (${config.reputationCol} DESC)`,
  );
  await executor.query(
    `CREATE INDEX IF NOT EXISTS ${verifiedIdx}
     ON ${config.tableName} (${config.verifiedCol}, ${config.reputationCol} DESC)`,
  );
}

function deriveCommunityAccountHandle(displayName: string, email: string, requestId: string): string {
  const emailLocal = String(email || '').split('@')[0] || '';
  const base = sanitizeHandle(displayName || emailLocal || 'member');
  const suffix = sanitizeHandle(requestId).slice(-6) || '000000';
  return `${base}_${suffix}`.slice(0, 32);
}

async function upsertApprovedCommunityAccount(
  executor: QueryExecutor,
  config: CommunityAccountConfig,
  record: { request_id: string; email: string; display_name: string; verified: boolean },
): Promise<{ account_id: string; handle: string }> {
  const accountIdSeed = sanitizeHandle(record.request_id).replace(/_/g, '');
  const accountId = `acct_${accountIdSeed || randomUUID().replace(/-/g, '').slice(0, 24)}`.slice(0, 48);
  let handle = deriveCommunityAccountHandle(record.display_name, record.email, record.request_id);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await executor.query(
        `INSERT INTO ${config.tableName} (
          ${config.accountIdCol},
          ${config.handleCol},
          ${config.emailCol},
          ${config.reputationCol},
          ${config.verifiedCol},
          ${config.createdAtCol},
          ${config.updatedAtCol}
        ) VALUES ($1, $2, $3, $4, $5, now(), now())
        ON CONFLICT (${config.accountIdCol}) DO UPDATE SET
          ${config.handleCol} = EXCLUDED.${config.handleCol},
          ${config.emailCol} = EXCLUDED.${config.emailCol},
          ${config.verifiedCol} = EXCLUDED.${config.verifiedCol},
          ${config.updatedAtCol} = now()
        RETURNING ${config.accountIdCol}::text AS account_id, ${config.handleCol}::text AS handle`,
        [accountId, handle, record.email, 0, record.verified],
      );
      return {
        account_id: String(res.rows?.[0]?.account_id || accountId),
        handle: String(res.rows?.[0]?.handle || handle),
      };
    } catch (error: any) {
      if (String(error?.code || '') !== '23505' || attempt >= 2) {
        throw error;
      }
      handle = `${handle.slice(0, 24)}_${Math.floor(Math.random() * 9000 + 1000)}`.slice(0, 32);
    }
  }

  return { account_id: accountId, handle };
}

async function submitCommunityAccessRequest(
  input: { email: string; display_name: string; motivation: string; source_ip: string },
): Promise<CommunityAccessRequestSubmitResult> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      accepted: false,
      request_id: null,
      status: 'unavailable',
      message: 'Community onboarding is temporarily unavailable',
    };
  }

  const tableName = sanitizeIdentifier(
    process.env.COMMUNITY_ACCESS_REQUESTS_TABLE,
    'community_access_requests',
  );
  await ensureCommunityAccessRequestsTable(pool, tableName);

  const res = await pool.query(
    `INSERT INTO ${tableName} (
      request_id, email, display_name, motivation, status, source_ip, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, 'pending_review', $5, now(), now())
    ON CONFLICT (email) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      motivation = EXCLUDED.motivation,
      source_ip = EXCLUDED.source_ip,
      status = 'pending_review',
      updated_at = now()
    RETURNING request_id, status`,
    [randomUUID(), input.email, input.display_name, input.motivation, input.source_ip],
  );

  const row = res.rows[0] as { request_id?: string; status?: string } | undefined;
  return {
    accepted: true,
    request_id: String(row?.request_id || ''),
    status: row?.status === 'approved' || row?.status === 'rejected' ? row.status : 'pending_review',
    message: 'Request submitted for review',
  };
}

async function listCommunityAccessRequests(
  params: { limit: number; status?: string },
): Promise<{ source: string; rows: CommunityAccessRequestRecord[]; warning: string | null }> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      source: 'COMMUNITY_DATABASE_URL not configured',
      rows: [],
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community onboarding tracking',
    };
  }

  const tableName = sanitizeIdentifier(
    process.env.COMMUNITY_ACCESS_REQUESTS_TABLE,
    'community_access_requests',
  );
  await ensureCommunityAccessRequestsTable(pool, tableName);

  const filters: string[] = [];
  const values: unknown[] = [];
  if (params.status && ['pending_review', 'approved', 'rejected'].includes(params.status)) {
    values.push(params.status);
    filters.push(`status = $${values.length}`);
  }
  values.push(params.limit);
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT
      request_id::text,
      email::text,
      display_name::text,
      motivation::text,
      status::text,
      review_note::text,
      created_at::text,
      updated_at::text
     FROM ${tableName}
     ${whereClause}
     ORDER BY updated_at DESC
     LIMIT $${values.length}`,
    values,
  );

  return {
    source: tableName,
    rows: res.rows.map((row: any) => ({
      request_id: String(row.request_id || ''),
      email: String(row.email || ''),
      display_name: String(row.display_name || ''),
      motivation: String(row.motivation || ''),
      status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending_review',
      review_note: row.review_note ? String(row.review_note) : null,
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
    })),
    warning: null,
  };
}

async function getPublicCommunityAccessRequestStatus(
  requestId: string,
): Promise<{ ok: boolean; source: string; row: PublicCommunityAccessRequestStatus | null; warning: string | null }> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      ok: false,
      source: 'COMMUNITY_DATABASE_URL not configured',
      row: null,
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community onboarding tracking',
    };
  }

  const tableName = sanitizeIdentifier(
    process.env.COMMUNITY_ACCESS_REQUESTS_TABLE,
    'community_access_requests',
  );
  await ensureCommunityAccessRequestsTable(pool, tableName);

  const res = await pool.query(
    `SELECT
      request_id::text,
      status::text,
      created_at::text,
      updated_at::text,
      review_note::text
     FROM ${tableName}
     WHERE request_id = $1
     LIMIT 1`,
    [requestId],
  );

  const row = res.rows?.[0] as {
    request_id?: string;
    status?: string;
    created_at?: string | null;
    updated_at?: string | null;
    review_note?: string | null;
  } | undefined;

  if (!row) {
    return {
      ok: false,
      source: tableName,
      row: null,
      warning: 'request not found',
    };
  }

  return {
    ok: true,
    source: tableName,
    row: {
      request_id: String(row.request_id || ''),
      status: row.status === 'approved' || row.status === 'rejected' ? row.status : 'pending_review',
      created_at: row.created_at ? String(row.created_at) : null,
      updated_at: row.updated_at ? String(row.updated_at) : null,
      review_note_present: Boolean(String(row.review_note || '').trim()),
    },
    warning: null,
  };
}

async function resolveCommunityAccessRequest(
  requestId: string,
  nextStatus: 'approved' | 'rejected',
  reviewNote: string | null,
  identityPool: pg.Pool | null,
): Promise<{
  ok: boolean;
  source: string;
  warning: string | null;
  account_provisioned: boolean;
  provisioned_account_id: string | null;
  account_verified: boolean;
  verification_evidence: CommunityPersonaVerificationEvidence | null;
}> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      ok: false,
      source: 'COMMUNITY_DATABASE_URL not configured',
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community onboarding tracking',
      account_provisioned: false,
      provisioned_account_id: null,
      account_verified: false,
      verification_evidence: null,
    };
  }

  const tableName = sanitizeIdentifier(
    process.env.COMMUNITY_ACCESS_REQUESTS_TABLE,
    'community_access_requests',
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureCommunityAccessRequestsTable(client, tableName);

    const current = await client.query(
      `SELECT request_id::text, email::text, display_name::text
       FROM ${tableName}
       WHERE request_id = $1
       FOR UPDATE`,
      [requestId],
    );

    const currentRow = current.rows?.[0] as { request_id?: string; email?: string; display_name?: string } | undefined;
    if (!currentRow) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        source: tableName,
        warning: 'request not found',
        account_provisioned: false,
        provisioned_account_id: null,
        account_verified: false,
        verification_evidence: null,
      };
    }

    await client.query(
      `UPDATE ${tableName}
       SET status = $2,
           review_note = $3,
           updated_at = now()
       WHERE request_id = $1`,
      [requestId, nextStatus, reviewNote],
    );

    let accountProvisioned = false;
    let provisionedAccountId: string | null = null;
    let accountVerified = false;
    let verificationEvidence: CommunityPersonaVerificationEvidence | null = null;

    if (nextStatus === 'approved') {
      const accountConfig = resolveCommunityAccountConfig();
      await ensureCommunityAccountsTable(client, accountConfig);
      const normalizedAccessEmail = normalizeEmail(String(currentRow.email || ''));
      const statusPolicy = resolveCommunityStatus().policy;
      const fallbackEvidence = (reason: string): CommunityPersonaVerificationEvidence => ({
        verified: false,
        reason,
        access_mode: statusPolicy.access_mode,
        provider: normalizePersonaProvider(statusPolicy.persona_provider),
        email: normalizedAccessEmail || null,
        identity_found: false,
        session_link_found: false,
        allowlist_required: statusPolicy.access_mode === 'verified_persona_only',
        allowlist_configured: parseCommunityPersonaAllowlist(process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST).length > 0,
        allowlist_matched: false,
        matched_allowlist_entry: null,
        subject: null,
        user_id: null,
        organization_id: null,
      });

      if (!identityPool) {
        verificationEvidence = fallbackEvidence('identity_pool_missing');
      } else {
        try {
          verificationEvidence = await resolvePersonaVerificationEvidence(identityPool, normalizedAccessEmail);
        } catch {
          verificationEvidence = fallbackEvidence('identity_evidence_lookup_failed');
        }
      }
      accountVerified = Boolean(verificationEvidence.verified);
      const provisioned = await upsertApprovedCommunityAccount(client, accountConfig, {
        request_id: String(currentRow.request_id || requestId),
        email: normalizedAccessEmail,
        display_name: String(currentRow.display_name || ''),
        verified: accountVerified,
      });
      accountProvisioned = true;
      provisionedAccountId = provisioned.account_id;
    }

    await client.query('COMMIT');
    cachedPublicCommunityLeaderboard = null;
    return {
      ok: true,
      source: tableName,
      warning: null,
      account_provisioned: accountProvisioned,
      provisioned_account_id: provisionedAccountId,
      account_verified: accountVerified,
      verification_evidence: verificationEvidence,
    };
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    return {
      ok: false,
      source: tableName,
      warning: `resolve failed: ${String(error?.message || 'unknown error')}`,
      account_provisioned: false,
      provisioned_account_id: null,
      account_verified: false,
      verification_evidence: null,
    };
  } finally {
    client.release();
  }
}

export async function resolveCommunityAccountsStatus(): Promise<CommunityAccountsStatus> {
  const pool = getCommunityDbPool();
  if (!pool) {
    return {
      backend: 'disabled',
      source: 'COMMUNITY_DATABASE_URL not configured',
      connected: false,
      stats: {
        total_accounts: 0,
        verified_accounts: 0,
        avg_reputation: null,
        high_reputation_count: 0,
      },
      top_accounts: [],
      warning: 'Configure COMMUNITY_DATABASE_URL for separate community account tracking',
    };
  }

  const config = resolveCommunityAccountConfig();

  try {
    await ensureCommunityAccountsTable(pool, config);
    const statsRes = await pool.query(
      `SELECT
         COUNT(*)::int AS total_accounts,
         COUNT(*) FILTER (WHERE COALESCE(${config.verifiedCol}, FALSE) = TRUE)::int AS verified_accounts,
         AVG(${config.reputationCol}::numeric)::float AS avg_reputation,
         COUNT(*) FILTER (WHERE COALESCE(${config.reputationCol}, 0) >= 80)::int AS high_reputation_count
       FROM ${config.tableName}`,
    );

    const topRes = await pool.query(
      `SELECT
         ${config.accountIdCol}::text AS account_id,
         ${config.handleCol}::text AS handle,
         ${config.reputationCol}::float AS reputation,
         COALESCE(${config.verifiedCol}, FALSE) AS verified,
         ${config.createdAtCol}::text AS created_at
       FROM ${config.tableName}
       ORDER BY ${config.reputationCol} DESC NULLS LAST
       LIMIT 10`,
    );

    const statsRow = (statsRes.rows[0] || {}) as Record<string, unknown>;
    return {
      backend: 'separate_db',
      source: config.tableName,
      connected: true,
      stats: {
        total_accounts: Number(statsRow.total_accounts || 0),
        verified_accounts: Number(statsRow.verified_accounts || 0),
        avg_reputation: statsRow.avg_reputation === null || statsRow.avg_reputation === undefined
          ? null
          : Number(statsRow.avg_reputation),
        high_reputation_count: Number(statsRow.high_reputation_count || 0),
      },
      top_accounts: topRes.rows.map((row: any) => ({
        account_id: String(row.account_id || ''),
        handle: String(row.handle || ''),
        reputation: row.reputation === null || row.reputation === undefined ? null : Number(row.reputation),
        verified: Boolean(row.verified),
        created_at: row.created_at ? String(row.created_at) : null,
      })),
      warning: null,
    };
  } catch (error: any) {
    return {
      backend: 'separate_db',
      source: config.tableName,
      connected: false,
      stats: {
        total_accounts: 0,
        verified_accounts: 0,
        avg_reputation: null,
        high_reputation_count: 0,
      },
      top_accounts: [],
      warning: `community-db query failed: ${String(error?.message || 'unknown error')}`,
    };
  }
}

export function resolveCommunityStatus(): CommunityStatus {
  const docsUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_DOCS_URL) || '/docs';
  const discordUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_DISCORD_URL);
  const githubDiscussionsUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_GITHUB_DISCUSSIONS_URL);
  const marketplaceUrl = normalizeHttpUrl(process.env.SVEN_COMMUNITY_MARKETPLACE_URL) || '/marketplace';
  const accessMode = normalizeAccessMode(process.env.SVEN_COMMUNITY_ACCESS_MODE);
  const personaProvider = String(process.env.SVEN_COMMUNITY_PERSONA_PROVIDER || '').trim() || null;
  const personaAllowlistConfigured = String(process.env.SVEN_COMMUNITY_PERSONA_ALLOWLIST || '').trim().length > 0;
  const moderationMode = normalizeModerationMode(process.env.SVEN_COMMUNITY_MODERATION_MODE);
  const agentPostPolicy = normalizeAgentPostPolicy(process.env.SVEN_COMMUNITY_AGENT_POST_POLICY);
  const securityBaselineSigned = isTruthy(process.env.SVEN_COMMUNITY_SECURITY_BASELINE_SIGNED);

  const readiness = {
    docs: Boolean(docsUrl),
    discord: Boolean(discordUrl),
    github_discussions: Boolean(githubDiscussionsUrl),
    marketplace: Boolean(marketplaceUrl),
    verified_persona_provider: Boolean(personaProvider) && accessMode === 'verified_persona_only',
    verified_persona_allowlist: personaAllowlistConfigured && accessMode === 'verified_persona_only',
    moderation_guardrails: moderationMode === 'strict' && agentPostPolicy === 'reviewed_only',
    security_baseline: securityBaselineSigned,
  };
  const total = Object.keys(readiness).length;
  const completed = Object.values(readiness).filter(Boolean).length;

  return {
    docs_url: docsUrl,
    discord_url: discordUrl,
    github_discussions_url: githubDiscussionsUrl,
    marketplace_url: marketplaceUrl,
    policy: {
      access_mode: accessMode,
      persona_provider: personaProvider,
      persona_allowlist_configured: personaAllowlistConfigured,
      moderation_mode: moderationMode,
      agent_post_policy: agentPostPolicy,
      security_baseline_signed: securityBaselineSigned,
    },
    readiness,
    completed,
    total,
  };
}

export function redactCommunityStatusForRole(
  status: CommunityStatus,
  role: string,
): CommunityStatus {
  if (String(role || '').trim() === 'platform_admin') return status;
  return {
    ...status,
    docs_url: null,
    discord_url: null,
    github_discussions_url: null,
    marketplace_url: null,
    policy: {
      ...status.policy,
      persona_provider: null,
    },
  };
}

export function redactCommunityStatusForPublic(status: CommunityStatus): CommunityStatus {
  return {
    ...status,
    policy: {
      ...status.policy,
      persona_provider: null,
      persona_allowlist_configured: false,
    },
  };
}

function isPlatformAdmin(request: any): boolean {
  return String(request?.userRole || '').trim() === 'platform_admin';
}

export async function registerCommunityRoutes(app: FastifyInstance, pool: pg.Pool) {
  app.get('/community/status', async (request: any, reply) => {
    const role = String(request.userRole || '').trim();
    reply.send({
      success: true,
      data: redactCommunityStatusForRole(resolveCommunityStatus(), role),
    });
  });

  app.get('/community/accounts/status', async (request: any, reply) => {
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }
    reply.send({
      success: true,
      data: await resolveCommunityAccountsStatus(),
    });
  });

  app.get('/community/accounts', async (request: any, reply) => {
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }
    const limit = clamp(Number(request.query?.limit || 100), 1, 500);
    const verifiedRaw = String(request.query?.verified || '').trim().toLowerCase();
    const verified = verifiedRaw === 'true' ? true : verifiedRaw === 'false' ? false : undefined;
    const query = String(request.query?.q || '').trim();
    const result = await listCommunityAccounts({ limit, verified, query });
    reply.send({
      success: true,
      data: result,
    });
  });

  app.patch('/community/accounts/:accountId', async (request: any, reply) => {
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }

    const accountId = String(request.params?.accountId || '').trim();
    const body = (request.body || {}) as { reputation?: unknown; verified?: unknown };
    if (!accountId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'accountId is required' },
      });
      return;
    }

    const patch: { reputation?: number; verified?: boolean } = {};
    if (body.reputation !== undefined && body.reputation !== null && String(body.reputation).trim() !== '') {
      const parsed = Number(body.reputation);
      if (!Number.isFinite(parsed)) {
        reply.status(400).send({
          success: false,
          error: { code: 'VALIDATION', message: 'reputation must be a valid number' },
        });
        return;
      }
      patch.reputation = parsed;
    }
    if (typeof body.verified === 'boolean') {
      patch.verified = body.verified;
    }

    if (patch.reputation === undefined && patch.verified === undefined) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'at least one of reputation or verified is required' },
      });
      return;
    }

    const result = await updateCommunityAccount(accountId, patch);
    if (!result.ok) {
      const notFound = String(result.warning || '').toLowerCase().includes('not found');
      const unavailable = String(result.warning || '').toLowerCase().includes('not configured');
      reply.status(notFound ? 404 : unavailable ? 503 : 500).send({
        success: false,
        error: {
          code: notFound ? 'NOT_FOUND' : unavailable ? 'UNAVAILABLE' : 'INTERNAL',
          message: result.warning || 'failed to update account',
        },
      });
      return;
    }

    reply.send({
      success: true,
      data: {
        source: result.source,
        row: result.row,
      },
    });
  });

  app.get('/community/access-requests', async (request: any, reply) => {
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }
    const limit = clamp(Number(request.query?.limit || 50), 1, 200);
    const status = String(request.query?.status || '').trim().toLowerCase();
    const result = await listCommunityAccessRequests({ limit, status: status || undefined });
    reply.send({
      success: true,
      data: result,
    });
  });

  app.post('/community/access-requests/:requestId/resolve', async (request: any, reply) => {
    if (!isPlatformAdmin(request)) {
      reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Global admin privileges required' },
      });
      return;
    }
    const requestId = String(request.params?.requestId || '').trim();
    const body = (request.body || {}) as { status?: string; review_note?: string };
    const nextStatus = String(body.status || '').trim().toLowerCase();
    if (!requestId || (nextStatus !== 'approved' && nextStatus !== 'rejected')) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'requestId and status(approved|rejected) are required' },
      });
      return;
    }
    const reviewNote = String(body.review_note || '').trim();
    const result = await resolveCommunityAccessRequest(
      requestId,
      nextStatus as 'approved' | 'rejected',
      reviewNote ? reviewNote.slice(0, 500) : null,
      pool,
    );
    if (!result.ok) {
      const notFound = String(result.warning || '').toLowerCase().includes('not found');
      reply.status(notFound ? 404 : 500).send({
        success: false,
        error: { code: notFound ? 'NOT_FOUND' : 'INTERNAL', message: result.warning || 'request not found' },
      });
      return;
    }
    reply.send({
      success: true,
      data: {
        request_id: requestId,
        status: nextStatus,
        source: result.source,
        account_provisioned: result.account_provisioned,
        provisioned_account_id: result.provisioned_account_id,
        account_verified: result.account_verified,
        verification_evidence: result.verification_evidence,
      },
    });
  });
}

export async function registerPublicCommunityRoutes(app: FastifyInstance, _pool: pg.Pool) {
  const setPublicCors = (reply: any) => {
    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    reply.header('access-control-allow-headers', 'content-type');
  };

  app.get('/v1/public/community/status', async (_request: any, reply) => {
    setPublicCors(reply);
    reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=60');
    reply.send({
      success: true,
      data: redactCommunityStatusForPublic(resolveCommunityStatus()),
    });
  });

  app.get('/v1/public/community/feed', async (_request: any, reply) => {
    setPublicCors(reply);
    reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=60');
    const status = redactCommunityStatusForPublic(resolveCommunityStatus());
    const feed = await resolvePublicCommunityFeed(status);
    reply.send({
      success: true,
      data: feed,
    });
  });

  app.get('/v1/public/community/leaderboard', async (_request: any, reply) => {
    setPublicCors(reply);
    reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=60');
    const leaderboard = await resolvePublicCommunityLeaderboard();
    reply.send({
      success: true,
      data: leaderboard,
    });
  });

  app.get('/v1/public/community/capability-proof', async (_request: any, reply) => {
    setPublicCors(reply);
    reply.header('cache-control', 'public, max-age=60, stale-while-revalidate=60');
    const capabilityProof = await resolvePublicCommunityCapabilityProof();
    reply.send({
      success: true,
      data: capabilityProof,
    });
  });

  app.post('/v1/public/community/access-request', async (request: any, reply) => {
    setPublicCors(reply);
    const body = (request.body || {}) as {
      email?: string;
      display_name?: string;
      motivation?: string;
    };
    const email = normalizeEmail(body.email);
    const displayName = String(body.display_name || '').trim();
    const motivation = String(body.motivation || '').trim();

    if (!consumeAccessRequestQuota(String(request.ip || ''))) {
      reply.header('Retry-After', '60');
      reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Please wait before submitting another request',
          details: { retry_after_seconds: 60 },
        },
      });
      return;
    }

    if (!isValidEmail(email) || displayName.length < 2 || motivation.length < 10) {
      reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION',
          message: 'Valid email, display_name (2+ chars), and motivation (10+ chars) are required',
        },
      });
      return;
    }

    const result = await submitCommunityAccessRequest({
      email,
      display_name: displayName.slice(0, 120),
      motivation: motivation.slice(0, 2000),
      source_ip: String(request.ip || '').trim().slice(0, 120),
    });

    if (!result.accepted) {
      reply.status(503).send({
        success: false,
        error: { code: 'UNAVAILABLE', message: result.message },
      });
      return;
    }

    reply.send({
      success: true,
      data: result,
    });
  });

  app.get('/v1/public/community/access-request/:requestId', async (request: any, reply) => {
    setPublicCors(reply);
    const requestId = String(request.params?.requestId || '').trim();
    if (!requestId) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'requestId is required' },
      });
      return;
    }

    const result = await getPublicCommunityAccessRequestStatus(requestId);
    if (!result.ok || !result.row) {
      const notFound = String(result.warning || '').toLowerCase().includes('not found');
      reply.status(notFound ? 404 : 503).send({
        success: false,
        error: {
          code: notFound ? 'NOT_FOUND' : 'UNAVAILABLE',
          message: result.warning || 'request status unavailable',
        },
      });
      return;
    }

    reply.header('cache-control', 'private, max-age=15');
    reply.send({
      success: true,
      data: result.row,
    });
  });
}
