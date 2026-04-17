/**
 * API client for Sven gateway-api
 *
 * Requests are same-origin under /v1/* and routed by edge nginx to gateway-api.
 * Session cookie is forwarded automatically by the browser.
 */

import { createSvenHttpClient, SvenApiError, type RuntimeSignal } from '@sven/shared/sdk/http-client';

const BASE = '/v1';
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

async function softGet(path: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
}

async function requestRowsSoft(path: string): Promise<GenericRowsResponse> {
  const res = await softGet(path);
  if (res.ok) {
    const payload = await res.json();
    return { rows: mapRowsPayload(payload) };
  }
  if (res.status === 401 || res.status === 403) throw new ApiError(res.status, null);
  if (res.status === 404 || res.status >= 500) return { rows: [] };
  throw new ApiError(res.status, null);
}

function mapRowsPayload(payload: unknown): GenericRow[] {
  const data = payload as { data?: unknown; rows?: unknown };
  if (Array.isArray(data?.data)) return data.data as GenericRow[];
  if (Array.isArray(data?.rows)) return data.rows as GenericRow[];
  return [];
}

async function requestSuccessRowsSoft(path: string): Promise<{ success: true; data: GenericRow[] }> {
  const res = await softGet(path);
  if (res.ok) {
    const payload = await res.json();
    return { success: true, data: mapRowsPayload(payload) };
  }
  if (res.status === 401 || res.status === 403) throw new ApiError(res.status, null);
  if (res.status === 404 || res.status >= 500) return { success: true, data: [] };
  throw new ApiError(res.status, null);
}

function shouldAttemptRefresh(path: string): boolean {
  const p = String(path || '').toLowerCase();
  if (!p) return true;
  if (p.startsWith('/auth/login')) return false;
  if (p.startsWith('/auth/totp/verify')) return false;
  if (p.startsWith('/auth/logout')) return false;
  return true;
}

type LoginResponseData = {
  requires_totp?: boolean;
  pre_session_id?: string;
};

type AccountRow = {
  id: string;
  slug: string;
  name: string;
  owner_user_id?: string;
  member_count?: number;
};

type AccountMembership = {
  account_id: string;
  user_id: string;
  role: string;
  status: string;
};

type UserRecord = {
  id: string;
  username?: string;
  role?: string;
  created_at?: string;
  updated_at?: string;
};

type ChatRecord = {
  id: string;
  name?: string;
  type?: string;
  channel_type?: string;
  member_count?: number;
  message_count?: number;
  last_message_at?: string;
};

export type AdminChannelRecord = {
  channel: string;
  enabled: boolean;
  configured: boolean;
  has_token: boolean;
  capabilities?: {
    buttons?: boolean;
    files?: boolean;
    audio?: boolean;
    threads?: boolean;
  };
  stats?: {
    chats?: number;
    identities?: number;
    messages?: number;
  };
  config?: Record<string, unknown>;
};

