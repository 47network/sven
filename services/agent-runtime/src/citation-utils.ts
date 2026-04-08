export interface CitationRef {
  id: string;
  source?: string;
  doc_id?: string;
  chunk_id?: string;
  chunk_index?: number;
  start_offset?: number;
  end_offset?: number;
  content_hash?: string;
}

export function normalizeCitations(raw: unknown): CitationRef[] {
  if (!Array.isArray(raw)) return [];

  const citations: CitationRef[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && item.trim().length > 0) {
      citations.push({ id: item.trim() });
      continue;
    }

    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) continue;

    citations.push({
      id: candidate.id.trim(),
      source: typeof candidate.source === 'string' ? candidate.source : undefined,
      doc_id: typeof candidate.doc_id === 'string' ? candidate.doc_id : undefined,
      chunk_id: typeof candidate.chunk_id === 'string' ? candidate.chunk_id : undefined,
      chunk_index: typeof candidate.chunk_index === 'number' ? candidate.chunk_index : undefined,
      start_offset: typeof candidate.start_offset === 'number' ? candidate.start_offset : undefined,
      end_offset: typeof candidate.end_offset === 'number' ? candidate.end_offset : undefined,
      content_hash: typeof candidate.content_hash === 'string' ? candidate.content_hash : undefined,
    });
  }

  return citations;
}

export function hasCitationMarkers(text: string): boolean {
  if (!text) return false;

  const ragIdPattern = /\brag:[a-f0-9]{64}\b/i;
  const bracketPattern = /\[(\d+|source:[^\]]{1,500})\]/i;
  return ragIdPattern.test(text) || bracketPattern.test(text);
}

export function appendCitationsIfMissing(text: string, citations: CitationRef[]): string {
  if (!citations || citations.length === 0) return text;
  if (hasCitationMarkers(text)) return text;

  const ids = citations.map((c) => c.id).filter((id) => id && id.trim().length > 0);
  if (ids.length === 0) return text;
  const markers = ids.map((id) => `[source:${id}]`);

  return `${text}\n\nSources: ${markers.join(' ')}`;
}

export function verifyCitations(text: string, citations?: CitationRef[]) {
  if (!citations || citations.length === 0) {
    return { ok: true as const };
  }

  const ids = citations
    .map((citation) => String(citation.id || '').trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0) {
    return { ok: true as const };
  }

  const idSet = new Set(ids);
  const ragMatches = Array.from(String(text || '').matchAll(/\brag:[a-f0-9]{64}\b/gi)).map((m) =>
    String(m[0] || '').trim(),
  );
  const bracketMarkers = Array.from(String(text || '').matchAll(/\[(\d+|source:[^\]]{1,500})\]/gi)).map((m) =>
    String(m[1] || '').trim(),
  );
  const hasMarkers = ragMatches.length > 0 || bracketMarkers.length > 0;
  if (hasMarkers) {
    for (const rag of ragMatches) {
      if (!idSet.has(rag)) {
        return {
          ok: false as const,
          rewrite:
            "I can't provide a sourced answer without citations. Please ask again or request sources explicitly.",
        };
      }
    }
    for (const marker of bracketMarkers) {
      if (/^\d+$/.test(marker)) {
        const index = Number(marker);
        if (!Number.isInteger(index) || index < 1 || index > ids.length) {
          return {
            ok: false as const,
            rewrite:
              "I can't provide a sourced answer without citations. Please ask again or request sources explicitly.",
          };
        }
        continue;
      }
      if (marker.toLowerCase().startsWith('source:')) {
        const sourceId = marker.slice('source:'.length).trim();
        if (!sourceId || !idSet.has(sourceId)) {
          return {
            ok: false as const,
            rewrite:
              "I can't provide a sourced answer without citations. Please ask again or request sources explicitly.",
          };
        }
        continue;
      }
      return {
        ok: false as const,
        rewrite:
          "I can't provide a sourced answer without citations. Please ask again or request sources explicitly.",
      };
    }
    return { ok: true as const };
  }

  return {
    ok: false as const,
    rewrite:
      "I can't provide a sourced answer without citations. Please ask again or request sources explicitly.",
  };
}

export function formatCitationsMarkdown(citations: CitationRef[]): string {
  const lines = ['Sources:'];
  for (const citation of citations) {
    const parts = [citation.id];
    if (citation.source) parts.push(`source=${citation.source}`);
    if (citation.doc_id) parts.push(`doc=${citation.doc_id}`);
    if (typeof citation.chunk_index === 'number') parts.push(`chunk=${citation.chunk_index}`);
    if (typeof citation.start_offset === 'number') parts.push(`start=${citation.start_offset}`);
    if (typeof citation.end_offset === 'number') parts.push(`end=${citation.end_offset}`);
    lines.push(`- ${parts.join(' ')}`);
  }

  return lines.join('\n');
}
