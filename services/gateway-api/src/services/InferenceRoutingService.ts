import { getPool } from '../db/pool.js';

/**
 * Inference Routing Service
 * Routes LLM requests to best available inference node (local-first, with fallback)
 */

const pool = getPool();

interface InferenceNode {
  id: string;
  nodeName: string;
  endpointUrl: string;
  nodeType: string;
  isHealthy: boolean;
  currentLoadPercent: number;
  avgResponseTimeMs: number;
  gpuEnabled: boolean;
  maxConcurrentRequests: number;
}

interface RoutingDecision {
  node: InferenceNode;
  routingReason: string;
  fallbackAvailable: boolean;
}

/**
 * Get all healthy inference nodes
 */
async function getHealthyNodes(): Promise<InferenceNode[]> {
  try {
    const result = await pool.query(
      `SELECT id, node_name, endpoint_url, node_type, is_healthy,
              current_load_percent, avg_response_time_ms, gpu_enabled,
              max_concurrent_requests
       FROM inference_nodes
       WHERE is_healthy = TRUE
       ORDER BY current_load_percent ASC, avg_response_time_ms ASC`
    );

    return result.rows.map((r) => ({
      id: r.id,
      nodeName: r.node_name,
      endpointUrl: r.endpoint_url,
      nodeType: r.node_type,
      isHealthy: r.is_healthy,
      currentLoadPercent: r.current_load_percent,
      avgResponseTimeMs: r.avg_response_time_ms,
      gpuEnabled: r.gpu_enabled,
      maxConcurrentRequests: r.max_concurrent_requests,
    }));
  } catch (error) {
    console.error('Failed to get healthy nodes:', error);
    return [];
  }
}

/**
 * Get active routing policy
 */
async function getRoutingPolicy(): Promise<any> {
  try {
    const result = await pool.query(
      `SELECT id, policy_name, prefer_local_first, load_threshold_percent,
              failover_on_error, profile_name, max_latency_ms
       FROM inference_routing_policy
       WHERE is_active = TRUE
       LIMIT 1`
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Failed to get routing policy:', error);
    return null;
  }
}

/**
 * Route inference request to best node
 */
export async function routeInferenceRequest(model: string): Promise<RoutingDecision> {
  try {
    const nodes = await getHealthyNodes();
    const policy = await getRoutingPolicy();

    if (nodes.length === 0) {
      throw new Error('No healthy inference nodes available');
    }

    let selectedNode: InferenceNode | null = null;
    let routingReason = '';

    if (policy?.prefer_local_first) {
      // Try local node first
      const localNode = nodes.find((n) => n.nodeType === 'local');

      if (localNode) {
        if (localNode.currentLoadPercent < (policy?.load_threshold_percent || 80)) {
          selectedNode = localNode;
          routingReason = `Local node preferred (load: ${localNode.currentLoadPercent}%)`;
        } else {
          // Local too busy, try remote
          const remoteNode = nodes.find((n) => n.nodeType === 'remote' && n.currentLoadPercent < 80);
          if (remoteNode) {
            selectedNode = remoteNode;
            routingReason = `Local overloaded, using remote (local: ${localNode.currentLoadPercent}%, remote: ${remoteNode.currentLoadPercent}%)`;
          } else {
            // Fall back to local anyway
            selectedNode = localNode;
            routingReason = 'Local fallback (no remote available)';
          }
        }
      } else {
        // No local node, use best remote
        selectedNode = nodes[0];
        routingReason = `No local node, using best available (${selectedNode.nodeName})`;
      }
    } else {
      // Use least loaded node
      selectedNode = nodes[0];
      routingReason = `Least-loaded node selected (${selectedNode.nodeName}, load: ${selectedNode.currentLoadPercent}%)`;
    }

    // Record routing decision
    await pool.query(
      `INSERT INTO load_distribution_events (
        event_type, timestamp_ms, inference_node_id, selected_model,
        node_load_percent_before, response_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'request_routed',
        Date.now(),
        selectedNode.id,
        model,
        selectedNode.currentLoadPercent,
        0,
      ]
    );

    await pool.query(
      `UPDATE inference_nodes
       SET total_requests = total_requests + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [selectedNode.id]
    );

    return {
      node: selectedNode,
      routingReason,
      fallbackAvailable: nodes.length > 1,
    };
  } catch (error) {
    console.error('Inference routing failed:', error);
    throw error;
  }
}

/**
 * Record node health check result
 */
export async function recordNodeHealthCheck(
  nodeId: string,
  isHealthy: boolean,
  responseTimeMs: number
): Promise<void> {
  try {
    if (isHealthy) {
      await pool.query(
        `UPDATE inference_nodes
         SET is_healthy = TRUE, last_health_check = CURRENT_TIMESTAMP,
             consecutive_failures = 0, avg_response_time_ms = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [responseTimeMs, nodeId]
      );
    } else {
      await pool.query(
        `UPDATE inference_nodes
         SET consecutive_failures = consecutive_failures + 1,
             total_errors = total_errors + 1,
             last_health_check = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [nodeId]
      );

      // Mark unhealthy if 3+ consecutive failures
      await pool.query(
        `UPDATE inference_nodes
         SET is_healthy = FALSE
         WHERE id = $1 AND consecutive_failures >= 3`,
        [nodeId]
      );
    }
  } catch (error) {
    console.error('Failed to record health check:', error);
  }
}

/**
 * Update node load metrics
 */
export async function updateNodeLoad(
  nodeId: string,
  currentRequests: number,
  maxConcurrent: number
): Promise<void> {
  try {
    const loadPercent = (currentRequests / maxConcurrent) * 100;

    await pool.query(
      `UPDATE inference_nodes
       SET current_load_percent = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [loadPercent, nodeId]
    );
  } catch (error) {
    console.error('Failed to update node load:', error);
  }
}

/**
 * Get inference routing stats
 */
export async function getRoutingStats(): Promise<{
  totalRequests: number;
  nodeStats: Array<{
    nodeName: string;
    requestCount: number;
    avgLatency: number;
    errorRate: number;
  }>;
  preferredProfile: string;
}> {
  try {
    const nodesResult = await pool.query(
      `SELECT node_name, total_requests, avg_response_time_ms,
              (total_errors::FLOAT / GREATEST(total_requests, 1)) * 100 as error_rate
       FROM inference_nodes
       ORDER BY total_requests DESC`
    );

    const policyResult = await pool.query(
      `SELECT profile_name FROM inference_routing_policy WHERE is_active = TRUE LIMIT 1`
    );

    const nodeStats = nodesResult.rows.map((r) => ({
      nodeName: r.node_name,
      requestCount: parseInt(r.total_requests),
      avgLatency: r.avg_response_time_ms,
      errorRate: parseFloat(r.error_rate),
    }));

    const totalRequests = nodeStats.reduce((sum, n) => sum + n.requestCount, 0);

    return {
      totalRequests,
      nodeStats,
      preferredProfile: policyResult.rows.length > 0 ? policyResult.rows[0].profile_name : 'unknown',
    };
  } catch (error) {
    console.error('Failed to get routing stats:', error);
    return { totalRequests: 0, nodeStats: [], preferredProfile: 'unknown' };
  }
}

/**
 * Get available nodes
 */
export async function listInferenceNodes(): Promise<InferenceNode[]> {
  return getHealthyNodes();
}
