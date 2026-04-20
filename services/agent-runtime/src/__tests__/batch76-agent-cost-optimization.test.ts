import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 76 — Agent Cost Optimization', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617130000_agent_cost_optimization.sql'), 'utf-8');

    it('creates cost_budgets table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS cost_budgets'); });
    it('creates cost_entries table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS cost_entries'); });
    it('creates cost_forecasts table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS cost_forecasts'); });
    it('creates cost_recommendations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS cost_recommendations'); });
    it('creates cost_alerts table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS cost_alerts'); });
    it('has at least 20 indexes', () => { expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-cost-optimization.ts'), 'utf-8');

    it('exports CostBudgetPeriod type', () => { expect(src).toContain('export type CostBudgetPeriod'); });
    it('exports CostResourceType type', () => { expect(src).toContain('export type CostResourceType'); });
    it('exports CostRecommendationCategory type', () => { expect(src).toContain('export type CostRecommendationCategory'); });
    it('exports CostAlertType type', () => { expect(src).toContain('export type CostAlertType'); });
    it('exports CostAlertSeverity type', () => { expect(src).toContain('export type CostAlertSeverity'); });
    it('exports CostBudget interface', () => { expect(src).toContain('export interface CostBudget'); });
    it('exports CostEntry interface', () => { expect(src).toContain('export interface CostEntry'); });
    it('exports CostForecast interface', () => { expect(src).toContain('export interface CostForecast'); });
    it('exports CostRecommendation interface', () => { expect(src).toContain('export interface CostRecommendation'); });
    it('exports CostAlert interface', () => { expect(src).toContain('export interface CostAlert'); });
    it('exports budgetUtilization helper', () => { expect(src).toContain('export function budgetUtilization'); });
    it('exports isOverBudget helper', () => { expect(src).toContain('export function isOverBudget'); });
    it('exports dailyBurnRate helper', () => { expect(src).toContain('export function dailyBurnRate'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-cost-optimization module', () => { expect(idx).toContain("export * from './agent-cost-optimization.js'"); });
    it('has at least 101 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(101); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-cost-optimization/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-cost-optimization/); });
    it('has accountant archetype', () => { expect(md).toMatch(/archetype:\s*accountant/); });
    it('has 7 actions', () => { expect((md.match(/^### /gm) || []).length).toBe(7); });
  });

  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes cost_center building kind', () => { expect(types).toContain("'cost_center'"); });
    it('has 59 building kind values', () => {
      const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(59);
    });
  });

  describe('Eidolon Event Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes cost event kinds', () => {
      expect(types).toContain("'cost.budget_created'");
      expect(types).toContain("'cost.spend_recorded'");
      expect(types).toContain("'cost.alert_triggered'");
      expect(types).toContain("'cost.recommendation_made'");
    });
    it('has 252 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(252);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps cost_center to civic', () => { expect(types).toContain("case 'cost_center':"); });
    it('has 59 cases', () => {
      const m = types.match(/export function districtFor[\s\S]*?^}/m);
      expect((m![0].match(/case '/g) || []).length).toBe(59);
    });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 cost subject entries', () => {
      expect(bus).toContain("'sven.cost.budget_created'");
      expect(bus).toContain("'sven.cost.spend_recorded'");
      expect(bus).toContain("'sven.cost.alert_triggered'");
      expect(bus).toContain("'sven.cost.recommendation_made'");
    });
    it('has 251 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(251);
    });
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 cost switch cases', () => {
      expect(te).toContain("case 'cost_create_budget':");
      expect(te).toContain("case 'cost_record_spend':");
      expect(te).toContain("case 'cost_forecast':");
      expect(te).toContain("case 'cost_recommend':");
      expect(te).toContain("case 'cost_check_alerts':");
      expect(te).toContain("case 'cost_budget_report':");
      expect(te).toContain("case 'cost_optimize':");
    });
    it('has 313 total switch cases', () => { expect((te.match(/case '/g) || []).length).toBe(313); });
  });

  describe('Task executor handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 cost handler methods', () => {
      expect(te).toMatch(/private (?:async )?handleCostCreateBudget/);
      expect(te).toMatch(/private (?:async )?handleCostRecordSpend/);
      expect(te).toMatch(/private (?:async )?handleCostForecast/);
      expect(te).toMatch(/private (?:async )?handleCostRecommend/);
      expect(te).toMatch(/private (?:async )?handleCostCheckAlerts/);
      expect(te).toMatch(/private (?:async )?handleCostBudgetReport/);
      expect(te).toMatch(/private (?:async )?handleCostOptimize/);
    });
    it('has 309 total handler methods', () => {
      expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(309);
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks cost migration as private', () => { expect(ga).toContain('20260617130000_agent_cost_optimization.sql'); });
    it('marks cost shared types as private', () => { expect(ga).toContain('agent-cost-optimization.ts'); });
    it('marks cost skill as private', () => { expect(ga).toContain('agent-cost-optimization/SKILL.md'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 76', () => { expect(cl).toContain('Batch 76'); });
    it('mentions Agent Cost Optimization', () => { expect(cl).toContain('Agent Cost Optimization'); });
  });

  describe('Migrations', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 62 migration files', () => { expect(files.length).toBe(62); });
  });
});
