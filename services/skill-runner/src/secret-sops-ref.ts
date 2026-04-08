import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

type RunProcResult = {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: Error | null;
};

type RunProc = (
  command: string,
  args: string[],
  options: {
    encoding: 'utf8';
    timeout: number;
    maxBuffer: number;
    shell: boolean;
    env: NodeJS.ProcessEnv;
  },
) => RunProcResult;

function splitAllowlist(raw: string): string[] {
  return String(raw || '')
    .split(/[;,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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

export async function resolveSecretSopsRef(
  ref: string,
  env: NodeJS.ProcessEnv,
  deps?: { runProc?: RunProc },
): Promise<string> {
  const filePath = ref.slice('sops://'.length);
  if (!filePath) {
    throw new Error('Invalid sops ref');
  }

  const allowlist = splitAllowlist(String(env.SVEN_SOPS_FILE_ALLOWLIST || ''));
  if (allowlist.length > 0) {
    const targetReal = await toRealAbsPath(filePath);
    if (!targetReal) {
      throw new Error('Invalid sops ref path');
    }
    const roots: string[] = [];
    for (const root of allowlist) {
      const rootReal = await toRealAbsPath(root);
      if (rootReal) roots.push(rootReal);
    }
    if (roots.length === 0) {
      throw new Error('No valid sops file allowlist roots');
    }
    const permitted = roots.some((root) => isWithinRoot(targetReal, root));
    if (!permitted) {
      throw new Error('sops ref path is outside allowed roots');
    }
  }

  const sopsBin = String(env.SVEN_SOPS_BIN || 'sops').trim();
  if (!sopsBin) {
    throw new Error('Invalid sops binary');
  }
  const runProc = deps?.runProc || spawnSync;
  const result = runProc(sopsBin, ['-d', filePath], {
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    shell: false,
    env,
  });
  if (result.error) {
    throw new Error(`sops decryption failed: ${(result.error as NodeJS.ErrnoException).code || 'UNKNOWN'}`);
  }
  if (result.status !== 0) {
    throw new Error(`sops exited with status ${result.status}`);
  }
  return String(result.stdout || '').trim();
}

