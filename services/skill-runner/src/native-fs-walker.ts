import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export type NativeFsWalkInputs = Record<string, unknown>;

const DEFAULT_MAX_RESULTS = 200;
const MAX_RESULTS_CAP = 2000;
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_REGEX_MAX_EVALS = 20000;
const DEFAULT_REGEX_MAX_EVAL_MS = 250;
const MAX_REGEX_MAX_EVALS = 200000;
const MAX_REGEX_MAX_EVAL_MS = 5000;
const MAX_REGEX_PATTERN_LENGTH = 256;

type FsWalkEntry = {
  path: string;
  name: string;
  is_directory: boolean;
  size: number;
  modified_at: string;
};

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

function hasUnsafeRegexFeatures(pattern: string): boolean {
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return true;
  if (pattern.includes('(?<=') || pattern.includes('(?<!')) return true;
  if (/\\[1-9]/.test(pattern)) return true;
  if (/\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/.test(pattern)) return true;
  return false;
}

function parseRegex(pattern: string): { matcher: RegExp | null; error?: string } {
  if (!pattern.trim()) return { matcher: null };
  if (hasUnsafeRegexFeatures(pattern)) {
    return {
      matcher: null,
      error: 'inputs.pattern is rejected by safe-regex policy',
    };
  }
  try {
    return { matcher: new RegExp(pattern, 'i') };
  } catch {
    return { matcher: null, error: 'inputs.pattern must be a valid regex' };
  }
}

function parseAllowedRoots(raw: string, cwd: string): string[] {
  const roots = String(raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => path.resolve(cwd, entry));
  return roots.length > 0 ? roots : [path.resolve(cwd)];
}

function isWithinAllowedRoots(target: string, roots: string[]): boolean {
  const resolved = path.resolve(target);
  return roots.some((root) => {
    const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return resolved === root || resolved.startsWith(normalizedRoot);
  });
}

