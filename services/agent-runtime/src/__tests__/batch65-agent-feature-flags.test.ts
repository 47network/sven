import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 65 — Agent Feature Flags & Experiments', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260607120000_agent_feature_flags.sql'), 'utf-8');

    it('creates agent_feature_flags table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_feature_flags'); });
    it('creates agent_experiments table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_experiments'); });
    it('creates experiment_variants table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS experiment_variants'); });
    it('creates experiment_assignments table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS experiment_assignments'); });
    it('creates experiment_metrics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS experiment_metrics'); });
    it('has flag_type CHECK', () => { expect(sql).toMatch(/flag_type.*CHECK/); });
    it('has experiment status CHECK', () => { expect(sql).toMatch(/status.*CHECK.*draft.*running.*paused.*completed.*cancelled/s); });
    it('has traffic_pct CHECK', () => { expect(sql).toContain('traffic_pct BETWEEN 0 AND 100'); });
    it('has at least 19 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
    it('has GIN index for tags', () => { expect(sql).toContain('USING GIN(tags)'); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-feature-flags.ts'), 'utf-8');
    it('exports FlagType', () => { expect(src).toContain('export type FlagType'); });
    it('exports ExperimentStatus', () => { expect(src).toContain('export type ExperimentStatus'); });
    it('exports FeatureFlagAction', () => { expect(src).toContain('export type FeatureFlagAction'); });
    it('FlagType has 5 values', () => {
      const m = src.match(/export type FlagType\s*=\s*([^;]+)/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports AgentFeatureFlag interface', () => { expect(src).toContain('export interface AgentFeatureFlag'); });
    it('exports AgentExperiment interface', () => { expect(src).toContain('export interface AgentExperiment'); });
    it('exports ExperimentVariant interface', () => { expect(src).toContain('export interface ExperimentVariant'); });
    it('exports ExperimentAssignment interface', () => { expect(src).toContain('export interface ExperimentAssignment'); });
    it('exports ExperimentMetric interface', () => { expect(src).toContain('export interface ExperimentMetric'); });
    it('exports isFlagEnabled helper', () => { expect(src).toContain('export function isFlagEnabled'); });
    it('exports isExperimentActive helper', () => { expect(src).toContain('export function isExperimentActive'); });
    it('exports calculateVariantWinner helper', () => { expect(src).toContain('export function calculateVariantWinner'); });
    it('exports getTrafficAllocation helper', () => { expect(src).toContain('export function getTrafficAllocation'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-feature-flags', () => { expect(idx).toContain('./agent-feature-flags'); });
    it('has at least 90 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(90); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-feature-flags/SKILL.md'), 'utf-8');
    it('has correct skill id', () => { expect(skill).toMatch(/skill:\s*agent-feature-flags/); });
    it('has flag_create action', () => { expect(skill).toContain('### flag_create'); });
    it('has flag_toggle action', () => { expect(skill).toContain('### flag_toggle'); });
    it('has experiment_create action', () => { expect(skill).toContain('### experiment_create'); });
    it('has experiment_start action', () => { expect(skill).toContain('### experiment_start'); });
    it('has variant_assign action', () => { expect(skill).toContain('### variant_assign'); });
    it('has metric_record action', () => { expect(skill).toContain('### metric_record'); });
    it('has experiment_conclude action', () => { expect(skill).toContain('### experiment_conclude'); });
  });

  describe('Eidolon building kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has experiment_lab building kind', () => { expect(types).toContain("'experiment_lab'"); });
    it('has 48 total building kinds', () => {
      const bk = types.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect(bk).toBeTruthy();
      expect((bk![1].match(/\|/g) || []).length).toBe(48);
    });
  });

  describe('Eidolon event kinds', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has flags.flag_toggled', () => { expect(types).toContain("'flags.flag_toggled'"); });
    it('has flags.experiment_started', () => { expect(types).toContain("'flags.experiment_started'"); });
    it('has flags.variant_assigned', () => { expect(types).toContain("'flags.variant_assigned'"); });
    it('has flags.experiment_concluded', () => { expect(types).toContain("'flags.experiment_concluded'"); });
    it('has 208 total event kinds', () => {
      const ek = types.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect(ek).toBeTruthy();
      expect((ek![1].match(/\|/g) || []).length).toBe(208);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has experiment_lab case', () => { expect(types).toContain("case 'experiment_lab':"); });
    it('has 48 cases', () => {
      const dfn = types.split('districtFor')[1]?.split('function ')[0] || '';
      expect((dfn.match(/case '\w+':/g) || []).length).toBe(48);
    });
  });

  describe('SUBJECT_MAP', () => {
    const ebus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.flags.flag_toggled', () => { expect(ebus).toContain("'sven.flags.flag_toggled'"); });
    it('has sven.flags.experiment_started', () => { expect(ebus).toContain("'sven.flags.experiment_started'"); });
    it('has sven.flags.variant_assigned', () => { expect(ebus).toContain("'sven.flags.variant_assigned'"); });
    it('has sven.flags.experiment_concluded', () => { expect(ebus).toContain("'sven.flags.experiment_concluded'"); });
    it('has 207 entries', () => {
      const m = ebus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(207);
    });
  });

  describe('Task executor switch cases', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has flag_create case', () => { expect(tex).toContain("case 'flag_create'"); });
    it('has flag_toggle case', () => { expect(tex).toContain("case 'flag_toggle'"); });
    it('has experiment_create case', () => { expect(tex).toContain("case 'experiment_create'"); });
    it('has experiment_start case', () => { expect(tex).toContain("case 'experiment_start'"); });
    it('has variant_assign case', () => { expect(tex).toContain("case 'variant_assign'"); });
    it('has metric_record case', () => { expect(tex).toContain("case 'metric_record'"); });
    it('has experiment_conclude case', () => { expect(tex).toContain("case 'experiment_conclude'"); });
    it('has 236 total switch cases', () => { expect((tex.match(/case '\w+':/g) || []).length).toBe(236); });
  });

  describe('Task executor handlers', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has handleFlagCreate', () => { expect(tex).toContain('handleFlagCreate'); });
    it('has handleFlagToggle', () => { expect(tex).toContain('handleFlagToggle'); });
    it('has handleExperimentCreate', () => { expect(tex).toContain('handleExperimentCreate'); });
    it('has handleExperimentStart', () => { expect(tex).toContain('handleExperimentStart'); });
    it('has handleVariantAssign', () => { expect(tex).toContain('handleVariantAssign'); });
    it('has handleMetricRecord', () => { expect(tex).toContain('handleMetricRecord'); });
    it('has handleExperimentConclude', () => { expect(tex).toContain('handleExperimentConclude'); });
    it('has 232 total handlers', () => { expect((tex.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(232); });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('covers migration', () => { expect(ga).toContain('agent_feature_flags.sql'); });
    it('covers shared types', () => { expect(ga).toContain('agent-feature-flags.ts'); });
    it('covers skill', () => { expect(ga).toContain('agent-feature-flags/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 65', () => { expect(cl).toContain('Batch 65'); });
    it('mentions Feature Flags', () => { expect(cl).toContain('Feature Flags'); });
  });

  describe('Migration count', () => {
    it('has 51 migration files', () => {
      const migs = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
      expect(migs.length).toBe(51);
    });
  });
});
