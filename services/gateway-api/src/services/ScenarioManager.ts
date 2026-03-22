import { getPool } from '../db/pool.js';
import { executePoolTransaction } from './transaction-utils.js';
import { createReplayEntityId } from './scenario-ids.js';

/**
 * Scenario Manager Service
 * CRUD operations and lifecycle management for test scenarios and suites
 */

interface ListFilter {
  status?: string;
  category?: string;
  scenarioType?: string;
  enabled?: boolean;
}

const pool = getPool();

/**
 * Create a new scenario suite
 */
export async function createSuite(
  name: string,
  description: string,
  userId: string,
  tags: string[] = []
): Promise<{ id: string; name: string; status: string; version: number }> {
  try {
    const id = createReplayEntityId();
    const result = await pool.query(
      `INSERT INTO replay_scenario_suites (id, name, description, tags, created_by, status, version, scenario_count)
       VALUES ($1, $2, $3, $4, $5, 'draft', 1, 0)
       RETURNING id, name, status, version`,
      [id, name, description, tags, userId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Failed to create suite:', error);
    throw error;
  }
}

/**
 * Get suite by ID
 */
export async function getSuite(suiteId: string): Promise<{
  id: string;
  name: string;
  description: string;
  version: number;
  status: string;
  scenario_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
} | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, description, version, status, scenario_count, tags, created_at, updated_at
       FROM replay_scenario_suites WHERE id = $1`,
      [suiteId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Failed to get suite:', error);
    return null;
  }
}

/**
 * List all scenario suites
 */
export async function listSuites(
  filter?: { status?: string; tags?: string[] }
): Promise<Array<{
  id: string;
  name: string;
  status: string;
  version: number;
  scenario_count: number;
  updated_at: string;
}>> {
  try {
    let query = `SELECT id, name, status, version, scenario_count, updated_at
                 FROM replay_scenario_suites WHERE 1=1`;
    const params: any[] = [];

    if (filter?.status) {
      params.push(filter.status);
      query += ` AND status = $${params.length}`;
    }

    if (filter?.tags && filter.tags.length > 0) {
      params.push(filter.tags);
      query += ` AND tags && $${params.length}`;
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Failed to list suites:', error);
    return [];
  }
}

/**
 * Update suite metadata
 */
export async function updateSuite(
  suiteId: string,
  updates: { name?: string; description?: string; status?: string; tags?: string[] }
): Promise<boolean> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(updates.description);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex}`);
      values.push(updates.status);
      paramIndex++;
    }

    if (updates.tags !== undefined) {
      fields.push(`tags = $${paramIndex}`);
      values.push(updates.tags);
      paramIndex++;
    }

    if (fields.length === 0) return true;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(suiteId);

    const query = `UPDATE replay_scenario_suites SET ${fields.join(', ')} WHERE id = $${paramIndex}`;

    await pool.query(query, values);
    return true;
  } catch (error) {
    console.error('Failed to update suite:', error);
    return false;
  }
}

/**
 * Delete a scenario suite
 */
export async function deleteSuite(suiteId: string): Promise<boolean> {
  try {
    const result = await executePoolTransaction(pool, async (client) => {
      // Delete associated scenarios, runs, deltas first
      await client.query(`DELETE FROM replay_output_deltas 
                      WHERE run_id IN (SELECT id FROM replay_runs WHERE suite_id = $1)`, [suiteId]);
      await client.query(`DELETE FROM replay_runs WHERE suite_id = $1`, [suiteId]);
      await client.query(`DELETE FROM replay_scenarios WHERE suite_id = $1`, [suiteId]);

      // Delete suite
      return await client.query(`DELETE FROM replay_scenario_suites WHERE id = $1`, [suiteId]);
    });

    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Failed to delete suite:', error);
    return false;
  }
}

/**
 * Create a new test scenario
 */
