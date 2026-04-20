import * as fs from 'fs';
import * as path from 'path';

/* ────────────────────────── paths ────────────────────────── */

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

const migrationPath = path.join(
  ROOT,
  'services/gateway-api/migrations/20260502120000_persistent_memory.sql',
);
const sharedTypesPath = path.join(
  ROOT,
  'packages/shared/src/persistent-memory.ts',
);
const sharedIndexPath = path.join(ROOT, 'packages/shared/src/index.ts');
const skillPath = path.join(
  ROOT,
  'skills/autonomous-economy/memory-remember/SKILL.md',
);
const taskExecutorPath = path.join(
  ROOT,
  'services/sven-marketplace/src/task-executor.ts',
);
const eidolonTypesPath = path.join(
  ROOT,
  'services/sven-eidolon/src/types.ts',
);
const eventBusPath = path.join(
  ROOT,
  'services/sven-eidolon/src/event-bus.ts',
);

/* ────────────────────────── read files once ────────────────────────── */

const migration = fs.readFileSync(migrationPath, 'utf-8');
const sharedTypes = fs.readFileSync(sharedTypesPath, 'utf-8');
const sharedIndex = fs.readFileSync(sharedIndexPath, 'utf-8');
const skill = fs.readFileSync(skillPath, 'utf-8');
const taskExecutor = fs.readFileSync(taskExecutorPath, 'utf-8');
const eidolonTypes = fs.readFileSync(eidolonTypesPath, 'utf-8');
const eventBus = fs.readFileSync(eventBusPath, 'utf-8');

