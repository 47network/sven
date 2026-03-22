import fs from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import yaml from 'js-yaml';
import { connect, JSONCodec } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { createLogger, NATS_SUBJECTS, sha256 } from '@sven/shared';
import type { EventEnvelope, RagIndexRequestEvent } from '@sven/shared';

const logger = createLogger('rag-notes-ingestor');
const jc = JSONCodec();

const DEFAULT_INCLUDE = ['**/*.md', '**/*.mdx'];
const DEFAULT_EXCLUDE = ['**/.obsidian/**', '**/.trash/**', '**/.git/**', '**/node_modules/**'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_MEMORY_TAGS = ['memory', 'memories'];
const DEFAULT_IDEA_TAGS = ['idea', 'ideas'];

function parseGlobs(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function normalizeVisibility(raw: string | undefined): 'global' | 'chat' | 'user' {
  if (raw === 'chat' || raw === 'user') return raw;
  return 'global';
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length ? entries : undefined;
  }
  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(Boolean);
    return entries.length ? entries : undefined;
  }
  return undefined;
}

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw) return fallback;
  return raw.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function parsePositiveIntervalMs(raw: string | undefined, fallback: number): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid NOTES_INGEST_INTERVAL_MS: expected a positive integer milliseconds value, got "${raw}"`,
    );
  }

  return parsed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function selectNoteKind(
  frontmatter: Record<string, unknown> | undefined,
  tags: string[] | undefined,
  memoryTags: string[],
  ideaTags: string[],
): 'memory' | 'idea' | undefined {
  const fmKind = frontmatter?.sven_kind ?? frontmatter?.kind;
  if (typeof fmKind === 'string') {
    const normalized = fmKind.trim().toLowerCase();
    if (normalized === 'memory' || normalized === 'idea') {
      return normalized;
    }
  }

  if (frontmatter?.sven_memory === true || frontmatter?.memory === true) {
    return 'memory';
  }
  if (frontmatter?.sven_idea === true || frontmatter?.idea === true) {
    return 'idea';
  }

  if (tags?.length) {
    const normalized = tags.map((tag) => tag.toLowerCase());
    if (normalized.some((tag) => memoryTags.includes(tag))) {
      return 'memory';
    }
    if (normalized.some((tag) => ideaTags.includes(tag))) {
      return 'idea';
    }
  }

  return undefined;
}

function extractFrontmatter(raw: string) {
  const lines = raw.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') {
    return { content: raw, frontmatter: undefined, frontmatterRaw: undefined };
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { content: raw, frontmatter: undefined, frontmatterRaw: undefined };
  }

  const frontmatterRaw = lines.slice(1, endIndex).join('\n');
  let frontmatter: Record<string, unknown> | undefined;
  try {
    const parsed = yaml.load(frontmatterRaw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = parsed as Record<string, unknown>;
    }
  } catch (err) {
    logger.warn('Failed to parse frontmatter', { err: String(err) });
  }

  const content = lines.slice(endIndex + 1).join('\n').trimStart();
  return { content, frontmatter, frontmatterRaw };
}

function extractTitle(content: string, frontmatter: Record<string, unknown> | undefined, fallback: string) {
  const fmTitle = frontmatter?.title;
  if (typeof fmTitle === 'string' && fmTitle.trim()) {
    return fmTitle.trim();
  }

  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }

  return fallback;
}

async function scanOnce(): Promise<void> {
  const root = process.env.NOTES_INGEST_ROOT || '/notes';
  const includeGlobs = parseGlobs(process.env.NOTES_INGEST_INCLUDE, DEFAULT_INCLUDE);
  const excludeGlobs = parseGlobs(process.env.NOTES_INGEST_EXCLUDE, DEFAULT_EXCLUDE);
  const maxFileSize = Number(process.env.NOTES_INGEST_MAX_FILE_SIZE || DEFAULT_MAX_FILE_SIZE);
  const visibility = normalizeVisibility(process.env.NOTES_INGEST_VISIBILITY);
  const allowUsers = parseGlobs(process.env.NOTES_INGEST_ALLOW_USERS, []);
  const allowChats = parseGlobs(process.env.NOTES_INGEST_ALLOW_CHATS, []);
  const memoryTags = parseList(process.env.NOTES_INGEST_MEMORY_TAGS, DEFAULT_MEMORY_TAGS);
  const ideaTags = parseList(process.env.NOTES_INGEST_IDEA_TAGS, DEFAULT_IDEA_TAGS);

  const nc = await connect({
    servers: process.env.NATS_URL || 'nats://localhost:4222',
    name: 'rag-notes-ingestor',
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
        continue;
      }

      const raw = await fs.readFile(filePath, 'utf8');
      const { content, frontmatter, frontmatterRaw } = extractFrontmatter(raw);
      if (!content.trim()) {
        continue;
      }

      const relativePath = path.relative(root, filePath);
      const title = extractTitle(content, frontmatter, path.basename(filePath));
      const aliases = normalizeStringList(frontmatter?.aliases ?? frontmatter?.alias);
      const tags = normalizeStringList(frontmatter?.tags ?? frontmatter?.tag);
      const noteKind = selectNoteKind(frontmatter, tags, memoryTags, ideaTags);
      const source = `notes:${relativePath}`;

      const envelope: EventEnvelope<RagIndexRequestEvent> = {
        schema_version: '1.0',
        event_id: uuidv4(),
        occurred_at: new Date().toISOString(),
        data: {
          source,
          source_type: 'notes',
          title,
          content,
          visibility,
          allow_users: allowUsers.length ? allowUsers : undefined,
          allow_chats: allowChats.length ? allowChats : undefined,
          metadata: {
            path: filePath,
            relative_path: relativePath,
            vault_root: root,
            size_bytes: stat.size,
            modified_at: stat.mtime.toISOString(),
            content_hash: sha256(content),
            frontmatter,
            frontmatter_raw: frontmatterRaw,
            aliases,
            tags,
            note_kind: noteKind,
          },
        },
      };

      nc.publish(NATS_SUBJECTS.RAG_INDEX_REQUEST, jc.encode(envelope));
    } catch (err) {
      logger.error('Failed to ingest note', { file_path: filePath, err: String(err) });
    }
  }

  await nc.drain();
}

async function main(): Promise<void> {
  const intervalMs = parsePositiveIntervalMs(process.env.NOTES_INGEST_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  logger.info('notes ingestion worker starting', {
    interval_ms: intervalMs,
    scheduler_mode: 'periodic_serialized',
  });

  const tick = async () => {
    try {
      await scanOnce();
    } catch (err) {
      logger.error('Notes ingestion scan failed', { err: String(err) });
    }
  };

  for (;;) {
    await tick();
    await sleep(intervalMs);
  }
}

main().catch((err) => {
  logger.fatal('notes ingestion worker failed', { err: String(err) });
  process.exit(1);
});
