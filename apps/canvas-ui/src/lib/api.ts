/**
 * Canvas API Client
 *
 * User-facing API for chat, messages, canvas events, artifacts, search, approvals.
 * All requests proxied via Next.js rewrite: /api/* → gateway:3000/*
 */

import { createSvenHttpClient, SvenApiError, type RuntimeSignal } from '@sven/shared/sdk/http-client';

const BASE = '/api/v1';
let refreshInFlight: Promise<boolean> | null = null;
let runtimeReporter: ((next: { health: 'online' | 'degraded' | 'offline'; source: string; message: string }) => void) | null = null;

export function setRuntimeReporter(
  reporter: (next: { health: 'online' | 'degraded' | 'offline'; source: string; message: string }) => void,
) {
  runtimeReporter = reporter;
  httpClient.setRuntimeReporter((next: RuntimeSignal) => runtimeReporter?.(next));
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API ${status}`);
    this.name = 'ApiError';
  }
}

export type SearchPaging = {
  limits?: { messages?: number; tool_runs?: number; artifacts?: number };
  offsets?: { messages?: number; tool_runs?: number; artifacts?: number };
};

export type SearchPaginationState = {
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset: number;
};

export type SearchMessageRow = {
  id: string;
  chat_id: string;
  text: string;
  role: string;
  created_at: string;
  chat_name: string;
};

export type SearchToolRunRow = {
  id: string;
  chat_id: string;
  tool_name: string;
  status: string;
  created_at: string;
  chat_name: string;
  context_message_id: string | null;
};

export type SearchArtifactRow = {
  id: string;
  chat_id: string;
  message_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
  chat_name: string;
};

export type SearchResponse = {
  messages: SearchMessageRow[];
  tool_runs: SearchToolRunRow[];
  artifacts: SearchArtifactRow[];
  page: {
    messages: SearchPaginationState;
    tool_runs: SearchPaginationState;
    artifacts: SearchPaginationState;
  };
};

export type ToolRunLinkedArtifact = {
  id: string;
  chat_id: string;
  message_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

export type ToolRunLogs = {
  stdout?: string | null;
  stderr?: string | null;
  exit_code?: number | null;
};

export type ToolRunRecord = {
  id: string;
  tool_name: string;
  chat_id: string;
  user_id: string;
  approval_id: string | null;
  status: string;
  inputs: Record<string, unknown> | null;
  outputs: Record<string, unknown> | null;
  tool_logs: ToolRunLogs | null;
  error: string | null;
  prev_hash: string;
  run_hash: string;
  canonical_io_sha256: string;
  duration_ms: number | null;
  created_at: string;
  completed_at: string | null;
  context_message_id: string | null;
  linked_artifacts: ToolRunLinkedArtifact[];
};

export type ArtifactRecord = {
  id: string;
  chat_id: string;
  message_id: string | null;
  tool_run_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path?: string;
  is_private: boolean;
  enc_alg: string | null;
  enc_kid: string | null;
  ciphertext_sha256: string | null;
  created_at: string;
};

export type ApprovalRecord = {
  id: string;
  chat_id: string;
  tool_name: string;
  scope: string;
  requester_user_id: string;
  status: string;
  quorum_required: number;
  votes_approve: number;
  votes_deny: number;
  expires_at: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
};

export type ApprovalsQuery = {
  status?: string;
  chat_id?: string;
  query?: string;
  requester?: 'me' | 'all';
  limit?: number;
  offset?: number;
};

export type ApprovalsListResponse = {
  rows: ApprovalRecord[];
  page: SearchPaginationState;
};

export type ApprovalsExportFormat = 'json' | 'csv';

export type ApprovalsExportQuery = {
  status?: string;
  chat_id?: string;
  query?: string;
  requester?: 'me' | 'all';
  max_rows?: number;
  format?: ApprovalsExportFormat;
};

export type ApprovalsVoteResult = {
  vote_id: string;
};

export type AuthLoginResult =
  | {
    requires_totp: true;
    pre_session_id: string;
  }
  | {
    requires_totp?: false;
    user_id: string;
    username: string;
    role: string;
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
  };

export type AuthTotpVerifyResult = {
  user_id: string;
  username: string;
  role: string;
};

export type UserMeRecord = {
  id: string;
  username: string;
  display_name: string | null;
  role: string;
  created_at: string;
  active_organization_id: string | null;
};

export type ChatSummary = {
  id: string;
  name: string;
  type: string;
  channel: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_at: string | null;
};

export type ChatMemberRecord = {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  username: string;
  display_name: string | null;
  user_role: string;
};

export type ChatDetails = ChatSummary & {
  members: ChatMemberRecord[];
};

export type MessageRecord = {
  id: string;
  chat_id: string;
  sender_user_id: string | null;
  sender_identity_id: string | null;
  role: string;
  content_type: string;
  text: string;
  blocks: unknown[] | null;
  channel_message_id: string | null;
  created_at: string;
  user_feedback?: 'up' | 'down' | null;
  status?: 'queued' | 'sent' | 'failed' | 'streaming' | string;
  queue_id?: string | null;
  queue_position?: number | null;
};

export type AgentStateRecord = {
  chat_id: string;
  paused: boolean;
  updated_at: string | null;
  nudge_nonce?: number;
  last_nudged_at?: string | null;
  processing?: boolean;
  last_user_message_at?: string | null;
  last_assistant_message_at?: string | null;
};

export type AgentNudgeResult = {
  chat_id: string;
  nudged: boolean;
  nudge_event_id: string;
  replay_event_id: string;
  nudge_nonce: number;
  last_nudged_at: string;
  retried_message_id: string;
};

export type ChatTranscriptExportFormat = 'md' | 'json';

export type ChatTranscriptExportQuery = {
  format?: ChatTranscriptExportFormat;
  max_rows?: number;
};

export type CanvasEventRecord = {
  id: string;
  chat_id: string;
  message_id: string;
  created_at: string;
  message_text: string | null;
  message_role: string | null;
  blocks: unknown[];
};

export type A2uiStateRecord = {
  version: number;
  html: string;
  component: string;
  state: Record<string, unknown>;
  updated_at?: string | null;
};

export type A2uiEvalResult = {
  result: unknown;
  ui: A2uiStateRecord;
};

export type A2uiInteractionRecord = {
  id: string;
  type: string;
  payload: {
    event_type: string;
    payload: Record<string, unknown>;
    user_id: string;
  };
  created_at: string;
};

export type DownloadedFile = {
  blob: Blob;
  filename: string | null;
  contentType: string;
};

export type RegistryCatalogEntry = {
  id: string;
  source_id?: string | null;
  publisher_id?: string | null;
  name: string;
  description?: string | null;
  version?: string | null;
  format?: string | null;
  manifest?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type RegistryInstalledEntry = {
  id: string;
  catalog_entry_id: string;
  tool_id: string;
  trust_level: 'trusted' | 'quarantined' | 'blocked';
  installed_by?: string | null;
  installed_at?: string | null;
};

export type RegistryMarketplaceEntry = {
  id: string;
  source_id?: string | null;
  publisher_id?: string | null;
  name: string;
  description?: string | null;
  version?: string | null;
  format?: string | null;
  manifest?: Record<string, unknown> | null;
  created_at?: string | null;
  publisher_trusted?: boolean;
  verified?: boolean;
  version_count?: number;
  install_count?: number;
  usage_30d?: number;
  error_rate_30d?: number;
  last_used_at?: string | null;
  review_count?: number;
  average_rating?: number;
  changelog?: string | null;
  deprecation_notice?: string | null;
  deprecated?: boolean;
  is_premium?: boolean;
  price_cents?: number;
  currency?: string;
  creator_share_bps?: number;
};

export type RegistrySkillReview = {
  id: string;
  catalog_entry_id: string;
  reviewer_user_id: string;
  rating: number;
  review?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  username?: string | null;
  display_name?: string | null;
};

export type RegistrySkillVersion = {
  id: string;
  source_id?: string | null;
  publisher_id?: string | null;
  name: string;
  description?: string | null;
  version?: string | null;
  format?: string | null;
  manifest?: Record<string, unknown> | null;
  created_at?: string | null;
  changelog?: string | null;
  deprecation_notice?: string | null;
  deprecated?: boolean;
};

export type RegistryPurchaseRecord = {
  id: string;
  catalog_entry_id: string;
  buyer_user_id?: string | null;
  creator_user_id?: string | null;
  amount_cents: number;
  creator_amount_cents: number;
  platform_amount_cents: number;
  currency: string;
  status: string;
  created_at?: string | null;
  skill_name?: string;
  skill_version?: string;
  split?: {
    creator_share_bps: number;
    creator_amount_cents: number;
    platform_amount_cents: number;
  };
};

const httpClient = createSvenHttpClient({
  baseUrl: BASE,
  credentials: 'include',
  defaultHeaders: { 'Content-Type': 'application/json' },
  maxRetries: 2,
  retryBaseDelayMs: 250,
  timeoutMs: 12000,
  circuitFailureThreshold: 4,
  circuitOpenMs: 10000,
  shouldAttemptRefresh,
  refreshSession,
  runtimeReporter: (next: RuntimeSignal) => runtimeReporter?.(next),
});

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  try {
    return await httpClient.request<T>(method, path, body, {
      idempotencyKey: method === 'POST' ? `${path}:${Date.now()}` : undefined,
    });
  } catch (err) {
    if (err instanceof SvenApiError) {
      throw new ApiError(err.status, err.body);
    }
    throw err;
  }
}

function extractFilename(contentDisposition: string): string | null {
  const input = String(contentDisposition || '');
  if (!input) return null;

  const utf8Match = input.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).trim().replace(/^"|"$/g, '');
    } catch {
      // Fall through to filename parser.
    }
  }

  const plainMatch = input.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }
  return null;
}

async function download(path: string): Promise<DownloadedFile> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch (err) {
    throw err;
  }

  const contentType = String(res.headers.get('content-type') || '');
  if (!res.ok) {
    let body: unknown = null;
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, body);
  }

  const blob = await res.blob();
  const filename = extractFilename(String(res.headers.get('content-disposition') || ''));
  return { blob, filename, contentType };
}

function appendApprovalsFilters(
  qs: URLSearchParams,
  normalized: Pick<ApprovalsQuery, 'status' | 'chat_id' | 'query' | 'requester' | 'limit' | 'offset'>,
) {
  if (normalized.status) qs.set('status', normalized.status);
  if (normalized.chat_id) qs.set('chat_id', normalized.chat_id);
  if (normalized.query) qs.set('query', normalized.query);
  if (normalized.requester) qs.set('requester', normalized.requester);
  if (typeof normalized.limit === 'number' && Number.isFinite(normalized.limit)) {
    qs.set('limit', String(Math.max(1, Math.floor(normalized.limit))));
  }
  if (typeof normalized.offset === 'number' && Number.isFinite(normalized.offset) && normalized.offset >= 0) {
    qs.set('offset', String(Math.floor(normalized.offset)));
  }
}

function shouldAttemptRefresh(path: string): boolean {
  const p = String(path || '').toLowerCase();
  if (!p) return true;
  if (p.startsWith('/auth/login')) return false;
  if (p.startsWith('/auth/totp/verify')) return false;
  if (p.startsWith('/auth/logout')) return false;
  return true;
}

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

// ── Auth ──
export const auth = {
  login: (username: string, password: string) =>
    request<{ success: boolean; data: AuthLoginResult }>('POST', '/auth/login', { username, password }),
  verifyTotp: (pre_session_id: string, code: string) =>
    request<{ success: boolean; data: AuthTotpVerifyResult }>('POST', '/auth/totp/verify', { pre_session_id, code }),
  logout: () => request<void>('POST', '/auth/logout'),
  logoutAll: () => request<{ success: boolean; data: { sessions_revoked: number } }>('POST', '/auth/logout-all'),
};

// ── Me ──
export const me = {
  get: () => request<{ success: boolean; data: UserMeRecord }>('GET', '/me'),
};

// ── Chats ──
export const chats = {
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
    if (typeof params?.offset === 'number' && params.offset > 0) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request<{ success: boolean; data: { rows: ChatSummary[]; has_more: boolean } }>(
      'GET',
      `/chats${q ? `?${q}` : ''}`,
    );
  },
  create: (payload?: { name?: string; type?: 'dm' | 'group' }) =>
    request<{ success: boolean; data: Pick<ChatSummary, 'id' | 'name' | 'type' | 'channel' | 'created_at'> }>('POST', '/chats', payload || {}),
  get: (chatId: string) => request<{ success: boolean; data: ChatDetails }>('GET', `/chats/${chatId}`),
  rename: (chatId: string, name: string) =>
    request<{ success: boolean; data: Pick<ChatSummary, 'id' | 'name' | 'type' | 'channel' | 'updated_at'> }>('PATCH', `/chats/${chatId}`, { name }),
  remove: (chatId: string) =>
    request<{ success: boolean; data: { chat_id: string; deleted: boolean; left: boolean } }>('DELETE', `/chats/${chatId}`),
  shareStatus: (chatId: string) =>
    request<{
      success: boolean;
      data:
        | { active: false }
        | { active: true; share_token: string; share_url: string; created_at: string; expires_at: string | null };
    }>('GET', `/chats/${chatId}/share`),
  share: (chatId: string, payload?: { expires_in_days?: number }) =>
    request<{ success: boolean; data: { share_token: string; share_url: string; created_at: string; expires_at: string | null } }>(
      'POST',
      `/chats/${chatId}/share`,
      payload || {},
    ),
  unshare: (chatId: string) =>
    request<{ success: boolean; data: { revoked: boolean } }>('DELETE', `/chats/${chatId}/share`),
  messages: (chatId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.limit) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return request<{ success: boolean; data: { rows: MessageRecord[]; has_more: boolean } }>(
      'GET', `/chats/${chatId}/messages${q ? `?${q}` : ''}`,
    );
  },
  send: (chatId: string, text: string) =>
    request<{ success: boolean; data: MessageRecord & { queued?: boolean } }>('POST', `/chats/${chatId}/messages`, { text }),
  cancelQueued: (chatId: string, queueId: string) =>
    request<{ success: boolean; data: { id: string; cancelled: boolean } }>('DELETE', `/chats/${chatId}/queue/${queueId}`),
  messageFeedback: (chatId: string) =>
    request<{ success: boolean; data: { rows: Array<{ message_id: string; feedback: 'up' | 'down' }> } }>(
      'GET',
      `/chats/${chatId}/message-feedback`,
    ),
  setMessageFeedback: (chatId: string, messageId: string, feedback: 'up' | 'down' | null) =>
    request<{ success: boolean; data: { message_id: string; feedback: 'up' | 'down' | null; counts: { up: number; down: number } } }>('PUT', `/chats/${chatId}/messages/${messageId}/feedback`, { feedback }),
  canvas: (chatId: string) =>
    request<{ success: boolean; data: { rows: CanvasEventRecord[] } }>('GET', `/chats/${chatId}/canvas`),
  exportTranscript: (chatId: string, options?: ChatTranscriptExportQuery) => {
    const qs = new URLSearchParams();
    if (options?.format) qs.set('format', options.format);
    if (typeof options?.max_rows === 'number' && Number.isFinite(options.max_rows)) {
      qs.set('max_rows', String(Math.max(1, Math.floor(options.max_rows))));
    }
    const q = qs.toString();
    return download(`/chats/${chatId}/export${q ? `?${q}` : ''}`);
  },
  agentState: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('GET', `/chats/${chatId}/agent-state`),
  pauseAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('POST', `/chats/${chatId}/agent/pause`),
  resumeAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('POST', `/chats/${chatId}/agent/resume`),
  nudgeAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentNudgeResult }>('POST', `/chats/${chatId}/agent/nudge`, {}),
};

// ── Artifacts ──
export const artifacts = {
  get: (id: string) => request<{ success: boolean; data: ArtifactRecord }>('GET', `/artifacts/${id}`),
};

// ── Tool Runs ──
export const runs = {
  get: (id: string) => request<{ success: boolean; data: ToolRunRecord }>('GET', `/runs/${id}`),
};

// ── Approvals ──
export const approvals = {
  list: (filters?: string | ApprovalsQuery) => {
    const normalized: ApprovalsQuery = typeof filters === 'string'
      ? { status: filters }
      : (filters || {});
    const qs = new URLSearchParams();
    appendApprovalsFilters(qs, normalized);
    const q = qs.toString();
    return request<{ success: boolean; data: ApprovalsListResponse }>(
      'GET',
      `/approvals${q ? `?${q}` : ''}`,
    );
  },
  export: (filters?: ApprovalsExportQuery) => {
    const normalized = filters || {};
    const qs = new URLSearchParams();
    appendApprovalsFilters(qs, {
      status: normalized.status,
      chat_id: normalized.chat_id,
      query: normalized.query,
      requester: normalized.requester,
      limit: undefined,
      offset: undefined,
    });
    if (typeof normalized.max_rows === 'number' && Number.isFinite(normalized.max_rows)) {
      qs.set('max_rows', String(Math.max(1, Math.floor(normalized.max_rows))));
    }
    if (normalized.format) {
      qs.set('format', normalized.format);
    }
    const q = qs.toString();
    return download(`/approvals/export${q ? `?${q}` : ''}`);
  },
  vote: (id: string, decision: 'approve' | 'deny') =>
    request<{ success: boolean; data: ApprovalsVoteResult }>('POST', `/approvals/${id}/vote`, { decision }),
};

// ── Search ──
export const search = {
  query: (
    q: string,
    chatId?: string,
    paging?: SearchPaging,
  ) =>
    request<{ success: boolean; data: SearchResponse }>('POST', '/search', {
      query: q,
      chat_id: chatId,
      limits: paging?.limits,
      offsets: paging?.offsets,
    }),
};

// ── A2UI ──
export const a2ui = {
  snapshot: (chatId: string) =>
    request<{ success: boolean; data: A2uiStateRecord }>('GET', `/chats/${chatId}/a2ui/snapshot`),
  push: (chatId: string, data: { html?: string; component?: string; state?: Record<string, unknown> }) =>
    request<{ success: boolean; data: A2uiStateRecord }>('POST', `/chats/${chatId}/a2ui/push`, data),
  reset: (chatId: string) => request<{ success: boolean; data: A2uiStateRecord }>('POST', `/chats/${chatId}/a2ui/reset`),
  eval: (chatId: string, data: { script: string; payload?: Record<string, unknown> }) =>
    request<{ success: boolean; data: A2uiEvalResult }>('POST', `/chats/${chatId}/a2ui/eval`, data),
  interact: (chatId: string, data: { event_type: string; payload?: Record<string, unknown> }) =>
    request<{ success: boolean; data: A2uiInteractionRecord }>('POST', `/chats/${chatId}/a2ui/interaction`, data),
};

// ── Push ──
export const push = {
  register: (token: string, platform = 'web', deviceId?: string) =>
    request<{ success: boolean }>('POST', '/push/register', {
      token,
      platform,
      device_id: deviceId,
    }),
  unregister: (token: string) =>
    request<{ success: boolean }>('POST', '/push/unregister', {
      token,
    }),
};

export const registry = {
  catalog: (name?: string) =>
    request<{ success: boolean; data: RegistryCatalogEntry[]; meta?: Record<string, unknown> }>(
      'GET',
      `/registry/catalog${name ? `?name=${encodeURIComponent(name)}` : ''}`,
    ),
  marketplace: (name?: string) =>
    request<{ success: boolean; data: RegistryMarketplaceEntry[]; meta?: Record<string, unknown> }>(
      'GET',
      `/registry/marketplace${name ? `?name=${encodeURIComponent(name)}` : ''}`,
    ),
  installed: () =>
    request<{ success: boolean; data: RegistryInstalledEntry[]; meta?: Record<string, unknown> }>(
      'GET',
      '/registry/installed',
    ),
  install: (catalogId: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('POST', `/registry/install/${catalogId}`),
  purchase: (catalogId: string) =>
    request<{ success: boolean; data: RegistryPurchaseRecord }>('POST', `/registry/purchase/${catalogId}`),
  versions: (name: string) =>
    request<{ success: boolean; data: RegistrySkillVersion[]; meta?: Record<string, unknown> }>(
      'GET',
      `/registry/versions?name=${encodeURIComponent(name)}`,
    ),
  reviews: (catalogEntryId?: string) =>
    request<{ success: boolean; data: RegistrySkillReview[]; meta?: Record<string, unknown> }>(
      'GET',
      `/registry/reviews${catalogEntryId ? `?catalog_entry_id=${encodeURIComponent(catalogEntryId)}` : ''}`,
    ),
  submitReview: (payload: { catalog_entry_id: string; rating: number; review?: string }) =>
    request<{ success: boolean; data: RegistrySkillReview }>('POST', '/registry/reviews', payload),
};

// ── Council ──
export type CouncilConfig = {
  council_mode?: boolean;
  council_models?: string[];
  council_chairman?: string;
  council_strategy?: string;
  council_rounds?: number;
};

export type CouncilSession = {
  id: string;
  userId: string;
  query: string;
  config: CouncilConfig;
  status: string;
  synthesisPreview?: string | null;
  synthesis?: string | null;
  opinions?: Array<Record<string, unknown>>;
  peerReviews?: Array<Record<string, unknown>>;
  scores?: Record<string, unknown>;
  totalTokens: { prompt: number; completion: number };
  totalCost: number;
  elapsedMs: number;
  createdAt: string;
  completedAt: string | null;
};

export const council = {
  getConfig: () =>
    request<{ config: CouncilConfig }>('GET', '/admin/council/config'),
  updateConfig: (config: Partial<CouncilConfig>) =>
    request<{ updated: boolean; config: CouncilConfig }>('PUT', '/admin/council/config', {
      enabled: config.council_mode,
      models: config.council_models,
      chairman: config.council_chairman,
      strategy: config.council_strategy,
      rounds: config.council_rounds,
    }),
  deliberate: (query: string, opts?: { models?: string[]; strategy?: string }) =>
    request<{ sessionId: string; status: string }>('POST', '/admin/council/deliberate', { query, ...opts }),
  sessions: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request<{ sessions: CouncilSession[]; total: number }>('GET', `/admin/council/sessions${q ? `?${q}` : ''}`);
  },
  session: (id: string) =>
    request<CouncilSession>('GET', `/admin/council/sessions/${id}`),
};

// ── Memory ──
export type MemoryRecord = {
  id: string;
  key: string;
  value: string;
  scope: string;
  visibility: string;
  importance: number;
  access_count: number;
  chat_id?: string | null;
  created_at: string;
  updated_at: string;
};

export const memory = {
  list: (params?: { scope?: string; chat_id?: string; page?: number; per_page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.scope) qs.set('scope', params.scope);
    if (params?.chat_id) qs.set('chat_id', params.chat_id);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const q = qs.toString();
    return request<{ success: boolean; data: { rows: MemoryRecord[]; total: number } }>('GET', `/admin/memories${q ? `?${q}` : ''}`);
  },
  create: (data: { key: string; value: string; scope?: string; visibility?: string; importance?: number; chat_id?: string }) =>
    request<{ success: boolean; data: MemoryRecord }>('POST', '/admin/memories', data),
  remove: (id: string) =>
    request<{ success: boolean }>('DELETE', `/admin/memories/${id}`),
  search: (query: string, opts?: { scope?: string; chat_id?: string; limit?: number }) =>
    request<{ success: boolean; data: { rows: MemoryRecord[] } }>('POST', '/admin/memories/search', { query, ...opts }),
  stats: () =>
    request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/memories/stats'),
};

// ── Video ──
export type VideoJob = {
  id: string;
  title: string;
  template: string;
  status: string;
  progress: number;
  width: number;
  height: number;
  fps: number;
  duration_secs: number;
  duration_s?: number;
  output_format: string;
  render_time_ms: number;
  output_size_bytes: number;
  output_path?: string;
  url?: string;
  prompt?: string;
  error?: string;
  spec?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
};

export const video = {
  createJob: (data: { title?: string; description?: string; template?: string; spec?: Record<string, unknown> }) =>
    request<{ success: boolean; data: VideoJob }>('POST', '/admin/video/jobs', data),
  jobs: (params?: { limit?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    const q = qs.toString();
    return request<{ jobs: VideoJob[]; total: number }>('GET', `/admin/video/jobs${q ? `?${q}` : ''}`);
  },
  job: (id: string) =>
    request<VideoJob>('GET', `/admin/video/jobs/${id}`),
  cancel: (id: string) =>
    request<{ success: boolean }>('POST', `/admin/video/jobs/${id}/cancel`),
  stats: () =>
    request<Record<string, unknown>>('GET', '/admin/video/stats'),
};

export const api = { auth, me, chats, artifacts, runs, approvals, search, a2ui, push, registry, council, memory, video };
