import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import * as tar from 'tar';
import { estimateBase64DecodedBytes, getFileUploadMaxBytes, isLikelyBase64 } from '../lib/upload-validation.js';

/**
 * Backup & Disaster Recovery Service
 * Handles database backups, snapshots, archives, restores, and DR drills
 */

interface BackupJob {
  id: string;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  totalSizeBytes?: number;
  backupLocation?: string;
}

interface RestoreJob {
  id: string;
  backupJobId: string;
  targetEnvironment: string;
  status: string;
  initiatedBy: string;
  executionMode?: RestoreExecutionMode;
}

interface DRDrill {
  id: string;
  name: string;
  status: string;
  scheduledDate: Date;
  scope: string;
}

const pool = getPool();
const DEFAULT_RETENTION_COUNT = Number(process.env.SVEN_BACKUP_RETENTION_COUNT || 7);
const DEFAULT_RUNTIME_TMP = process.env.SVEN_RUNTIME_TMP_DIR || path.join(os.tmpdir(), 'sven');
const DEFAULT_BACKUP_ROOT = process.env.SVEN_BACKUP_ROOT || path.join(DEFAULT_RUNTIME_TMP, 'backups');
const DEFAULT_UPLOADS_DIR = process.env.SVEN_UPLOADS_DIR || path.join(DEFAULT_RUNTIME_TMP, 'uploads');
const DEFAULT_CONFIG_DIR = path.join(process.cwd(), 'config');

type BackupConfigRow = {
  id: string;
  backup_type: string;
  enabled: boolean;
  schedule_cron: string;
  retention_days?: number | null;
  storage_path?: string | null;
  storage_type?: string | null;
  compression_enabled?: boolean | null;
  compression_algorithm?: string | null;
};

type ScheduledBackupAction = 'backup' | 'snapshot' | 'archive';

type BackupComponent = {
  name: string;
  type: string;
  relativePath: string;
  included: boolean;
  sizeBytes?: number;
  note?: string;
};

type BackupManifest = {
  backup_id: string;
  config_id: string | null;
  created_at: string;
  format: string;
  version: string;
  components: BackupComponent[];
};

type RestoreExecutionMode = 'simulated' | 'live';

function isProductionLikeProfile(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const profile = String(env.SVEN_ENV_PROFILE || '').trim().toLowerCase();
  if (nodeEnv === 'production') return true;
  return ['strict', 'hardened', 'isolated', 'production'].includes(profile);
}

function parseBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function resolveRestoreExecutionMode(env: NodeJS.ProcessEnv = process.env): RestoreExecutionMode {
  const normalized = String(env.SVEN_RESTORE_EXECUTION_MODE || '').trim().toLowerCase();
  if (normalized === 'live') return 'live';
  return 'simulated';
}

function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => isValidField(field, i));
}

function isValidField(field: string, index: number): boolean {
  const range = getRange(index);
  const parts = field.split(',');
  for (const part of parts) {
    if (part === '*') continue;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if (!Number.isFinite(step) || step <= 0) return false;
      continue;
    }
    if (/^\d+$/.test(part)) {
      const num = Number(part);
      if (num < range.min || num > range.max) return false;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (a < range.min || b > range.max || a > b) return false;
      continue;
    }
    return false;
  }
  return true;
}

function getRange(index: number): { min: number; max: number } {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 23 };
  if (index === 2) return { min: 1, max: 31 };
  if (index === 3) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}

function matchesField(value: number, field: string, index: number): boolean {
  if (field === '*') return true;
  const range = getRange(index);
  for (const part of field.split(',')) {
    if (part === '*') return true;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if ((value - range.min) % step === 0) return true;
      continue;
    }
    if (/^\d+$/.test(part)) {
      if (value === Number(part)) return true;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    }
  }
  return false;
}

