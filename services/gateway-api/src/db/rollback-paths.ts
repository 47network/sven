import { existsSync, realpathSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export type RollbackDirs = {
  migrationsDir: string;
  rollbacksDir: string;
};

type ResolveRollbackDirsOptions = {
  serviceRootCandidates: string[];
  explicitMigrationsDir?: string;
  explicitRollbacksDir?: string;
};

function isExistingDirectory(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function buildRollbackPairForServiceRoot(root: string): RollbackDirs {
  const base = resolve(root);
  return {
    migrationsDir: resolve(base, 'src/db/migrations'),
    rollbacksDir: resolve(base, 'src/db/rollbacks'),
  };
}

function pairKey(pair: RollbackDirs): string {
  return `${realpathSync(pair.migrationsDir)}::${realpathSync(pair.rollbacksDir)}`;
}

export function resolveRollbackDirs(options: ResolveRollbackDirsOptions): RollbackDirs {
  const explicitMigrationsDir = options.explicitMigrationsDir
    ? resolve(options.explicitMigrationsDir)
    : undefined;
  const explicitRollbacksDir = options.explicitRollbacksDir
    ? resolve(options.explicitRollbacksDir)
    : undefined;

  if ((explicitMigrationsDir && !explicitRollbacksDir) || (!explicitMigrationsDir && explicitRollbacksDir)) {
    throw new Error('Both explicit migrations and rollbacks directories must be provided together.');
  }

  if (explicitMigrationsDir && explicitRollbacksDir) {
    if (!isExistingDirectory(explicitMigrationsDir) || !isExistingDirectory(explicitRollbacksDir)) {
      throw new Error(
        `Explicit rollback directories not found: migrations=${explicitMigrationsDir}, rollbacks=${explicitRollbacksDir}`,
      );
    }
    return { migrationsDir: explicitMigrationsDir, rollbacksDir: explicitRollbacksDir };
  }

  const checkedPairs = options.serviceRootCandidates.map((root) => buildRollbackPairForServiceRoot(root));
  const existingPairs = checkedPairs.filter(
    (pair) => isExistingDirectory(pair.migrationsDir) && isExistingDirectory(pair.rollbacksDir),
  );

  const deduped = new Map<string, RollbackDirs>();
  for (const pair of existingPairs) {
    deduped.set(pairKey(pair), pair);
  }
  const resolvedPairs = [...deduped.values()];

  if (resolvedPairs.length === 0) {
    const checked = checkedPairs
      .map((pair) => `migrations=${pair.migrationsDir}, rollbacks=${pair.rollbacksDir}`)
      .join(' | ');
    throw new Error(`No valid rollback directory pair found. Checked: ${checked}`);
  }

  if (resolvedPairs.length > 1) {
    const choices = resolvedPairs
      .map((pair) => `migrations=${pair.migrationsDir}, rollbacks=${pair.rollbacksDir}`)
      .join(' | ');
    throw new Error(`Ambiguous rollback directory pairs detected. Resolve via explicit dirs. Candidates: ${choices}`);
  }

  return resolvedPairs[0];
}

