/**
 * Database model types – mirrors the Postgres schema.
 */

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: 'admin' | 'user';
  totp_secret_enc?: string;
  created_at: string;
  updated_at: string;
}

export interface Identity {
  id: string;
  user_id: string;
  channel: string;
  channel_user_id: string;
  display_name?: string;
  linked_at: string;
}

export interface Chat {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'hq';
  channel?: string;
  channel_chat_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_user_id?: string;
  sender_identity_id?: string;
  role: 'user' | 'assistant' | 'system';
  content_type: 'text' | 'file' | 'audio' | 'blocks';
  text?: string;
  blocks?: unknown[];
  channel_message_id?: string;
  created_at: string;
}

export interface Tool {
  id: string;
  name: string;
  display_name: string;
  description: string;
  version: string;
  execution_mode: 'in_process' | 'container' | 'gvisor' | 'firecracker';
  inputs_schema: Record<string, unknown>;
  outputs_schema: Record<string, unknown>;
  permissions_required: string[];
  resource_limits: {
    timeout_ms: number;
    cpu_limit: string;
    memory_limit: string;
    max_bytes: number;
    max_concurrency?: number;
  };
  is_first_party: boolean;
  trust_level: 'trusted' | 'quarantined' | 'blocked';
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  scope: string;
  effect: 'allow' | 'deny';
  target_type: 'user' | 'chat' | 'global';
  target_id?: string;
  conditions?: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface Approval {
  id: string;
  chat_id: string;
  tool_name: string;
  scope: string;
  requester_user_id: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  quorum_required: number;
  votes_approve: number;
  votes_deny: number;
  expires_at: string;
  details: Record<string, unknown>;
  created_at: string;
  resolved_at?: string;
}

export interface ApprovalVote {
  id: string;
  approval_id: string;
  voter_user_id: string;
  vote: 'approve' | 'deny';
  voted_at: string;
}

export interface ToolRun {
  id: string;
  tool_name: string;
  chat_id: string;
  user_id: string;
  approval_id?: string;
  status: 'running' | 'success' | 'error' | 'timeout' | 'denied';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  tool_logs?: {
    stdout?: string;
    stderr?: string;
    exit_code?: number;
  };
  error?: string;
  prev_hash: string;
  run_hash: string;
  canonical_io_sha256: string;
  duration_ms?: number;
  created_at: string;
  completed_at?: string;
}

export interface SvenIdentityDoc {
  id: string;
  scope: 'global' | 'chat';
  chat_id?: string;
  content: string;
  version: number;
  updated_by: string;
  updated_at: string;
}

export interface Memory {
  id: string;
  user_id?: string;
  chat_id?: string;
  visibility: 'user_private' | 'chat_shared' | 'global';
  key: string;
  value: string;
  embedding?: number[];
  created_at: string;
  updated_at: string;
}

export interface CanvasEvent {
  id: string;
  chat_id: string;
  message_id: string;
  blocks: unknown[];
  created_at: string;
}

export interface Artifact {
  id: string;
  chat_id: string;
  message_id?: string;
  tool_run_id?: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  is_private: boolean;
  enc_alg?: string;
  enc_kid?: string;
  ciphertext_sha256?: string;
  created_at: string;
}

export interface RegistrySource {
  id: string;
  name: string;
  type: 'public' | 'private' | 'local';
  url?: string;
  path?: string;
  enabled: boolean;
  created_at: string;
}

export interface SkillCatalogEntry {
  id: string;
  source_id: string;
  publisher_id?: string;
  name: string;
  description: string;
  version: string;
  format: 'openclaw' | 'oci' | 'nix';
  manifest: Record<string, unknown>;
  created_at: string;
}

export interface SkillInstalled {
  id: string;
  catalog_entry_id: string;
  tool_id: string;
  trust_level: 'trusted' | 'quarantined' | 'blocked';
  installed_by: string;
  installed_at: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  enabled: boolean;
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  type: 'tool_call' | 'approval' | 'conditional' | 'notification' | 'data_shape' | 'llm_task';
  config: Record<string, unknown>;
  next_on_success?: string;
  next_on_failure?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  triggered_by?: string;
  trigger_message_id?: string;
  input_variables?: Record<string, unknown>;
  output_variables?: Record<string, unknown>;
  step_results: Record<string, unknown>;
  total_steps?: number;
  completed_steps?: number;
  failed_steps?: number;
  canvas_event_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelRegistryEntry {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  endpoint: string;
  capabilities: string[];
  is_local: boolean;
  created_at: string;
}

export interface ModelPolicy {
  id: string;
  scope: 'global' | 'chat' | 'user';
  target_id?: string;
  model_id: string;
  priority: number;
  created_at: string;
}

export interface SettingsGlobal {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string;
}

export type IncidentMode = 'normal' | 'kill_switch' | 'lockdown' | 'forensics';
