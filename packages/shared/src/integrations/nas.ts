/**
 * NAS (Network Attached Storage) File Operations
 *
 * Handles file search, read, and write operations with path boundary enforcement
 * and approval gating for write operations.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createReadStream, constants as fsConstants } from 'node:fs';

export interface FileSearchResult {
  path: string;
  name: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
}

export interface FilePreview {
  path: string;
  name: string;
  size: number;
  modifiedAt: string;
  mimeType?: string;
  preview?: string; // First 8KB for text, base64 for binary
  isBinary: boolean;
  isLarge: boolean;
}

export interface FileWriteResult {
  path: string;
  size: number;
  hash?: string;
  message?: string;
}

export interface DirectoryListPage {
  entries: FileSearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

const PREVIEW_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB hard guard
const PREVIEW_READ_TIMEOUT_MS = 5_000;
const DEFAULT_NAS_HOST_ROOT = process.env.SVEN_NAS_ROOT || path.join(os.tmpdir(), 'sven', 'nas');

function encodeDirectoryCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeDirectoryCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    const offset = Number(parsed?.offset);
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('Invalid cursor');
    }
    return offset;
  } catch {
    throw new Error('Invalid cursor');
  }
}

/**
 * Validates that a path is within allowed NAS boundaries
 * Allowed: /nas/shared (read), /nas/users/<userId>/... (read+write)
 */
export function validateNasPath(filePath: string, userId: string, write: boolean = false): { valid: boolean; error?: string } {
  try {
    const isExactOrChild = (candidatePath: string, rootPath: string): boolean =>
      candidatePath === rootPath || candidatePath.startsWith(`${rootPath}/`);

    // Treat NAS paths as virtual POSIX paths regardless of the host OS.
    const normalized = path.posix.normalize(String(filePath || '').replace(/\\/g, '/'));
    const resolved = normalized.startsWith('/') ? normalized : `/${normalized}`;

    if (!isExactOrChild(resolved, '/nas')) {
      return { valid: false, error: 'Path must be under /nas' };
    }

    // Allow /nas/shared for read
    if (isExactOrChild(resolved, '/nas/shared')) {
      if (write) {
        return { valid: false, error: 'Cannot write to /nas/shared' };
      }
      return { valid: true };
    }

    // Allow /nas/users/<userId> for read+write
    const userPath = `/nas/users/${userId}`;
    if (isExactOrChild(resolved, userPath)) {
      return { valid: true };
    }

    return { valid: false, error: `Path must be under /nas/shared or /nas/users/${userId}` };
  } catch (err) {
    return { valid: false, error: 'Invalid path' };
  }
}

function getNasHostRoot(): string {
  return path.resolve(DEFAULT_NAS_HOST_ROOT);
}

