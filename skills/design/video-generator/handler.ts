/**
 * Video Generator skill handler.
 *
 * Actions: create_video, list_templates, render, get_status, cancel, preview, get_stats
 */

import {
  createRenderJob,
  getRenderJob,
  cancelRenderJob,
  listRenderJobs,
  listTemplates,
  getTemplate,
  specFromTemplate,
  textToVideoSpec,
  validateSpec,
  computeDuration,
  getVideoStats,
  buildPreviewArgs,
  type VideoSpec,
  type TemplateDomain,
  type AspectRatio,
  type VideoSpecProvider,
} from '../../../services/agent-runtime/src/video-engine';

// ---------------------------------------------------------------------------
// Stub provider for text-to-spec (real impl would use LLMRouter)
// ---------------------------------------------------------------------------

const stubProvider: VideoSpecProvider = {
  async complete(prompt: string): Promise<string> {
    // In production this delegates to the agent-runtime LLM router.
    // The skill handler is invoked by the skill runner which has LLM access.
    return JSON.stringify({
      title: 'Generated Video',
      description: prompt.slice(0, 200),
      width: 1920,
      height: 1080,
      fps: 30,
      bgColor: '#1a1a2e',
      format: 'mp4',
      quality: 23,
      scenes: [],
    });
  },
};

export default async function handler(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const action = String(input.action ?? 'list_templates');

  switch (action) {
    // -----------------------------------------------------------------------
    case 'create_video': {
      const description = input.description as string | undefined;
      if (!description || description.trim().length === 0) {
        return { error: 'description is required for create_video action' };
      }

      const templateDomain = input.template as TemplateDomain | undefined;
      const aspectRatio = (input.aspect_ratio as AspectRatio) || '16:9';
      const orgId = String(input.org_id ?? 'default');
      const userId = String(input.user_id ?? 'system');

      let spec: VideoSpec;

      if (templateDomain) {
        const tpl = getTemplate(templateDomain);
        if (!tpl) {
          return { error: `unknown template: ${templateDomain}` };
        }
        // Use template as base, let NL description refine it in the future
        spec = specFromTemplate(templateDomain, {
          title: description.slice(0, 100),
          description,
        });
      } else {
        // Full NL-to-spec pipeline
        spec = await textToVideoSpec(description, stubProvider, aspectRatio);
      }

      const errors = validateSpec(spec);
      if (errors.length > 0) {
        return { error: `invalid video spec: ${errors.join('; ')}` };
      }

      const job = createRenderJob(orgId, userId, spec, templateDomain);

      return {
        result: {
          action: 'create_video',
          jobId: job.id,
          status: job.status,
          title: spec.title,
          duration: computeDuration(spec),
          scenes: spec.scenes.length,
          template: templateDomain ?? 'custom',
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'render': {
      const specInput = input.spec as VideoSpec | undefined;
      if (!specInput) {
        return { error: 'spec is required for render action' };
      }

      const orgId = String(input.org_id ?? 'default');
      const userId = String(input.user_id ?? 'system');

      const errors = validateSpec(specInput);
      if (errors.length > 0) {
        return { error: `invalid video spec: ${errors.join('; ')}` };
      }

      const job = createRenderJob(orgId, userId, specInput);

      return {
        result: {
          action: 'render',
          jobId: job.id,
          status: job.status,
          duration: computeDuration(specInput),
          scenes: specInput.scenes.length,
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'get_status': {
      const jobId = input.job_id as string | undefined;
      if (!jobId) {
        return { error: 'job_id is required for get_status action' };
      }

      const job = getRenderJob(jobId);
      if (!job) {
        return { error: `render job not found: ${jobId}` };
      }

      return {
        result: {
          action: 'get_status',
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          outputPath: job.outputPath,
          outputSize: job.outputSize,
          error: job.error,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
          startedAt: job.startedAt?.toISOString(),
          completedAt: job.completedAt?.toISOString(),
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'cancel': {
      const jobId = input.job_id as string | undefined;
      if (!jobId) {
        return { error: 'job_id is required for cancel action' };
      }

      const cancelled = cancelRenderJob(jobId);
      return {
        result: {
          action: 'cancel',
          jobId,
          cancelled,
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'preview': {
      const specInput = input.spec as VideoSpec | undefined;
      const templateDomain = input.template as TemplateDomain | undefined;

      let spec: VideoSpec;
      if (specInput) {
        spec = specInput;
      } else if (templateDomain) {
        spec = specFromTemplate(templateDomain);
      } else {
        return { error: 'spec or template is required for preview action' };
      }

      const previewArgs = buildPreviewArgs(spec, '/tmp/preview.png');
      return {
        result: {
          action: 'preview',
          ffmpegArgs: previewArgs,
          width: spec.width,
          height: spec.height,
          scenes: spec.scenes.length,
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'list_templates': {
      const templates = listTemplates();
      return {
        result: {
          action: 'list_templates',
          templates: templates.map(t => ({
            domain: t.domain,
            name: t.name,
            description: t.description,
            aspectRatio: t.aspectRatio,
            scenes: t.defaultSpec.scenes.length,
            duration: computeDuration(t.defaultSpec),
          })),
          count: templates.length,
        },
      };
    }

    // -----------------------------------------------------------------------
    case 'get_stats': {
      const stats = getVideoStats();
      return {
        result: {
          action: 'get_stats',
          ...stats,
        },
      };
    }

    // -----------------------------------------------------------------------
    default:
      return { error: `unknown action: ${action}` };
  }
}
