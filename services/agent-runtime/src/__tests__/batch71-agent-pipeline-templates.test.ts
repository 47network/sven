import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 71 — Agent Pipeline Templates', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260613120000_agent_pipeline_templates.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['pipeline_templates','pipeline_instances','pipeline_stages','pipeline_triggers','pipeline_artifacts']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-pipeline-templates.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('PipelineAction has 7 values', () => {
      const m = src.match(/export type PipelineAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-pipeline-templates/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-pipeline-templates/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
  });

  describe('Eidolon types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('EidolonBuildingKind has 54 values', () => {
      const m = src.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(54);
    });
    it('includes pipeline_forge building kind', () => { expect(src).toContain("'pipeline_forge'"); });
    it('EidolonEventKind has 232 values', () => {
      const m = src.match(/export type EidolonEventKind\s*=([\s\S]*?);/);
      expect((m![1].match(/\|/g) || []).length).toBe(232);
    });
    it('districtFor has 54 cases', () => {
      const dfBlock = src.split('districtFor')[1].split('function ')[0];
      expect((dfBlock.match(/case '\w+':/g) || []).length).toBe(54);
    });
  });

  describe('Event bus', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('SUBJECT_MAP has 231 entries', () => {
      const m = src.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(231);
    });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 278 switch cases', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(278); });
    it('has 274 handler methods', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(274); });
    it('includes 7 batch 71 handlers', () => {
      for (const h of ['handleTemplateCreate','handleInstanceLaunch','handleStageAdvance','handlePipelinePause','handleTriggerConfigure','handleArtifactStore','handlePipelineReport']) {
        expect(src).toContain(h);
      }
    });
  });

  describe('.gitattributes + CHANGELOG', () => {
    it('marks batch 71 files private', () => {
      const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
      expect(ga).toContain('agent_pipeline_templates.sql');
      expect(ga).toContain('agent-pipeline-templates.ts');
    });
    it('CHANGELOG mentions Batch 71', () => {
      expect(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8')).toContain('Batch 71');
    });
  });

  describe('Migration count', () => {
    it('has 57 migration files', () => {
      expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(57);
    });
  });
});
