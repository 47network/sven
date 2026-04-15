import {
  deliberate,
  mergeConfig,
  getSession,
  listSessions,
  getStats,
  _gatherOpinions,
  _conductPeerReview,
  _buildPeerReviewPrompt,
  _parsePeerReviewResponse,
  _buildSynthesisPrompt,
  _aggregateScores,
  _estimateCost,
  type LLMCompletionProvider,
  type CouncilConfig,
  type ModelOpinion,
  type PeerReview,
} from '../llm-council';

/* ------------------------------------------------------------------ mocks */

function createMockProvider(responses?: Record<string, string>): LLMCompletionProvider {
  const defaultResponses: Record<string, string> = {
    'model-a': 'Response from model A about the topic.',
    'model-b': 'Response from model B with a different perspective.',
    'model-c': 'Response from model C providing another viewpoint.',
  };
  const effectiveResponses = responses || defaultResponses;

  return {
    async complete(params) {
      const text = effectiveResponses[params.model]
        || `Default response from ${params.model}`;

      // Simulate peer review JSON if the prompt contains "peer reviewer"
      const isReview = params.messages.some((m) => m.content.includes('peer reviewer'));
      if (isReview) {
        return {
          text: JSON.stringify([
            { candidate: 'Candidate A', rank: 1, score: 9, rationale: 'Best coverage' },
            { candidate: 'Candidate B', rank: 2, score: 7, rationale: 'Good but less detailed' },
            { candidate: 'Candidate C', rank: 3, score: 6, rationale: 'Adequate' },
          ]),
          tokensUsed: { prompt: 200, completion: 100 },
        };
      }

      // Simulate synthesis if the prompt contains "chairman"
      const isSynthesis = params.messages.some((m) => m.content.includes('chairman'));
      if (isSynthesis) {
        return {
          text: 'Synthesized answer combining the best elements from all models.',
          tokensUsed: { prompt: 500, completion: 200 },
        };
      }

      return {
        text,
        tokensUsed: { prompt: 100, completion: 50 },
      };
    },
  };
}

function createFailingProvider(failModels: string[]): LLMCompletionProvider {
  return {
    async complete(params) {
      if (failModels.includes(params.model)) {
        throw new Error(`Model ${params.model} is unavailable`);
      }
      return {
        text: `Response from ${params.model}`,
        tokensUsed: { prompt: 100, completion: 50 },
      };
    },
  };
}

/* ------------------------------------------------------------------ tests */

