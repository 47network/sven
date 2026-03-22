import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';

/**
 * Knowledge Graph Extraction Service
 * Handles entity and relation extraction using LLM
 */

interface ExtractedEntity {
  type: string;
  name: string;
  description?: string;
  confidence: number;
  metadata?: any;
}

interface ExtractedRelation {
  source_name: string;
  target_name: string;
  relation_type: string;
  confidence: number;
  metadata?: any;
}

interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  jobId: string;
}

const pool = getPool();

/**
 * Extract entities from text using LLM
 * Identifies people, places, concepts, events, organizations, etc.
 */
export async function extractEntities(
  text: string,
  chatId: string,
  messageId?: string,
  llmCall?: (prompt: string) => Promise<string>
): Promise<ExtractedEntity[]> {
  const extraction = llmCall || defaultLlmExtraction;

  const prompt = `Extract all entities from the following text. For each entity, identify:
1. Type (person, place, concept, event, organization, date, location, product, technology, other)
2. Name/value
3. Brief description
4. Confidence (0-1)

Return as JSON array with structure: [{"type": "...", "name": "...", "description": "...", "confidence": 0-1}]

Text: "${text}"

JSON:`;

  try {
    const response = await extraction(prompt);
    const entities = JSON.parse(response) as ExtractedEntity[];
    return entities.filter(e => e.confidence > 0.5); // Filter low-confidence
  } catch (error) {
    console.error('Failed to extract entities:', error);
    return [];
  }
}

/**
 * Extract relations from text using LLM
 * Identifies relationships between entities
 */
export async function extractRelations(
  text: string,
  entities: ExtractedEntity[],
  llmCall?: (prompt: string) => Promise<string>
): Promise<ExtractedRelation[]> {
  const extraction = llmCall || defaultLlmExtraction;

  const entityNames = entities.map(e => e.name).join(', ');
  const prompt = `Given these entities: [${entityNames}]

Extract all relations between them from the following text.
For each relation, identify:
1. Source entity name
2. Target entity name
3. Relation type (knows, works_for, part_of, created, located_in, member_of, friend_of, spouse_of, parent_of, child_of, sibling_of, founded, manages, authored, other)
4. Confidence (0-1)

Return as JSON array with structure: [{"source_name": "...", "target_name": "...", "relation_type": "...", "confidence": 0-1}]

Text: "${text}"

JSON:`;

  try {
    const response = await extraction(prompt);
    const relations = JSON.parse(response) as ExtractedRelation[];
    return relations.filter(r => r.confidence > 0.5);
  } catch (error) {
    console.error('Failed to extract relations:', error);
    return [];
  }
}

/**
 * Store extracted entities in database
 */
export async function storeEntities(
  entities: ExtractedEntity[],
  userId: string,
  sourceData: { chatId: string; messageId?: string }
): Promise<Map<string, string>> {
  const entityIdMap = new Map<string, string>();

  try {
    for (const entity of entities) {
      const id = nanoid();
      await pool.query(
        `INSERT INTO kg_entities (id, type, name, description, confidence, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (name, type) DO UPDATE SET
           updated_at = CURRENT_TIMESTAMP,
           metadata = jsonb_merge(kg_entities.metadata, $7)
         RETURNING id`,
        [
          id,
          entity.type,
          entity.name,
          entity.description || null,
          entity.confidence,
          userId,
          JSON.stringify(entity.metadata || {}),
        ]
      );

      entityIdMap.set(entity.name, id);
    }
  } catch (error) {
    console.error('Failed to store entities:', error);
  }

  return entityIdMap;
}

/**
 * Store extracted relations in database
 */
