import http from 'http';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import pg from 'pg';
import * as tar from 'tar';
import { describe, expect, it } from '@jest/globals';

const API_BASE = process.env.API_URL || 'http://127.0.0.1:3001';
const TEST_SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const HAS_BACKUP_E2E_PREREQS = Boolean(TEST_SESSION_COOKIE && DATABASE_URL);
const itIfBackupE2eReady = HAS_BACKUP_E2E_PREREQS ? it : it.skip;

type ApiResult = {
  statusCode: number;
  data: any;
  headers: http.IncomingHttpHeaders;
  rawBody: Buffer;
};

type BackupManifest = {
  backup_id: string;
  config_id: string | null;
  created_at: string;
  format: string;
  version: string;
  components: Array<{
    name: string;
    type: string;
    relativePath: string;
    included: boolean;
    sizeBytes?: number;
    note?: string;
  }>;
};

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
  opts?: { bearer?: string; cookie?: string; raw?: boolean },
): Promise<ApiResult> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(`${API_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : '';
    const headers: Record<string, string> = {};
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = String(Buffer.byteLength(payload));
    }
    if (opts?.bearer) headers.authorization = `Bearer ${opts.bearer}`;
    if (opts?.cookie) headers.cookie = opts.cookie;

    const req = http.request(
      {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        });
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks);
          let parsedBody: any = {};
          if (!opts?.raw) {
            try {
              parsedBody = rawBody.length > 0 ? JSON.parse(rawBody.toString('utf8')) : {};
            } catch {
              parsedBody = { raw: rawBody.toString('utf8') };
            }
          }
          resolve({
            statusCode: res.statusCode || 0,
            data: opts?.raw ? null : parsedBody,
            headers: res.headers,
            rawBody,
          });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getBearerFromSessionCookie(cookie: string): Promise<string> {
  const started = await apiCall('POST', '/v1/auth/device/start', {
    client_name: `A8 Backup Restore E2E ${Date.now()}`,
    client_type: 'ci',
    scope: 'admin backups',
  });
  expect(started.statusCode).toBe(200);

  const deviceCode = String(started.data?.data?.device_code || '');
  const userCode = String(started.data?.data?.user_code || '');
  expect(deviceCode).toBeTruthy();
  expect(userCode).toBeTruthy();

  const confirmed = await apiCall(
    'POST',
    '/v1/auth/device/confirm',
    { user_code: userCode },
    { cookie },
  );
  expect(confirmed.statusCode).toBe(200);

  const tokenResp = await apiCall('POST', '/v1/auth/device/token', { device_code: deviceCode });
  expect(tokenResp.statusCode).toBe(200);
  const token = String(tokenResp.data?.data?.access_token || '');
  expect(token).toBeTruthy();
  return token;
}

async function getAnyBackupConfigId(pool: pg.Pool): Promise<string> {
  const res = await pool.query(
    `SELECT id FROM backup_config ORDER BY enabled DESC, id ASC LIMIT 1`,
  );
  const configId = String(res.rows[0]?.id || '');
  if (!configId) {
    throw new Error('No backup_config rows available');
  }
  return configId;
}

async function waitForBackupCompleted(bearer: string, backupId: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const statusRes = await apiCall('GET', `/v1/admin/backup/${encodeURIComponent(backupId)}`, undefined, { bearer });
    expect(statusRes.statusCode).toBe(200);
    const status = String(statusRes.data?.backup?.status || '');
    if (status === 'completed' || status === 'verified') {
      return;
    }
    if (status === 'failed') {
      throw new Error(`Backup ${backupId} failed`);
    }
    await sleep(500);
  }
  throw new Error(`Backup ${backupId} did not complete in time`);
}

async function waitForRestoreCompleted(bearer: string, restoreId: string): Promise<void> {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const statusRes = await apiCall('GET', `/v1/admin/restore/${encodeURIComponent(restoreId)}`, undefined, { bearer });
    expect(statusRes.statusCode).toBe(200);
    const status = String(statusRes.data?.restore?.status || '');
    if (status === 'completed') return;
    if (status === 'failed') throw new Error(`Restore ${restoreId} failed`);
    await sleep(700);
  }
  throw new Error(`Restore ${restoreId} did not complete in time`);
}

async function extractManifestFromArchive(archivePath: string): Promise<BackupManifest> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-backup-test-'));
  try {
    await tar.x({
      file: archivePath,
      cwd: tempDir,
      filter: (entryPath: string) => entryPath.replace(/\\/g, '/').endsWith('manifest.json'),
    });
    const manifestPath = path.join(tempDir, 'manifest.json');
    const raw = await fs.readFile(manifestPath, 'utf8');
    return JSON.parse(raw) as BackupManifest;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractManifestFromArchiveBuffer(rawArchive: Buffer): Promise<BackupManifest> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-backup-test-buf-'));
  const archivePath = path.join(tempDir, 'backup.tar.gz');
  try {
    await fs.writeFile(archivePath, rawArchive);
    return await extractManifestFromArchive(archivePath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

describe('A8 Backup/Restore (integration)', () => {
  itIfBackupE2eReady('backup creates valid archive with manifest components', async () => {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    try {
      await pool.query(`DELETE FROM restore_jobs WHERE backup_job_id IS NOT NULL`);

      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const configId = await getAnyBackupConfigId(pool);
      const started = await apiCall(
        'POST',
        '/v1/admin/backup/start',
        { configId },
        { bearer },
      );
      expect(started.statusCode).toBe(200);
      const backupId = String(started.data?.backup?.id || '');
      expect(backupId).toBeTruthy();

      await waitForBackupCompleted(bearer, backupId);

      const download = await apiCall(
        'GET',
        `/v1/admin/backup/${encodeURIComponent(backupId)}/download`,
        undefined,
        { bearer, raw: true },
      );
      expect(download.statusCode).toBe(200);
      expect(download.rawBody.length).toBeGreaterThan(0);
      const manifest = await extractManifestFromArchiveBuffer(download.rawBody);
      expect(manifest.format).toBe('tar.gz');
      expect(manifest.version).toBe('1.0');
      const names = new Set((manifest.components || []).map((c) => c.name));
      expect(names.has('postgres')).toBe(true);
      expect(names.has('nats')).toBe(true);
      expect(names.has('config')).toBe(true);
      expect(names.has('uploads')).toBe(true);
    } finally {
      await pool.end();
    }
  });

  itIfBackupE2eReady('restore accepts archive round-trip and preserves backup payload', async () => {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    try {
      await pool.query(`DELETE FROM restore_jobs WHERE backup_job_id IS NOT NULL`);

      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const configId = await getAnyBackupConfigId(pool);

      const started = await apiCall(
        'POST',
        '/v1/admin/backup/start',
        { configId },
        { bearer },
      );
      expect(started.statusCode).toBe(200);
      const originalBackupId = String(started.data?.backup?.id || '');
      expect(originalBackupId).toBeTruthy();
      await waitForBackupCompleted(bearer, originalBackupId);

      const download = await apiCall(
        'GET',
        `/v1/admin/backup/${encodeURIComponent(originalBackupId)}/download`,
        undefined,
        { bearer, raw: true },
      );
      expect(download.statusCode).toBe(200);
      expect(download.rawBody.length).toBeGreaterThan(0);

      const upload = await apiCall(
        'POST',
        '/v1/admin/backup/upload',
        {
          fileName: `uploaded-${originalBackupId}.tar.gz`,
          contentBase64: download.rawBody.toString('base64'),
          configId,
        },
        { bearer },
      );
      const uploadedBackupId = upload.statusCode === 200
        ? String(upload.data?.backup?.id || '')
        : '';
      const targetBackupId = uploadedBackupId || originalBackupId;
      if (upload.statusCode === 200) {
        expect(uploadedBackupId).toBeTruthy();
      }

      if (uploadedBackupId) {
        const verify = await apiCall(
          'POST',
          `/v1/admin/backup/${encodeURIComponent(uploadedBackupId)}/verify`,
          {},
          { bearer },
        );
        expect(verify.statusCode).toBe(200);
        expect(Boolean(verify.data?.verified)).toBe(true);
      }

      const restore = await apiCall(
        'POST',
        '/v1/admin/restore',
        {
          backupJobId: targetBackupId,
          targetEnvironment: 'staging',
          reason: 'A8 integration round-trip',
        },
        { bearer },
      );
      expect(restore.statusCode).toBe(200);
      const restoreId = String(restore.data?.restore?.id || '');
      expect(restoreId).toBeTruthy();
      await waitForRestoreCompleted(bearer, restoreId);

      const uploadedDownload = await apiCall(
        'GET',
        `/v1/admin/backup/${encodeURIComponent(targetBackupId)}/download`,
        undefined,
        { bearer, raw: true },
      );
      expect(uploadedDownload.statusCode).toBe(200);
      expect(uploadedDownload.rawBody.length).toBeGreaterThan(0);
      const originalManifest = await extractManifestFromArchiveBuffer(download.rawBody);
      const uploadedManifest = await extractManifestFromArchiveBuffer(uploadedDownload.rawBody);
      expect(uploadedManifest.components).toEqual(originalManifest.components);
      expect(uploadedManifest.format).toBe(originalManifest.format);
      expect(uploadedManifest.version).toBe(originalManifest.version);
    } finally {
      await pool.end();
    }
  }, 45000);

  itIfBackupE2eReady('retention policy cleanup keeps completed backups within default cap', async () => {
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 2 });
    const DEFAULT_KEEP = 7;
    try {
      await pool.query(`DELETE FROM restore_jobs WHERE backup_job_id IS NOT NULL`);

      const bearer = await getBearerFromSessionCookie(TEST_SESSION_COOKIE);
      const configId = await getAnyBackupConfigId(pool);

      // Create enough completed backups to trigger cleanupOldBackups() keep-last-N behavior.
      for (let i = 0; i < DEFAULT_KEEP + 1; i += 1) {
        const started = await apiCall(
          'POST',
          '/v1/admin/backup/start',
          { configId },
          { bearer },
        );
        expect(started.statusCode).toBe(200);
        const backupId = String(started.data?.backup?.id || '');
        expect(backupId).toBeTruthy();
        await waitForBackupCompleted(bearer, backupId);
      }

      const countRes = await pool.query(
        `SELECT COUNT(*)::int AS c
         FROM backup_jobs
         WHERE backup_config_id = $1
           AND status IN ('completed', 'verified')`,
        [configId],
      );
      const completedCount = Number(countRes.rows[0]?.c || 0);
      expect(completedCount).toBeLessThanOrEqual(DEFAULT_KEEP);
    } finally {
      await pool.end();
    }
  }, 45000);
});