describe('llm-council', () => {
  describe('mergeConfig', () => {
    it('returns defaults when no overrides', () => {
      const config = mergeConfig({});
      expect(config.models).toHaveLength(3);
      expect(config.anonymize).toBe(true);
      expect(config.rounds).toBe(1);
      expect(config.strategy).toBe('weighted');
      expect(config.timeoutMs).toBe(120_000);
    });

    it('overrides specific fields', () => {
      const config = mergeConfig({
        models: ['model-x', 'model-y'],
        strategy: 'majority_vote',
        rounds: 3,
      });
      expect(config.models).toEqual(['model-x', 'model-y']);
      expect(config.strategy).toBe('majority_vote');
      expect(config.rounds).toBe(3);
      expect(config.anonymize).toBe(true); // unchanged
    });
  });

  describe('gatherOpinions (Stage 1)', () => {
    it('gathers opinions from all models in parallel', async () => {
      const provider = createMockProvider();
      const opinions = await _gatherOpinions(
        provider, 'What is TypeScript?', undefined, ['model-a', 'model-b'], 30_000,
      );
      expect(opinions).toHaveLength(2);
      expect(opinions[0].modelName).toBe('model-a');
      expect(opinions[0].response).toContain('model A');
      expect(opinions[0].tokensUsed.prompt).toBe(100);
      expect(opinions[0].latencyMs).toBeGreaterThanOrEqual(0);
      expect(opinions[0].error).toBeUndefined();
    });

    it('captures errors without crashing', async () => {
      const provider = createFailingProvider(['model-b']);
      const opinions = await _gatherOpinions(
        provider, 'Test query', undefined, ['model-a', 'model-b'], 30_000,
      );
      expect(opinions).toHaveLength(2);
      expect(opinions[0].response).toBeTruthy();
      expect(opinions[1].error).toContain('unavailable');
      expect(opinions[1].response).toBe('');
    });

    it('includes system prompt when provided', async () => {
      let capturedMessages: any[] = [];
      const provider: LLMCompletionProvider = {
        async complete(params) {
          capturedMessages = params.messages;
          return { text: 'ok', tokensUsed: { prompt: 10, completion: 5 } };
        },
      };
      await _gatherOpinions(provider, 'Question', 'Be helpful', ['m'], 30_000);
      expect(capturedMessages[0]).toEqual({ role: 'system', content: 'Be helpful' });
      expect(capturedMessages[1]).toEqual({ role: 'user', content: 'Question' });
    });
  });

  describe('buildPeerReviewPrompt', () => {
    it('anonymizes candidate names by default', () => {
      const opinions: ModelOpinion[] = [
        { modelName: 'secret-model-1', response: 'Resp 1', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
        { modelName: 'secret-model-2', response: 'Resp 2', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
      ];
      const prompt = _buildPeerReviewPrompt(opinions, 'Test Q', true);
      expect(prompt).toContain('Candidate A');
      expect(prompt).toContain('Candidate B');
      expect(prompt).not.toContain('secret-model-1');
      expect(prompt).not.toContain('secret-model-2');
    });

    it('reveals model names when anonymize=false', () => {
      const opinions: ModelOpinion[] = [
        { modelName: 'model-x', response: 'Resp 1', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
      ];
      const prompt = _buildPeerReviewPrompt(opinions, 'Q', false);
      expect(prompt).toContain('model-x');
    });

    it('filters out errored opinions', () => {
      const opinions: ModelOpinion[] = [
        { modelName: 'm1', response: 'Good', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
        { modelName: 'm2', response: '', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0, error: 'fail' },
      ];
      const prompt = _buildPeerReviewPrompt(opinions, 'Q', true);
      expect(prompt).toContain('Candidate A');
      // The responses section should only include the valid opinion
      const responsesSection = prompt.split('**Responses to evaluate:**')[1]?.split('For each candidate')[0] || '';
      expect(responsesSection).toContain('Good');
      expect(responsesSection).not.toContain('m2');
    });
  });

  describe('parsePeerReviewResponse', () => {
    it('parses valid JSON array', () => {
      const text = '[{"candidate": "A", "rank": 1, "score": 9, "rationale": "Best"}]';
      const rankings = _parsePeerReviewResponse(text, 2);
      expect(rankings).toHaveLength(1);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[0].score).toBe(9);
    });

    it('extracts JSON from markdown code block', () => {
      const text = '```json\n[{"candidate": "X", "rank": 1, "score": 8, "rationale": "Good"}]\n```';
      const rankings = _parsePeerReviewResponse(text, 1);
      expect(rankings).toHaveLength(1);
      expect(rankings[0].score).toBe(8);
    });

    it('clamps scores to 0-10', () => {
      const text = '[{"candidate": "A", "rank": 1, "score": 15, "rationale": "..."}]';
      const rankings = _parsePeerReviewResponse(text, 1);
      expect(rankings[0].score).toBe(10);
    });

    it('returns empty array for invalid input', () => {
      expect(_parsePeerReviewResponse('not json', 2)).toEqual([]);
      expect(_parsePeerReviewResponse('{}', 2)).toEqual([]);
    });

    it('truncates rationale to 500 chars', () => {
      const longRationale = 'x'.repeat(1000);
      const text = `[{"candidate": "A", "rank": 1, "score": 5, "rationale": "${longRationale}"}]`;
      const rankings = _parsePeerReviewResponse(text, 1);
      expect(rankings[0].rationale.length).toBe(500);
    });
  });

  describe('aggregateScores', () => {
    const makeOpinions = (count: number): ModelOpinion[] =>
      Array.from({ length: count }, (_, i) => ({
        modelName: `model-${i}`,
        response: `Response ${i}`,
        tokensUsed: { prompt: 0, completion: 0 },
        latencyMs: 0,
      }));

    it('returns equal scores when no reviews exist', () => {
      const scores = _aggregateScores(makeOpinions(3), [], 'weighted');
      expect(scores.get('Candidate A')).toBe(5);
      expect(scores.get('Candidate B')).toBe(5);
    });

    it('weighted strategy averages scores', () => {
      const reviews: PeerReview[] = [
        {
          reviewerModel: 'm1',
          rankings: [
            { candidateLabel: 'Candidate A', rank: 1, score: 9, rationale: '' },
            { candidateLabel: 'Candidate B', rank: 2, score: 6, rationale: '' },
          ],
          tokensUsed: { prompt: 0, completion: 0 },
        },
        {
          reviewerModel: 'm2',
          rankings: [
            { candidateLabel: 'Candidate A', rank: 1, score: 8, rationale: '' },
            { candidateLabel: 'Candidate B', rank: 2, score: 7, rationale: '' },
          ],
          tokensUsed: { prompt: 0, completion: 0 },
        },
      ];
      const scores = _aggregateScores(makeOpinions(2), reviews, 'weighted');
      expect(scores.get('Candidate A')).toBe(8.5);
      expect(scores.get('Candidate B')).toBe(6.5);
    });

    it('best_of_n takes max score per candidate', () => {
      const reviews: PeerReview[] = [
        {
          reviewerModel: 'm1',
          rankings: [{ candidateLabel: 'Candidate A', rank: 1, score: 6, rationale: '' }],
          tokensUsed: { prompt: 0, completion: 0 },
        },
        {
          reviewerModel: 'm2',
          rankings: [{ candidateLabel: 'Candidate A', rank: 1, score: 9, rationale: '' }],
          tokensUsed: { prompt: 0, completion: 0 },
        },
      ];
      const scores = _aggregateScores(makeOpinions(1), reviews, 'best_of_n');
      expect(scores.get('Candidate A')).toBe(9);
    });

    it('majority_vote counts rank-1 votes', () => {
      const reviews: PeerReview[] = [
        {
          reviewerModel: 'm1',
          rankings: [
            { candidateLabel: 'Candidate A', rank: 1, score: 9, rationale: '' },
            { candidateLabel: 'Candidate B', rank: 2, score: 7, rationale: '' },
          ],
          tokensUsed: { prompt: 0, completion: 0 },
        },
        {
          reviewerModel: 'm2',
          rankings: [
            { candidateLabel: 'Candidate A', rank: 2, score: 6, rationale: '' },
            { candidateLabel: 'Candidate B', rank: 1, score: 8, rationale: '' },
          ],
          tokensUsed: { prompt: 0, completion: 0 },
        },
      ];
      const scores = _aggregateScores(makeOpinions(2), reviews, 'majority_vote');
      expect(scores.get('Candidate A')).toBe(1);
      expect(scores.get('Candidate B')).toBe(1);
    });
  });

  describe('estimateCost', () => {
    it('calculates cost based on token counts', () => {
      const cost = _estimateCost({ prompt: 1000, completion: 1000 });
      expect(cost).toBeCloseTo(0.002, 4);
    });

    it('returns 0 for no tokens', () => {
      expect(_estimateCost({ prompt: 0, completion: 0 })).toBe(0);
    });
  });

  describe('deliberate (full flow)', () => {
    it('runs full 3-stage deliberation', async () => {
      const provider = createMockProvider();
      const config = mergeConfig({
        models: ['model-a', 'model-b', 'model-c'],
        chairman: 'model-a',
      });

      const result = await deliberate(provider, {
        query: 'What is the best database for real-time apps?',
        config,
      });

      expect(result.sessionId).toBeTruthy();
      expect(result.synthesis).toBeTruthy();
      expect(result.opinions.length).toBeGreaterThanOrEqual(2);
      expect(result.modelCount).toBe(3);
      expect(result.strategy).toBe('weighted');
      expect(result.totalTokens.prompt).toBeGreaterThan(0);
      expect(result.totalTokens.completion).toBeGreaterThan(0);
      expect(result.totalCost).toBeGreaterThan(0);
      expect(result.elapsedMs).toBeGreaterThanOrEqual(0);

      // Session should be stored
      const session = getSession(result.sessionId);
      expect(session).toBeDefined();
      expect(session?.query).toContain('best database');
    });

    it('handles all models failing gracefully', async () => {
      const provider = createFailingProvider(['model-a', 'model-b']);
      const config = mergeConfig({ models: ['model-a', 'model-b'], chairman: 'model-a' });

      const result = await deliberate(provider, { query: 'test', config });
      expect(result.synthesis).toContain('failed to respond');
      expect(result.opinions).toHaveLength(0);
    });

    it('synthesizes with partial model failures', async () => {
      const provider = createFailingProvider(['model-b']);
      const config = mergeConfig({
        models: ['model-a', 'model-b', 'model-c'],
        chairman: 'model-a',
      });

      const result = await deliberate(provider, { query: 'test partial failure', config });
      expect(result.opinions.length).toBeGreaterThanOrEqual(1);
      expect(result.synthesis).toBeTruthy();
    });

    it('respects multiple rounds of peer review', async () => {
      const provider = createMockProvider();
      const config = mergeConfig({
        models: ['model-a', 'model-b'],
        chairman: 'model-a',
        rounds: 2,
      });

      const result = await deliberate(provider, { query: 'multi-round test', config });
      // 2 rounds × 2 models = 4 reviews
      expect(result.peerReviews.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('session management', () => {
    it('lists sessions in reverse chronological order', () => {
      const sessions = listSessions(10);
      expect(sessions.length).toBeGreaterThan(0);
      for (let i = 1; i < sessions.length; i++) {
        expect(sessions[i - 1].createdAt >= sessions[i].createdAt).toBe(true);
      }
    });

    it('getStats returns aggregate statistics', () => {
      const stats = getStats();
      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.totalTokens.prompt).toBeGreaterThan(0);
      expect(stats.avgElapsedMs).toBeGreaterThanOrEqual(0);
      expect(typeof stats.modelUsage).toBe('object');
    });
  });

  describe('buildSynthesisPrompt', () => {
    it('includes all opinions and reviews in synthesis prompt', () => {
      const opinions: ModelOpinion[] = [
        { modelName: 'model-a', response: 'Opinion A text', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
        { modelName: 'model-b', response: 'Opinion B text', tokensUsed: { prompt: 0, completion: 0 }, latencyMs: 0 },
      ];
      const reviews: PeerReview[] = [
        {
          reviewerModel: 'model-a',
          rankings: [
            { candidateLabel: 'Candidate A', rank: 2, score: 7, rationale: 'Good' },
            { candidateLabel: 'Candidate B', rank: 1, score: 9, rationale: 'Better' },
          ],
          tokensUsed: { prompt: 0, completion: 0 },
        },
      ];
      const config = mergeConfig({ models: ['model-a', 'model-b'] });
      const prompt = _buildSynthesisPrompt(opinions, reviews, 'Test question', config);

      expect(prompt).toContain('Test question');
      expect(prompt).toContain('Candidate A');
      expect(prompt).toContain('Opinion A text');
      expect(prompt).toContain('score 9');
    });
  });
});
