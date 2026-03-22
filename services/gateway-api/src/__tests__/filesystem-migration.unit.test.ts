import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { runFilesystemMigration } from '../services/FilesystemMigrationService';

describe('filesystem migration service', () => {
  let tmpRoot: string;
  let legacyRoot: string;
  let targetRoot: string;
  let markerPath: string;
  let backupRoot: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sven-fs-migrate-'));
    legacyRoot = path.join(tmpRoot, 'legacy');
    targetRoot = path.join(tmpRoot, 'data');
    markerPath = path.join(tmpRoot, 'migrations', 'marker.json');
    backupRoot = path.join(tmpRoot, 'migrations', 'backup');

    await fs.mkdir(path.join(legacyRoot, 'knowledge'), { recursive: true });
    await fs.mkdir(path.join(legacyRoot, 'legacy', 'knowledge'), { recursive: true });
    await fs.writeFile(path.join(legacyRoot, '.env'), 'A=1\n', 'utf8');
    await fs.writeFile(path.join(legacyRoot, 'scheduler.json'), '{"enabled":true}', 'utf8');
    await fs.writeFile(path.join(legacyRoot, 'knowledge', 'README.md'), 'k', 'utf8');
    await fs.writeFile(path.join(legacyRoot, 'legacy', 'scheduler.json'), '{"legacy":true}', 'utf8');
    await fs.writeFile(path.join(legacyRoot, 'legacy', 'knowledge', 'old.md'), 'old', 'utf8');
  });

  afterEach(async () => {
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('moves legacy files to target root and writes marker', async () => {
    const summary = await runFilesystemMigration({
      SVEN_LEGACY_DATA_ROOT: legacyRoot,
      SVEN_DATA_ROOT: targetRoot,
      SVEN_FS_MIGRATION_MARKER: markerPath,
      SVEN_FS_MIGRATION_BACKUP_ROOT: backupRoot,
      SVEN_FS_MIGRATION_ENABLED: 'true',
      SVEN_FS_MIGRATION_DRY_RUN: 'false',
    } as NodeJS.ProcessEnv);

    expect(summary.executed).toBe(true);
    expect(summary.moved.length).toBeGreaterThan(0);
    await expect(fs.access(path.join(targetRoot, 'config', '.env'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(targetRoot, 'scheduler', 'scheduler.json'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(targetRoot, 'knowledge', 'README.md'))).resolves.toBeUndefined();
    await expect(fs.access(markerPath)).resolves.toBeUndefined();
    expect(summary.backupDir).toBeTruthy();
    await expect(fs.access(path.join(String(summary.backupDir), 'manifest.json'))).resolves.toBeUndefined();
  });

  it('supports dry run without moving files', async () => {
    const summary = await runFilesystemMigration({
      SVEN_LEGACY_DATA_ROOT: legacyRoot,
      SVEN_DATA_ROOT: targetRoot,
      SVEN_FS_MIGRATION_MARKER: markerPath,
      SVEN_FS_MIGRATION_BACKUP_ROOT: backupRoot,
      SVEN_FS_MIGRATION_ENABLED: 'true',
      SVEN_FS_MIGRATION_DRY_RUN: 'true',
    } as NodeJS.ProcessEnv);

    expect(summary.executed).toBe(true);
    await expect(fs.access(path.join(legacyRoot, '.env'))).resolves.toBeUndefined();
    await expect(fs.access(markerPath)).rejects.toBeTruthy();
  });

  it('skips when marker already exists', async () => {
    await fs.mkdir(path.dirname(markerPath), { recursive: true });
    await fs.writeFile(markerPath, '{}', 'utf8');

    const summary = await runFilesystemMigration({
      SVEN_LEGACY_DATA_ROOT: legacyRoot,
      SVEN_DATA_ROOT: targetRoot,
      SVEN_FS_MIGRATION_MARKER: markerPath,
      SVEN_FS_MIGRATION_BACKUP_ROOT: backupRoot,
      SVEN_FS_MIGRATION_ENABLED: 'true',
    } as NodeJS.ProcessEnv);

    expect(summary.executed).toBe(false);
    expect(summary.skipped).toBe('already_applied');
  });

  it('uses source-relative backup paths to avoid colliding basenames and writes checksum manifest', async () => {
    const summary = await runFilesystemMigration({
      SVEN_LEGACY_DATA_ROOT: legacyRoot,
      SVEN_DATA_ROOT: targetRoot,
      SVEN_FS_MIGRATION_MARKER: markerPath,
      SVEN_FS_MIGRATION_BACKUP_ROOT: backupRoot,
      SVEN_FS_MIGRATION_ENABLED: 'true',
      SVEN_FS_MIGRATION_DRY_RUN: 'false',
    } as NodeJS.ProcessEnv);

    const backupDir = String(summary.backupDir || '');
    const rootKnowledgeBackup = path.join(backupDir, 'knowledge');
    const legacyKnowledgeBackup = path.join(backupDir, 'legacy', 'knowledge');
    await expect(fs.access(path.join(rootKnowledgeBackup, 'README.md'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(legacyKnowledgeBackup, 'old.md'))).resolves.toBeUndefined();

    const manifestPath = path.join(backupDir, 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw) as {
      entries?: Array<{ backup_relative_path?: string; backup_sha256?: string | null }>;
    };
    const relPaths = (manifest.entries || []).map((e) => String(e.backup_relative_path || ''));
    expect(relPaths).toContain('knowledge');
    expect(relPaths).toContain('legacy/knowledge');
    for (const entry of manifest.entries || []) {
      expect(typeof entry.backup_sha256).toBe('string');
      expect(String(entry.backup_sha256 || '').length).toBe(64);
    }
  });
});
