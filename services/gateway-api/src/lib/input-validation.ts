const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SLUG_REGEX = /^[a-z0-9]+(?:[a-z0-9._-]*[a-z0-9])?$/i;

const SEARCH_BLOCK_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /\bon\w+\s*=/i,
  /javascript:/i,
  /<\s*\/?\s*[a-z][^>]*>/i,
  /\bunion\s+select\b/i,
  /(?:--|\/\*|\*\/)/,
  /;\s*(?:select|insert|update|delete|drop)\b/i,
];

export function isUuid(value: string): boolean {
  return UUID_REGEX.test(String(value || '').trim());
}

export function isSlug(value: string): boolean {
  const input = String(value || '').trim();
  return input.length > 0 && input.length <= 64 && SLUG_REGEX.test(input);
}

export function normalizeSearchQuery(raw: unknown): string {
  const input = String(raw ?? '');
  let withoutControls = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    withoutControls += (code <= 31 || code === 127) ? ' ' : ch;
  }
  return withoutControls.replace(/\s+/g, ' ').trim();
}

export function isSafeSearchQuery(raw: unknown): boolean {
  const query = normalizeSearchQuery(raw);
  if (!query) return false;
  if (query.length > 512) return false;
  return !SEARCH_BLOCK_PATTERNS.some((pattern) => pattern.test(query));
}