export async function storeRelations(
  relations: ExtractedRelation[],
  entities: Map<string, string>,
  userId: string
): Promise<string[]> {
  const relationIds: string[] = [];

  try {
    for (const rel of relations) {
      const sourceId = entities.get(rel.source_name);
      const targetId = entities.get(rel.target_name);

      if (!sourceId || !targetId) {
        continue; // Skip if entity not found
      }

      const id = nanoid();
      await pool.query(
        `INSERT INTO kg_relations (id, source_entity_id, target_entity_id, relation_type, confidence, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          sourceId,
          targetId,
          rel.relation_type,
          rel.confidence,
          userId,
          JSON.stringify(rel.metadata || {}),
        ]
      );

      relationIds.push(id);
    }
  } catch (error) {
    console.error('Failed to store relations:', error);
  }

  return relationIds;
}

/**
 * Store evidence linking entities/relations to source messages
 */
export async function storeEvidence(
  entityIds: Map<string, string>,
  relationIds: string[],
  source: {
    type: 'message' | 'artifact';
    id: string;
    chatId: string;
    text: string;
  }
): Promise<void> {
  try {
    // Store entity evidence
    for (const [entityName, entityId] of entityIds) {
      const quote = extractQuote(source.text, entityName);
      if (quote) {
        await pool.query(
          `INSERT INTO kg_evidence (id, entity_id, content_type, source_id, source_chat_id, quote, context, extraction_method)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            nanoid(),
            entityId,
            source.type,
            source.id,
            source.chatId,
            quote,
            source.text.substring(0, 500),
            'llm',
          ]
        );
      }
    }

    // Store relation evidence
    for (const relationId of relationIds) {
      await pool.query(
        `INSERT INTO kg_evidence (id, relation_id, content_type, source_id, source_chat_id, context, extraction_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          nanoid(),
          relationId,
          source.type,
          source.id,
          source.chatId,
          source.text.substring(0, 500),
          'llm',
        ]
      );
    }
  } catch (error) {
    console.error('Failed to store evidence:', error);
  }
}

/**
 * Extract exact quote from text containing entity name
 */
function extractQuote(text: string, entityName: string): string | null {
  const index = text.indexOf(entityName);
  if (index === -1) return null;

  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + entityName.length + 50);
  return text.substring(start, end).trim();
}

/**
 * Default LLM extraction (mock - override with actual LLM)
 */
async function defaultLlmExtraction(prompt: string): Promise<string> {
  // This is a placeholder - in production, call your LLM service
  console.warn('Using default mock extraction. Override with actual LLM call.');
  return '[]';
}

/**
 * Create a knowledge graph analysis job
 */
export async function createExtractionJob(
  chatId: string,
  messageId: string | null,
  jobType: 'entity' | 'relation' | 'full_analysis'
): Promise<string> {
  const jobId = nanoid();

  await pool.query(
    `INSERT INTO kg_extraction_jobs (id, chat_id, message_id, job_type, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [jobId, chatId, messageId, jobType, 'pending']
  );

  return jobId;
}

/**
 * Update job status
 */
export async function updateJobStatus(
  jobId: string,
  status: string,
  resultEntities?: number,
  resultRelations?: number,
  errorMessage?: string
): Promise<void> {
  await pool.query(
    `UPDATE kg_extraction_jobs
     SET status = $1,
         result_entities = COALESCE($2, result_entities),
         result_relations = COALESCE($3, result_relations),
         error_message = $4,
         completed_at = CASE
           WHEN $1 IN ('completed', 'failed') THEN CURRENT_TIMESTAMP
           ELSE NULL
         END
     WHERE id = $5`,
    [status, resultEntities, resultRelations, errorMessage, jobId]
  );
}

/**
 * Get knowledge graph statistics for a chat
 */
export async function getGraphStats(chatId: string): Promise<{
  entities: number;
  relations: number;
  evidence: number;
  topEntityTypes: Array<{ type: string; count: number }>;
}> {
  try {
    const entityCount = await pool.query(
      `SELECT COUNT(*) as count FROM kg_entities
       WHERE id IN (
         SELECT entity_id FROM kg_evidence WHERE source_chat_id = $1
       )`,
      [chatId]
    );

    const relationCount = await pool.query(
      `SELECT COUNT(*) as count FROM kg_relations
       WHERE id IN (
         SELECT relation_id FROM kg_evidence WHERE source_chat_id = $1
       )`,
      [chatId]
    );

    const evidenceCount = await pool.query(
      `SELECT COUNT(*) as count FROM kg_evidence WHERE source_chat_id = $1`,
      [chatId]
    );

    const topTypes = await pool.query(
      `SELECT e.type, COUNT(*) as count FROM kg_entities e
       INNER JOIN kg_evidence ev ON e.id = ev.entity_id
       WHERE ev.source_chat_id = $1
       GROUP BY e.type
       ORDER BY count DESC
       LIMIT 10`,
      [chatId]
    );

    return {
      entities: parseInt(entityCount.rows[0]?.count || 0),
      relations: parseInt(relationCount.rows[0]?.count || 0),
      evidence: parseInt(evidenceCount.rows[0]?.count || 0),
      topEntityTypes: topTypes.rows,
    };
  } catch (error) {
    console.error('Failed to get graph stats:', error);
    return { entities: 0, relations: 0, evidence: 0, topEntityTypes: [] };
  }
}

/**
 * Calculate evidence score for an entity or relation
 * Factors: confidence, number of sources, recency, extraction method
 */
export async function calculateEvidenceScore(
  entityId?: string,
  relationId?: string
): Promise<number> {
  try {
    const query = entityId
      ? `SELECT 
           COUNT(*) as evidence_count,
           AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 86400) as avg_age_days,
           COUNT(DISTINCT source_id) as unique_sources,
           COUNT(CASE WHEN extraction_method = 'llm' THEN 1 END)::float / COUNT(*) as llm_ratio
         FROM kg_evidence
         WHERE entity_id = $1`
      : `SELECT 
           COUNT(*) as evidence_count,
           AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 86400) as avg_age_days,
           COUNT(DISTINCT source_id) as unique_sources,
           COUNT(CASE WHEN extraction_method = 'llm' THEN 1 END)::float / COUNT(*) as llm_ratio
         FROM kg_evidence
         WHERE relation_id = $1`;

    const result = await pool.query(query, [entityId || relationId]);
    const data = result.rows[0];

    if (!data || data.evidence_count === 0) {
      return 0;
    }

    // Score formula:
    // - Base score from evidence count (log scale, max 0.4)
    // - Recency bonus: newer is better (max 0.3)
    // - Source diversity bonus: multiple sources (max 0.2)
    // - LLM extraction bonus (max 0.1)

    const countScore = Math.min(0.4, Math.log(data.evidence_count + 1) / 10);
    const recencyScore = Math.min(0.3, Math.max(0, 0.3 - (data.avg_age_days || 0) / 100));
    const sourceScore = Math.min(0.2, (data.unique_sources || 0) * 0.05);
    const llmScore = (data.llm_ratio || 0) * 0.1;

    const totalScore = Math.round((countScore + recencyScore + sourceScore + llmScore) * 100) / 100;

    return totalScore;
  } catch (error) {
    console.error('Failed to calculate evidence score:', error);
    return 0;
  }
}

/**
 * Rank entities by confidence and evidence strength
 */
export async function rankEntitiesByConfidence(
  limit: number = 50
): Promise<
  Array<{
    id: string;
    name: string;
    type: string;
    confidence: number;
    evidenceScore: number;
    compositeScore: number;
    evidenceCount: number;
  }>
> {
  try {
    const result = await pool.query(
      `SELECT 
         e.id,
         e.name,
         e.type,
         e.confidence,
         COUNT(ev.id) as evidence_count
       FROM kg_entities e
       LEFT JOIN kg_evidence ev ON e.id = ev.entity_id
       GROUP BY e.id, e.name, e.type, e.confidence
       ORDER BY e.confidence DESC, evidence_count DESC
       LIMIT $1`,
      [limit]
    );

    const ranked = await Promise.all(
      result.rows.map(async (row) => {
        const evidenceScore = await calculateEvidenceScore(row.id);
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          confidence: row.confidence,
          evidenceScore,
          compositeScore: row.confidence * 0.7 + evidenceScore * 0.3,
          evidenceCount: parseInt(row.evidence_count),
        };
      })
    );

    return ranked.sort((a, b) => b.compositeScore - a.compositeScore);
  } catch (error) {
    console.error('Failed to rank entities:', error);
    return [];
  }
}

