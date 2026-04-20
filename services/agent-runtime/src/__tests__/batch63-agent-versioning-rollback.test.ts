import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 63 — Agent Versioning & Rollback', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260605120000_agent_versioning_rollback.sql'), 'utf-8');

    it('creates agent_versions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_versions'); });
    it('creates agent_snapshots table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_snapshots'); });
    it('creates agent_rollbacks table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_rollbacks'); });
    it('creates agent_deployment_slots table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_deployment_slots'); });
    it('creates agent_version_diffs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_version_diffs'); });
    it('has at least 19 indexes', () => {
      expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(19);
    });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-versioning-rollback.ts'), 'utf-8');

    it('exports SnapshotType with 5 values', () => {
      const m = src.match(/export type SnapshotType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports AgentvRollbackType with 5 values', () => {
      const m = src.match(/export type AgentvRollbackType\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports AgentvRollbackStatus with 5 values', () => {
      const m = src.match(/export type AgentvRollbackStatus\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports DeploymentSlot with 5 values', () => {
      const m = src.match(/export type DeploymentSlot\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports VersionDiffType with 5 values', () => {
      const m = src.match(/export type VersionDiffType\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports VersioningAction with 7 values', () => {
      const m = src.match(/export type VersioningAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
    it('exports AgentVersion interface', () => { expect(src).toContain('export interface AgentVersion'); });
    it('exports AgentSnapshot interface', () => { expect(src).toContain('export interface AgentSnapshot'); });
    it('exports AgentRollback interface', () => { expect(src).toContain('export interface AgentRollback'); });
    it('exports AgentDeploymentSlot interface', () => { expect(src).toContain('export interface AgentDeploymentSlot'); });
    it('exports AgentVersionDiff interface', () => { expect(src).toContain('export interface AgentVersionDiff'); });
    it('exports helper functions', () => {
      expect(src).toContain('export function formatVersionTag');
      expect(src).toContain('export function isRollbackTerminal');
      expect(src).toContain('export function canPromoteSlot');
      expect(src).toContain('export function calculateTrafficSplit');
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-versioning-rollback', () => {
      expect(idx).toContain("export * from './agent-versioning-rollback.js'");
    });
    it('has at least 88 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(88); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-versioning-rollback/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-versioning-rollback/); });
    it('defines 7 actions', () => {
      for (const a of ['version_create', 'snapshot_take', 'rollback_initiate', 'slot_assign', 'diff_generate', 'version_promote', 'rollback_cancel']) {
        expect(skill).toContain(a);
      }
    });
    it('is marked autonomous', () => { expect(skill).toMatch(/autonomous:\s*true/); });
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes version_vault', () => { expect(types).toContain("'version_vault'"); });
    it('has 46 building kinds', () => {
      const m = types.match(/export type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(46);
    });
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const ev of ['versioning.version_created', 'versioning.snapshot_taken', 'versioning.rollback_initiated', 'versioning.version_promoted']) {
      it(`includes ${ev}`, () => { expect(types).toContain(`'${ev}'`); });
    }
    it('has 200 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind\s*=[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(200);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps version_vault', () => { expect(types).toContain("case 'version_vault':"); });
    it('has 46 cases', () => {
      const fn = types.match(/export function districtFor[\s\S]*?^}/m);
      expect((fn![0].match(/case '/g) || []).length).toBe(46);
    });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    for (const s of ['sven.versioning.version_created', 'sven.versioning.snapshot_taken', 'sven.versioning.rollback_initiated', 'sven.versioning.version_promoted']) {
      it(`includes ${s}`, () => { expect(bus).toContain(`'${s}'`); });
    }
    it('has 199 entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(199);
    });
  });

  describe('Task executor switch cases', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    for (const c of ['version_create', 'snapshot_take', 'rollback_initiate', 'slot_assign', 'diff_generate', 'version_promote', 'rollback_cancel']) {
      it(`routes ${c}`, () => { expect(exec).toContain(`case '${c}'`); });
    }
    it('has 222 total switch cases', () => { expect((exec.match(/case '/g) || []).length).toBe(222); });
  });

  describe('Task executor handlers', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    for (const h of ['handleVersionCreate', 'handleSnapshotTake', 'handleRollbackInitiate', 'handleSlotAssign', 'handleDiffGenerate', 'handleVersionPromote', 'handleRollbackCancel']) {
      it(`has ${h}`, () => { expect(exec).toContain(h); });
    }
    it('has 218 total handlers', () => { expect((exec.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(218); });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('covers migration', () => { expect(ga).toContain('20260605120000_agent_versioning_rollback.sql'); });
    it('covers shared types', () => { expect(ga).toContain('agent-versioning-rollback.ts'); });
    it('covers skill', () => { expect(ga).toContain('agent-versioning-rollback/**'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 63', () => { expect(cl).toContain('Batch 63'); });
    it('mentions Agent Versioning & Rollback', () => { expect(cl).toContain('Agent Versioning & Rollback'); });
  });

  describe('Migration count', () => {
    it('has 49 migration files', () => {
      const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(49);
    });
  });
});
