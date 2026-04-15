// ---------------------------------------------------------------------------
// Context Engineer Skill — Optimize prompts & context for token efficiency
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const text = (input.text as string) || '';

  if (!text) return { error: 'text is required.' };

  switch (action) {
    case 'optimize': {
      const strategy = (input.strategy as string) || 'remove_redundancy';
      const maxTokens = (input.max_tokens as number) || 0;
      const original = estimateTokens(text);
      let optimized = text;

      switch (strategy) {
        case 'remove_redundancy':
          optimized = removeRedundancy(text);
          break;
        case 'summarize_sections':
          optimized = summarizeSections(text);
          break;
        case 'prioritize_recent':
          optimized = prioritizeRecent(text);
          break;
        case 'extract_key_facts':
          optimized = extractKeyFacts(text);
          break;
      }

      if (maxTokens > 0) {
        optimized = truncateToTokens(optimized, maxTokens);
      }

      const after = estimateTokens(optimized);

      return {
        result: {
          optimized_text: optimized,
          strategy,
          original_tokens: original,
          optimized_tokens: after,
          reduction_percent: original > 0 ? Math.round((1 - after / original) * 100) : 0,
          savings: original - after,
        },
      };
    }

    case 'analyze': {
      const tokens = estimateTokens(text);
      const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
      const words = text.split(/\s+/).filter(Boolean);

      // Detect redundancy
      const sentenceSet = new Set<string>();
      let duplicateSentences = 0;
      for (const s of sentences) {
        const normalized = s.trim().toLowerCase().replace(/\s+/g, ' ');
        if (sentenceSet.has(normalized)) duplicateSentences++;
        sentenceSet.add(normalized);
      }

      // Detect filler words
      const fillers = ['basically', 'actually', 'essentially', 'literally', 'really', 'very',
        'just', 'quite', 'rather', 'somewhat', 'simply', 'obviously', 'clearly', 'certainly'];
      let fillerCount = 0;
      for (const w of words) {
        if (fillers.includes(w.toLowerCase())) fillerCount++;
      }

      // Information density: unique words / total words
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      const density = words.length > 0 ? Math.round((uniqueWords.size / words.length) * 100) : 0;

      return {
        result: {
          estimated_tokens: tokens,
          word_count: words.length,
          sentence_count: sentences.length,
          paragraph_count: paragraphs.length,
          duplicate_sentences: duplicateSentences,
          filler_word_count: fillerCount,
          vocabulary_density_percent: density,
          recommendations: buildRecommendations(duplicateSentences, fillerCount, density, tokens),
        },
      };
    }

    case 'chunk': {
      const maxTokens = (input.max_tokens as number) || 2000;
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
      const chunks: { index: number; text: string; tokens: number }[] = [];
      let current = '';
      let currentTokens = 0;

      for (const para of paragraphs) {
        const paraTokens = estimateTokens(para);
        if (currentTokens + paraTokens > maxTokens && current.length > 0) {
          chunks.push({ index: chunks.length, text: current.trim(), tokens: currentTokens });
          current = '';
          currentTokens = 0;
        }
        current += para + '\n\n';
        currentTokens += paraTokens;
      }

      if (current.trim().length > 0) {
        chunks.push({ index: chunks.length, text: current.trim(), tokens: currentTokens });
      }

      return {
        result: {
          total_tokens: estimateTokens(text),
          max_tokens_per_chunk: maxTokens,
          chunk_count: chunks.length,
          chunks,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: optimize, analyze, chunk` };
  }
}

/* -------- Token Estimation -------- */

function estimateTokens(text: string): number {
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  // Cut at last complete sentence within limit
  const truncated = text.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?'),
  );
  return lastSentenceEnd > maxChars * 0.5 ? truncated.slice(0, lastSentenceEnd + 1) : truncated;
}

/* -------- Optimization Strategies -------- */

function removeRedundancy(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const s of sentences) {
    const key = s.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(key) && key.length > 0) {
      seen.add(key);
      unique.push(s.trim());
    }
  }

  // Remove filler words
  let result = unique.join(' ');
  const fillers = /\b(basically|actually|essentially|literally|really|very|just|quite|rather|somewhat|simply|obviously|clearly|certainly)\b\s*/gi;
  result = result.replace(fillers, '');

  // Collapse whitespace
  return result.replace(/\s+/g, ' ').trim();
}

function summarizeSections(text: string): string {
  const sections = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  return sections.map((section) => {
    const sentences = section.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    if (sentences.length <= 2) return section.trim();
    // Keep first and last sentence of each section (key info heuristic)
    return [sentences[0], sentences[sentences.length - 1]].join(' ');
  }).join('\n\n');
}

function prioritizeRecent(text: string): string {
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  if (paragraphs.length <= 3) return text;
  // Keep first paragraph (context) and last 60% of content
  const keepFrom = Math.max(1, Math.floor(paragraphs.length * 0.4));
  return [paragraphs[0], '...', ...paragraphs.slice(keepFrom)].join('\n\n');
}

function extractKeyFacts(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  // Score sentences by keyword indicators of importance
  const importanceMarkers = /\b(important|key|critical|must|note|significant|required|essential|primary|main)\b/i;
  const dataMarkers = /\b(\d+%|\$\d+|\d{4}[-/]\d{2}|\d+\.\d+)\b/;

  const scored = sentences.map((s) => {
    let score = 0;
    if (importanceMarkers.test(s)) score += 2;
    if (dataMarkers.test(s)) score += 2;
    if (s.includes(':')) score += 1; // definition-like
    if (s.length < 20) score -= 1; // too short
    return { sentence: s.trim(), score };
  });

  scored.sort((a, b) => b.score - a.score);
  const topN = Math.max(3, Math.ceil(scored.length * 0.4));
  // Re-sort by original order for coherence
  const top = scored.slice(0, topN);
  const originalOrder = sentences.filter((s) => top.some((t) => t.sentence === s.trim()));

  return originalOrder.join(' ');
}

/* -------- Recommendations -------- */

function buildRecommendations(dupes: number, fillers: number, density: number, tokens: number): string[] {
  const recs: string[] = [];
  if (dupes > 0) recs.push(`Remove ${dupes} duplicate sentence(s) to save ~${dupes * 15} tokens.`);
  if (fillers > 5) recs.push(`Remove ${fillers} filler words for tighter prose.`);
  if (density < 40) recs.push('Low vocabulary density — text may be repetitive. Consider consolidation.');
  if (tokens > 8000) recs.push('Context exceeds 8K tokens. Consider chunking or summarization.');
  if (tokens > 4000) recs.push('Use "prioritize_recent" strategy to focus on the most relevant content.');
  if (recs.length === 0) recs.push('Text is already well-optimized for token efficiency.');
  return recs;
}
