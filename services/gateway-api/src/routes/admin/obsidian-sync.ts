import { FastifyInstance } from 'fastify';
import pg from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import { createMemoryAdapter } from '../../services/MemoryStore.js';

const OBSIDIAN_SETTING_KEY = 'obsidian.vault_path';
const DEFAULT_SYNC_FOLDER = 'Sven Memories';
const OBSIDIAN_IMPORT_MAX_SCAN_DEPTH = 16;
const OBSIDIAN_IMPORT_MAX_SCAN_DIRECTORIES = 5000;
const OBSIDIAN_IMPORT_MAX_SCAN_FILES = 20000;

type MemoryExportRow = {
  id: string;
  user_id: string | null;
  chat_id: string | null;
  visibility: 'user_private' | 'chat_shared' | 'global';
  key: string;
  value: string;
  source: string | null;
  importance: number | null;
  updated_at: string | null;
};

type MemoriesSchemaInfo = {
  hasOrganizationId: boolean;
};

function normalizeImportedImportance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  const rounded = Math.round(numeric);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 128) || 'default';
}

function isSubPath(candidate: string, root: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function isMissingPathError(err: unknown): boolean {
  return !!err && typeof err === 'object' && (err as { code?: string }).code === 'ENOENT';
}

function getObsidianAllowedRoot(orgId: string): string {
  const root = path.resolve(String(process.env.SVEN_INTEGRATION_STORAGE_ROOT || '/var/lib/sven/integrations'));
  return path.resolve(root, sanitizePathSegment(orgId), 'obsidian');
}

async function resolveCanonicalPath(absPath: string): Promise<string> {
  try {
    return await fs.realpath(absPath);
  } catch (err) {
    if (!isMissingPathError(err)) throw err;
    let current = path.dirname(absPath);
    for (;;) {
      try {
        const realAncestor = await fs.realpath(current);
        return path.resolve(realAncestor, path.relative(current, absPath));
      } catch (ancestorErr) {
        if (!isMissingPathError(ancestorErr)) throw ancestorErr;
        const parent = path.dirname(current);
        if (parent === current) throw ancestorErr;
        current = parent;
      }
    }
  }
}

async function resolveValidatedVaultPath(
  orgId: string,
  configuredVaultPath: string,
): Promise<{ ok: true; vaultPath: string } | { ok: false; message: string }> {
  const trimmed = String(configuredVaultPath || '').trim();
  if (!trimmed) return { ok: false, message: 'obsidian.vault_path is not configured' };

  const requestedVaultPath = path.resolve(trimmed);
  const allowedRoot = getObsidianAllowedRoot(orgId);
  await fs.mkdir(allowedRoot, { recursive: true });
  const realAllowedRoot = await fs.realpath(allowedRoot);
  const canonicalVaultPath = await resolveCanonicalPath(requestedVaultPath);

  if (!isSubPath(canonicalVaultPath, realAllowedRoot)) {
    return {
      ok: false,
      message: `obsidian.vault_path must be under ${realAllowedRoot}`,
    };
  }

  return { ok: true, vaultPath: canonicalVaultPath };
}

function parseSettingText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'string') return parsed.trim();
      if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
      return value.trim();
    } catch {
      return value.trim();
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function normalizeSyncFolder(raw: unknown): string {
  const candidate = String(raw || '').trim().replace(/\\/g, '/');
  if (!candidate) return DEFAULT_SYNC_FOLDER;
  const parts = candidate
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .map((part) => part.replace(/[^a-zA-Z0-9 _.-]/g, '-'))
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join('/') : DEFAULT_SYNC_FOLDER;
}

function yamlValue(value: unknown): string {
  const text = String(value ?? '');
  return JSON.stringify(text);
}

function parseFrontmatter(markdown: string): { meta: Record<string, string>; body: string } {
  const trimmed = markdown.replace(/^\uFEFF/, '');
  if (!trimmed.startsWith('---\n')) return { meta: {}, body: trimmed };
  const endIdx = trimmed.indexOf('\n---\n', 4);
  if (endIdx < 0) return { meta: {}, body: trimmed };
  const rawMeta = trimmed.slice(4, endIdx);
  const body = trimmed.slice(endIdx + 5);
  const meta: Record<string, string> = {};
  for (const line of rawMeta.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    let value = line.slice(idx + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    if (key) meta[key] = value;
  }
  return { meta, body };
}

export function memoryToMarkdown(row: MemoryExportRow): string {
  const lines = [
    '---',
    `sven_memory_id: ${yamlValue(row.id)}`,
    `visibility: ${yamlValue(row.visibility)}`,
    `user_id: ${yamlValue(row.user_id || '')}`,
    `chat_id: ${yamlValue(row.chat_id || '')}`,
    `source: ${yamlValue(row.source || '')}`,
    `importance: ${yamlValue(row.importance ?? 1)}`,
    `updated_at: ${yamlValue(row.updated_at || '')}`,
    '---',
    '',
    `# ${String(row.key || 'Memory').trim() || 'Memory'}`,
    '',
    String(row.value || '').trim(),
    '',
  ];
  return lines.join('\n');
}

export function markdownToMemory(markdown: string, fallbackKey: string): {
  sven_memory_id?: string;
  key: string;
  value: string;
  visibility?: 'user_private' | 'chat_shared' | 'global';
  user_id?: string;
  chat_id?: string;
  source?: string;
  importance?: number;
} {
  const { meta, body } = parseFrontmatter(markdown);
  const cleaned = body.trim();
  const heading = cleaned.match(/^#\s+(.+)\s*$/m);
  const key = (heading?.[1] || fallbackKey || 'Obsidian Memory').trim();
  const value = cleaned.replace(/^#\s+.+\n*/m, '').trim();
  const visibilityRaw = String(meta.visibility || '').trim().toLowerCase();
  const visibility =
    visibilityRaw === 'user_private' || visibilityRaw === 'chat_shared' || visibilityRaw === 'global'
      ? (visibilityRaw as 'user_private' | 'chat_shared' | 'global')
      : undefined;
  const importanceNum = Number(meta.importance || '');
  const svenMemoryId = String(meta.sven_memory_id || '').trim();
  return {
    sven_memory_id: svenMemoryId || undefined,
    key,
    value,
    visibility,
    user_id: meta.user_id || undefined,
    chat_id: meta.chat_id || undefined,
    source: meta.source || 'obsidian_sync_import',
    importance: Number.isFinite(importanceNum) ? importanceNum : 1,
  };
}

async function resolveVaultPath(pool: pg.Pool, orgId: string): Promise<string> {
  const org = await pool.query(
    `SELECT value FROM organization_settings WHERE organization_id = $1 AND key = $2 LIMIT 1`,
    [orgId, OBSIDIAN_SETTING_KEY],
  );
  if (org.rows.length > 0) {
    const value = parseSettingText(org.rows[0].value);
    if (value) return value;
  }
  const global = await pool.query(
    `SELECT value FROM settings_global WHERE key = $1 LIMIT 1`,
    [OBSIDIAN_SETTING_KEY],
  );
  if (global.rows.length > 0) {
    const value = parseSettingText(global.rows[0].value);
    if (value) return value;
  }
  return '';
}

async function getMemoriesSchemaInfo(pool: pg.Pool): Promise<MemoriesSchemaInfo> {
  const res = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'memories'`,
  );
  const columns = new Set(res.rows.map((row) => String(row.column_name || '').trim()));
  return {
    hasOrganizationId: columns.has('organization_id'),
  };
}

type MarkdownTraversalResult = {
  files: string[];
  directories_scanned: number;
  files_scanned: number;
  depth_limit_hit: boolean;
  directory_limit_hit: boolean;
  file_scan_limit_hit: boolean;
  collect_limit_hit: boolean;
  partial_results: boolean;
};

async function collectMarkdownFilesBounded(
  root: string,
  options: {
    collectLimit: number;
    maxDepth: number;
    maxDirectories: number;
    maxFilesScanned: number;
  },
): Promise<MarkdownTraversalResult> {
  const found: string[] = [];
  let directoriesScanned = 0;
  let filesScanned = 0;
  let depthLimitHit = false;
  let directoryLimitHit = false;
  let fileScanLimitHit = false;
  let collectLimitHit = false;

  async function walk(current: string, depth: number): Promise<void> {
    if (found.length >= options.collectLimit) {
      collectLimitHit = true;
      return;
    }
    if (depth > options.maxDepth) {
      depthLimitHit = true;
      return;
    }
    if (directoriesScanned >= options.maxDirectories) {
      directoryLimitHit = true;
      return;
    }
    directoriesScanned += 1;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (found.length >= options.collectLimit) {
        collectLimitHit = true;
        return;
      }
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        if (collectLimitHit || directoryLimitHit || fileScanLimitHit) return;
        continue;
      }
      filesScanned += 1;
      if (filesScanned > options.maxFilesScanned) {
        fileScanLimitHit = true;
        return;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        found.push(full);
        if (found.length >= options.collectLimit) {
          collectLimitHit = true;
          return;
        }
      }
    }
  }
  await walk(root, 0);
  return {
    files: found,
    directories_scanned: directoriesScanned,
    files_scanned: filesScanned,
    depth_limit_hit: depthLimitHit,
    directory_limit_hit: directoryLimitHit,
    file_scan_limit_hit: fileScanLimitHit,
    collect_limit_hit: collectLimitHit,
    partial_results: depthLimitHit || directoryLimitHit || fileScanLimitHit || collectLimitHit,
  };
}

export async function registerObsidianSyncRoutes(app: FastifyInstance, pool: pg.Pool) {
  const memoryStore = createMemoryAdapter(pool);
  const memoriesSchema = await getMemoriesSchemaInfo(pool);

  app.get('/integrations/obsidian/sync/status', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const vaultPath = await resolveVaultPath(pool, orgId);
    const validatedVault = await resolveValidatedVaultPath(orgId, vaultPath).catch(() => null);
    const configured = Boolean(vaultPath) && Boolean(validatedVault?.ok);
    reply.send({
      success: true,
      data: {
        configured,
        vault_path: configured && validatedVault?.ok ? validatedVault.vaultPath : null,
        vault_path_valid: configured,
        default_folder: DEFAULT_SYNC_FOLDER,
      },
    });
  });

  app.post('/integrations/obsidian/sync/export', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    const body = (request.body || {}) as {
      folder?: string;
      visibility?: 'user_private' | 'chat_shared' | 'global';
      user_id?: string;
      chat_id?: string;
      limit?: unknown;
    };
    const exportLimitRaw = body.limit;
    const parsedExportLimit = exportLimitRaw === undefined ? 200 : Number(exportLimitRaw);
    if (!Number.isFinite(parsedExportLimit) || !Number.isInteger(parsedExportLimit) || parsedExportLimit < 1) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 1000' },
      });
      return;
    }
    const vaultPath = await resolveVaultPath(pool, orgId);
    const validatedVault = await resolveValidatedVaultPath(orgId, vaultPath).catch(() => null);
    if (!validatedVault?.ok) {
      const message = validatedVault?.message || 'obsidian.vault_path is not configured';
      const code = message.includes('not configured') ? 'MISSING_CONFIG' : 'VALIDATION';
      reply.status(400).send({ success: false, error: { code, message } });
      return;
    }
    const folder = normalizeSyncFolder(body.folder);
    const targetDir = path.join(validatedVault.vaultPath, folder);
    await fs.mkdir(targetDir, { recursive: true });

    const filters: string[] = ['archived_at IS NULL'];
    const params: unknown[] = [];
    if (memoriesSchema.hasOrganizationId) {
      params.push(orgId);
      filters.push(`organization_id = $${params.length}`);
    } else if (!body.user_id && !body.chat_id) {
      params.push(orgId);
      const orgParam = params.length;
      filters.push(
        `(visibility = 'global'
          OR chat_id IN (
            SELECT id
              FROM chats
             WHERE organization_id = $${orgParam}
          )
          OR user_id IN (
            SELECT user_id
              FROM organization_memberships
             WHERE organization_id = $${orgParam}
               AND status = 'active'
          ))`,
      );
    }
    if (body.visibility) {
      params.push(body.visibility);
      filters.push(`visibility = $${params.length}`);
    }
    if (body.user_id) {
      params.push(String(body.user_id));
      filters.push(`user_id = $${params.length}`);
    }
    if (body.chat_id) {
      params.push(String(body.chat_id));
      filters.push(`chat_id = $${params.length}`);
    }
    const limit = Math.min(1000, parsedExportLimit);
    params.push(limit);
    const rows = await pool.query<MemoryExportRow>(
      `SELECT id, user_id, chat_id, visibility, key, value, source, importance, updated_at::text
         FROM memories
        WHERE ${filters.join(' AND ')}
        ORDER BY updated_at DESC
        LIMIT $${params.length}`,
      params,
    );

    let exported = 0;
    for (const row of rows.rows) {
      const filePath = path.join(targetDir, `${row.id}.md`);
      await fs.writeFile(filePath, memoryToMarkdown(row), 'utf8');
      exported += 1;
    }

    reply.send({
      success: true,
      data: {
        exported,
        folder,
        target_dir: targetDir,
      },
    });
  });

  app.post('/integrations/obsidian/sync/import', async (request, reply) => {
    const orgId = String((request as any).orgId || '').trim();
    const actorUserId = String((request as any).userId || '').trim();
    if (!orgId) {
      reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      return;
    }
    if (!actorUserId) {
      reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
      return;
    }
    const body = (request.body || {}) as { folder?: string; limit?: unknown };
    const importLimitRaw = body.limit;
    const parsedImportLimit = importLimitRaw === undefined ? 200 : Number(importLimitRaw);
    if (!Number.isFinite(parsedImportLimit) || !Number.isInteger(parsedImportLimit) || parsedImportLimit < 1) {
      reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be an integer between 1 and 1000' },
      });
      return;
    }
    const vaultPath = await resolveVaultPath(pool, orgId);
    const validatedVault = await resolveValidatedVaultPath(orgId, vaultPath).catch(() => null);
    if (!validatedVault?.ok) {
      const message = validatedVault?.message || 'obsidian.vault_path is not configured';
      const code = message.includes('not configured') ? 'MISSING_CONFIG' : 'VALIDATION';
      reply.status(400).send({ success: false, error: { code, message } });
      return;
    }
    const folder = normalizeSyncFolder(body.folder);
    const sourceDir = path.join(validatedVault.vaultPath, folder);
    const stat = await fs.stat(sourceDir).catch(() => null);
    if (!stat?.isDirectory()) {
      reply.status(400).send({ success: false, error: { code: 'NOT_FOUND', message: `Sync folder not found: ${sourceDir}` } });
      return;
    }
    const limit = Math.min(1000, parsedImportLimit);
    const traversal = await collectMarkdownFilesBounded(sourceDir, {
      collectLimit: limit,
      maxDepth: OBSIDIAN_IMPORT_MAX_SCAN_DEPTH,
      maxDirectories: OBSIDIAN_IMPORT_MAX_SCAN_DIRECTORIES,
      maxFilesScanned: OBSIDIAN_IMPORT_MAX_SCAN_FILES,
    });
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const filePath of traversal.files) {
      try {
        const markdown = await fs.readFile(filePath, 'utf8');
        const fallbackKey = path.basename(filePath, '.md');
        const parsed = markdownToMemory(markdown, fallbackKey);
        if (!parsed.key || !parsed.value) {
          skipped += 1;
          continue;
        }
        const visibility = parsed.visibility || 'global';
        if (parsed.user_id && String(parsed.user_id).trim() !== actorUserId) {
          skipped += 1;
          continue;
        }
        let scopedUserId: string | null = null;
        let scopedChatId: string | null = null;

        if (visibility === 'user_private') {
          scopedUserId = actorUserId;
        }
        if (visibility === 'chat_shared') {
          const candidateChatId = String(parsed.chat_id || '').trim();
          if (!candidateChatId) {
            skipped += 1;
            continue;
          }
          const chatExists = await pool.query(
            `SELECT 1
             FROM chats
             WHERE id = $1
               AND organization_id = $2
             LIMIT 1`,
            [candidateChatId, orgId],
          );
          if (chatExists.rows.length === 0) {
            skipped += 1;
            continue;
          }
          scopedChatId = candidateChatId;
          scopedUserId = actorUserId;
        }
        const importedMemoryId = String(parsed.sven_memory_id || '').trim();
        if (importedMemoryId) {
          const existingById = memoriesSchema.hasOrganizationId
            ? await pool.query(
              `SELECT id
                 FROM memories
                WHERE id = $1
                  AND organization_id = $2
                  AND archived_at IS NULL
                LIMIT 1`,
              [importedMemoryId, orgId],
            )
            : await pool.query(
              `SELECT id
                 FROM memories
                WHERE id = $1
                  AND archived_at IS NULL
                LIMIT 1`,
              [importedMemoryId],
            );
          if (existingById.rows.length > 0) {
            if (memoriesSchema.hasOrganizationId) {
              await pool.query(
                `UPDATE memories
                    SET visibility = $1,
                        key = $2,
                        value = $3,
                        source = $4,
                        importance = $5,
                        user_id = $6,
                        chat_id = $7,
                        updated_at = NOW()
                  WHERE id = $8
                    AND organization_id = $9`,
                [
                  visibility,
                  parsed.key,
                  parsed.value,
                  'obsidian_sync_import',
                  normalizeImportedImportance(parsed.importance),
                  scopedUserId,
                  scopedChatId,
                  importedMemoryId,
                  orgId,
                ],
              );
            } else {
              await pool.query(
                `UPDATE memories
                    SET visibility = $1,
                        key = $2,
                        value = $3,
                        source = $4,
                        importance = $5,
                        user_id = $6,
                        chat_id = $7,
                        updated_at = NOW()
                  WHERE id = $8`,
                [
                  visibility,
                  parsed.key,
                  parsed.value,
                  'obsidian_sync_import',
                  normalizeImportedImportance(parsed.importance),
                  scopedUserId,
                  scopedChatId,
                  importedMemoryId,
                ],
              );
            }
            imported += 1;
            continue;
          }
        }
        const existing = memoriesSchema.hasOrganizationId
          ? await pool.query(
            `SELECT id FROM memories
              WHERE organization_id = $1
                AND visibility = $2
                AND key = $3
                AND value = $4
                AND COALESCE(user_id, '') = $5
                AND COALESCE(chat_id, '') = $6
              LIMIT 1`,
            [
              orgId,
              visibility,
              parsed.key,
              parsed.value,
              String(scopedUserId || ''),
              String(scopedChatId || ''),
            ],
          )
          : await pool.query(
            `SELECT id FROM memories
              WHERE visibility = $1
                AND key = $2
                AND value = $3
                AND COALESCE(user_id, '') = $4
                AND COALESCE(chat_id, '') = $5
              LIMIT 1`,
            [
              visibility,
              parsed.key,
              parsed.value,
              String(scopedUserId || ''),
              String(scopedChatId || ''),
            ],
          );
        if (existing.rows.length > 0) {
          skipped += 1;
          continue;
        }
        if (memoriesSchema.hasOrganizationId) {
          await memoryStore.create({
            organization_id: orgId,
            user_id: scopedUserId,
            chat_id: scopedChatId,
            visibility,
            key: parsed.key,
            value: parsed.value,
            source: 'obsidian_sync_import',
            importance: normalizeImportedImportance(parsed.importance),
          });
        } else {
          await pool.query(
            `INSERT INTO memories (
               id, user_id, chat_id, visibility, key, value, source, importance, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              importedMemoryId || uuidv7(),
              scopedUserId,
              scopedChatId,
              visibility,
              parsed.key,
              parsed.value,
              'obsidian_sync_import',
              normalizeImportedImportance(parsed.importance),
            ],
          );
        }
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    reply.send({
      success: true,
      data: {
        imported,
        skipped,
        failed,
        scanned_files: traversal.files.length,
        traversal,
        folder,
        source_dir: sourceDir,
      },
    });
  });
}
