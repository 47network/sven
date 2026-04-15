// ---------------------------------------------------------------------------
// Prompt Compressor Skill — Compress long contexts preserving meaning
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;
  const text = (input.text as string) || '';

  if (!text) return { error: 'text is required.' };

  switch (action) {
    case 'compress': {
      const targetRatio = Math.max(0.1, Math.min(1.0, (input.target_ratio as number) || 0.5));
      const preserveCode = input.preserve_code !== false;

      const originalTokens = estimateTokens(text);
      const targetTokens = Math.ceil(originalTokens * targetRatio);

      // Extract code blocks to preserve them
      const codeBlocks: string[] = [];
      let processed = text;
      if (preserveCode) {
        processed = text.replace(/```[\s\S]*?```/g, (match) => {
          codeBlocks.push(match);
          return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
        });
      }

      // Apply compression stages
      processed = compressWhitespace(processed);
      processed = removeFillerPhrases(processed);
      processed = abbreviateCommonPhrases(processed);
      processed = removeLowInfoSentences(processed);

      let currentTokens = estimateTokens(processed);

      // If still over target, apply aggressive truncation
      if (currentTokens > targetTokens) {
        processed = aggressiveTruncate(processed, targetTokens);
        currentTokens = estimateTokens(processed);
      }

      // Restore code blocks
      if (preserveCode) {
        for (let i = 0; i < codeBlocks.length; i++) {
          processed = processed.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
        }
      }

      const finalTokens = estimateTokens(processed);

      return {
        result: {
          compressed_text: processed,
          original_tokens: originalTokens,
          compressed_tokens: finalTokens,
          actual_ratio: originalTokens > 0 ? Math.round((finalTokens / originalTokens) * 100) / 100 : 1,
          target_ratio: targetRatio,
          savings_tokens: originalTokens - finalTokens,
          savings_percent: originalTokens > 0 ? Math.round((1 - finalTokens / originalTokens) * 100) : 0,
          code_blocks_preserved: codeBlocks.length,
          techniques_applied: ['whitespace', 'filler_removal', 'abbreviation', 'low_info_removal'],
        },
      };
    }

    case 'decompress_plan': {
      // Analyze what was lost and provide a plan to recover information
      const originalTokens = estimateTokens(text);
      const sections = text.split(/\n\n+/).filter((s) => s.trim().length > 0);

      const plan: { section: number; tokens: number; could_expand: boolean; reason: string }[] = [];
      for (let i = 0; i < sections.length; i++) {
        const tokens = estimateTokens(sections[i]);
        const hasAbbreviations = /\b(w\/|b\/c|vs\.|e\.g\.|i\.e\.|etc\.)\b/.test(sections[i]);
        const isCompact = tokens < 50 && sections[i].split(/[.!?]/).length > 3;
        plan.push({
          section: i + 1,
          tokens,
          could_expand: hasAbbreviations || isCompact,
          reason: hasAbbreviations ? 'Contains abbreviations' : isCompact ? 'Highly condensed' : 'Normal density',
        });
      }

      return {
        result: {
          total_tokens: originalTokens,
          section_count: sections.length,
          sections_expandable: plan.filter((p) => p.could_expand).length,
          plan,
        },
      };
    }

    case 'benchmark': {
      const originalTokens = estimateTokens(text);
      const results: { technique: string; tokens: number; ratio: number; sample: string }[] = [];

      // Test each technique independently
      const techniques: [string, (t: string) => string][] = [
        ['whitespace', compressWhitespace],
        ['filler_removal', removeFillerPhrases],
        ['abbreviation', abbreviateCommonPhrases],
        ['low_info_removal', removeLowInfoSentences],
      ];

      for (const [name, fn] of techniques) {
        const result = fn(text);
        const tokens = estimateTokens(result);
        results.push({
          technique: name,
          tokens,
          ratio: originalTokens > 0 ? Math.round((tokens / originalTokens) * 100) / 100 : 1,
          sample: result.slice(0, 200) + (result.length > 200 ? '...' : ''),
        });
      }

      // Combined
      let combined = text;
      for (const [, fn] of techniques) combined = fn(combined);
      const combinedTokens = estimateTokens(combined);

      return {
        result: {
          original_tokens: originalTokens,
          techniques: results,
          combined: {
            tokens: combinedTokens,
            ratio: originalTokens > 0 ? Math.round((combinedTokens / originalTokens) * 100) / 100 : 1,
            savings_percent: originalTokens > 0 ? Math.round((1 - combinedTokens / originalTokens) * 100) : 0,
          },
          recommendation: results.sort((a, b) => a.tokens - b.tokens)[0].technique,
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: compress, decompress_plan, benchmark` };
  }
}

/* -------- Token Estimation -------- */

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/* -------- Compression Techniques -------- */

function compressWhitespace(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')     // Collapse multiple blank lines
    .replace(/[ \t]+/g, ' ')         // Collapse horizontal whitespace
    .replace(/^ +/gm, '')            // Remove leading spaces
    .replace(/ +$/gm, '')            // Remove trailing spaces
    .trim();
}

function removeFillerPhrases(text: string): string {
  const fillers = [
    /\b(I think that|I believe that|It seems like|It appears that)\s+/gi,
    /\b(As you may know|As we discussed|As mentioned earlier|As previously stated),?\s*/gi,
    /\b(In order to)\b/gi,
    /\b(at the end of the day|when all is said and done|at this point in time)\s*/gi,
    /\b(needless to say|it goes without saying)\s*,?\s*/gi,
    /\b(please note that|it should be noted that|it is worth noting that)\s*/gi,
    /\b(basically|essentially|literally|actually|really|very|quite|rather|somewhat)\s+/gi,
  ];

  let result = text;
  for (const filler of fillers) {
    result = result.replace(filler, (match) => {
      // Special replacements
      if (/in order to/i.test(match)) return 'to ';
      return '';
    });
  }
  return result.replace(/\s+/g, ' ');
}

function abbreviateCommonPhrases(text: string): string {
  const replacements: [RegExp, string][] = [
    [/\bfor example\b/gi, 'e.g.'],
    [/\bthat is to say\b/gi, 'i.e.'],
    [/\bin other words\b/gi, 'i.e.'],
    [/\band so on\b/gi, 'etc.'],
    [/\band so forth\b/gi, 'etc.'],
    [/\bet cetera\b/gi, 'etc.'],
    [/\bwith respect to\b/gi, 'w.r.t.'],
    [/\bwith regard to\b/gi, 're:'],
    [/\bin comparison to\b/gi, 'vs.'],
    [/\bas opposed to\b/gi, 'vs.'],
    [/\bdo not\b/gi, "don't"],
    [/\bcannot\b/gi, "can't"],
    [/\bwill not\b/gi, "won't"],
    [/\bshould not\b/gi, "shouldn't"],
    [/\bwould not\b/gi, "wouldn't"],
    [/\bcould not\b/gi, "couldn't"],
  ];

  let result = text;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function removeLowInfoSentences(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lowInfo = /^(This is|There are|It is|Here we|Let us|We will|I will)\s/i;
  const transitional = /^(However|Moreover|Furthermore|Additionally|Also|Besides|In addition)/i;

  const filtered = sentences.filter((s) => {
    const trimmed = s.trim();
    if (trimmed.length < 10) return false; // Skip very short fragments
    // Keep sentences with data, specific info
    if (/\d/.test(trimmed)) return true;
    // Remove generic transitional sentences that add no info
    if (lowInfo.test(trimmed) && trimmed.split(/\s+/).length < 6) return false;
    // Remove pure transitional phrases
    if (transitional.test(trimmed) && trimmed.split(/\s+/).length < 4) return false;
    return true;
  });

  return filtered.join(' ');
}

function aggressiveTruncate(text: string, targetTokens: number): string {
  const targetChars = targetTokens * 4;
  if (text.length <= targetChars) return text;

  // Split into sentences, keep from the end (most relevant for conversations)
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  let result = '';
  const kept: string[] = [];

  // Keep first sentence for context
  if (sentences.length > 0) {
    kept.push(sentences[0]);
  }

  // Fill from the end
  for (let i = sentences.length - 1; i > 0; i--) {
    const candidate = [...kept.slice(0, 1), '...', sentences[i], ...kept.slice(1)].join(' ');
    if (candidate.length <= targetChars) {
      kept.splice(1, 0, sentences[i]);
    }
  }

  result = kept.join(' ');
  return result.length > targetChars ? result.slice(0, targetChars) : result;
}
