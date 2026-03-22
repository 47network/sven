import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { connect, JSONCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, NATS_SUBJECTS, sha256 } from '@sven/shared';
import type { EventEnvelope, RagIndexRequestEvent } from '@sven/shared';

const logger = createLogger('rag-nas-ingestor');
const jc = JSONCodec();

const DEFAULT_INCLUDE = ['**/*.md', '**/*.txt', '**/*.pdf', '**/*.docx'];
const DEFAULT_EXCLUDE = ['**/.git/**', '**/node_modules/**', '**/.DS_Store'];
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

function parseGlobs(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeVisibility(raw: string | undefined): 'global' | 'chat' | 'user' {
  if (raw === 'chat' || raw === 'user') return raw;
  return 'global';
}

function parsePositiveIntervalMs(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid NAS_INGEST_INTERVAL_MS: expected a positive integer milliseconds value, got "${raw}"`,
    );
  }

  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

async function readPdfFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  const parsed = await pdfParse(data);
  return parsed.text || '';
}

async function readDocxFile(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || '';
}

async function extractContent(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return readPdfFile(filePath);
  if (ext === '.docx') return readDocxFile(filePath);
  return readTextFile(filePath);
}

async function scanOnce(): Promise<void> {
  const root = process.env.NAS_INGEST_ROOT || '/nas/shared';
  const includeGlobs = parseGlobs(process.env.NAS_INGEST_INCLUDE, DEFAULT_INCLUDE);
  const excludeGlobs = parseGlobs(process.env.NAS_INGEST_EXCLUDE, DEFAULT_EXCLUDE);
  const maxFileSize = Number(process.env.NAS_INGEST_MAX_FILE_SIZE || DEFAULT_MAX_FILE_SIZE);
  const visibility = normalizeVisibility(process.env.NAS_INGEST_VISIBILITY);
  const allowUsers = parseGlobs(process.env.NAS_INGEST_ALLOW_USERS, []).filter(Boolean);
  const allowChats = parseGlobs(process.env.NAS_INGEST_ALLOW_CHATS, []).filter(Boolean);

  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'rag-nas-ingestor',
    maxReconnectAttempts: -1,
  });

  const matches = await fg(includeGlobs, {
    cwd: root,
    ignore: excludeGlobs,
    onlyFiles: true,
    dot: false,
    absolute: true,
  });

  for (const filePath of matches) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > maxFileSize) {
        logger.warn('Skipping file over size limit', { file_path: filePath, size: stat.size });
        continue;
      }

      const content = await extractContent(filePath);
      if (!content.trim()) {
        continue;
      }

      const relativePath = path.relative(root, filePath);
      const source = `nas:${relativePath}`;
      const envelope: EventEnvelope<RagIndexRequestEvent> = {
        schema_version: '1.0',
        event_id: uuidv4(),
        occurred_at: new Date().toISOString(),
        data: {
          source,
          source_type: 'nas',
          title: path.basename(filePath),
          content,
          visibility,
          allow_users: allowUsers.length ? allowUsers : undefined,
          allow_chats: allowChats.length ? allowChats : undefined,
          metadata: {
            path: filePath,
            size_bytes: stat.size,
            modified_at: stat.mtime.toISOString(),
            content_hash: sha256(content),
          },
        },
      };

      nc.publish(NATS_SUBJECTS.RAG_INDEX_REQUEST, jc.encode(envelope));
    } catch (err) {
      logger.error('Failed to ingest NAS file', { file_path: filePath, err: String(err) });
    }
  }

  await nc.drain();
}

async function main(): Promise<void> {
  const intervalMs = parsePositiveIntervalMs(process.env.NAS_INGEST_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  logger.info('NAS ingestion worker starting', {
    interval_ms: intervalMs,
    scheduler_mode: 'periodic_serialized',
  });

  const tick = async () => {
    try {
      await scanOnce();
    } catch (err) {
      logger.error('NAS ingestion scan failed', { err: String(err) });
    }
  };

  for (;;) {
    await tick();
    await sleep(intervalMs);
  }
}

main().catch((err) => {
  logger.fatal('NAS ingestion worker failed', { err: String(err) });
  process.exit(1);
});