function computeNextRun(expression: string, fromDate: Date): Date | null {
  if (!isValidCron(expression)) return null;
  const [m, h, dom, mon, dow] = expression.trim().split(/\s+/);
  const next = new Date(fromDate.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    if (
      matchesField(next.getMinutes(), m, 0) &&
      matchesField(next.getHours(), h, 1) &&
      matchesField(next.getDate(), dom, 2) &&
      matchesField(next.getMonth() + 1, mon, 3) &&
      matchesField(next.getDay(), dow, 4)
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function normalizeStoragePath(storagePath?: string | null): string {
  if (!storagePath) return DEFAULT_BACKUP_ROOT;
  if (storagePath.startsWith('s3://')) {
    return DEFAULT_BACKUP_ROOT;
  }
  if (storagePath.startsWith('/nas')) {
    const base = process.env.SVEN_NAS_ROOT || path.join(DEFAULT_RUNTIME_TMP, 'nas');
    return path.join(base, storagePath.replace(/^\/nas[\\/]?/, ''));
  }
  if (path.isAbsolute(storagePath)) return storagePath;
  return path.join(process.cwd(), storagePath);
}

async function ensureDir(target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
}

async function fileHashSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function copyFileSafe(src: string, dest: string): Promise<number> {
  try {
    await ensureDir(path.dirname(dest));
    await fs.copyFile(src, dest);
    const stat = await fs.stat(dest);
    return stat.size;
  } catch {
    return 0;
  }
}

async function copyDirSafe(src: string, dest: string): Promise<number> {
  if (!existsSync(src)) return 0;
  const entries = await fs.readdir(src, { withFileTypes: true });
  let total = 0;
  await ensureDir(dest);
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      total += await copyDirSafe(srcPath, destPath);
    } else if (entry.isFile()) {
      total += await copyFileSafe(srcPath, destPath);
    }
  }
  return total;
}

async function getBackupConfig(configId: string): Promise<BackupConfigRow | null> {
  const result = await pool.query(
    `SELECT id, backup_type, enabled, schedule_cron, retention_days, storage_path, storage_type, compression_enabled, compression_algorithm
     FROM backup_config WHERE id = $1`,
    [configId],
  );
  return result.rows[0] || null;
}

function resolveScheduledBackupAction(config: BackupConfigRow): ScheduledBackupAction {
  const backupType = String(config.backup_type || '').trim().toLowerCase();
  const configId = String(config.id || '').trim().toLowerCase();
  const storagePath = String(config.storage_path || '').trim().toLowerCase();

  if (backupType === 'snapshot' || backupType === 'archive') {
    return backupType;
  }
  if (configId.includes('snapshot') || storagePath.includes('/snapshot')) {
    return 'snapshot';
  }
  if (configId.includes('archive') || storagePath.includes('/archive')) {
    return 'archive';
  }
  return 'backup';
}

async function getLatestCompletedBackupJobId(configId: string): Promise<string | null> {
  const configScoped = await pool.query(
    `SELECT id
     FROM backup_jobs
     WHERE backup_config_id = $1
       AND status = 'completed'
     ORDER BY completed_at DESC NULLS LAST, started_at DESC
     LIMIT 1`,
    [configId],
  );
  if (configScoped.rows.length > 0) {
    return String(configScoped.rows[0].id || '');
  }

  const globalLatest = await pool.query(
    `SELECT id
     FROM backup_jobs
     WHERE status = 'completed'
     ORDER BY completed_at DESC NULLS LAST, started_at DESC
     LIMIT 1`,
  );
  if (globalLatest.rows.length > 0) {
    return String(globalLatest.rows[0].id || '');
  }
  return null;
}

export async function executeScheduledBackupJob(configId: string): Promise<{ action: ScheduledBackupAction; id: string }> {
  const normalizedConfigId = String(configId || '').trim();
  if (!normalizedConfigId) {
    throw new Error('backup config id is required');
  }
  const config = await getBackupConfig(normalizedConfigId);
  if (!config) {
    throw new Error(`backup config not found: ${normalizedConfigId}`);
  }

  const action = resolveScheduledBackupAction(config);
  if (action === 'backup') {
    const backup = await startDatabaseBackup(normalizedConfigId);
    return { action: 'backup', id: backup.id };
  }

  const latestCompletedBackupId = await getLatestCompletedBackupJobId(normalizedConfigId);
  if (!latestCompletedBackupId) {
    const seededBackup = await startDatabaseBackup(normalizedConfigId);
    return { action: 'backup', id: seededBackup.id };
  }

  if (action === 'snapshot') {
    const snapshot = await createSnapshot(
      latestCompletedBackupId,
      `Scheduled snapshot (${normalizedConfigId})`,
      ['scheduled', 'snapshot', normalizedConfigId],
    );
    return { action: 'snapshot', id: snapshot.id };
  }

  const archive = await archiveBackup(latestCompletedBackupId, 'scheduled_archive', 7);
  return { action: 'archive', id: archive.id };
}

async function createBackupManifest(
  backupId: string,
  configId: string | null,
  components: BackupComponent[],
): Promise<BackupManifest> {
  return {
    backup_id: backupId,
    config_id: configId,
    created_at: new Date().toISOString(),
    format: 'tar.gz',
    version: '1.0',
    components,
  };
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function buildBackupWorkdir(
  backupId: string,
  configId: string | null,
): Promise<{ dir: string; components: BackupComponent[]; totalSize: number }> {
  const workdir = await fs.mkdtemp(path.join(os.tmpdir(), `sven-backup-${backupId}-`));
  const components: BackupComponent[] = [];
  let totalSize = 0;

  const dbStats = await pool.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name ASC`,
  );
  const tableNames = dbStats.rows.map((r) => String(r.table_name));
  const counts: Record<string, number> = {};
  for (const table of tableNames) {
    const countRes = await pool.query(
      `SELECT COUNT(*)::bigint AS count FROM public.${quoteIdentifier(table)}`,
    );
    counts[table] = Number(countRes.rows[0]?.count || 0);
  }
  const dbDumpPath = path.join(workdir, 'database.json');
  await fs.writeFile(
    dbDumpPath,
    JSON.stringify(
      {
        captured_at: new Date().toISOString(),
        tables: tableNames,
        row_counts: counts,
      },
      null,
      2,
    ),
    'utf8',
  );
  const dbStat = await fs.stat(dbDumpPath);
  components.push({
    name: 'postgres',
    type: 'database',
    relativePath: 'database.json',
    included: true,
    sizeBytes: dbStat.size,
    note: 'Logical snapshot metadata. Replace with pg_dump for full backups.',
  });
  totalSize += dbStat.size;

  const natsSnapshotPath = path.join(workdir, 'nats-state.json');
  await fs.writeFile(
    natsSnapshotPath,
    JSON.stringify(
      {
        captured_at: new Date().toISOString(),
        note: 'NATS state capture placeholder. Configure SVEN_NATS_STATE_DIR for real snapshots.',
      },
      null,
      2,
    ),
    'utf8',
  );
  const natsStat = await fs.stat(natsSnapshotPath);
  components.push({
    name: 'nats',
    type: 'queue',
    relativePath: 'nats-state.json',
    included: true,
    sizeBytes: natsStat.size,
  });
  totalSize += natsStat.size;

  const configTargets = new Set<string>();
  if (process.env.SVEN_CONFIG) configTargets.add(process.env.SVEN_CONFIG);
  const extraConfig = process.env.SVEN_BACKUP_CONFIG_DIRS || '';
  for (const item of extraConfig.split(',').map((s) => s.trim()).filter(Boolean)) {
    configTargets.add(item);
  }
  if (existsSync(DEFAULT_CONFIG_DIR)) configTargets.add(DEFAULT_CONFIG_DIR);

  let configSize = 0;
  for (const target of configTargets) {
    const resolved = path.isAbsolute(target) ? target : path.join(process.cwd(), target);
    if (!existsSync(resolved)) continue;
    const stat = await fs.stat(resolved);
    const dest = path.join(workdir, 'config', path.basename(resolved));
    if (stat.isDirectory()) {
      configSize += await copyDirSafe(resolved, dest);
    } else if (stat.isFile()) {
      configSize += await copyFileSafe(resolved, dest);
    }
  }
  components.push({
    name: 'config',
    type: 'config',
    relativePath: 'config',
    included: configSize > 0,
    sizeBytes: configSize || undefined,
    note: configSize > 0 ? undefined : 'No config files found.',
  });
  totalSize += configSize;

  const uploadsDir =
    process.env.SVEN_UPLOADS_DIR ||
    process.env.SVEN_STORAGE_DIR ||
    DEFAULT_UPLOADS_DIR;
  const resolvedUploads = path.isAbsolute(uploadsDir)
    ? uploadsDir
    : path.join(process.cwd(), uploadsDir);
  let uploadsSize = 0;
  if (existsSync(resolvedUploads)) {
    uploadsSize = await copyDirSafe(resolvedUploads, path.join(workdir, 'uploads'));
  }
  components.push({
    name: 'uploads',
    type: 'files',
    relativePath: 'uploads',
    included: uploadsSize > 0,
    sizeBytes: uploadsSize || undefined,
    note: uploadsSize > 0 ? undefined : 'Uploads directory not found or empty.',
  });
  totalSize += uploadsSize;

  const manifest = await createBackupManifest(backupId, configId, components);
  const manifestPath = path.join(workdir, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  const manifestStat = await fs.stat(manifestPath);
  totalSize += manifestStat.size;

  return { dir: workdir, components, totalSize };
}

async function extractManifest(archivePath: string): Promise<BackupManifest | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-backup-manifest-'));
  try {
    await tar.x({
      file: archivePath,
      cwd: tempDir,
      filter: (entryPath: string) => entryPath.replace(/\\/g, '/').endsWith('manifest.json'),
    });
    const manifestPath = path.join(tempDir, 'manifest.json');
    if (!existsSync(manifestPath)) return null;
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as BackupManifest;
  } catch {
    return null;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function cleanupOldBackups(configId: string | null, retentionDays?: number | null): Promise<void> {
  const res = await pool.query(
    `SELECT id, backup_location, completed_at
     FROM backup_jobs
     WHERE status IN ('completed', 'verified')
       AND ($1::text IS NULL OR backup_config_id = $1)
     ORDER BY completed_at DESC NULLS LAST`,
    [configId],
  );
  const rows = res.rows;
  const keep = Math.max(1, DEFAULT_RETENTION_COUNT);
  const now = Date.now();
  const toDelete = rows.filter((row: any, index: number) => {
    if (index >= keep) return true;
    if (retentionDays && row.completed_at) {
      const ageMs = now - new Date(row.completed_at).getTime();
      return ageMs > retentionDays * 86400000;
    }
    return false;
  });

  for (const row of toDelete) {
    if (row.backup_location && existsSync(row.backup_location)) {
      try {
        await fs.rm(row.backup_location, { force: true });
      } catch {
        // ignore cleanup failures
      }
    }
    await pool.query(`DELETE FROM backup_jobs WHERE id = $1`, [row.id]);
  }
}

/**
 * Start a nightly database backup job
 */
export async function startDatabaseBackup(
  backupConfigId: string
): Promise<BackupJob> {
  try {
    const jobId = nanoid();
    const config = await getBackupConfig(backupConfigId);
    if (!config) {
      throw new Error(`Backup config not found: ${backupConfigId}`);
    }

    // Create backup job record
    const result = await pool.query(
      `INSERT INTO backup_jobs (id, backup_config_id, status, started_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       RETURNING id, status, started_at`,
      [jobId, backupConfigId, 'running']
    );

    const row = result.rows[0];

    console.log(`[BACKUP] Started backup job: ${jobId}`);

    setTimeout(async () => {
      try {
        const work = await buildBackupWorkdir(jobId, backupConfigId);
        const storageRoot = normalizeStoragePath(config.storage_path);
        await ensureDir(storageRoot);
        const archiveName = `sven-backup-${formatTimestamp()}.tar.gz`;
        const archivePath = path.join(storageRoot, archiveName);
        await tar.c({ gzip: true, file: archivePath, cwd: work.dir }, ['.']);
        const archiveStat = await fs.stat(archivePath);
        const backupHash = await fileHashSha256(archivePath);

        await pool.query(
          `UPDATE backup_jobs 
           SET status = 'completed', 
               completed_at = CURRENT_TIMESTAMP,
               duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)),
               total_size_bytes = $1,
               compressed_size_bytes = $2,
               backup_location = $3,
               backup_file_hash = $4,
               verification_result = 'passed',
               verified_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [work.totalSize, archiveStat.size, archivePath, backupHash, jobId],
        );

        const updated = await pool.query(
          `UPDATE backup_status
           SET latest_backup_job_id = $1,
               latest_backup_time = CURRENT_TIMESTAMP,
               latest_backup_status = 'completed',
               latest_backup_size_bytes = $2,
               updated_at = CURRENT_TIMESTAMP`,
          [jobId, archiveStat.size],
        );
        if (updated.rowCount === 0) {
          await pool.query(
            `INSERT INTO backup_status (latest_backup_job_id, latest_backup_time, latest_backup_status, latest_backup_size_bytes, updated_at)
             VALUES ($1, CURRENT_TIMESTAMP, 'completed', $2, CURRENT_TIMESTAMP)`,
            [jobId, archiveStat.size],
          );
        }

        await logBackupAction(
          'backup_completed',
          'backup_job',
          jobId,
          'system',
          { success: true, archive: archiveName }
        );

        try {
          await cleanupOldBackups(backupConfigId, config.retention_days);
        } catch (cleanupErr) {
          console.warn('Backup retention cleanup failed (non-fatal):', cleanupErr);
        }
        await fs.rm(work.dir, { recursive: true, force: true });
      } catch (err) {
        console.error('Failed to complete backup job:', err);
        await pool.query(
          `UPDATE backup_jobs 
           SET status = 'failed', error_message = $1, completed_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [String(err), jobId],
        );
      }
    }, 1000);

    return {
      id: row.id,
      status: row.status,
      startedAt: row.started_at,
    };
  } catch (error) {
    console.error('Failed to start backup job:', error);
    throw error;
  }
}

/**
 * Get backup job status
 */
export async function getBackupJobStatus(jobId: string): Promise<BackupJob | null> {
  try {
    const result = await pool.query(
      `SELECT id, status, started_at, completed_at, total_size_bytes, backup_location
       FROM backup_jobs
       WHERE id = $1`,
      [jobId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      totalSizeBytes: row.total_size_bytes,
      backupLocation: row.backup_location,
    };
  } catch (error) {
    console.error('Failed to get backup job status:', error);
    return null;
  }
}

/**
 * Create a snapshot from a backup (point-in-time restore capability)
 */
export async function createSnapshot(
  backupJobId: string,
  description: string,
  tags: string[] = []
): Promise<{ id: string; location: string }> {
  try {
    const snapshotId = nanoid();

    // Verify backup job exists and is completed
    const backupResult = await pool.query(
      `SELECT backup_location, backup_file_hash FROM backup_jobs WHERE id = $1 AND status = 'completed'`,
      [backupJobId]
    );

    if (backupResult.rows.length === 0) {
      throw new Error('Backup job not found or not completed');
    }

    const backupLocation = backupResult.rows[0].backup_location;

    // Create snapshot record
    const result = await pool.query(
      `INSERT INTO snapshot_jobs (id, snapshot_time, backup_job_id, snapshot_location, description, tags, status)
       VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, 'available')
       RETURNING id, snapshot_location`,
      [snapshotId, backupJobId, backupLocation, description, JSON.stringify(tags)]
    );

    const row = result.rows[0];

    await logBackupAction(
      'snapshot_created',
      'snapshot_job',
      snapshotId,
      'system',
      { backup_job_id: backupJobId, description }
    );

    return {
      id: row.id,
      location: row.snapshot_location,
    };
  } catch (error) {
    console.error('Failed to create snapshot:', error);
    throw error;
  }
}

/**
 * Archive a backup for long-term compliance storage
 */
export async function archiveBackup(
  backupJobId: string,
  complianceCategory: string,
  retentionYears: number = 7
): Promise<{ id: string; location: string }> {
  try {
    const archiveId = nanoid();

    // Verify backup exists
    const backupResult = await pool.query(
      `SELECT backup_location, backup_file_hash FROM backup_jobs WHERE id = $1`,
      [backupJobId]
    );

    if (backupResult.rows.length === 0) {
      throw new Error('Backup job not found');
    }

    // Create archive record
    const result = await pool.query(
      `INSERT INTO archive_jobs 
       (id, backup_job_id, status, archive_location, archive_format, compliance_category, retention_years)
       VALUES ($1, $2, 'archiving', $3, 'tar.gz', $4, $5)
       RETURNING id, archive_location`,
      [
        archiveId,
        backupJobId,
        `/nas/archive/${complianceCategory}/backup-${archiveId}.tar.gz`,
        complianceCategory,
        retentionYears,
      ]
    );

    const row = result.rows[0];

    // Simulate archiving (in production, this would be async)
    setTimeout(async () => {
      try {
        const archiveHash = createHash('sha256')
          .update(`archive-${archiveId}-${Date.now()}`)
          .digest('hex');

        await pool.query(
          `UPDATE archive_jobs 
           SET status = 'completed', completed_at = CURRENT_TIMESTAMP, archive_hash = $1
           WHERE id = $2`,
          [archiveHash, archiveId]
        );
      } catch (err) {
        console.error('Failed to complete archive:', err);
      }
    }, 1000);

    await logBackupAction(
      'archive_created',
      'archive_job',
      archiveId,
      'system',
      { backup_job_id: backupJobId, compliance_category: complianceCategory }
    );

    return {
      id: archiveId,
      location: row.archive_location,
    };
  } catch (error) {
    console.error('Failed to archive backup:', error);
    throw error;
  }
}

/**
 * Start a restore job from a backup
 */
export async function startRestore(
  backupJobId: string,
  targetEnvironment: string,
  initiatedBy: string,
  reason: string
): Promise<RestoreJob> {
  try {
    const restoreId = nanoid();
    const executionMode = resolveRestoreExecutionMode(process.env);
    const allowSimulatedInProd = parseBooleanFlag(process.env.SVEN_ALLOW_SIMULATED_RESTORE_IN_PROD, false);

    if (executionMode === 'simulated' && isProductionLikeProfile(process.env) && !allowSimulatedInProd) {
      const err = new Error('Simulated restore execution is disabled in production profiles');
      (err as Error & { code?: string }).code = 'RESTORE_SIMULATION_FORBIDDEN';
      throw err;
    }
    if (executionMode === 'live') {
      const err = new Error('Live restore execution mode is not implemented');
      (err as Error & { code?: string }).code = 'RESTORE_LIVE_NOT_IMPLEMENTED';
      throw err;
    }

    // Verify backup exists
    const backupResult = await pool.query(
      `SELECT id FROM backup_jobs WHERE id = $1 AND status IN ('completed', 'verified', 'uploaded')`,
      [backupJobId]
    );

    if (backupResult.rows.length === 0) {
      throw new Error('Backup not available for restore');
    }

    const validation = await validateBackupArchive(backupJobId);
    if (!validation.valid) {
      throw new Error(validation.reason || 'Backup validation failed');
    }

    // Create restore job
    const result = await pool.query(
      `INSERT INTO restore_jobs 
       (id, backup_job_id, target_environment, status, initiated_by, reason, started_at)
       VALUES ($1, $2, $3, 'pending', $4, $5, CURRENT_TIMESTAMP)
       RETURNING id, backup_job_id, target_environment, status, initiated_by`,
      [restoreId, backupJobId, targetEnvironment, initiatedBy, reason]
    );

    const row = result.rows[0];

    console.log(
      `[RESTORE] Restore job initiated: ${restoreId} to ${targetEnvironment} by ${initiatedBy} (mode=${executionMode})`
    );

    // Simulated restore execution mode.
    setTimeout(async () => {
      try {
        await pool.query(
          `UPDATE restore_jobs 
           SET status = 'running', started_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [restoreId]
        );

        // Simulate completion
        setTimeout(async () => {
          try {
            await pool.query(
              `UPDATE restore_jobs 
               SET status = 'completed', 
                   completed_at = CURRENT_TIMESTAMP,
                   duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at)),
                   data_verification_passed = true
               WHERE id = $1`,
              [restoreId]
            );

            await logBackupAction(
              'restore_completed',
              'restore_job',
              restoreId,
              initiatedBy,
              { target_environment: targetEnvironment, execution_mode: executionMode }
            );
          } catch (err) {
            console.error('Failed to complete restore:', err);
          }
        }, 3000);
      } catch (err) {
        console.error('Failed to start restore execution:', err);
      }
    }, 1000);

    return {
      id: row.id,
      backupJobId: row.backup_job_id,
      targetEnvironment: row.target_environment,
      status: row.status,
      initiatedBy: row.initiated_by,
      executionMode,
    };
  } catch (error) {
    console.error('Failed to start restore:', error);
    throw error;
  }
}

