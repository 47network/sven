import {
  deliberate,
  mergeConfig,
  getSession,
  listSessions,
  getStats,
  type CouncilConfig,
  type LLMCompletionProvider,
} from '../../../services/agent-runtime/src/llm-council.js';

/**
 * LLM Council Skill Handler
 *
 * Actions:
 * - deliberate: Run a multi-model deliberation on a query
 * - configure_council: Validate and preview a council configuration
 * - get_history: Retrieve past deliberation sessions
 * - get_stats: Get aggregate council usage statistics
 *
 * NOTE: The actual LLM provider is injected by the skill-runner at runtime
 * via input.__llm_provider. If unavailable, returns an error.
 */
export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'deliberate': {
      const query = input.query as string;
      if (!query || query.trim().length < 3) {
        return { error: 'A query of at least 3 characters is required for deliberation' };
      }

      const provider = input.__llm_provider as LLMCompletionProvider | undefined;
      if (!provider) {
        return { error: 'LLM provider not available. Council requires runtime LLM access.' };
      }

      const configPartial: Partial<CouncilConfig> = {};
      if (input.models && Array.isArray(input.models)) configPartial.models = input.models as string[];
      if (input.chairman) configPartial.chairman = input.chairman as string;
      if (typeof input.anonymize === 'boolean') configPartial.anonymize = input.anonymize;
      if (typeof input.rounds === 'number') configPartial.rounds = Math.min(Math.max(1, input.rounds), 5);
      if (input.strategy) configPartial.strategy = input.strategy as CouncilConfig['strategy'];

      const config = mergeConfig(configPartial);
      if (config.models.length < 2) {
        return { error: 'Council requires at least 2 models' };
      }

      const result = await deliberate(provider, {
        query,
        systemPrompt: input.system_prompt as string | undefined,
        config,
        sessionId: input.session_id as string | undefined,
      });

      return { result };
    }

    case 'configure_council': {
      const configPartial: Partial<CouncilConfig> = {};
      if (input.models && Array.isArray(input.models)) configPartial.models = input.models as string[];
      if (input.chairman) configPartial.chairman = input.chairman as string;
      if (typeof input.anonymize === 'boolean') configPartial.anonymize = input.anonymize;
      if (typeof input.rounds === 'number') configPartial.rounds = input.rounds;
      if (input.strategy) configPartial.strategy = input.strategy as CouncilConfig['strategy'];

      const config = mergeConfig(configPartial);
      return {
        result: {
          config,
          validation: {
            valid: config.models.length >= 2,
            modelCount: config.models.length,
            chairmanIncluded: config.models.includes(config.chairman),
            warnings: [
              ...(config.models.length < 2 ? ['Need at least 2 models for deliberation'] : []),
              ...(config.rounds > 3 ? ['More than 3 rounds increases cost significantly'] : []),
              ...(!config.models.includes(config.chairman)
                ? ['Chairman model not in council — it will only synthesize, not opine']
                : []),
            ],
          },
        },
      };
    }

    case 'get_history': {
      const sessionId = input.session_id as string | undefined;
      if (sessionId) {
        const session = getSession(sessionId);
        if (!session) return { error: `Session "${sessionId}" not found` };
        return {
          result: {
            id: session.id,
            query: session.query,
            synthesis: session.synthesis,
            opinions: session.opinions.map((o) => ({
              model: o.modelName,
              response: o.response.slice(0, 500),
              latencyMs: o.latencyMs,
              error: o.error,
            })),
            peerReviewCount: session.peerReviews.length,
            totalTokens: session.totalTokens,
            totalCost: session.totalCost,
            elapsedMs: session.elapsedMs,
            createdAt: session.createdAt,
          },
        };
      }
      const sessions = listSessions(20);
      return {
        result: {
          count: sessions.length,
          sessions: sessions.map((s) => ({
            id: s.id,
            query: s.query.slice(0, 100),
            modelCount: s.opinions.length,
            elapsedMs: s.elapsedMs,
            totalCost: s.totalCost,
            createdAt: s.createdAt,
          })),
        },
      };
    }

    case 'get_stats': {
      return { result: getStats() };
    }

    default:
      return {
        error: `Unknown action "${action}". Use: deliberate, configure_council, get_history, get_stats`,
      };
  }
}
