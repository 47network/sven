import { evaluateWebAllowlist } from './egress-policy.js';

function isWebScope(permissions: string[]): boolean {
  return permissions.some((permission) => permission.startsWith('web.'));
}

export function resolveWebEgressConfigDecision(params: {
  permissions: string[];
  trustLevel: string;
  urlInput: unknown;
  allowlist: string[];
  proxy: string;
  networkName: string;
}): { networkArgs: string[]; envArgs: string[]; error?: string } {
  const {
    permissions,
    trustLevel,
    urlInput,
    allowlist,
    proxy,
    networkName,
  } = params;
  if (trustLevel === 'quarantined' || trustLevel === 'blocked') {
    if (isWebScope(permissions)) {
      return { networkArgs: [], envArgs: [], error: 'Egress disabled for quarantined skills' };
    }
  }
  if (!isWebScope(permissions)) {
    return { networkArgs: ['--network=none'], envArgs: [] };
  }

  if (typeof urlInput !== 'string' || !urlInput.trim()) {
    return { networkArgs: [], envArgs: [], error: 'Web egress requires inputs.url' };
  }

  try {
    new URL(urlInput);
  } catch {
    return { networkArgs: [], envArgs: [], error: `Invalid url: ${urlInput}` };
  }

  const egressDecision = evaluateWebAllowlist(urlInput, allowlist);
  if (!egressDecision.allowed) {
    return { networkArgs: [], envArgs: [], error: egressDecision.error || 'Web egress blocked by allowlist policy' };
  }

  if (!proxy) {
    return { networkArgs: [], envArgs: [], error: 'Egress proxy not configured' };
  }

  return {
    networkArgs: [`--network=${networkName}`],
    envArgs: [
      '-e', `HTTP_PROXY=${proxy}`,
      '-e', `HTTPS_PROXY=${proxy}`,
      '-e', 'NO_PROXY=localhost,127.0.0.1',
    ],
  };
}
