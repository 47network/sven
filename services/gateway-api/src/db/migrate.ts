import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createLogger } from '@sven/shared';

const logger = createLogger('db-migrate');
const __dirname = dirname(fileURLToPath(import.meta.url));

function getMigrationSeries(name: string): string {
  const base = name.replace(/\.sql$/i, '');
  const match = /^(\d+)_/.exec(base);
  return match ? match[1] : base;
}

type IdMode = 'text' | 'uuid';

function inferIdMode(files: string[]): IdMode {
  const first = files.find((f) => f.startsWith('001_')) || '';
  if (first.includes('initial_schema')) return 'uuid';
  return 'text';
}

function selectMigrationFiles(rawFiles: string[], idMode: IdMode): { files: string[]; skippedVariantConflicts: string[] } {
  const skippedVariantConflicts: string[] = [];
  const files = rawFiles.filter((file) => {
    if (!file.startsWith('001_')) return true;
    if (idMode === 'text' && file === '001_initial_schema.sql') {
      skippedVariantConflicts.push(file);
      return false;
    }
    if (idMode === 'uuid' && file === '001_foundation.sql') {
      skippedVariantConflicts.push(file);
      return false;
    }
    return true;
  });
  return { files, skippedVariantConflicts };
}

function isIncompatibleForIdMode(sql: string, idMode: IdMode): boolean {
  if (idMode === 'text') {
    const uuidFkToCore =
      /\b(chat_id|user_id|approval_id)\s+UUID\b/i.test(sql) ||
      /UUID\s+REFERENCES\s+(chats|users|approvals)\(id\)/i.test(sql);
    return uuidFkToCore;
  }

  const textFkToCore =
    /\b(chat_id|user_id|approval_id)\s+TEXT\b/i.test(sql) ||
    /TEXT\s+REFERENCES\s+(chats|users|approvals)\(id\)/i.test(sql);
  return textFkToCore;
}

