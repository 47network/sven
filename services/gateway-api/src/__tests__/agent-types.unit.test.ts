/**
 * Unit tests for Batch 3 agent type implementations (3.2–3.9, 3.14)
 * Tests: migration structure, service exports, route registration, core logic
 */

import * as fs from 'fs';
import * as path from 'path';

/* ------------------------------------------------------------------ */
/*  Migration structure tests                                          */
/* ------------------------------------------------------------------ */
describe('Agent type tables migration', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../db/migrations/20260408160000_agent_type_tables.sql',
  );
  let sql: string;

  beforeAll(() => {
    sql = fs.readFileSync(migrationPath, 'utf-8');
  });

  it('creates agent_faq_entries table for Guide Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_faq_entries');
    expect(sql).toContain('REFERENCES agent_personas(id)');
    expect(sql).toMatch(/source_type\s+TEXT NOT NULL DEFAULT 'knowledge_graph'/);
  });

  it('creates agent_capability_reports table for Inspector Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_capability_reports');
    expect(sql).toMatch(/test_type\s+TEXT NOT NULL DEFAULT 'health_check'/);
    expect(sql).toMatch(/status\s+TEXT NOT NULL DEFAULT 'pass'/);
  });

  it('creates agent_curated_highlights table for Curator Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_curated_highlights');
    expect(sql).toMatch(/significance_score\s+DOUBLE PRECISION/);
    expect(sql).toContain("('conversation', 'pattern', 'correction', 'feedback', 'agent_exchange')");
  });

  it('creates agent_feature_requests table for Advocate Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feature_requests');
    expect(sql).toMatch(/user_votes\s+INTEGER NOT NULL DEFAULT 0/);
    expect(sql).toContain("('open', 'under_review', 'planned', 'in_progress', 'completed', 'declined')");
  });

  it('creates agent_bug_reports table for QA Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_bug_reports');
    expect(sql).toMatch(/severity\s+TEXT NOT NULL DEFAULT 'medium'/);
    expect(sql).toMatch(/reproduction_steps\s+JSONB/);
  });

  it('creates agent_knowledge_index table for Librarian Agent', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_knowledge_index');
    expect(sql).toMatch(/entry_type\s+TEXT NOT NULL DEFAULT 'article'/);
    expect(sql).toMatch(/view_count\s+INTEGER NOT NULL DEFAULT 0/);
  });

  it('creates agent_test_scenarios table for Feature Tester + Imagination', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_test_scenarios');
    expect(sql).toContain("('functional', 'integration', 'edge_case', 'creative', 'stress')");
    expect(sql).toContain('imagined_by');
    expect(sql).toContain('REFERENCES agent_personas(id) ON DELETE SET NULL');
  });

  it('wraps all DDL in a transaction', () => {
    expect(sql.trim()).toMatch(/^(?:--[^\n]*\n)*\s*BEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;\s*$/);
  });

  it('creates proper indexes on all tables', () => {
    expect(sql).toContain('idx_agent_faq_org');
    expect(sql).toContain('idx_capability_reports_org');
    expect(sql).toContain('idx_curated_highlights_org');
    expect(sql).toContain('idx_feature_requests_org');
    expect(sql).toContain('idx_bug_reports_org');
    expect(sql).toContain('idx_knowledge_index_org');
    expect(sql).toContain('idx_test_scenarios_org');
  });

  it('has ON DELETE CASCADE for all agent_personas FK references', () => {
    const fkRefs = sql.match(/REFERENCES agent_personas\(id\) ON DELETE (CASCADE|SET NULL)/g) ?? [];
    expect(fkRefs.length).toBeGreaterThanOrEqual(8);
  });
});