export async function createScenario(
  suiteId: string,
  name: string,
  config: {
    scenarioType: string;
    category: string;
    priority: number;
    inputMessage: string;
    expectedStatus: string;
    expectedAssistantResponse?: any;
    expectedToolCalls?: any[];
    expectedApprovals?: boolean;
    expectedCanvasBlocks?: any;
  }
): Promise<{ id: string; name: string; scenario_type: string; priority: number } | null> {
  try {
    const id = createReplayEntityId();
    const result = await executePoolTransaction(pool, async (client) => {
      const insertResult = await client.query(
        `INSERT INTO replay_scenarios (
          id, suite_id, name, description, scenario_type, category, priority,
          input_message, expected_status, expected_assistant_response, 
          expected_tool_calls, expected_approvals, expected_canvas_blocks, enabled
         ) VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8, $9, $10, $11, $12, TRUE)
         RETURNING id, name, scenario_type, priority`,
        [
          id,
          suiteId,
          name,
          config.scenarioType,
          config.category,
          config.priority,
          config.inputMessage,
          config.expectedStatus,
          JSON.stringify(config.expectedAssistantResponse || {}),
          JSON.stringify(config.expectedToolCalls || []),
          config.expectedApprovals || false,
          JSON.stringify(config.expectedCanvasBlocks || {}),
        ]
      );

      // Increment scenario count
      await client.query(`UPDATE replay_scenario_suites SET scenario_count = scenario_count + 1 WHERE id = $1`, [
        suiteId,
      ]);

      return insertResult;
    });

    return result.rows[0];
  } catch (error) {
    console.error('Failed to create scenario:', error);
    return null;
  }
}

/**
 * Get scenario by ID
 */
export async function getScenario(scenarioId: string): Promise<{
  id: string;
  name: string;
  scenario_type: string;
  category: string;
  priority: number;
  enabled: boolean;
  input_message: string;
  expected_status: string;
  expected_assistant_response: any;
  expected_tool_calls: any[];
  run_count: number;
  pass_count: number;
  last_run_at?: string;
} | null> {
  try {
    const result = await pool.query(
      `SELECT id, name, scenario_type, category, priority, enabled, 
              input_message, expected_status, expected_assistant_response,
              expected_tool_calls, run_count, pass_count, last_run_at
       FROM replay_scenarios WHERE id = $1`,
      [scenarioId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Failed to get scenario:', error);
    return null;
  }
}

/**
 * List scenarios in a suite
 */
export async function listScenarios(
  suiteId: string,
  filter?: ListFilter
): Promise<Array<{
  id: string;
  name: string;
  scenario_type: string;
  category: string;
  priority: number;
  enabled: boolean;
  run_count: number;
  pass_count: number;
  pass_rate: number;
}>> {
  try {
    let query = `SELECT id, name, scenario_type, category, priority, enabled, run_count, pass_count,
                        CASE WHEN run_count > 0 THEN (pass_count::FLOAT / run_count * 100)::INT ELSE 0 END as pass_rate
                 FROM replay_scenarios WHERE suite_id = $1`;
    const params: any[] = [suiteId];

    if (filter?.enabled !== undefined) {
      params.push(filter.enabled);
      query += ` AND enabled = $${params.length}`;
    }

    if (filter?.category) {
      params.push(filter.category);
      query += ` AND category = $${params.length}`;
    }

    if (filter?.scenarioType) {
      params.push(filter.scenarioType);
      query += ` AND scenario_type = $${params.length}`;
    }

    query += ` ORDER BY priority DESC, name`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Failed to list scenarios:', error);
    return [];
  }
}

/**
 * Update scenario configuration
 */
export async function updateScenario(
  scenarioId: string,
  updates: {
    name?: string;
    priority?: number;
    enabled?: boolean;
    expectedStatus?: string;
    expectedAssistantResponse?: any;
    expectedToolCalls?: any[];
  }
): Promise<boolean> {
  try {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updates.name);
      paramIndex++;
    }

    if (updates.priority !== undefined) {
      fields.push(`priority = $${paramIndex}`);
      values.push(updates.priority);
      paramIndex++;
    }

    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${paramIndex}`);
      values.push(updates.enabled);
      paramIndex++;
    }

    if (updates.expectedStatus !== undefined) {
      fields.push(`expected_status = $${paramIndex}`);
      values.push(updates.expectedStatus);
      paramIndex++;
    }

    if (updates.expectedAssistantResponse !== undefined) {
      fields.push(`expected_assistant_response = $${paramIndex}`);
      values.push(JSON.stringify(updates.expectedAssistantResponse));
      paramIndex++;
    }

    if (updates.expectedToolCalls !== undefined) {
      fields.push(`expected_tool_calls = $${paramIndex}`);
      values.push(JSON.stringify(updates.expectedToolCalls));
      paramIndex++;
    }

    if (fields.length === 0) return true;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(scenarioId);

    const query = `UPDATE replay_scenarios SET ${fields.join(', ')} WHERE id = $${paramIndex}`;

    await pool.query(query, values);
    return true;
  } catch (error) {
    console.error('Failed to update scenario:', error);
    return false;
  }
}

/**
 * Delete a scenario
 */
export async function deleteScenario(scenarioId: string): Promise<boolean> {
  try {
    const result = await executePoolTransaction(pool, async (client) => {
      // Get suite ID first
      const scenarioResult = await client.query(`SELECT suite_id FROM replay_scenarios WHERE id = $1`, [
        scenarioId,
      ]);

      if (scenarioResult.rows.length === 0) {
        return null;
      }

      const suiteId = scenarioResult.rows[0].suite_id;

      // Delete runs and deltas
      await client.query(`DELETE FROM replay_output_deltas WHERE run_id IN (SELECT id FROM replay_runs WHERE scenario_id = $1)`, [
        scenarioId,
      ]);
      await client.query(`DELETE FROM replay_runs WHERE scenario_id = $1`, [scenarioId]);

      // Delete scenario
      const deleteResult = await client.query(`DELETE FROM replay_scenarios WHERE id = $1`, [scenarioId]);

      // Decrement suite scenario count
      await client.query(`UPDATE replay_scenario_suites SET scenario_count = GREATEST(scenario_count - 1, 0) WHERE id = $1`, [
        suiteId,
      ]);

      return deleteResult;
    });

    if (!result) {
      return false;
    }

    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    console.error('Failed to delete scenario:', error);
    return false;
  }
}

/**
 * Get scenario statistics
 */
export async function getScenarioStats(scenarioId: string): Promise<{
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  passRate: number;
  avgExecutionTime: number;
  lastRunAt?: string;
} | null> {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_runs,
         SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_runs,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
         AVG(execution_duration_ms) as avg_duration,
         MAX(run_timestamp) as last_run_at
       FROM replay_runs WHERE scenario_id = $1`,
      [scenarioId]
    );

    const stats = result.rows[0];
    const totalRuns = parseInt(stats.total_runs) || 0;
    const passedRuns = parseInt(stats.passed_runs) || 0;

    return {
      totalRuns,
      passedRuns,
      failedRuns: parseInt(stats.failed_runs) || 0,
      passRate: totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0,
      avgExecutionTime: parseFloat(stats.avg_duration) || 0,
      lastRunAt: stats.last_run_at,
    };
  } catch (error) {
    console.error('Failed to get scenario stats:', error);
    return null;
  }
}

