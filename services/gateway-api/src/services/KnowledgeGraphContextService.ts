import { getPool } from '../db/pool.js';

/**
 * Knowledge Graph Context Service
 * Integrates the knowledge graph into the runtime to provide contextual information
 * and evidence citations for LLM-generated answers
 */

interface Entity {
  id: string;
  name: string;
  type: string;
  confidence: number;
  description?: string;
}

interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  confidence: number;
  source_name?: string;
  target_name?: string;
}

interface Evidence {
  id: string;
  quote?: string;
  context: string;
  source_id: string;
  source_chat_id: string;
  extraction_method: string;
  created_at: string;
}

interface ContextResult {
  entities: Entity[];
  relations: Relation[];
  contextualText: string;
  citations: Array<{
    entityId?: string;
    relationId?: string;
    evidence: Evidence[];
    confidence: number;
  }>;
  summary: string;
}

interface CitationBlock {
  type: 'entity_mention' | 'relation_claim' | 'statement';
  content: string;
  citations: Array<{
    sourceId: string;
    sourceChatId: string;
    quote?: string;
    confidence: number;
  }>;
}

const pool = getPool();

/**
 * Extract entities from user query using keyword matching against the knowledge graph
 */
export async function extractQueryEntities(userQuery: string): Promise<Entity[]> {
  return extractQueryEntitiesForChat(userQuery);
}

export async function extractQueryEntitiesForChat(userQuery: string, chatId?: string): Promise<Entity[]> {
  try {
    // Split query into tokens and search for matching entities
    const tokens = userQuery.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    if (tokens.length === 0) {
      return [];
    }

    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',');
    const chatFilterParam = chatId ? `$${tokens.length + 1}` : null;
    const result = await pool.query(
      `SELECT DISTINCT e.id, e.name, e.type, e.confidence, e.description
       FROM kg_entities e
       INNER JOIN kg_evidence ev ON ev.entity_id = e.id
       WHERE (
         LOWER(e.name) LIKE ANY(ARRAY[${placeholders}])
         OR LOWER(e.description) LIKE ANY(ARRAY[${placeholders}])
       )
       ${chatFilterParam ? `AND ev.source_chat_id = ${chatFilterParam}` : ''}
       ORDER BY e.confidence DESC
       LIMIT 10`,
      [...tokens.map((t) => `%${t}%`), ...(chatId ? [chatId] : [])]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to extract query entities:', error);
    return [];
  }
}

/**
 * Get rich context for entities (entities + relations + evidence)
 */
export async function getEntityContext(
  entityIds: string[],
  chatId?: string
): Promise<Array<{ entity: Entity; relations: Relation[]; evidence: Evidence[] }>> {
  try {
    const results = [];

    for (const entityId of entityIds) {
      // Get entity
      const entityRes = await pool.query(
        'SELECT id, name, type, confidence, description FROM kg_entities WHERE id = $1',
        [entityId]
      );

      if (entityRes.rows.length === 0) continue;

      const entity = entityRes.rows[0];

      // Get relations
      const relationsRes = await pool.query(
        `SELECT r.*, 
                e1.name as source_name, e2.name as target_name
         FROM kg_relations r
         LEFT JOIN kg_entities e1 ON r.source_entity_id = e1.id
         LEFT JOIN kg_entities e2 ON r.target_entity_id = e2.id
         INNER JOIN kg_evidence ev ON ev.relation_id = r.id
         WHERE r.source_entity_id = $1 OR r.target_entity_id = $1
         ${chatId ? 'AND ev.source_chat_id = $2' : ''}
         ORDER BY r.confidence DESC
         LIMIT 10`,
        chatId ? [entityId, chatId] : [entityId]
      );

      // Get evidence
      const evidenceRes = await pool.query(
        `SELECT id, quote, context, source_id, source_chat_id, extraction_method, created_at
         FROM kg_evidence
         WHERE entity_id = $1
         ${chatId ? 'AND source_chat_id = $2' : ''}
         ORDER BY created_at DESC
         LIMIT 5`,
        chatId ? [entityId, chatId] : [entityId]
      );

      results.push({
        entity,
        relations: relationsRes.rows,
        evidence: evidenceRes.rows,
      });
    }

    return results;
  } catch (error) {
    console.error('Failed to get entity context:', error);
    return [];
  }
}

/**
 * Build contextual text from knowledge graph for prompt augmentation
 * This enriches the LLM prompt with relevant graph information
 */