/**
 * Rank relations by confidence and supporting evidence
 */
export async function rankRelationsByConfidence(
  limit: number = 50
): Promise<
  Array<{
    id: string;
    relation_type: string;
    confidence: number;
    evidenceScore: number;
    compositeScore: number;
    evidenceCount: number;
  }>
> {
  try {
    const result = await pool.query(
      `SELECT 
         r.id,
         r.relation_type,
         r.confidence,
         COUNT(ev.id) as evidence_count
       FROM kg_relations r
       LEFT JOIN kg_evidence ev ON r.id = ev.relation_id
       GROUP BY r.id, r.relation_type, r.confidence
       ORDER BY r.confidence DESC, evidence_count DESC
       LIMIT $1`,
      [limit]
    );

    const ranked = await Promise.all(
      result.rows.map(async (row) => {
        const evidenceScore = await calculateEvidenceScore(undefined, row.id);
        return {
          id: row.id,
          relation_type: row.relation_type,
          confidence: row.confidence,
          evidenceScore,
          compositeScore: row.confidence * 0.7 + evidenceScore * 0.3,
          evidenceCount: parseInt(row.evidence_count),
        };
      })
    );

    return ranked.sort((a, b) => b.compositeScore - a.compositeScore);
  } catch (error) {
    console.error('Failed to rank relations:', error);
    return [];
  }
}

