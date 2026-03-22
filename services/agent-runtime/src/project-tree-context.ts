import { readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

type TreeEntry = {
  name: string;
  isDir: boolean;
};

function toPosix(pathValue: string): string {
  return String(pathValue || '').replace(/\\/g, '/');
}

function normalizePattern(raw: string): string {
  const trimmed = toPosix(String(raw || '').trim());
  if (!trimmed) return '';
  return trimmed.replace(/^\.\/+/, '');
}

function parseExcludePatterns(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => normalizePattern(String(v))).filter(Boolean);
  }
  const value = String(raw || '').trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => normalizePattern(String(v))).filter(Boolean);
    }
  } catch {
    // fallback to csv/newline format
  }
  return value
    .split(/[\n,]+/)
    .map((v) => normalizePattern(v))
    .filter(Boolean);
}

function patternToRegExp(pattern: string): RegExp | null {
  const p = normalizePattern(pattern);
  if (!p) return null;
  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`(^|/)${escaped}(/|$)`, 'i');
}

function shouldExcludePath(
  relPath: string,
  isDir: boolean,
  patternRegexes: RegExp[],
): boolean {
  const rel = toPosix(relPath);
  if (!rel) return false;
  const segments = rel.split('/').filter(Boolean);
  if (segments.includes('.git')) return true;
  if (segments.includes('node_modules')) return true;
  if (segments.includes('.next')) return true;
  if (segments.includes('dist')) return true;

  const candidate = isDir ? `${rel}/` : rel;
  return patternRegexes.some((re) => re.test(candidate));
}