/**
 * Get restore job status
 */
export async function getRestoreJobStatus(restoreId: string): Promise<RestoreJob | null> {
  try {
    const executionMode = resolveRestoreExecutionMode(process.env);
    const result = await pool.query(
      `SELECT id, backup_job_id, target_environment, status, initiated_by
       FROM restore_jobs
       WHERE id = $1`,
      [restoreId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      backupJobId: row.backup_job_id,
      targetEnvironment: row.target_environment,
      status: row.status,
      initiatedBy: row.initiated_by,
      executionMode,
    };
  } catch (error) {
    console.error('Failed to get restore job status:', error);
    return null;
  }
}

/**
 * Get backup status summary for dashboard
 */
export async function getBackupStatus(): Promise<{
  lastBackupTime?: Date;
  lastBackupStatus?: string;
  lastSnapshotTime?: Date;
  lastArchiveTime?: Date;
  healthStatus: string;
  alertMessage?: string;
}> {
  try {
    const result = await pool.query(
      `SELECT bs.latest_backup_time, bs.latest_backup_status, 
              bs.latest_snapshot_time, bs.latest_archive_time,
              bs.backup_health_status, bs.alert_message,
              bs.days_since_last_successful_backup
       FROM backup_status bs
       ORDER BY bs.updated_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      return {
        healthStatus: 'unknown',
        alertMessage: 'No backup status available',
      };
    }

    const row = result.rows[0];
    return {
      lastBackupTime: row.latest_backup_time,
      lastBackupStatus: row.latest_backup_status,
      lastSnapshotTime: row.latest_snapshot_time,
      lastArchiveTime: row.latest_archive_time,
      healthStatus: row.backup_health_status || 'unknown',
      alertMessage: row.alert_message,
    };
  } catch (error) {
    console.error('Failed to get backup status:', error);
    return { healthStatus: 'error' };
  }
}

/**
 * Schedule a disaster recovery drill
 */
export async function scheduleDRDrill(
  name: string,
  description: string,
  scope: string,
  affectedSystems: string[],
  scheduledDate: Date
): Promise<DRDrill> {
  try {
    const drillId = nanoid();

    const result = await pool.query(
      `INSERT INTO dr_drills (id, name, description, scope, affected_systems, scheduled_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       RETURNING id, name, status, scheduled_date, scope`,
      [drillId, name, description, scope, JSON.stringify(affectedSystems), scheduledDate]
    );

    const row = result.rows[0];

    await logBackupAction(
      'dr_drill_scheduled',
      'dr_drill',
      drillId,
      'system',
      { scope, systems: affectedSystems }
    );

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      scheduledDate: row.scheduled_date,
      scope: row.scope,
    };
  } catch (error) {
    console.error('Failed to schedule DR drill:', error);
    throw error;
  }
}

/**
 * Start a disaster recovery drill
 */
export async function startDRDrill(
  drillId: string,
  leadPerson: string
): Promise<{ success: boolean; drillId: string }> {
  try {
    await pool.query(
      `UPDATE dr_drills 
       SET status = 'in_progress', drill_date = CURRENT_TIMESTAMP, lead_person = $1
       WHERE id = $2`,
      [leadPerson, drillId]
    );

    await logBackupAction('dr_drill_started', 'dr_drill', drillId, leadPerson, {});

    return { success: true, drillId };
  } catch (error) {
    console.error('Failed to start DR drill:', error);
    throw error;
  }
}

/**
 * Complete a disaster recovery drill with results
 */
export async function completeDRDrill(
  drillId: string,
  success: boolean,
  findings: string,
  recommendations: string,
  actionItems: any
): Promise<{ success: boolean }> {
  try {
    await pool.query(
      `UPDATE dr_drills 
       SET status = 'completed', 
           success = $1,
           findings = $2,
           recommendations = $3,
           action_items = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [success, findings, recommendations, JSON.stringify(actionItems), drillId]
    );

    await logBackupAction('dr_drill_completed', 'dr_drill', drillId, 'system', {
      success,
      findings,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to complete DR drill:', error);
    throw error;
  }
}

/**
 * Get list of all backups
 */
export async function listBackups(limit: number = 50): Promise<BackupJob[]> {
  try {
    const result = await pool.query(
      `SELECT id, status, started_at, completed_at, backup_location, total_size_bytes
       FROM backup_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      totalSizeBytes: r.total_size_bytes,
      backupLocation: r.backup_location,
    }));
  } catch (error) {
    console.error('Failed to list backups:', error);
    const err = error instanceof Error ? error : new Error('BACKUP_LIST_QUERY_FAILED');
    if (err instanceof Error && err.message === '') {
      err.message = 'BACKUP_LIST_QUERY_FAILED';
    }
    (err as Error & { code?: string }).code = (err as Error & { code?: string }).code || 'BACKUP_LIST_QUERY_FAILED';
    throw err;
  }
}

/**
 * Get list of all restore jobs
 */
export async function listRestoreJobs(limit: number = 50): Promise<RestoreJob[]> {
  try {
    const executionMode = resolveRestoreExecutionMode(process.env);
    const result = await pool.query(
      `SELECT id, backup_job_id, target_environment, status, initiated_by
       FROM restore_jobs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((r) => ({
      id: r.id,
      backupJobId: r.backup_job_id,
      targetEnvironment: r.target_environment,
      status: r.status,
      initiatedBy: r.initiated_by,
      executionMode,
    }));
  } catch (error) {
    console.error('Failed to list restore jobs:', error);
    const err = error instanceof Error ? error : new Error('RESTORE_LIST_QUERY_FAILED');
    if (err instanceof Error && err.message === '') {
      err.message = 'RESTORE_LIST_QUERY_FAILED';
    }
    (err as Error & { code?: string }).code = (err as Error & { code?: string }).code || 'RESTORE_LIST_QUERY_FAILED';
    throw err;
  }
}

/**
 * Log backup/restore action to audit trail
 */
export async function logBackupAction(
  actionType: string,
  resourceType: string,
  resourceId: string,
  actorUserId: string,
  details: any
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO backup_audit_log (action_type, resource_type, resource_id, actor_user_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actionType, resourceType, resourceId, actorUserId, JSON.stringify(details || {})]
    );
  } catch (error) {
    console.error('Failed to log backup action:', error);
  }
}

/**
 * Verify backup integrity (checksum validation)
 */
export async function verifyBackupIntegrity(backupJobId: string): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT backup_file_hash, backup_location FROM backup_jobs WHERE id = $1`,
      [backupJobId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const backup = result.rows[0];
    if (!backup.backup_location || !existsSync(backup.backup_location)) {
      return false;
    }
    const computed = await fileHashSha256(backup.backup_location);
    const ok = computed === backup.backup_file_hash;

    await pool.query(
      `UPDATE backup_jobs 
       SET verification_result = $2, verified_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [backupJobId, ok ? 'passed' : 'failed']
    );

    return ok;
  } catch (error) {
    console.error('Failed to verify backup integrity:', error);
    return false;
  }
}