export type ChatMessageRecord = {
  id: string;
  chat_id: string;
  sender_user_id?: string | null;
  role: string;
  content_type?: string;
  text: string;
  blocks?: unknown[] | null;
  created_at: string;
  status?: string;
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

export type WidgetSettingsRecord = {
  organization_id?: string;
  enabled: boolean;
  endpoint_url: string;
  title: string;
  avatar_url: string | null;
  position: 'bottom-right' | 'bottom-left';
  primary_color: string;
  background_color: string;
  welcome_text: string;
  updated_at?: string;
};

export type WidgetInstanceRecord = {
  id: string;
  name: string;
  api_key_last4: string;
  rate_limit_rpm: number;
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

export type WidgetInstanceCreateResponse = {
  id: string;
  name: string;
  rate_limit_rpm: number;
  api_key: string;
  api_key_last4: string;
};

export type WidgetEmbedResponse = {
  instance: WidgetInstanceRecord;
  endpoint: string;
  embed_snippet: string;
  note?: string;
};


export type CommunityStatusRecord = {
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

export type CommunityAccountsStatusRecord = {
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

export type CommunityAccessRequestRecord = {
  request_id: string;
  email: string;
  display_name: string;
  motivation: string;
  status: 'pending_review' | 'approved' | 'rejected';
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CommunityAccountRecord = {
  account_id: string;
  handle: string;
  email: string | null;
  reputation: number | null;
  verified: boolean;
  created_at: string | null;
  updated_at: string | null;
};

type ApprovalRecord = {
  id: string;
  type: string;
  title?: string;
  status: string;
  requester?: string;
  created_at: string;
  decided_by?: string;
  decided_at?: string;
  details?: Record<string, unknown>;
};

type PairingRecord = Record<string, unknown>;
type GenericRow = Record<string, unknown>;
type GenericRowsResponse = { rows: GenericRow[] };
type GenericSuccessDataRows = { success: true; data: { rows: GenericRow[] } };
export type ToolRunRecord = {
  id: string;
  status: string;
  tool_name: string;
  duration_ms?: number;
  chat_id?: string;
  user_id?: string;
  started_at?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  trace?: Array<Record<string, unknown>>;
};

export type A2AAuditRecord = {
  id: string;
  organization_id?: string | null;
  request_id: string;
  action: string;
  direction: string;
  status: string;
  trace_id?: string | null;
  upstream_trace_id?: string | null;
  peer_url?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at?: string | null;
};

export type ScheduleRecord = {
  id: string;
  name: string;
  instruction: string;
  schedule_type: 'once' | 'recurring';
  expression?: string | null;
  run_at?: string | null;
  timezone?: string | null;
  enabled?: boolean;
  last_run?: string | null;
  next_run?: string | null;
  last_status?: string | null;
  run_count?: number;
  max_runs?: number | null;
  agent_id?: string | null;
  chat_id?: string | null;
  missed_policy?: 'skip' | 'run_immediately' | string;
  notify_channels?: Array<'in_app' | 'email' | 'slack' | 'webhook'>;
  notify_email_to?: string | null;
  notify_webhook_url?: string | null;
  notify_slack_webhook_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ScheduleRunRecord = {
  id: string;
  scheduled_task_id: string;
  started_at?: string | null;
  finished_at?: string | null;
  status?: string | null;
  result?: unknown;
  error?: string | null;
  duration_ms?: number | null;
};

export type BackupJobRecord = {
  id: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  totalSizeBytes?: number;
  backupLocation?: string;
};

export type BackupConfigRecord = {
  id: string;
  backup_type?: string;
  enabled?: boolean;
  schedule_cron?: string;
  retention_days?: number | null;
  storage_path?: string | null;
  storage_type?: string | null;
  compression_enabled?: boolean | null;
  compression_algorithm?: string | null;
};

export type RestoreJobRecord = {
  id: string;
  backupJobId?: string;
  targetEnvironment?: string;
  status?: string;
  initiatedBy?: string;
};

export type DiscoveryInstanceRecord = {
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

export type DiscoveryNatsLeafPeerRecord = {
  instance_id: string;
  instance_name: string;
  nats_leaf_url: string;
  last_seen?: string;
};

export type TunnelStatusRecord = {
  enabled: boolean;
  provider: string;
  public_url: string | null;
  qr_image_url: string | null;
  source: 'env' | 'url_file' | 'log_file' | 'none';
  url_file: string | null;
  log_file: string | null;
};

export type DeploymentConfigRecord = {
  mode: 'personal' | 'multi_user';
  setup_complete: boolean;
};

export type AdminDeviceRecord = {
  id: string;
  name: string;
  device_type: string;
  status: string;
  capabilities: string[];
  config: Record<string, unknown>;
  last_seen_at?: string | null;
  paired_at?: string | null;
  pairing_code?: string | null;
  pairing_expires?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AdminDeviceCommandRecord = {
  id: string;
  command: string;
  payload: Record<string, unknown>;
  status: string;
  created_at: string;
  delivered_at?: string | null;
  ack_at?: string | null;
  result_payload?: Record<string, unknown> | null;
  error_message?: string | null;
};

export type AdminDeviceEventRecord = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type AdminDeviceDetailRecord = AdminDeviceRecord & {
  recent_events: AdminDeviceEventRecord[];
  recent_commands: AdminDeviceCommandRecord[];
};

export type DebugContextResponse = {
  session_id: string;
  chat?: Record<string, unknown>;
  user_id?: string | null;
  agent?: Record<string, unknown> | null;
  identity_docs?: {
    rows?: Array<Record<string, unknown>>;
    global?: Record<string, unknown> | null;
    chat?: Record<string, unknown> | null;
  };
  system_prompt?: {
    text?: string;
    base?: string;
    tokens?: number;
    tools_prompt?: string;
    device_prompt?: string;
  };
  memories?: { rows?: Array<Record<string, unknown>>; tokens?: number };
  rag_results?: { rows?: Array<Record<string, unknown>>; tokens?: number; note?: string };
  conversation?: {
    messages?: Array<Record<string, unknown>>;
    tokens?: number;
    total_messages?: number;
    truncated?: boolean;
    boundary?: string | null;
  };
  tools?: {
    first_party?: Array<Record<string, unknown>>;
    mcp?: Array<Record<string, unknown>>;
    tokens?: number;
    count?: number;
  };
  totals?: {
    tokens?: number;
    context_window?: number;
    remaining_tokens?: number | null;
    exceeded?: boolean;
  };
  session_settings?: Record<string, unknown>;
};

export type UpdateCheckerStatus = {
  enabled: boolean;
  intervalHours: number;
  feedUrl: string;
  lastCheckedAt: string | null;
  currentVersion: string;
  latestVersion: string | null;
  latestUrl: string | null;
  latestNotes: string | null;
  latestPublishedAt: string | null;
  updateAvailable: boolean;
  dismissedVersion: string | null;
};

export type EditorEntry = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  modified_at?: string | null;
};

export type EditorFile = {
  path: string;
  content: string | null;
  size?: number;
  too_large?: boolean;
  read_only?: boolean;
  modified_at?: string | null;
};

export type IntegrationRuntimeMode = 'container' | 'local_worker';
export type IntegrationRuntimeStatus = 'stopped' | 'deploying' | 'running' | 'error';
export type IntegrationRuntimeHookReadiness = {
  executionEnabled: boolean;
  deployConfigured: boolean;
  stopConfigured: boolean;
  statusConfigured: boolean;
};
export type IntegrationRuntimeReconcileReport = {
  scope: 'active_account';
  organization_id: string;
  scanned: number;
  skipped_no_probe: number;
  drift_detected: number;
  status_synced_to_running: number;
  marked_error: number;
  autoheal_attempted: number;
  autoheal_succeeded: number;
  autoheal_failed: number;
};
export type IntegrationRuntimeBootEvent = {
  message_id: string;
  chat_id: string;
  created_at?: string | null;
  tool_name: string;
  integration_type?: string;
  status: string;
  detail: string;
};
export type SsoProviderConfig = {
  enabled: boolean;
  issuer_url?: string;
  client_id?: string;
  client_secret?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  scopes?: string;
  entrypoint_url?: string;
  entity_id?: string;
  cert_pem?: string;
  callback_url?: string;
};
export type SsoConfig = {
  enabled: boolean;
  fallback_local_auth: boolean;
  oidc: SsoProviderConfig;
  saml: SsoProviderConfig;
  jit: { enabled: boolean; default_role: string };
  group_mapping: Array<{ external_group: string; tenant_role: string }>;
};

export type IntegrationRuntimeInstance = {
  integration_type: string;
  runtime_mode: IntegrationRuntimeMode;
  status: IntegrationRuntimeStatus;
  image_ref?: string | null;
  storage_path?: string | null;
  network_scope?: string | null;
  deployment_spec?: Record<string, unknown>;
  last_error?: string | null;
  last_deployed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  config?: Record<string, unknown>;
};

export type IntegrationRuntimeDetail = {
  integration_type: string;
  instance: IntegrationRuntimeInstance | null;
  config: Record<string, unknown>;
  secret_refs: Array<{ secret_key: string; secret_ref: string; updated_at?: string | null }>;
  runtime_hooks?: IntegrationRuntimeHookReadiness;
};

export type AgentAnalyticsRow = {
  agent_id: string;
  agent_name: string;
  task_total: number;
  task_success: number;
  task_error: number;
  task_success_rate_pct: number;
  avg_response_ms: number;
  total_tokens: number;
  total_cost_usd: number;
  tool_usage_frequency: Record<string, number>;
  error_rate_pct: number;
  self_correction_total: number;
  self_correction_success: number;
  self_correction_success_rate_pct: number;
  chat_count: number;
  avg_conversation_length: number;
  avg_follow_up_count: number;
};

export type AgentAnalyticsWindow = {
  startIso: string;
  endIso: string;
  label: string;
};

export type AgentAnalyticsAlertThresholds = {
  success_rate_below: number;
  error_rate_above: number;
  avg_response_ms_above: number;
  self_correction_below: number;
  cost_usd_above: number;
};

export type IntegrationCatalogRow = {
  id: string;
  name: string;
  runtime_type: string;
  configuration_mode: 'settings' | 'table' | 'hybrid' | 'none';
  linked: boolean;
  configured: boolean;
  available_tools_count: number;
  available_tools: string[];
  required_settings: Array<{ key: string; configured: boolean; value_present: boolean }>;
  table_name?: string | null;
  table_count?: number;
  runtime_status: 'stopped' | 'deploying' | 'running' | 'error' | string;
  runtime_mode: 'container' | 'local_worker' | string;
  runtime_updated_at?: string | null;
  runtime_hooks?: IntegrationRuntimeHookReadiness;
};

export type IntegrationCatalogValidation = {
  id: string;
  name: string;
  runtime_type: string;
  checks: Array<{ id: string; label: string; pass: boolean; detail: string }>;
  linked_tools: string[];
  required_settings: Array<{ key: string; configured: boolean }>;
  table_name?: string | null;
  table_count?: number;
  runtime?: {
    status?: string;
    runtime_mode?: string;
    image_ref?: string | null;
    updated_at?: string | null;
  } | null;
};

export type IntegrationLibraryProfile = {
  id: string;
  name: string;
  description: string;
  integration_ids: string[];
};

export type IntegrationRecoveryPlaybookRun = {
  id: string;
  organization_id: string;
  actor_user_id?: string | null;
  run_status?: 'in_progress' | 'completed' | 'failed' | string;
  requested_options?: Record<string, unknown>;
  target_snapshot?: Record<string, unknown>;
  summary?: Record<string, { enabled: boolean; attempted: number; succeeded: number; failed: number }>;
  created_at: string;
};

export type IntegrationRecoveryPlaybookRunDetail = IntegrationRecoveryPlaybookRun & {
  result?: {
    retry_failed_results?: Array<Record<string, unknown>>;
    deploy_stopped_results?: Array<Record<string, unknown>>;
    template_results?: Array<Record<string, unknown>>;
    validation_results?: Array<Record<string, unknown>>;
  };
};

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
    request<{ success: boolean; data: LoginResponseData }>('POST', '/auth/login', { username, password }),
  verifyTotp: (pre_session_id: string, code: string) =>
    request<{ success: boolean; data: LoginResponseData }>('POST', '/auth/totp/verify', { pre_session_id, code }),
  logout: () => request<void>('POST', '/auth/logout'),
  logoutAll: () => request<{ success: boolean; data: { sessions_revoked: number } }>('POST', '/auth/logout-all'),
  me: async () => {
    const res =
    request<{
      success: boolean;
      data: {
        id: string;
        username: string;
        role: string;
        active_organization_id?: string | null;
        active_organization_name?: string | null;
        active_organization_slug?: string | null;
      };
    }>('GET', '/auth/me');
    return (await res).data;
  },
};

// ── Accounts / Organizations ──
export const accounts = {
  list: () => request<{ success: boolean; data: { rows: AccountRow[] } }>('GET', '/admin/accounts'),
  create: (data: { name: string; slug?: string }) =>
    request<{ success: boolean; data: AccountRow }>('POST', '/admin/accounts', data),
  addMember: (accountId: string, data: { user_id: string; role?: string }) =>
    request<{ success: boolean; data: AccountMembership }>('POST', `/admin/accounts/${accountId}/members`, data),
  activate: (accountId: string) =>
    request<{ success: boolean; data: { active_account_id: string } }>('POST', `/admin/accounts/${accountId}/activate`),
};

// ── Users ──
export const users = {
  list: () => requestRowsSoft('/admin/users') as Promise<{ rows: UserRecord[] }>,
  get: (id: string) => request<UserRecord>('GET', `/admin/users/${id}`),
  create: (data: Record<string, unknown>) => request<UserRecord>('POST', '/admin/users', data),
  update: (id: string, data: Record<string, unknown>) => request<UserRecord>('PUT', `/admin/users/${id}`, data),
  delete: (id: string) => request<void>('DELETE', `/admin/users/${id}`),
  listIdentityLinks: (userId: string) =>
    request<{ success: boolean; data: Array<Record<string, unknown>> }>('GET', `/admin/users/${userId}/identity-links`),
  createIdentityLink: (userId: string, data: { channel_type: string; channel_user_id: string }) =>
    request<{ success: boolean; data: Record<string, unknown> }>('POST', `/admin/users/${userId}/identity-links`, data),
  verifyIdentityLink: (userId: string, linkId: string, code?: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('POST', `/admin/users/${userId}/identity-links/${linkId}/verify`, { code }),
  deleteIdentityLink: (userId: string, linkId: string) =>
    request<void>('DELETE', `/admin/users/${userId}/identity-links/${linkId}`),
};

// ── Chats ──
export const chats = {
  list: () => requestRowsSoft('/admin/chats') as Promise<{ rows: ChatRecord[] }>,
  get: async (id: string) => {
    const res = await request<{ success?: boolean; data?: ChatRecord } | ChatRecord>('GET', `/admin/chats/${id}`);
    if ('data' in (res as { data?: unknown })) return ((res as { data?: ChatRecord }).data || {}) as ChatRecord;
    return res as ChatRecord;
  },
  create: (data: Record<string, unknown>) => request<ChatRecord>('POST', '/admin/chats', data),
  members: (chatId: string) => requestRowsSoft(`/admin/chats/${chatId}/members`) as Promise<{ rows: UserRecord[] }>,
  messages: (chatId: string, params?: { before?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
    const suffix = qs.toString();
    return request<{ success: boolean; data: { rows: ChatMessageRecord[]; has_more: boolean } }>(
      'GET',
      `/chats/${chatId}/messages${suffix ? `?${suffix}` : ''}`,
    );
  },
  send: (chatId: string, text: string) =>
    request<{ success: boolean; data: ChatMessageRecord & { queued?: boolean } }>(
      'POST',
      `/chats/${chatId}/messages`,
      { text },
    ),
  interact: (chatId: string, eventType: string, payload: Record<string, unknown>) =>
    request<{ success: boolean; data: { id: string } }>(
      'POST',
      `/chats/${chatId}/a2ui/interaction`,
      { event_type: eventType, payload },
    ),
  cancelQueued: (chatId: string, queueId: string) =>
    request<{ success: boolean; data: { id: string; cancelled: boolean } }>(
      'DELETE',
      `/chats/${chatId}/queue/${queueId}`,
    ),
  agentState: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('GET', `/chats/${chatId}/agent-state`),
  pauseAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('POST', `/chats/${chatId}/agent/pause`),
  resumeAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentStateRecord }>('POST', `/chats/${chatId}/agent/resume`),
  nudgeAgent: (chatId: string) =>
    request<{ success: boolean; data: AgentNudgeResult }>('POST', `/chats/${chatId}/agent/nudge`, {}),
};

// ── Channels ──
export const channels = {
  list: () =>
    request<{ success: boolean; data: { channels: AdminChannelRecord[] } }>('GET', '/admin/channels'),
  get: (channel: string) =>
    request<{ success: boolean; data: { channel: string; config: Record<string, unknown>; configured: boolean; has_token: boolean } }>(
      'GET',
      `/admin/channels/${encodeURIComponent(channel)}`,
    ),
  update: (channel: string, patch: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', `/admin/channels/${encodeURIComponent(channel)}`, patch),
  rotateToken: (channel: string) =>
    request<{ success: boolean; data: { token: string } }>(
      'POST',
      `/admin/channels/${encodeURIComponent(channel)}/token`,
      {},
    ),
};

// ── Debug ──
export const debug = {
  context: (sessionId: string) =>
    request<{ success: boolean; data: DebugContextResponse }>(
      'GET',
      `/admin/debug/context/${encodeURIComponent(sessionId)}`,
    ),
};

// ── Update Checker ──
export const updateChecker = {
  status: () => request<{ success: boolean; data: UpdateCheckerStatus }>('GET', '/admin/update-checker/status'),
  checkNow: () => request<{ success: boolean; data: UpdateCheckerStatus }>('POST', '/admin/update-checker/check'),
  dismiss: (version: string) =>
    request<{ success: boolean; data: { dismissed: string } }>('POST', '/admin/update-checker/dismiss', { version }),
};

// ── Deployment ──
export const deployment = {
  config: () => request<{ success: boolean; data: DeploymentConfigRecord }>('GET', '/config/deployment'),
  setMode: (mode: 'personal' | 'multi_user') =>
    request<{ success: boolean; data: { mode: 'personal' | 'multi_user' } }>('PUT', '/admin/deployment', { mode }),
};

// ── Devices ──
export const devices = {
  list: (params?: { status?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type) qs.set('type', params.type);
    return request<{ success: boolean; data: AdminDeviceRecord[] }>(
      'GET',
      `/admin/devices${qs.toString() ? `?${qs.toString()}` : ''}`,
    );
  },
  get: (id: string) =>
    request<{ success: boolean; data: AdminDeviceDetailRecord }>('GET', `/admin/devices/${encodeURIComponent(id)}`),
  create: (payload: {
    name: string;
    device_type?: 'mirror' | 'tablet' | 'kiosk' | 'sensor_hub';
    capabilities?: string[];
    config?: Record<string, unknown>;
  }) => request<{ success: boolean; data: AdminDeviceRecord }>('POST', '/admin/devices', payload),
  update: (
    id: string,
    payload: { name?: string; capabilities?: string[]; config?: Record<string, unknown> },
  ) => request<{ success: boolean; data: AdminDeviceRecord }>('PATCH', `/admin/devices/${encodeURIComponent(id)}`, payload),
  remove: (id: string) => request<{ success: boolean; data: { deleted: true } }>('DELETE', `/admin/devices/${encodeURIComponent(id)}`),
  confirmPairing: (id: string, pairingCode: string) =>
    request<{ success: boolean; data: { device_id: string; api_key: string; message: string } }>(
      'POST',
      `/admin/devices/${encodeURIComponent(id)}/pair/confirm`,
      { pairing_code: pairingCode },
    ),
  regenerateApiKey: (id: string) =>
    request<{ success: boolean; data: { device_id: string; api_key: string; message: string } }>(
      'POST',
      `/admin/devices/${encodeURIComponent(id)}/pair/regenerate`,
      {},
    ),
  sendCommand: (id: string, command: string, payload?: Record<string, unknown>) =>
    request<{ success: boolean; data: AdminDeviceCommandRecord }>(
      'POST',
      `/admin/devices/${encodeURIComponent(id)}/command`,
      { command, payload: payload || {} },
    ),
};

// ── Editor ──
export const editor = {
  tree: (path?: string) => {
    const qs = path ? `?path=${encodeURIComponent(path)}` : '';
    return request<{ success: boolean; data: { entries: EditorEntry[]; root: string } }>('GET', `/admin/editor/tree${qs}`);
  },
  readFile: (path: string) =>
    request<{ success: boolean; data: EditorFile }>('GET', `/admin/editor/file?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string, createDirs = true) =>
    request<{ success: boolean; data: EditorFile }>('PUT', '/admin/editor/file', { path, content, create_dirs: createDirs }),
  deletePath: (path: string, recursive = false) =>
    request<{ success: boolean; data: { path: string } }>('DELETE', `/admin/editor/file?path=${encodeURIComponent(path)}&recursive=${recursive}`),
  rename: (from: string, to: string) =>
    request<{ success: boolean; data: { from: string; to: string } }>('POST', '/admin/editor/rename', { from, to }),
  mkdir: (path: string) =>
    request<{ success: boolean; data: { path: string } }>('POST', '/admin/editor/mkdir', { path }),
  search: (path: string, query: string, limit = 200) =>
    request<{ success: boolean; data: { results: Array<{ path: string; line: number; text: string }> } }>(
      'POST',
      '/admin/editor/search',
      { path, query, limit },
    ),
  gitStatus: () =>
    request<{ success: boolean; data: { status: string } }>('GET', '/admin/editor/git/status'),
  gitDiff: (path: string) =>
    request<{ success: boolean; data: { diff: string } }>('GET', `/admin/editor/git/diff?path=${encodeURIComponent(path)}`),
};

// ── Approvals ──
export const approvals = {
  list: (status?: string) =>
    request<{ rows: ApprovalRecord[] }>('GET', `/admin/approvals${status ? `?status=${status}` : ''}`),
  get: (id: string) => request<ApprovalRecord>('GET', `/admin/approvals/${id}`),
  vote: (id: string, decision: 'approve' | 'deny', reason: string, confirmPhrase: string) =>
    request<{ success: boolean; data: ApprovalRecord }>('POST', `/admin/approvals/${id}/vote`, {
      vote: decision,
      reason,
      confirm_phrase: confirmPhrase,
    }),
  voteUser: (id: string, decision: 'approve' | 'deny') =>
    request<{ success: boolean; data: { approval_id: string } }>('POST', `/approvals/${id}/vote`, { decision }),
};

// ── Pairing ──
export const pairing = {
  list: async (params?: { status?: string; channel?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.channel) qs.set('channel', params.channel);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString();
    try {
      return await request<{ success: true; data: PairingRecord[] }>('GET', `/admin/pairing${suffix ? `?${suffix}` : ''}`);
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        return { success: true, data: [] };
      }
      throw err;
    }
  },
  approve: (channel: string, code: string) => request<Record<string, unknown>>('POST', '/admin/pairing/approve', { channel, code }),
  deny: (channel: string, code: string, block?: boolean) => request<Record<string, unknown>>('POST', '/admin/pairing/deny', {
    channel,
    code,
    block: Boolean(block),
  }),
  allowlist: (channel: string, sender_id: string) => request<Record<string, unknown>>('POST', '/admin/pairing/allowlist', {
    channel,
    sender_id,
  }),
};

// ── Tool Runs ──
export const toolRuns = {
  list: (params?: { tool_name?: string; status?: string; limit?: number; chat_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.tool_name) qs.set('tool_name', params.tool_name);
    if (params?.status) qs.set('status', params.status);
    if (params?.chat_id) qs.set('chat_id', params.chat_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    return request<{ rows: ToolRunRecord[] }>('GET', `/admin/runs?${qs}`);
  },
  get: (id: string) => request<ToolRunRecord>('GET', `/admin/runs/${id}`),
  auditExport: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const suffix = qs.toString();
    return request<{ success?: boolean; data?: GenericRow[]; exported_at?: string }>(
      'GET',
      `/admin/audit/export${suffix ? `?${suffix}` : ''}`,
    );
  },
};

// ── A2A Audit ──
export const a2a = {
  auditExport: (params?: {
    from?: string;
    to?: string;
    status?: string;
    request_id?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.status) qs.set('status', params.status);
    if (params?.request_id) qs.set('request_id', params.request_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    const suffix = qs.toString();
    return request<{ success?: boolean; data?: A2AAuditRecord[]; exported_at?: string }>(
      'GET',
      `/admin/a2a/audit/export${suffix ? `?${suffix}` : ''}`,
    );
  },
  auditExportCsvUrl: (params?: {
    from?: string;
    to?: string;
    status?: string;
    request_id?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    qs.set('format', 'csv');
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.status) qs.set('status', params.status);
    if (params?.request_id) qs.set('request_id', params.request_id);
    if (params?.limit) qs.set('limit', String(params.limit));
    return `${BASE}/admin/a2a/audit/export?${qs.toString()}`;
  },
};

// ── Backups ──
export const backups = {
  status: () =>
    request<{
      status: string;
      metrics?: Record<string, unknown>;
    }>('GET', '/admin/backup/status'),
  configs: () =>
    request<{
      status: string;
      configs?: BackupConfigRecord[];
    }>('GET', '/admin/backup/configs'),
  updateConfig: (configId: string, data: {
    enabled?: boolean;
    scheduleCron?: string;
    retentionDays?: number;
    storagePath?: string;
  }) =>
    request<{
      status: string;
      updated?: boolean;
    }>('PUT', `/admin/backup/configs/${encodeURIComponent(configId)}`, data),
  list: (limit = 50) =>
    request<{
      status: string;
      backups?: BackupJobRecord[];
      count?: number;
    }>('GET', `/admin/backups?limit=${encodeURIComponent(String(limit))}`),
  start: (configId: string) =>
    request<{
      status: string;
      backup?: BackupJobRecord;
    }>('POST', '/admin/backup/start', { configId }),
  verify: (backupId: string) =>
    request<{
      status: string;
      verified?: boolean;
    }>('POST', `/admin/backup/${encodeURIComponent(backupId)}/verify`),
  restores: (limit = 50) =>
    request<{
      status: string;
      restores?: RestoreJobRecord[];
      count?: number;
    }>('GET', `/admin/restores?limit=${encodeURIComponent(String(limit))}`),
  startRestore: (data: {
    backupJobId: string;
    targetEnvironment: string;
    reason?: string;
    userId?: string;
  }) =>
    request<{
      status: string;
      restore?: RestoreJobRecord;
    }>('POST', '/admin/restore', data),
  upload: (data: { fileName: string; contentBase64: string; configId?: string }) =>
    request<{
      status: string;
      backup?: BackupJobRecord;
    }>('POST', '/admin/backup/upload', data),
};

// ── Permissions ──
export const permissions = {
  list: () => request<{ rows: Record<string, unknown>[] }>('GET', '/admin/permissions'),
  grant: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/permissions', data),
  revoke: (id: string) => request<void>('DELETE', `/admin/permissions/${id}`),
};

// ── Settings ──
export const settings = {
  list: async () => {
    const res = await request<{
      success?: boolean;
      data?: Array<{ key: string; value: unknown }>;
      rows?: Array<{ key: string; value: unknown }>;
    }>('GET', '/admin/settings');
    const rows = Array.isArray(res.rows) ? res.rows : Array.isArray(res.data) ? res.data : [];
    return { rows };
  },
  get: async (key: string) => {
    try {
      const res = await request<{
        success?: boolean;
        data?: { key: string; value: unknown };
        key?: string;
        value?: unknown;
      }>('GET', `/admin/settings/${key}`);
      if (res.data && typeof res.data.key === 'string') return res.data;
      return { key: String(res.key || key), value: res.value ?? null };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return { key, value: null };
      }
      throw err;
    }
  },
  set: async (key: string, value: unknown) => {
    const res = await request<{
      success?: boolean;
      data?: { key: string; value: unknown };
      key?: string;
      value?: unknown;
    }>('PUT', `/admin/settings/${key}`, { value });
    if (res.data && typeof res.data.key === 'string') return res.data;
    return { key: String(res.key || key), value: res.value ?? null };
  },
  edgeAdmin47Access: () =>
    request<{
      success: true;
      data: { enabled: boolean; allowed_ips: string[]; rendered_conf: string };
    }>('GET', '/admin/settings/edge/admin47/access'),
  syncEdgeAdmin47Access: (reload = true, reason: string) =>
    request<{
      success: true;
      data: {
        enabled: boolean;
        allowed_ips: string[];
        policy_entries_applied: number;
        nginx_test_ok: boolean;
        nginx_reloaded: boolean;
        nginx_reload_ok?: boolean | null;
        include_hook_detected?: boolean;
      };
    }>('POST', '/admin/settings/edge/admin47/access/sync', { reload, reason }),
  getSso: () =>
    request<{ success: true; data: SsoConfig }>('GET', '/admin/settings/sso'),
  setSso: (payload: SsoConfig) =>
    request<{
      success: true;
      data: { key: string; value: SsoConfig; updated_at?: string | null };
    }>('PUT', '/admin/settings/sso', payload),
};

// ── Registry ──
export const registry = {
  sources: () => requestRowsSoft('/admin/registry/sources'),
  createSource: (data: {
    name: string;
    type: 'public' | 'private' | 'local';
    url?: string;
    path?: string;
    enabled?: boolean;
  }) => request<Record<string, unknown>>('POST', '/admin/registry/sources', data),
  deleteSource: (id: string) => request<void>('DELETE', `/admin/registry/sources/${id}`),
  catalog: (name?: string) =>
    requestRowsSoft(
      `/admin/registry/catalog${name ? `?name=${encodeURIComponent(name)}` : ''}`,
    ),
  installed: () => requestRowsSoft('/admin/registry/installed'),
  install: (id: string) => request<Record<string, unknown>>('POST', `/admin/registry/install/${id}`),
  promote: (id: string, review_reason: string) =>
    request<Record<string, unknown>>('POST', `/admin/registry/promote/${id}`, { review_reason }),
  setInstalledTrust: (id: string, trust_level: 'trusted' | 'quarantined' | 'blocked') =>
    request<Record<string, unknown>>('PATCH', `/admin/registry/installed/${id}`, { trust_level }),
  removeInstalled: (id: string) => request<void>('DELETE', `/admin/registry/installed/${id}`),
  quarantine: () => requestRowsSoft('/admin/registry/quarantine'),
};

// ── Souls ──
export const souls = {
  catalog: (search?: string) =>
    request<GenericSuccessDataRows>(
      'GET',
      `/admin/souls/catalog${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  installed: () => request<GenericSuccessDataRows>('GET', '/admin/souls/installed'),
  install: (payload: { id?: string; slug?: string; activate?: boolean }) =>
    request<Record<string, unknown>>('POST', '/admin/souls/install', payload),
  activate: (id: string) => request<Record<string, unknown>>('POST', `/admin/souls/activate/${id}`),
  publish: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/souls/catalog', data),
  signatures: (soulId?: string) =>
    request<GenericSuccessDataRows>(
      'GET',
      `/admin/souls/signatures${soulId ? `?soul_id=${encodeURIComponent(soulId)}` : ''}`,
    ),
  addSignature: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/souls/signatures', data),
};

// ── RAG ──
export const rag = {
  collections: () => requestRowsSoft('/admin/rag/collections'),
  sources: () => requestRowsSoft('/admin/rag/sources'),
  jobs: () => requestRowsSoft('/admin/rag/jobs'),
  triggerIndex: (collectionId: string) =>
    request<Record<string, unknown>>('POST', `/admin/rag/collections/${collectionId}/index`),
};

// ── Knowledge Graph ──
export const knowledgeGraph = {
  entities: async (params?: { type?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.type) search.set('type', params.type);
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
    if (typeof params?.offset === 'number') search.set('offset', String(params.offset));
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request<{
      entities?: GenericRow[];
      total?: number;
      limit?: number;
      offset?: number;
    }>('GET', `/admin/knowledge-graph/entities${suffix}`);
  },
  relations: async (params?: { entityId?: string; relationType?: string }) => {
    const search = new URLSearchParams();
    if (params?.entityId) search.set('entityId', params.entityId);
    if (params?.relationType) search.set('relationType', params.relationType);
    const suffix = search.toString() ? `?${search.toString()}` : '';
    return request<{
      relations?: GenericRow[];
      total?: number;
    }>('GET', `/admin/knowledge-graph/relations${suffix}`);
  },
};

// ── Models ──
export const models = {
  list: () => requestRowsSoft('/admin/models'),
  policies: () => requestRowsSoft('/admin/models/policies'),
  rollouts: () => requestRowsSoft('/admin/models/rollouts'),
  usage: (days = 1) => requestRowsSoft(`/admin/models/usage?days=${encodeURIComponent(String(days))}`),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/models', data),
  update: (id: string, data: Record<string, unknown>) => request<Record<string, unknown>>('PUT', `/admin/models/${id}`, data),
  updateRollout: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PATCH', `/admin/models/rollouts/${id}`, data),
};

// ── LiteLLM ──
export const litellm = {
  keys: () => requestRowsSoft('/admin/litellm/keys'),
  createKey: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/litellm/keys', data),
  updateKey: (id: string, data: Record<string, unknown>) => request<Record<string, unknown>>('PATCH', `/admin/litellm/keys/${id}`, data),
  deleteKey: (id: string) => request<void>('DELETE', `/admin/litellm/keys/${id}`),
};

// ── Discovery ──
export const discovery = {
  instances: () =>
    request<{
      success: true;
      data: {
        enabled: boolean;
        instances: DiscoveryInstanceRecord[];
        nats_leaf_auto_peer_enabled?: boolean;
        nats_leaf_peers?: DiscoveryNatsLeafPeerRecord[];
      };
    }>(
      'GET',
      '/admin/discovery',
    ),
};

// ── Tunnel ──
export const tunnel = {
  status: () =>
    request<{ success: true; data: TunnelStatusRecord }>(
      'GET',
      '/admin/tunnel/status',
    ),
};

// ── Community ──
export const community = {
  status: () =>
    request<{ success: true; data: CommunityStatusRecord }>(
      'GET',
      '/admin/community/status',
    ),
  accountsStatus: () =>
    request<{ success: true; data: CommunityAccountsStatusRecord }>(
      'GET',
      '/admin/community/accounts/status',
    ),
  accounts: (params?: { limit?: number; verified?: 'true' | 'false'; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.verified) qs.set('verified', params.verified);
    if (params?.q) qs.set('q', params.q);
    return request<{
      success: true;
      data: { source: string; rows: CommunityAccountRecord[]; warning: string | null };
    }>('GET', `/admin/community/accounts${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  updateAccount: (
    accountId: string,
    payload: { reputation?: number; verified?: boolean },
  ) =>
    request<{
      success: true;
      data: { source: string; row: CommunityAccountRecord | null };
    }>('PATCH', `/admin/community/accounts/${encodeURIComponent(accountId)}`, payload),
  accessRequests: (params?: { limit?: number; status?: 'pending_review' | 'approved' | 'rejected' }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    return request<{
      success: true;
      data: { source: string; rows: CommunityAccessRequestRecord[]; warning: string | null };
    }>('GET', `/admin/community/access-requests${qs.toString() ? `?${qs.toString()}` : ''}`);
  },
  resolveAccessRequest: (
    requestId: string,
    payload: { status: 'approved' | 'rejected'; review_note?: string },
  ) =>
    request<{
      success: true;
      data: {
        request_id: string;
        status: string;
        source: string;
        account_provisioned?: boolean;
        provisioned_account_id?: string | null;
        account_verified?: boolean;
        verification_evidence?: {
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
        } | null;
      };
    }>(
      'POST',
      `/admin/community/access-requests/${encodeURIComponent(requestId)}/resolve`,
      payload,
    ),
};

// ── Allowlists ──
export const allowlists = {
  list: () => request<GenericRowsResponse>('GET', '/admin/allowlists'),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/allowlists', data),
  update: (id: string, data: Record<string, unknown>) => request<Record<string, unknown>>('PUT', `/admin/allowlists/${id}`, data),
  delete: (id: string) => request<void>('DELETE', `/admin/allowlists/${id}`),
  orphans: (params?: { type?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (typeof params?.limit === 'number') qs.set('limit', String(params.limit));
    const suffix = qs.toString();
    return request<{ success: boolean; data: { total: number; rows: GenericRow[] } }>(
      'GET',
      `/admin/allowlists/orphans${suffix ? `?${suffix}` : ''}`,
    );
  },
  adoptOrphansToCurrentOrg: (payload: { confirm: true; type?: string }) =>
    request<{ success: boolean; data: { adopted: number } }>(
      'POST',
      '/admin/allowlists/orphans/adopt-current-org',
      payload,
    ),
};

// ── HA ──
export const ha = {
  config: () => request<Record<string, unknown>>('GET', '/admin/ha/config'),
  setConfig: (data: Record<string, unknown>) => request<Record<string, unknown>>('PUT', '/admin/ha/config', data),
  discoverEntities: (params?: { domain?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.domain) search.set('domain', params.domain);
    if (typeof params?.limit === 'number') search.set('limit', String(params.limit));
    const suffix = search.toString();
    return request<Record<string, unknown>>(
      'GET',
      `/admin/ha/discovery/entities${suffix ? `?${suffix}` : ''}`,
    );
  },
  subscriptions: () => request<GenericRowsResponse>('GET', '/admin/ha/subscriptions'),
  createSubscription: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/ha/subscriptions', data),
  automations: () => request<GenericRowsResponse>('GET', '/admin/ha/automations'),
  createAutomation: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/ha/automations', data),
  deleteAutomation: (id: string) => request<void>('DELETE', `/admin/ha/automations/${id}`),
};

// ── Calendar ──
export const calendar = {
  accounts: async () => {
    const payload = await request<Record<string, unknown>>('GET', '/admin/calendar/accounts');
    const data = (payload?.data || payload) as Record<string, unknown>;
    const rows = Array.isArray(data?.accounts)
      ? (data.accounts as GenericRow[])
      : Array.isArray(data?.rows)
        ? (data.rows as GenericRow[])
        : [];
    return { rows };
  },
  addAccount: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/calendar/accounts', data),
  subscriptions: async () => {
    const payload = await request<Record<string, unknown>>('GET', '/admin/calendar/subscriptions');
    const data = (payload?.data || payload) as Record<string, unknown>;
    const rows = Array.isArray(data?.subscriptions)
      ? (data.subscriptions as GenericRow[])
      : Array.isArray(data?.rows)
        ? (data.rows as GenericRow[])
        : [];
    return { rows };
  },
  subscribe: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/calendar/subscribe', data),
  unsubscribe: (id: string) => request<void>('DELETE', `/admin/calendar/subscriptions/${id}`),
};

// ── Git ──
export const git = {
  repos: () => request<GenericRowsResponse>('GET', '/admin/git/repos'),
  addRepo: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/git/repos', data),
  repoStatus: (id: string) => request<Record<string, unknown>>('GET', `/admin/git/repos/${id}/status`),
  sync: (id: string) => request<Record<string, unknown>>('POST', `/admin/git/repos/${id}/sync`),
  pullRequests: (repoId: string) =>
    request<GenericRowsResponse>('GET', `/admin/git/repos/${repoId}/pull-requests`),
  deleteRepo: (id: string) => request<void>('DELETE', `/admin/git/repos/${id}`),
};

// ── NAS ──
export const nas = {
  search: (path: string, pattern?: string) =>
    request<{ results: GenericRow[] }>('POST', '/admin/nas/search', { path, pattern }),
  list: (path: string) => request<{ entries: GenericRow[] }>('POST', '/admin/nas/list', { path }),
  preview: (path: string) => request<Record<string, unknown>>('POST', '/admin/nas/preview', { path }),
  stats: (path: string) => request<Record<string, unknown>>('POST', '/admin/nas/stats', { path }),
};

// ── Web ──
export const web = {
  allowlist: () => request<{ entries: GenericRow[] }>('GET', '/admin/web/allowlist'),
  addDomain: (pattern: string, description?: string) =>
    request<Record<string, unknown>>('POST', '/admin/web/allowlist', { pattern, description }),
  deleteDomain: (id: string) => request<void>('DELETE', `/admin/web/allowlist/${id}`),
  testFetch: (url: string) => request<Record<string, unknown>>('POST', '/admin/web/test-fetch', { url }),
  widgetSettings: () => request<WidgetSettingsRecord>('GET', '/admin/web/widget/settings'),
  updateWidgetSettings: (payload: Partial<WidgetSettingsRecord>) =>
    request<WidgetSettingsRecord>('PUT', '/admin/web/widget/settings', payload),
  widgetInstances: () => request<{ instances: WidgetInstanceRecord[] }>('GET', '/admin/web/widget/instances'),
  createWidgetInstance: (payload: { name?: string; rate_limit_rpm?: number }) =>
    request<WidgetInstanceCreateResponse>('POST', '/admin/web/widget/instances', payload),
  widgetEmbed: (instanceId: string) => request<WidgetEmbedResponse>('GET', `/admin/web/widget/embed/${encodeURIComponent(instanceId)}`),
};

// ── Search Settings ──
export const searchSettings = {
  config: () =>
    request<{
      success: boolean;
      data: {
        searxng_url: string | null;
        safe_search: 'off' | 'moderate' | 'strict';
        engines: string[];
        default_language: string;
        max_results: number;
      };
    }>('GET', '/admin/search/config'),
  updateConfig: (payload: {
    searxng_url?: string;
    safe_search?: 'off' | 'moderate' | 'strict';
    engines?: string[];
    default_language?: string;
    max_results?: number;
  }) => request<{ success: boolean; data: { updated: string[] } }>('PUT', '/admin/search/config', payload),
  testConnectivity: () =>
    request<{
      success: boolean;
      data: {
        reachable: boolean;
        status?: number;
        error?: string;
        result_count?: number;
        total_results?: number;
      };
    }>('POST', '/admin/search/test'),
  query: (payload: {
    query: string;
    num_results?: number;
    categories?: string;
    language?: string;
  }) =>
    request<{
      success: boolean;
      data: {
        query: string;
        total: number;
        results: Array<{ title: string; url: string; snippet: string; source_engine: string }>;
      };
    }>('POST', '/admin/search/query', payload),
  stats: () =>
    request<{
      success: boolean;
      data: {
        queries_per_day: number;
        daily_counts: Array<{ day: string; count: number }>;
        popular_categories: Array<{ category: string; count: number }>;
      };
    }>('GET', '/admin/search/stats'),
};

// ── Workflows ──
export const workflows = {
  list: () => requestRowsSoft('/admin/workflows'),
  get: (id: string) => request<Record<string, unknown>>('GET', `/admin/workflows/${id}`),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/workflows', data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/workflows/${id}`, data),
  toggle: (id: string, enabled: boolean) =>
    request<Record<string, unknown>>('PATCH', `/admin/workflows/${id}/toggle`, { enabled }),
  delete: (id: string) => request<void>('DELETE', `/admin/workflows/${id}`),
  execute: (id: string, input_variables?: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', `/admin/workflows/${id}/execute`, { input_variables: input_variables || {} }),
  runs: (workflowId: string) => requestRowsSoft(`/admin/workflows/${workflowId}/runs`),
};

// ── Schedules ──
export const schedules = {
  list: () => request<{ success: true; data: ScheduleRecord[] }>('GET', '/schedules'),
  get: (id: string) => request<{ success: true; data: ScheduleRecord }>('GET', `/schedules/${id}`),
  create: (data: {
    name: string;
    instruction: string;
    schedule_type: 'once' | 'recurring';
    expression?: string;
    run_at?: string;
    timezone?: string;
    enabled?: boolean;
    agent_id?: string;
    chat_id?: string;
    max_runs?: number;
    missed_policy?: 'skip' | 'run_immediately';
    notify_channels?: Array<'in_app' | 'email' | 'slack' | 'webhook'>;
    notify_email_to?: string;
    notify_webhook_url?: string;
    notify_slack_webhook_url?: string;
  }) => request<{ success: true; data: Record<string, unknown> }>('POST', '/schedules', data),
  update: (id: string, data: {
    name?: string;
    instruction?: string;
    expression?: string;
    run_at?: string;
    timezone?: string;
    enabled?: boolean;
    agent_id?: string;
    chat_id?: string;
    max_runs?: number | null;
    missed_policy?: 'skip' | 'run_immediately';
    notify_channels?: Array<'in_app' | 'email' | 'slack' | 'webhook'>;
    notify_email_to?: string;
    notify_webhook_url?: string;
    notify_slack_webhook_url?: string;
  }) => request<{ success: true }>('PUT', `/schedules/${id}`, data),
  remove: (id: string) => request<{ success: true }>('DELETE', `/schedules/${id}`),
  history: (id: string, limit = 10) =>
    request<{ success: true; data: ScheduleRunRecord[] }>('GET', `/schedules/${id}/history?limit=${limit}`),
  runNow: (id: string) => request<{ success: true }>('POST', `/schedules/${id}/run`),
};

// ── Cron ──
export const cron = {
  list: () => request<{ success: true; data: GenericRow[] }>('GET', '/admin/cron'),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/cron', data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/cron/${id}`, data),
  remove: (id: string) => request<void>('DELETE', `/admin/cron/${id}`),
  runNow: (id: string) => request<Record<string, unknown>>('POST', `/admin/cron/${id}/run`),
  history: (id: string, limit = 50) =>
    request<{ success: true; data: GenericRow[] }>('GET', `/admin/cron/${id}/history?limit=${limit}`),
};

// ── Webhooks ──
export const webhooks = {
  list: () => request<{ success: true; data: GenericRow[] }>('GET', '/admin/webhooks'),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/webhooks', data),
  update: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/webhooks/${id}`, data),
  remove: (id: string) => request<void>('DELETE', `/admin/webhooks/${id}`),
  events: (id: string, limit = 50) =>
    request<{ success: true; data: GenericRow[] }>('GET', `/admin/webhooks/${id}/events?limit=${limit}`),
};

// ── Email (Gmail Pub/Sub) ──
export const email = {
  config: () => requestSuccessRowsSoft('/admin/email/config'),
  setConfig: (data: Record<string, unknown>) => request<Record<string, unknown>>('PUT', '/admin/email/config', data),
  subscriptions: () => requestSuccessRowsSoft('/admin/email/subscriptions'),
  createSubscription: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/email/subscriptions', data),
  updateSubscription: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/email/subscriptions/${id}`, data),
  deleteSubscription: (id: string) => request<void>('DELETE', `/admin/email/subscriptions/${id}`),
  events: (id: string, limit = 50) =>
    requestSuccessRowsSoft(`/admin/email/subscriptions/${id}/events?limit=${limit}`),
  test: (id: string, payload?: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', `/admin/email/subscriptions/${id}/test`, payload || { test: true }),
  readMessage: (messageId: string, params?: { format?: string; user_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.format) qs.set('format', params.format);
    if (params?.user_id) qs.set('user_id', params.user_id);
    const suffix = qs.toString();
    return request<Record<string, unknown>>(
      'GET',
      `/admin/email/messages/${encodeURIComponent(messageId)}${suffix ? `?${suffix}` : ''}`,
    );
  },
  patchLabels: (messageId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', `/admin/email/messages/${encodeURIComponent(messageId)}/labels`, data),
  archive: (messageId: string, user_id?: string) =>
    request<Record<string, unknown>>('POST', `/admin/email/messages/${encodeURIComponent(messageId)}/archive`, { user_id }),
};

// ── Incidents ──
export const incidents = {
  status: () => request<Record<string, unknown>>('GET', '/admin/incident/status'),
  killSwitch: (enabled: boolean) =>
    request<Record<string, unknown>>(
      'POST',
      enabled ? '/admin/incident/kill-switch/activate' : '/admin/incident/kill-switch/deactivate',
      enabled ? { reason: 'manual toggle from admin ui', severity: 'critical' } : {},
    ),
  lockdown: (enabled: boolean) =>
    request<Record<string, unknown>>(
      'POST',
      enabled ? '/admin/incident/lockdown/enable' : '/admin/incident/lockdown/disable',
      enabled ? { reason: 'manual toggle from admin ui', severity: 'high' } : {},
    ),
  forensics: (enabled: boolean) =>
    request<Record<string, unknown>>(
      'POST',
      enabled ? '/admin/incident/forensics/enable' : '/admin/incident/forensics/disable',
      enabled ? { reason: 'manual toggle from admin ui', severity: 'critical' } : {},
    ),
  executeEscalationRules: () =>
    request<Record<string, unknown>>('POST', '/admin/incident/escalation-rules/execute'),
  emergencyNotify: (data: {
    channel: string;
    recipients: string[];
    title: string;
    message: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }) => request<Record<string, unknown>>('POST', '/admin/incident/emergency-notify', data),
};

// ── Health ──
export const health = {
  all: async () => {
    const res = await fetch('/healthz', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new ApiError(res.status, null);
    return (await res.json()) as Record<string, unknown>;
  },
};

// ── Performance ──
export const performance = {
  healthCheck: () => request<Record<string, unknown>>('POST', '/admin/performance/health-check'),
  selfCorrection: (windowHours = 168) =>
    request<Record<string, unknown>>('GET', `/admin/performance/self-correction?window_hours=${windowHours}`),
};

// ── Policy Simulator ──
export const policy = {
  simulate: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/policy/simulate', data),
};

// ── Memory ──
export const memory = {
  list: (params?: {
    user_id?: string;
    chat_id?: string;
    visibility?: string;
    source?: string;
    key?: string;
    search?: string;
    exact?: string;
    sort_by?: string;
    sort_dir?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.user_id) qs.set('user_id', params.user_id);
    if (params?.chat_id) qs.set('chat_id', params.chat_id);
    if (params?.visibility) qs.set('visibility', params.visibility);
    if (params?.source) qs.set('source', params.source);
    if (params?.key) qs.set('key', params.key);
    if (params?.search) qs.set('search', params.search);
    if (params?.exact) qs.set('exact', params.exact);
    if (params?.sort_by) qs.set('sort_by', params.sort_by);
    if (params?.sort_dir) qs.set('sort_dir', params.sort_dir);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.per_page) qs.set('per_page', String(params.per_page));
    const suffix = qs.toString();
    return request<{ success: boolean; data: GenericRow[]; meta?: Record<string, unknown> }>(
      'GET',
      `/admin/memories${suffix ? `?${suffix}` : ''}`,
    );
  },
  detail: (id: string) => request<{ success: boolean; data: GenericRow }>('GET', `/admin/memories/${id}`),
  update: (id: string, data: { visibility?: string; key?: string; value?: string; importance?: number }) =>
    request<{ success: boolean; data: GenericRow }>('PUT', `/admin/memories/${id}`, data),
  delete: (id: string) => request<{ success: boolean }>('DELETE', `/admin/memories/${id}`),
  bulkDelete: (ids: string[]) => request<{ success: boolean; data: { deleted: number } }>('DELETE', '/admin/memories/bulk', { ids }),
  stats: () => request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/memories/stats'),
  export: (format: 'json' | 'csv' = 'json', params?: { visibility?: string; user_id?: string; chat_id?: string }) => {
    const qs = new URLSearchParams({ format });
    if (params?.visibility) qs.set('visibility', params.visibility);
    if (params?.user_id) qs.set('user_id', params.user_id);
    if (params?.chat_id) qs.set('chat_id', params.chat_id);
    return fetch(`${BASE}/admin/memories/export?${qs.toString()}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }).then(async (res) => {
      if (!res.ok) throw new ApiError(res.status, null);
      return await res.text();
    });
  },
  importJson: (memories: Array<{ user_id?: string; chat_id?: string; visibility?: string; key?: string; value?: string; source?: string; importance?: number }>) =>
    request<{ success: boolean; data: { imported: number; skipped: number; total: number } }>(
      'POST',
      '/admin/memories/import',
      { memories },
    ),
  search: (data: { query: string; user_id?: string; chat_id?: string; visibility?: string; top_k?: number }) =>
    request<Record<string, unknown>>('POST', '/admin/memories/search', data),
  extract: (data: { text: string; user_id?: string; chat_id?: string; visibility?: string }) =>
    request<Record<string, unknown>>('POST', '/admin/memories/extract', data),
  consolidate: (data?: { user_id?: string; chat_id?: string }) =>
    request<Record<string, unknown>>('POST', '/admin/memories/consolidate', data || {}),
  decay: (data?: { half_life_days?: number; floor?: number }) =>
    request<Record<string, unknown>>('POST', '/admin/memories/decay', data || {}),
};

// ── Improvements ──
export const improvements = {
  list: () => requestRowsSoft('/admin/improvements'),
  approve: (id: string) => request<Record<string, unknown>>('POST', `/admin/improvements/${id}/approve`),
  dismiss: (id: string) => request<Record<string, unknown>>('POST', `/admin/improvements/${id}/dismiss`),
};

// ── MCP ──
export const mcp = {
  servers: () => requestSuccessRowsSoft('/admin/mcp-servers'),
  presets: () => requestSuccessRowsSoft('/admin/mcp-presets'),
  sharedTokenConfig: () =>
    request<{ success: boolean; data: { enabled: boolean; token_configured: boolean; token_preview: string | null } }>(
      'GET',
      '/admin/mcp-shared-token-config',
    ),
  updateSharedTokenConfig: (data: { enabled?: boolean; token?: string }) =>
    request<{ success: boolean; data: { enabled: boolean; token_configured: boolean; token_preview: string | null } }>(
      'PUT',
      '/admin/mcp-shared-token-config',
      data,
    ),
  createServer: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/mcp-servers', data),
  deleteServer: (id: string) => request<void>('DELETE', `/admin/mcp-servers/${id}`),
  testServer: (id: string) => request<Record<string, unknown>>('POST', `/admin/mcp-servers/${id}/test`),
  reconnectAll: () => request<Record<string, unknown>>('POST', '/admin/mcp-servers/reconnect'),
  catalog: (chatId?: string) =>
    requestSuccessRowsSoft(`/admin/mcp-catalog${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`),
  chatOverrides: (chatId?: string) =>
    requestSuccessRowsSoft(`/admin/mcp-chat-overrides${chatId ? `?chat_id=${encodeURIComponent(chatId)}` : ''}`),
  upsertChatOverride: (chatId: string, serverId: string, enabled: boolean) =>
    request<Record<string, unknown>>('PUT', `/admin/mcp-chat-overrides/${encodeURIComponent(chatId)}/${encodeURIComponent(serverId)}`, { enabled }),
  deleteChatOverride: (chatId: string, serverId: string) =>
    request<void>('DELETE', `/admin/mcp-chat-overrides/${encodeURIComponent(chatId)}/${encodeURIComponent(serverId)}`),
};

// ── Global Search ──
export const globalSearch = {
  query: (q: string, limit = 20) =>
    request<{ success: boolean; data: Array<{ type: string; title: string; description?: string; href: string }>; meta?: Record<string, unknown> }>(
      'GET',
      `/admin/global-search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(String(limit))}`,
    ),
};

// ── Obsidian Sync ──
export const obsidianSync = {
  status: () => request<Record<string, unknown>>('GET', '/admin/integrations/obsidian/sync/status'),
  exportMemories: (payload?: {
    folder?: string;
    visibility?: 'user_private' | 'chat_shared' | 'global';
    user_id?: string;
    chat_id?: string;
    limit?: number;
  }) =>
    request<Record<string, unknown>>('POST', '/admin/integrations/obsidian/sync/export', payload || {}),
  importMemories: (payload?: { folder?: string; limit?: number }) =>
    request<Record<string, unknown>>('POST', '/admin/integrations/obsidian/sync/import', payload || {}),
};

// ── Integration Runtime ──
export const integrationRuntime = {
  list: () =>
    request<{ success: boolean; data: IntegrationRuntimeInstance[] }>('GET', '/admin/integrations/runtime'),
  get: (integrationType: string) =>
    request<{ success: boolean; data: IntegrationRuntimeDetail }>(
      'GET',
      `/admin/integrations/runtime/${encodeURIComponent(integrationType)}`,
    ),
  setConfig: (
    integrationType: string,
    payload: { config?: Record<string, unknown>; secret_refs?: Record<string, string> },
  ) =>
    request<{ success: boolean; data: { integration_type: string; updated: boolean; secret_ref_count: number } }>(
      'PUT',
      `/admin/integrations/runtime/${encodeURIComponent(integrationType)}/config`,
      payload,
    ),
  deploy: (
    integrationType: string,
    payload?: {
      runtime_mode?: IntegrationRuntimeMode;
      image_ref?: string;
      deployment_spec?: Record<string, unknown>;
    },
  ) =>
    request<{
      success: boolean;
      data: {
        integration_type: string;
        runtime_mode: IntegrationRuntimeMode;
        status: IntegrationRuntimeStatus;
        storage_path: string;
        network_scope: string;
        command_executed: boolean;
        runtime_hooks?: IntegrationRuntimeHookReadiness;
      };
    }>('POST', `/admin/integrations/runtime/${encodeURIComponent(integrationType)}/deploy`, payload || {}),
  stop: (integrationType: string) =>
    request<{
      success: boolean;
      data: {
        integration_type: string;
        status: IntegrationRuntimeStatus;
        updated_at: string;
        runtime_hooks?: IntegrationRuntimeHookReadiness;
      };
    }>('POST', `/admin/integrations/runtime/${encodeURIComponent(integrationType)}/stop`, {}),
  reconcile: () =>
    request<{
      success: boolean;
      data: IntegrationRuntimeReconcileReport;
    }>('POST', '/admin/integrations/runtime/reconcile', {}),
  bootEvents: (
    params?: {
      limit?: number;
      status?: string;
      integration_type?: string;
      chat_id?: string;
    },
  ) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(1, Math.min(200, Math.trunc(params?.limit || 50)))));
    if (params?.status) qs.set('status', params.status);
    if (params?.integration_type) qs.set('integration_type', params.integration_type);
    if (params?.chat_id) qs.set('chat_id', params.chat_id);
    return request<{ success: boolean; data: IntegrationRuntimeBootEvent[] }>(
      'GET',
      `/admin/integrations/runtime/boot-events?${qs.toString()}`,
    );
  },
};

export const integrations = {
  catalog: () =>
    request<{ success: boolean; data: IntegrationCatalogRow[] }>('GET', '/admin/integrations/catalog'),
  library: () =>
    request<{ success: boolean; data: IntegrationLibraryProfile[] }>('GET', '/admin/integrations/catalog/library'),
  installLibraryProfile: (
    profileId: string,
    payload?: {
      deploy_runtime?: boolean;
      overwrite_existing?: boolean;
      setting_overrides?: Record<string, unknown>;
      runtime_mode?: 'container' | 'local_worker';
      image_ref?: string;
      integration_ids?: string[];
    },
  ) =>
    request<{
      success: boolean;
      data: {
        profile_id: string;
        profile_name: string;
        requested: number;
        attempted: number;
        succeeded: number;
        failed: number;
        runtime_non_executed_deploys?: number;
        require_runtime_execution?: boolean;
        execution_guard_triggered?: boolean;
        results: Array<{
          integration_id: string;
          ok: boolean;
          data?: Record<string, unknown>;
          error?: Record<string, unknown>;
        }>;
      };
    }>('POST', `/admin/integrations/catalog/library/${encodeURIComponent(profileId)}/install`, payload || {}),
  applyTemplate: (
    integrationId: string,
    payload?: {
      deploy_runtime?: boolean;
      overwrite_existing?: boolean;
      setting_overrides?: Record<string, unknown>;
      runtime_mode?: 'container' | 'local_worker';
      image_ref?: string;
    },
  ) =>
    request<{
      success: boolean;
      data: {
        integration_id: string;
        integration_type: string;
        applied_settings: string[];
        deploy_runtime: boolean;
        runtime_mode: 'container' | 'local_worker';
        image_ref?: string | null;
      };
    }>('POST', `/admin/integrations/catalog/${encodeURIComponent(integrationId)}/apply-template`, payload || {}),
  validate: (integrationId: string) =>
    request<{ success: boolean; data: IntegrationCatalogValidation }>(
      'GET',
      `/admin/integrations/catalog/${encodeURIComponent(integrationId)}/validate`,
    ),
  runRecoveryPlaybook: (payload?: {
    retry_failed?: boolean;
    deploy_stopped?: boolean;
    apply_templates_unconfigured?: boolean;
    validate_unconfigured?: boolean;
    overwrite_existing?: boolean;
    boot_event_limit?: number;
  }) =>
    request<{
      success: boolean;
      data: {
        run_id: string;
        organization_id: string;
        targets: {
          failed_runtime_types: string[];
          stopped_runtime_types: string[];
          unconfigured_integration_ids: string[];
          unconfigured_count: number;
        };
        options: {
          retry_failed: boolean;
          deploy_stopped: boolean;
          apply_templates_unconfigured: boolean;
          validate_unconfigured: boolean;
          overwrite_existing: boolean;
        };
        summary: Record<string, { enabled: boolean; attempted: number; succeeded: number; failed: number }>;
      };
    }>('POST', '/admin/integrations/catalog/recovery-playbook', payload || {}),
  recoveryPlaybookRuns: (params?: {
    limit?: number;
    page?: number;
    has_failures?: boolean;
    run_status?: 'in_progress' | 'completed' | 'failed';
    actor_user_id?: string;
    from?: string;
    to?: string;
    sort?: 'created_at';
    order?: 'asc' | 'desc';
  }) => {
    const qs = new URLSearchParams();
    qs.set('limit', String(Math.max(1, Math.min(100, Math.trunc(params?.limit || 20)))));
    qs.set('page', String(Math.max(1, Math.trunc(params?.page || 1))));
    if (typeof params?.has_failures === 'boolean') qs.set('has_failures', String(params.has_failures));
    if (params?.run_status) qs.set('run_status', params.run_status);
    if (params?.actor_user_id) qs.set('actor_user_id', params.actor_user_id);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);
    return request<{
      success: boolean;
      data: IntegrationRecoveryPlaybookRun[];
      meta?: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
        sort: string;
        order: string;
        status_counts?: {
          in_progress: number;
          completed: number;
          failed: number;
        };
      };
    }>(
      'GET',
      `/admin/integrations/catalog/recovery-playbook/runs?${qs.toString()}`,
    );
  },
  recoveryPlaybookRunsCsvUrl: (params?: {
    limit?: number;
    page?: number;
    has_failures?: boolean;
    run_status?: 'in_progress' | 'completed' | 'failed';
    actor_user_id?: string;
    from?: string;
    to?: string;
    sort?: 'created_at';
    order?: 'asc' | 'desc';
  }) => {
    const qs = new URLSearchParams();
    qs.set('format', 'csv');
    qs.set('limit', String(Math.max(1, Math.min(1000, Math.trunc(params?.limit || 100)))));
    qs.set('page', String(Math.max(1, Math.trunc(params?.page || 1))));
    if (typeof params?.has_failures === 'boolean') qs.set('has_failures', String(params.has_failures));
    if (params?.run_status) qs.set('run_status', params.run_status);
    if (params?.actor_user_id) qs.set('actor_user_id', params.actor_user_id);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.sort) qs.set('sort', params.sort);
    if (params?.order) qs.set('order', params.order);
    return `${BASE}/admin/integrations/catalog/recovery-playbook/runs?${qs.toString()}`;
  },
  recoveryPlaybookRun: (runId: string) =>
    request<{ success: boolean; data: IntegrationRecoveryPlaybookRunDetail }>(
      'GET',
      `/admin/integrations/catalog/recovery-playbook/runs/${encodeURIComponent(runId)}`,
    ),
};

// ── Agents ──
export const agents = {
  list: () => requestSuccessRowsSoft('/admin/agents'),
  create: (data: Record<string, unknown>) => request<Record<string, unknown>>('POST', '/admin/agents', data),
  config: (id: string) => request<Record<string, unknown>>('GET', `/admin/agents/${id}/config`),
  setConfig: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/agents/${id}/config`, data),
  spawnSession: (
    id: string,
    data: {
      session_id?: string;
      parent_agent_id?: string;
      session_name?: string;
      chat_type?: 'dm' | 'group' | 'hq';
      system_prompt?: string;
      model_name?: string;
      profile_name?: string;
      policy_scope?: string[] | string;
      routing_rules?: Record<string, unknown>;
    },
  ) => request<Record<string, unknown>>('POST', `/admin/agents/${id}/spawn-session`, data),
  routingRules: (params?: { agent_id?: string; channel?: string; enabled?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.agent_id) qs.set('agent_id', params.agent_id);
    if (params?.channel) qs.set('channel', params.channel);
    if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled));
    const suffix = qs.toString();
    return requestSuccessRowsSoft(`/admin/agents/routing-rules${suffix ? `?${suffix}` : ''}`);
  },
  createRoutingRule: (data: Record<string, unknown>) =>
    request<Record<string, unknown>>('POST', '/admin/agents/routing-rules', data),
  updateRoutingRule: (id: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>('PUT', `/admin/agents/routing-rules/${id}`, data),
  deleteRoutingRule: (id: string) => request<void>('DELETE', `/admin/agents/routing-rules/${id}`),
};

export const agentAnalytics = {
  summary: (params?: { range?: '24h' | '7d' | '30d' | 'custom'; start?: string; end?: string }) => {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    const suffix = qs.toString();
    return request<{ success: boolean; data: { window: AgentAnalyticsWindow; rows: AgentAnalyticsRow[] } }>(
      'GET',
      `/admin/agents/analytics${suffix ? `?${suffix}` : ''}`,
    );
  },
  exportCsvUrl: (params?: { range?: '24h' | '7d' | '30d' | 'custom'; start?: string; end?: string }) => {
    const qs = new URLSearchParams({ format: 'csv' });
    if (params?.range) qs.set('range', params.range);
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    return `${BASE}/admin/agents/analytics/export?${qs.toString()}`;
  },
  alerts: () =>
    request<{ success: boolean; data: AgentAnalyticsAlertThresholds }>('GET', '/admin/agents/analytics/alerts'),
  setAlerts: (payload: AgentAnalyticsAlertThresholds) =>
    request<{ success: boolean; data: AgentAnalyticsAlertThresholds }>('PUT', '/admin/agents/analytics/alerts', payload),
  evaluateAlerts: (params?: { range?: '24h' | '7d' | '30d' | 'custom'; start?: string; end?: string }) => {
    const qs = new URLSearchParams();
    if (params?.range) qs.set('range', params.range);
    if (params?.start) qs.set('start', params.start);
    if (params?.end) qs.set('end', params.end);
    const suffix = qs.toString();
    return request<{
      success: boolean;
      data: {
        window: AgentAnalyticsWindow;
        thresholds: AgentAnalyticsAlertThresholds;
        triggered_count: number;
        triggered: Array<{ agent_id: string; agent_name: string; triggers: string[] }>;
      };
    }>('GET', `/admin/agents/analytics/alerts/evaluate${suffix ? `?${suffix}` : ''}`);
  },
};

// ── AI Pipelines (Gemma 4 admin endpoints) ──

const aiPipelines = {
  imageStats: () => requestRowsSoft('/admin/pipeline/image/stats'),
  imagePolicy: () => requestRowsSoft('/admin/pipeline/image/policy'),
  imageJobs: () => requestRowsSoft('/admin/pipeline/image/jobs'),
  scribeStats: () => requestRowsSoft('/admin/pipeline/scribe/stats'),
  scribeConfig: () => requestRowsSoft('/admin/pipeline/scribe/config'),
  scribeSessions: () => requestRowsSoft('/admin/pipeline/scribe/sessions'),
  actionStats: () => requestRowsSoft('/admin/pipeline/actions/stats'),
  actionBuiltins: () => requestRowsSoft('/admin/pipeline/actions/builtins'),
  actionExecutions: () => requestRowsSoft('/admin/pipeline/actions/executions'),
  routingPolicy: () => requestRowsSoft('/admin/gemma4/routing/policy'),
  routingStats: () => requestRowsSoft('/admin/gemma4/routing/stats'),
  privacyPolicy: () => requestRowsSoft('/admin/gemma4/privacy/policy'),
  privacyVerify: () => requestRowsSoft('/admin/gemma4/privacy/verify'),
  privacyBlockedDomains: () => requestRowsSoft('/admin/gemma4/privacy/blocked-domains'),
  privacyAuditStats: () => requestRowsSoft('/admin/gemma4/privacy/audit-stats'),
  modulesList: () => requestRowsSoft('/admin/gemma4/modules'),
  modulesInstalled: () => requestRowsSoft('/admin/gemma4/modules/installed'),
  modulesStats: () => requestRowsSoft('/admin/gemma4/modules/stats'),
  updateRoutingPolicy: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', '/admin/gemma4/routing/policy', body),
  updatePrivacyPolicy: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', '/admin/gemma4/privacy/policy', body),
};

// ── Brain Admin (Batch 2: Memory + EQ) ──

const brain = {
  graph: (userId?: string) => requestRowsSoft(`/admin/brain/graph${userId ? `?user_id=${userId}` : ''}`),
  decayTrajectory: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: unknown }>('POST', '/admin/brain/decay-trajectory', body),
  quantumFadeConfig: () => requestRowsSoft('/admin/memory/quantum-fade-config'),
  updateQuantumFadeConfig: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', '/admin/memory/quantum-fade-config', body),
  emotionalHistory: (params?: string) => requestRowsSoft(`/admin/emotional/history${params ? `?${params}` : ''}`),
  emotionalSummary: (days = 30) => requestRowsSoft(`/admin/emotional/summary?days=${days}`),
  reasoning: (params?: string) => requestRowsSoft(`/admin/reasoning${params ? `?${params}` : ''}`),
  reasoningUnderstanding: () => requestRowsSoft('/admin/reasoning/understanding'),
  memoryConsent: () => requestRowsSoft('/admin/memory/consent'),
  updateMemoryConsent: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', '/admin/memory/consent', body),
  memoryExport: () => requestRowsSoft('/admin/memory/export'),
  memoryForget: () => request<{ success: boolean }>('POST', '/admin/memory/forget', {}),
};

// ── Community Agents (Batch 3 + 4: Agents, Calibration, Corrections) ──

const communityAgents = {
  personas: (params?: string) => requestRowsSoft(`/admin/community-agents/personas${params ? `?${params}` : ''}`),
  createPersona: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/community-agents/personas', body),
  updatePersona: (agentId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', `/admin/community-agents/personas/${agentId}`, body),
  updatePersonaStatus: (agentId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/community-agents/personas/${agentId}/status`, body),
  updatePersonaVisibility: (agentId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/community-agents/personas/${agentId}/visibility`, body),
  agentInbox: (agentId: string) => requestRowsSoft(`/admin/community-agents/messages/${agentId}/inbox`),
  messageThread: (threadId: string) => requestRowsSoft(`/admin/community-agents/messages/thread/${threadId}`),
  rateLimits: (agentId: string) => requestRowsSoft(`/admin/community-agents/rate-limits/${agentId}`),
  updateRateLimits: (agentId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/community-agents/rate-limits/${agentId}`, body),
  moderationPending: (params?: string) => requestRowsSoft(`/admin/community-agents/moderation/pending${params ? `?${params}` : ''}`),
  reviewModeration: (decisionId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', `/admin/community-agents/moderation/${decisionId}/review`, body),
  changelog: (params?: string) => requestRowsSoft(`/admin/community-agents/changelog${params ? `?${params}` : ''}`),
  createChangelog: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/community-agents/changelog', body),
  publishChangelog: (entryId: string) =>
    request<{ success: boolean }>('PATCH', `/admin/community-agents/changelog/${entryId}/publish`, {}),
  confidenceCalibration: (days = 30) => requestRowsSoft(`/admin/community-agents/confidence/calibration?days=${days}`),
  confidenceLow: () => requestRowsSoft('/admin/community-agents/confidence/low'),
  feedbackSignal: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/community-agents/feedback/signal', body),
  feedbackTaskSummary: (days = 30) => requestRowsSoft(`/admin/community-agents/feedback/task-summary?days=${days}`),
  corrections: (params?: string) => requestRowsSoft(`/admin/community-agents/corrections${params ? `?${params}` : ''}`),
  submitCorrection: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/community-agents/corrections', body),
  verifyCorrection: (correctionId: string) =>
    request<{ success: boolean }>('POST', `/admin/community-agents/corrections/${correctionId}/verify`, {}),
  promoteCorrection: (correctionId: string) =>
    request<{ success: boolean }>('POST', `/admin/community-agents/corrections/${correctionId}/promote`, {}),
  patterns: (params?: string) => requestRowsSoft(`/admin/community-agents/patterns${params ? `?${params}` : ''}`),
  updatePatternStatus: (patternId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/community-agents/patterns/${patternId}/status`, body),
  selfImprovementSnapshots: (days = 30) => requestRowsSoft(`/admin/community-agents/self-improvement/snapshots?days=${days}`),
};

// ── Federation (Batch 5: Identity, Peers, Homeserver, Community, Delegation, Consent, Sovereignty, Health) ──

const federation = {
  identity: () => requestRowsSoft('/admin/federation/identity'),
  generateIdentity: () => request<{ success: boolean }>('POST', '/admin/federation/identity/generate', {}),
  rotateIdentity: () => request<{ success: boolean }>('POST', '/admin/federation/identity/rotate', {}),
  identityHistory: () => requestRowsSoft('/admin/federation/identity/history'),
  signPayload: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: unknown }>('POST', '/admin/federation/identity/sign', body),
  verifySignature: (body: Record<string, unknown>) =>
    request<{ success: boolean; data: unknown }>('POST', '/admin/federation/identity/verify', body),
  peers: (params?: string) => requestRowsSoft(`/admin/federation/peers${params ? `?${params}` : ''}`),
  peer: (peerId: string) => requestRowsSoft(`/admin/federation/peers/${peerId}`),
  registerPeer: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/federation/peers', body),
  handshake: (peerId: string) =>
    request<{ success: boolean }>('POST', `/admin/federation/peers/${peerId}/handshake`, {}),
  completeHandshake: (peerId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', `/admin/federation/peers/${peerId}/handshake/complete`, body),
  updateTrust: (peerId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/federation/peers/${peerId}/trust`, body),
  prunePeers: () => request<{ success: boolean }>('POST', '/admin/federation/peers/prune', {}),
  homeserverConnect: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/federation/homeserver/connect', body),
  homeserverHeartbeat: () =>
    request<{ success: boolean }>('POST', '/admin/federation/homeserver/heartbeat', {}),
  homeserverDisconnect: (connectionId: string) =>
    request<{ success: boolean }>('POST', `/admin/federation/homeserver/${connectionId}/disconnect`, {}),
  homeserverConnections: (params?: string) => requestRowsSoft(`/admin/federation/homeserver/connections${params ? `?${params}` : ''}`),
  homeserverConfig: () => requestRowsSoft('/admin/federation/homeserver/config'),
  homeserverStats: () => requestRowsSoft('/admin/federation/homeserver/stats'),
  communityTopics: (params?: string) => requestRowsSoft(`/admin/federation/community/topics${params ? `?${params}` : ''}`),
  createTopic: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/federation/community/topics', body),
  deleteTopic: (topicId: string) =>
    request<{ success: boolean }>('DELETE', `/admin/federation/community/topics/${topicId}`),
  communitySummary: () => requestRowsSoft('/admin/federation/community/summary'),
  delegations: (params?: string) => requestRowsSoft(`/admin/federation/delegations${params ? `?${params}` : ''}`),
  createDelegation: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('POST', '/admin/federation/delegations', body),
  updateDelegation: (delegationId: string, body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', `/admin/federation/delegations/${delegationId}`, body),
  expireDelegations: () => request<{ success: boolean }>('POST', '/admin/federation/delegations/expire', {}),
  delegationSummary: () => requestRowsSoft('/admin/federation/delegations/summary'),
  consent: () => requestRowsSoft('/admin/federation/consent'),
  updateConsent: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PUT', '/admin/federation/consent', body),
  revokeConsent: () => request<{ success: boolean }>('POST', '/admin/federation/consent/revoke', {}),
  consentStats: () => requestRowsSoft('/admin/federation/consent/stats'),
  sovereignty: () => requestRowsSoft('/admin/federation/sovereignty'),
  updateSovereignty: (body: Record<string, unknown>) =>
    request<{ success: boolean }>('PATCH', '/admin/federation/sovereignty', body),
  canFederate: (peerId: string) => requestRowsSoft(`/admin/federation/sovereignty/can-federate/${peerId}`),
  exportPolicy: () => requestRowsSoft('/admin/federation/sovereignty/export-policy'),
  healthCheck: (peerId: string) =>
    request<{ success: boolean }>('POST', `/admin/federation/health/${peerId}/check`, {}),
  peerHealth: (peerId: string) => requestRowsSoft(`/admin/federation/health/${peerId}`),
  meshHealth: () => requestRowsSoft('/admin/federation/health'),
  pruneHealth: () => request<{ success: boolean }>('POST', '/admin/federation/health/prune', {}),
};

// ── Analytics Overview ──
export const analyticsOverview = {
  getOverview: () => request<{ success: boolean; data: AnalyticsOverviewData }>('GET', '/admin/analytics/overview'),
};

export type AnalyticsOverviewData = {
  users: { total: number; active_7d: number; active_30d: number };
  chats: { total: number; created_7d: number; created_30d: number };
  messages: { total: number; last_24h: number; last_7d: number };
  agent_runs: { total_runs: number; succeeded: number; failed: number; runs_7d: number };
  approvals: { total: number; pending: number; approved: number; rejected: number };
  daily_activity: Array<{ day: string; messages: number; active_users: number }>;
};

// ── Trading ──
export const trading = {
  dashboard: () => request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/trading/dashboard'),
  correlationMatrix: () => request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/trading/correlation-matrix'),
  executionQuality: () => request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/trading/execution-quality'),
  pnlChart: () => request<{ success: boolean; data: Array<{ date: string; equity: number }> }>('GET', '/admin/trading/pnl-chart'),
  credentials: () => requestRowsSoft('/admin/trading/exchange-credentials'),
  addCredential: (body: { broker: string; apiKey: string; apiSecret: string; isPaper: boolean; label?: string }) =>
    request<{ success: boolean }>('POST', '/admin/trading/exchange-credentials', body),
  revokeCredential: (id: string) =>
    request<{ success: boolean }>('DELETE', `/admin/trading/exchange-credentials/${id}`),
  brokers: () => requestRowsSoft('/v1/trading/broker/list'),
  brokerHealth: () => request<Record<string, boolean>>('GET', '/v1/trading/broker/health'),
};

// ── Revenue Pipelines (Batch 6: Seed Pipeline) ──
export const revenuePipelines = {
  list: (params?: { type?: string; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{
      success: boolean;
      data: { pipelines: Array<Record<string, unknown>> };
    }>('GET', `/admin/revenue/pipelines${qs ? '?' + qs : ''}`);
  },
  get: (id: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('GET', `/admin/revenue/pipelines/${id}`),
  seedSummary: () =>
    request<{
      success: boolean;
      data: {
        seedPipelines: number;
        totalActive: number;
        last24hNet: number;
        last24hEvents: number;
      };
    }>('GET', '/admin/revenue/pipelines/seed-summary'),
  stats: () =>
    request<{ success: boolean; data: Record<string, unknown> }>('GET', '/admin/revenue/stats'),
  events: (params?: { pipeline_id?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.pipeline_id) q.set('pipeline_id', params.pipeline_id);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{
      success: boolean;
      data: { events: Array<Record<string, unknown>>; limit: number; offset: number };
    }>('GET', `/admin/revenue/events${qs ? '?' + qs : ''}`);
  },
  activate: (id: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('PATCH', `/admin/revenue/pipelines/${id}/activate`),
  pause: (id: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('PATCH', `/admin/revenue/pipelines/${id}/pause`),
};

// ── Automatons (Batch 5: Autonomous Economy) ──
export const automatons = {
  list: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<{
      success: boolean;
      data: { automatons: Array<Record<string, unknown>> };
    }>('GET', `/admin/automatons${qs ? '?' + qs : ''}`);
  },
  summary: () =>
    request<{
      success: boolean;
      data: {
        counts: Record<string, number>;
        totalRevenueUsd: number;
        totalCostUsd: number;
      };
    }>('GET', '/admin/automatons/summary'),
  get: (id: string) =>
    request<{ success: boolean; data: Record<string, unknown> }>('GET', `/admin/automatons/${id}`),
};

export const api = {
  auth,
  users,
  chats,
  channels,
  editor,
  approvals,
  pairing,
  toolRuns,
  backups,
  permissions,
  settings,
  registry,
  souls,
  rag,
  knowledgeGraph,
  models,
  litellm,
  discovery,
  tunnel,
  community,
  allowlists,
  ha,
  calendar,
  git,
  nas,
  web,
  debug,
  updateChecker,
  deployment,
  devices,
  searchSettings,
  accounts,
  workflows,
  schedules,
  cron,
  webhooks,
  email,
  incidents,
  performance,
  health,
  policy,
  memory,
  improvements,
  mcp,
  globalSearch,
  a2a,
  obsidianSync,
  integrationRuntime,
  integrations,
  agents,
  agentAnalytics,
  aiPipelines,
  brain,
  communityAgents,
  federation,
  analyticsOverview,
  trading,
  automatons,
  revenuePipelines,
};