export async function buildGraphContext(userQuery: string, chatId: string): Promise<ContextResult> {
  try {
    // Extract entities mentioned in or relevant to the query
    const queryEntities = await extractQueryEntitiesForChat(userQuery, chatId);

    if (queryEntities.length === 0) {
      return {
        entities: [],
        relations: [],
        contextualText: '',
        citations: [],
        summary: 'No relevant knowledge graph context found.',
      };
    }

    // Get rich context for these entities
    const entityContexts = await getEntityContext(queryEntities.map((e) => e.id), chatId);

    // Build contextual text
    let contextualText = 'Knowledge Graph Context:\n\n';
    const citations: ContextResult['citations'] = [];

    for (const { entity, relations, evidence } of entityContexts) {
      contextualText += `**${entity.name}** (${entity.type}, confidence: ${(entity.confidence * 100).toFixed(0)}%)\n`;

      if (entity.description) {
        contextualText += `${entity.description}\n`;
      }

      // Add relations
      if (relations.length > 0) {
        contextualText += 'Relationships:\n';
        for (const rel of relations.slice(0, 5)) {
          const direction = rel.source_entity_id === entity.id ? '→' : '←';
          const otherName = rel.source_entity_id === entity.id ? rel.target_name : rel.source_name;
          contextualText += `  ${direction} ${rel.relation_type}: ${otherName}\n`;
        }
      }

      contextualText += '\n';

      // Collect citations
      if (evidence.length > 0) {
        citations.push({
          entityId: entity.id,
          evidence: evidence.slice(0, 3),
          confidence: entity.confidence,
        });
      }
    }

    // Get relation context if applicable
    const relationsRes = await pool.query(
      `SELECT r.id, r.source_entity_id, r.target_entity_id, r.relation_type, r.confidence,
              e1.name as source_name, e2.name as target_name
       FROM kg_relations r
       LEFT JOIN kg_entities e1 ON r.source_entity_id = e1.id
       LEFT JOIN kg_entities e2 ON r.target_entity_id = e2.id
       INNER JOIN kg_evidence ev ON ev.relation_id = r.id
       WHERE r.source_entity_id = ANY($1) OR r.target_entity_id = ANY($1)
       AND ev.source_chat_id = $2
       ORDER BY r.confidence DESC
       LIMIT 5`,
      [queryEntities.map((e) => e.id), chatId]
    );

    const relations = relationsRes.rows;

    // Build summary
    const summary = `Found ${queryEntities.length} entities and ${relations.length} relations in knowledge graph.`;

    return {
      entities: queryEntities,
      relations,
      contextualText,
      citations,
      summary,
    };
  } catch (error) {
    console.error('Failed to build graph context:', error);
    return {
      entities: [],
      relations: [],
      contextualText: '',
      citations: [],
      summary: 'Error building knowledge graph context.',
    };
  }
}

/**
 * Create a citation block from LLM response and knowledge graph evidence
 * Attaches citations to parts of the response that relate to graph entities/relations
 */
export async function createCitedResponse(
  responseText: string,
  entities: Entity[],
  chatId?: string
): Promise<CitationBlock[]> {
  try {
    const blocks: CitationBlock[] = [];
    const entityNames = entities.map((e) => e.name.toLowerCase());

    // Simple approach: look for entity mentions and collect their citations
    const sentences = responseText.split(/[.!?]+/).map((s) => s.trim());

    for (const sentence of sentences) {
      if (!sentence) continue;

      const sentenceLower = sentence.toLowerCase();
      const mentionedEntities: Entity[] = [];

      // Find which entities are mentioned in this sentence
      for (const entity of entities) {
        if (sentenceLower.includes(entity.name.toLowerCase())) {
          mentionedEntities.push(entity);
        }
      }

      if (mentionedEntities.length > 0) {
        // Get evidence for mentioned entities
        const citationsForSentence = [];

        for (const entity of mentionedEntities) {
          const evidenceRes = await pool.query(
            `SELECT source_id, source_chat_id, quote
             FROM kg_evidence
             WHERE entity_id = $1
             ${chatId ? 'AND source_chat_id = $2' : ''}
             ORDER BY created_at DESC
             LIMIT 2`,
            chatId ? [entity.id, chatId] : [entity.id]
          );

          for (const ev of evidenceRes.rows) {
            citationsForSentence.push({
              sourceId: ev.source_id,
              sourceChatId: ev.source_chat_id,
              quote: ev.quote,
              confidence: entity.confidence,
            });
          }
        }

        blocks.push({
          type: 'entity_mention',
          content: sentence + '.',
          citations: citationsForSentence,
        });
      } else {
        blocks.push({
          type: 'statement',
          content: sentence + '.',
          citations: [],
        });
      }
    }

    return blocks;
  } catch (error) {
    console.error('Failed to create cited response:', error);
    return [{ type: 'statement', content: responseText, citations: [] }];
  }
}

