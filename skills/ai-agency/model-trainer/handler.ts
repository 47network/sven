// ---------------------------------------------------------------------------
// Model Trainer Skill Handler
// ---------------------------------------------------------------------------
// Dispatches to the model trainer engine for fine-tuning pipeline management.
// ---------------------------------------------------------------------------

import {
  createTrainingJob,
  getTrainingJob,
  listTrainingJobs,
  cancelTrainingJob,
  listRecipes,
  listExports,
  getTrainerStats,
  type TrainingConfig,
  type TrainingDataSource,
  type TrainingSample,
  type TrainingStatus,
  type RecipeDomain,
} from '../../../services/agent-runtime/src/model-trainer';

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'create_job': {
      const orgId = (input.org_id as string) || 'default';
      const userId = input.user_id as string | undefined;
      const recipe = input.recipe as RecipeDomain | undefined;
      const config = input.config as Partial<TrainingConfig> | undefined;
      const dataSources = (input.data_sources as TrainingDataSource[]) || [];
      const samples = input.samples as TrainingSample[] | undefined;

      if (!dataSources.length && (!samples || !samples.length)) {
        return { error: 'Either data_sources or samples is required to start training.' };
      }

      const job = createTrainingJob({ orgId, userId, recipe, config, dataSources, samples });

      return {
        result: {
          job_id: job.id,
          status: job.status,
          recipe: job.recipe,
          base_model: job.config.baseModel,
          method: job.config.method,
          sample_count: job.sampleCount,
          train_samples: job.trainSamples,
          eval_samples: job.evalSamples,
          config: {
            epochs: job.config.epochs,
            batchSize: job.config.batchSize,
            learningRate: job.config.learningRate,
            loraRank: job.config.lora.rank,
            quantBits: job.config.lora.quantBits,
          },
          message: `Training job ${job.id} created. Use compute-mesh to execute.`,
        },
      };
    }

    case 'get_job': {
      const jobId = input.job_id as string;
      if (!jobId) return { error: 'job_id is required.' };

      const job = getTrainingJob(jobId);
      if (!job) return { error: `Training job ${jobId} not found.` };

      return {
        result: {
          id: job.id,
          status: job.status,
          recipe: job.recipe,
          base_model: job.config.baseModel,
          progress: job.totalSteps > 0 ? Math.round((job.currentStep / job.totalSteps) * 100) : 0,
          current_step: job.currentStep,
          total_steps: job.totalSteps,
          current_epoch: job.currentEpoch,
          latest_loss: job.metrics.length > 0 ? job.metrics[job.metrics.length - 1].trainLoss : null,
          evaluation: job.evaluation
            ? {
                improvement: job.evaluation.improvement,
                perplexity: job.evaluation.perplexity,
                baseline_score: job.evaluation.baselineScore,
                finetune_score: job.evaluation.finetuneScore,
              }
            : null,
          output_model: job.outputModelName,
          error: job.errorMessage,
          started_at: job.startedAt,
          completed_at: job.completedAt,
        },
      };
    }

    case 'list_jobs': {
      const orgId = (input.org_id as string) || 'default';
      const statusFilter = input.status_filter as TrainingStatus | undefined;
      const jobs = listTrainingJobs(orgId, statusFilter);

      return {
        result: {
          count: jobs.length,
          jobs: jobs.map((j) => ({
            id: j.id,
            status: j.status,
            recipe: j.recipe,
            base_model: j.config.baseModel,
            sample_count: j.sampleCount,
            current_step: j.currentStep,
            created_at: j.createdAt,
          })),
        },
      };
    }

    case 'cancel_job': {
      const jobId = input.job_id as string;
      if (!jobId) return { error: 'job_id is required.' };

      const cancelled = cancelTrainingJob(jobId);
      if (!cancelled) return { error: `Could not cancel job ${jobId}. It may not exist or is already finished.` };

      return { result: { job_id: jobId, status: 'cancelled', message: 'Training job cancelled.' } };
    }

    case 'list_recipes': {
      const recipes = listRecipes();
      return {
        result: {
          count: recipes.length,
          recipes: recipes.map((r) => ({
            domain: r.domain,
            name: r.name,
            description: r.description,
            base_model: r.baseModel,
            epochs: r.config.epochs,
            evaluation_prompts: r.evaluationPrompts.length,
          })),
        },
      };
    }

    case 'list_exports': {
      const exports = listExports();
      return {
        result: {
          count: exports.length,
          exports: exports.map((e) => ({
            job_id: e.jobId,
            base_model: e.baseModel,
            model_name: e.litellmModelName,
            adapter_path: e.adapterPath,
            registered_at: e.registeredAt,
          })),
        },
      };
    }

    case 'get_stats': {
      const stats = getTrainerStats();
      return { result: stats };
    }

    default:
      return {
        error: `Unknown action "${action}". Valid: create_job, get_job, list_jobs, cancel_job, list_recipes, list_exports, get_stats`,
      };
  }
}