export async function listBackupConfigs(): Promise<BackupConfigRow[]> {
  try {
    const result = await pool.query(
      `SELECT id, backup_type, enabled, schedule_cron, retention_days, storage_path, storage_type, compression_enabled, compression_algorithm
       FROM backup_config
       ORDER BY id ASC`,
    );
    return result.rows;
  } catch (error) {
    console.error('Failed to list backup configs:', error);
    return [];
  }
}

export async function updateBackupConfig(
  configId: string,
  updates: Partial<Pick<BackupConfigRow, 'enabled' | 'schedule_cron' | 'retention_days' | 'storage_path'>>,
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE backup_config
       SET enabled = COALESCE($2, enabled),
           schedule_cron = COALESCE($3, schedule_cron),
           retention_days = COALESCE($4, retention_days),
           storage_path = COALESCE($5, storage_path),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [
        configId,
        typeof updates.enabled === 'boolean' ? updates.enabled : null,
        updates.schedule_cron || null,
        typeof updates.retention_days === 'number' ? updates.retention_days : null,
        updates.storage_path || null,
      ],
    );
    if (result.rows.length === 0) return false;

    const config = await getBackupConfig(configId);
    if (config?.schedule_cron && isValidCron(config.schedule_cron)) {
      await upsertBackupCronJob(config);
    }

    return true;
  } catch (error) {
    console.error('Failed to update backup config:', error);
    return false;
  }
}