/**
 * Format citations for display in canvas/artifact
 */
export function formatCitations(citationBlocks: CitationBlock[]): string {
  let formatted = '';

  for (const block of citationBlocks) {
    formatted += block.content;

    if (block.citations.length > 0) {
      formatted += ' [';
      formatted += block.citations
        .map(
          (c, i) =>
            `Citation ${i + 1}: ${c.quote || 'Evidence from ' + c.sourceId}`
        )
        .join('; ');
      formatted += ']\n\n';
    } else {
      formatted += '\n\n';
    }
  }

  return formatted;
}

/**
 * Augment RAG results with knowledge graph context (if entities are mentioned)
 */
export async function augmentRAGWithGraphContext(
  ragResults: Array<{ text: string; source: string; score: number }>,
  userQuery: string,
  chatId: string
): Promise<{
  enhancedResults: typeof ragResults;
  graphContext?: ContextResult;
  combinedScore: number;
}> {
  try {
    // Extract entities from query
    const queryEntities = await extractQueryEntitiesForChat(userQuery, chatId);

    if (queryEntities.length === 0) {
      return {
        enhancedResults: ragResults,
        combinedScore:
          ragResults.length > 0 ? ragResults.reduce((sum, r) => sum + r.score, 0) / ragResults.length : 0,
      };
    }

    // Get graph context
    const graphContext = await buildGraphContext(userQuery, chatId);

    // Enrich each RAG result with graph context
    const enhancedResults = ragResults.map((result) => ({
      ...result,
      graphContextual: graphContext.contextualText,
    }));

    // Calculate combined confidence
    const ragScore = ragResults.length > 0 ? ragResults.reduce((sum, r) => sum + r.score, 0) / ragResults.length : 0;
    const graphConfidence =
      queryEntities.length > 0
        ? queryEntities.reduce((sum, e) => sum + e.confidence, 0) / queryEntities.length
        : 0;
    const combinedScore = (ragScore + graphConfidence) / 2;

    return {
      enhancedResults,
      graphContext,
      combinedScore,
    };
  } catch (error) {
    console.error('Failed to augment RAG with graph context:', error);
    return {
      enhancedResults: ragResults,
      combinedScore: 0,
    };
  }
}

/**
 * Check if a claim can be supported by knowledge graph evidence
 * Used for claim verification/grounding
 */
export async function verifyClaim(
  claim: string,
  confidenceThreshold: number = 0.7,
  chatId?: string
): Promise<{ verified: boolean; evidence: Evidence[]; confidence: number }> {
  try {
    // Extract entities from claim
    const tokens = claim.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    if (tokens.length === 0) {
      return { verified: false, evidence: [], confidence: 0 };
    }

    // Search for supporting evidence
    const placeholders = tokens.map((_, i) => `$${i + 1}`).join(',');
    const chatFilterParam = chatId ? `$${tokens.length + 1}` : null;
    const result = await pool.query(
      `SELECT DISTINCT e.id, e.confidence, ev.id as evidence_id, ev.quote, ev.context, ev.source_id, ev.source_chat_id, ev.extraction_method, ev.created_at
       FROM kg_entities e
       INNER JOIN kg_evidence ev ON e.id = ev.entity_id
       WHERE (
         LOWER(e.name) LIKE ANY(ARRAY[${placeholders}])
         OR LOWER(e.description) LIKE ANY(ARRAY[${placeholders}])
       )
       ${chatFilterParam ? `AND ev.source_chat_id = ${chatFilterParam}` : ''}
       ORDER BY e.confidence DESC
       LIMIT 5`,
      [...tokens.map((t) => `%${t}%`), ...(chatId ? [chatId] : [])]
    );

    const evidence: Evidence[] = result.rows.map((r) => ({
      id: r.evidence_id,
      quote: r.quote,
      context: r.context,
      source_id: r.source_id,
      source_chat_id: r.source_chat_id,
      extraction_method: r.extraction_method,
      created_at: r.created_at,
    }));

    const avgConfidence =
      result.rows.length > 0
        ? result.rows.reduce((sum, r) => sum + (r.confidence || 0), 0) / result.rows.length
        : 0;

    const verified = evidence.length > 0 && avgConfidence >= confidenceThreshold;

    return {
      verified,
      evidence,
      confidence: avgConfidence,
    };
  } catch (error) {
    console.error('Failed to verify claim:', error);
    return { verified: false, evidence: [], confidence: 0 };
  }
}
