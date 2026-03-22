import fs from 'node:fs/promises';
import path from 'node:path';

function parseFileRefPath(ref: string): string {
  try {
    const parsed = new URL(ref);
    let pathname = decodeURIComponent(parsed.pathname || '');
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    return String(ref || '').slice('file://'.length);
  }
}

function isTruthy(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function toRealAbsPath(candidate: string): Promise<string | null> {
  const abs = path.resolve(candidate);
  try {
    return await fs.realpath(abs);
  } catch {
    return null;
  }
}

function isWithinRoot(targetPath: string, rootPath: string): boolean {
  const rel = path.relative(rootPath, targetPath);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export async function resolveSecretFileRef(ref: string, env: NodeJS.ProcessEnv): Promise<string> {
  if (!isTruthy(env.SVEN_SECRET_FILE_REF_ENABLED)) {
    throw new Error('file:// secret refs are disabled');
  }

  const targetCandidate = parseFileRefPath(ref);
  if (!targetCandidate) {
    throw new Error('Invalid file ref');
  }
  const targetReal = await toRealAbsPath(targetCandidate);
  if (!targetReal) {
    throw new Error('Invalid file ref path');
  }

  const rootsRaw = String(env.SVEN_SECRET_FILE_ALLOWLIST || '')
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (rootsRaw.length === 0) {
    throw new Error('file:// secret refs require SVEN_SECRET_FILE_ALLOWLIST');
  }

  const allowedRoots: string[] = [];
  for (const root of rootsRaw) {
    const resolved = await toRealAbsPath(root);
    if (resolved) allowedRoots.push(resolved);
  }
  if (allowedRoots.length === 0) {
    throw new Error('No valid file:// secret allowlist roots');
  }

  const permitted = allowedRoots.some((root) => isWithinRoot(targetReal, root));
  if (!permitted) {
    throw new Error('file:// secret ref path is outside allowed roots');
  }
  return (await fs.readFile(targetReal, 'utf8')).trim();
}