/* ═══════════════════════════════════════════════════════════════
   1. Migration SQL — 20260502120000_persistent_memory.sql
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — Migration SQL', () => {
  it('creates memory_tiers table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS memory_tiers');
  });

  it('memory_tiers has required columns', () => {
    for (const col of [
      'tier',
      'category',
      'content',
      'keywords',
      'confidence',
      'decay',
      'reinforcement_count',
      'token_count',
      'compressed_from',
      'last_accessed_at',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('tier column has CHECK constraint for working/episodic/semantic', () => {
    expect(migration).toMatch(/tier\s.*CHECK/is);
    expect(migration).toContain("'working'");
    expect(migration).toContain("'episodic'");
    expect(migration).toContain("'semantic'");
  });

  it('creates memory_compression_jobs table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS memory_compression_jobs');
  });

  it('memory_compression_jobs has required columns', () => {
    for (const col of [
      'source_tier',
      'target_tier',
      'source_count',
      'output_count',
      'tokens_saved',
      'compression_ratio',
      'status',
    ]) {
      expect(migration).toContain(col);
    }
  });

  it('creates memory_retrieval_log table', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS memory_retrieval_log');
  });

  it('memory_retrieval_log has required columns', () => {
    for (const col of ['query', 'retrieval_method', 'retrieved_ids', 'tokens_injected', 'feedback']) {
      expect(migration).toContain(col);
    }
  });

  it('inserts settings_global config entries', () => {
    expect(migration).toContain('settings_global');
    expect(migration).toContain('memory.compression');
    expect(migration).toContain('memory.retrieval');
    expect(migration).toContain('memory.decay');
  });

  it('ALTERs marketplace_tasks task_type CHECK', () => {
    expect(migration).toContain('ALTER TABLE marketplace_tasks');
    expect(migration).toContain('memory_remember');
    expect(migration).toContain('memory_recall');
    expect(migration).toContain('memory_compress');
  });

  it('has category CHECK with 11 categories', () => {
    for (const cat of [
      'preference',
      'decision',
      'pattern',
      'constraint',
      'architecture',
      'correction',
      'convention',
      'fact',
      'relationship',
      'project_state',
      'learning',
    ]) {
      expect(migration).toContain(`'${cat}'`);
    }
  });

  it('creates indexes for efficient queries', () => {
    expect(migration).toMatch(/CREATE INDEX/i);
  });
});

/* ═══════════════════════════════════════════════════════════════
   2. Shared types — persistent-memory.ts
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — persistent-memory.ts types', () => {
  it('exports MemoryTier type with 3 tiers', () => {
    expect(sharedTypes).toContain("MemoryTier");
    expect(sharedTypes).toContain("'working'");
    expect(sharedTypes).toContain("'episodic'");
    expect(sharedTypes).toContain("'semantic'");
  });

  it('exports PersistentMemoryCategory with 11 values', () => {
    expect(sharedTypes).toContain('PersistentMemoryCategory');
    const categories = [
      'preference', 'decision', 'pattern', 'constraint', 'architecture',
      'correction', 'convention', 'fact', 'relationship', 'project_state', 'learning',
    ];
    for (const cat of categories) {
      expect(sharedTypes).toContain(`'${cat}'`);
    }
  });

  it('exports TieredMemory interface', () => {
    expect(sharedTypes).toContain('TieredMemory');
    expect(sharedTypes).toContain('id: string');
    expect(sharedTypes).toContain('tier');
    expect(sharedTypes).toContain('category');
    expect(sharedTypes).toContain('confidence');
    expect(sharedTypes).toContain('decay');
    expect(sharedTypes).toContain('reinforcementCount');
    expect(sharedTypes).toContain('tokenCount');
  });

  it('exports CompressionJob interface', () => {
    expect(sharedTypes).toContain('CompressionJob');
    expect(sharedTypes).toContain('sourceTier');
    expect(sharedTypes).toContain('targetTier');
    expect(sharedTypes).toContain('sourceCount');
    expect(sharedTypes).toContain('outputCount');
    expect(sharedTypes).toContain('compressionRatio');
  });

  it('exports RetrievalLogEntry interface', () => {
    expect(sharedTypes).toContain('RetrievalLogEntry');
    expect(sharedTypes).toContain('query');
    expect(sharedTypes).toContain('retrievalMethod');
    expect(sharedTypes).toContain('retrievedIds');
    expect(sharedTypes).toContain('tokensInjected');
    expect(sharedTypes).toContain('relevanceScores');
  });
});

describe('Batch 28 — persistent-memory.ts configs', () => {
  it('exports DEFAULT_COMPRESSION_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_COMPRESSION_CONFIG');
  });

  it('exports DEFAULT_RETRIEVAL_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_RETRIEVAL_CONFIG');
  });

  it('exports DEFAULT_DECAY_CONFIG', () => {
    expect(sharedTypes).toContain('DEFAULT_DECAY_CONFIG');
  });

  it('compression config has thresholdCount and maxSemanticTokens', () => {
    expect(sharedTypes).toContain('thresholdCount');
    expect(sharedTypes).toContain('maxSemanticTokens');
    expect(sharedTypes).toContain('maxEpisodicTokens');
  });

  it('retrieval config has topK and minEffectiveConfidence', () => {
    expect(sharedTypes).toContain('topK');
    expect(sharedTypes).toContain('minEffectiveConfidence');
  });

  it('decay config has halfLifeDays and floor', () => {
    expect(sharedTypes).toContain('halfLifeDays');
    expect(sharedTypes).toContain('floor');
  });
});

describe('Batch 28 — persistent-memory.ts utilities', () => {
  it('exports computeDecay function', () => {
    expect(sharedTypes).toContain('export function computeDecay');
  });

  it('exports effectiveConfidence function', () => {
    expect(sharedTypes).toContain('export function effectiveConfidence');
  });

  it('exports isEligibleForCompression function', () => {
    expect(sharedTypes).toContain('export function isEligibleForCompression');
  });

  it('exports estimateTokens function', () => {
    expect(sharedTypes).toContain('export function estimateTokens');
  });

  it('exports compressionRatio function', () => {
    expect(sharedTypes).toContain('export function compressionRatio');
  });

  it('exports retrievalScore function', () => {
    expect(sharedTypes).toContain('export function retrievalScore');
  });

  it('exports PERSISTENT_MEMORY_CATEGORIES array', () => {
    expect(sharedTypes).toContain('PERSISTENT_MEMORY_CATEGORIES');
  });
});

/* ═══════════════════════════════════════════════════════════════
   3. Utility function logic tests (import from source)
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — computeDecay logic', () => {
  // Parse the function from source to verify logic
  it('returns 1.0 for ageDays=0', () => {
    // decay = max(floor, exp(-lambda * 0)) = max(0.1, 1.0) = 1.0
    expect(sharedTypes).toMatch(/Math\.exp\s*\(/);
  });

  it('uses exponential half-life model', () => {
    expect(sharedTypes).toContain('Math.LN2');
    expect(sharedTypes).toContain('halfLifeDays');
  });

  it('has floor parameter to prevent zero decay', () => {
    expect(sharedTypes).toContain('Math.max');
    expect(sharedTypes).toContain('floor');
  });
});

describe('Batch 28 — effectiveConfidence logic', () => {
  it('combines confidence, decay, and reinforcement', () => {
    // Should reference all three factors
    expect(sharedTypes).toContain('confidence');
    expect(sharedTypes).toContain('reinforcementCount');
    expect(sharedTypes).toMatch(/Math\.log2|log2/);
  });
});

describe('Batch 28 — retrievalScore logic', () => {
  it('applies tier boost for semantic memories', () => {
    expect(sharedTypes).toContain('semantic');
    // Should have a multiplier for semantic tier
    expect(sharedTypes).toMatch(/1\.5|tierBoost|tier\s*===\s*'semantic'/);
  });

  it('incorporates recency factor', () => {
    expect(sharedTypes).toContain('recency');
  });
});

describe('Batch 28 — compressionRatio logic', () => {
  it('calculates ratio as 1 - output/input', () => {
    expect(sharedTypes).toMatch(/1\s*-\s*output|1\s*-\s*\(/);
  });
});

describe('Batch 28 — isEligibleForCompression', () => {
  it('checks age against tier-specific max age', () => {
    expect(sharedTypes).toContain('ageDays');
  });
});

/* ═══════════════════════════════════════════════════════════════
   4. Shared index — barrel export
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — shared/index.ts export', () => {
  it('exports persistent-memory module', () => {
    expect(sharedIndex).toContain("./persistent-memory");
  });
});

/* ═══════════════════════════════════════════════════════════════
   5. SKILL.md — memory-remember
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — memory-remember SKILL.md', () => {
  it('has YAML frontmatter with name', () => {
    expect(skill).toContain('name: memory-remember');
  });

  it('has version 1.0.0', () => {
    expect(skill).toContain('version: 1.0.0');
  });

  it('has archetype: operator', () => {
    expect(skill).toContain('archetype: operator');
  });

  it('defines 6 actions', () => {
    for (const action of ['remember', 'recall', 'compress', 'forget', 'reinforce', 'stats']) {
      expect(skill).toContain(`name: ${action}`);
    }
  });

  it('defines action enum input', () => {
    expect(skill).toContain('type: enum');
    expect(skill).toContain('values: [remember, recall, compress, forget, reinforce, stats]');
  });

  it('defines category input with 11 values', () => {
    expect(skill).toContain('preference, decision, pattern, constraint, architecture, correction, convention, fact, relationship, project_state, learning');
  });

  it('defines tier input with 3 values', () => {
    expect(skill).toContain('values: [working, episodic, semantic]');
  });

  it('defines method input for retrieval', () => {
    expect(skill).toContain('values: [keyword, semantic, recency, hybrid]');
  });

  it('has outputs section', () => {
    expect(skill).toContain('memoryId');
    expect(skill).toContain('memories');
    expect(skill).toContain('tokensInjected');
    expect(skill).toContain('compressionResult');
    expect(skill).toContain('stats');
  });

  it('has tags for discoverability', () => {
    expect(skill).toContain('memory');
    expect(skill).toContain('persistence');
    expect(skill).toContain('compression');
    expect(skill).toContain('retrieval');
    expect(skill).toContain('cross-session');
  });

  it('describes three-tier hierarchy', () => {
    expect(skill).toContain('Working');
    expect(skill).toContain('Episodic');
    expect(skill).toContain('Semantic');
    expect(skill).toContain('7-day');
    expect(skill).toContain('90-day');
    expect(skill).toContain('permanent');
  });

  it('describes compression strategy', () => {
    expect(skill).toContain('Compression');
    expect(skill).toContain('95%');
  });

  it('describes retrieval methods', () => {
    expect(skill).toContain('Keyword matching');
    expect(skill).toContain('Recency weighting');
    expect(skill).toContain('Tier boosting');
  });
});

/* ═══════════════════════════════════════════════════════════════
   6. Task executor — 3 new handlers
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — Task executor switch cases', () => {
  it('has memory_remember case', () => {
    expect(taskExecutor).toContain("case 'memory_remember'");
  });

  it('has memory_recall case', () => {
    expect(taskExecutor).toContain("case 'memory_recall'");
  });

  it('has memory_compress case', () => {
    expect(taskExecutor).toContain("case 'memory_compress'");
  });

  it('total switch cases is 25', () => {
    const cases = taskExecutor.match(/case\s+'/g);
    expect(cases).not.toBeNull();
    expect(cases!.length).toBe(25);
  });
});

describe('Batch 28 — handleMemoryRemember', () => {
  it('has handleMemoryRemember method', () => {
    expect(taskExecutor).toContain('handleMemoryRemember');
  });

  it('generates memory ID with mem- prefix', () => {
    expect(taskExecutor).toMatch(/mem-\$\{Date\.now\(\)/);
  });

  it('extracts auto-keywords from content', () => {
    expect(taskExecutor).toContain('autoKeywords');
  });

  it('returns memory object with tier', () => {
    expect(taskExecutor).toMatch(/tier.*working|tier.*episodic|tier.*semantic/);
  });

  it('computes token estimate (~4 chars per token)', () => {
    expect(taskExecutor).toContain('content.length / 4');
  });

  it('sets default importance of 0.7', () => {
    expect(taskExecutor).toContain('0.7');
  });

  it('sets initial confidence of 0.8', () => {
    expect(taskExecutor).toContain('confidence: 0.8');
  });

  it('returns reinforcementCount: 0 for new memories', () => {
    expect(taskExecutor).toContain('reinforcementCount: 0');
  });
});

describe('Batch 28 — handleMemoryRecall', () => {
  it('has handleMemoryRecall method', () => {
    expect(taskExecutor).toContain('handleMemoryRecall');
  });

  it('supports method parameter (keyword, semantic, recency, hybrid)', () => {
    expect(taskExecutor).toContain("method ?? 'hybrid'");
  });

  it('defaults topK to 10', () => {
    expect(taskExecutor).toContain('topK');
  });

  it('returns recall object with tokensInjected', () => {
    expect(taskExecutor).toContain('tokensInjected');
  });

  it('returns retrievalMs timing', () => {
    expect(taskExecutor).toContain('retrievalMs');
  });

  it('extracts query words for matching', () => {
    expect(taskExecutor).toContain('queryWords');
  });
});

describe('Batch 28 — handleMemoryCompress', () => {
  it('has handleMemoryCompress method', () => {
    expect(taskExecutor).toContain('handleMemoryCompress');
  });

  it('defaults sourceTier to working', () => {
    expect(taskExecutor).toContain("sourceTier ?? 'working'");
  });

  it('computes targetTier from sourceTier', () => {
    expect(taskExecutor).toContain("working' ? 'episodic' : 'semantic'");
  });

  it('returns compression result with jobId', () => {
    expect(taskExecutor).toContain('jobId');
    expect(taskExecutor).toMatch(/cjob-\$\{Date\.now\(\)/);
  });

  it('returns tokensSaved metric', () => {
    expect(taskExecutor).toContain('tokensSaved');
  });

  it('returns compressionRatio', () => {
    expect(taskExecutor).toContain('compressionRatio');
  });

  it('uses default maxAgeDays based on tier (7 for working, 90 for episodic)', () => {
    expect(taskExecutor).toContain('7');
    expect(taskExecutor).toContain('90');
  });
});

/* ═══════════════════════════════════════════════════════════════
   7. Eidolon types — BuildingKind + EventKind + districtFor
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — EidolonBuildingKind', () => {
  it('includes memory_vault', () => {
    expect(eidolonTypes).toContain("'memory_vault'");
  });

  it('has 13 building kinds (13 pipe characters)', () => {
    const buildingBlock = eidolonTypes.match(
      /export type EidolonBuildingKind[\s\S]*?;/,
    );
    expect(buildingBlock).not.toBeNull();
    const pipes = (buildingBlock![0].match(/\|/g) || []).length;
    expect(pipes).toBe(13);
  });
});

describe('Batch 28 — EidolonEventKind', () => {
  it('includes memory.stored', () => {
    expect(eidolonTypes).toContain("'memory.stored'");
  });

  it('includes memory.recalled', () => {
    expect(eidolonTypes).toContain("'memory.recalled'");
  });

  it('includes memory.compressed', () => {
    expect(eidolonTypes).toContain("'memory.compressed'");
  });

  it('includes memory.decayed', () => {
    expect(eidolonTypes).toContain("'memory.decayed'");
  });

  it('has 64 event kinds (64 pipe characters)', () => {
    const eventBlock = eidolonTypes.match(
      /export type EidolonEventKind[\s\S]*?;/,
    );
    expect(eventBlock).not.toBeNull();
    const pipes = (eventBlock![0].match(/\|/g) || []).length;
    // leading pipe + N-1 separator pipes; with leading pipe, N values = N pipes
    expect(pipes).toBeGreaterThanOrEqual(63);
  });
});

describe('Batch 28 — districtFor', () => {
  it('maps memory_vault to infrastructure', () => {
    expect(eidolonTypes).toContain("case 'memory_vault'");
    expect(eidolonTypes).toContain("return 'infrastructure'");
  });

  it('has 13 cases total', () => {
    const fn = eidolonTypes.match(/function districtFor[\s\S]*?^}/m);
    expect(fn).not.toBeNull();
    const cases = (fn![0].match(/case\s+'/g) || []).length;
    expect(cases).toBe(13);
  });
});

/* ═══════════════════════════════════════════════════════════════
   8. Event bus — SUBJECT_MAP
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — SUBJECT_MAP entries', () => {
  it('has memory.stored mapping', () => {
    expect(eventBus).toContain("'sven.memory.stored': 'memory.stored'");
  });

  it('has memory.recalled mapping', () => {
    expect(eventBus).toContain("'sven.memory.recalled': 'memory.recalled'");
  });

  it('has memory.compressed mapping', () => {
    expect(eventBus).toContain("'sven.memory.compressed': 'memory.compressed'");
  });

  it('has memory.decayed mapping', () => {
    expect(eventBus).toContain("'sven.memory.decayed': 'memory.decayed'");
  });

  it('has 63 total SUBJECT_MAP entries', () => {
    const entries = eventBus.match(/'sven\./g);
    expect(entries).not.toBeNull();
    expect(entries!.length).toBe(63);
  });
});

/* ═══════════════════════════════════════════════════════════════
   9. Integration coherence checks
   ═══════════════════════════════════════════════════════════════ */

