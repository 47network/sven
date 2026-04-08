import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { createLogger } from '@sven/shared';
import { EmotionalIntelligenceService } from '../../services/EmotionalIntelligenceService.js';
import { UserReasoningService } from '../../services/UserReasoningService.js';
import { MemoryConsentService } from '../../services/MemoryConsentService.js';
import { BrainVisualizationService } from '../../services/BrainVisualizationService.js';
import { createMemoryAdapter } from '../../services/MemoryStore.js';

const logger = createLogger('admin-brain');

function requireOrgId(request: any, reply: any): string | null {
  const orgId = request.orgId ? String(request.orgId) : null;
  if (!orgId) {
    reply.status(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active organization required' } });
    return null;
  }
  return orgId;
}

function requireUserId(request: any, reply: any): string | null {
  const userId = request.userId ? String(request.userId) : null;
  if (!userId) {
    reply.status(401).send({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session required' } });
    return null;
  }
  return userId;
}

function parseBool(value: unknown, defaultValue = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return defaultValue;
}

export async function registerBrainRoutes(app: FastifyInstance, pool: pg.Pool) {
  const emotionalService = new EmotionalIntelligenceService(pool);
  const reasoningService = new UserReasoningService(pool);
  const consentService = new MemoryConsentService(pool);
  const brainVizService = new BrainVisualizationService(pool);
  const memoryAdapter = createMemoryAdapter(pool);

  // ─── Brain Visualization ────────────────────────────────────────────────

  app.get('/brain/graph', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { include_archived?: string; user_id?: string };
    const targetUserId = query.user_id || userId;

    let qfConfig;
    if ('getQuantumFadeConfig' in memoryAdapter && typeof (memoryAdapter as any).getQuantumFadeConfig === 'function') {
      qfConfig = await (memoryAdapter as any).getQuantumFadeConfig(orgId);
    }

    const graph = await brainVizService.getBrainGraph({
      user_id: targetUserId,
      organization_id: orgId,
      include_archived: parseBool(query.include_archived),
      qfConfig,
    });

    return reply.send({ success: true, data: graph });
  });

  app.post('/brain/decay-trajectory', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Request body required' } });
    }

    const trajectory = brainVizService.getDecayTrajectory({
      gamma: Number(body.gamma || 0.05),
      amplitude: Number(body.amplitude || 0.3),
      omega: Number(body.omega || 0.5),
      phase_offset: Number(body.phase_offset || 0),
      resonance_boost_count: Number(body.resonance_boost_count || 0),
      resonance_factor: Number(body.resonance_factor || 0.2),
      days: Number(body.days || 90),
    });

    return reply.send({ success: true, data: { points: trajectory } });
  });

  // ─── Quantum Fade Config ────────────────────────────────────────────────

  app.get('/memory/quantum-fade-config', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    if ('getQuantumFadeConfig' in memoryAdapter && typeof (memoryAdapter as any).getQuantumFadeConfig === 'function') {
      const config = await (memoryAdapter as any).getQuantumFadeConfig(orgId);
      return reply.send({ success: true, data: config });
    }

    return reply.status(501).send({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Quantum fade not available on current adapter' } });
  });

  app.put('/memory/quantum-fade-config', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;

    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Request body required' } });
    }

    const gamma_base = Math.max(0.001, Math.min(1, Number(body.gamma_base || 0.05)));
    const amplitude = Math.max(0, Math.min(1, Number(body.amplitude || 0.3)));
    const omega = Math.max(0.01, Math.min(10, Number(body.omega || 0.5)));
    const consolidation_threshold = Math.max(0.01, Math.min(0.5, Number(body.consolidation_threshold || 0.15)));
    const resonance_factor = Math.max(0, Math.min(1, Number(body.resonance_factor || 0.2)));
    const consolidation_interval_hours = Math.max(1, Math.min(168, Number(body.consolidation_interval_hours || 6)));
    const max_memory_budget_mb = Math.max(64, Math.min(8192, Number(body.max_memory_budget_mb || 512)));

    await pool.query(
      `INSERT INTO quantum_fade_config
       (id, organization_id, gamma_base, amplitude, omega, consolidation_threshold,
        resonance_factor, consolidation_interval_hours, max_memory_budget_mb)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (organization_id)
       DO UPDATE SET
         gamma_base = EXCLUDED.gamma_base,
         amplitude = EXCLUDED.amplitude,
         omega = EXCLUDED.omega,
         consolidation_threshold = EXCLUDED.consolidation_threshold,
         resonance_factor = EXCLUDED.resonance_factor,
         consolidation_interval_hours = EXCLUDED.consolidation_interval_hours,
         max_memory_budget_mb = EXCLUDED.max_memory_budget_mb,
         updated_at = NOW()`,
      [orgId, gamma_base, amplitude, omega, consolidation_threshold, resonance_factor, consolidation_interval_hours, max_memory_budget_mb],
    );

    logger.info('Quantum fade config updated', { organization_id: orgId });

    return reply.send({
      success: true,
      data: { gamma_base, amplitude, omega, consolidation_threshold, resonance_factor, consolidation_interval_hours, max_memory_budget_mb },
    });
  });

  // ─── Emotional Intelligence ─────────────────────────────────────────────

  app.get('/emotional/history', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { user_id?: string; chat_id?: string; limit?: string; offset?: string };
    const targetUserId = query.user_id || userId;

    const result = await emotionalService.getHistory({
      user_id: targetUserId,
      organization_id: orgId,
      chat_id: query.chat_id || null,
      limit: Number(query.limit || 20),
      offset: Number(query.offset || 0),
    });

    return reply.send({ success: true, data: result.rows, meta: { total: result.total } });
  });

  app.get('/emotional/summary', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { user_id?: string; days?: string };
    const targetUserId = query.user_id || userId;

    const summary = await emotionalService.getSummary({
      user_id: targetUserId,
      organization_id: orgId,
      days: Number(query.days || 30),
    });

    return reply.send({ success: true, data: summary });
  });

  // ─── User Reasoning ─────────────────────────────────────────────────────

  app.post('/reasoning', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Request body required' } });
    }

    if (!body.topic || !body.user_choice || !body.reasoning) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'topic, user_choice, and reasoning are required' },
      });
    }

    // Check consent
    const consented = await consentService.isFeatureConsented(userId, orgId, 'reasoning_capture');
    if (!consented) {
      return reply.status(403).send({
        success: false,
        error: { code: 'CONSENT_DENIED', message: 'User has not consented to reasoning capture' },
      });
    }

    const record = await reasoningService.recordReasoning({
      user_id: userId,
      organization_id: orgId,
      chat_id: body.chat_id || null,
      topic: String(body.topic),
      user_choice: String(body.user_choice),
      sven_suggestion: body.sven_suggestion ? String(body.sven_suggestion) : null,
      reasoning: String(body.reasoning),
      expertise_area: body.expertise_area ? String(body.expertise_area) : null,
      pattern_tags: Array.isArray(body.pattern_tags) ? body.pattern_tags : [],
    });

    return reply.status(201).send({ success: true, data: record });
  });

  app.get('/reasoning', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { user_id?: string; topic?: string; limit?: string; offset?: string };
    const targetUserId = query.user_id || userId;

    const result = await reasoningService.listReasoning({
      user_id: targetUserId,
      organization_id: orgId,
      topic: query.topic,
      limit: Number(query.limit || 20),
      offset: Number(query.offset || 0),
    });

    return reply.send({ success: true, data: result.rows, meta: { total: result.total } });
  });

  app.get('/reasoning/understanding', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const query = request.query as { user_id?: string; dimension?: string };
    const targetUserId = query.user_id || userId;

    const records = await reasoningService.getUnderstanding({
      user_id: targetUserId,
      organization_id: orgId,
      dimension: query.dimension,
    });

    return reply.send({ success: true, data: records });
  });

  // ─── Memory Consent (GDPR) ─────────────────────────────────────────────

  app.get('/memory/consent', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const consent = await consentService.getConsent(userId, orgId);
    return reply.send({ success: true, data: consent });
  });

  app.put('/memory/consent', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION', message: 'Request body required' } });
    }

    const consent = await consentService.updateConsent(userId, orgId, {
      consent_given: body.consent_given !== undefined ? parseBool(body.consent_given) : undefined,
      consent_scope: body.consent_scope,
      retention_days: body.retention_days !== undefined ? (body.retention_days === null ? null : Number(body.retention_days)) : undefined,
      allow_consolidation: body.allow_consolidation !== undefined ? parseBool(body.allow_consolidation) : undefined,
      allow_emotional_tracking: body.allow_emotional_tracking !== undefined ? parseBool(body.allow_emotional_tracking) : undefined,
      allow_reasoning_capture: body.allow_reasoning_capture !== undefined ? parseBool(body.allow_reasoning_capture) : undefined,
    });

    return reply.send({ success: true, data: consent });
  });

  app.get('/memory/export', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const data = await consentService.exportUserData(userId, orgId);
    return reply.send({ success: true, data });
  });

  app.post('/memory/forget', async (request, reply) => {
    const orgId = requireOrgId(request, reply);
    if (!orgId) return;
    const userId = requireUserId(request, reply);
    if (!userId) return;

    const result = await consentService.forgetUser(userId, orgId);

    logger.info('User data erased via admin API', { user_id: userId, organization_id: orgId, ...result });

    return reply.send({ success: true, data: result });
  });
}