/**
 * Get related entities (1-hop neighbors with confidence scores)
 */
export async function getRelatedEntities(
  entityId: string,
  minConfidence: number = 0.5
): Promise<
  Array<{
    relatedId: string;
    relatedName: string;
    relationType: string;
    direction: 'outgoing' | 'incoming';
    relationConfidence: number;
    relatedConfidence: number;
    compositeScore: number;
  }>
> {
  try {
    const outgoing = await pool.query(
      `SELECT 
         r.id as rel_id,
         r.target_entity_id as related_id,
         e.name as related_name,
         r.relation_type,
         r.confidence as rel_confidence,
         e.confidence as related_confidence
       FROM kg_relations r
       JOIN kg_entities e ON r.target_entity_id = e.id
       WHERE r.source_entity_id = $1
       AND r.confidence >= $2`,
      [entityId, minConfidence]
    );

    const incoming = await pool.query(
      `SELECT 
         r.id as rel_id,
         r.source_entity_id as related_id,
         e.name as related_name,
         r.relation_type,
         r.confidence as rel_confidence,
         e.confidence as related_confidence
       FROM kg_relations r
       JOIN kg_entities e ON r.source_entity_id = e.id
       WHERE r.target_entity_id = $1
       AND r.confidence >= $2`,
      [entityId, minConfidence]
    );

    const allRelated = [
      ...outgoing.rows.map((r) => ({ ...r, direction: 'outgoing' as const })),
      ...incoming.rows.map((r) => ({ ...r, direction: 'incoming' as const })),
    ];

    return allRelated.map((r) => ({
      relatedId: r.related_id,
      relatedName: r.related_name,
      relationType: r.relation_type,
      direction: r.direction,
      relationConfidence: r.rel_confidence,
      relatedConfidence: r.related_confidence,
      compositeScore: r.rel_confidence * 0.6 + r.related_confidence * 0.4,
    }));
  } catch (error) {
    console.error('Failed to get related entities:', error);
    return [];
  }
}

/**
 * Find potential duplicate entities using string similarity and type matching
 */
export async function findPotentialDuplicates(
  minSimilarity: number = 0.8
): Promise<
  Array<{
    entity1Id: string;
    entity1Name: string;
    entity2Id: string;
    entity2Name: string;
    similarity: number;
    mergeSuggestion: string;
  }>
> {
  try {
    // Use PostgreSQL's similarity function (requires pg_trgm extension)
    // Falls back to simple string matching if not available
    const result = await pool.query(
      `SELECT 
         e1.id as entity1_id,
         e1.name as entity1_name,
         e2.id as entity2_id,
         e2.name as entity2_name,
         CASE 
           WHEN e1.name = e2.name THEN 1.0
           WHEN LOWER(e1.name) = LOWER(e2.name) THEN 0.95
           ELSE (
             2.0 * LENGTH(
               SELECT STRING_AGG(c, '')
               FROM (
                 SELECT c FROM UNNEST(STRING_TO_ARRAY(e1.name, NULL)) as c
                 INTERSECT
                 SELECT c FROM UNNEST(STRING_TO_ARRAY(e2.name, NULL)) as c
               ) t
             )::integer / (LENGTH(e1.name) + LENGTH(e2.name))::float
           )
         END as similarity
       FROM kg_entities e1
       JOIN kg_entities e2 ON e1.id < e2.id AND e1.type = e2.type
       WHERE 
         (
           e1.name = e2.name
           OR LOWER(e1.name) = LOWER(e2.name)
           OR ABS(LENGTH(e1.name) - LENGTH(e2.name)) <= 2
         )
       ORDER BY similarity DESC`,
      []
    );

    return result.rows
      .filter((r) => r.similarity >= minSimilarity)
      .map((r) => ({
        entity1Id: r.entity1_id,
        entity1Name: r.entity1_name,
        entity2Id: r.entity2_id,
        entity2Name: r.entity2_name,
        similarity: r.similarity,
        mergeSuggestion: `Merge ${r.entity2_name} into ${r.entity1_name}`,
      }));
  } catch (error) {
    console.error('Failed to find duplicates:', error);
    return [];
  }
}

