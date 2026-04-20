import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 74 — Agent Log Aggregation & Search', () => {

  /* ── Migration ── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260616120000_agent_log_aggregation.sql'), 'utf-8');
    it('creates 5 tables', () => {
      for (const t of ['log_streams','log_entries','log_filters','log_dashboards','log_alerts']) {
        expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
      }
    });
    it('has at least 20 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/g) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(20);
    });
    it('log_entries references log_streams', () => {
      expect(sql).toContain('REFERENCES log_streams(id)');
    });
    it('enforces level CHECK', () => {
      expect(sql).toContain("level IN ('trace','debug','info','warn','error','fatal')");
    });
    it('enforces severity CHECK', () => {
      expect(sql).toContain("severity IN ('low','medium','high','critical')");
    });
  });

  /* ── Shared Types ── */
  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-log-aggregation.ts'), 'utf-8');
    it('exports 5 type unions', () => {
      const types = (src.match(/export type \w+/g) || []);
      expect(types.length).toBe(5);
    });
    it('exports 5 interfaces', () => {
      const ifaces = (src.match(/export interface \w+/g) || []);
      expect(ifaces.length).toBe(5);
    });
    it('exports LOG_LEVEL_ORDER', () => {
      expect(src).toContain('export const LOG_LEVEL_ORDER');
    });
    it('exports isAtLeastLevel helper', () => {
      expect(src).toContain('export function isAtLeastLevel');
    });
    it('exports formatLogLine helper', () => {
      expect(src).toContain('export function formatLogLine');
    });
    it('exports parseLogQuery helper', () => {
      expect(src).toContain('export function parseLogQuery');
    });
  });

  /* ── Barrel export ── */
  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('re-exports agent-log-aggregation', () => {
      expect(idx).toContain("from './agent-log-aggregation.js'");
    });
    it('has at least 99 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(99);
    });
  });

  /* ── SKILL.md ── */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-log-aggregation/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-log-aggregation/);
    });
    it('has 7 actions', () => {
      const actions = (skill.match(/^### /gm) || []);
      expect(actions.length).toBe(7);
    });
    it('is analyst archetype', () => {
      expect(skill).toContain('archetype: analyst');
    });
  });

  /* ── Eidolon ── */
  describe('Eidolon wiring', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has log_archive building kind', () => {
      expect(types).toContain("'log_archive'");
    });
    it('has 57 building kinds', () => {
      const bk = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      const pipes = (bk![0].match(/\|/g) || []).length;
      expect(pipes).toBe(57);
    });
    it('has 4 log event kinds', () => {
      for (const e of ['log.stream_created','log.entry_ingested','log.alert_triggered','log.dashboard_updated']) {
        expect(types).toContain(`'${e}'`);
      }
    });
    it('has 244 event kind pipes', () => {
      const ek = types.match(/export type EidolonEventKind[\s\S]*?;/);
      const pipes = (ek![0].match(/\|/g) || []).length;
      expect(pipes).toBe(244);
    });
    it('districtFor maps log_archive', () => {
      expect(types).toContain("case 'log_archive':");
    });
    it('has 57 districtFor cases', () => {
      const df = types.match(/function districtFor[\s\S]*?^\}/m);
      const cases = (df![0].match(/case /g) || []).length;
      expect(cases).toBe(57);
    });
  });

  /* ── Event bus ── */
  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 sven.log.* subjects', () => {
      for (const s of ['sven.log.stream_created','sven.log.entry_ingested','sven.log.alert_triggered','sven.log.dashboard_updated']) {
        expect(bus).toContain(`'${s}'`);
      }
    });
    it('has 243 SUBJECT_MAP entries', () => {
      const sm = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      const entries = (sm![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(243);
    });
  });

  /* ── Task executor ── */
  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 log switch cases', () => {
      for (const c of ['log_stream_create','log_search','log_filter_apply','log_dashboard_build','log_alert_configure','log_export','log_report']) {
        expect(te).toContain(`case '${c}'`);
      }
    });
    it('has 299 total switch cases', () => {
      const cases = (te.match(/case '/g) || []).length;
      expect(cases).toBe(299);
    });
    it('has 7 log handler methods', () => {
      for (const h of ['handleLogStreamCreate','handleLogSearch','handleLogFilterApply','handleLogDashboardBuild','handleLogAlertConfigure','handleLogExport','handleLogReport']) {
        expect(te).toMatch(new RegExp(`private (?:async )?${h}`));
      }
    });
    it('has 295 total handler methods', () => {
      const hm = (te.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(hm).toBe(295);
    });
  });

  /* ── Privacy ── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks log aggregation files as private', () => {
      expect(ga).toContain('agent_log_aggregation.sql');
      expect(ga).toContain('agent-log-aggregation.ts');
      expect(ga).toContain('agent-log-aggregation/SKILL.md');
    });
  });
});
