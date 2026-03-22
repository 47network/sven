import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('gateway-db');

let pool: pg.Pool | null = null;
let readPool: pg.Pool | null = null;
const DEFAULT_REPORT_STATEMENT_TIMEOUT_MS = 120000;
const MIN_REPORT_STATEMENT_TIMEOUT_MS = 1000;
const MAX_REPORT_STATEMENT_TIMEOUT_MS = 600000;
const DEFAULT_POOL_MIN = 5;
const DEFAULT_POOL_MAX = 20;
const DEFAULT_POOL_IDLE_TIMEOUT_MS = 60000;
const DEFAULT_POOL_CONNECTION_TIMEOUT_MS = 5000;
const DEFAULT_POOL_STATEMENT_TIMEOUT_MS = 30000;

export type PoolConfig = {
  min: number;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeoutMillis: number;
};

function normalizeBoundedInt(
  raw: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
}

export function resolvePoolConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  mode: 'primary' | 'read' = 'primary',
): PoolConfig {
  const minRaw = mode === 'read' ? (env.PG_READ_POOL_MIN ?? env.PG_POOL_MIN) : env.PG_POOL_MIN;
  const maxRaw = mode === 'read' ? (env.PG_READ_POOL_MAX ?? env.PG_POOL_MAX) : env.PG_POOL_MAX;
  const idleRaw = mode === 'read'
    ? (env.PG_READ_POOL_IDLE_TIMEOUT_MS ?? env.PG_POOL_IDLE_TIMEOUT_MS)
    : env.PG_POOL_IDLE_TIMEOUT_MS;
  const connectionRaw = mode === 'read'
    ? (env.PG_READ_POOL_CONNECTION_TIMEOUT_MS ?? env.PG_POOL_CONNECTION_TIMEOUT_MS)
    : env.PG_POOL_CONNECTION_TIMEOUT_MS;
  const statementRaw = mode === 'read'
    ? (env.PG_READ_STATEMENT_TIMEOUT_MS ?? env.PG_STATEMENT_TIMEOUT_MS)
    : env.PG_STATEMENT_TIMEOUT_MS;

  let min = normalizeBoundedInt(minRaw, DEFAULT_POOL_MIN, 0, 128);
  const max = normalizeBoundedInt(maxRaw, DEFAULT_POOL_MAX, 1, 256);
  if (min > max) {
    logger.warn('Pool env min exceeds max; clamping min to max', { mode, min, max });
    min = max;
  }

  const idleTimeoutMillis = normalizeBoundedInt(idleRaw, DEFAULT_POOL_IDLE_TIMEOUT_MS, 1000, 600000);
  const connectionTimeoutMillis = normalizeBoundedInt(connectionRaw, DEFAULT_POOL_CONNECTION_TIMEOUT_MS, 100, 120000);
  const statementTimeoutMillis = normalizeBoundedInt(statementRaw, DEFAULT_POOL_STATEMENT_TIMEOUT_MS, 1000, 600000);

  return { min, max, idleTimeoutMillis, connectionTimeoutMillis, statementTimeoutMillis };
}

export function normalizeReportStatementTimeoutMs(
  raw: unknown,
  fallback = DEFAULT_REPORT_STATEMENT_TIMEOUT_MS,
): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (normalized <= 0) return fallback;
  return Math.max(
    MIN_REPORT_STATEMENT_TIMEOUT_MS,
    Math.min(MAX_REPORT_STATEMENT_TIMEOUT_MS, normalized),
  );
}

export function getPool(): pg.Pool {
  if (!pool) {
    const {
      min,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      statementTimeoutMillis,
    } = resolvePoolConfigFromEnv(process.env, 'primary');

    pool = new pg.Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://sven:sven@localhost:5432/sven',
      min,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      statement_timeout: statementTimeoutMillis,
      query_timeout: statementTimeoutMillis,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected Postgres pool error', { err: err.message });
    });

    logger.info('Postgres pool created', {
      min,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      statementTimeoutMillis,
    });
  }
  return pool;
}

export function getReadPool(): pg.Pool {
  if (readPool) return readPool;

  const readUrl = String(process.env.DATABASE_READ_URL || '').trim();
  if (!readUrl) {
    // No replica configured; safely fall back to primary.
    return getPool();
  }

  const {
    min,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statementTimeoutMillis,
  } = resolvePoolConfigFromEnv(process.env, 'read');

  readPool = new pg.Pool({
    connectionString: readUrl,
    min,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statement_timeout: statementTimeoutMillis,
    query_timeout: statementTimeoutMillis,
  });

  readPool.on('error', (err) => {
    logger.error('Unexpected Postgres read pool error', { err: err.message });
  });

  logger.info('Postgres read pool created', {
    min,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statementTimeoutMillis,
  });

  return readPool;
}

export async function queryRead(
  text: string,
  params?: any[],
): Promise<pg.QueryResult> {
  const target = getReadPool();
  return params ? target.query(text, params) : target.query(text);
}

export async function withReportClient<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
  opts?: { pool?: pg.Pool },
): Promise<T> {
  const reportStatementTimeoutMillis = normalizeReportStatementTimeoutMs(
    process.env.PG_REPORT_STATEMENT_TIMEOUT_MS,
    DEFAULT_REPORT_STATEMENT_TIMEOUT_MS,
  );
  const targetPool = opts?.pool || getPool();
  const client = await targetPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('statement_timeout', $1, true)`,
      [`${reportStatementTimeoutMillis}ms`],
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  const primary = pool;
  const replica = readPool;

  if (replica && replica !== primary) {
    await replica.end();
    readPool = null;
    logger.info('Postgres read pool closed');
  } else {
    readPool = null;
  }

  if (primary) {
    await primary.end();
    pool = null;
    logger.info('Postgres pool closed');
  }
}
