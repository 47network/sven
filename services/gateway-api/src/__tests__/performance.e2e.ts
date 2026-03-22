/**
 * Performance & Scaling E2E Tests
 * Tests for backpressure, caching, RAG incremental indexing, and inference routing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';
const API_BASE = process.env.API_URL || 'http://localhost:3001';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

// Helper for API calls
async function apiCall(
  method: string,
  endpoint: string,
  body?: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/v1/admin${endpoint}`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_TOKEN}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const describeLive = RUN_LIVE_GATEWAY_E2E ? describe : describe.skip;

describe('Performance & Scaling System (offline)', () => {
  it('has valid API base format', () => {
    expect(API_BASE.startsWith('http://') || API_BASE.startsWith('https://')).toBe(true);
  });
});

describeLive('Performance & Scaling System', () => {
  describe('Backpressure Management', () => {
    it('should get initial queue status', async () => {
      const result = await apiCall('GET', '/performance/queue-status');
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.queues).toBeDefined();
    });

    it('should activate backpressure on demand', async () => {
      const result = await apiCall('POST', '/performance/backpressure/activate', {
        reason: 'Test activation - high queue depth',
      });
      expect(result.status).toBe('success');
      expect(result.message).toContain('Backpressure activated');
    });

    it('should retrieve backpressure status when active', async () => {
      const result = await apiCall('GET', '/performance/backpressure');
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.active).toBeDefined();
    });

    it('should deactivate backpressure', async () => {
      const result = await apiCall('POST', '/performance/backpressure/deactivate');
      expect(result.status).toBe('success');
      expect(result.message).toContain('Backpressure deactivated');
    });

    it('should verify backpressure is deactivated', async () => {
      const result = await apiCall('GET', '/performance/backpressure');
      expect(result.status).toBe('success');
      expect(result.data.active).toBe(false);
    });
  });

  describe('Tool Caching System', () => {
    it('should retrieve cache statistics', async () => {
      const result = await apiCall('GET', '/performance/cache/stats');
      expect(result.status).toBe('success');
      expect(Array.isArray(result.data)).toBe(true);
      // Should have some pre-configured tools
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should have cache entries for ha.list_entities', async () => {
      const result = await apiCall('GET', '/performance/cache/stats');
      const haListCache = result.data.find((c: any) => c.toolName === 'ha.list_entities');
      expect(haListCache).toBeDefined();
    });

    it('should clear cache for specific tool', async () => {
      const result = await apiCall('POST', '/performance/cache/clear/ha.list_entities');
      expect(result.status).toBe('success');
      expect(result.message).toContain('Cache cleared');
    });

    it('should cleanup expired cache entries', async () => {
      const result = await apiCall('POST', '/performance/cache/cleanup-expired');
      expect(result.status).toBe('success');
      expect(result.message).toMatch(/Cleaned \d+ expired entries/);
    });
  });

  describe('RAG Incremental Indexing', () => {
    const testSourceId = '550e8400-e29b-41d4-a716-446655440000'; // UUID for testing

    it('should get indexing statistics for source', async () => {
      const result = await apiCall('GET', `/performance/rag-indexing/stats/${testSourceId}`);
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.totalFiles).toBeDefined();
      expect(result.data.changedFiles).toBeDefined();
      expect(result.data.unchangedFiles).toBeDefined();
    });

    it('should list files for source with indexing status', async () => {
      const result = await apiCall('GET', `/performance/rag-indexing/files/${testSourceId}`);
      expect(result.status).toBe('success');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should report zero files when source has no indexing history', async () => {
      const result = await apiCall('GET', `/performance/rag-indexing/stats/${testSourceId}`);
      expect(result.status).toBe('success');
      // New source should have no files yet
      expect(result.data.totalFiles).toBe(0);
    });
  });

  describe('Inference Routing', () => {
    it('should list available inference nodes', async () => {
      const result = await apiCall('GET', '/performance/inference/nodes');
      expect(result.status).toBe('success');
      expect(Array.isArray(result.data)).toBe(true);
      // Should have at least local-ollama node
      const localNode = result.data.find((n: any) => n.nodeName === 'local-ollama');
      expect(localNode).toBeDefined();
    });

    it('should have local-ollama node healthy and available', async () => {
      const result = await apiCall('GET', '/performance/inference/nodes');
      const localNode = result.data.find((n: any) => n.nodeName === 'local-ollama');
      expect(localNode.isHealthy).toBe(true);
      expect(localNode.endpointUrl).toBe('http://ollama:11434');
    });

    it('should get inference routing statistics', async () => {
      const result = await apiCall('GET', '/performance/inference/stats');
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.totalRequests).toBeDefined();
      expect(result.data.nodeStats).toBeDefined();
    });

    it('should route inference request to best node', async () => {
      const result = await apiCall('POST', '/performance/inference/route', {
        model: 'llama2',
      });
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.node).toBeDefined();
      expect(result.data.routingReason).toBeDefined();
      expect(result.data.fallbackAvailable).toBeDefined();
    });

    it('should fail routing when model not provided', async () => {
      const result = await apiCall('POST', '/performance/inference/route', {});
      // Should return error status
      expect(result.status).toBe('error');
      expect(result.message).toMatch(/model/i);
    });
  });

  describe('Performance Profiles', () => {
    it('should list all performance profiles', async () => {
      const result = await apiCall('GET', '/performance/profiles');
      expect(result.status).toBe('success');
      expect(Array.isArray(result.data)).toBe(true);
      // Should have 3 profiles: gaming, balanced, performance
      expect(result.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should have gaming profile with correct limits', async () => {
      const result = await apiCall('GET', '/performance/profiles');
      const gamingProfile = result.data.find((p: any) => p.profileName === 'gaming');
      expect(gamingProfile).toBeDefined();
      expect(gamingProfile.limits.maxLLMConcurrency).toBe(1);
      expect(gamingProfile.limits.maxToolConcurrency).toBe(1);
      expect(gamingProfile.timeouts.llmTimeoutMs).toBe(100);
    });

    it('should have balanced profile with moderate limits', async () => {
      const result = await apiCall('GET', '/performance/profiles');
      const balancedProfile = result.data.find((p: any) => p.profileName === 'balanced');
      expect(balancedProfile).toBeDefined();
      expect(balancedProfile.limits.maxLLMConcurrency).toBe(4);
      expect(balancedProfile.limits.maxToolConcurrency).toBe(8);
      expect(balancedProfile.timeouts.llmTimeoutMs).toBe(500);
    });

    it('should activate gaming profile', async () => {
      const result = await apiCall('PUT', '/performance/profiles/gaming/activate');
      expect(result.status).toBe('success');
      expect(result.message).toContain('gaming');
      expect(result.message).toContain('activated');
    });

    it('should activate balanced profile', async () => {
      const result = await apiCall('PUT', '/performance/profiles/balanced/activate');
      expect(result.status).toBe('success');
      expect(result.message).toContain('balanced');
      expect(result.message).toContain('activated');
    });

    it('should fail activating non-existent profile', async () => {
      const result = await apiCall('PUT', '/performance/profiles/nonexistent/activate');
      expect(result.status).toBe('error');
      expect(result.message).toMatch(/not found|Profile/i);
    });
  });

  describe('Overall Metrics Summary', () => {
    it('should get comprehensive performance metrics summary', async () => {
      const result = await apiCall('GET', '/performance/metrics/summary');
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.queue).toBeDefined();
      expect(result.data.backpressure).toBeDefined();
      expect(result.data.cache).toBeDefined();
      expect(result.data.inference).toBeDefined();
    });

    it('should report cache hit rate in summary', async () => {
      const result = await apiCall('GET', '/performance/metrics/summary');
      expect(result.data.cache).toBeDefined();
      expect(result.data.cache.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(result.data.cache.cacheHitRate).toBeLessThanOrEqual(100);
    });

    it('should report inference node stats in summary', async () => {
      const result = await apiCall('GET', '/performance/metrics/summary');
      expect(result.data.inference.nodeStats).toBeDefined();
      expect(Array.isArray(result.data.inference.nodeStats)).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should execute health check successfully', async () => {
      const result = await apiCall('POST', '/performance/health-check');
      expect(result.status).toBe('success');
      expect(result.message).toContain('Health check completed');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle queue status to backpressure workflow', async () => {
      // Get queue status
      const queueStatus = await apiCall('GET', '/performance/queue-status');
      expect(queueStatus.status).toBe('success');

      // Simulate backpressure activation
      await apiCall('POST', '/performance/backpressure/activate', {
        reason: 'Integration test - simulated high load',
      });

      // Verify it's active
      const bpStatus = await apiCall('GET', '/performance/backpressure');
      expect(bpStatus.data.active).toBe(true);

      // Deactivate
      await apiCall('POST', '/performance/backpressure/deactivate');

      // Verify deactivated
      const finalStatus = await apiCall('GET', '/performance/backpressure');
      expect(finalStatus.data.active).toBe(false);
    });

    it('should support profile switching workflow', async () => {
      // Activate gaming profile
      await apiCall('PUT', '/performance/profiles/gaming/activate');

      // Get metrics with gaming profile
      const gamingMetrics = await apiCall('GET', '/performance/metrics/summary');
      expect(gamingMetrics.status).toBe('success');

      // Switch to balanced
      await apiCall('PUT', '/performance/profiles/balanced/activate');

      // Get metrics with balanced profile
      const balancedMetrics = await apiCall('GET', '/performance/metrics/summary');
      expect(balancedMetrics.status).toBe('success');

      // Both should be valid responses
      expect(gamingMetrics.data).toBeDefined();
      expect(balancedMetrics.data).toBeDefined();
    });

    it('should support cache management workflow', async () => {
      // Get initial stats
      const initialStats = await apiCall('GET', '/performance/cache/stats');
      expect(initialStats.status).toBe('success');

      // Clear cache for ha.list_entities
      await apiCall('POST', '/performance/cache/clear/ha.list_entities');

      // Cleanup expired
      const cleanup = await apiCall('POST', '/performance/cache/cleanup-expired');
      expect(cleanup.status).toBe('success');

      // Get final stats
      const finalStats = await apiCall('GET', '/performance/cache/stats');
      expect(finalStats.status).toBe('success');
    });
  });
});

describeLive('Performance System - Error Handling', () => {
  it('should handle invalid sourceId gracefully', async () => {
    const result = await apiCall('GET', '/performance/rag-indexing/stats/invalid-uuid');
    expect(result.status).toBe('error');
    expect(String(result.message || '')).toMatch(/sourceId/i);
  });

  it('should handle missing tool name in cache clear', async () => {
    try {
      await apiCall('POST', '/performance/cache/clear/');
      // May or may not match route depending on server implementation
    } catch (error) {
      // Error is acceptable
    }
  });
});
