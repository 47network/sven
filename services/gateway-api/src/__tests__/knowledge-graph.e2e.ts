/**
 * Knowledge Graph End-to-End Tests
 * Tests the complete knowledge graph workflow including entity/relation extraction,
 * evidence tracking, ranking, and deduplication
 */
import { describe, expect, it } from '@jest/globals';

const BASE_URL = `${process.env.GATEWAY_URL || 'http://localhost:3000'}/v1/admin`;
const TEST_CHAT_ID = 'e2e-test-chat-' + Date.now();
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Helper to make API requests
 */
async function apiCall(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const options: any = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  // Use built-in fetch (Node 18+)
  const response = await (fetch as any)(`${BASE_URL}${endpoint}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();

  return { status: response.status, data };
}

/**
 * Test: Create entities
 */
async function testCreateEntities(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = [
      {
        type: 'person',
        name: 'Alice Johnson',
        description: 'Software engineer',
        confidence: 0.95,
      },
      {
        type: 'person',
        name: 'Bob Smith',
        description: 'Product manager',
        confidence: 0.92,
      },
      {
        type: 'organization',
        name: 'TechCorp Inc',
        description: 'A software company',
        confidence: 0.98,
      },
    ];

    for (const entity of entities) {
      const { status, data } = await apiCall('POST', '/knowledge-graph/entities', entity);
      if (status !== 201) {
        throw new Error(`Failed to create entity: ${JSON.stringify(data)}`);
      }
      (entity as any).id = data.id;
    }

    // Store entity IDs for later use
    (global as any).testEntities = entities;

    return {
      name: 'Create Entities',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Create Entities',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Create relations
 */
async function testCreateRelations(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');
    const bob = entities.find((e: any) => e.name === 'Bob Smith');
    const techcorp = entities.find((e: any) => e.name === 'TechCorp Inc');

    const relations = [
      {
        source_entity_id: alice.id,
        target_entity_id: techcorp.id,
        relation_type: 'works_for',
        confidence: 0.95,
      },
      {
        source_entity_id: bob.id,
        target_entity_id: techcorp.id,
        relation_type: 'works_for',
        confidence: 0.93,
      },
      {
        source_entity_id: alice.id,
        target_entity_id: bob.id,
        relation_type: 'knows',
        confidence: 0.88,
      },
    ];

    for (const relation of relations) {
      const { status, data } = await apiCall('POST', '/knowledge-graph/relations', relation);
      if (status !== 201) {
        throw new Error(`Failed to create relation: ${JSON.stringify(data)}`);
      }
      (relation as any).id = data.id;
    }

    (global as any).testRelations = relations;

    return {
      name: 'Create Relations',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Create Relations',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get entity with relations
 */
async function testGetEntityWithRelations(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');

    const { status, data } = await apiCall(
      'GET',
      `/knowledge-graph/entities/${alice.id}`
    );

    if (status !== 200) {
      throw new Error(`Failed to get entity: ${JSON.stringify(data)}`);
    }

    if (!data.entity || typeof data.relations !== 'object' || typeof data.evidence !== 'object') {
      throw new Error('Response structure incorrect');
    }

    return {
      name: 'Get Entity with Relations',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Entity with Relations',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Fill entity neighbors
 */
async function testGetEntityNeighbors(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');

    const { status, data } = await apiCall(
      'GET',
      `/knowledge-graph/neighbors/${alice.id}`
    );

    if (status !== 200) {
      throw new Error(`Failed to get neighbors: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.outgoing) || !Array.isArray(data.incoming)) {
      throw new Error('Response structure incorrect');
    }

    return {
      name: 'Get Entity Neighbors',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Entity Neighbors',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Rank entities by confidence
 */
async function testRankEntities(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/knowledge-graph/ranked/entities?limit=10');

    if (status !== 200) {
      throw new Error(`Failed to rank entities: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.ranked)) {
      throw new Error('Response should contain ranked array');
    }

    // Verify entities are sorted by composite score
    for (let i = 1; i < data.ranked.length; i++) {
      if (data.ranked[i].compositeScore > data.ranked[i - 1].compositeScore) {
        throw new Error('Entities not properly ranked');
      }
    }

    return {
      name: 'Rank Entities by Confidence',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Rank Entities by Confidence',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Rank relations by confidence
 */
async function testRankRelations(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/knowledge-graph/ranked/relations?limit=10');

    if (status !== 200) {
      throw new Error(`Failed to rank relations: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.ranked)) {
      throw new Error('Response should contain ranked array');
    }

    return {
      name: 'Rank Relations by Confidence',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Rank Relations by Confidence',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Find duplicates
 */
async function testFindDuplicates(): Promise<TestResult> {
  const start = Date.now();
  try {
    // Create a duplicate entity
    const { status: createStatus, data: createData } = await apiCall(
      'POST',
      '/knowledge-graph/entities',
      {
        type: 'person',
        name: 'alice johnson', // Similar to Alice Johnson
        description: 'Software engineer (duplicate)',
        confidence: 0.85,
      }
    );

    if (createStatus !== 201) {
      throw new Error('Failed to create duplicate entity');
    }

    // Find duplicates
    const { status: findStatus, data: findData } = await apiCall(
      'GET',
      '/knowledge-graph/duplicates?minSimilarity=0.8'
    );

    if (findStatus !== 200) {
      throw new Error(`Failed to find duplicates: ${JSON.stringify(findData)}`);
    }

    if (!Array.isArray(findData.duplicates)) {
      throw new Error('Response should contain duplicates array');
    }

    (global as any).duplicateEntityId = createData.id;

    return {
      name: 'Find Duplicate Entities',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Find Duplicate Entities',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Merge entities
 */
async function testMergeEntities(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');
    const duplicateId = (global as any).duplicateEntityId;

    const { status, data } = await apiCall(
      'POST',
      `/knowledge-graph/entities/${duplicateId}/merge/${alice.id}`,
      { reason: 'Test merge - duplicate entities' }
    );

    if (status !== 200) {
      throw new Error(`Failed to merge entities: ${JSON.stringify(data)}`);
    }

    if (!data.success) {
      throw new Error('Merge response indicates failure');
    }

    return {
      name: 'Merge Entities',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Merge Entities',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get merge history
 */
async function testGetMergeHistory(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');

    const { status, data } = await apiCall(
      'GET',
      `/knowledge-graph/entities/${alice.id}/merge-history`
    );

    if (status !== 200) {
      throw new Error(`Failed to get merge history: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.history)) {
      throw new Error('Response should contain history array');
    }

    return {
      name: 'Get Merge History',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Merge History',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Evidence scoring
 */
async function testEvidenceScoring(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const alice = entities.find((e: any) => e.name === 'Alice Johnson');

    const { status, data } = await apiCall(
      'GET',
      `/knowledge-graph/entities/${alice.id}/evidence-score`
    );

    if (status !== 200) {
      throw new Error(`Failed to get evidence score: ${JSON.stringify(data)}`);
    }

    if (typeof data.evidenceScore !== 'number' || data.evidenceScore < 0 || data.evidenceScore > 1) {
      throw new Error('Evidence score should be a number between 0 and 1');
    }

    return {
      name: 'Evidence Scoring',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Evidence Scoring',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: List entities with pagination
 */
async function testListEntities(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/knowledge-graph/entities?limit=10&offset=0');

    if (status !== 200) {
      throw new Error(`Failed to list entities: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.entities) || typeof data.total !== 'number') {
      throw new Error('Response structure incorrect');
    }

    return {
      name: 'List Entities with Pagination',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'List Entities with Pagination',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Delete entity cascades
 */
async function testDeleteEntity(): Promise<TestResult> {
  const start = Date.now();
  try {
    const entities = (global as any).testEntities;
    const testEntity = entities[entities.length - 1]; // Get last entity

    const { status, data } = await apiCall(
      'DELETE',
      `/knowledge-graph/entities/${testEntity.id}`
    );

    if (status !== 200) {
      throw new Error(`Failed to delete entity: ${JSON.stringify(data)}`);
    }

    // Verify entity is actually deleted
    const { status: verifyStatus } = await apiCall(
      'GET',
      `/knowledge-graph/entities/${testEntity.id}`
    );

    if (verifyStatus !== 404) {
      throw new Error('Entity should be deleted but still exists');
    }

    return {
      name: 'Delete Entity with Cascades',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Delete Entity with Cascades',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<{ passed: number; total: number }> {
  console.log('\n🧪 Knowledge Graph E2E Tests\n');
  console.log('='.repeat(50));

  const tests = [
    testCreateEntities,
    testCreateRelations,
    testGetEntityWithRelations,
    testGetEntityNeighbors,
    testRankEntities,
    testRankRelations,
    testFindDuplicates,
    testMergeEntities,
    testGetMergeHistory,
    testEvidenceScoring,
    testListEntities,
    testDeleteEntity,
  ];

  for (const test of tests) {
    const result = await test();
    results.push(result);

    const status = result.passed ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.duration}ms)`);

    if (result.error) {
      console.log(`   └─ Error: ${result.error}`);
    }
  }

  console.log('='.repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  console.log(`\n📊 Results: ${passed}/${total} tests passed\n`);

  if (passed === total) console.log('🎉 All tests passed!');
  else console.log('⚠️  Some tests failed');

  return { passed, total };
}

describe('Knowledge Graph E2E', () => {
  it('offline guard', () => {
    expect(BASE_URL.includes('/v1/admin')).toBe(true);
    expect(TEST_CHAT_ID.startsWith('e2e-test-chat-')).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('runs live knowledge graph workflow', async () => {
    const summary = await runTests();
    expect(summary.passed).toBe(summary.total);
  }, 180000);
});

if (!process.env.JEST_WORKER_ID) {
  runTests()
    .then((summary) => {
      process.exit(summary.passed === summary.total ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
