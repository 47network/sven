import type pg from 'pg';

export type StreamingPacingConfig = {
  chunkSize: number;
  humanDelay: number;
  coalesce: boolean;
};

const DEFAULT_CONFIG: StreamingPacingConfig = {
  chunkSize: 64,
  humanDelay: 0,
  coalesce: false,
};

function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(num)));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function parseSettingValue<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function getAgentSettingValue(settings: Record<string, unknown>, key: string): unknown {
  if (Object.prototype.hasOwnProperty.call(settings, key)) {
    return settings[key];
  }
  const [head, tail] = key.split('.', 2);
  if (!tail) return undefined;
  const nested = settings[head];
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return (nested as Record<string, unknown>)[tail];
  }
  return undefined;
}

export async function loadStreamingPacingConfig(
  pool: pg.Pool,
  agentId?: string,
): Promise<StreamingPacingConfig> {
  let globalMap = new Map<string, unknown>();
  try {
    const globalRows = await pool.query(
      `SELECT key, value FROM settings_global
       WHERE key = ANY($1::text[])`,
      [[
        'streaming.chunkSize',
        'streaming.humanDelay',
        'streaming.coalesce',
      ]],
    );
    globalMap = new Map(globalRows.rows.map((row) => [String(row.key), row.value]));
  } catch {
    globalMap = new Map<string, unknown>();
  }

  let config: StreamingPacingConfig = {
    chunkSize: toNumber(parseSettingValue(globalMap.get('streaming.chunkSize')), DEFAULT_CONFIG.chunkSize, 1, 4096),
    humanDelay: toNumber(parseSettingValue(globalMap.get('streaming.humanDelay')), DEFAULT_CONFIG.humanDelay, 0, 500),
    coalesce: toBoolean(parseSettingValue(globalMap.get('streaming.coalesce')), DEFAULT_CONFIG.coalesce),
  };

  if (agentId) {
    try {
      const agentRes = await pool.query(
        `SELECT settings FROM agent_configs WHERE agent_id = $1 LIMIT 1`,
        [agentId],
      );
      const rawSettings = agentRes.rows[0]?.settings;
      if (rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings)) {
        const settings = rawSettings as Record<string, unknown>;
        const agentChunkSize = getAgentSettingValue(settings, 'streaming.chunkSize');
        const agentHumanDelay = getAgentSettingValue(settings, 'streaming.humanDelay');
        const agentCoalesce = getAgentSettingValue(settings, 'streaming.coalesce');

        config = {
          chunkSize: toNumber(agentChunkSize, config.chunkSize, 1, 4096),
          humanDelay: toNumber(agentHumanDelay, config.humanDelay, 0, 500),
          coalesce: toBoolean(agentCoalesce, config.coalesce),
        };
      }
    } catch {
      // Keep global/default config when agent table is unavailable.
    }
  }

  return config;
}

export type PlannedChunk = {
  content: string;
  delayMs: number;
};

export class StreamingChunkPlanner {
  private pending = '';

  constructor(private readonly config: StreamingPacingConfig) {}

  push(text: string): PlannedChunk[] {
    if (!text) return [];
    const size = Math.max(1, this.config.chunkSize);
    if (!this.config.coalesce) {
      return splitWithDelay(text, size, this.config.humanDelay);
    }
    this.pending += text;
    const out: PlannedChunk[] = [];
    while (this.pending.length >= size) {
      const piece = this.pending.slice(0, size);
      this.pending = this.pending.slice(size);
      out.push({ content: piece, delayMs: piece.length * this.config.humanDelay });
    }
    return out;
  }

  flush(): PlannedChunk[] {
    if (!this.pending) return [];
    const remaining = this.pending;
    this.pending = '';
    return [{ content: remaining, delayMs: remaining.length * this.config.humanDelay }];
  }
}

function splitWithDelay(text: string, chunkSize: number, humanDelay: number): PlannedChunk[] {
  const out: PlannedChunk[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const piece = text.slice(i, i + chunkSize);
    out.push({ content: piece, delayMs: piece.length * humanDelay });
  }
  return out;
}