function pathWithinHostRoot(candidatePath: string, hostRoot: string): boolean {
  const relative = path.relative(hostRoot, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeNasVirtualPath(filePath: string): string {
  const normalized = path.posix.normalize(String(filePath || '').replace(/\\/g, '/'));
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function toHostNasPath(filePath: string): string {
  const virtualPath = normalizeNasVirtualPath(filePath);
  const hostRoot = getNasHostRoot();
  const relative = virtualPath.replace(/^\/nas[\/]?/, '');
  return path.resolve(hostRoot, relative || '.');
}

function toVirtualNasPath(hostPath: string): string {
  const hostRoot = getNasHostRoot();
  const resolved = path.resolve(hostPath);
  if (!pathWithinHostRoot(resolved, hostRoot)) {
    throw new Error('Resolved host path escaped NAS root');
  }
  const relative = path.relative(hostRoot, resolved).replace(/\\/g, '/');
  return relative ? `/nas/${relative}` : '/nas';
}

async function resolveCanonicalNasPath(
  filePath: string,
  userId: string,
  write: boolean,
  options?: { allowMissingLeaf?: boolean },
): Promise<string> {
  const virtualPath = normalizeNasVirtualPath(filePath);
  const validation = validateNasPath(virtualPath, userId, write);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid path');
  }

  const hostRoot = getNasHostRoot();
  const normalized = toHostNasPath(virtualPath);
  if (!pathWithinHostRoot(normalized, hostRoot)) {
    throw new Error('Invalid path');
  }
  const allowMissingLeaf = options?.allowMissingLeaf === true;

  if (!allowMissingLeaf) {
    const canonical = await fs.realpath(normalized);
    if (!pathWithinHostRoot(canonical, hostRoot)) {
      throw new Error('Invalid path');
    }
    return canonical;
  }

  try {
    const canonical = await fs.realpath(normalized);
    if (!pathWithinHostRoot(canonical, hostRoot)) {
      throw new Error('Invalid path');
    }
    return canonical;
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw err;
    }
  }

  const missingSegments: string[] = [];
  let cursor = normalized;
  let canonicalBase: string | null = null;
  while (!canonicalBase) {
    missingSegments.unshift(path.basename(cursor));
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      throw new Error('Invalid path');
    }
    try {
      canonicalBase = await fs.realpath(parent);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        throw err;
      }
      cursor = parent;
      continue;
    }
  }

  if (!pathWithinHostRoot(canonicalBase, hostRoot)) {
    throw new Error('Invalid path');
  }

  return path.resolve(canonicalBase, ...missingSegments);
}

/**
 * Search for files matching a pattern
 */
export async function searchFiles(
  searchPath: string,
  pattern: string,
  userId: string,
  maxResults: number = 100,
): Promise<FileSearchResult[]> {
  const canonicalSearchPath = await resolveCanonicalNasPath(searchPath, userId, false);

  const results: FileSearchResult[] = [];
  const normalizedNeedle = String(pattern || '').trim().toLowerCase();
  if (normalizedNeedle.length > 256) {
    throw new Error('Search pattern is too long');
  }

  async function scanDirectory(dir: string, depth: number = 0): Promise<void> {
    if (depth > 10) return; // Prevent deep recursion
    if (results.length >= maxResults) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dir, entry.name);
        const canonicalEntryPath = await resolveCanonicalNasPath(fullPath, userId, false).catch(
          () => null,
        );
        if (!canonicalEntryPath) {
          continue;
        }

        const nameForSearch = entry.name.toLowerCase();
        if (normalizedNeedle === '' || nameForSearch.includes(normalizedNeedle)) {
          const stat = await fs.stat(canonicalEntryPath);
          results.push({
            path: toVirtualNasPath(canonicalEntryPath),
            name: entry.name,
            size: stat.size,
            isDirectory: entry.isDirectory(),
            modifiedAt: stat.mtime.toISOString(),
          });
        }

        if (entry.isDirectory() && depth < 3) {
          await scanDirectory(canonicalEntryPath, depth + 1);
        }
      }
    } catch (err) {
      throw new Error(
        `Failed to scan directory ${dir}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  await scanDirectory(canonicalSearchPath);
  return results;
}

/**
 * Read file preview (first 8KB for text, base64 for binary)
 */
export async function readFilePreview(filePath: string, userId: string, maxBytes: number = 8192): Promise<FilePreview> {
  const canonicalPath = await resolveCanonicalNasPath(filePath, userId, false);

  const stat = await fs.stat(canonicalPath);

  if (stat.isDirectory()) {
    throw new Error('Cannot preview a directory');
  }
  if (stat.size > PREVIEW_MAX_FILE_SIZE_BYTES) {
    throw new Error(`File too large for preview (${stat.size} bytes, max ${PREVIEW_MAX_FILE_SIZE_BYTES})`);
  }

  const name = path.basename(filePath);
  const isBinary = !isTextFile(name);
  const isLarge = stat.size > maxBytes;
  const bytesToRead = Math.max(0, Math.min(maxBytes, stat.size));
  const previewBuffer = Buffer.allocUnsafe(bytesToRead);
  const fileHandle = await fs.open(canonicalPath, 'r');
  try {
    const readPromise = fileHandle.read(previewBuffer, 0, bytesToRead, 0);
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Preview read timed out after ${PREVIEW_READ_TIMEOUT_MS}ms`));
      }, PREVIEW_READ_TIMEOUT_MS);
      timer.unref?.();
    });
    const readResult = await Promise.race([readPromise, timeoutPromise]);
    const slice = previewBuffer.subarray(0, readResult.bytesRead);
    const preview = isBinary ? slice.toString('base64') : slice.toString('utf8');

    return {
      path: toVirtualNasPath(canonicalPath),
      name,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      mimeType: guessMimeType(name),
      preview,
      isBinary,
      isLarge,
    };
  } finally {
    await fileHandle.close();
  }
}