async function loadGitignorePatterns(workspacePath: string): Promise<string[]> {
  const gitignorePath = join(workspacePath, '.gitignore');
  try {
    const text = await readFile(gitignorePath, 'utf8');
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => normalizePattern(line))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function listEntries(absDir: string): Promise<TreeEntry[]> {
  const entries = await readdir(absDir, { withFileTypes: true });
  return entries
    .map((entry) => ({ name: entry.name, isDir: entry.isDirectory() }))
    .sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
}

async function buildTreeLines(params: {
  workspacePath: string;
  absDir: string;
  relDir: string;
  depth: number;
  maxDepth: number;
  maxFilesPerDir: number;
  patternRegexes: RegExp[];
}): Promise<string[]> {
  if (params.depth > params.maxDepth) return [];
  const entries = await listEntries(params.absDir);
  const lines: string[] = [];

  const visibleDirs: TreeEntry[] = [];
  const visibleFiles: TreeEntry[] = [];
  for (const entry of entries) {
    const rel = toPosix(params.relDir ? `${params.relDir}/${entry.name}` : entry.name);
    if (shouldExcludePath(rel, entry.isDir, params.patternRegexes)) continue;
    if (entry.isDir) visibleDirs.push(entry);
    else visibleFiles.push(entry);
  }

  for (const dir of visibleDirs) {
    const rel = toPosix(params.relDir ? `${params.relDir}/${dir.name}` : dir.name);
    const indent = '  '.repeat(params.depth);
    lines.push(`${indent}- ${dir.name}/`);
    const childAbs = join(params.absDir, dir.name);
    const childLines = await buildTreeLines({
      ...params,
      absDir: childAbs,
      relDir: rel,
      depth: params.depth + 1,
    });
    lines.push(...childLines);
  }

  const shownFiles = visibleFiles.slice(0, Math.max(1, params.maxFilesPerDir));
  for (const file of shownFiles) {
    const indent = '  '.repeat(params.depth);
    lines.push(`${indent}- ${file.name}`);
  }
  if (visibleFiles.length > shownFiles.length) {
    const indent = '  '.repeat(params.depth);
    lines.push(`${indent}- ... (${visibleFiles.length - shownFiles.length} more files)`);
  }
  return lines;
}

export async function buildProjectTreePrompt(params: {
  workspacePath: string;
  maxDepth: number;
  maxFilesPerDir: number;
  customExcludePatterns: string[];
}): Promise<string> {
  const workspacePath = resolve(params.workspacePath);
  const gitignorePatterns = await loadGitignorePatterns(workspacePath);
  const customPatterns = parseExcludePatterns(params.customExcludePatterns);
  const patternRegexes = [...gitignorePatterns, ...customPatterns]
    .map(patternToRegExp)
    .filter((r): r is RegExp => r !== null);
  const lines = await buildTreeLines({
    workspacePath,
    absDir: workspacePath,
    relDir: '',
    depth: 0,
    maxDepth: Math.max(1, Math.floor(params.maxDepth || 3)),
    maxFilesPerDir: Math.max(1, Math.floor(params.maxFilesPerDir || 50)),
    patternRegexes,
  });
  if (lines.length === 0) return '';
  const workspaceName = workspacePath.split(sep).filter(Boolean).pop() || dirname(workspacePath);
  return [
    `Project directory tree (workspace: ${workspaceName}):`,
    ...lines.slice(0, 1200),
  ].join('\n');
}

type CacheEntry = {
  prompt: string;
  scannedAt: number;
  lastAccessedAt: number;
};

export class ProjectTreeContextCache {
  private readonly maxEntries: number;
  private readonly maxIdleMs: number;
  private cache = new Map<string, CacheEntry>();

  constructor(options?: { maxEntries?: number; maxIdleMs?: number }) {
    this.maxEntries = Math.max(1, Math.floor(options?.maxEntries || 256));
    this.maxIdleMs = Math.max(30_000, Math.floor(options?.maxIdleMs || 10 * 60 * 1000));
  }

  private pruneIdleEntries(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessedAt > this.maxIdleMs) {
        this.cache.delete(key);
      }
    }
  }

  private touchEntry(key: string, entry: CacheEntry): void {
    // Keep map insertion order aligned with recency for LRU eviction.
    this.cache.delete(key);
    this.cache.set(key, entry);
  }

  private evictToBudget(): void {
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  private async resolveAllowedRoots(allowedRoots: string[]): Promise<string[]> {
    const roots = Array.from(
      new Set(
        (allowedRoots || [])
          .map((v) => String(v || '').trim())
          .filter(Boolean)
          .map((v) => resolve(v)),
      ),
    );
    const resolved: string[] = [];
    for (const root of roots) {
      try {
        resolved.push(await realpath(root));
      } catch {
        // Ignore invalid roots; caller can decide behavior when none remain.
      }
    }
    return resolved;
  }

  private isContainedWithin(workspaceRealPath: string, rootRealPath: string): boolean {
    const ws = toPosix(resolve(workspaceRealPath));
    const root = toPosix(resolve(rootRealPath));
    if (ws === root) return true;
    const rootWithSlash = root.endsWith('/') ? root : `${root}/`;
    return ws.startsWith(rootWithSlash);
  }

  async getPrompt(params: {
    workspacePath: string;
    maxDepth: number;
    maxFilesPerDir: number;
    customExcludePatterns: string[];
    debounceMs: number;
    allowedRoots?: string[];
  }): Promise<string> {
    const now = Date.now();
    const debounceMs = Math.max(1000, Math.floor(params.debounceMs || 30000));
    const allowedRoots = await this.resolveAllowedRoots(params.allowedRoots || []);
    if (allowedRoots.length === 0) return '';
    const workspaceRealPath = await realpath(resolve(params.workspacePath));
    if (!allowedRoots.some((root) => this.isContainedWithin(workspaceRealPath, root))) {
      return '';
    }
    const key = workspaceRealPath;
    this.pruneIdleEntries(now);
    const cached = this.cache.get(key);
    if (cached && now - cached.scannedAt < debounceMs) {
      cached.lastAccessedAt = now;
      this.touchEntry(key, cached);
      return cached.prompt;
    }
    const prompt = await buildProjectTreePrompt({
      workspacePath: workspaceRealPath,
      maxDepth: params.maxDepth,
      maxFilesPerDir: params.maxFilesPerDir,
      customExcludePatterns: params.customExcludePatterns,
    });
    this.cache.set(key, { prompt, scannedAt: now, lastAccessedAt: now });
    this.evictToBudget();
    return prompt;
  }
}