/* ------------------------------------------------------------------ */
/*  Service export tests                                               */
/* ------------------------------------------------------------------ */
describe('Agent type service exports', () => {
  it('exports GuideAgentService', () => {
    const mod = require('../services/GuideAgentService');
    expect(mod.GuideAgentService).toBeDefined();
    expect(typeof mod.GuideAgentService).toBe('function');
  });

  it('exports InspectorAgentService', () => {
    const mod = require('../services/InspectorAgentService');
    expect(mod.InspectorAgentService).toBeDefined();
  });

  it('exports CuratorAgentService', () => {
    const mod = require('../services/CuratorAgentService');
    expect(mod.CuratorAgentService).toBeDefined();
  });

  it('exports AdvocateAgentService', () => {
    const mod = require('../services/AdvocateAgentService');
    expect(mod.AdvocateAgentService).toBeDefined();
  });

  it('exports QAAgentService', () => {
    const mod = require('../services/QAAgentService');
    expect(mod.QAAgentService).toBeDefined();
  });

  it('exports LibrarianAgentService', () => {
    const mod = require('../services/LibrarianAgentService');
    expect(mod.LibrarianAgentService).toBeDefined();
  });

  it('exports FeatureTesterAgentService', () => {
    const mod = require('../services/FeatureTesterAgentService');
    expect(mod.FeatureTesterAgentService).toBeDefined();
  });

  it('exports FeatureImaginationAgentService', () => {
    const mod = require('../services/FeatureImaginationAgentService');
    expect(mod.FeatureImaginationAgentService).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/*  Route registration test                                            */
/* ------------------------------------------------------------------ */
describe('Agent type route registration', () => {
  const routePath = path.resolve(__dirname, '../routes/admin/agent-types.ts');
  let routeSrc: string;

  beforeAll(() => {
    routeSrc = fs.readFileSync(routePath, 'utf-8');
  });

  it('exports registerAgentTypeRoutes', () => {
    expect(routeSrc).toContain('export async function registerAgentTypeRoutes');
  });

  it('registers all 8 agent bootstrap endpoints', () => {
    const bootstrapRoutes = [
      'guide/bootstrap',
      'inspector/bootstrap',
      'curator/bootstrap',
      'advocate/bootstrap',
      'qa/bootstrap',
      'librarian/bootstrap',
      'tester/bootstrap',
      'imagination/bootstrap',
    ];
    for (const route of bootstrapRoutes) {
      expect(routeSrc).toContain(route);
    }
  });

  it('registers Guide Agent FAQ endpoints', () => {
    expect(routeSrc).toContain('guide/faq');
    expect(routeSrc).toContain('guide/welcome');
    expect(routeSrc).toContain('guide/answer');
    expect(routeSrc).toContain('guide/stats');
  });

  it('registers Inspector Agent endpoints', () => {
    expect(routeSrc).toContain('inspector/check');
    expect(routeSrc).toContain('inspector/scan');
    expect(routeSrc).toContain('inspector/reports');
    expect(routeSrc).toContain('inspector/health-summary');
  });

  it('registers Curator Agent endpoints', () => {
    expect(routeSrc).toContain('curator/analyze');
    expect(routeSrc).toContain('curator/highlights');
    expect(routeSrc).toContain('curator/summary');
  });

  it('registers Advocate Agent endpoints', () => {
    expect(routeSrc).toContain('advocate/surface-requests');
    expect(routeSrc).toContain('advocate/feature-requests');
    expect(routeSrc).toContain('advocate/roadmap-summary');
  });

  it('registers QA Agent endpoints', () => {
    expect(routeSrc).toContain('qa/bug-reports');
    expect(routeSrc).toContain('qa/quality-metrics');
  });

  it('registers Librarian Agent endpoints', () => {
    expect(routeSrc).toContain('librarian/index');
    expect(routeSrc).toContain('librarian/search');
    expect(routeSrc).toContain('librarian/stats');
  });

  it('registers Feature Tester Agent endpoints', () => {
    expect(routeSrc).toContain('tester/scenarios');
    expect(routeSrc).toContain('tester/summary');
  });

  it('registers Feature Imagination Agent endpoints', () => {
    expect(routeSrc).toContain('imagination/scenarios');
    expect(routeSrc).toContain('imagination/summary');
    expect(routeSrc).toContain('propose');
  });
});

/* ------------------------------------------------------------------ */
/*  Guide Agent welcome message logic                                  */
/* ------------------------------------------------------------------ */
describe('Guide Agent welcome message', () => {
  it('contains expected feature highlights', () => {
    const { GuideAgentService } = require('../services/GuideAgentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    const svc = new GuideAgentService(mockPool);
    return svc.generateWelcome('org-1', 'user-1').then((welcome: { greeting: string; feature_highlights: string[] }) => {
      expect(welcome.greeting).toContain('Welcome');
      expect(welcome.feature_highlights.length).toBeGreaterThanOrEqual(4);
      expect(welcome.feature_highlights[0]).toContain('Multi-channel');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Inspector health summary logic                                     */
/* ------------------------------------------------------------------ */
describe('Inspector health classification', () => {
  it('classifies as healthy when all pass', () => {
    const { InspectorAgentService } = require('../services/InspectorAgentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { capability_name: 'database', status: 'pass', avg_ms: '10' },
          { capability_name: 'chat', status: 'pass', avg_ms: '20' },
        ],
      }),
    };
    const svc = new InspectorAgentService(mockPool);
    return svc.getHealthSummary('org-1').then((s: { overall_health: string }) => {
      expect(s.overall_health).toBe('healthy');
    });
  });

  it('classifies as unhealthy when any fail', () => {
    const { InspectorAgentService } = require('../services/InspectorAgentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { capability_name: 'database', status: 'pass', avg_ms: '10' },
          { capability_name: 'nats', status: 'fail', avg_ms: '0' },
        ],
      }),
    };
    const svc = new InspectorAgentService(mockPool);
    return svc.getHealthSummary('org-1').then((s: { overall_health: string }) => {
      expect(s.overall_health).toBe('unhealthy');
    });
  });

  it('classifies as degraded when some degraded but none fail', () => {
    const { InspectorAgentService } = require('../services/InspectorAgentService');
    const mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { capability_name: 'database', status: 'pass', avg_ms: '10' },
          { capability_name: 'search', status: 'degraded', avg_ms: '5500' },
        ],
      }),
    };
    const svc = new InspectorAgentService(mockPool);
    return svc.getHealthSummary('org-1').then((s: { overall_health: string }) => {
      expect(s.overall_health).toBe('degraded');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Guide Agent FAQ search - empty input handling                      */
/* ------------------------------------------------------------------ */
describe('Guide Agent FAQ search edge cases', () => {
  it('returns rephrasing prompt for empty search terms', () => {
    const { GuideAgentService } = require('../services/GuideAgentService');
    const mockPool = { query: jest.fn() };
    const svc = new GuideAgentService(mockPool);
    return svc.answerFAQ('org-1', '?! ..').then((r: { answer: string; source: unknown }) => {
      expect(r.answer).toContain('rephrase');
      expect(r.source).toBeNull();
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Imagination Agent categories                                       */
/* ------------------------------------------------------------------ */
describe('Feature Imagination Agent', () => {
  it('defines creativity categories', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../services/FeatureImaginationAgentService.ts'),
      'utf-8',
    );
    expect(src).toContain('novel_workflow');
    expect(src).toContain('cross_feature_combo');
    expect(src).toContain('edge_case_exploration');
    expect(src).toContain('user_persona_simulation');
    expect(src).toContain('stress_scenario');
    expect(src).toContain('creative_misuse');
  });
});

/* ------------------------------------------------------------------ */
/*  QA Agent duplicate detection                                       */
/* ------------------------------------------------------------------ */
describe('QA Agent bug deduplication', () => {
  it('links duplicate bug report to existing when same capability has open bug', () => {
    const { QAAgentService } = require('../services/QAAgentService');
    const mockPool = {
      query: jest.fn()
        // First call: check for existing open bug
        .mockResolvedValueOnce({ rows: [{ id: 'existing-bug-1' }] })
        // Second call: insert with linked_report_id
        .mockResolvedValueOnce({
          rows: [{
            id: 'new-bug', linked_report_id: 'existing-bug-1',
            title: '[Duplicate] test bug',
          }],
        })
        // Third call: mark as duplicate
        .mockResolvedValueOnce({ rows: [] }),
    };
    const svc = new QAAgentService(mockPool);
    return svc.fileBugReport('org-1', {
      agent_id: 'agent-1',
      title: 'test bug',
      description: 'desc',
      affected_capability: 'chat_messaging',
    }).then((r: { linked_report_id: string; title: string }) => {
      expect(r.linked_report_id).toBe('existing-bug-1');
      expect(r.title).toContain('[Duplicate]');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Docker compose for agent test VM (3.14)                            */
/* ------------------------------------------------------------------ */
describe('Agent test VM compose file', () => {
  const composePath = path.resolve(
    __dirname,
    '../../../../deploy/multi-vm/docker-compose.vm-agents-test.yml',
  );

  it('exists', () => {
    expect(fs.existsSync(composePath)).toBe(true);
  });

  it('defines gateway-api-test service', () => {
    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('gateway-api-test');
  });

  it('defines postgres-test service', () => {
    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('postgres-test');
  });

  it('defines nats-test service', () => {
    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('nats-test');
  });

  it('uses isolated network', () => {
    const content = fs.readFileSync(composePath, 'utf-8');
    expect(content).toContain('sven-agents-test');
  });
});
