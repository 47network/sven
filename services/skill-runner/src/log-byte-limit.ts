export function trimUtf8ToByteLimit(value: string, maxBytes: number): string {
  if (!value) return value;
  const budget = Number(maxBytes);
  if (!Number.isFinite(budget) || budget <= 0) return '';
  if (Buffer.byteLength(value, 'utf8') <= budget) return value;
  let used = 0;
  let out = '';
  for (const ch of value) {
    const next = Buffer.byteLength(ch, 'utf8');
    if ((used + next) > budget) break;
    out += ch;
    used += next;
  }
  return out;
}