/**
 * Merge two entities together
 * The targetEntityId is kept, sourceEntityId is marked as merged
 */
export async function mergeEntities(
  sourceEntityId: string,
  targetEntityId: string,
  details?: { reason: string; mergedBy: string }
): Promise<{ success: boolean; message: string }> {
  try {
    await pool.query('BEGIN');

    // Update versioning - mark source as merged
    const version = await pool.query(
      `INSERT INTO kg_entity_versions (id, entity_id, change_type, old_value, new_value, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        nanoid(),
        sourceEntityId,
        'merged',
        sourceEntityId,
        targetEntityId,
        details?.reason || 'Entity deduplication',
      ]
    );

    // Redirect all relations from source to target
    // Incoming relations to source become incoming to target
    await pool.query(
      `UPDATE kg_relations
       SET source_entity_id = $1
       WHERE source_entity_id = $2`,
      [targetEntityId, sourceEntityId]
    );

    // Outgoing relations from source become outgoing from target
    await pool.query(
      `UPDATE kg_relations
       SET target_entity_id = $1
       WHERE target_entity_id = $2`,
      [targetEntityId, sourceEntityId]
    );

    // Copy evidence from source to target
    await pool.query(
      `UPDATE kg_evidence
       SET entity_id = $1
       WHERE entity_id = $2`,
      [targetEntityId, sourceEntityId]
    );

    // Mark source entity as merged (update status)
    await pool.query(
      `UPDATE kg_entities
       SET status = 'merged'
       WHERE id = $1`,
      [sourceEntityId]
    );

    // Update target entity confidence to average of both
    await pool.query(
      `UPDATE kg_entities
       SET confidence = (confidence + (SELECT confidence FROM kg_entities WHERE id = $1)) / 2.0
       WHERE id = $2`,
      [sourceEntityId, targetEntityId]
    );

    await pool.query('COMMIT');

    return {
      success: true,
      message: `Successfully merged ${sourceEntityId} into ${targetEntityId}`,
    };
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Failed to merge entities:', error);
    throw error;
  }
}

/**
 * Unmerge an entity (undo a previous merge)
 */
export async function unmergeEntity(
  mergedEntityId: string,
  details?: { reason: string; mergedBy: string }
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the original target entity from version history
    const versionResult = await pool.query(
      `SELECT new_value as target_id FROM kg_entity_versions
       WHERE entity_id = $1 AND change_type = 'merged'
       ORDER BY created_at DESC
       LIMIT 1`,
      [mergedEntityId]
    );

    if (versionResult.rows.length === 0) {
      throw new Error('No merge history found for this entity');
    }

    const targetEntityId = versionResult.rows[0].target_id;

    await pool.query('BEGIN');

    // Restore relations from merged entity (in this case, redirect back)
    // Relations that were pointing to target are reassigned to source
    await pool.query(
      `UPDATE kg_relations
       SET target_entity_id = $1
       WHERE target_entity_id = $2
       AND (source_entity_id != $2 OR target_entity_id = $3)`,
      [mergedEntityId, targetEntityId, targetEntityId]
    );

    // Mark entity as active again
    await pool.query(
      `UPDATE kg_entities
       SET status = 'active'
       WHERE id = $1`,
      [mergedEntityId]
    );

    await pool.query('COMMIT');

    return {
      success: true,
      message: `Successfully unmerged ${mergedEntityId} from ${targetEntityId}`,
    };
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Failed to unmerge entity:', error);
    throw error;
  }
}

/**
 * Get merge history for an entity
 */
export async function getMergeHistory(entityId: string): Promise<
  Array<{
    versionId: string;
    changeType: string;
    oldValue: string;
    newValue: string;
    reason: string;
    createdAt: string;
  }>
> {
  try {
    const result = await pool.query(
      `SELECT id, change_type, old_value, new_value, reason, created_at
       FROM kg_entity_versions
       WHERE entity_id = $1
       ORDER BY created_at DESC`,
      [entityId]
    );

    return result.rows.map((r) => ({
      versionId: r.id,
      changeType: r.change_type,
      oldValue: r.old_value,
      newValue: r.new_value,
      reason: r.reason,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error('Failed to get merge history:', error);
    return [];
  }
}
