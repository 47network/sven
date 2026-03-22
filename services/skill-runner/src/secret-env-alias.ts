export function normalizeSecretEnvKey(key: string): string {
  return key.replace(/[^A-Za-z0-9_]/g, '_').toUpperCase();
}

export function buildSecretAliasCollisionError(keys: string[]): string | null {
  const aliasMap = new Map<string, string[]>();
  for (const key of keys) {
    const alias = normalizeSecretEnvKey(key);
    const existing = aliasMap.get(alias) || [];
    existing.push(key);
    aliasMap.set(alias, existing);
  }

  const collisions = Array.from(aliasMap.entries())
    .filter(([, aliasKeys]) => aliasKeys.length > 1)
    .sort(([a], [b]) => a.localeCompare(b));
  if (collisions.length === 0) return null;

  const details = collisions
    .map(([alias, aliasKeys]) => `SVEN_SECRET_${alias} <= ${aliasKeys.join(', ')}`)
    .join('; ');
  return `Secret env alias collision detected: ${details}`;
}