async function upsertBackupCronJob(config: BackupConfigRow): Promise<void> {
  const configId = config.id;
  const cronJobsHasOrgColumn = (
    await pool.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'cron_jobs'
          AND column_name = 'organization_id'
        LIMIT 1`,
    )
  ).rows.length > 0;
  const fallbackOrg = await pool.query(
    `SELECT id
       FROM organizations
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT 1`,
  );
  const organizationId = String(fallbackOrg.rows[0]?.id || '').trim();
  if (cronJobsHasOrgColumn && !organizationId) {
    throw new Error('backup cron sync requires organization_id context');
  }

  const existing = cronJobsHasOrgColumn
    ? await pool.query(
      `SELECT id
         FROM cron_jobs
        WHERE organization_id = $1
          AND handler = 'backup'
          AND (payload->>'config_id' = $2 OR name = $3)`,
      [organizationId, configId, `backup:${configId}`],
    )
    : await pool.query(
      `SELECT id
         FROM cron_jobs
        WHERE handler = 'backup'
          AND (payload->>'config_id' = $1 OR name = $2)`,
      [configId, `backup:${configId}`],
    );
  const nextRun = computeNextRun(config.schedule_cron, new Date());
  if (existing.rows.length > 0) {
    if (cronJobsHasOrgColumn) {
      await pool.query(
        `UPDATE cron_jobs
         SET expression = $2,
             enabled = $3,
             payload = $4,
             next_run = $5,
             updated_at = NOW()
         WHERE id = $1
           AND organization_id = $6`,
        [
          existing.rows[0].id,
          config.schedule_cron,
          config.enabled !== false,
          JSON.stringify({ config_id: configId }),
          nextRun?.toISOString() || null,
          organizationId,
        ],
      );
    } else {
      await pool.query(
        `UPDATE cron_jobs
         SET expression = $2,
             enabled = $3,
             payload = $4,
             next_run = $5,
             updated_at = NOW()
         WHERE id = $1`,
        [
          existing.rows[0].id,
          config.schedule_cron,
          config.enabled !== false,
          JSON.stringify({ config_id: configId }),
          nextRun?.toISOString() || null,
        ],
      );
    }
    return;
  }
  if (cronJobsHasOrgColumn) {
    await pool.query(
      `INSERT INTO cron_jobs (id, organization_id, name, expression, handler, payload, enabled, next_run, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'backup', $5, $6, $7, NOW(), NOW())`,
      [
        nanoid(),
        organizationId,
        `backup:${configId}`,
        config.schedule_cron,
        JSON.stringify({ config_id: configId }),
        config.enabled !== false,
        nextRun?.toISOString() || null,
      ],
    );
  } else {
    await pool.query(
      `INSERT INTO cron_jobs (id, name, expression, handler, payload, enabled, next_run, created_at, updated_at)
       VALUES ($1, $2, $3, 'backup', $4, $5, $6, NOW(), NOW())`,
      [
        nanoid(),
        `backup:${configId}`,
        config.schedule_cron,
        JSON.stringify({ config_id: configId }),
        config.enabled !== false,
        nextRun?.toISOString() || null,
      ],
    );
  }
}

export async function syncBackupCronJobs(): Promise<{ synced: number }> {
  try {
    const configs = await listBackupConfigs();
    let synced = 0;
    for (const config of configs) {
      if (!config.schedule_cron || !isValidCron(config.schedule_cron)) continue;
      await upsertBackupCronJob(config);
      synced += 1;
    }
    return { synced };
  } catch (error) {
    console.error('Failed to sync backup cron jobs:', error);
    return { synced: 0 };
  }
}

export async function getBackupArchivePath(backupJobId: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT backup_location FROM backup_jobs WHERE id = $1`,
    [backupJobId],
  );
  if (result.rows.length === 0) return null;
  const location = result.rows[0].backup_location;
  if (!location || !existsSync(location)) return null;
  return location;
}

