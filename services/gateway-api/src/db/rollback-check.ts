import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRollbackDirs } from './rollback-paths.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function main() {
  const { migrationsDir, rollbacksDir } = resolveRollbackDirs({
    explicitMigrationsDir: process.env.SVEN_DB_MIGRATIONS_DIR,
    explicitRollbacksDir: process.env.SVEN_DB_ROLLBACKS_DIR,
    serviceRootCandidates: [
      resolve(__dirname, '../..'),
      resolve(__dirname, '../../..'),
      process.cwd(),
    ],
  });

  const migrations = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  const rollbacks = new Set(
    readdirSync(rollbacksDir).filter((f) => f.endsWith('.sql')).sort(),
  );

  const missing = migrations.filter((m) => !rollbacks.has(m));
  if (missing.length > 0) {
    console.error('Missing rollback SQL files for migrations:');
    for (const file of missing) console.error(`- ${file}`);
    process.exit(1);
  }

  console.log(`Rollback coverage OK: ${migrations.length}/${migrations.length} migrations have rollback SQL.`);
  console.log(`Rollback dirs: migrations=${migrationsDir} rollbacks=${rollbacksDir}`);
}

main();