/**
 * Enable/disable scenario
 */
export async function toggleScenario(scenarioId: string, enabled: boolean): Promise<boolean> {
  try {
    await pool.query(`UPDATE replay_scenarios SET enabled = $1 WHERE id = $2`, [enabled, scenarioId]);
    return true;
  } catch (error) {
    console.error('Failed to toggle scenario:', error);
    return false;
  }
}

/**
 * Get high-priority failing scenarios
 */
export async function getFailingScenarios(suiteId: string, minPriority: number = 7): Promise<Array<{
  id: string;
  name: string;
  priority: number;
  pass_rate: number;
  run_count: number;
}>> {
  try {
    const result = await pool.query(
      `SELECT id, name, priority, run_count, 
              CASE WHEN run_count > 0 THEN (pass_count::FLOAT / run_count * 100) ELSE 0 END as pass_rate
       FROM replay_scenarios
       WHERE suite_id = $1 AND priority >= $2 AND enabled = TRUE
       AND (run_count = 0 OR pass_count < run_count)
       ORDER BY priority DESC, pass_rate ASC`,
      [suiteId, minPriority]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to get failing scenarios:', error);
    return [];
  }
}

/**
 * Clone a scenario
 */
export async function cloneScenario(
  scenarioId: string,
  newSuiteId: string,
  namePrefix: string = 'Copy of'
): Promise<{ id: string; name: string } | null> {
  try {
    // Get original scenario
    const original = await getScenario(scenarioId);
    if (!original) return null;

    // Create new scenario with same config
    const newScenario = await createScenario(newSuiteId, `${namePrefix} ${original.name}`, {
      scenarioType: original.scenario_type,
      category: original.category,
      priority: original.priority,
      inputMessage: original.input_message,
      expectedStatus: original.expected_status,
      expectedAssistantResponse: original.expected_assistant_response,
      expectedToolCalls: original.expected_tool_calls,
    });

    return newScenario;
  } catch (error) {
    console.error('Failed to clone scenario:', error);
    return null;
  }
}

/**
 * Get all scenarios across all suites (for global search)
 */
export async function searchScenarios(query: string, limit: number = 20): Promise<Array<{
  id: string;
  name: string;
  suite_id: string;
  scenario_type: string;
  priority: number;
}>> {
  try {
    const searchQuery = `%${query}%`;
    const result = await pool.query(
      `SELECT id, name, suite_id, scenario_type, priority
       FROM replay_scenarios
       WHERE name ILIKE $1 OR description ILIKE $1
       ORDER BY priority DESC LIMIT $2`,
      [searchQuery, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to search scenarios:', error);
    return [];
  }
}