async function canonicalizeExistingPath(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

function hasRipgrep(runSync: typeof spawnSync): boolean {
  const check = runSync('rg', ['--version'], { encoding: 'utf8', timeout: 2000 });
  return !check.error && check.status === 0;
}

async function statEntry(targetPath: string): Promise<FsWalkEntry | null> {
  try {
    const stat = await fs.stat(targetPath);
    return {
      path: targetPath,
      name: path.basename(targetPath),
      is_directory: stat.isDirectory(),
      size: stat.size,
      modified_at: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

async function fallbackWalk(
  root: string,
  matcher: ((candidate: string) => boolean) | null,
  maxResults: number,
  includeHidden: boolean,
  filesOnly: boolean,
  maxDepth: number,
): Promise<FsWalkEntry[]> {
  const results: FsWalkEntry[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || results.length >= maxResults) return;
    let entries: Array<import('node:fs').Dirent> = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxResults) return;
      if (!includeHidden && entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      const isDirectory = entry.isDirectory();
      const matches = !matcher || matcher(entry.name) || matcher(fullPath);
      if (matches && (!filesOnly || !isDirectory)) {
        const stat = await statEntry(fullPath);
        if (stat) results.push(stat);
      }
      if (isDirectory) {
        await visit(fullPath, depth + 1);
      }
    }
  }
  await visit(root, 0);
  return results;
}

async function ripgrepWalk(
  root: string,
  matcher: ((candidate: string) => boolean) | null,
  maxResults: number,
  includeHidden: boolean,
  maxDepth: number,
  runSync: typeof spawnSync,
): Promise<FsWalkEntry[]> {
  const args = ['--files'];
  if (includeHidden) args.push('--hidden');
  const run = runSync('rg', args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
  });
  if (run.error || run.status !== 0) return [];
  const lines = String(run.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const depthFiltered = lines.filter((line) => {
    const normalized = line.replace(/\\/g, '/');
    const depth = normalized.split('/').filter(Boolean).length - 1;
    return depth <= maxDepth;
  });
  const filtered = matcher
    ? depthFiltered.filter((line) => matcher(line) || matcher(path.basename(line)))
    : depthFiltered;
  const limited = filtered.slice(0, maxResults);
  const entries: FsWalkEntry[] = [];
  for (const relative of limited) {
    const fullPath = path.resolve(root, relative);
    const stat = await statEntry(fullPath);
    if (stat) entries.push(stat);
  }
  return entries;
}

export async function executeNativeFsWalkTool(
  inputs: NativeFsWalkInputs,
  deps?: {
    env?: Record<string, string | undefined>;
    cwd?: string;
    runSync?: typeof spawnSync;
  },
): Promise<{ outputs: Record<string, unknown>; error?: string }> {
  const env = deps?.env || process.env;
  const nativeMode = parseBoolean(env.SVEN_NATIVE_MODE, false);
  if (!nativeMode) {
    return { outputs: {}, error: 'fs.walk is disabled unless SVEN_NATIVE_MODE=true' };
  }

  const rootRaw = String(inputs.root || '').trim();
  if (!rootRaw) {
    return { outputs: {}, error: 'inputs.root is required' };
  }

  const cwd = path.resolve(deps?.cwd || process.cwd());
  const root = path.resolve(rootRaw);
  const allowedRoots = parseAllowedRoots(String(env.SVEN_NATIVE_FS_ALLOWED_ROOTS || ''), cwd);
  const canonicalRoot = await canonicalizeExistingPath(root);
  if (!canonicalRoot) {
    return { outputs: { root, allowed_roots: allowedRoots }, error: 'root does not exist or cannot be resolved' };
  }
  const canonicalAllowedRoots = (
    await Promise.all(allowedRoots.map((allowedRoot) => canonicalizeExistingPath(allowedRoot)))
  ).filter((entry): entry is string => Boolean(entry));

  const lexicalAllowed = isWithinAllowedRoots(root, allowedRoots);
  const canonicalAllowed = isWithinAllowedRoots(canonicalRoot, canonicalAllowedRoots);
  if (!lexicalAllowed || !canonicalAllowed) {
    return { outputs: { root, allowed_roots: allowedRoots }, error: 'root is outside allowed roots' };
  }

  const patternRaw = String(inputs.pattern || '').trim();
  const parsedRegex = parseRegex(patternRaw);
  if (parsedRegex.error) {
    return { outputs: {}, error: parsedRegex.error };
  }
  const matcherRegex = parsedRegex.matcher;
  const regexMaxEvals = clamp(
    env.SVEN_NATIVE_FS_REGEX_MAX_EVALS,
    DEFAULT_REGEX_MAX_EVALS,
    100,
    MAX_REGEX_MAX_EVALS,
  );
  const regexMaxEvalMs = clamp(
    env.SVEN_NATIVE_FS_REGEX_MAX_EVAL_MS,
    DEFAULT_REGEX_MAX_EVAL_MS,
    10,
    MAX_REGEX_MAX_EVAL_MS,
  );
  const regexEvalStartedAt = Date.now();
  let regexEvalCount = 0;
  const matcher = matcherRegex
    ? ((candidate: string) => {
      regexEvalCount += 1;
      if (regexEvalCount > regexMaxEvals) {
        throw new Error('regex evaluation budget exceeded');
      }
      if (Date.now() - regexEvalStartedAt > regexMaxEvalMs) {
        throw new Error('regex evaluation time budget exceeded');
      }
      return matcherRegex.test(candidate);
    })
    : null;
  const maxResults = clamp(inputs.max_results, DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_CAP);
  const includeHidden = parseBoolean(inputs.include_hidden, false);
  const filesOnly = parseBoolean(inputs.files_only, true);
  const maxDepth = clamp(inputs.max_depth, DEFAULT_MAX_DEPTH, 1, 32);
  const runSync = deps?.runSync || spawnSync;
  const useRg = parseBoolean(env.SVEN_NATIVE_FS_WALK_USE_RG, true) && hasRipgrep(runSync);

  let entries: FsWalkEntry[] = [];
  try {
    if (useRg && filesOnly) {
      entries = await ripgrepWalk(root, matcher, maxResults, includeHidden, maxDepth, runSync);
    }
    if (entries.length === 0) {
      entries = await fallbackWalk(root, matcher, maxResults, includeHidden, filesOnly, maxDepth);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('regex evaluation')) {
      return {
        outputs: { root: canonicalRoot, pattern: patternRaw || undefined },
        error: message,
      };
    }
    throw err;
  }

  return {
    outputs: {
      root: canonicalRoot,
      pattern: patternRaw || undefined,
      strategy: useRg && filesOnly ? 'ripgrep_or_fallback' : 'filesystem_fallback',
      result_count: entries.length,
      entries,
    },
  };
}
