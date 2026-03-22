function isTruthy(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parseEnvRefKey(ref: string): string {
  const key = String(ref || '').slice('env://'.length).trim();
  if (!key) {
    throw new Error('Invalid env ref');
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error('Invalid env ref key');
  }
  return key;
}

function normalizeList(raw: string | undefined): Set<string> {
  return new Set(
    String(raw || '')
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
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

export function resolveSecretEnvRef(ref: string, env: NodeJS.ProcessEnv): string {
  const key = parseEnvRefKey(ref);
  const value = env[key];
  if (value === undefined) {
    throw new Error(`Env var not set: ${key}`);
  }

  const enforceAllowlist = isProductionProfile(env) || isTruthy(env.SVEN_SECRET_ENV_ENFORCE_ALLOWLIST);
  if (enforceAllowlist) {
    const allowlist = normalizeList(env.SVEN_SECRET_ENV_ALLOWLIST);
    if (!allowlist.has(key)) {
      throw new Error('env:// secret ref key is not allowlisted');
    }
  }

  return value;
}

