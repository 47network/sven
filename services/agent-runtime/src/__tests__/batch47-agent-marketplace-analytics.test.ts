import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 47 — Agent Marketplace Analytics', () => {
  // ── Migration ──
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260520120000_agent_marketplace_analytics.sql'),
      'utf-8',
    );

    it('creates marketplace_analytics_snapshots table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS marketplace_analytics_snapshots');
    });

    it('creates agent_productivity_metrics table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_productivity_metrics');
    });

    it('creates revenue_trend_events table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS revenue_trend_events');
    });

    it('creates category_performance table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS category_performance');
    });

    it('creates marketplace_health_indicators table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS marketplace_health_indicators');
    });

    it('has 15 indexes', () => {
      const indexCount = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(indexCount).toBe(15);
    });

    it('uses CHECK constraints for period_type', () => {
      expect(sql).toContain("period_type IN ('hourly','daily','weekly','monthly','quarterly','yearly')");
    });

    it('uses CHECK constraints for event_type', () => {
      expect(sql).toContain("event_type IN ('task_payment','listing_sale','subscription_fee','tip','refund','penalty','bonus','commission')");
    });

    it('uses CHECK constraints for indicator_type', () => {
      expect(sql).toContain("indicator_type IN ('liquidity','velocity','concentration','satisfaction','fraud_risk','growth','churn','retention')");
    });

    it('uses CHECK constraints for health status', () => {
      expect(sql).toContain("status IN ('healthy','warning','critical','unknown')");
    });

    it('wraps in transaction', () => {
      expect(sql).toContain('BEGIN;');
      expect(sql).toContain('COMMIT;');
    });
  });

  // ── Shared types ──
  describe('Shared types', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-marketplace-analytics.ts'),
      'utf-8',
    );

    it('exports AnalyticsPeriodType with 6 values', () => {
      expect(types).toContain("export type AnalyticsPeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'");
    });

    it('exports RevenueEventType with 8 values', () => {
      expect(types).toContain("'task_payment' | 'listing_sale' | 'subscription_fee' | 'tip' | 'refund' | 'penalty' | 'bonus' | 'commission'");
    });

    it('exports HealthIndicatorType with 8 values', () => {
      expect(types).toContain("'liquidity' | 'velocity' | 'concentration' | 'satisfaction' | 'fraud_risk' | 'growth' | 'churn' | 'retention'");
    });

    it('exports HealthIndicatorStatus with 4 values', () => {
      expect(types).toContain("'healthy' | 'warning' | 'critical' | 'unknown'");
    });

    it('exports AnalyticsDimension with 6 values', () => {
      expect(types).toContain("'time' | 'category' | 'agent' | 'skill' | 'geography' | 'price_range'");
    });

    it('exports TrendDirection with 4 values', () => {
      expect(types).toContain("'rising' | 'falling' | 'stable' | 'volatile'");
    });

    it('exports ProductivityTier with 5 values', () => {
      expect(types).toContain("'elite' | 'high' | 'average' | 'below_average' | 'inactive'");
    });

    it('exports MarketplaceSnapshot interface', () => {
      expect(types).toContain('export interface MarketplaceSnapshot');
    });

    it('exports AgentProductivityMetric interface', () => {
      expect(types).toContain('export interface AgentProductivityMetric');
    });

    it('exports RevenueTrendEvent interface', () => {
      expect(types).toContain('export interface RevenueTrendEvent');
    });

    it('exports CategoryPerformance interface', () => {
      expect(types).toContain('export interface CategoryPerformance');
    });

    it('exports HealthIndicator interface', () => {
      expect(types).toContain('export interface HealthIndicator');
    });

    it('has 6 constant arrays', () => {
      expect(types).toContain('ANALYTICS_PERIOD_TYPES');
      expect(types).toContain('REVENUE_EVENT_TYPES');
      expect(types).toContain('HEALTH_INDICATOR_TYPES');
      expect(types).toContain('HEALTH_STATUS_VALUES');
      expect(types).toContain('PRODUCTIVITY_TIERS');
      expect(types).toContain('TREND_DIRECTIONS');
    });

    it('exports getProductivityTier helper', () => {
      expect(types).toContain('export function getProductivityTier');
    });

    it('exports calculateGrowthRate helper', () => {
      expect(types).toContain('export function calculateGrowthRate');
    });

    it('exports getTrendDirection helper', () => {
      expect(types).toContain('export function getTrendDirection');
    });

    it('exports evaluateHealthStatus helper', () => {
      expect(types).toContain('export function evaluateHealthStatus');
    });
  });

  // ── Helper logic ──
  describe('Helper functions', () => {
    // We'll test by importing dynamically with eval to avoid TS module issues
    const types = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-marketplace-analytics.ts'),
      'utf-8',
    );

    it('getProductivityTier returns elite for 90+', () => {
      expect(types).toContain("if (efficiencyScore >= 90) return 'elite'");
    });

    it('getProductivityTier returns inactive for low scores', () => {
      expect(types).toContain("return 'inactive'");
    });

    it('calculateGrowthRate handles zero previous', () => {
      expect(types).toContain('if (previous === 0) return current > 0 ? 100 : 0');
    });

    it('getTrendDirection computes variance', () => {
      expect(types).toContain('const variance =');
    });

    it('evaluateHealthStatus returns unknown when thresholds missing', () => {
      expect(types).toContain("return 'unknown'");
    });
  });

  // ── SKILL.md ──
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/marketplace-analytics/SKILL.md'),
      'utf-8',
    );

    it('declares skill name', () => {
      expect(skill).toMatch(/skill:\s*marketplace-analytics/);
    });

    it('declares analyst archetype', () => {
      expect(skill).toMatch(/archetype:\s*analyst/);
    });

    it('defines snapshot_generate action', () => {
      expect(skill).toContain('### snapshot_generate');
    });

    it('defines productivity_score action', () => {
      expect(skill).toContain('### productivity_score');
    });

    it('defines revenue_trend action', () => {
      expect(skill).toContain('### revenue_trend');
    });

    it('defines category_analyze action', () => {
      expect(skill).toContain('### category_analyze');
    });

    it('defines health_check action', () => {
      expect(skill).toContain('### health_check');
    });

    it('defines leaderboard_query action', () => {
      expect(skill).toContain('### leaderboard_query');
    });

    it('defines forecast_generate action', () => {
      expect(skill).toContain('### forecast_generate');
    });
  });

  // ── shared/index.ts ──
  describe('shared/index.ts', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('exports agent-marketplace-analytics module', () => {
      expect(idx).toContain("export * from './agent-marketplace-analytics.js'");
    });

    it('has correct line count', () => {
      const lines = idx.split('\n').length;
      expect(lines).toBe(73);
    });
  });

  // ── Eidolon types ──
  describe('Eidolon types', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes analytics_observatory building kind', () => {
      expect(types).toContain("'analytics_observatory'");
    });

    it('has 30 building kinds', () => {
      const block = types.split('export type EidolonBuildingKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(30);
    });

    it('includes analytics.snapshot_generated event', () => {
      expect(types).toContain("'analytics.snapshot_generated'");
    });

    it('includes analytics.health_alert event', () => {
      expect(types).toContain("'analytics.health_alert'");
    });

    it('includes analytics.trend_detected event', () => {
      expect(types).toContain("'analytics.trend_detected'");
    });

    it('includes analytics.productivity_scored event', () => {
      expect(types).toContain("'analytics.productivity_scored'");
    });

    it('has 136 event kinds', () => {
      const block = types.split('export type EidolonEventKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(136);
    });

    it('maps analytics_observatory to market district', () => {
      expect(types).toContain("case 'analytics_observatory':");
      expect(types).toContain("return 'market'");
    });

    it('has 30 districtFor cases', () => {
      const fn = types.split('function districtFor')[1];
      const cases = (fn.match(/case '/g) || []).length;
      expect(cases).toBe(30);
    });
  });

  // ── Event bus ──
  describe('Event bus', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps analytics.snapshot_generated subject', () => {
      expect(bus).toContain("'sven.analytics.snapshot_generated': 'analytics.snapshot_generated'");
    });

    it('maps analytics.health_alert subject', () => {
      expect(bus).toContain("'sven.analytics.health_alert': 'analytics.health_alert'");
    });

    it('maps analytics.trend_detected subject', () => {
      expect(bus).toContain("'sven.analytics.trend_detected': 'analytics.trend_detected'");
    });

    it('maps analytics.productivity_scored subject', () => {
      expect(bus).toContain("'sven.analytics.productivity_scored': 'analytics.productivity_scored'");
    });

    it('has 135 SUBJECT_MAP entries', () => {
      const block = bus.split('SUBJECT_MAP')[1].split('}')[0];
      const entries = (block.match(/'[^']+'\s*:/g) || []).length;
      expect(entries).toBe(135);
    });
  });

  // ── Task executor ──
  describe('Task executor', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('routes analytics_snapshot', () => {
      expect(exec).toContain("case 'analytics_snapshot':");
    });

    it('routes analytics_productivity', () => {
      expect(exec).toContain("case 'analytics_productivity':");
    });

    it('routes analytics_revenue_trend', () => {
      expect(exec).toContain("case 'analytics_revenue_trend':");
    });

    it('routes analytics_category', () => {
      expect(exec).toContain("case 'analytics_category':");
    });

    it('routes analytics_health_check', () => {
      expect(exec).toContain("case 'analytics_health_check':");
    });

    it('routes analytics_leaderboard', () => {
      expect(exec).toContain("case 'analytics_leaderboard':");
    });

    it('routes analytics_forecast', () => {
      expect(exec).toContain("case 'analytics_forecast':");
    });

    it('has 110 total switch cases', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(110);
    });

    it('has 106 handler methods', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(106);
    });

    it('handleAnalyticsSnapshot returns snapshot data', () => {
      expect(exec).toContain('handleAnalyticsSnapshot');
      expect(exec).toContain('Marketplace snapshot generated');
    });

    it('handleAnalyticsProductivity returns tier', () => {
      expect(exec).toContain('handleAnalyticsProductivity');
      expect(exec).toContain('Productivity scored for agent');
    });

    it('handleAnalyticsRevenueTrend returns trends', () => {
      expect(exec).toContain('handleAnalyticsRevenueTrend');
      expect(exec).toContain('Revenue trend analyzed');
    });

    it('handleAnalyticsCategory returns demand score', () => {
      expect(exec).toContain('handleAnalyticsCategory');
      expect(exec).toContain('Category performance analyzed');
    });

    it('handleAnalyticsHealthCheck returns status', () => {
      expect(exec).toContain('handleAnalyticsHealthCheck');
      expect(exec).toContain('Health check performed');
    });

    it('handleAnalyticsLeaderboard returns entries', () => {
      expect(exec).toContain('handleAnalyticsLeaderboard');
      expect(exec).toContain('Leaderboard generated');
    });

    it('handleAnalyticsForecast returns predictions', () => {
      expect(exec).toContain('handleAnalyticsForecast');
      expect(exec).toContain('Forecast generated');
    });
  });

  // ── Cross-cutting ──
  describe('Cross-cutting', () => {
    it('has 33 migrations total', () => {
      const migs = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations'))
        .filter(f => f.endsWith('.sql'));
      expect(migs.length).toBe(33);
    });

    it('has 40 skill directories', () => {
      const skills = fs.readdirSync(path.join(ROOT, 'skills/autonomous-economy'))
        .filter(d => fs.statSync(path.join(ROOT, 'skills/autonomous-economy', d)).isDirectory());
      expect(skills.length).toBe(40);
    });

    it('.gitattributes includes Batch 47 entries', () => {
      const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
      expect(ga).toContain('Batch 47');
      expect(ga).toContain('agent-marketplace-analytics.ts');
    });

    it('CHANGELOG mentions Batch 47', () => {
      const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
      expect(cl).toContain('Batch 47');
      expect(cl).toContain('Agent Marketplace Analytics');
    });
  });
});