function normalizeInlineIndexes(sql: string): string {
  // Some historical migrations use MySQL-style inline INDEX declarations
  // inside CREATE TABLE blocks. Convert those into standalone Postgres
  // CREATE INDEX statements so migrations stay executable.
  const blockRegex = /CREATE TABLE[\s\S]*?\);\s*/gi;
  return sql.replace(blockRegex, (block) => {
    const tableMatch = block.match(
      /CREATE TABLE(?: IF NOT EXISTS)?\s+([A-Za-z0-9_."`]+)\s*\(/i,
    );
    const tableName = tableMatch ? tableMatch[1].replace(/`/g, '"') : '';
    if (!tableName) return block;

    const lines = block.split(/\r?\n/);
    const kept: string[] = [];
    const indexStmts: string[] = [];

    for (const line of lines) {
      const m = line.match(
        /^\s*INDEX\s+([A-Za-z0-9_]+)(?:\s+ON\s+([A-Za-z0-9_."`]+))?\s*\(([^)]+)\)\s*,?\s*$/i,
      );
      if (!m) {
        kept.push(line);
        continue;
      }

      const idxName = m[1];
      const targetTable = (m[2] || tableName).replace(/`/g, '"');
      const cols = m[3].trim();
      indexStmts.push(
        `CREATE INDEX IF NOT EXISTS ${idxName} ON ${targetTable}(${cols});`,
      );
    }

    // Remove trailing comma before closing table definition.
    const closeIdx = kept.findIndex((l) => /^\s*\)\s*;\s*$/.test(l));
    if (closeIdx > 0) {
      for (let i = closeIdx - 1; i >= 0; i--) {
        if (kept[i].trim() === '') continue;
        kept[i] = kept[i].replace(/,\s*$/, '');
        break;
      }
    }

    const rebuilt = kept.join('\n');
    if (indexStmts.length === 0) return rebuilt;
    return `${rebuilt}\n${indexStmts.join('\n')}\n`;
  });
}

export async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';

  // Use a raw client — migrations manage their own transactions
  let client: pg.Client | null = null;

  let retries = 0;
  const maxRetries = 10;
  while (retries < maxRetries) {
    const attemptClient = new pg.Client({ connectionString });
    try {
      await attemptClient.connect();
      client = attemptClient;
      break;
    } catch (err) {
      try {
        await attemptClient.end();
      } catch {
        // ignore cleanup errors on failed attempt
      }
      retries++;
      logger.warn('Database not ready, retrying…', {
        attempt: retries,
        maxRetries,
        error: String(err),
      });
      if (retries >= maxRetries) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!client) {
    throw new Error('Failed to establish database connection for migration');
  }

  logger.info('Connected to database for migration');

  try {
    // Bootstrap _migrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Discover migration files
    const candidates = [
      join(__dirname, 'migrations'),
      resolve(__dirname, '../../src/db/migrations'),
      resolve(__dirname, '../../../src/db/migrations'),
    ];

    const withFiles = candidates
      .filter((dir) => existsSync(dir))
      .map((dir) => ({
        dir,
        files: readdirSync(dir).filter((f) => f.endsWith('.sql')),
      }))
      .sort((a, b) => b.files.length - a.files.length);

    const selected = withFiles[0];
    if (!selected) {
      logger.error('Migrations directory not found', { candidates });
      throw new Error('Migrations directory not found');
    }

    const migrationsDir = selected.dir;
    const rawFiles = selected.files.sort();
    const bySeries = new Map<string, string[]>();
    for (const file of rawFiles) {
      const series = getMigrationSeries(file);
      const list = bySeries.get(series) || [];
      list.push(file);
      bySeries.set(series, list);
    }

    const idMode = (process.env.SVEN_MIGRATION_ID_MODE as IdMode | undefined) || inferIdMode(rawFiles);
    const { files, skippedVariantConflicts } = selectMigrationFiles(rawFiles, idMode);
    const skipIncompatible = process.env.SVEN_MIGRATION_SKIP_INCOMPATIBLE === '1';
    const maxSeriesRaw = process.env.SVEN_MIGRATION_MAX_SERIES;
    const maxSeries = maxSeriesRaw ? Number.parseInt(maxSeriesRaw, 10) : null;
    const migrationPlan = {
      selected: files.slice(),
      skipped_variant_conflicts: skippedVariantConflicts.slice(),
      skipped_already_applied: [] as string[],
      skipped_due_to_cap: [] as string[],
      skipped_incompatible: [] as string[],
      applied: [] as string[],
      failed: [] as string[],
    };

    logger.info('Using migrations directory', {
      path: migrationsDir,
      count: files.length,
      raw_count: rawFiles.length,
      duplicate_series: Array.from(bySeries.entries()).filter(([, names]) => names.length > 1).map(([series]) => series),
      id_mode: idMode,
      skipped_variant_conflicts: skippedVariantConflicts,
      skip_incompatible: skipIncompatible,
      max_series: maxSeries,
    });

    if (files.length === 0) {
      logger.info('No migration files found');
      return;
    }

    // Already-applied set
    const applied = await client.query('SELECT name FROM _migrations ORDER BY id');
    const appliedNames = new Set(applied.rows.map((r: { name: string }) => r.name));
    let count = 0;
    for (const file of files) {
      const migrationName = file.replace('.sql', '');
      const series = getMigrationSeries(file);
      const seriesNum = Number.parseInt(series, 10);

      if (appliedNames.has(file) || appliedNames.has(migrationName)) {
        logger.info('Skipping already-applied migration', { name: file });
        migrationPlan.skipped_already_applied.push(file);
        continue;
      }
      if (maxSeries !== null && Number.isFinite(seriesNum) && seriesNum > maxSeries) {
        logger.info('Skipping migration due to max-series limit', {
          name: file,
          series: seriesNum,
          max_series: maxSeries,
        });
        migrationPlan.skipped_due_to_cap.push(file);
        continue;
      }
      logger.info('Applying migration', { name: file });
      const rawSql = readFileSync(join(migrationsDir, file), 'utf8');
      const sql = normalizeInlineIndexes(rawSql);
      if (/\bINSERT\s+INTO\s+migrations\b/i.test(sql)) {
        logger.error('Legacy migration history table write detected', { name: file });
        throw new Error(`Migration ${file} writes to legacy history table "migrations"; use "_migrations".`);
      }

      if (skipIncompatible && isIncompatibleForIdMode(sql, idMode)) {
        logger.error('Incompatible migration detected for configured id mode', {
          name: file,
          id_mode: idMode,
        });
        migrationPlan.skipped_incompatible.push(file);
        throw new Error(
          `Incompatible migration requires explicit operator action: ${file} (id_mode=${idMode})`,
        );
      }

      // The SQL file manages its own BEGIN/COMMIT, so run it directly.
      // Fail closed on SQL/schema errors: failed migrations must never be
      // recorded as applied automatically.
      try {
        await client.query(sql);
      } catch (err) {
        logger.error('Migration failed', {
          name: file,
          id_mode: idMode,
          error: String(err),
        });
        migrationPlan.failed.push(file);
        throw err;
      }

      // Ensure it's recorded (the migration file itself may INSERT into _migrations)
      const check = await client.query(
        'SELECT 1 FROM _migrations WHERE name = $1 OR name = $2',
        [file, migrationName],
      );
      if (check.rows.length === 0) {
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      }
      logger.info('Migration applied successfully', { name: file });
      migrationPlan.applied.push(file);
      count++;
    }

    logger.info('All migrations applied', { applied: count, total: files.length });
    logger.info('Migration plan summary', {
      selected_count: migrationPlan.selected.length,
      skipped_already_applied_count: migrationPlan.skipped_already_applied.length,
      skipped_variant_conflicts_count: migrationPlan.skipped_variant_conflicts.length,
      skipped_due_to_cap_count: migrationPlan.skipped_due_to_cap.length,
      skipped_incompatible_count: migrationPlan.skipped_incompatible.length,
      failed_count: migrationPlan.failed.length,
      applied_count: migrationPlan.applied.length,
      selected: migrationPlan.selected,
      skipped_variant_conflicts: migrationPlan.skipped_variant_conflicts,
      skipped_already_applied: migrationPlan.skipped_already_applied,
      skipped_due_to_cap: migrationPlan.skipped_due_to_cap,
      skipped_incompatible: migrationPlan.skipped_incompatible,
      failed: migrationPlan.failed,
      applied: migrationPlan.applied,
    });
  } finally {
    await client.end();
  }
}

async function migrate() {
  await runMigrations();
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  migrate().catch((err) => {
    logger.fatal('Migration runner failed', { error: String(err) });
    process.exit(1);
  });
}
