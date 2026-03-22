import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { resolveRollbackDirs } from './rollback-paths.js';
import { applyRollbackFile } from './rollback-ops.js';

const logger = createLogger('db-rollback');
const __dirname = dirname(fileURLToPath(import.meta.url));

type CliArgs = {
  name?: string;
  steps?: number;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--name' && args[i + 1]) {
      out.name = args[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--steps' && args[i + 1]) {
      const parsed = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) out.steps = parsed;
      i += 1;
    }
  }
  if (!out.name && process.env.ROLLBACK_MIGRATION_NAME) {
    out.name = process.env.ROLLBACK_MIGRATION_NAME;
  }
  if (!out.steps && process.env.ROLLBACK_STEPS) {
    const parsed = Number.parseInt(process.env.ROLLBACK_STEPS, 10);
    if (Number.isFinite(parsed) && parsed > 0) out.steps = parsed;
  }
  return out;
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://sven:sven@localhost:5432/sven';
  const args = parseArgs();
  const client = new pg.Client({ connectionString });
  await client.connect();
  logger.info('Connected to database for rollback');

  try {
    const { rollbacksDir } = resolveRollbackDirs({
      explicitMigrationsDir: process.env.SVEN_DB_MIGRATIONS_DIR,
      explicitRollbacksDir: process.env.SVEN_DB_ROLLBACKS_DIR,
      serviceRootCandidates: [
        resolve(__dirname, '../..'),
        resolve(__dirname, '../../..'),
        process.cwd(),
      ],
    });
    const rollbackFiles = readdirSync(rollbacksDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (rollbackFiles.length === 0) {
      throw new Error('No rollback files found.');
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await client.query('SELECT name FROM _migrations ORDER BY id DESC');
    const appliedNames = applied.rows.map((r: { name: string }) => r.name);
    if (appliedNames.length === 0) {
      logger.info('No applied migrations found; nothing to roll back');
      return;
    }

    let targets: string[] = [];
    if (args.name) {
      const normalized = args.name.endsWith('.sql') ? args.name : `${args.name}.sql`;
      if (!rollbackFiles.includes(normalized)) {
        throw new Error(`Rollback file not found: ${normalized}`);
      }
      targets = [normalized];
    } else {
      const steps = args.steps || 1;
      const appliedSqlNames = appliedNames
        .map((n) => (n.endsWith('.sql') ? n : `${n}.sql`))
        .filter((n) => rollbackFiles.includes(n));
      targets = appliedSqlNames.slice(0, steps);
    }

    if (targets.length === 0) {
      logger.info('No matching applied migrations with rollback files; nothing to do');
      return;
    }

    for (const file of targets) {
      const sql = readFileSync(join(rollbacksDir, file), 'utf8');
      logger.info('Applying rollback', { file });
      await applyRollbackFile(client, file, sql);
      logger.info('Rollback applied', { file });
    }

    logger.info('Rollback complete', { count: targets.length });
  } finally {
    await client.end();
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
const isDirectRun = import.meta.url === entryPath;
if (isDirectRun) {
  main().catch((err) => {
    logger.fatal('Rollback runner failed', { error: String(err) });
    process.exit(1);
  });
}
