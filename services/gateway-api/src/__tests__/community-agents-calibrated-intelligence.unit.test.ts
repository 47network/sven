import path from 'node:path';
import fs from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';
import { ConfidenceScoringService } from '../services/ConfidenceScoringService';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../db/migrations/20260408140000_community_agents_calibrated_intelligence.sql',
);
const ROUTE_PATH = path.resolve(__dirname, '../routes/admin/community-agents.ts');
const ADMIN_INDEX_PATH = path.resolve(__dirname, '../routes/admin/index.ts');

/*
 * ── Migration schema checks ────────────────────────────────────────
 */
describe('Batch 3+4 Migration', () => {
  let migrationSql: string;

  beforeAll(async () => {
    migrationSql = await fs.readFile(MIGRATION_PATH, 'utf8');
  });

  it('creates agent_personas table with identity columns', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_personas');
    expect(migrationSql).toContain('agent_persona_type');
    expect(migrationSql).toContain('persona_display_name');
    expect(migrationSql).toContain('community_visible');
    expect(migrationSql).toContain('agent_status');
  });

  it('creates agent_messages table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_messages');
    expect(migrationSql).toContain('from_agent_id');
    expect(migrationSql).toContain('to_agent_id');
    expect(migrationSql).toContain('message_type');
  });

  it('creates agent_rate_limits table with cadence profiles', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_rate_limits');
    expect(migrationSql).toContain('cadence_profile');
    expect(migrationSql).toContain('natural');
    expect(migrationSql).toContain('burst');
    expect(migrationSql).toContain('steady');
    expect(migrationSql).toContain('quiet');
  });

  it('creates agent_post_log table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_post_log');
    expect(migrationSql).toContain('moderation_status');
  });

  it('creates transparency_changelog table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS transparency_changelog');
    expect(migrationSql).toContain('entry_type');
    expect(migrationSql).toContain('visibility');
  });

  it('creates agent_moderation_decisions table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS agent_moderation_decisions');
    expect(migrationSql).toContain('risk_score');
    expect(migrationSql).toContain('risk_factors');
  });

  it('creates response_confidence table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS response_confidence');
    expect(migrationSql).toContain('overall_confidence');
    expect(migrationSql).toContain('rag_relevance_score');
    expect(migrationSql).toContain('memory_recency_score');
    expect(migrationSql).toContain('tool_success_score');
    expect(migrationSql).toContain('model_uncertainty_score');
  });

  it('creates feedback_routing_signals table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS feedback_routing_signals');
    expect(migrationSql).toContain('feedback_signal');
    expect(migrationSql).toContain('confidence_at_response');
  });

  it('creates user_corrections table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS user_corrections');
    expect(migrationSql).toContain('verification_status');
    expect(migrationSql).toContain('promoted_to_memory');
  });

  it('creates observed_patterns table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS observed_patterns');
    expect(migrationSql).toContain('pattern_type');
    expect(migrationSql).toContain('occurrence_count');
  });

  it('creates self_improvement_snapshots table', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS self_improvement_snapshots');
    expect(migrationSql).toContain('calibration_error');
  });
});

/*
 * ── Admin routes registration checks ───────────────────────────────
 */
