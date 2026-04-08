import { getPool } from '../db/pool.js';
import * as ScenarioService from './ScenarioService.js';

/**
 * Replay Service
 * Executes scenarios and compares outputs for regression testing
 */

interface ReplayRun {
  id: string;
  name: string;
  buildVersion?: string;
  status: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
}

interface ReplayResult {
  scenarioId: string;
  passed: boolean;
  actualAssistantResponse?: string;
  actualToolCalls?: any[];
  mismatches?: any;
  similarityScore?: number;
  error?: string;
}

interface OutputDelta {
  type: 'assistant_response_changed' | 'tool_call_added' | 'tool_call_removed' | 'approval_changed';
  scenarioId: string;
  expectedValue?: any;
  actualValue?: any;
}

const pool = getPool();

class ReplayRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Replay run not found: ${runId}`);
    this.name = 'ReplayRunNotFoundError';
  }
}

class ReplayRunNotReadyError extends Error {
  constructor(runId: string, status: string) {
    super(`Replay run ${runId} is not comparison-ready (status=${status})`);
    this.name = 'ReplayRunNotReadyError';
  }
}

class ReplayExecutionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayExecutionUnavailableError';
  }
}

function resolveReplayLiveExecutionConfig(apiBaseUrl: string): {
  base: string;
  bearerToken: string;
  sessionCookie: string;
} {
  const executionMode = String(process.env.SVEN_REPLAY_EXECUTION_MODE || 'disabled').trim().toLowerCase();
  if (executionMode !== 'live') {
    throw new ReplayExecutionUnavailableError(
      'Replay live execution is disabled. Set SVEN_REPLAY_EXECUTION_MODE=live and provide replay auth credentials.',
    );
  }

  const bearerToken = String(process.env.SVEN_REPLAY_BEARER_TOKEN || '').trim();
  const sessionCookie = String(process.env.SVEN_REPLAY_SESSION_COOKIE || '').trim();
  if (!bearerToken && !sessionCookie) {
    throw new ReplayExecutionUnavailableError(
      'Replay live execution requires SVEN_REPLAY_BEARER_TOKEN or SVEN_REPLAY_SESSION_COOKIE.',
    );
  }

  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new ReplayExecutionUnavailableError('Replay live execution requires a valid SVEN_API_URL base.');
  }

  return { base, bearerToken, sessionCookie };
}

function normalizeReplayScenarioIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    if (raw.length > 500) {
      throw new Error('scenario_ids exceeds maximum of 500 entries');
    }
    const normalized = raw
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
    if (normalized.length === 0) {
      throw new Error('Invalid replay run scenario_ids payload');
    }
    return normalized;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new Error('Invalid replay run scenario_ids payload');
    }
    const parsed = JSON.parse(trimmed);
    return normalizeReplayScenarioIds(parsed);
  }

  throw new Error('Invalid replay run scenario_ids payload');
}

/**
 * Create a new replay run
 */
export async function createReplayRun(
  name: string,
  description: string,
  buildVersion: string,
  scenarioIds: string[],
  filterCategory?: string,
  organizationId?: string,
  actorUserId?: string
): Promise<ReplayRun> {
  try {
    if (!organizationId) {
      throw new Error('organizationId is required for replay runs');
    }
    const result = await pool.query(
      `INSERT INTO replay_runs (
        name, description, build_version, scenario_ids, organization_id,
        filter_category, status, total_scenarios
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING id, name, build_version, status, total_scenarios,
                 passed_scenarios, failed_scenarios`,
      [name, description, buildVersion, scenarioIds, organizationId, filterCategory, scenarioIds.length]
    );

    const row = result.rows[0];
    await ScenarioService.logReplayAction('replay_created', 'replay_run', row.id, String(actorUserId || ''), {
      name,
      buildVersion,
      scenarioCount: scenarioIds.length,
    });

    return {
      id: row.id,
      name: row.name,
      buildVersion: row.build_version,
      status: row.status,
      totalScenarios: row.total_scenarios,
      passedScenarios: row.passed_scenarios,
      failedScenarios: row.failed_scenarios,
    };
  } catch (error) {
    console.error('Failed to create replay run:', error);
    throw error;
  }
}

/**
 * Get replay run by ID
 */
export async function getReplayRun(replayRunId: string, organizationId?: string): Promise<ReplayRun | null> {
  try {
    if (!organizationId) return null;
    const result = await pool.query(
      `SELECT id, name, build_version, status, total_scenarios,
              passed_scenarios, failed_scenarios
       FROM replay_runs WHERE id = $1 AND organization_id = $2`,
      [replayRunId, organizationId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      buildVersion: row.build_version,
      status: row.status,
      totalScenarios: row.total_scenarios,
      passedScenarios: row.passed_scenarios,
      failedScenarios: row.failed_scenarios,
    };
  } catch (error) {
    console.error('Failed to get replay run:', error);
    return null;
  }
}

/**
 * Execute a scenario and return results
 */
export async function executeScenario(
  scenarioId: string,
  replayRunId: string,
  apiBaseUrl: string,
  organizationId?: string
): Promise<ReplayResult> {
  try {
    const scenario = await ScenarioService.getScenarioById(scenarioId, organizationId);
    if (!scenario) {
      return {
        scenarioId,
        passed: false,
        error: 'Scenario not found',
      };
    }

    const startTime = new Date();

    const actualResponse = await runScenarioLiveExecution(scenario, apiBaseUrl, startTime);

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    // Compare outputs
    const comparison = compareOutputs(
      scenario.expectedAssistantResponse,
      scenario.expectedToolCalls,
      scenario.expectedApprovalsRequired,
      actualResponse
    );

    // Store result in database
    await pool.query(
      `INSERT INTO replay_results (
        replay_run_id, scenario_id, start_time, end_time, duration_seconds,
        actual_assistant_response, actual_tool_calls, actual_approvals_required,
        passed, mismatches, similarity_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        replayRunId,
        scenarioId,
        startTime,
        endTime,
        duration,
        actualResponse.assistantResponse,
        JSON.stringify(actualResponse.toolCalls),
        actualResponse.approvalsRequired,
        comparison.passed,
        JSON.stringify(comparison.mismatches),
        comparison.similarityScore,
      ]
    );

    return {
      scenarioId,
      passed: comparison.passed,
      actualAssistantResponse: actualResponse.assistantResponse,
      actualToolCalls: actualResponse.toolCalls,
      mismatches: comparison.mismatches,
      similarityScore: comparison.similarityScore,
    };
  } catch (error) {
    console.error('Failed to execute scenario:', error);
    return {
      scenarioId,
      passed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute scenario against live chat API and wait for assistant output.
 */
async function runScenarioLiveExecution(
  scenario: any,
  apiBaseUrl: string,
  startTime: Date
): Promise<{
  assistantResponse?: string;
  toolCalls?: any[];
  approvalsRequired?: boolean;
}> {
  const { base, bearerToken, sessionCookie } = resolveReplayLiveExecutionConfig(apiBaseUrl);

  const chatId = String(scenario?.chatId || '').trim();
  const userMessage = String(scenario?.userMessage || '').trim();
  if (!chatId || !userMessage) {
    throw new ReplayExecutionUnavailableError('Scenario must include chatId and userMessage for live execution.');
  }

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;
  if (sessionCookie) headers.cookie = sessionCookie;

  const sendResponse = await fetch(`${base}/v1/chats/${encodeURIComponent(chatId)}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: userMessage }),
  });
  if (!sendResponse.ok) {
    const responseBody = await sendResponse.text().catch(() => '');
    throw new Error(`Replay live send failed (${sendResponse.status}): ${responseBody.slice(0, 400)}`);
  }

  const timeoutMs = Number(process.env.SVEN_REPLAY_POLL_TIMEOUT_MS || 45000);
  const intervalMs = Number(process.env.SVEN_REPLAY_POLL_INTERVAL_MS || 1500);
  const startedEpoch = startTime.getTime();
  const deadline = Date.now() + Math.max(1000, Number.isFinite(timeoutMs) ? timeoutMs : 45000);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(200, Number.isFinite(intervalMs) ? intervalMs : 1500)));

    const messagesResponse = await fetch(
      `${base}/v1/chats/${encodeURIComponent(chatId)}/messages?limit=200`,
      { method: 'GET', headers },
    );
    if (!messagesResponse.ok) {
      continue;
    }
    const payload = await messagesResponse.json().catch(() => null) as any;
    const rows = Array.isArray(payload?.data?.rows) ? payload.data.rows : [];
    const assistantRows = rows
      .filter((row: any) => String(row?.role || '').toLowerCase() === 'assistant')
      .filter((row: any) => {
        const created = Date.parse(String(row?.created_at || ''));
        return Number.isFinite(created) && created >= (startedEpoch - 2000);
      })
      .sort((a: any, b: any) => Date.parse(String(b?.created_at || '0')) - Date.parse(String(a?.created_at || '0')));
    const latestAssistant = assistantRows[0];
    if (latestAssistant && String(latestAssistant.text || '').trim()) {
      return {
        assistantResponse: String(latestAssistant.text),
        toolCalls: [],
        approvalsRequired: false,
      };
    }
  }

  throw new Error(`Replay live execution timed out waiting for assistant response (chat=${chatId})`);
}

/**
 * Compare expected vs actual outputs
 */
function compareOutputs(
  expectedAssistantResponse?: string,
  expectedToolCalls?: any[],
  expectedApprovalsRequired?: boolean,
  actual?: any
): {
  passed: boolean;
  mismatches: OutputDelta[];
  similarityScore: number;
} {
  const mismatches: OutputDelta[] = [];
  let matchedFields = 0;
  let totalFields = 0;

  // Compare assistant response
  if (expectedAssistantResponse !== undefined) {
    totalFields++;
    if (actual?.assistantResponse !== expectedAssistantResponse) {
      mismatches.push({
        type: 'assistant_response_changed',
        expectedValue: expectedAssistantResponse,
        actualValue: actual?.assistantResponse,
      } as any);
    } else {
      matchedFields++;
    }
  }

  // Compare tool calls
  if (expectedToolCalls && expectedToolCalls.length > 0) {
    totalFields++;
    const actualToolCount = actual?.toolCalls?.length || 0;
    if (actualToolCount !== expectedToolCalls.length) {
      mismatches.push({
        type: 'tool_call_added',
        expectedValue: expectedToolCalls.length,
        actualValue: actualToolCount,
      } as any);
    } else {
      matchedFields++;
    }
  }

  // Compare approvals required
  if (expectedApprovalsRequired !== undefined) {
    totalFields++;
    if ((actual?.approvalsRequired || false) !== expectedApprovalsRequired) {
      mismatches.push({
        type: 'approval_changed',
        expectedValue: expectedApprovalsRequired,
        actualValue: actual?.approvalsRequired,
      } as any);
    } else {
      matchedFields++;
    }
  }

  const similarityScore = totalFields > 0 ? matchedFields / totalFields : 1.0;
  const passed = mismatches.length === 0;

  return {
    passed,
    mismatches,
    similarityScore,
  };
}

/**
 * Start a complete replay run (execute all scenarios)
 */
export async function startReplayRun(replayRunId: string, organizationId?: string, actorUserId?: string): Promise<{ success: boolean }> {
  try {
    if (!organizationId) {
      throw new Error('organizationId is required for replay runs');
    }
    const apiBaseUrl = process.env.SVEN_API_URL || 'http://localhost:3000';
    resolveReplayLiveExecutionConfig(apiBaseUrl);

    // Update status to running
    await pool.query(
      `UPDATE replay_runs SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`,
      [replayRunId, organizationId],
    );

    await ScenarioService.logReplayAction('replay_started', 'replay_run', replayRunId, String(actorUserId || ''), {});

    // Get replay run details
    const runResult = await pool.query(
      `SELECT scenario_ids, filter_category FROM replay_runs WHERE id = $1 AND organization_id = $2`,
      [replayRunId, organizationId]
    );

    if (runResult.rows.length === 0) {
      throw new Error('Replay run not found');
    }

    let scenarioIds = normalizeReplayScenarioIds(runResult.rows[0].scenario_ids);
    const filterCategory = runResult.rows[0].filter_category as string | null;
    if (filterCategory) {
      const filteredScenarioIds: string[] = [];
      for (const scenarioId of scenarioIds) {
        const scenario = await ScenarioService.getScenarioById(scenarioId, organizationId);
        if (scenario?.category === filterCategory) {
          filteredScenarioIds.push(scenarioId);
        }
      }
      scenarioIds = filteredScenarioIds;
      await pool.query(`UPDATE replay_runs SET total_scenarios = $1 WHERE id = $2 AND organization_id = $3`, [
        scenarioIds.length,
        replayRunId,
        organizationId,
      ]);
    }
    let passedCount = 0;
    let failedCount = 0;

    // Execute each scenario against the live execution path.
    for (const scenarioId of scenarioIds) {
      const result = await executeScenario(scenarioId, replayRunId, apiBaseUrl, organizationId);

      if (result.passed) {
        passedCount++;
      } else {
        failedCount++;
      }
    }

    // Update replay run with results
    const deltas = await generateOutputDeltas(replayRunId, organizationId);

    await pool.query(
      `UPDATE replay_runs 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
           passed_scenarios = $1, failed_scenarios = $2, output_deltas = $3
       WHERE id = $4 AND organization_id = $5`,
      [passedCount, failedCount, JSON.stringify(deltas), replayRunId, organizationId]
    );

    await ScenarioService.logReplayAction('replay_completed', 'replay_run', replayRunId, String(actorUserId || ''), {
      passed: passedCount,
      failed: failedCount,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to start replay run:', error);

    // Update status to failed
    await pool.query(
      `UPDATE replay_runs SET status = 'failed', error_message = $1 WHERE id = $2 AND organization_id = $3`,
      [error instanceof Error ? error.message : 'Unknown error', replayRunId, organizationId]
    );

    return { success: false };
  }
}

/**
 * Generate output deltas for replay run
 */
async function generateOutputDeltas(replayRunId: string, organizationId: string): Promise<OutputDelta[]> {
  try {
    const result = await pool.query(
      `SELECT rr.scenario_id, rr.mismatches
       FROM replay_results rr
       JOIN replay_runs r ON r.id = rr.replay_run_id
       WHERE rr.replay_run_id = $1
         AND r.organization_id = $2
         AND rr.mismatches IS NOT NULL`,
      [replayRunId, organizationId]
    );

    const deltas: OutputDelta[] = [];

    result.rows.forEach((row) => {
      const mismatches = row.mismatches || [];
      mismatches.forEach((mismatch: any) => {
        deltas.push({
          ...mismatch,
          scenarioId: row.scenario_id,
        });
      });
    });

    return deltas;
  } catch (error) {
    console.error('Failed to generate output deltas:', error);
    return [];
  }
}

/**
 * Compare two replay runs (baseline vs new build)
 */
export async function compareReplayRuns(
  baselineReplayRunId: string,
  newReplayRunId: string,
  comparisonType: string = 'full',
  organizationId?: string,
  actorUserId?: string
): Promise<{
  id: string;
  identical: number;
  regressions: number;
  improvements: number;
}> {
  try {
    if (!organizationId) {
      throw new Error('organizationId is required for replay comparisons');
    }
    const baselineRunResult = await pool.query(
      `SELECT id, status FROM replay_runs WHERE id = $1 AND organization_id = $2`,
      [baselineReplayRunId, organizationId],
    );
    const newRunResult = await pool.query(
      `SELECT id, status FROM replay_runs WHERE id = $1 AND organization_id = $2`,
      [newReplayRunId, organizationId],
    );

    const baselineRun = baselineRunResult.rows[0];
    const newRun = newRunResult.rows[0];
    if (!baselineRun) {
      throw new ReplayRunNotFoundError(baselineReplayRunId);
    }
    if (!newRun) {
      throw new ReplayRunNotFoundError(newReplayRunId);
    }
    if (baselineRun.status !== 'completed') {
      throw new ReplayRunNotReadyError(baselineReplayRunId, String(baselineRun.status));
    }
    if (newRun.status !== 'completed') {
      throw new ReplayRunNotReadyError(newReplayRunId, String(newRun.status));
    }

    // Get results from both runs
    const baselineResult = await pool.query(
      `SELECT rr.scenario_id, rr.passed, rr.similarity_score
       FROM replay_results rr
       JOIN replay_runs r ON r.id = rr.replay_run_id
       WHERE rr.replay_run_id = $1
         AND r.organization_id = $2
       ORDER BY rr.scenario_id`,
      [baselineReplayRunId, organizationId]
    );

    const newResult = await pool.query(
      `SELECT rr.scenario_id, rr.passed, rr.similarity_score
       FROM replay_results rr
       JOIN replay_runs r ON r.id = rr.replay_run_id
       WHERE rr.replay_run_id = $1
         AND r.organization_id = $2
       ORDER BY rr.scenario_id`,
      [newReplayRunId, organizationId]
    );

    // Create maps for easier comparison
    const baselineMap = new Map(baselineResult.rows.map((r) => [r.scenario_id, r]));
    const newMap = new Map(newResult.rows.map((r) => [r.scenario_id, r]));

    let identical = 0;
    let regressions = 0;
    let improvements = 0;
    const deltas: { [key: string]: any } = {};

    // Compare each scenario
    const allScenarioIds = new Set([...baselineMap.keys(), ...newMap.keys()]);

    allScenarioIds.forEach((scenarioId) => {
      const baselineStatus = baselineMap.get(scenarioId);
      const newStatus = newMap.get(scenarioId);

      if (baselineStatus?.passed === newStatus?.passed) {
        identical++;
      } else if (!baselineStatus?.passed && newStatus?.passed) {
        improvements++;
        deltas[scenarioId] = 'fixed';
      } else if (baselineStatus?.passed && !newStatus?.passed) {
        regressions++;
        deltas[scenarioId] = 'regression';
      }
    });

    // Store comparison
    const insertResult = await pool.query(
      `INSERT INTO output_comparisons (
        baseline_replay_run_id, new_replay_run_id, comparison_type,
        total_scenarios, identical_scenarios, regression_scenarios,
        improvement_scenarios, deltas
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        baselineReplayRunId,
        newReplayRunId,
        comparisonType,
        allScenarioIds.size,
        identical,
        regressions,
        improvements,
        JSON.stringify(deltas),
      ]
    );
    const comparisonId = insertResult.rows[0]?.id;
    if (!comparisonId) {
      throw new Error('Failed to persist replay comparison id');
    }

    await ScenarioService.logReplayAction('replay_comparison_created', 'output_comparison', comparisonId, String(actorUserId || ''), {
      identical,
      regressions,
      improvements,
    });

    return {
      id: comparisonId,
      identical,
      regressions,
      improvements,
    };
  } catch (error) {
    console.error('Failed to compare replay runs:', error);
    throw error;
  }
}

/**
 * Get replay run results
 */
export async function getReplayResults(
  replayRunId: string,
  passedOnly = false,
  organizationId?: string
): Promise<any[]> {
  try {
    if (!organizationId) return [];
    let query = `SELECT rr.id, rr.scenario_id, rr.passed, rr.actual_assistant_response,
                        actual_tool_calls, mismatches, similarity_score, error_message
                 FROM replay_results rr
                 JOIN replay_runs r ON r.id = rr.replay_run_id
                 WHERE rr.replay_run_id = $1 AND r.organization_id = $2`;

    const params: any[] = [replayRunId, organizationId];

    if (passedOnly) {
      query += ' AND passed = TRUE';
    }

    query += ' ORDER BY passed DESC, similarity_score DESC';

    const result = await pool.query(query, params);

    return result.rows;
  } catch (error) {
    console.error('Failed to get replay results:', error);
    return [];
  }
}

/**
 * List all replay runs
 */
export async function listReplayRuns(limit: number = 50, organizationId?: string): Promise<ReplayRun[]> {
  try {
    if (!organizationId) return [];
    const result = await pool.query(
      `SELECT id, name, build_version, status, total_scenarios,
              passed_scenarios, failed_scenarios
       FROM replay_runs
       WHERE organization_id = $2
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit, organizationId]
    );

    return result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      buildVersion: r.build_version,
      status: r.status,
      totalScenarios: r.total_scenarios,
      passedScenarios: r.passed_scenarios,
      failedScenarios: r.failed_scenarios,
    }));
  } catch (error) {
    console.error('Failed to list replay runs:', error);
    const err = new Error('Failed to list replay runs') as Error & { code?: string };
    err.code = 'REPLAY_RUNS_QUERY_FAILED';
    throw err;
  }
}

/**
 * Get replay run summary
 */
export async function getReplaySummary(replayRunId: string, organizationId?: string): Promise<{
  successRate: number;
  totalScenarios: number;
  passed: number;
  failed: number;
  averageSimilarity: number;
}> {
  try {
    if (!organizationId) {
      return {
        successRate: 0,
        totalScenarios: 0,
        passed: 0,
        failed: 0,
        averageSimilarity: 0,
      };
    }
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count,
         AVG(similarity_score) as avg_similarity
       FROM replay_results rr
       JOIN replay_runs r ON r.id = rr.replay_run_id
       WHERE rr.replay_run_id = $1 AND r.organization_id = $2`,
      [replayRunId, organizationId]
    );

    const row = result.rows[0];
    const total = parseInt(row.total) || 0;
    const passed = parseInt(row.passed_count) || 0;
    const failed = total - passed;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return {
      successRate: Math.round(successRate * 100) / 100,
      totalScenarios: total,
      passed,
      failed,
      averageSimilarity: parseFloat(row.avg_similarity || 0),
    };
  } catch (error) {
    console.error('Failed to get replay summary:', error);
    return {
      successRate: 0,
      totalScenarios: 0,
      passed: 0,
      failed: 0,
      averageSimilarity: 0,
    };
  }
}
