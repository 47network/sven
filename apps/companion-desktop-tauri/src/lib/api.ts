import { invoke } from '@tauri-apps/api/core';

export type DesktopConfig = {
  gateway_url: string;
  chat_id: string;
  polling_enabled: boolean;
};

export type DeviceStartResult = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  interval: number;
  expires_in: number;
};

export type ApprovalItem = {
  id: string;
  status?: string;
  tool_name?: string;
  scope?: string;
  chat_id?: string;
  created_at?: string;
};

export type TimelineItem = {
  id: string;
  role?: string;
  text?: string;
  created_at?: string;
};

export async function loadConfig(): Promise<DesktopConfig> {
  return invoke('load_config');
}

export async function saveConfig(config: DesktopConfig): Promise<DesktopConfig> {
  return invoke('save_config', { config });
}

export async function getSecret(key: string): Promise<string | null> {
  return invoke('get_secret', { key });
}

export async function setSecret(key: string, value: string): Promise<void> {
  await invoke('set_secret', { key, value });
}

export async function clearSecret(key: string): Promise<void> {
  await invoke('clear_secret', { key });
}

export async function deviceStart(gatewayUrl: string): Promise<DeviceStartResult> {
  return invoke('device_start', { gateway_url: gatewayUrl });
}

export async function devicePoll(gatewayUrl: string, deviceCode: string, intervalSeconds: number): Promise<string> {
  return invoke('device_poll', { gateway_url: gatewayUrl, device_code: deviceCode, interval_seconds: intervalSeconds });
}

export async function refreshSession(gatewayUrl: string, bearerToken: string): Promise<string> {
  return invoke('refresh_session', { gateway_url: gatewayUrl, bearer_token: bearerToken });
}

export async function sendMessage(gatewayUrl: string, chatId: string, bearerToken: string, text: string): Promise<void> {
  await invoke('send_message', { gateway_url: gatewayUrl, chat_id: chatId, bearer_token: bearerToken, text });
}

export async function fetchApprovals(gatewayUrl: string, bearerToken: string): Promise<ApprovalItem[]> {
  return invoke('fetch_approvals', { gateway_url: gatewayUrl, bearer_token: bearerToken });
}

export async function fetchTimeline(gatewayUrl: string, chatId: string, bearerToken: string, limit = 30): Promise<TimelineItem[]> {
  return invoke('fetch_timeline', { gateway_url: gatewayUrl, chat_id: chatId, bearer_token: bearerToken, limit });
}

export async function voteApproval(
  gatewayUrl: string,
  approvalId: string,
  bearerToken: string,
  decision: 'approve' | 'deny',
): Promise<{ status?: string; votes_approve?: number; votes_deny?: number }> {
  return invoke('vote_approval', {
    gateway_url: gatewayUrl,
    approval_id: approvalId,
    bearer_token: bearerToken,
    decision,
  });
}

// ── On-device inference (Ollama sidecar) ──────────────────────────────────

export type LocalModelInfo = {
  id: string;
  name: string;
  variant: string;
  size_bytes: number;
  context_window: number;
  capabilities: string[];
  status: string;
};

export type InferenceRequest = {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
};

export type InferenceResponse = {
  text: string;
  model: string;
  tokens_generated: number;
  duration_ms: number;
  tokens_per_second: number;
};

export async function inferenceCheckOllama(): Promise<boolean> {
  return invoke('inference_check_ollama');
}

export async function inferenceListModels(): Promise<LocalModelInfo[]> {
  return invoke('inference_list_models');
}

export async function inferencePullModel(modelName: string): Promise<string> {
  return invoke('inference_pull_model', { model_name: modelName });
}

export async function inferenceDeleteModel(modelName: string): Promise<void> {
  await invoke('inference_delete_model', { model_name: modelName });
}

export async function inferenceGenerate(req: InferenceRequest): Promise<InferenceResponse> {
  return invoke('inference_generate', { req });
}