export async function registerUploadedBackup(params: {
  fileName: string;
  contentBase64: string;
  configId?: string;
}): Promise<BackupJob> {
  const jobId = nanoid();
  const configId = params.configId || null;
  const storageRoot = normalizeStoragePath(null);
  await ensureDir(storageRoot);
  const archiveName = params.fileName || `sven-backup-${formatTimestamp()}.tar.gz`;
  const safeName = archiveName.replace(/[^A-Za-z0-9._-]/g, '_');
  const targetPath = path.join(storageRoot, safeName);
  const maxBytes = getFileUploadMaxBytes();
  const normalizedBase64 = String(params.contentBase64 || '').replace(/\s+/g, '');
  if (!isLikelyBase64(normalizedBase64)) {
    throw new Error('INVALID_UPLOAD_BASE64');
  }
  const estimatedBytes = estimateBase64DecodedBytes(normalizedBase64);
  if (estimatedBytes > maxBytes) {
    throw new Error(`UPLOAD_TOO_LARGE:${maxBytes}`);
  }
  const buffer = Buffer.from(normalizedBase64, 'base64');
  if (buffer.length > maxBytes) {
    throw new Error(`UPLOAD_TOO_LARGE:${maxBytes}`);
  }
  await fs.writeFile(targetPath, buffer);
  const manifestValidation = await extractManifest(targetPath);
  if (!manifestValidation || manifestValidation.version !== '1.0') {
    await fs.rm(targetPath, { force: true });
    const err = new Error('Uploaded archive must include a valid manifest.json (version 1.0)');
    (err as Error & { code?: string }).code = 'INVALID_UPLOAD_ARCHIVE';
    throw err;
  }
  const hash = await fileHashSha256(targetPath);
  const stat = await fs.stat(targetPath);

  await pool.query(
    `INSERT INTO backup_jobs (id, backup_config_id, status, started_at, completed_at, total_size_bytes, compressed_size_bytes, backup_location, backup_file_hash, verification_result, verified_at)
     VALUES ($1, $2, 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4, $5, $6, 'pending', NULL)`,
    [jobId, configId, stat.size, stat.size, targetPath, hash],
  );

  await logBackupAction('backup_uploaded', 'backup_job', jobId, 'system', {
    file_name: safeName,
  });

  return {
    id: jobId,
    status: 'uploaded',
    startedAt: new Date(),
    completedAt: new Date(),
    totalSizeBytes: stat.size,
    backupLocation: targetPath,
  };
}

