// ---------------------------------------------------------------------------
// Evolution Engine Skill Handler
// ---------------------------------------------------------------------------
// Dispatches to the evolution engine for self-improving algorithm evolution.
// ---------------------------------------------------------------------------

import {
  startEvolution,
  stopEvolution,
  getRun,
  listRuns,
  getBestNode,
  injectKnowledge,
  listTemplates,
  getTemplate,
  getEvolutionStats,
  type ExperimentTemplate,
  type ExperimentDomain,
  type EvolutionConfig,
} from '../../../services/agent-runtime/src/evolution-engine';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'start_evolution': {
      const domain = input.domain as ExperimentDomain | undefined;
      const experimentOverride = input.experiment as Partial<ExperimentTemplate> | undefined;
      const configOverride = input.config as Partial<EvolutionConfig> | undefined;
      const orgId = (input.org_id as string) || 'default';
      const userId = input.user_id as string | undefined;

      if (!domain && !experimentOverride) {
        return { error: 'Either domain or experiment is required to start evolution.' };
      }

      // Build experiment from template + overrides
      let experiment: ExperimentTemplate;
      if (domain && domain !== 'custom') {
        experiment = { ...getTemplate(domain), ...experimentOverride };
      } else if (experimentOverride) {
        if (!experimentOverride.description || !experimentOverride.baselineCode) {
          return { error: 'Custom experiments require at least description and baselineCode.' };
        }
        experiment = {
          domain: 'custom',
          name: experimentOverride.name || 'Custom Experiment',
          description: experimentOverride.description,
          evaluatorCode: experimentOverride.evaluatorCode || '',
          baselineCode: experimentOverride.baselineCode,
          cognitionSeeds: experimentOverride.cognitionSeeds || [],
          config: experimentOverride.config || {},
        };
      } else {
        return { error: 'Invalid experiment configuration.' };
      }

      const run = startEvolution({ orgId, userId, experiment, config: configOverride });

      return {
        result: {
          run_id: run.id,
          status: run.status,
          domain: run.experiment.domain,
          config: {
            maxGenerations: run.config.maxGenerations,
            populationSize: run.config.populationSize,
            samplingStrategy: run.config.samplingStrategy,
          },
          cognition_seeds: run.cognition.length,
          message: `Evolution run ${run.id} created. Use the evolution engine service to execute the loop.`,
        },
      };
    }

    case 'stop_evolution': {
      const runId = input.run_id as string;
      if (!runId) return { error: 'run_id is required.' };

      const stopped = stopEvolution(runId);
      if (!stopped) return { error: `Could not stop run ${runId}. It may not exist or is already finished.` };

      return { result: { run_id: runId, status: 'stopped', message: 'Evolution run stopped.' } };
    }

    case 'get_run': {
      const runId = input.run_id as string;
      if (!runId) return { error: 'run_id is required.' };

      const run = getRun(runId);
      if (!run) return { error: `Run ${runId} not found.` };

      return {
        result: {
          id: run.id,
          domain: run.experiment.domain,
          status: run.status,
          currentGeneration: run.currentGeneration,
          maxGenerations: run.config.maxGenerations,
          bestScore: run.bestScore,
          bestNodeId: run.bestNodeId,
          totalEvaluations: run.totalEvaluations,
          nodeCount: run.nodes.length,
          cognitionCount: run.cognition.length,
          config: run.config,
          startedAt: run.startedAt,
          updatedAt: run.updatedAt,
          completedAt: run.completedAt,
          error: run.error,
        },
      };
    }

    case 'list_runs': {
      const limit = (input.limit as number) || 20;
      const runs = listRuns(limit);

      return {
        result: {
          runs: runs.map((r) => ({
            id: r.id,
            domain: r.experiment.domain,
            name: r.experiment.name,
            status: r.status,
            generation: `${r.currentGeneration}/${r.config.maxGenerations}`,
            bestScore: r.bestScore,
            totalEvaluations: r.totalEvaluations,
            updatedAt: r.updatedAt,
          })),
          total: runs.length,
        },
      };
    }

    case 'get_best': {
      const runId = input.run_id as string;
      if (!runId) return { error: 'run_id is required.' };

      const run = getRun(runId);
      if (!run) return { error: `Run ${runId} not found.` };

      const best = getBestNode(runId);
      if (!best) return { error: `No best node found for run ${runId}. The run may not have started.` };

      return {
        result: {
          run_id: runId,
          domain: run.experiment.domain,
          node_id: best.id,
          generation: best.generation,
          score: best.score,
          metrics: best.metrics,
          code: best.code,
          analysis: best.analysis,
          parent_id: best.parentId,
        },
      };
    }

    case 'inject_knowledge': {
      const runId = input.run_id as string;
      const title = input.title as string;
      const content = input.content as string;

      if (!runId) return { error: 'run_id is required.' };
      if (!title || !content) return { error: 'title and content are required.' };

      const injected = injectKnowledge(runId, title, content);
      if (!injected) return { error: `Run ${runId} not found.` };

      return { result: { run_id: runId, message: `Knowledge "${title}" injected into cognition store.` } };
    }

    case 'list_templates': {
      const templates = listTemplates();
      return {
        result: {
          templates: templates.map((t) => ({
            domain: t.domain,
            name: t.name,
            description: t.description,
            cognition_seeds: t.cognitionSeeds.length,
            default_config: t.config,
          })),
          total: templates.length,
        },
      };
    }

    case 'get_stats': {
      return { result: getEvolutionStats() };
    }

    default:
      return { error: `Unknown action "${action}". Available: start_evolution, stop_evolution, get_run, list_runs, get_best, inject_knowledge, list_templates, get_stats` };
  }
}
