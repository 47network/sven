const DEFAULT_MCP_STDIO_ENV_ALLOWLIST = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMP',
  'TEMP',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'LANG',
  'LC_ALL',
  'TERM',
];

function resolveAllowlist(hostEnv: Record<string, string | undefined>): string[] {
  const raw = String(hostEnv.SVEN_MCP_STDIO_ENV_ALLOWLIST || '').trim();
  if (!raw) return DEFAULT_MCP_STDIO_ENV_ALLOWLIST;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function buildMcpStdioEnv(
  hostEnv: Record<string, string | undefined>,
  injectedEnv: Record<string, string> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of resolveAllowlist(hostEnv)) {
    const value = hostEnv[key];
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  for (const [key, value] of Object.entries(injectedEnv || {})) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}