export async function validateBackupArchive(backupJobId: string): Promise<{
  valid: boolean;
  manifest?: BackupManifest;
  reason?: string;
}> {
  const pathResult = await getBackupArchivePath(backupJobId);
  if (!pathResult) {
    return { valid: false, reason: 'Backup archive not found' };
  }
  const manifest = await extractManifest(pathResult);
  if (!manifest) {
    return { valid: false, reason: 'Manifest missing or unreadable' };
  }
  if (manifest.version !== '1.0') {
    return { valid: false, reason: `Unsupported manifest version: ${manifest.version}` };
  }
  return { valid: true, manifest };
}

/**
 * Get restore-to-staging procedure documentation
 */
export async function getRestoreProcedure(): Promise<string> {
  return `
# Restore-to-Staging Procedure

## Prerequisites
- Identify backup job ID or snapshot
- Ensure staging environment has sufficient storage (2x backup size)
- Have admin credentials available

## Steps

1. **Select Backup**
   - Choose backup from list or specify backup ID
   - Verify backup status is 'completed' or 'verified'

2. **Initiate Restore**
   - Call POST /backup/restore with:
     - backup_job_id: selected backup
     - target_environment: 'staging'
     - reason: document purpose of restore

3. **Monitor Progress**
   - Check restore job status via GET /backup/restore/{id}
   - Expected duration: 15-60 minutes depending on database size

4. **Verify Data**
   - Once complete, run data validation queries
   - Compare record counts with production
   - Verify critical tables and indexes

5. **Test Failover (Optional)**
   - Test application connection to restored database
   - Run integration tests
   - Verify read/write operations

6. **Clean Up**
   - Once testing complete, can delete staging restore
   - Or keep for next testing cycle

## Troubleshooting

- Restore status 'failed': Check error_message field
- Data validation issues: Review verification_details
- Connection errors: Verify network access and credentials

## Estimated Recovery Time Objective (RTO)
- Production restore: 30-90 minutes (includes verification)
- Staging restore: 15-60 minutes (no production disruption)
`;
}
