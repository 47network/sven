import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { NatsConnection } from 'nats';
import { AgentPersonaService } from '../../services/AgentPersonaService.js';
import { AgentProtocolService } from '../../services/AgentProtocolService.js';
import { AgentRateLimitService } from '../../services/AgentRateLimitService.js';
import { AgentModeratorService } from '../../services/AgentModeratorService.js';
import { TransparencyChangelogService } from '../../services/TransparencyChangelogService.js';
import { ConfidenceScoringService } from '../../services/ConfidenceScoringService.js';
import { FeedbackRoutingService } from '../../services/FeedbackRoutingService.js';
import { CorrectionPipelineService } from '../../services/CorrectionPipelineService.js';
import { PatternObservationService } from '../../services/PatternObservationService.js';

export async function registerCommunityAgentRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  nc: NatsConnection,
): Promise<void> {
  const personaSvc = new AgentPersonaService(pool);
  const protocolSvc = new AgentProtocolService(pool, nc);
  const rateLimitSvc = new AgentRateLimitService(pool);
  const moderatorSvc = new AgentModeratorService(pool);
  const changelogSvc = new TransparencyChangelogService(pool);
  const confidenceSvc = new ConfidenceScoringService(pool);
  const feedbackSvc = new FeedbackRoutingService(pool);
  const correctionSvc = new CorrectionPipelineService(pool);
  const patternSvc = new PatternObservationService(pool);

  // ── Agent Persona Endpoints ──────────────────────────────────────────

  app.post('/community-agents/personas', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    body.organization_id = orgId;
    const result = await personaSvc.createPersona(body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/personas', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await personaSvc.listPersonas(orgId, {
      type: q.type,
      status: q.status,
      communityVisible: q.community_visible === 'true' ? true : q.community_visible === 'false' ? false : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/personas/:agentId/status', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const { status } = request.body as any;
    const result = await personaSvc.updatePersonaStatus(agentId, orgId, status);
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/personas/:agentId/visibility', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const { visible } = request.body as any;
    const result = await personaSvc.setCommunityVisibility(agentId, orgId, visible);
    return reply.send({ success: true, data: result });
  });

  app.put('/community-agents/personas/:agentId', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const body = request.body as any;
    const result = await personaSvc.updatePersona(agentId, orgId, body);
    return reply.send({ success: true, data: result });
  });

  // ── Agent Protocol Endpoints ─────────────────────────────────────────

  app.post('/community-agents/messages', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    body.organization_id = orgId;
    const result = await protocolSvc.sendMessage(body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/messages/:agentId/inbox', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const q = request.query as any;
    const result = await protocolSvc.getAgentInbox(orgId, agentId, {
      status: q.status,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  app.get('/community-agents/messages/thread/:threadId', async (request: any, reply) => {
    const { threadId } = request.params as any;
    const q = request.query as any;
    const orgId = String(request.orgId || '');
    const result = await protocolSvc.getThread(orgId, threadId,
      q.limit ? parseInt(q.limit, 10) : undefined,
      q.offset ? parseInt(q.offset, 10) : undefined,
    );
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/messages/:messageId/read', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { messageId } = request.params as any;
    const { agentId } = request.body as any;
    await protocolSvc.markRead(orgId, messageId, agentId);
    return reply.send({ success: true });
  });

  // ── Rate Limit Endpoints ─────────────────────────────────────────────

  app.get('/community-agents/rate-limits/:agentId', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const result = await rateLimitSvc.getOrCreateConfig(agentId, orgId);
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/rate-limits/:agentId', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { agentId } = request.params as any;
    const body = request.body as any;
    const result = await rateLimitSvc.updateConfig(agentId, orgId, body);
    return reply.send({ success: true, data: result });
  });

  // ── Moderation Endpoints ─────────────────────────────────────────────

  app.get('/community-agents/moderation/pending', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await moderatorSvc.getPendingReviews(orgId,
      q.limit ? parseInt(q.limit, 10) : undefined,
      q.offset ? parseInt(q.offset, 10) : undefined,
    );
    return reply.send({ success: true, data: result });
  });

  app.post('/community-agents/moderation/:decisionId/review', async (request: any, reply) => {
    const { decisionId } = request.params as any;
    const body = request.body as any;
    const reviewerId = String(request.userId || '');
    const result = await moderatorSvc.reviewDecision(decisionId, reviewerId, body.decision, body.explanation);
    return reply.send({ success: true, data: result });
  });

  // ── Transparency Changelog Endpoints ─────────────────────────────────

  app.post('/community-agents/changelog', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    const result = await changelogSvc.createEntry(orgId, body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/changelog', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await changelogSvc.listEntries(orgId, {
      entry_type: q.type,
      visibility: q.visibility,
      published_only: q.published_only === 'true',
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/changelog/:entryId/publish', async (request: any, reply) => {
    const { entryId } = request.params as any;
    const orgId = String(request.orgId || '');
    const result = await changelogSvc.publishEntry(orgId, entryId);
    return reply.send({ success: true, data: result });
  });

  // ── Confidence Scoring Endpoints ─────────────────────────────────────

  app.get('/community-agents/confidence/calibration', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await confidenceSvc.getCalibrationMetrics(orgId, q.days ? parseInt(q.days, 10) : undefined);
    return reply.send({ success: true, data: result });
  });

  app.get('/community-agents/confidence/low', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await confidenceSvc.getLowConfidenceResponses(orgId,
      q.limit ? parseInt(q.limit, 10) : undefined,
      q.offset ? parseInt(q.offset, 10) : undefined,
    );
    return reply.send({ success: true, data: result });
  });

  // ── Feedback Routing Endpoints ───────────────────────────────────────

  app.post('/community-agents/feedback/signal', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    const result = await feedbackSvc.recordSignal(orgId, body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/feedback/model-recommendations', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await feedbackSvc.getModelRecommendations(orgId, q.task_type, q.min_signals ? parseInt(q.min_signals, 10) : undefined);
    return reply.send({ success: true, data: result });
  });

  app.get('/community-agents/feedback/skill-recommendations', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await feedbackSvc.getSkillRecommendations(orgId, q.task_type, q.min_signals ? parseInt(q.min_signals, 10) : undefined);
    return reply.send({ success: true, data: result });
  });

  app.get('/community-agents/feedback/task-summary', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await feedbackSvc.getTaskTypeSummary(orgId, q.days ? parseInt(q.days, 10) : undefined);
    return reply.send({ success: true, data: result });
  });

  // ── Correction Pipeline Endpoints ────────────────────────────────────

  app.post('/community-agents/corrections', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    body.user_id = String(request.userId || '');
    const result = await correctionSvc.submitCorrection(orgId, body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/corrections', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await correctionSvc.list(orgId, {
      status: q.status,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  app.post('/community-agents/corrections/:correctionId/verify', async (request: any, reply) => {
    const { correctionId } = request.params as any;
    const result = await correctionSvc.verify(correctionId);
    return reply.send({ success: true, data: result });
  });

  app.post('/community-agents/corrections/:correctionId/promote', async (request: any, reply) => {
    const { correctionId } = request.params as any;
    const result = await correctionSvc.promoteToMemory(correctionId);
    return reply.send({ success: true, data: result });
  });

  // ── Pattern Observation Endpoints ────────────────────────────────────

  app.post('/community-agents/patterns', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const body = request.body as any;
    const result = await patternSvc.observe(orgId, body);
    return reply.status(201).send({ success: true, data: result });
  });

  app.get('/community-agents/patterns', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await patternSvc.list(orgId, {
      type: q.type,
      status: q.status,
      minOccurrences: q.min_occurrences ? parseInt(q.min_occurrences, 10) : undefined,
      limit: q.limit ? parseInt(q.limit, 10) : undefined,
      offset: q.offset ? parseInt(q.offset, 10) : undefined,
    });
    return reply.send({ success: true, data: result });
  });

  app.patch('/community-agents/patterns/:patternId/status', async (request: any, reply) => {
    const { patternId } = request.params as any;
    const { status } = request.body as any;
    const result = await patternSvc.updateStatus(patternId, status);
    return reply.send({ success: true, data: result });
  });

  // ── Self-Improvement Dashboard Endpoints ─────────────────────────────

  app.get('/community-agents/self-improvement/snapshots', async (request: any, reply) => {
    const orgId = String(request.orgId || '');
    if (!orgId) return reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const q = request.query as any;
    const result = await patternSvc.getSelfImprovementSnapshot(orgId, q.days ? parseInt(q.days, 10) : undefined);
    return reply.send({ success: true, data: result });
  });
}
