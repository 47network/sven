import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import { nanoid } from 'nanoid';
import { v7 as uuidv7 } from 'uuid';
import { JSONCodec, NatsConnection } from 'nats';
import { NATS_SUBJECTS, createLogger } from '@sven/shared';
import type { EventEnvelope, RuntimeDispatchEvent } from '@sven/shared';
import { isUuid } from '../../lib/input-validation.js';
import { executePoolTransaction } from '../../services/transaction-utils.js';

const logger = createLogger('admin-workflows');
const jc = JSONCodec();

function publishRuntimeDispatch(nc: NatsConnection, data: RuntimeDispatchEvent) {
  const event: EventEnvelope<RuntimeDispatchEvent> = {
    schema_version: '1.0',
    event_id: uuidv7(),
    occurred_at: new Date().toISOString(),
    data,
  };
  nc.publish(NATS_SUBJECTS.RUNTIME_DISPATCH, jc.encode(event));
}

interface WorkflowStep {
  id: string;
  type: 'tool_call' | 'approval' | 'conditional' | 'notification' | 'data_shape' | 'llm_task';
  config: Record<string, any>;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

interface Workflow {
  id: string;
  chat_id: string;
  name: string;
  description: string;
  version: number;
  enabled: boolean;
  is_draft: boolean;
  steps: WorkflowStep[];
  edges: Array<{ from: string; to: string }>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface UpdateWorkflowRequest extends Partial<Workflow> {
  change_summary?: string;
}

interface WorkflowRun {
  id: string;
  workflow_id: string;
  workflow_version: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  started_at?: string;
  completed_at?: string;
  input_variables: Record<string, any>;
  output_variables?: Record<string, any>;
  step_results: Record<string, any>;
  canvas_event_id?: string;
}

const SUPPORTED_WORKFLOW_STEP_TYPES = new Set(['tool_call', 'approval', 'conditional', 'notification', 'data_shape', 'llm_task']);
const SUPPORTED_CONDITIONAL_OPERATORS = new Set(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']);

class WorkflowRouteError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeWorkflowBody<T extends object>(
  body: unknown,
): { ok: true; value: T } | { ok: false; message: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'request body must be a JSON object' };
  }
  return { ok: true, value: body as T };
}

function validateWorkflowDefinition(
  steps: unknown[],
  edges: unknown[],
): { ok: true } | { ok: false; message: string } {
  const stepIds = new Set<string>();
  for (const rawStep of steps) {
    if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep)) {
      return { ok: false, message: 'each step must be an object' };
    }
    const step = rawStep as Record<string, unknown>;
    const stepId = String(step.id || '').trim();
    if (!stepId) {
      return { ok: false, message: 'each step must have a non-empty id' };
    }
    if (stepIds.has(stepId)) {
      return { ok: false, message: `duplicate step id: ${stepId}` };
    }
    stepIds.add(stepId);
    const stepType = String(step.type || '').trim();
    if (!SUPPORTED_WORKFLOW_STEP_TYPES.has(stepType)) {
      return { ok: false, message: `unsupported step type: ${stepType || '(empty)'}` };
    }
    if (!step.config || typeof step.config !== 'object' || Array.isArray(step.config)) {
      return { ok: false, message: `step ${stepId} config must be an object` };
    }
    if (step.outputs !== undefined) {
      if (!step.outputs || typeof step.outputs !== 'object' || Array.isArray(step.outputs)) {
        return { ok: false, message: `step ${stepId} outputs must be an object` };
      }
      for (const [targetKey, mapping] of Object.entries(step.outputs as Record<string, unknown>)) {
        if (!String(targetKey || '').trim()) {
          return { ok: false, message: `step ${stepId} outputs contain empty target key` };
        }
        if (typeof mapping === 'string') {
          if (!mapping.trim()) {
            return { ok: false, message: `step ${stepId} output mapping for ${targetKey} must not be empty` };
          }
          continue;
        }
        if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
          return { ok: false, message: `step ${stepId} output mapping for ${targetKey} must be string or object` };
        }
        const mappingConfig = mapping as Record<string, unknown>;
        const sourceCandidate = mappingConfig.source ?? mappingConfig.path;
        if (sourceCandidate !== undefined) {
          const sourcePath = String(sourceCandidate || '').trim();
          if (!sourcePath) {
            return { ok: false, message: `step ${stepId} output mapping for ${targetKey} has invalid source/path` };
          }
        }
      }
    }
    if (stepType === 'conditional') {
      const config = step.config as Record<string, unknown>;
      if (!config.condition || typeof config.condition !== 'object' || Array.isArray(config.condition)) {
        return { ok: false, message: `step ${stepId} condition must be an object` };
      }
      const condition = config.condition as Record<string, unknown>;
      const variable = String(condition.variable || '').trim();
      const operator = String(condition.operator || '').trim();
      if (!variable) {
        return { ok: false, message: `step ${stepId} condition.variable is required` };
      }
      if (!SUPPORTED_CONDITIONAL_OPERATORS.has(operator)) {
        return { ok: false, message: `step ${stepId} condition.operator is unsupported: ${operator || '(empty)'}` };
      }
    }
    if (stepType === 'approval') {
      const config = step.config as Record<string, unknown>;
      if (config.approvers !== undefined) {
        if (!Array.isArray(config.approvers)) {
          return { ok: false, message: `step ${stepId} approvers must be an array of user ids` };
        }
        const approverIds = config.approvers
          .map((value) => String(value || '').trim())
          .filter(Boolean);
        if (approverIds.length !== config.approvers.length) {
          return { ok: false, message: `step ${stepId} approvers must contain non-empty values only` };
        }
        if (new Set(approverIds).size !== approverIds.length) {
          return { ok: false, message: `step ${stepId} approvers must be unique` };
        }
        const quorumRaw = config.quorum_required ?? config.quorum;
        if (quorumRaw !== undefined) {
          const quorum = Number(quorumRaw);
          if (!Number.isFinite(quorum) || !Number.isInteger(quorum) || quorum < 1) {
            return { ok: false, message: `step ${stepId} quorum_required must be an integer >= 1` };
          }
          if (quorum > approverIds.length) {
            return { ok: false, message: `step ${stepId} quorum_required cannot exceed approvers length` };
          }
        }
      }
    }
    if (stepType === 'llm_task') {
      const config = step.config as Record<string, unknown>;
      const prompt = String(config.prompt || '').trim();
      if (!prompt) {
        return { ok: false, message: `step ${stepId} prompt is required` };
      }
      if (config.system_prompt !== undefined && !String(config.system_prompt || '').trim()) {
        return { ok: false, message: `step ${stepId} system_prompt must not be empty when provided` };
      }
      if (config.model !== undefined && !String(config.model || '').trim()) {
        return { ok: false, message: `step ${stepId} model must not be empty when provided` };
      }
      if (config.output_key !== undefined && !String(config.output_key || '').trim()) {
        return { ok: false, message: `step ${stepId} output_key must not be empty when provided` };
      }
      if (config.temperature !== undefined) {
        const temperature = Number(config.temperature);
        if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
          return { ok: false, message: `step ${stepId} temperature must be a number between 0 and 2` };
        }
      }
      if (config.json_schema !== undefined) {
        if (!config.json_schema || typeof config.json_schema !== 'object' || Array.isArray(config.json_schema)) {
          return { ok: false, message: `step ${stepId} json_schema must be an object when provided` };
        }
      }
    }
  }

  const seenEdges = new Set<string>();
  const adjacency = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const stepId of stepIds) {
    adjacency.set(stepId, new Set());
    indegree.set(stepId, 0);
  }

  for (const rawEdge of edges) {
    if (!rawEdge || typeof rawEdge !== 'object' || Array.isArray(rawEdge)) {
      return { ok: false, message: 'each edge must be an object' };
    }
    const edge = rawEdge as Record<string, unknown>;
    const from = String(edge.from || '').trim();
    const to = String(edge.to || '').trim();
    if (!from || !to) {
      return { ok: false, message: 'each edge must include non-empty from/to step ids' };
    }
    if (!stepIds.has(from) || !stepIds.has(to)) {
      return { ok: false, message: `edge references unknown step id: ${from}->${to}` };
    }
    if (from === to) {
      return { ok: false, message: `self-edge is not allowed: ${from}` };
    }
    const edgeKey = `${from}->${to}`;
    if (seenEdges.has(edgeKey)) {
      return { ok: false, message: `duplicate edge: ${edgeKey}` };
    }
    seenEdges.add(edgeKey);
    adjacency.get(from)!.add(to);
    indegree.set(to, (indegree.get(to) || 0) + 1);
  }

  // DAG validation using Kahn's algorithm.
  const queue: string[] = [];
  for (const [stepId, degree] of indegree.entries()) {
    if (degree === 0) queue.push(stepId);
  }
  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const neighbor of adjacency.get(current) || []) {
      indegree.set(neighbor, (indegree.get(neighbor) || 1) - 1);
      if (indegree.get(neighbor) === 0) queue.push(neighbor);
    }
  }
  if (visited !== stepIds.size) {
    return { ok: false, message: 'workflow edges must form an acyclic graph' };
  }

  return { ok: true };
}

