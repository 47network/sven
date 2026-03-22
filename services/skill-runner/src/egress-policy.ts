import net from 'node:net';
import { validateDomainAllowlist } from '@sven/shared/integrations/web.js';

export function evaluateWebAllowlist(url: string, allowlist: string[]): { allowed: boolean; error?: string } {
  const candidateUrl = String(url || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return { allowed: false, error: `Invalid URL: ${candidateUrl}` };
  }
  const normalizedHostname = String(parsed.hostname || '').trim().toLowerCase();
  const normalizedAllowlist = allowlist
    .map((domain) => String(domain || '').trim().toLowerCase())
    .filter((domain) => domain.length > 0);

  const isIp = net.isIP(normalizedHostname) !== 0;
  if (isIp) {
    const parsedHost = String(parsed.host || '').trim().toLowerCase();
    const explicitlyAllowlisted = normalizedAllowlist.some((entry) => entry === normalizedHostname || entry === parsedHost);
    if (explicitlyAllowlisted) {
      return { allowed: true };
    }
    return { allowed: false, error: `Raw IP egress blocked for ${normalizedHostname}` };
  }

  if (normalizedAllowlist.length === 0) {
    return { allowed: false, error: 'No web domains are allowlisted' };
  }

  const validation = validateDomainAllowlist(candidateUrl, normalizedAllowlist);
  if (!validation.valid) {
    return { allowed: false, error: validation.reason || `Domain ${normalizedHostname} not in web allowlist` };
  }

  return { allowed: true };
}
