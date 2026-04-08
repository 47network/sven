import path from 'node:path';
import { promises as fs } from 'node:fs';

function isTruthy(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isProductionProfile(env: NodeJS.ProcessEnv): boolean {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const svenEnv = String(env.SVEN_ENV || '').trim().toLowerCase();
  const flavor = String(env.SVEN_FLAVOR || '').trim().toLowerCase();
  return nodeEnv === 'production'
    || svenEnv === 'production'
    || svenEnv === 'prod'
    || flavor === 'prod'
    || flavor === 'production';
}

function normalizeList(raw: string | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

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

export async function resolveSecretRef(ref: string): Promise<string> {
  if (ref.startsWith('sops://')) {
    const filePath = ref.slice('sops://'.length);
    if (!filePath) {
      throw new Error('Invalid sops ref');
    }

    const sopsRoot = process.env.SVEN_SOPS_ROOT || '/etc/sven/secrets';
    const realSopsRoot = await toRealAbsPath(sopsRoot);
    if (!realSopsRoot) {
      throw new Error('SVEN_SOPS_ROOT does not exist');
    }
    const targetReal = await toRealAbsPath(filePath);
    if (!targetReal || !isWithinRoot(targetReal, realSopsRoot)) {
      throw new Error('sops ref path is outside allowed root');
    }

    const sopsBin = process.env.SVEN_SOPS_BIN || 'sops';
    const { execFile } = await import('node:child_process');
    const child = execFile(sopsBin, ['-d', targetReal], { encoding: 'utf8' });
    return new Promise((resolve, reject) => {
      let result = '';
      child.on('error', reject);
      child.stdout?.on('data', (chunk) => {
        result += chunk;
      });
      child.on('close', () => resolve(result.trim()));
    });
  }

  if (ref.startsWith('vault://')) {
    const addr = process.env.VAULT_ADDR;
    const token = process.env.VAULT_TOKEN;
    if (!addr || !token) {
      throw new Error('Vault not configured');
    }

    const parsed = new URL(ref);
    const vaultPath = `${parsed.host}${parsed.pathname}`.replace(/^\//, '').replace(/\.\./g, '');
    if (!vaultPath || vaultPath.includes('..')) {
      throw new Error('Invalid vault path');
    }
    const field = parsed.hash ? parsed.hash.slice(1) : '';
    const response = await fetch(`${addr.replace(/\/$/, '')}/v1/${vaultPath}`, {
      headers: { 'X-Vault-Token': token },
    });

    if (!response.ok) {
      throw new Error(`Vault request failed (${response.status})`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const dataNode = (body.data as Record<string, unknown> | undefined) ?? {};
    const data = (dataNode.data as Record<string, unknown> | undefined) ?? dataNode;

    if (field) {
      const value = data[field];
      if (typeof value === 'string') {
        return value;
      }
      if (value !== undefined) {
        return JSON.stringify(value);
      }
      throw new Error(`Vault field not found: ${field}`);
    }

    return JSON.stringify(data);
  }

  if (ref.startsWith('file://')) {
    const filePath = parseFileRefPath(ref);
    if (!filePath) {
      throw new Error('Invalid file ref');
    }
    const fileRefEnabled = isTruthy(process.env.SVEN_SECRET_FILE_REF_ENABLED)
      || !isProductionProfile(process.env);
    if (!fileRefEnabled) {
      throw new Error('file:// secret refs are disabled');
    }

    const targetReal = await toRealAbsPath(filePath);
    if (!targetReal) {
      throw new Error('Invalid file ref path');
    }

    const rootsRaw = String(process.env.SVEN_SECRET_FILE_ALLOWLIST || '')
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

  if (ref.startsWith('env://')) {
    const key = ref.slice('env://'.length);
    if (!key) {
      throw new Error('Invalid env ref');
    }
    const enforceAllowlist = isProductionProfile(process.env) || isTruthy(process.env.SVEN_SECRET_ENV_ENFORCE_ALLOWLIST);
    if (enforceAllowlist) {
      const allowlist = normalizeList(process.env.SVEN_SECRET_ENV_ALLOWLIST);
      if (!allowlist.has(key)) {
        throw new Error('env:// secret ref key is not allowlisted');
      }
    }
    const value = process.env[key];
    if (value === undefined) {
      throw new Error(`Env var not set: ${key}`);
    }
    return value;
  }

  throw new Error('Unsupported secret ref');
}
