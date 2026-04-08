import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPool } from '../../db/pool.js';
import {
  extractEntities,
  extractRelations,
  storeEntities,
  storeRelations,
  storeEvidence,
  createExtractionJob,
  updateJobStatus,
  getGraphStats,
} from '../../services/KnowledgeGraphService.js';
import {
  buildGraphContext,
  createCitedResponse,
  formatCitations,
  verifyClaim,
  augmentRAGWithGraphContext,
} from '../../services/KnowledgeGraphContextService.js';
import { nanoid } from 'nanoid';

interface EntityCreateRequest {
  type: string;
  name: string;
  description?: string;
  confidence: number;
  metadata?: any;
}

interface RelationCreateRequest {
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
  metadata?: any;
}

interface EvidenceCreateRequest {
  entity_id?: string;
  relation_id?: string;
  content_type: string;
  source_id: string;
  source_chat_id: string;
  quote?: string;
  context: string;
}

interface ExtractionRequest {
  chat_id: string;
  message_id?: string;
  text: string;
  job_type: 'entity' | 'relation' | 'full_analysis';
}

const pool = getPool();

export async function registerKnowledgeGraphRoutes(
  fastify: FastifyInstance
): Promise<void> {
  function isSchemaCompatError(err: unknown): boolean {
    const code = String((err as { code?: string })?.code || '');
    return code === '42P01' || code === '42703';
  }

  function contradictionPair(a: string, b: string): boolean {
    const left = String(a || '').trim().toLowerCase();
    const right = String(b || '').trim().toLowerCase();
    if (!left || !right) return false;
    const pair = `${left}|${right}`;
    const known = new Set([
      'supports|opposes',
      'opposes|supports',
      'likes|dislikes',
      'dislikes|likes',
      'enabled|disabled',
      'disabled|enabled',
      'active|inactive',
      'inactive|active',
      'true|false',
      'false|true',
      'allow|deny',
      'deny|allow',
    ]);
    return known.has(pair);
  }

  function parsePositiveLimit(
    raw: unknown,
    options?: { defaultValue?: number; max?: number },
  ): { ok: true; value: number } | { ok: false; message: string } {
    const defaultValue = options?.defaultValue ?? 50;
    const max = options?.max ?? 100;
    const value = raw === undefined ? defaultValue : Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      return { ok: false, message: 'limit must be a positive integer when provided' };
    }
    return { ok: true, value: Math.min(value, max) };
  }

  function parseNonNegativeOffset(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
    const value = raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      return { ok: false, message: 'offset must be a non-negative integer when provided' };
    }
    return { ok: true, value };
  }

  type DuplicateGroup = {
    normalized_name: string;
    type: string;
    ids: string[];
  };

  type RelationRow = {
    id: string;
    source_entity_id: string;
    target_entity_id: string;
    relation_type: string;
    confidence: number;
  };

  // ===== ENTITY ENDPOINTS =====

  /**
   * POST /knowledge-graph/entities
   * Create a new entity
   */
  fastify.post<{ Body: EntityCreateRequest }>(
    '/knowledge-graph/entities',
    async (
      request: FastifyRequest<{ Body: EntityCreateRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const { type, name, description, confidence, metadata } = request.body;

        if (!type || !name || confidence === undefined) {
          return reply.status(400).send({
            error: 'Missing required fields: type, name, confidence',
          });
        }

        if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
          return reply.status(400).send({ error: 'confidence must be a number between 0 and 1' });
        }
        if (String(name).length > 1000) {
          return reply.status(400).send({ error: 'name must be 1000 characters or fewer' });
        }
        if (description && String(description).length > 10_000) {
          return reply.status(400).send({ error: 'description must be 10000 characters or fewer' });
        }
        if (metadata && JSON.stringify(metadata).length > 100_000) {
          return reply.status(400).send({ error: 'metadata too large' });
        }

        const id = nanoid();
        const result = await pool.query(
          `INSERT INTO kg_entities (id, type, name, description, confidence, created_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [id, type, name, description || null, confidence, 'system', JSON.stringify(metadata)]
        );

        return reply.status(201).send(result.rows[0]);
      } catch (error) {
        console.error('Failed to create entity:', error);
        return reply.status(500).send({ error: 'Failed to create entity' });
      }
    }
  );

  /**
   * GET /knowledge-graph/entities
   * List all entities with optional filtering
   */
  fastify.get<{ Querystring: { type?: string; limit?: string; offset?: string } }>(
    '/knowledge-graph/entities',
    async (
      request: FastifyRequest<{
        Querystring: { type?: string; limit?: string; offset?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const type = request.query.type;
        const limitParsed = parsePositiveLimit(request.query.limit, { defaultValue: 50, max: 100 });
        if (!limitParsed.ok) {
          return reply.status(400).send({ error: limitParsed.message });
        }
        const offsetParsed = parseNonNegativeOffset(request.query.offset);
        if (!offsetParsed.ok) {
          return reply.status(400).send({ error: offsetParsed.message });
        }
        const limit = limitParsed.value;
        const offset = offsetParsed.value;

        let query = 'SELECT * FROM kg_entities WHERE 1=1';
        const params: (string | number)[] = [];

        if (type) {
          query += ` AND type = $${params.length + 1}`;
          params.push(type);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        const countResult = await pool.query(
          `SELECT COUNT(*) as total FROM kg_entities WHERE 1=1 ${type ? `AND type = $1` : ''}`,
          type ? [type] : []
        );

        return reply.send({
          entities: result.rows,
          total: parseInt(countResult.rows[0]?.total || 0),
          limit,
          offset,
        });
      } catch (error) {
        console.error('Failed to list entities:', error);
        return reply.status(500).send({ error: 'Failed to list entities' });
      }
    }
  );

  /**
   * GET /knowledge-graph/entities/:id
   * Get a specific entity with its relations
   */
  fastify.get<{ Params: { id: string } }>(
    '/knowledge-graph/entities/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const entity = await pool.query(
          'SELECT * FROM kg_entities WHERE id = $1',
          [request.params.id]
        );

        if (entity.rows.length === 0) {
          return reply.status(404).send({ error: 'Entity not found' });
        }

        // Get incoming and outgoing relations
        const relations = await pool.query(
          `SELECT * FROM kg_relations WHERE source_entity_id = $1 OR target_entity_id = $1`,
          [request.params.id]
        );

        // Get evidence
        const evidence = await pool.query(
          `SELECT * FROM kg_evidence WHERE entity_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [request.params.id]
        );

        return reply.send({
          entity: entity.rows[0],
          relations: relations.rows,
          evidence: evidence.rows,
        });
      } catch (error) {
        console.error('Failed to get entity:', error);
        return reply.status(500).send({ error: 'Failed to get entity' });
      }
    }
  );

  /**
   * PUT /knowledge-graph/entities/:id
   * Update an entity
   */
  fastify.put<{ Params: { id: string }; Body: Partial<EntityCreateRequest> }>(
    '/knowledge-graph/entities/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: Partial<EntityCreateRequest> }>,
      reply: FastifyReply
    ) => {
      try {
        const { type, name, description, confidence, metadata } = request.body;

        const result = await pool.query(
          `UPDATE kg_entities
           SET type = COALESCE($1, type),
               name = COALESCE($2, name),
               description = COALESCE($3, description),
               confidence = COALESCE($4, confidence),
               metadata = COALESCE($5, metadata),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6
           RETURNING *`,
          [type, name, description, confidence, metadata ? JSON.stringify(metadata) : null, request.params.id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Entity not found' });
        }

        return reply.send(result.rows[0]);
      } catch (error) {
        console.error('Failed to update entity:', error);
        return reply.status(500).send({ error: 'Failed to update entity' });
      }
    }
  );

  /**
   * DELETE /knowledge-graph/entities/:id
   * Delete an entity and its relations
   */
  fastify.delete<{ Params: { id: string } }>(
    '/knowledge-graph/entities/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Delete evidence
        await client.query('DELETE FROM kg_evidence WHERE entity_id = $1', [request.params.id]);

        // Delete relations
        await client.query(
          'DELETE FROM kg_relations WHERE source_entity_id = $1 OR target_entity_id = $1',
          [request.params.id]
        );

        // Delete entity
        const result = await client.query(
          'DELETE FROM kg_entities WHERE id = $1 RETURNING id',
          [request.params.id]
        );

        await client.query('COMMIT');

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Entity not found' });
        }

        return reply.send({ success: true, id: request.params.id });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Failed to delete entity:', error);
        return reply.status(500).send({ error: 'Failed to delete entity' });
      } finally {
        client.release();
      }
    }
  );

  // ===== RELATION ENDPOINTS =====

  /**
   * POST /knowledge-graph/relations
   * Create a new relation
   */
  fastify.post<{ Body: RelationCreateRequest }>(
    '/knowledge-graph/relations',
    async (
      request: FastifyRequest<{ Body: RelationCreateRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const { source_entity_id, target_entity_id, relation_type, confidence, metadata } =
          request.body;

        if (!source_entity_id || !target_entity_id || !relation_type || confidence === undefined) {
          return reply.status(400).send({
            error:
              'Missing required fields: source_entity_id, target_entity_id, relation_type, confidence',
          });
        }

        const id = nanoid();
        const result = await pool.query(
          `INSERT INTO kg_relations (id, source_entity_id, target_entity_id, relation_type, confidence, created_by, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [id, source_entity_id, target_entity_id, relation_type, confidence, 'system', JSON.stringify(metadata)]
        );

        return reply.status(201).send(result.rows[0]);
      } catch (error) {
        console.error('Failed to create relation:', error);
        return reply.status(500).send({ error: 'Failed to create relation' });
      }
    }
  );

  /**
   * GET /knowledge-graph/relations
   * List relations with optional filtering
   */
  fastify.get<{ Querystring: { entityId?: string; relationType?: string } }>(
    '/knowledge-graph/relations',
    async (
      request: FastifyRequest<{ Querystring: { entityId?: string; relationType?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const entityId = request.query.entityId;
        const relationType = request.query.relationType;

        let query = 'SELECT * FROM kg_relations WHERE 1=1';
        const params: string[] = [];

        if (entityId) {
          query += ` AND (source_entity_id = $${params.length + 1} OR target_entity_id = $${params.length + 1})`;
          params.push(entityId);
        }

        if (relationType) {
          query += ` AND relation_type = $${params.length + 1}`;
          params.push(relationType);
        }

        query += ' ORDER BY created_at DESC LIMIT 100';

        const result = await pool.query(query, params);

        return reply.send({
          relations: result.rows,
          total: result.rows.length,
        });
      } catch (error) {
        console.error('Failed to list relations:', error);
        return reply.status(500).send({ error: 'Failed to list relations' });
      }
    }
  );

  /**
   * GET /knowledge-graph/relations/:id
   * Get a specific relation with evidence
   */
  fastify.get<{ Params: { id: string } }>(
    '/knowledge-graph/relations/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const relation = await pool.query(
          'SELECT * FROM kg_relations WHERE id = $1',
          [request.params.id]
        );

        if (relation.rows.length === 0) {
          return reply.status(404).send({ error: 'Relation not found' });
        }

        const evidence = await pool.query(
          `SELECT * FROM kg_evidence WHERE relation_id = $1 ORDER BY created_at DESC`,
          [request.params.id]
        );

        return reply.send({
          relation: relation.rows[0],
          evidence: evidence.rows,
        });
      } catch (error) {
        console.error('Failed to get relation:', error);
        return reply.status(500).send({ error: 'Failed to get relation' });
      }
    }
  );

  /**
   * DELETE /knowledge-graph/relations/:id
   * Delete a relation (and optionally its evidence)
   */
  fastify.delete<{ Params: { id: string } }>(
    '/knowledge-graph/relations/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        // Delete evidence
        await pool.query('DELETE FROM kg_evidence WHERE relation_id = $1', [request.params.id]);

        // Delete relation
        const result = await pool.query(
          'DELETE FROM kg_relations WHERE id = $1 RETURNING id',
          [request.params.id]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Relation not found' });
        }

        return reply.send({ success: true, id: request.params.id });
      } catch (error) {
        console.error('Failed to delete relation:', error);
        return reply.status(500).send({ error: 'Failed to delete relation' });
      }
    }
  );

  // ===== EVIDENCE ENDPOINTS =====

  /**
   * POST /knowledge-graph/evidence
   * Add evidence for an entity or relation
   */
  fastify.post<{ Body: EvidenceCreateRequest }>(
    '/knowledge-graph/evidence',
    async (
      request: FastifyRequest<{ Body: EvidenceCreateRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const { entity_id, relation_id, content_type, source_id, source_chat_id, quote, context } =
          request.body;

        if (!((entity_id || relation_id) && source_id && source_chat_id && context)) {
          return reply.status(400).send({
            error: 'Missing required fields: (entity_id OR relation_id), source_id, source_chat_id, context',
          });
        }
        if (typeof context === 'string' && context.length > 100_000) {
          return reply.status(413).send({ error: 'context must be 100KB or fewer' });
        }
        if (quote && typeof quote === 'string' && quote.length > 50_000) {
          return reply.status(413).send({ error: 'quote must be 50KB or fewer' });
        }

        const id = nanoid();
        const result = await pool.query(
          `INSERT INTO kg_evidence (id, entity_id, relation_id, content_type, source_id, source_chat_id, quote, context, extraction_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [id, entity_id || null, relation_id || null, content_type, source_id, source_chat_id, quote || null, context, 'manual']
        );

        return reply.status(201).send(result.rows[0]);
      } catch (error) {
        console.error('Failed to create evidence:', error);
        return reply.status(500).send({ error: 'Failed to create evidence' });
      }
    }
  );

  /**
   * GET /knowledge-graph/evidence
   * List evidence with optional filtering
   */
  fastify.get<{ Querystring: { entityId?: string; relationId?: string } }>(
    '/knowledge-graph/evidence',
    async (
      request: FastifyRequest<{ Querystring: { entityId?: string; relationId?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const entityId = request.query.entityId;
        const relationId = request.query.relationId;

        let query = 'SELECT * FROM kg_evidence WHERE 1=1';
        const params: string[] = [];

        if (entityId) {
          query += ` AND entity_id = $${params.length + 1}`;
          params.push(entityId);
        }

        if (relationId) {
          query += ` AND relation_id = $${params.length + 1}`;
          params.push(relationId);
        }

        query += ' ORDER BY created_at DESC LIMIT 100';

        const result = await pool.query(query, params);

        return reply.send({
          evidence: result.rows,
          total: result.rows.length,
        });
      } catch (error) {
        console.error('Failed to list evidence:', error);
        return reply.status(500).send({ error: 'Failed to list evidence' });
      }
    }
  );

  // ===== GRAPH OPERATIONS =====

  /**
   * GET /knowledge-graph/neighbors/:entityId
   * Find all entities directly connected to a given entity
   */
  fastify.get<{ Params: { entityId: string } }>(
    '/knowledge-graph/neighbors/:entityId',
    async (
      request: FastifyRequest<{ Params: { entityId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        // Get outgoing relations
        const outgoing = await pool.query(
          `SELECT r.*, e.name as target_name, e.type as target_type
           FROM kg_relations r
           JOIN kg_entities e ON r.target_entity_id = e.id
           WHERE r.source_entity_id = $1`,
          [request.params.entityId]
        );

        // Get incoming relations
        const incoming = await pool.query(
          `SELECT r.*, e.name as source_name, e.type as source_type
           FROM kg_relations r
           JOIN kg_entities e ON r.source_entity_id = e.id
           WHERE r.target_entity_id = $1`,
          [request.params.entityId]
        );

        return reply.send({
          outgoing: outgoing.rows,
          incoming: incoming.rows,
        });
      } catch (error) {
        console.error('Failed to get neighbors:', error);
        return reply.status(500).send({ error: 'Failed to get neighbors' });
      }
    }
  );

  /**
   * POST /knowledge-graph/extract
   * Submit text for entity and relation extraction
   */
  fastify.post<{ Body: ExtractionRequest }>(
    '/knowledge-graph/extract',
    async (
      request: FastifyRequest<{ Body: ExtractionRequest }>,
      reply: FastifyReply
    ) => {
      try {
        const { chat_id, message_id, text, job_type } = request.body;

        if (!text || typeof text !== 'string') {
          return reply.status(400).send({ error: 'text is required' });
        }
        if (text.length > 1_000_000) {
          return reply.status(413).send({ error: 'text must be 1MB or fewer' });
        }
        // Create extraction job
        const jobId = await createExtractionJob(chat_id, message_id || null, job_type);

        // Background processing - extract entities and relations
        (async () => {
          try {
            let entityCount = 0,
              relationCount = 0;

            if (job_type === 'entity' || job_type === 'full_analysis') {
              const entities = await extractEntities(text, chat_id, message_id);
              const entityMap = await storeEntities(entities, 'system', { chatId: chat_id, messageId: message_id });
              await storeEvidence(entityMap, [], {
                type: 'message',
                id: message_id || 'unknown',
                chatId: chat_id,
                text,
              });
              entityCount = entities.length;
            }

            if (job_type === 'relation' || job_type === 'full_analysis') {
              const entities = await extractEntities(text, chat_id, message_id);
              const relations = await extractRelations(text, entities);
              const entityMap = await storeEntities(entities, 'system', { chatId: chat_id, messageId: message_id });
              const relationIds = await storeRelations(relations, entityMap, 'system');
              relationCount = relationIds.length;
            }

            await updateJobStatus(jobId, 'completed', entityCount, relationCount);
          } catch (error) {
            console.error('Extraction job failed:', error);
            await updateJobStatus(jobId, 'failed', 0, 0, (error as Error).message);
          }
        })();

        return reply.status(202).send({
          jobId,
          status: 'processing',
          message: 'Extraction job submitted',
        });
      } catch (error) {
        console.error('Failed to submit extraction:', error);
        return reply.status(500).send({ error: 'Failed to submit extraction job' });
      }
    }
  );

  /**
   * GET /knowledge-graph/extraction-jobs/:jobId
   * Get extraction job status and results
   */
  fastify.get<{ Params: { jobId: string } }>(
    '/knowledge-graph/extraction-jobs/:jobId',
    async (
      request: FastifyRequest<{ Params: { jobId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const result = await pool.query(
          'SELECT * FROM kg_extraction_jobs WHERE id = $1',
          [request.params.jobId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({ error: 'Job not found' });
        }

        return reply.send(result.rows[0]);
      } catch (error) {
        console.error('Failed to get job status:', error);
        return reply.status(500).send({ error: 'Failed to get job status' });
      }
    }
  );

  /**
   * GET /knowledge-graph/stats/:chatId
   * Get graph statistics for a chat
   */
  fastify.get<{ Params: { chatId: string } }>(
    '/knowledge-graph/stats/:chatId',
    async (
      request: FastifyRequest<{ Params: { chatId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const stats = await getGraphStats(request.params.chatId);
        return reply.send(stats);
      } catch (error) {
        console.error('Failed to get graph stats:', error);
        return reply.status(500).send({ error: 'Failed to get graph stats' });
      }
    }
  );

  /**
   * GET /knowledge-graph/ranked/entities
   * Get entities ranked by confidence and evidence strength
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/knowledge-graph/ranked/entities',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const limitParsed = parsePositiveLimit(request.query.limit, { defaultValue: 50, max: 100 });
        if (!limitParsed.ok) {
          return reply.status(400).send({ error: limitParsed.message });
        }
        const limit = limitParsed.value;
        const { rankEntitiesByConfidence } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const ranked = await rankEntitiesByConfidence(limit);
        return reply.send({ ranked, total: ranked.length });
      } catch (error) {
        console.error('Failed to rank entities:', error);
        return reply.status(500).send({ error: 'Failed to rank entities' });
      }
    }
  );

  /**
   * GET /knowledge-graph/ranked/relations
   * Get relations ranked by confidence and evidence strength
   */
  fastify.get<{ Querystring: { limit?: string } }>(
    '/knowledge-graph/ranked/relations',
    async (
      request: FastifyRequest<{ Querystring: { limit?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const limitParsed = parsePositiveLimit(request.query.limit, { defaultValue: 50, max: 100 });
        if (!limitParsed.ok) {
          return reply.status(400).send({ error: limitParsed.message });
        }
        const limit = limitParsed.value;
        const { rankRelationsByConfidence } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const ranked = await rankRelationsByConfidence(limit);
        return reply.send({ ranked, total: ranked.length });
      } catch (error) {
        console.error('Failed to rank relations:', error);
        return reply.status(500).send({ error: 'Failed to rank relations' });
      }
    }
  );

  /**
   * GET /knowledge-graph/entities/:id/related
   * Get entities related to a given entity
   */
  fastify.get<{ Params: { id: string }; Querystring: { minConfidence?: string } }>(
    '/knowledge-graph/entities/:id/related',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Querystring: { minConfidence?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const minConfidence = parseFloat(request.query.minConfidence || '0.5');
        const { getRelatedEntities } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const related = await getRelatedEntities(request.params.id, minConfidence);
        return reply.send({ related, total: related.length });
      } catch (error) {
        console.error('Failed to get related entities:', error);
        return reply.status(500).send({ error: 'Failed to get related entities' });
      }
    }
  );

  /**
   * GET /knowledge-graph/entities/:id/evidence-score
   * Calculate evidence score for an entity
   */
  fastify.get<{ Params: { id: string } }>(
    '/knowledge-graph/entities/:id/evidence-score',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { calculateEvidenceScore } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const score = await calculateEvidenceScore(request.params.id);
        return reply.send({
          entityId: request.params.id,
          evidenceScore: score,
          scoreBreakdown: {
            scale: '0-1 (higher = more trustworthy)',
            factors: [
              'Evidence count (log scale)',
              'Recency (newer = better)',
              'Source diversity (multiple sources)',
              'LLM extraction bonus',
            ],
          },
        });
      } catch (error) {
        console.error('Failed to calculate evidence score:', error);
        return reply.status(500).send({ error: 'Failed to calculate evidence score' });
      }
    }
  );

  /**
   * GET /knowledge-graph/duplicates
   * Find potential duplicate entities
   */
  fastify.get<{ Querystring: { minSimilarity?: string } }>(
    '/knowledge-graph/duplicates',
    async (
      request: FastifyRequest<{ Querystring: { minSimilarity?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const minSimilarity = parseFloat(request.query.minSimilarity || '0.8');
        const { findPotentialDuplicates } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const duplicates = await findPotentialDuplicates(minSimilarity);
        return reply.send({
          duplicates,
          total: duplicates.length,
          minSimilarity,
        });
      } catch (error) {
        console.error('Failed to find duplicates:', error);
        return reply.status(500).send({ error: 'Failed to find duplicates' });
      }
    }
  );

  /**
   * POST /knowledge-graph/maintenance/run
   * Automatic maintenance:
   *  - merge duplicate entities
   *  - prune contradictory relations (keep higher confidence edge)
   */
  fastify.post<{
    Body?: { dry_run?: boolean; max_merges?: number };
  }>(
    '/knowledge-graph/maintenance/run',
    async (
      request: FastifyRequest<{ Body?: { dry_run?: boolean; max_merges?: number } }>,
      reply: FastifyReply
    ) => {
      const dryRun = Boolean(request.body?.dry_run);
      const maxMerges = Math.min(Math.max(Number(request.body?.max_merges || 100), 1), 1000);
      const maintenanceAt = new Date().toISOString();

      const summary = {
        dry_run: dryRun,
        started_at: maintenanceAt,
        duplicate_groups_detected: 0,
        merged_entities: 0,
        contradiction_pairs_detected: 0,
        pruned_relations: 0,
      };
      const merged: Array<{ source_id: string; target_id: string; reason: string }> = [];
      const pruned: Array<{ pruned_relation_id: string; kept_relation_id: string; reason: string }> = [];

      try {
        const dupGroups = await pool.query(
          `SELECT
             LOWER(TRIM(name)) AS normalized_name,
             type,
             ARRAY_AGG(id ORDER BY confidence DESC, updated_at DESC, id ASC) AS ids
           FROM kg_entities
           WHERE COALESCE(deleted_at, NULL) IS NULL
           GROUP BY LOWER(TRIM(name)), type
           HAVING COUNT(*) > 1
           ORDER BY COUNT(*) DESC
           LIMIT 200`,
          [],
        );
        const groups = dupGroups.rows as DuplicateGroup[];
        summary.duplicate_groups_detected = groups.length;

        const client = await pool.connect();
        let mergesPerformed = 0;
        if (!dryRun) {
          await client.query('BEGIN');
        }
        try {
          for (const group of groups) {
            const ids = Array.isArray(group.ids) ? group.ids : [];
            if (ids.length < 2) continue;
            const targetId = String(ids[0] || '');
            if (!targetId) continue;
            for (const sourceRaw of ids.slice(1)) {
              if (mergesPerformed >= maxMerges) break;
              const sourceId = String(sourceRaw || '');
              if (!sourceId || sourceId === targetId) continue;

              merged.push({
                source_id: sourceId,
                target_id: targetId,
                reason: `Duplicate entity merge for "${group.normalized_name}" (${group.type})`,
              });
              mergesPerformed += 1;

              if (dryRun) continue;

              // Rewire relations to target.
              await client.query(
                `UPDATE kg_relations
                 SET source_entity_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE source_entity_id = $2`,
                [targetId, sourceId],
              );
              await client.query(
                `UPDATE kg_relations
                 SET target_entity_id = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE target_entity_id = $2`,
                [targetId, sourceId],
              );

              // Remove accidental self-loops introduced by rewiring.
              await client.query(
                `DELETE FROM kg_relations
                 WHERE source_entity_id = target_entity_id`,
                [],
              );

              // Merge evidence references.
              await client.query(
                `UPDATE kg_evidence
                 SET entity_id = $1
                 WHERE entity_id = $2`,
                [targetId, sourceId],
              );

              // Keep target confidence as max of both.
              await client.query(
                `UPDATE kg_entities target
                 SET confidence = GREATEST(
                   target.confidence,
                   COALESCE((SELECT confidence FROM kg_entities src WHERE src.id = $1), target.confidence)
                 ),
                 updated_at = CURRENT_TIMESTAMP
                 WHERE target.id = $2`,
                [sourceId, targetId],
              );

              // Soft-delete source entity.
              await client.query(
                `UPDATE kg_entities
                 SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [sourceId],
              );
            }
            if (mergesPerformed >= maxMerges) break;
          }

          // De-duplicate exact same relation triples, keeping highest confidence.
          if (!dryRun) {
            await client.query(
              `DELETE FROM kg_relations r
               USING kg_relations k
               WHERE r.id <> k.id
                 AND r.source_entity_id = k.source_entity_id
                 AND r.target_entity_id = k.target_entity_id
                 AND LOWER(r.relation_type) = LOWER(k.relation_type)
                 AND (
                   r.confidence < k.confidence
                   OR (r.confidence = k.confidence AND r.id > k.id)
                 )`,
              [],
            );
          }

          const relationRes = await client.query(
            `SELECT id, source_entity_id, target_entity_id, relation_type, confidence
             FROM kg_relations
             WHERE COALESCE(deleted_at, NULL) IS NULL
             ORDER BY source_entity_id, target_entity_id`,
            [],
          );
          const relations = relationRes.rows as RelationRow[];
          const byPair = new Map<string, RelationRow[]>();
          for (const rel of relations) {
            const key = `${rel.source_entity_id}::${rel.target_entity_id}`;
            const arr = byPair.get(key) || [];
            arr.push(rel);
            byPair.set(key, arr);
          }

          for (const entries of byPair.values()) {
            for (let i = 0; i < entries.length; i += 1) {
              for (let j = i + 1; j < entries.length; j += 1) {
                const a = entries[i];
                const b = entries[j];
                if (!a || !b) continue;
                if (!contradictionPair(a.relation_type, b.relation_type)) continue;
                summary.contradiction_pairs_detected += 1;
                const prune = Number(a.confidence || 0) < Number(b.confidence || 0) ? a : b;
                const keep = prune.id === a.id ? b : a;
                pruned.push({
                  pruned_relation_id: prune.id,
                  kept_relation_id: keep.id,
                  reason: `Contradiction ${a.relation_type} vs ${b.relation_type}`,
                });
                if (!dryRun) {
                  await client.query(`DELETE FROM kg_relations WHERE id = $1`, [prune.id]);
                }
              }
            }
          }

          if (!dryRun) {
            await client.query('COMMIT');
          }
        } catch (err) {
          if (!dryRun) {
            await client.query('ROLLBACK');
          }
          throw err;
        } finally {
          client.release();
        }

        summary.merged_entities = merged.length;
        summary.pruned_relations = pruned.length;

        return reply.send({
          success: true,
          data: {
            summary,
            merged,
            pruned,
          },
        });
      } catch (error) {
        if (isSchemaCompatError(error)) {
          return reply.status(503).send({
            success: false,
            error: { code: 'FEATURE_UNAVAILABLE', message: 'Knowledge graph schema not initialized' },
          });
        }
        console.error('Failed to run knowledge graph maintenance:', error);
        return reply.status(500).send({ error: 'Failed to run knowledge graph maintenance' });
      }
    }
  );

  /**
   * POST /knowledge-graph/entities/:sourceId/merge/:targetId
   * Merge two entities together
   */
  fastify.post<{ Params: { sourceId: string; targetId: string }; Body?: { reason: string } }>(
    '/knowledge-graph/entities/:sourceId/merge/:targetId',
    async (
      request: FastifyRequest<{ Params: { sourceId: string; targetId: string }; Body?: { reason: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { mergeEntities } = await import(
          '../../services/KnowledgeGraphService.js'
        );

        const result = await mergeEntities(request.params.sourceId, request.params.targetId, {
          reason: request.body?.reason || 'Manual merge',
          mergedBy: 'system', // In production, would be request.user?.id
        });

        return reply.status(200).send(result);
      } catch (error) {
        console.error('Failed to merge entities:', error);
        return reply.status(500).send({ error: 'Failed to merge entities' });
      }
    }
  );

  /**
   * POST /knowledge-graph/entities/:id/unmerge
   * Unmerge an entity (undo previous merge)
   */
  fastify.post<{ Params: { id: string }; Body?: { reason: string } }>(
    '/knowledge-graph/entities/:id/unmerge',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body?: { reason: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { unmergeEntity } = await import(
          '../../services/KnowledgeGraphService.js'
        );

        const result = await unmergeEntity(request.params.id, {
          reason: request.body?.reason || 'Manual unmerge',
          mergedBy: 'system',
        });

        return reply.status(200).send(result);
      } catch (error) {
        console.error('Failed to unmerge entity:', error);
        return reply.status(500).send({ error: 'Failed to unmerge entity' });
      }
    }
  );

  /**
   * GET /knowledge-graph/entities/:id/merge-history
   * Get merge history for an entity
   */
  fastify.get<{ Params: { id: string } }>(
    '/knowledge-graph/entities/:id/merge-history',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { getMergeHistory } = await import(
          '../../services/KnowledgeGraphService.js'
        );
        const history = await getMergeHistory(request.params.id);
        return reply.send({ entityId: request.params.id, history });
      } catch (error) {
        console.error('Failed to get merge history:', error);
        return reply.status(500).send({ error: 'Failed to get merge history' });
      }
    }
  );

  /**
   * POST /knowledge-graph/context
   * Build knowledge graph context for a user query
   * Used to augment LLM prompts with relevant graph information
   */
  fastify.post<{ Body: { query: string; chatId?: string } }>(
    '/knowledge-graph/context',
    async (
      request: FastifyRequest<{ Body: { query: string; chatId?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { query, chatId } = request.body;

        if (!query || !String(chatId || '').trim()) {
          return reply.status(400).send({ error: 'Query and chatId are required' });
        }

        const context = await buildGraphContext(query, String(chatId).trim());
        return reply.send(context);
      } catch (error) {
        console.error('Failed to build graph context:', error);
        return reply.status(500).send({ error: 'Failed to build graph context' });
      }
    }
  );

  /**
   * POST /knowledge-graph/cite-response
   * Create a cited response from LLM output and knowledge graph evidence
   * Attaches citations to parts of the response that relate to graph entities
   */
  fastify.post<{ Body: { response: string; entityIds?: string[]; chatId?: string } }>(
    '/knowledge-graph/cite-response',
    async (
      request: FastifyRequest<{ Body: { response: string; entityIds?: string[]; chatId?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { response, entityIds = [], chatId } = request.body;

        if (!response || !String(chatId || '').trim()) {
          return reply.status(400).send({ error: 'Response text and chatId are required' });
        }

        // Get entities for citation lookup
        const entriesData = await Promise.all(
          entityIds.map(async (id) => {
            const res = await pool.query(
              `SELECT id, name, type, confidence, description FROM kg_entities WHERE id = $1`,
              [id]
            );
            return res.rows[0];
          })
        );

        const entities = entriesData.filter(Boolean);
        const citationBlocks = await createCitedResponse(response, entities, String(chatId).trim());
        const formatted = formatCitations(citationBlocks);

        return reply.send({
          citationBlocks,
          formattedText: formatted,
          citationCount: citationBlocks.filter((b) => b.citations.length > 0).length,
        });
      } catch (error) {
        console.error('Failed to create cited response:', error);
        return reply.status(500).send({ error: 'Failed to create cited response' });
      }
    }
  );

  /**
   * POST /knowledge-graph/verify-claim
   * Verify a claim against knowledge graph evidence
   * Returns confidence score and supporting evidence
   */
  fastify.post<{ Body: { claim: string; confidenceThreshold?: number; chatId?: string } }>(
    '/knowledge-graph/verify-claim',
    async (
      request: FastifyRequest<{ Body: { claim: string; confidenceThreshold?: number; chatId?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { claim, confidenceThreshold = 0.7, chatId } = request.body;

        if (!claim || !String(chatId || '').trim()) {
          return reply.status(400).send({ error: 'Claim and chatId are required' });
        }

        const verificationResult = await verifyClaim(claim, confidenceThreshold, String(chatId).trim());
        return reply.send(verificationResult);
      } catch (error) {
        console.error('Failed to verify claim:', error);
        return reply.status(500).send({ error: 'Failed to verify claim' });
      }
    }
  );

  /**
   * POST /knowledge-graph/augment-rag
   * Augment RAG results with knowledge graph context
   * Combines semantic search with graph-based context for richer answers
   */
  fastify.post<{
    Body: {
      ragResults: Array<{ text: string; source: string; score: number }>;
      query: string;
      chatId?: string;
    };
  }>(
    '/knowledge-graph/augment-rag',
    async (
      request: FastifyRequest<{
        Body: {
          ragResults: Array<{ text: string; source: string; score: number }>;
          query: string;
          chatId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { ragResults, query, chatId } = request.body;

        if (!Array.isArray(ragResults) || !query || !String(chatId || '').trim()) {
          return reply.status(400).send({ error: 'RAG results, query, and chatId are required' });
        }

        const augmented = await augmentRAGWithGraphContext(ragResults, query, String(chatId).trim());
        return reply.send(augmented);
      } catch (error) {
        console.error('Failed to augment RAG:', error);
        return reply.status(500).send({ error: 'Failed to augment RAG' });
      }
    }
  );
}


