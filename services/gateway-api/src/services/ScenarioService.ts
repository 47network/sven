import { getPool } from '../db/pool.js';
import { nanoid } from 'nanoid';
import { isUuid } from '../lib/input-validation.js';

/**
 * Scenario Management Service
 * Manages synthetic test scenarios for regression testing
 */

interface Scenario {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  category?: string;
  chatId: string;
  userMessage: string;
  expectedAssistantResponse?: string;
  expectedToolCalls?: any[];
  expectedApprovalsRequired?: boolean;
  tags?: string[];
  priority: number;
  isActive: boolean;
}

interface ScenarioVariation {
  id: string;
  scenarioId: string;
  name?: string;
  parameters?: any;
  overrideMessage?: string;
  overrideExpectedResponse?: string;
}

const pool = getPool();

/**
 * Create a new scenario
 */
export async function createScenario(
  name: string,
  description: string,
  category: string,
  chatId: string,
  organizationId: string,
  actorUserId: string,
  userMessage: string,
  expectedAssistantResponse?: string,
  expectedToolCalls?: any[],
  expectedApprovalsRequired?: boolean,
  tags?: string[],
  priority?: number
): Promise<Scenario> {
  try {
    const result = await pool.query(
      `INSERT INTO scenarios (
        name, description, category, chat_id, organization_id, user_message,
        expected_assistant_response, expected_tool_calls, expected_approvals_required,
        tags, priority
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, description, category, chat_id, organization_id, user_message,
                 expected_assistant_response, expected_tool_calls,
                 expected_approvals_required, tags, priority, is_active`,
      [
        name,
        description,
        category,
        chatId,
        organizationId,
        userMessage,
        expectedAssistantResponse,
        expectedToolCalls ? JSON.stringify(expectedToolCalls) : null,
        expectedApprovalsRequired,
        tags || [],
        priority || 0,
      ]
    );

    const row = result.rows[0];
    await logReplayAction('scenario_created', 'scenario', row.id, actorUserId, {
      name,
      category,
    });

    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      category: row.category,
      chatId: row.chat_id,
      userMessage: row.user_message,
      expectedAssistantResponse: row.expected_assistant_response,
      expectedToolCalls: row.expected_tool_calls,
      expectedApprovalsRequired: row.expected_approvals_required,
      tags: row.tags,
      priority: row.priority,
      isActive: row.is_active,
    };
  } catch (error) {
    console.error('Failed to create scenario:', error);
    throw error;
  }
}

/**
 * Get all scenarios
 */
export async function getAllScenarios(
  category?: string,
  activeOnly = true,
  organizationId?: string
): Promise<Scenario[]> {
  try {
    let query = `SELECT id, name, description, category, chat_id, user_message,
                        expected_assistant_response, expected_tool_calls,
                        expected_approvals_required, tags, priority, is_active
                 FROM scenarios`;

    const params: any[] = [];
    const conditions: string[] = [];

    if (activeOnly) {
      conditions.push('is_active = TRUE');
    }
    if (organizationId) {
      params.push(organizationId);
      conditions.push(`organization_id = $${params.length}`);
    }

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const finalQuery = `${query}${whereClause} ORDER BY priority DESC, name`;

    const result = await pool.query(finalQuery, params);

    return result.rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description,
      category: r.category,
      chatId: r.chat_id,
      userMessage: r.user_message,
      expectedAssistantResponse: r.expected_assistant_response,
      expectedToolCalls: r.expected_tool_calls,
      expectedApprovalsRequired: r.expected_approvals_required,
      tags: r.tags,
      priority: r.priority,
      isActive: r.is_active,
    }));
  } catch (error) {
    console.error('Failed to get scenarios:', error);
    return [];
  }
}

/**
 * Get scenario by ID
 */
