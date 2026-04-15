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

// ── Overlay & tray control ────────────────────────────────────────────

/** Toggle the character overlay window visibility. Returns new visibility state. */
export async function toggleOverlay(): Promise<boolean> {
  return invoke('toggle_overlay');
}

/** Show the mini-terminal quick command popup. */
export async function showMiniTerminal(): Promise<void> {
  await invoke('show_mini_terminal');
}

/** Position the overlay at the default location (bottom-right above taskbar). */
export async function positionOverlayDefault(): Promise<void> {
  await invoke('position_overlay_default');
}

// ── Multi-account management ──────────────────────────────────────────

export type SavedAccount = {
  userId: string;
  username: string;
  displayName?: string;
  hasPin: boolean;
  isActive: boolean;
};

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  const raw = await getSecret('linked_accounts');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export async function saveSavedAccounts(accounts: SavedAccount[]): Promise<void> {
  await setSecret('linked_accounts', JSON.stringify(accounts));
}

export async function linkAccount(
  gatewayUrl: string,
  token: string,
  deviceId: string,
  pin?: string,
): Promise<void> {
  const res = await fetch(`${gatewayUrl}/v1/auth/accounts/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Device-Id': deviceId,
    },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error(`Link failed: ${res.status}`);
}

export async function switchAccount(
  gatewayUrl: string,
  token: string,
  deviceId: string,
  targetUserId: string,
  pin?: string,
): Promise<{ access_token: string; user_id: string; username?: string }> {
  const res = await fetch(`${gatewayUrl}/v1/auth/accounts/switch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Device-Id': deviceId,
    },
    body: JSON.stringify({ target_user_id: targetUserId, pin }),
  });
  if (!res.ok) throw new Error(`Switch failed: ${res.status}`);
  const body = await res.json();
  return body.data ?? body;
}

export async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await getSecret('sven_device_id');
  if (deviceId) return deviceId;
  deviceId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
  await setSecret('sven_device_id', deviceId);
  return deviceId;
}

// ── Server discovery (.well-known) ──────────────────────────────────

export type ServerDiscoveryResult = {
  gatewayUrl: string;
  instanceName?: string;
  version?: string;
  registrationEnabled?: boolean;
  ssoProviders?: string[];
};

/**
 * Discover a Sven gateway from a domain or URL, like Matrix .well-known.
 *
 * Flow:
 * 1. Try `{baseUrl}/.well-known/sven/client`
 * 2. Fall back to probing `{baseUrl}/v1/health`
 * 3. Try `app.{domain}` subdomain variants
 */
export async function discoverServer(input: string): Promise<ServerDiscoveryResult> {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Server address cannot be empty');

  const baseUrl = (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
    ? trimmed.replace(/\/+$/, '')
    : `https://${trimmed.replace(/\/+$/, '')}`;

  // Step 1: .well-known
  const wk = await tryWellKnown(baseUrl);
  if (wk) return wk;

  // Step 2: direct health probe
  if (await probeHealth(baseUrl)) {
    return { gatewayUrl: baseUrl };
  }

  // Step 3: try app. subdomain
  if (!trimmed.includes('/') && !trimmed.includes(':') && !trimmed.startsWith('http')) {
    const appSub = `https://app.${trimmed}`;
    const appWk = await tryWellKnown(appSub);
    if (appWk) return appWk;
    if (await probeHealth(appSub)) {
      return { gatewayUrl: appSub };
    }
  }

  throw new Error(
    `Could not discover a Sven server at "${trimmed}". Please enter the full gateway URL.`
  );
}

async function tryWellKnown(baseUrl: string): Promise<ServerDiscoveryResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${baseUrl}/.well-known/sven/client`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = await res.json();
    const sc = body?.['sven.client'];
    if (!sc) return null;
    return {
      gatewayUrl: (sc.base_url || baseUrl).replace(/\/+$/, ''),
      instanceName: sc.instance_name,
      version: sc.version,
      registrationEnabled: sc.registration_enabled,
      ssoProviders: sc.sso_providers,
    };
  } catch {
    return null;
  }
}

async function probeHealth(baseUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${baseUrl}/v1/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.json();
    return 'status' in body;
  } catch {
    return false;
  }
}
