type ContextMessage = {
  role?: string;
  text?: string;
};

type MemoryRow = {
  key?: string;
  value?: string;
};

function tokenize(input: string): string[] {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function tokenSet(input: string): Set<string> {
  return new Set(tokenize(input));
}

export function shouldEvaluateDelayedRecall(params: {
  enabled: boolean;
  everyNTurns: number;
  userTurnCount: number;
  lastInjectedUserTurn?: number;
  minTurnsBetween?: number;
  lastInjectedAtMs?: number | null;
  nowMs?: number;
  minMinutesBetween?: number;
}): boolean {
  if (!params.enabled) return false;
  const n = Math.max(1, Math.floor(params.everyNTurns || 3));
  const turns = Math.max(0, Math.floor(params.userTurnCount || 0));
  if (turns === 0) return false;
  if (turns % n !== 0) return false;

  const minTurnsBetween = Math.max(1, Math.floor(params.minTurnsBetween || n));
  const lastTurn = Math.max(0, Math.floor(params.lastInjectedUserTurn || 0));
  if (lastTurn > 0 && (turns - lastTurn) < minTurnsBetween) return false;

  const minMinutesBetween = Math.max(0, Math.floor(params.minMinutesBetween || 0));
  const lastInjectedAtMs = Number(params.lastInjectedAtMs || 0);
  const nowMs = Number(params.nowMs || Date.now());
  if (minMinutesBetween > 0 && Number.isFinite(lastInjectedAtMs) && lastInjectedAtMs > 0) {
    const elapsedMs = nowMs - lastInjectedAtMs;
    if (elapsedMs < (minMinutesBetween * 60_000)) return false;
  }
  return true;
}

export function selectDelayedRecallMemories(params: {
  memories: MemoryRow[];
  contextMessages: ContextMessage[];
  maxItems?: number;
  minOverlap?: number;
}): MemoryRow[] {
  const maxItems = Math.max(1, Math.floor(params.maxItems || 4));
  const minOverlap = Math.max(1, Math.floor(params.minOverlap || 1));
  const recentWindow = params.contextMessages.slice(-8);
  const contextTokens = new Set<string>();
  for (const msg of recentWindow) {
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    for (const t of tokenize(String(msg.text || ''))) contextTokens.add(t);
  }
  if (contextTokens.size === 0) return [];

  const scored = params.memories
    .map((m) => {
      const value = String(m.value || '');
      const tokens = tokenSet(value);
      let overlap = 0;
      for (const t of tokens) if (contextTokens.has(t)) overlap += 1;
      return { m, overlap };
    })
    .filter((row) => row.overlap >= minOverlap)
    .sort((a, b) => b.overlap - a.overlap);

  return scored.slice(0, maxItems).map((row) => row.m);
}

export function buildDelayedRecallPrompt(memories: MemoryRow[]): string {
  const lines = memories
    .map((m) => `- ${String(m.key || 'memory')}: ${String(m.value || '').replace(/\s+/g, ' ').trim().slice(0, 220)}`)
    .filter((line) => line.trim().length > 2);
  if (lines.length === 0) return '';
  return [
    'Proactive memory recall (use only if relevant to the current user request):',
    ...lines,
  ].join('\n');
}