export async function getScenarioById(scenarioId: string, organizationId?: string): Promise<Scenario | null> {
  try {
    const query = `SELECT id, name, description, category, chat_id, organization_id, user_message,
              expected_assistant_response, expected_tool_calls,
              expected_approvals_required, tags, priority, is_active
       FROM scenarios WHERE id = $1`;
    const params: any[] = [scenarioId];
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    if (organizationId) {
      params.push(organizationId);
    }
    const finalQuery = `${query}${orgClause}`;
    const result = await pool.query(
      finalQuery,
      params
    );

    if (result.rows.length === 0) return null;

    const r = result.rows[0];
    return {
      id: r.id,
      organizationId: r.organization_id,
      name: r.name,
      description: r.description,
      category: r.category,
      chatId: r.chat_id,
      userMessage: r.user_message,
      expectedAssistantResponse: r.expected_assistant_response,
      expectedToolCalls: r.expected_tool_calls,
      expectedApprovalsRequired: r.expected_approvals_required,
      tags: r.tags,
      priority: r.priority,
      isActive: r.is_active,
    };
  } catch (error) {
    console.error('Failed to get scenario:', error);
    return null;
  }
}

/**
 * Update scenario
 */
export async function updateScenario(
  scenarioId: string,
  updates: Partial<Scenario>,
  organizationId?: string,
  actorUserId?: string
): Promise<boolean> {
  try {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      sets.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      sets.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    if (updates.isActive !== undefined) {
      sets.push(`is_active = $${paramIndex++}`);
      params.push(updates.isActive);
    }
    if (updates.priority !== undefined) {
      sets.push(`priority = $${paramIndex++}`);
      params.push(updates.priority);
    }

    if (sets.length === 0) return false;

    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(scenarioId);
    const query = `UPDATE scenarios SET ${sets.join(', ')} WHERE id = $${paramIndex}`;
    let orgClause = '';
    if (organizationId) {
      params.push(organizationId);
      orgClause = ` AND organization_id = $${paramIndex + 1}`;
    }
    const finalQuery = `${query}${orgClause} RETURNING id`;

    const result = await pool.query(finalQuery, params);

    if (result.rows.length > 0) {
      await logReplayAction('scenario_updated', 'scenario', scenarioId, actorUserId || '', updates);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to update scenario:', error);
    throw error;
  }
}

/**
 * Delete scenario
 */
export async function deleteScenario(scenarioId: string, organizationId?: string, actorUserId?: string): Promise<boolean> {
  try {
    const query = `DELETE FROM scenarios WHERE id = $1`;
    const params: any[] = [scenarioId];
    const orgClause = organizationId ? ' AND organization_id = $2' : '';
    if (organizationId) {
      params.push(organizationId);
    }
    const finalQuery = `${query}${orgClause} RETURNING id`;
    const result = await pool.query(finalQuery, params);

    if (result.rows.length > 0) {
      await logReplayAction('scenario_deleted', 'scenario', scenarioId, actorUserId || '', {});
      return true;
    }

    return false;
  } catch (error) {
    console.error('Failed to delete scenario:', error);
    throw error;
  }
}

/**
 * Create scenario variation (e.g., different user context)
 */
export async function createScenarioVariation(
  scenarioId: string,
  name: string,
  parameters: any,
  organizationId: string,
  overrideMessage?: string,
  overrideExpectedResponse?: string,
  overrideExpectedTools?: any[]
): Promise<ScenarioVariation> {
  try {
    const scopedOrgId = String(organizationId || '').trim();
    if (!scopedOrgId) {
      throw new Error('organizationId is required for scenario variation create');
    }
    const result = await pool.query(
      `INSERT INTO scenario_variations (
        scenario_id, name, parameters, override_message,
        override_expected_response, override_expected_tools
      )
       SELECT $1, $2, $3, $4, $5, $6
       FROM scenarios s
       WHERE s.id = $1 AND s.organization_id = $7
       RETURNING id, scenario_id, name, parameters, override_message,
                 override_expected_response, override_expected_tools`,
      [
        scenarioId,
        name,
        JSON.stringify(parameters),
        overrideMessage,
        overrideExpectedResponse,
        overrideExpectedTools ? JSON.stringify(overrideExpectedTools) : null,
        scopedOrgId,
      ]
    );
    if (result.rows.length === 0) {
      throw new Error('Scenario not found in active organization');
    }

    const row = result.rows[0];
    return {
      id: row.id,
      scenarioId: row.scenario_id,
      name: row.name,
      parameters: row.parameters,
      overrideMessage: row.override_message,
      overrideExpectedResponse: row.override_expected_response,
    };
  } catch (error) {
    console.error('Failed to create scenario variation:', error);
    throw error;
  }
}

/**
 * Get all variations for a scenario
 */
export async function getScenarioVariations(
  scenarioId: string,
  organizationId?: string
): Promise<ScenarioVariation[]> {
  try {
    if (!organizationId) return [];
    let query = `SELECT v.id, v.scenario_id, v.name, v.parameters, v.override_message,
              v.override_expected_response, v.override_expected_tools
       FROM scenario_variations v
       JOIN scenarios s ON s.id = v.scenario_id
       WHERE v.scenario_id = $1`;
    const params: any[] = [scenarioId];
    if (organizationId) {
      query += ' AND s.organization_id = $2';
      params.push(organizationId);
    }
    query += ' ORDER BY v.created_at';
    const result = await pool.query(query, params);

    return result.rows.map((r) => ({
      id: r.id,
      scenarioId: r.scenario_id,
      name: r.name,
      parameters: r.parameters,
      overrideMessage: r.override_message,
      overrideExpectedResponse: r.override_expected_response,
    }));
  } catch (error) {
    console.error('Failed to get scenario variations:', error);
    return [];
  }
}

/**
 * Get scenario categories
 */
export async function getScenarioCategories(organizationId?: string): Promise<string[]> {
  try {
    let query = `SELECT DISTINCT category FROM scenarios WHERE category IS NOT NULL`;
    const params: any[] = [];
    if (organizationId) {
      query += ' AND organization_id = $1';
      params.push(organizationId);
    }
    query += ' ORDER BY category';
    const result = await pool.query(query, params);

    return result.rows.map((r) => r.category);
  } catch (error) {
    console.error('Failed to get scenario categories:', error);
    return [];
  }
}

/**
 * Log replay action
 */
export async function logReplayAction(
  actionType: string,
  resourceType: string,
  resourceId: string,
  actorUserId: string,
  details: any
): Promise<void> {
  if (!isUuid(actorUserId)) {
    const error = new Error('Replay audit actor_user_id must be a UUID');
    (error as Error & { code?: string }).code = 'REPLAY_AUDIT_INVALID_ACTOR';
    throw error;
  }
  try {
    await pool.query(
      `INSERT INTO replay_audit_log (action_type, resource_type, resource_id, actor_user_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actionType, resourceType, resourceId, actorUserId, JSON.stringify(details || {})]
    );
  } catch (error) {
    console.error('Failed to log replay action:', error);
    const wrapped = new Error('Replay audit log write failed');
    (wrapped as Error & { code?: string }).code = 'REPLAY_AUDIT_WRITE_FAILED';
    throw wrapped;
  }
}

/**
 * Get scenario statistics
 */
export async function getScenarioStatistics(organizationId?: string): Promise<{
  totalScenarios: number;
  activeScenarios: number;
  scenariosByCategory: { [key: string]: number };
  averagePriority: number;
}> {
  try {
    const predicate = organizationId ? ' WHERE organization_id = $1' : '';
    const params = organizationId ? [organizationId] : [];
    const activePredicate = organizationId ? ' WHERE is_active = TRUE AND organization_id = $1' : ' WHERE is_active = TRUE';
    const categoryPredicate = organizationId ? ' WHERE organization_id = $1' : '';
    const priorityPredicate = organizationId ? ' WHERE organization_id = $1' : '';

    const totalResult = await pool.query(`SELECT COUNT(*) as count FROM scenarios${predicate}`, params);
    const activeResult = await pool.query(`SELECT COUNT(*) as count FROM scenarios${activePredicate}`, params);
    const categoryResult = await pool.query(`SELECT category, COUNT(*) as count FROM scenarios${categoryPredicate} GROUP BY category`, params);
    const priorityResult = await pool.query(`SELECT AVG(priority) as avg FROM scenarios${priorityPredicate}`, params);

    const scenariosByCategory: { [key: string]: number } = {};
    categoryResult.rows.forEach((r) => {
      scenariosByCategory[r.category || 'uncategorized'] = r.count;
    });

    return {
      totalScenarios: parseInt(totalResult.rows[0].count),
      activeScenarios: parseInt(activeResult.rows[0].count),
      scenariosByCategory,
      averagePriority: parseFloat(priorityResult.rows[0].avg || 0),
    };
  } catch (error) {
    console.error('Failed to get scenario statistics:', error);
    return {
      totalScenarios: 0,
      activeScenarios: 0,
      scenariosByCategory: {},
      averagePriority: 0,
    };
  }
}