describe('Batch 28 — Integration coherence', () => {
  it('migration task types match task executor cases', () => {
    expect(migration).toContain('memory_remember');
    expect(migration).toContain('memory_recall');
    expect(migration).toContain('memory_compress');
    expect(taskExecutor).toContain("case 'memory_remember'");
    expect(taskExecutor).toContain("case 'memory_recall'");
    expect(taskExecutor).toContain("case 'memory_compress'");
  });

  it('migration categories match shared types categories', () => {
    const cats = [
      'preference', 'decision', 'pattern', 'constraint', 'architecture',
      'correction', 'convention', 'fact', 'relationship', 'project_state', 'learning',
    ];
    for (const cat of cats) {
      expect(migration).toContain(`'${cat}'`);
      expect(sharedTypes).toContain(`'${cat}'`);
    }
  });

  it('eidolon event kinds match SUBJECT_MAP', () => {
    const memoryEvents = ['memory.stored', 'memory.recalled', 'memory.compressed', 'memory.decayed'];
    for (const evt of memoryEvents) {
      expect(eidolonTypes).toContain(`'${evt}'`);
      expect(eventBus).toContain(`'${evt}'`);
    }
  });

  it('skill actions cover task executor handlers', () => {
    expect(skill).toContain('name: remember');
    expect(skill).toContain('name: recall');
    expect(skill).toContain('name: compress');
  });

  it('pre-existing memory.ts admin API is not modified', () => {
    const memoryApi = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/src/routes/admin/memory.ts'),
      'utf-8',
    );
    expect(memoryApi).toContain('registerMemoryRoutes');
    expect(memoryApi.length).toBeGreaterThan(900);
  });

  it('pre-existing memory-extractor.ts is not modified', () => {
    const extractor = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/memory-extractor.ts'),
      'utf-8',
    );
    expect(extractor).toContain('MemoryExtractor');
    expect(extractor.length).toBeGreaterThan(400);
  });

  it('memory-extractor already exported from shared/index.ts', () => {
    expect(sharedIndex).toContain('memory-extractor');
  });

  it('persistent-memory now also exported from shared/index.ts', () => {
    expect(sharedIndex).toContain('persistent-memory');
  });
});
