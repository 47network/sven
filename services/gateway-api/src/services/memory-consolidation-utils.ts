function normalizeText(input: string): string {
  return String(input || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function tokenSet(input: string): Set<string> {
  const tokens = normalizeText(input)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function computeMemorySimilarity(
  keyA: string,
  valueA: string,
  keyB: string,
  valueB: string,
): number {
  return jaccard(tokenSet(`${keyA} ${valueA}`), tokenSet(`${keyB} ${valueB}`));
}

export function shouldMergeBySimilarity(similarity: number, threshold: number): boolean {
  return Number.isFinite(similarity) && similarity >= threshold;
}
