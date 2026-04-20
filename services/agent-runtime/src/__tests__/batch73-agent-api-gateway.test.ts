import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 73 — Agent API Gateway & Routing', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260615120000_agent_api_gateway.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['api_routes','gateway_policies','request_transforms','load_balancer_pools','traffic_logs']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('creates at least 19 indexes', () => { expect((sql.match(/CREATE (?:UNIQUE )?INDEX/g) || []).length).toBeGreaterThanOrEqual(19); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-api-gateway.ts'), 'utf-8');
    it('exports 5 type unions', () => { expect((src.match(/export type \w+/g) || []).length).toBe(5); });
    it('exports 5 interfaces', () => { expect((src.match(/export interface \w+/g) || []).length).toBe(5); });
    it('ApiGatewayAction has 7 values', () => {
      const m = src.match(/export type ApiGatewayAction\s*=\s*([^;]+);/);
      expect((m![1].match(/'/g) || []).length / 2).toBe(7);
    });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-api-gateway/SKILL.md'), 'utf-8');
    it('has correct skill', () => { expect(md).toMatch(/skill:\s*agent-api-gateway/); });
    it('defines 7 actions', () => { expect((md.match(/^### \w+/gm) || []).length).toBe(7); });
  });

  describe('Eidolon + Event bus', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('BK=56', () => { const m = types.match(/export type EidolonBuildingKind\s*=([\s\S]*?);/); expect((m![1].match(/\|/g) || []).length).toBe(56); });
    it('EK=240', () => { const m = types.match(/export type EidolonEventKind\s*=([\s\S]*?);/); expect((m![1].match(/\|/g) || []).length).toBe(240); });
    it('DF=56', () => { const d = types.split('districtFor')[1].split('function ')[0]; expect((d.match(/case '\w+':/g) || []).length).toBe(56); });
    it('SM=239', () => { const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s); expect((m![1].match(/^\s+'/gm) || []).length).toBe(239); });
  });

  describe('Task executor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('SC=292', () => { expect((src.match(/case '\w+':/g) || []).length).toBe(292); });
    it('HM=288', () => { expect((src.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(288); });
  });

  describe('Infra', () => {
    it('.gitattributes', () => { const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8'); expect(ga).toContain('agent_api_gateway.sql'); });
    it('CHANGELOG', () => { expect(fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8')).toContain('Batch 73'); });
    it('59 migrations', () => { expect(fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql')).length).toBe(59); });
  });
});
