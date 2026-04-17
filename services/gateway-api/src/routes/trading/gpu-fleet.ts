import { createLogger } from '@sven/shared';
import type { GpuNode, GpuUtilization, GpuTaskPriority, LlmCallResult } from './types.js';

const logger = createLogger('gateway-trading-gpu');

const FLEET_MAX_CONSECUTIVE_FAILURES = 3;

export function createGpuFleet(): GpuNode[] {
  return [
    {
      name: 'vm13-fast',
      endpoint: process.env.SVEN_LLM_ENDPOINT || 'http://10.47.47.13:11434',
      model: process.env.SVEN_LLM_MODEL || 'qwen2.5:7b',
      role: 'fast',
      apiFormat: 'ollama',
      healthy: true,
      lastCheck: 0,
      lastLatencyMs: 0,
      consecutiveFailures: 0,
    },
    {
      name: 'vm9-power',
      endpoint: process.env.SVEN_LLM_POWER_ENDPOINT || 'http://10.47.47.9:8080',
      model: process.env.SVEN_LLM_POWER_MODEL || 'qwen3-coder-30b-a3b',
      role: 'power',
      apiFormat: 'openai',
      healthy: true,
      lastCheck: 0,
      lastLatencyMs: 0,
      consecutiveFailures: 0,
    },
  ];
}

export function initGpuUtilization(fleet: GpuNode[]): Map<string, GpuUtilization> {
  const map = new Map<string, GpuUtilization>();
  for (const node of fleet) {
    map.set(node.name, {
      node,
      activeRequests: 0,
      maxConcurrent: node.role === 'power' ? 2 : 4,
      lastResponseMs: 0,
      taskPriority: 'trading',
    });
  }
  return map;
}

export async function probeGpuNode(node: GpuNode): Promise<void> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const healthUrl = node.apiFormat === 'openai'
      ? `${node.endpoint}/health`
      : `${node.endpoint}/api/tags`;
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    node.lastLatencyMs = Date.now() - start;
    node.healthy = true;
    node.consecutiveFailures = 0;
  } catch {
    node.lastLatencyMs = Date.now() - start;
    node.consecutiveFailures++;
    if (node.consecutiveFailures >= FLEET_MAX_CONSECUTIVE_FAILURES) {
      node.healthy = false;
    }
  }
  node.lastCheck = Date.now();
}

/**
 * Unified LLM call supporting both Ollama (/api/chat) and OpenAI (/v1/chat/completions) formats.
 * Returns the assistant message content string.
 */
export async function callLlm(
  node: GpuNode,
  messages: Array<{ role: string; content: string }>,
  opts: { temperature?: number; num_predict?: number; signal?: AbortSignal },
): Promise<LlmCallResult> {
  if (node.apiFormat === 'openai') {
    const maxTokens = Math.min(opts.num_predict ?? 512, 4096);
    const res = await fetch(`${node.endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: opts.signal,
      body: JSON.stringify({
        model: node.model,
        messages,
        max_tokens: maxTokens,
        temperature: opts.temperature ?? 0.3,
      }),
    });
    if (!res.ok) return { ok: false, content: '', status: res.status };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim() ?? '';
    return { ok: true, content, status: res.status };
  }
  // Ollama format
  const res = await fetch(`${node.endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({
      model: node.model,
      messages,
      stream: false,
      options: { temperature: opts.temperature ?? 0.3, num_predict: opts.num_predict ?? 512 },
    }),
  });
  if (!res.ok) return { ok: false, content: '', status: res.status };
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim() ?? '';
  return { ok: true, content, status: res.status };
}

export function selectNode(fleet: GpuNode[], preferRole: 'fast' | 'power'): GpuNode {
  const preferred = fleet.find(n => n.role === preferRole && n.healthy);
  if (preferred) return preferred;
  const fallback = fleet.find(n => n.healthy);
  if (fallback) {
    logger.warn('GPU fleet failover', { wanted: preferRole, using: fallback.name });
    return fallback;
  }
  return fleet[0]!;
}

export function acquireGpu(
  fleet: GpuNode[],
  gpuUtil: Map<string, GpuUtilization>,
  priority: GpuTaskPriority,
  preferRole: 'fast' | 'power',
): GpuNode | null {
  const priorityRank: Record<string, number> = { user: 4, trading: 3, backtest: 2, learning: 1 };
  const requestRank = priorityRank[priority] ?? 0;

  for (const role of [preferRole, preferRole === 'fast' ? 'power' : 'fast'] as const) {
    for (const node of fleet) {
      if (node.role !== role || !node.healthy) continue;
      const util = gpuUtil.get(node.name);
      if (!util) continue;
      if (util.activeRequests < util.maxConcurrent || requestRank >= (priorityRank[util.taskPriority] ?? 0)) {
        return node;
      }
    }
  }
  return fleet.find(n => n.healthy) ?? fleet[0]!;
}

export function trackGpuStart(gpuUtil: Map<string, GpuUtilization>, nodeName: string, priority: GpuTaskPriority): void {
  const util = gpuUtil.get(nodeName);
  if (util) {
    util.activeRequests++;
    util.taskPriority = priority;
  }
}

export function trackGpuEnd(gpuUtil: Map<string, GpuUtilization>, nodeName: string, latencyMs: number): void {
  const util = gpuUtil.get(nodeName);
  if (util) {
    util.activeRequests = Math.max(0, util.activeRequests - 1);
    util.lastResponseMs = latencyMs;
  }
}

export function startFleetHealthTimer(
  fleet: GpuNode[],
  intervalMs: number,
): ReturnType<typeof setInterval> {
  const timer = setInterval(async () => {
    for (const node of fleet) {
      await probeGpuNode(node);
    }
    const healthyNodes = fleet.filter(n => n.healthy);
    if (healthyNodes.length === 0) {
      logger.error('All GPU nodes unhealthy — Sven brain degraded to algorithmic-only');
    } else if (healthyNodes.length < fleet.length) {
      const down = fleet.filter(n => !n.healthy).map(n => n.name);
      logger.warn('GPU fleet partially degraded', { downNodes: down });
    }
  }, intervalMs);
  if (timer.unref) timer.unref();

  // Initial probe at startup
  void Promise.all(fleet.map(n => probeGpuNode(n)));

  return timer;
}