describe('Community Agent Routes', () => {
  let routeSource: string;
  let adminIndex: string;

  beforeAll(async () => {
    routeSource = await fs.readFile(ROUTE_PATH, 'utf8');
    adminIndex = await fs.readFile(ADMIN_INDEX_PATH, 'utf8');
  });

  it('registers persona CRUD endpoints', () => {
    expect(routeSource).toContain("'/community-agents/personas'");
    expect(routeSource).toContain("'/community-agents/personas/:agentId/status'");
    expect(routeSource).toContain("'/community-agents/personas/:agentId/visibility'");
  });

  it('registers agent protocol endpoints', () => {
    expect(routeSource).toContain("'/community-agents/messages'");
    expect(routeSource).toContain("'/community-agents/messages/:agentId/inbox'");
    expect(routeSource).toContain("'/community-agents/messages/thread/:threadId'");
  });

  it('registers rate limit endpoints', () => {
    expect(routeSource).toContain("'/community-agents/rate-limits/:agentId'");
  });

  it('registers moderation endpoints', () => {
    expect(routeSource).toContain("'/community-agents/moderation/pending'");
    expect(routeSource).toContain("'/community-agents/moderation/:decisionId/review'");
  });

  it('registers changelog endpoints', () => {
    expect(routeSource).toContain("'/community-agents/changelog'");
    expect(routeSource).toContain("'/community-agents/changelog/:entryId/publish'");
  });

  it('registers confidence scoring endpoints', () => {
    expect(routeSource).toContain("'/community-agents/confidence/calibration'");
    expect(routeSource).toContain("'/community-agents/confidence/low'");
  });

  it('registers feedback routing endpoints', () => {
    expect(routeSource).toContain("'/community-agents/feedback/signal'");
    expect(routeSource).toContain("'/community-agents/feedback/model-recommendations'");
    expect(routeSource).toContain("'/community-agents/feedback/skill-recommendations'");
    expect(routeSource).toContain("'/community-agents/feedback/task-summary'");
  });

  it('registers correction pipeline endpoints', () => {
    expect(routeSource).toContain("'/community-agents/corrections'");
    expect(routeSource).toContain("'/community-agents/corrections/:correctionId/verify'");
    expect(routeSource).toContain("'/community-agents/corrections/:correctionId/promote'");
  });

  it('registers pattern observation endpoints', () => {
    expect(routeSource).toContain("'/community-agents/patterns'");
    expect(routeSource).toContain("'/community-agents/patterns/:patternId/status'");
  });

  it('registers self-improvement dashboard endpoints', () => {
    expect(routeSource).toContain("'/community-agents/self-improvement/snapshots'");
  });

  it('is wired into admin/index.ts', () => {
    expect(adminIndex).toContain("import { registerCommunityAgentRoutes } from './community-agents.js'");
    expect(adminIndex).toContain('registerCommunityAgentRoutes');
  });
});

/*
 * ── Confidence scoring logic ───────────────────────────────────────
 */
describe('ConfidenceScoringService — disclosure logic', () => {
  const svc = new ConfidenceScoringService(null as any);

  it('discloses below 0.5 threshold', () => {
    expect(svc.shouldDisclose(0.49)).toBe(true);
    expect(svc.shouldDisclose(0.5)).toBe(false);
    expect(svc.shouldDisclose(0.8)).toBe(false);
  });

  it('generates very-low confidence text', () => {
    const text = svc.generateDisclosureText(0.2, {
      rag_relevance_score: 0.1,
      memory_recency_score: 0.2,
    });
    expect(text).toContain("I'm not very confident");
    expect(text).toContain("couldn't find highly relevant");
    expect(text).toContain('memories on this topic are quite old');
    expect(text).toContain('verify this independently');
  });

  it('generates medium-uncertainty text', () => {
    const text = svc.generateDisclosureText(0.45, {
      tool_success_score: 0.3,
    });
    expect(text).toContain("I'm somewhat uncertain");
    expect(text).toContain('tool calls had issues');
  });

  it('includes verification reminder always', () => {
    const text = svc.generateDisclosureText(0.49, {});
    expect(text).toContain('verify this independently');
  });
});

/*
 * ── Service file sanity checks ─────────────────────────────────────
 */
describe('Service files exist and export expected classes', () => {
  const serviceDir = path.resolve(__dirname, '../services');

  const expectedServices = [
    { file: 'AgentPersonaService.ts', export: 'AgentPersonaService' },
    { file: 'AgentProtocolService.ts', export: 'AgentProtocolService' },
    { file: 'AgentRateLimitService.ts', export: 'AgentRateLimitService' },
    { file: 'AgentModeratorService.ts', export: 'AgentModeratorService' },
    { file: 'TransparencyChangelogService.ts', export: 'TransparencyChangelogService' },
    { file: 'ConfidenceScoringService.ts', export: 'ConfidenceScoringService' },
    { file: 'FeedbackRoutingService.ts', export: 'FeedbackRoutingService' },
    { file: 'CorrectionPipelineService.ts', export: 'CorrectionPipelineService' },
    { file: 'PatternObservationService.ts', export: 'PatternObservationService' },
  ];

  for (const { file, export: exportName } of expectedServices) {
    it(`${file} exports ${exportName}`, async () => {
      const source = await fs.readFile(path.join(serviceDir, file), 'utf8');
      expect(source).toContain(`export class ${exportName}`);
    });
  }
});
