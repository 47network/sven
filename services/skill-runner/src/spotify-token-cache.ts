import { createHash } from 'node:crypto';

type SpotifyTokenCacheEntry = {
  token: string;
  expiresAtMs: number;
};

export type SpotifyTokenCache = Map<string, SpotifyTokenCacheEntry>;

export function buildSpotifyCredentialFingerprint(clientId: string, clientSecret: string): string {
  return createHash('sha256')
    .update(clientId)
    .update('\0')
    .update(clientSecret)
    .digest('hex');
}

export function getValidSpotifyToken(
  cache: SpotifyTokenCache,
  credentialFingerprint: string,
  nowMs = Date.now(),
): string | null {
  const entry = cache.get(credentialFingerprint);
  if (!entry) return null;
  return nowMs < (entry.expiresAtMs - 60_000) ? entry.token : null;
}

export function setSpotifyToken(
  cache: SpotifyTokenCache,
  credentialFingerprint: string,
  token: string,
  expiresInSeconds: number,
  nowMs = Date.now(),
): void {
  const expiresIn = Math.max(Number(expiresInSeconds || 3600), 60);
  cache.set(credentialFingerprint, {
    token,
    expiresAtMs: nowMs + (expiresIn * 1000),
  });
}