/**
 * Read entire file (with size limit)
 */
export async function readFile(filePath: string, userId: string, maxBytes: number = 10 * 1024 * 1024): Promise<Buffer> {
  const canonicalPath = await resolveCanonicalNasPath(filePath, userId, false);

  const stat = await fs.stat(canonicalPath);

  if (stat.isDirectory()) {
    throw new Error('Cannot read a directory');
  }

  if (stat.size > maxBytes) {
    throw new Error(`File is too large (${stat.size} bytes, max ${maxBytes})`);
  }

  return fs.readFile(canonicalPath);
}

/**
 * List directory contents
 */
export async function listDirectory(dirPath: string, userId: string): Promise<FileSearchResult[]> {
  const canonicalDirPath = await resolveCanonicalNasPath(dirPath, userId, false);

  const stat = await fs.stat(canonicalDirPath);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  const entries = await fs.readdir(canonicalDirPath, { withFileTypes: true });
  const results: FileSearchResult[] = [];

  for (const entry of entries) {
    const fullPath = path.join(canonicalDirPath, entry.name);
    const canonicalEntryPath = await resolveCanonicalNasPath(fullPath, userId, false).catch(() => null);
    if (!canonicalEntryPath) {
      continue;
    }

    try {
      const stat = await fs.stat(canonicalEntryPath);
      results.push({
        path: toVirtualNasPath(canonicalEntryPath),
        name: entry.name,
        size: stat.size,
        isDirectory: entry.isDirectory(),
        modifiedAt: stat.mtime.toISOString(),
      });
    } catch {
      // Skip unreadable/transient entries instead of failing the full list operation.
      continue;
    }
  }

  return results;
}

/**
 * List directory contents with deterministic pagination.
 */
