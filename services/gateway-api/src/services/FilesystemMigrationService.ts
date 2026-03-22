import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import { createLogger } from '@sven/shared';

const logger = createLogger('fs-migration');

export interface FsMigrationSummary {
  executed: boolean;
  skipped?: 'disabled' | 'already_applied' | 'nothing_to_migrate';
  dryRun: boolean;
  markerPath: string;
  backupDir: string | null;
  moved: Array<{ from: string; to: string; type: 'file' | 'directory' }>;
  errors: Array<{ from: string; to: string; error: string }>;
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return defaultValue;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(p: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
}

async function safeMove(from: string, to: string): Promise<void> {
  await ensureParentDir(to);
  try {
    await fs.rename(from, to);
  } catch {
    const stat = await fs.stat(from);
    if (stat.isDirectory()) {
      await fs.cp(from, to, { recursive: true });
      await fs.rm(from, { recursive: true, force: true });
    } else {
      await fs.copyFile(from, to);
      await fs.rm(from, { force: true });
    }
  }
}

async function sha256File(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function sha256Path(targetPath: string): Promise<string> {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    return sha256File(targetPath);
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const hasher = crypto.createHash('sha256');
  hasher.update('dir');
  for (const entry of entries) {
    const entryPath = path.join(targetPath, entry.name);
    const entryHash = await sha256Path(entryPath);
    hasher.update(entry.name);
    hasher.update(entry.isDirectory() ? 'd' : 'f');
    hasher.update(entryHash);
  }
  return hasher.digest('hex');
}

function candidatePairs(env: NodeJS.ProcessEnv): Array<{ from: string; to: string; type: 'file' | 'directory' }> {
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const sourceRoot = path.resolve(env.SVEN_LEGACY_DATA_ROOT || path.join(home, '.sven'));
  const targetRoot = path.resolve(env.SVEN_DATA_ROOT || env.SVEN_STORAGE_ROOT || path.join(home, '.sven', 'data'));
  const targetConfigDir = path.join(targetRoot, 'config');
  const targetSchedulerDir = path.join(targetRoot, 'scheduler');
  const targetKnowledgeDir = path.join(targetRoot, 'knowledge');
  return [
    { from: path.join(sourceRoot, '.env'), to: path.join(targetConfigDir, '.env'), type: 'file' },
    { from: path.join(sourceRoot, 'scheduler.json'), to: path.join(targetSchedulerDir, 'scheduler.json'), type: 'file' },
    { from: path.join(sourceRoot, 'knowledge'), to: targetKnowledgeDir, type: 'directory' },
    { from: path.join(sourceRoot, 'legacy', 'scheduler.json'), to: path.join(targetSchedulerDir, 'scheduler.legacy.json'), type: 'file' },
    { from: path.join(sourceRoot, 'legacy', 'knowledge'), to: path.join(targetKnowledgeDir, 'legacy'), type: 'directory' },
  ];
}

export async function runFilesystemMigration(env: NodeJS.ProcessEnv = process.env): Promise<FsMigrationSummary> {
  const enabled = parseBool(env.SVEN_FS_MIGRATION_ENABLED, true);
  const dryRun = parseBool(env.SVEN_FS_MIGRATION_DRY_RUN, false);
  const home = env.HOME || env.USERPROFILE || os.homedir();
  const markerPath = path.resolve(
    env.SVEN_FS_MIGRATION_MARKER || path.join(home, '.sven', 'migrations', 'fs-migration-v1.json'),
  );
  const backupRoot = path.resolve(env.SVEN_FS_MIGRATION_BACKUP_ROOT || path.join(home, '.sven', 'migrations', 'backup'));

  const summary: FsMigrationSummary = {
    executed: false,
    dryRun,
    markerPath,
    backupDir: null,
    moved: [],
    errors: [],
  };

  if (!enabled) {
    summary.skipped = 'disabled';
    return summary;
  }
  if (await exists(markerPath)) {
    summary.skipped = 'already_applied';
    return summary;
  }

  const pairs = candidatePairs(env);
  const pending: Array<{ from: string; to: string; type: 'file' | 'directory' }> = [];
  for (const pair of pairs) {
    if (!(await exists(pair.from))) continue;
    if (path.resolve(pair.from) === path.resolve(pair.to)) continue;
    if (await exists(pair.to)) continue;
    pending.push(pair);
  }

  if (pending.length === 0) {
    summary.skipped = 'nothing_to_migrate';
    await ensureParentDir(markerPath);
    await fs.writeFile(
      markerPath,
      JSON.stringify({ applied_at: new Date().toISOString(), skipped: 'nothing_to_migrate' }, null, 2),
      'utf8',
    );
    return summary;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(backupRoot, ts);
  summary.backupDir = backupDir;

  if (!dryRun) {
    await fs.mkdir(backupDir, { recursive: true });
  }
  const legacyRoot = path.resolve(env.SVEN_LEGACY_DATA_ROOT || path.join(home, '.sven'));
  const manifestEntries: Array<{
    from: string;
    to: string;
    backup_relative_path: string;
    backup_sha256: string | null;
    type: 'file' | 'directory';
  }> = [];

  for (const pair of pending) {
    const backupRelativePath = path.relative(legacyRoot, pair.from).replace(/\\/g, '/');
    const backupPath = path.join(backupDir, backupRelativePath);
    try {
      if (!dryRun) {
        await ensureParentDir(backupPath);
        await fs.cp(pair.from, backupPath, { recursive: true });
        const backupHash = await sha256Path(backupPath);
        manifestEntries.push({
          from: pair.from,
          to: pair.to,
          backup_relative_path: backupRelativePath,
          backup_sha256: backupHash,
          type: pair.type,
        });
        await safeMove(pair.from, pair.to);
      } else {
        manifestEntries.push({
          from: pair.from,
          to: pair.to,
          backup_relative_path: backupRelativePath,
          backup_sha256: null,
          type: pair.type,
        });
      }
      summary.moved.push(pair);
    } catch (err) {
      summary.errors.push({
        from: pair.from,
        to: pair.to,
        error: String(err),
      });
    }
  }

  summary.executed = true;
  if (!dryRun) {
    const manifestPath = path.join(backupDir, 'manifest.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          legacy_root: legacyRoot,
          entries: manifestEntries,
        },
        null,
        2,
      ),
      'utf8',
    );

    await ensureParentDir(markerPath);
    await fs.writeFile(
      markerPath,
      JSON.stringify(
        {
          applied_at: new Date().toISOString(),
          backup_dir: backupDir,
          backup_manifest: manifestPath,
          moved: summary.moved,
          errors: summary.errors,
        },
        null,
        2,
      ),
      'utf8',
    );
  }

  logger.info('Filesystem migration summary', {
    dry_run: dryRun,
    moved: summary.moved.length,
    errors: summary.errors.length,
    marker: markerPath,
    backup_dir: backupDir,
  });

  return summary;
}
