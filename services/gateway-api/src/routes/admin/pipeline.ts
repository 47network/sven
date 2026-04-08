import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { ImageProcessingService } from '../../services/ImageProcessingService.js';
import { AudioScribeService } from '../../services/AudioScribeService.js';
import { DeviceActionService } from '../../services/DeviceActionService.js';

/**
 * Admin routes for 6.12 Image Processing Pipeline, 6.14 Audio Scribe,
 * 6.15 Mobile Actions / Device Control.
 */
export async function registerPipelineRoutes(app: FastifyInstance): Promise<void> {
  const pool = (app as unknown as { pg: pg.Pool }).pg;
  const imageSvc = new ImageProcessingService(pool);
  const scribeSvc = new AudioScribeService(pool);
  const actionSvc = new DeviceActionService(pool);

  // ── 6.12  Image Processing ──────────────────────────────────

  app.get('/pipeline/image/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await imageSvc.getPolicy(orgId);
    return { success: true, data: policy };
  });

  app.put('/pipeline/image/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await imageSvc.updatePolicy(orgId, req.body as any);
    return { success: true, data: policy };
  });

  app.post('/pipeline/image/submit', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { image_ref, category, context } = req.body as any;
    if (!image_ref || !category) return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'image_ref and category required' } });
    const job = await imageSvc.submitJob(orgId, userId, image_ref, category, context);
    return { success: true, data: job };
  });

  app.post('/pipeline/image/:jobId/complete', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { result_summary, result_data, processing_ms, model_used } = req.body as any;
    const job = await imageSvc.completeJob(req.params.jobId, result_summary, result_data || {}, processing_ms || 0, model_used || 'unknown');
    return { success: true, data: job };
  });

  app.post('/pipeline/image/:jobId/escalate', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { reason } = req.body as any;
    const job = await imageSvc.escalateJob(req.params.jobId, reason || 'Manual escalation');
    return { success: true, data: job };
  });

  app.get('/pipeline/image/jobs', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { status, category, limit, offset } = req.query as any;
    const result = await imageSvc.listJobs(orgId, {
      status: status || undefined,
      category: category || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return { success: true, data: result };
  });

  app.get('/pipeline/image/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await imageSvc.getStats(orgId);
    return { success: true, data: stats };
  });

  app.get('/pipeline/image/categories', async () => {
    return { success: true, data: ImageProcessingService.getCategories() };
  });

  // ── 6.14  Audio Scribe ──────────────────────────────────────

  app.get('/pipeline/scribe/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const config = await scribeSvc.getConfig(orgId);
    return { success: true, data: config };
  });

  app.put('/pipeline/scribe/config', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const config = await scribeSvc.updateConfig(orgId, req.body as any);
    return { success: true, data: config };
  });

  app.post('/pipeline/scribe/start', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { source, estimated_duration_seconds } = req.body as any;
    if (!source) return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'source required' } });
    const session = await scribeSvc.startSession(orgId, userId, source, estimated_duration_seconds);
    return { success: true, data: session };
  });

  app.post('/pipeline/scribe/:sessionId/complete', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { transcript, language_detected, confidence, processing_ms, model_used, actual_duration_seconds } = req.body as any;
    if (!transcript) return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'transcript required' } });
    const session = await scribeSvc.completeSession(
      req.params.sessionId, transcript, language_detected || 'en',
      confidence || 0.9, processing_ms || 0, model_used || 'faster-whisper',
      actual_duration_seconds,
    );
    return { success: true, data: session };
  });

  app.post('/pipeline/scribe/:sessionId/fail', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { reason } = req.body as any;
    const session = await scribeSvc.failSession(req.params.sessionId, reason || 'Unknown error');
    return { success: true, data: session };
  });

  app.get('/pipeline/scribe/sessions', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { status, source, limit, offset } = req.query as any;
    const result = await scribeSvc.listSessions(orgId, {
      status: status || undefined,
      source: source || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return { success: true, data: result };
  });

  app.get('/pipeline/scribe/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await scribeSvc.getStats(orgId);
    return { success: true, data: stats };
  });

  app.get('/pipeline/scribe/languages', async () => {
    return { success: true, data: AudioScribeService.getHighAccuracyLanguages() };
  });

  // ── 6.15  Device Actions ────────────────────────────────────

  app.post('/pipeline/actions/seed', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const actions = await actionSvc.seedActions(orgId);
    return { success: true, data: actions };
  });

  app.post('/pipeline/actions/register', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const action = await actionSvc.registerAction(orgId, req.body as any);
    return { success: true, data: action };
  });

  app.get('/pipeline/actions', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { category, platform, active_only } = req.query as any;
    const actions = await actionSvc.listActions(orgId, {
      category: category || undefined,
      platform: platform || undefined,
      activeOnly: active_only !== 'false',
    });
    return { success: true, data: actions };
  });

  app.put('/pipeline/actions/:actionId/toggle', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { active } = req.body as any;
    await actionSvc.toggleAction(orgId, req.params.actionId, active !== false);
    return { success: true, data: { toggled: true } };
  });

  app.delete('/pipeline/actions/:actionId', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    await actionSvc.deleteAction(orgId, req.params.actionId);
    return { success: true, data: { deleted: true } };
  });

  app.post('/pipeline/actions/:actionId/execute', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    const userId = String(req.userId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { device_id, params: inputParams } = req.body as any;
    if (!device_id) return reply.status(400).send({ success: false, error: { code: 'MISSING_FIELDS', message: 'device_id required' } });
    const execution = await actionSvc.executeAction(orgId, userId, req.params.actionId, device_id, inputParams || {});
    return { success: true, data: execution };
  });

  app.post('/pipeline/actions/executions/:executionId/complete', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { result, execution_ms } = req.body as any;
    const execution = await actionSvc.completeExecution(req.params.executionId, result || {}, execution_ms || 0);
    return { success: true, data: execution };
  });

  app.post('/pipeline/actions/executions/:executionId/fail', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { error_message } = req.body as any;
    const execution = await actionSvc.failExecution(req.params.executionId, error_message || 'Unknown error');
    return { success: true, data: execution };
  });

  app.get('/pipeline/actions/executions', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const { action_id, device_id, status, limit, offset } = req.query as any;
    const result = await actionSvc.listExecutions(orgId, {
      actionId: action_id || undefined,
      deviceId: device_id || undefined,
      status: status || undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return { success: true, data: result };
  });

  app.get('/pipeline/actions/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await actionSvc.getPolicy(orgId);
    return { success: true, data: policy };
  });

  app.put('/pipeline/actions/policy', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const policy = await actionSvc.updatePolicy(orgId, req.body as any);
    return { success: true, data: policy };
  });

  app.get('/pipeline/actions/stats', async (req: any, reply) => {
    const orgId = String(req.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED' } });
    const stats = await actionSvc.getStats(orgId);
    return { success: true, data: stats };
  });

  app.get('/pipeline/actions/builtins', async () => {
    return { success: true, data: DeviceActionService.getBuiltinActions() };
  });
}
