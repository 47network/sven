export function parseAppleScriptListOutput(stdout: string, rowSep: string, colSep: string): string[][] {
  const raw = String(stdout || '');
  if (!raw.trim()) return [];
  return raw
    .split(rowSep)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => row.split(colSep));
}

