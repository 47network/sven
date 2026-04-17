import {
  classifyImpact,
  scoreSentiment,
  extractEntities,
  processNewsItem,
  buildNewsAnalysisPrompt,
  IMPACT_LABELS,
  type NewsSource,
  type ImpactLevel,
} from '@sven/trading-platform/news';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'analyze': {
      const headline = input.headline as string;
      const body = (input.body as string) ?? '';
      const source = ((input.source as string) ?? 'newsapi') as NewsSource;
      const url = (input.url as string) ?? '';

      if (!headline) return { error: 'Missing headline' };

      const processed = processNewsItem(source, headline, body, url);

      return {
        result: {
          id: processed.event.id,
          headline: processed.event.headline,
          impact: { level: processed.impact.level, label: IMPACT_LABELS[processed.impact.level] },
          sentiment: processed.sentimentScore.toFixed(3),
          entities: processed.entities,
          isDuplicate: processed.isDuplicate,
          requiresLlm: processed.impact.level >= 3,
        },
      };
    }

    case 'classify': {
      const headline = input.headline as string;
      const body = (input.body as string) ?? '';
      if (!headline) return { error: 'Missing headline' };

      const impact = classifyImpact(headline, body);
      return { result: { impactLevel: impact.level, category: impact.category, label: IMPACT_LABELS[impact.level] } };
    }

    case 'sentiment': {
      const text = `${(input.headline as string) ?? ''} ${(input.body as string) ?? ''}`.trim();
      if (!text) return { error: 'Missing headline or body' };
      const score = scoreSentiment(text);
      const label = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral';
      return { result: { score: score.toFixed(3), label } };
    }

    case 'entities': {
      const headline = (input.headline as string) ?? '';
      const body = (input.body as string) ?? '';
      if (!headline && !body) return { error: 'Missing headline or body' };
      const entities = extractEntities(headline, body);
      return { result: { entities } };
    }

    case 'llm_analysis': {
      const headline = input.headline as string;
      const body = (input.body as string) ?? '';
      if (!headline) return { error: 'Missing headline' };

      const impact = classifyImpact(headline, body);
      if (impact.level < 3) {
        return { result: { skipped: true, reason: `Impact level ${impact.level} (${IMPACT_LABELS[impact.level]}) below LLM analysis threshold (3+)` } };
      }

      const positions = (input.positions as { symbol: string; side: string; pnl: number }[]) ?? [];
      const predictions = (input.predictions as { symbol: string; direction: string; confidence: number }[]) ?? [];
      const prompt = buildNewsAnalysisPrompt(headline, positions, predictions);
      return { result: { prompt, impactLevel: impact.level, category: impact.category, note: 'Send this prompt to Sven LLM for full analysis' } };
    }

    default:
      return { error: `Unknown action "${action}". Use: analyze, classify, sentiment, entities, llm_analysis` };
  }
}