export async function listDirectoryPage(
  dirPath: string,
  userId: string,
  limit: number = 100,
  cursor?: string,
): Promise<DirectoryListPage> {
  const canonicalDirPath = await resolveCanonicalNasPath(dirPath, userId, false);

  const stat = await fs.stat(canonicalDirPath);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  const offset = decodeDirectoryCursor(cursor);
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const dirEntries = await fs.readdir(canonicalDirPath, { withFileTypes: true });
  const sortedEntries = dirEntries
    .filter((entry) => {
      try {
        return validateNasPath(toVirtualNasPath(path.join(canonicalDirPath, entry.name)), userId, false).valid;
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  const entries: FileSearchResult[] = [];
  let hasMore = false;
  let nextCursor: string | null = null;

  for (let i = offset; i < sortedEntries.length; i += 1) {
    const entry = sortedEntries[i];
    const fullPath = path.join(canonicalDirPath, entry.name);
    const canonicalEntryPath = await resolveCanonicalNasPath(fullPath, userId, false).catch(() => null);
    if (!canonicalEntryPath) {
      continue;
    }
    try {
      const fileStat = await fs.stat(canonicalEntryPath);
      entries.push({
        path: toVirtualNasPath(canonicalEntryPath),
        name: entry.name,
        size: fileStat.size,
        isDirectory: entry.isDirectory(),
        modifiedAt: fileStat.mtime.toISOString(),
      });
      if (entries.length >= boundedLimit) {
        hasMore = i + 1 < sortedEntries.length;
        nextCursor = hasMore ? encodeDirectoryCursor(i + 1) : null;
        break;
      }
    } catch {
      // Skip unreadable/transient entries instead of failing the full list operation.
      continue;
    }
  }

  return {
    entries,
    nextCursor,
    hasMore,
  };
}

/**
 * Write file (requires approval for user paths)
 */
export async function writeFile(
  filePath: string,
  content: Buffer | string,
  userId: string,
  options?: { append?: boolean; createDirs?: boolean },
): Promise<FileWriteResult> {
  const canonicalTargetPath = await resolveCanonicalNasPath(filePath, userId, true, {
    allowMissingLeaf: true,
  });
  const dir = path.dirname(canonicalTargetPath);

  if (options?.createDirs) {
    await fs.mkdir(dir, { recursive: true });
  } else {
    const dirStat = await fs.stat(dir).catch(() => null);
    if (!dirStat?.isDirectory()) {
      throw new Error('Parent directory does not exist');
    }
  }

  const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;

  if (options?.append) {
    await fs.appendFile(canonicalTargetPath, buffer);
  } else {
    await fs.writeFile(canonicalTargetPath, buffer);
  }

  const stat = await fs.stat(canonicalTargetPath);

  return {
    path: toVirtualNasPath(canonicalTargetPath),
    size: stat.size,
    message: `File ${options?.append ? 'appended' : 'written'} successfully`,
  };
}

/**
 * Delete file or directory (recursively for dirs)
 */
export async function deleteFile(filePath: string, userId: string, recursive: boolean = false): Promise<{ message: string }> {
  const canonicalTargetPath = await resolveCanonicalNasPath(filePath, userId, true);

  const stat = await fs.stat(canonicalTargetPath);

  if (stat.isDirectory()) {
    if (!recursive) {
      try {
        await fs.rm(canonicalTargetPath, { recursive: false, force: false });
      } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOTEMPTY') {
          throw new Error('Cannot delete non-empty directory without recursive=true');
        }
        throw err;
      }
    } else {
      await fs.rm(canonicalTargetPath, { recursive: true, force: true });
    }
  } else {
    await fs.unlink(canonicalTargetPath);
  }

  return { message: `File deleted: ${toVirtualNasPath(canonicalTargetPath)}` };
}

/**
 * Get file statistics
 */
export async function getFileStats(
  filePath: string,
  userId: string,
): Promise<{
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt: string;
  createdAt: string;
  isReadable: boolean;
  isWritable: boolean;
}> {
  const canonicalPath = await resolveCanonicalNasPath(filePath, userId, false);

  const stat = await fs.stat(canonicalPath);
  const writeValidation = validateNasPath(filePath, userId, true);

  let isReadable = false;
  let hasWriteAccess = false;
  try {
    await fs.access(canonicalPath, fsConstants.R_OK);
    isReadable = true;
  } catch {
    isReadable = false;
  }
  try {
    await fs.access(canonicalPath, fsConstants.W_OK);
    hasWriteAccess = true;
  } catch {
    hasWriteAccess = false;
  }
  const isWritable = writeValidation.valid && hasWriteAccess;

  return {
    path: filePath,
    size: stat.size,
    isDirectory: stat.isDirectory(),
    modifiedAt: stat.mtime.toISOString(),
    createdAt: stat.birthtime.toISOString(),
    isReadable,
    isWritable,
  };
}

/**
 * Helpers: determine if file is text
 */
function isTextFile(filename: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv',
    '.js', '.ts', '.py', '.go', '.rs', '.java', '.c', '.cpp',
    '.sh', '.bash', '.log', '.conf', '.config', '.env',
  ];

  const ext = path.extname(filename).toLowerCase();
  return textExtensions.includes(ext) || !ext; // Assume no extension is text
}

/**
 * Guess MIME type from filename
 */
function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();

  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml',
    '.xml': 'application/xml',
    '.csv': 'text/csv',
    '.html': 'text/html',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.zip': 'application/zip',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}
