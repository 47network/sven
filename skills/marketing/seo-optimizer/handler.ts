// ---------------------------------------------------------------------------
// SEO Optimizer Skill — Analyze & optimize content for search engines
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'analyze': {
      const content = (input.content as string) || '';
      const keyword = (input.target_keyword as string) || '';

      if (!content) return { error: 'content is required for analysis.' };

      const words = content.split(/\s+/).filter(Boolean);
      const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 0);
      const headings = (content.match(/^#{1,6}\s+.+$/gm) || []);

      const score: Record<string, ScoreItem> = {};

      // Content length
      score['content_length'] = words.length >= 300
        ? { value: words.length, status: 'good', note: 'Content length is sufficient' }
        : { value: words.length, status: 'warning', note: 'Aim for 300+ words for better SEO' };

      // Heading structure
      score['headings'] = headings.length >= 2
        ? { value: headings.length, status: 'good', note: 'Good heading structure' }
        : { value: headings.length, status: 'warning', note: 'Add more headings (H2, H3) to structure content' };

      // Readability (avg sentence length)
      const avgSentenceLen = sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
      score['readability'] = avgSentenceLen <= 20
        ? { value: avgSentenceLen, status: 'good', note: 'Good sentence length for readability' }
        : { value: avgSentenceLen, status: 'warning', note: 'Sentences are too long — aim for < 20 words' };

      // Keyword analysis
      if (keyword) {
        const keywordCount = (content.toLowerCase().match(new RegExp(escRegex(keyword.toLowerCase()), 'g')) || []).length;
        const density = words.length > 0 ? Math.round((keywordCount / words.length) * 1000) / 10 : 0;
        score['keyword_density'] = density >= 0.5 && density <= 3.0
          ? { value: density, status: 'good', note: `Keyword "${keyword}" density is optimal` }
          : density < 0.5
            ? { value: density, status: 'warning', note: `Keyword "${keyword}" density too low — add more mentions` }
            : { value: density, status: 'warning', note: `Keyword "${keyword}" density too high — may be flagged as spam` };

        const inFirstPara = content.slice(0, content.indexOf('\n\n') || 300).toLowerCase().includes(keyword.toLowerCase());
        score['keyword_placement'] = inFirstPara
          ? { value: 1, status: 'good', note: 'Keyword appears in first paragraph' }
          : { value: 0, status: 'warning', note: 'Include keyword in the first paragraph' };
      }

      // Paragraph structure
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
      const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 150);
      score['paragraph_length'] = longParagraphs.length === 0
        ? { value: paragraphs.length, status: 'good', note: 'Paragraph lengths are manageable' }
        : { value: longParagraphs.length, status: 'warning', note: 'Break up long paragraphs for better readability' };

      const overallScore = Object.values(score).filter((s) => s.status === 'good').length;
      const maxScore = Object.keys(score).length;

      return {
        result: {
          score: Math.round((overallScore / maxScore) * 100),
          checks: score,
          word_count: words.length,
          heading_count: headings.length,
          paragraph_count: paragraphs.length,
        },
      };
    }

    case 'optimize_meta': {
      const meta = (input.meta as MetaInput) || {};
      const keyword = (input.target_keyword as string) || '';
      const issues: string[] = [];
      const suggestions: Record<string, string> = {};

      // Title
      if (!meta.title) {
        issues.push('Missing title tag');
      } else {
        if (meta.title.length > 60) issues.push(`Title too long (${meta.title.length}/60 chars)`);
        if (meta.title.length < 30) issues.push(`Title too short (${meta.title.length} chars) — aim for 30-60`);
        if (keyword && !meta.title.toLowerCase().includes(keyword.toLowerCase())) {
          issues.push(`Title missing target keyword "${keyword}"`);
          suggestions.title = `${keyword} — ${meta.title}`.slice(0, 60);
        }
      }

      // Description
      if (!meta.description) {
        issues.push('Missing meta description');
      } else {
        if (meta.description.length > 160) issues.push(`Description too long (${meta.description.length}/160 chars)`);
        if (meta.description.length < 70) issues.push(`Description too short — aim for 70-160 chars`);
        if (keyword && !meta.description.toLowerCase().includes(keyword.toLowerCase())) {
          issues.push(`Description missing target keyword "${keyword}"`);
        }
      }

      // Open Graph
      if (!meta.og_title) issues.push('Missing og:title — needed for social sharing');
      if (!meta.og_description) issues.push('Missing og:description');
      if (!meta.og_image) issues.push('Missing og:image — critical for social link previews');

      // Canonical
      if (!meta.canonical) issues.push('Missing canonical URL — risk of duplicate content');

      return {
        result: {
          issues,
          issue_count: issues.length,
          suggestions,
          score: Math.max(0, 100 - issues.length * 15),
        },
      };
    }

    case 'keyword_analysis': {
      const content = (input.content as string) || '';
      const keyword = (input.target_keyword as string) || '';

      if (!content) return { error: 'content is required.' };
      if (!keyword) return { error: 'target_keyword is required.' };

      const words = content.toLowerCase().split(/\s+/).filter(Boolean);
      const keywordLower = keyword.toLowerCase();
      const keywordWords = keywordLower.split(/\s+/);

      // Exact matches
      let exactCount = 0;
      const text = content.toLowerCase();
      let pos = 0;
      while ((pos = text.indexOf(keywordLower, pos)) !== -1) {
        exactCount++;
        pos += keywordLower.length;
      }

      // Partial matches (individual keyword words)
      const partialCounts: Record<string, number> = {};
      for (const kw of keywordWords) {
        partialCounts[kw] = words.filter((w) => w.includes(kw)).length;
      }

      const density = words.length > 0 ? Math.round((exactCount / words.length) * 1000) / 10 : 0;

      // Positions
      const positions: number[] = [];
      let searchPos = 0;
      while ((searchPos = text.indexOf(keywordLower, searchPos)) !== -1) {
        positions.push(Math.round((searchPos / text.length) * 100));
        searchPos += keywordLower.length;
      }

      return {
        result: {
          keyword,
          exact_matches: exactCount,
          density_percent: density,
          optimal_range: '0.5% - 3.0%',
          is_optimal: density >= 0.5 && density <= 3.0,
          partial_matches: partialCounts,
          positions_percent: positions,
          distribution: positions.length > 0 ? (
            positions[positions.length - 1] - positions[0] > 60 ? 'well-distributed' : 'clustered'
          ) : 'absent',
          total_words: words.length,
        },
      };
    }

    case 'technical_check': {
      return {
        result: {
          checklist: [
            { item: 'robots.txt exists and is accessible', priority: 'critical' },
            { item: 'XML sitemap submitted to Search Console', priority: 'critical' },
            { item: 'HTTPS enabled with valid certificate', priority: 'critical' },
            { item: 'Mobile-responsive viewport meta tag', priority: 'critical' },
            { item: 'Page load time < 3 seconds', priority: 'high' },
            { item: 'No duplicate title tags across pages', priority: 'high' },
            { item: 'Canonical URLs set on all pages', priority: 'high' },
            { item: 'Structured data (JSON-LD) for rich snippets', priority: 'medium' },
            { item: '301 redirects for changed URLs', priority: 'high' },
            { item: 'No broken links (404s)', priority: 'high' },
            { item: 'Image alt tags present', priority: 'medium' },
            { item: 'Hreflang tags for multi-language sites', priority: 'medium' },
            { item: 'Core Web Vitals passing (LCP, INP, CLS)', priority: 'high' },
            { item: 'Open Graph and Twitter Card meta tags', priority: 'medium' },
            { item: 'Breadcrumb navigation with schema markup', priority: 'low' },
          ],
        },
      };
    }

    default:
      return { error: `Unknown action "${action}". Available: analyze, optimize_meta, keyword_analysis, technical_check` };
  }
}

/* -------- Types -------- */

interface ScoreItem {
  value: number;
  status: 'good' | 'warning' | 'error';
  note: string;
}

interface MetaInput {
  title?: string;
  description?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  canonical?: string;
}

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