export async function registerWorkflowRoutes(app: FastifyInstance, pool: Pool, nc: NatsConnection) {
  function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
    return reply.code(statusCode).send({
      success: false,
      error: { code, message },
    });
  }
  function currentOrgId(request: any): string | null {
    return request.orgId ? String(request.orgId) : null;
  }
  async function resolveActorIdentityId(request: any, reply: FastifyReply): Promise<string | null> {
    const userId = String(request.userId || '').trim();
    if (!userId) {
      sendError(reply, 401, 'UNAUTHENTICATED', 'Authenticated actor required');
      return null;
    }
    const existing = await pool.query(
      `SELECT id
       FROM identities
       WHERE user_id = $1
       ORDER BY CASE WHEN channel = 'canvas' THEN 0 ELSE 1 END, linked_at ASC
       LIMIT 1`,
      [userId],
    );
    if (existing.rows.length > 0) {
      return String(existing.rows[0].id);
    }

    const candidateId = uuidv7();
    const inserted = await pool.query(
      `WITH created AS (
         INSERT INTO identities (id, user_id, channel, channel_user_id, display_name, linked_at)
         VALUES ($1, $2, 'canvas', $2, $3, NOW())
         ON CONFLICT (channel, channel_user_id) DO NOTHING
         RETURNING id
       )
       SELECT id FROM created
       UNION ALL
       SELECT id FROM identities WHERE channel = 'canvas' AND channel_user_id = $2
       LIMIT 1`,
      [candidateId, userId, `canvas:${userId}`],
    );
    const identityId = String(inserted.rows[0]?.id || '').trim();
    if (!identityId) {
      sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to resolve actor identity');
      return null;
    }
    return identityId;
  }
  async function getScopedRunStatus(runId: string, orgId: string): Promise<string | null> {
    const runResult = await pool.query(
      `SELECT wr.status
       FROM workflow_runs wr
       JOIN workflows w ON w.id = wr.workflow_id
       JOIN chats c ON c.id = w.chat_id
       WHERE wr.id = $1
         AND c.organization_id = $2
       LIMIT 1`,
      [runId, orgId],
    );
    if (runResult.rows.length === 0) return null;
    return String(runResult.rows[0]?.status || '').trim().toLowerCase() || null;
  }

  // ── Create Workflow ──────────────────────────────────────
  app.post<{ Body: Partial<Workflow> }>('/workflows', async (request: FastifyRequest<{ Body: Partial<Workflow> }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const bodyParsed = normalizeWorkflowBody<Partial<Workflow>>(request.body);
    if (!bodyParsed.ok) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
    }
    const { chat_id, name, description, steps, edges, is_draft } = bodyParsed.value;
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name is required' },
      });
    }
    if (!chat_id || !isUuid(String(chat_id))) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'chat_id must be a valid UUID' },
      });
    }
    if (steps !== undefined && !Array.isArray(steps)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'steps must be an array when provided' },
      });
    }
    if (edges !== undefined && !Array.isArray(edges)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'edges must be an array when provided' },
      });
    }
    if (is_draft !== undefined && typeof is_draft !== 'boolean') {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'is_draft must be a boolean when provided' },
      });
    }
    const normalizedSteps = (steps || []) as unknown[];
    const normalizedEdges = (edges || []) as unknown[];
    const graphValidation = validateWorkflowDefinition(normalizedSteps, normalizedEdges);
    if (!graphValidation.ok) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: graphValidation.message },
      });
    }
    const actorIdentityId = await resolveActorIdentityId(request as any, reply);
    if (!actorIdentityId) return;
    const draftFlag = is_draft === undefined ? false : is_draft;

    const id = `wf_${nanoid(16)}`;
    const now = new Date().toISOString();

    try {
      await executePoolTransaction(pool, async (client) => {
        const chatCheck = await client.query(
          `SELECT id FROM chats WHERE id = $1 AND organization_id = $2`,
          [chat_id, orgId],
        );
        if (chatCheck.rows.length === 0) {
          throw new WorkflowRouteError(404, 'NOT_FOUND', 'Chat not found in active account');
        }

        const createWorkflowResult = await client.query(
          `INSERT INTO workflows (id, chat_id, name, description, version, steps, edges, created_by, is_draft, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [id, chat_id, normalizedName, description || '', 1, JSON.stringify(normalizedSteps), JSON.stringify(normalizedEdges), actorIdentityId, draftFlag, now, now],
        );
        if (createWorkflowResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow create transaction invariant failed');
        }

        const versionResult = await client.query(
          `INSERT INTO workflow_versions (id, workflow_id, version, steps, edges, change_summary, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `wfv_${nanoid(16)}`,
            id,
            1,
            JSON.stringify(normalizedSteps),
            JSON.stringify(normalizedEdges),
            'Initial version',
            actorIdentityId,
            now,
          ],
        );
        if (versionResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow version transaction invariant failed');
        }

        const auditResult = await client.query(
          `INSERT INTO workflow_audit_log (id, workflow_id, action, actor_id, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [`wfa_${nanoid(16)}`, id, 'created', actorIdentityId, now],
        );
        if (auditResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow audit transaction invariant failed');
        }
      });

      logger.info('Workflow created', { id, name });
      return reply.code(201).send({ success: true, data: { id } });
    } catch (err) {
      if (err instanceof WorkflowRouteError) {
        return sendError(reply, err.statusCode, err.code, err.message);
      }
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to create workflow');
    }
  });

  // ── List Workflows ──────────────────────────────────────
  app.get<{ Querystring: { chat_id?: string; enabled?: boolean } }>('/workflows', async (request: FastifyRequest<{ Querystring: { chat_id?: string; enabled?: boolean } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { chat_id, enabled } = request.query;
    const parsedEnabled = parseBooleanQuery(enabled);
    if (parsedEnabled === 'invalid') {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean when provided' },
      });
    }

    try {
      let query = `SELECT w.*
                   FROM workflows w
                   JOIN chats c ON c.id = w.chat_id
                   WHERE c.organization_id = $1`;
      const params: any[] = [orgId];

      if (chat_id) {
        params.push(chat_id);
        query += ` AND w.chat_id = $${params.length}`;
      }
      if (parsedEnabled !== undefined) {
        params.push(parsedEnabled);
        query += ` AND w.enabled = $${params.length}`;
      }

      query += ' ORDER BY w.created_at DESC';

      const result = await pool.query(query, params);
      return reply.send({ success: true, data: result.rows });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list workflows');
    }
  });

  // ── Get Workflow ─────────────────────────────────────────
  app.get<{ Params: { id: string } }>('/workflows/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params;

    try {
      const result = await pool.query(
        `SELECT w.*
         FROM workflows w
         JOIN chats c ON c.id = w.chat_id
         WHERE w.id = $1 AND c.organization_id = $2`,
        [id, orgId],
      );
      if (result.rows.length === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Workflow not found');
      }
      return reply.send({ success: true, data: result.rows[0] });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to fetch workflow');
    }
  });

  // ── Update Workflow ──────────────────────────────────────
  app.put<{ Params: { id: string }; Body: UpdateWorkflowRequest }>('/workflows/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateWorkflowRequest }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params;
    const bodyParsed = normalizeWorkflowBody<UpdateWorkflowRequest>(request.body);
    if (!bodyParsed.ok) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
    }
    const body = bodyParsed.value;
    const { name, description, steps, edges, change_summary } = body;
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name');
    const hasSteps = Object.prototype.hasOwnProperty.call(body, 'steps');
    const hasEdges = Object.prototype.hasOwnProperty.call(body, 'edges');
    if (hasName && !String(name || '').trim()) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'name must be non-empty when provided' },
      });
    }
    if (hasSteps && !Array.isArray(steps)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'steps must be an array when provided' },
      });
    }
    if (hasEdges && !Array.isArray(edges)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'edges must be an array when provided' },
      });
    }
    const actorIdentityId = await resolveActorIdentityId(request as any, reply);
    if (!actorIdentityId) return;
    const now = new Date().toISOString();

    try {
      const newVersion = await executePoolTransaction(pool, async (client) => {
        const current = await client.query(
          `SELECT w.*
           FROM workflows w
           JOIN chats c ON c.id = w.chat_id
           WHERE w.id = $1 AND c.organization_id = $2`,
          [id, orgId],
        );
        if (current.rows.length === 0) {
          throw new WorkflowRouteError(404, 'NOT_FOUND', 'Workflow not found');
        }

        const workflow = current.rows[0];
        const computedVersion = Number(workflow.version || 0) + 1;
        const mergedSteps = (hasSteps ? steps : workflow.steps || []) as unknown[];
        const mergedEdges = (hasEdges ? edges : workflow.edges || []) as unknown[];
        const graphValidation = validateWorkflowDefinition(mergedSteps, mergedEdges);
        if (!graphValidation.ok) {
          throw new WorkflowRouteError(400, 'VALIDATION', graphValidation.message);
        }
        const nextName = hasName ? String(name || '').trim() : null;
        const nextSteps = hasSteps ? JSON.stringify(mergedSteps) : null;
        const nextEdges = hasEdges ? JSON.stringify(mergedEdges) : null;

        const updateResult = await client.query(
          `UPDATE workflows SET name = COALESCE($2, name), description = COALESCE($3, description), 
           steps = COALESCE($4, steps), edges = COALESCE($5, edges), version = $6, 
           updated_by = $7, updated_at = $8 WHERE id = $1`,
          [id, nextName, description || null, nextSteps, nextEdges, computedVersion, actorIdentityId, now],
        );
        if (updateResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow update transaction invariant failed');
        }

        const versionResult = await client.query(
          `INSERT INTO workflow_versions (id, workflow_id, version, steps, edges, change_summary, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            `wfv_${nanoid(16)}`,
            id,
            computedVersion,
            JSON.stringify(mergedSteps),
            JSON.stringify(mergedEdges),
            change_summary || 'Updated',
            actorIdentityId,
            now,
          ],
        );
        if (versionResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow version transaction invariant failed');
        }

        const auditResult = await client.query(
          `INSERT INTO workflow_audit_log (id, workflow_id, action, actor_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`wfa_${nanoid(16)}`, id, 'updated', actorIdentityId, JSON.stringify({ change_summary }), now],
        );
        if (auditResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow audit transaction invariant failed');
        }
        return computedVersion;
      });

      logger.info('Workflow updated', { id, version: newVersion });
      return reply.send({ success: true, data: { version: newVersion } });
    } catch (err) {
      if (err instanceof WorkflowRouteError) {
        return sendError(reply, err.statusCode, err.code, err.message);
      }
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to update workflow');
    }
  });

  // ── Enable/Disable Workflow ──────────────────────────────
  app.patch<{ Params: { id: string }; Body: { enabled: boolean } }>('/workflows/:id/toggle', async (request: FastifyRequest<{ Params: { id: string }; Body: { enabled: boolean } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params;
    const bodyParsed = normalizeWorkflowBody<{ enabled?: unknown }>(request.body);
    if (!bodyParsed.ok) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
    }
    const body = bodyParsed.value;
    if (typeof body.enabled !== 'boolean') {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'enabled must be a boolean' },
      });
    }
    const { enabled } = body;
    const now = new Date().toISOString();

    try {
      const updateResult = await pool.query(
        `UPDATE workflows w
         SET enabled = $2, updated_at = $3
         FROM chats c
         WHERE w.id = $1 AND c.id = w.chat_id AND c.organization_id = $4
         RETURNING w.id`,
        [id, enabled, now, orgId]
      );
      if (updateResult.rowCount === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Workflow not found');
      }
      logger.info('Workflow toggled', { id, enabled });
      return reply.send({ success: true, data: { id: String(updateResult.rows[0]?.id || id), enabled } });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to toggle workflow');
    }
  });

  // ── Delete Workflow ──────────────────────────────────────
  app.delete<{ Params: { id: string } }>('/workflows/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params;

    try {
      const deleteResult = await pool.query(
        `DELETE FROM workflows w
         USING chats c
         WHERE w.id = $1 AND c.id = w.chat_id AND c.organization_id = $2
         RETURNING w.id`,
        [id, orgId],
      );
      if (deleteResult.rowCount === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Workflow not found');
      }
      logger.info('Workflow deleted', { id });
      return reply.send({ success: true, data: { id: String(deleteResult.rows[0]?.id || id) } });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to delete workflow');
    }
  });

  // ── Execute Workflow ─────────────────────────────────────
  app.post<{ Params: { id: string }; Body: { input_variables?: Record<string, any> } }>('/workflows/:id/execute', async (request: FastifyRequest<{ Params: { id: string }; Body: { input_variables?: Record<string, any> } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { id } = request.params;
    const bodyParsed = normalizeWorkflowBody<{ input_variables?: Record<string, any> }>(request.body);
    if (!bodyParsed.ok) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION', message: bodyParsed.message } });
    }
    const { input_variables } = bodyParsed.value;
    const actorIdentityId = await resolveActorIdentityId(request as any, reply);
    if (!actorIdentityId) return;

    try {
      const run_id = `wfr_${nanoid(16)}`;
      const now = new Date().toISOString();
      let workflowVersion = 1;
      let workflowChatId = '';
      await executePoolTransaction(pool, async (client) => {
        const workflow_result = await client.query(
          `SELECT w.*
           FROM workflows w
           JOIN chats c ON c.id = w.chat_id
           WHERE w.id = $1 AND w.enabled = true AND c.organization_id = $2`,
          [id, orgId],
        );
        if (workflow_result.rows.length === 0) {
          throw new WorkflowRouteError(404, 'NOT_FOUND', 'Workflow not found or disabled');
        }
        const workflow = workflow_result.rows[0];
        workflowVersion = Number(workflow.version || 1);
        workflowChatId = String(workflow.chat_id);

        const runInsertResult = await client.query(
          `INSERT INTO workflow_runs (id, workflow_id, workflow_version, status, triggered_by, input_variables, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [run_id, id, workflow.version, 'pending', actorIdentityId, JSON.stringify(input_variables || {}), now, now],
        );
        if (runInsertResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow run transaction invariant failed');
        }

        const auditResult = await client.query(
          `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`wfa_${nanoid(16)}`, id, run_id, 'executed', actorIdentityId, now],
        );
        if (auditResult.rowCount !== 1) {
          throw new WorkflowRouteError(500, 'INTERNAL_ERROR', 'Workflow execute audit invariant failed');
        }
      });

      publishRuntimeDispatch(nc, {
        kind: 'workflow.execute',
        run_id,
        workflow_id: id,
        workflow_version: workflowVersion,
        chat_id: workflowChatId,
        user_id: actorIdentityId,
      });

      logger.info('Workflow execution started', { id, run_id });
      return reply.code(202).send({ success: true, data: { run_id } });
    } catch (err) {
      if (err instanceof WorkflowRouteError) {
        return sendError(reply, err.statusCode, err.code, err.message);
      }
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to execute workflow');
    }
  });

  // ── Get Workflow Run ─────────────────────────────────────
  app.get<{ Params: { run_id: string } }>('/workflow-runs/:run_id', async (request: FastifyRequest<{ Params: { run_id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { run_id } = request.params;

    try {
      const result = await pool.query(
        `SELECT wr.*
         FROM workflow_runs wr
         JOIN workflows w ON w.id = wr.workflow_id
         JOIN chats c ON c.id = w.chat_id
         WHERE wr.id = $1 AND c.organization_id = $2`,
        [run_id, orgId],
      );
      if (result.rows.length === 0) {
        return sendError(reply, 404, 'NOT_FOUND', 'Run not found');
      }

      const run = result.rows[0];

      // Fetch step runs
      const steps_result = await pool.query(
        `SELECT *
         FROM workflow_step_runs
         WHERE workflow_run_id = $1
         ORDER BY COALESCE(started_at, completed_at) ASC NULLS LAST, id ASC`,
        [run_id]
      );

      return reply.send({ success: true, data: { ...run, steps: steps_result.rows } });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to fetch run');
    }
  });

  // ── List Workflow Runs ───────────────────────────────────
  app.get<{ Querystring: { workflow_id?: string; status?: string; limit?: number } }>('/workflow-runs', async (request: FastifyRequest<{ Querystring: { workflow_id?: string; status?: string; limit?: number } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { workflow_id, status } = request.query;
    const limit = parseLimit((request.query as any).limit, 50, 1, 500);
    if (limit === null) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 500' },
      });
    }

    try {
      let query = `SELECT wr.*
                   FROM workflow_runs wr
                   JOIN workflows w ON w.id = wr.workflow_id
                   JOIN chats c ON c.id = w.chat_id
                   WHERE c.organization_id = $1`;
      const params: any[] = [orgId];

      if (workflow_id) {
        params.push(workflow_id);
        query += ` AND wr.workflow_id = $${params.length}`;
      }
      if (status) {
        params.push(status);
        query += ` AND wr.status = $${params.length}`;
      }

      params.push(limit);
      query += ` ORDER BY wr.created_at DESC LIMIT $${params.length}`;

      const result = await pool.query(query, params);
      return reply.send({ success: true, data: result.rows });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list runs');
    }
  });

  // ── Detect Stale Workflow Runs ───────────────────────────
  app.get<{ Querystring: { minutes?: number; limit?: number } }>('/workflows/stale-runs', async (request: FastifyRequest<{ Querystring: { minutes?: number; limit?: number } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const minutes = parseLimit((request.query as any).minutes, 30, 1, 1440);
    if (minutes === null) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'minutes must be a finite integer between 1 and 1440' },
      });
    }
    const limit = parseLimit((request.query as any).limit, 100, 1, 500);
    if (limit === null) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 500' },
      });
    }

    try {
      const result = await pool.query(
        `SELECT wr.id,
                wr.workflow_id,
                wr.status,
                wr.started_at,
                wr.created_at,
                wr.updated_at,
                COALESCE(sr.step_count, 0)::int AS step_count,
                sr.last_step_at
         FROM workflow_runs wr
         JOIN workflows w ON w.id = wr.workflow_id
         JOIN chats c ON c.id = w.chat_id
         LEFT JOIN (
           SELECT
             workflow_run_id,
             COUNT(*) AS step_count,
             MAX(COALESCE(completed_at, started_at)) AS last_step_at
           FROM workflow_step_runs
           GROUP BY workflow_run_id
         ) sr ON sr.workflow_run_id = wr.id
         WHERE c.organization_id = $1
           AND wr.status IN ('pending', 'running')
           AND COALESCE(sr.step_count, 0) = 0
           AND COALESCE(wr.started_at, wr.created_at) < NOW() - make_interval(mins => $2::int)
         ORDER BY COALESCE(wr.started_at, wr.created_at) ASC
         LIMIT $3`,
        [orgId, minutes, limit],
      );
      return reply.send({
        success: true,
        data: result.rows,
        meta: { minutes, limit, count: result.rows.length },
      });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list stale workflow runs');
    }
  });

  // Backward-compat alias expected by admin UI helper.
  app.get<{ Params: { id: string }; Querystring: { status?: string; limit?: number } }>('/workflows/:id/runs', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { status?: string; limit?: number } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const workflowId = request.params.id;
    const limit = parseLimit((request.query as any).limit, 100, 1, 500);
    if (limit === null) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION', message: 'limit must be a finite integer between 1 and 500' },
      });
    }
    const status = request.query.status;

    try {
      let query = `SELECT wr.*
                   FROM workflow_runs wr
                   JOIN workflows w ON w.id = wr.workflow_id
                   JOIN chats c ON c.id = w.chat_id
                   WHERE wr.workflow_id = $1
                     AND c.organization_id = $2`;
      const params: unknown[] = [workflowId, orgId];
      if (status) {
        params.push(status);
        query += ` AND wr.status = $${params.length}`;
      }
      params.push(limit);
      query += ` ORDER BY wr.created_at DESC LIMIT $${params.length}`;
      const result = await pool.query(query, params);
      return reply.send({ success: true, data: result.rows });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to list workflow runs');
    }
  });

  // ── Cancel Workflow Run ──────────────────────────────────
  app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/cancel', async (request: FastifyRequest<{ Params: { run_id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { run_id } = request.params;
    const now = new Date().toISOString();

    try {
      const currentStatus = await getScopedRunStatus(run_id, orgId);
      if (!currentStatus) {
        return sendError(reply, 404, 'NOT_FOUND', 'Run not found');
      }
      const cancellable = new Set(['pending', 'running', 'paused']);
      if (!cancellable.has(currentStatus)) {
        return reply.code(409).send({
          success: false,
          error: { code: 'CONFLICT', message: `Run cannot transition from ${currentStatus} to cancelled` },
          data: { current_status: currentStatus, requested_status: 'cancelled' },
        });
      }
      const updateResult = await pool.query(
        `UPDATE workflow_runs wr
         SET status = $2, completed_at = $3, updated_at = $3
         FROM workflows w, chats c
         WHERE wr.id = $1
           AND wr.status = ANY($5::text[])
           AND w.id = wr.workflow_id
           AND c.id = w.chat_id
           AND c.organization_id = $4`,
        [run_id, 'cancelled', now, orgId, Array.from(cancellable)]
      );
      if (updateResult.rowCount === 0) {
        return sendError(reply, 409, 'CONFLICT', 'Run status changed; retry with latest state');
      }
      logger.info('Workflow run cancelled', { run_id });
      return reply.send({
        success: true,
        data: {
          run_id,
          previous_status: currentStatus,
          current_status: 'cancelled',
        },
      });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to cancel run');
    }
  });

  // ── Pause Workflow Run ───────────────────────────────────
  app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/pause', async (request: FastifyRequest<{ Params: { run_id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { run_id } = request.params;
    const now = new Date().toISOString();

    try {
      const currentStatus = await getScopedRunStatus(run_id, orgId);
      if (!currentStatus) {
        return sendError(reply, 404, 'NOT_FOUND', 'Run not found');
      }
      if (currentStatus !== 'running') {
        return reply.code(409).send({
          success: false,
          error: { code: 'CONFLICT', message: `Run cannot transition from ${currentStatus} to paused` },
          data: { current_status: currentStatus, requested_status: 'paused' },
        });
      }
      const updateResult = await pool.query(
        `UPDATE workflow_runs wr
         SET status = $2, updated_at = $3
         FROM workflows w, chats c
         WHERE wr.id = $1
           AND wr.status = 'running'
           AND w.id = wr.workflow_id
           AND c.id = w.chat_id
           AND c.organization_id = $4`,
        [run_id, 'paused', now, orgId]
      );
      if (updateResult.rowCount === 0) {
        return sendError(reply, 409, 'CONFLICT', 'Run status changed; retry with latest state');
      }
      logger.info('Workflow run paused', { run_id });
      return reply.send({
        success: true,
        data: {
          run_id,
          previous_status: currentStatus,
          current_status: 'paused',
        },
      });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to pause run');
    }
  });

  // ── Resume Workflow Run ──────────────────────────────────
  app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/resume', async (request: FastifyRequest<{ Params: { run_id: string } }>, reply: FastifyReply) => {
    const orgId = currentOrgId(request as any);
    if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
    const { run_id } = request.params;
    const now = new Date().toISOString();

    try {
      const currentStatus = await getScopedRunStatus(run_id, orgId);
      if (!currentStatus) {
        return sendError(reply, 404, 'NOT_FOUND', 'Run not found');
      }
      if (currentStatus !== 'paused') {
        return reply.code(409).send({
          success: false,
          error: { code: 'CONFLICT', message: `Run cannot transition from ${currentStatus} to running` },
          data: { current_status: currentStatus, requested_status: 'running' },
        });
      }
      const updateResult = await pool.query(
        `UPDATE workflow_runs wr
         SET status = $2, updated_at = $3
         FROM workflows w, chats c
         WHERE wr.id = $1
           AND wr.status = 'paused'
           AND w.id = wr.workflow_id
           AND c.id = w.chat_id
           AND c.organization_id = $4`,
        [run_id, 'running', now, orgId]
      );
      if (updateResult.rowCount === 0) {
        return sendError(reply, 409, 'CONFLICT', 'Run status changed; retry with latest state');
      }
      logger.info('Workflow run resumed', { run_id });
      return reply.send({
        success: true,
        data: {
          run_id,
          previous_status: currentStatus,
          current_status: 'running',
        },
      });
    } catch (err) {
      app.log.error(err);
      return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to resume run');
    }
  });

  // ── Retry Failed Step ────────────────────────────────────
  app.post<{ Params: { run_id: string; step_id: string }; Body: { reason?: string } }>(
    '/workflow-runs/:run_id/steps/:step_id/retry',
    async (
      request: FastifyRequest<{ Params: { run_id: string; step_id: string }; Body: { reason?: string } }>,
      reply: FastifyReply,
    ) => {
      const orgId = currentOrgId(request as any);
      if (!orgId) return reply.code(403).send({ success: false, error: { code: 'ORG_REQUIRED', message: 'Active account required' } });
      const { run_id, step_id } = request.params;
      const actorId = await resolveActorIdentityId(request as any, reply);
      if (!actorId) return;
      const reason = String(request.body?.reason || '').trim();
      const now = new Date().toISOString();

      try {
        const runRes = await pool.query(
          `SELECT wr.id, wr.workflow_id, wr.status
           FROM workflow_runs wr
           JOIN workflows w ON w.id = wr.workflow_id
           JOIN chats c ON c.id = w.chat_id
           WHERE wr.id = $1
             AND c.organization_id = $2
           LIMIT 1`,
          [run_id, orgId],
        );
        if (runRes.rows.length === 0) {
          return sendError(reply, 404, 'NOT_FOUND', 'Run not found');
        }
        const run = runRes.rows[0];
        const runStatus = String(run.status || '');
        if (!['failed', 'paused', 'cancelled'].includes(runStatus)) {
          return sendError(reply, 409, 'CONFLICT', 'Step retry is allowed only for failed, paused, or cancelled runs');
        }

        const stepRes = await pool.query(
          `SELECT status
           FROM workflow_step_runs
           WHERE workflow_run_id = $1
             AND step_id = $2
           ORDER BY COALESCE(started_at, completed_at) DESC NULLS LAST, id DESC
           LIMIT 1`,
          [run_id, step_id],
        );
        if (stepRes.rows.length === 0) {
          return sendError(reply, 404, 'NOT_FOUND', 'Step not found for this run');
        }
        const stepStatus = String(stepRes.rows[0].status || '');
        if (stepStatus !== 'failed') {
          return sendError(reply, 409, 'CONFLICT', 'Only failed steps can be retried');
        }

        await pool.query(
          `UPDATE workflow_runs
           SET status = 'running',
               completed_at = NULL,
               updated_at = $2
           WHERE id = $1`,
          [run_id, now],
        );

        await pool.query(
          `INSERT INTO workflow_audit_log (id, workflow_id, run_id, action, actor_id, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `wfa_${nanoid(16)}`,
            String(run.workflow_id),
            run_id,
            'retry_step',
            actorId,
            JSON.stringify({ step_id, reason: reason || null }),
            now,
          ],
        );

        publishRuntimeDispatch(nc, {
          kind: 'workflow.retry_step',
          run_id,
          step_id,
          workflow_id: String(run.workflow_id),
          user_id: actorId,
        });

        logger.info('Workflow step retry requested', { run_id, step_id, actor_id: actorId });
        return reply.code(202).send({ success: true, data: { run_id, step_id, status: 'retry_queued' } });
      } catch (err) {
        app.log.error(err);
        return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to retry workflow step');
      }
    },
  );
}

function parseBooleanQuery(value: unknown): boolean | undefined | 'invalid' {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return 'invalid';
}

function parseLimit(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
}
