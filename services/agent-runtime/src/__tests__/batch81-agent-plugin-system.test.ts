import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 81 — Agent Plugin System', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617180000_agent_plugin_system.sql'), 'utf-8');
    it('creates 5 tables', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_plugins');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS plugin_installations');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS plugin_hooks');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS plugin_events');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS plugin_reviews');
    });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
    it('agent_plugins has category CHECK', () => { expect(sql).toContain("category IN ('skill','integration','ui','analytics','security','storage','messaging','workflow')"); });
    it('agent_plugins has status CHECK', () => { expect(sql).toContain("status IN ('draft','published','deprecated','archived','banned')"); });
    it('plugin_installations has status CHECK', () => { expect(sql).toContain("status IN ('installed','active','disabled','errored','uninstalled')"); });
    it('plugin_hooks has hook_type CHECK', () => { expect(sql).toContain("hook_type IN ('before_task','after_task','on_message','on_error','on_startup','on_shutdown','on_schedule','on_event')"); });
    it('plugin_events has event_type CHECK', () => { expect(sql).toContain("event_type IN ('installed','activated','deactivated','updated','errored','uninstalled','hook_fired','config_changed')"); });
    it('plugin_reviews has rating CHECK', () => { expect(sql).toContain('rating BETWEEN 1 AND 5'); });
    it('has foreign keys', () => { expect((sql.match(/REFERENCES agent_plugins/g) || []).length).toBe(4); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-plugin-system.ts'), 'utf-8');
    it('exports PluginCategory with 8 values', () => { const m = src.match(/export type PluginCategory\s*=\s*([^;]+);/); expect(m).toBeTruthy(); expect((m![1].match(/'/g) || []).length / 2).toBe(8); });
    it('exports PluginStatus with 5 values', () => { const m = src.match(/export type PluginStatus\s*=\s*([^;]+);/); expect(m).toBeTruthy(); expect((m![1].match(/'/g) || []).length / 2).toBe(5); });
    it('exports PluginInstallStatus with 5 values', () => { const m = src.match(/export type PluginInstallStatus\s*=\s*([^;]+);/); expect(m).toBeTruthy(); expect((m![1].match(/'/g) || []).length / 2).toBe(5); });
    it('exports PluginHookType with 8 values', () => { const m = src.match(/export type PluginHookType\s*=\s*([^;]+);/); expect(m).toBeTruthy(); expect((m![1].match(/'/g) || []).length / 2).toBe(8); });
    it('exports PluginEventType with 8 values', () => { const m = src.match(/export type PluginEventType\s*=\s*([^;]+);/); expect(m).toBeTruthy(); expect((m![1].match(/'/g) || []).length / 2).toBe(8); });
    it('exports 5 interfaces', () => {
      expect(src).toContain('export interface AgentPlugin');
      expect(src).toContain('export interface PluginInstallation');
      expect(src).toContain('export interface PluginHook');
      expect(src).toContain('export interface PluginEvent');
      expect(src).toContain('export interface PluginReview');
    });
    it('exports isPluginCompatible helper', () => { expect(src).toContain('export function isPluginCompatible'); });
    it('exports pluginAvgRating helper', () => { expect(src).toContain('export function pluginAvgRating'); });
    it('exports activeHooksForType helper', () => { expect(src).toContain('export function activeHooksForType'); });
  });

  describe('isPluginCompatible', () => {
    it('returns true when all deps installed', () => {
      const { isPluginCompatible } = require('../../../../packages/shared/src/agent-plugin-system');
      expect(isPluginCompatible({ dependencies: ['a', 'b'] }, ['a', 'b', 'c'])).toBe(true);
    });
    it('returns false when dep missing', () => {
      const { isPluginCompatible } = require('../../../../packages/shared/src/agent-plugin-system');
      expect(isPluginCompatible({ dependencies: ['a', 'x'] }, ['a', 'b'])).toBe(false);
    });
  });

  describe('pluginAvgRating', () => {
    it('calculates average', () => {
      const { pluginAvgRating } = require('../../../../packages/shared/src/agent-plugin-system');
      expect(pluginAvgRating([{ rating: 4 }, { rating: 5 }, { rating: 3 }])).toBeCloseTo(4);
    });
    it('returns 0 for empty', () => {
      const { pluginAvgRating } = require('../../../../packages/shared/src/agent-plugin-system');
      expect(pluginAvgRating([])).toBe(0);
    });
  });

  describe('activeHooksForType', () => {
    it('filters and sorts by priority', () => {
      const { activeHooksForType } = require('../../../../packages/shared/src/agent-plugin-system');
      const hooks = [
        { hookType: 'before_task', enabled: true, priority: 1 },
        { hookType: 'before_task', enabled: false, priority: 5 },
        { hookType: 'after_task', enabled: true, priority: 3 },
        { hookType: 'before_task', enabled: true, priority: 10 },
      ];
      const result = activeHooksForType(hooks, 'before_task');
      expect(result.length).toBe(2);
      expect(result[0].priority).toBe(10);
    });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-plugin-system', () => { expect(idx).toContain("./agent-plugin-system"); });
    it('has at least 106 lines', () => { expect(idx.split('\n').length).toBeGreaterThanOrEqual(106); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-plugin-system/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-plugin-system/); });
    it('has architect archetype', () => { expect(skill).toMatch(/archetype:\s*architect/); });
    it('defines 7 actions', () => {
      expect(skill).toContain('plugin_register');
      expect(skill).toContain('plugin_install');
      expect(skill).toContain('plugin_configure');
      expect(skill).toContain('plugin_manage_hooks');
      expect(skill).toContain('plugin_publish');
      expect(skill).toContain('plugin_review');
      expect(skill).toContain('plugin_report');
    });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has plugin_forge building kind', () => { expect(types).toContain("'plugin_forge'"); });
    it('has 64 building kinds', () => { const bk = types.match(/export type EidolonBuildingKind[\s\S]*?;/); expect((bk![0].match(/\|/g) || []).length).toBe(64); });
    it('has 4 plugin event kinds', () => {
      expect(types).toContain("'plugin.registered'");
      expect(types).toContain("'plugin.installed'");
      expect(types).toContain("'plugin.hook_fired'");
      expect(types).toContain("'plugin.review_submitted'");
    });
    it('has 272 event kinds', () => { const ek = types.match(/export type EidolonEventKind[\s\S]*?;/); expect((ek![0].match(/\|/g) || []).length).toBe(272); });
    it('districtFor handles plugin_forge', () => { expect(types).toContain("case 'plugin_forge':"); });
  });

  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 plugin subjects', () => {
      expect(bus).toContain("'sven.plugin.registered'");
      expect(bus).toContain("'sven.plugin.installed'");
      expect(bus).toContain("'sven.plugin.hook_fired'");
      expect(bus).toContain("'sven.plugin.review_submitted'");
    });
    it('has 271 total entries', () => { const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s); expect((m![1].match(/^\s+'/gm) || []).length).toBe(271); });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 348 switch cases', () => { expect((te.match(/case '/g) || []).length).toBe(348); });
    it('has 344 handler methods', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(344); });
    it('has 7 plugin handlers', () => {
      expect(te).toContain('handlePluginRegister');
      expect(te).toContain('handlePluginInstall');
      expect(te).toContain('handlePluginConfigure');
      expect(te).toContain('handlePluginManageHooks');
      expect(te).toContain('handlePluginPublish');
      expect(te).toContain('handlePluginReview');
      expect(te).toContain('handlePluginReport');
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has plugin system entries', () => {
      expect(ga).toContain('20260617180000_agent_plugin_system.sql');
      expect(ga).toContain('agent-plugin-system.ts');
      expect(ga).toContain('agent-plugin-system/SKILL.md');
    });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('has Batch 81 entry', () => { expect(cl).toContain('Batch 81'); expect(cl).toContain('Agent Plugin System'); });
  });

  describe('Migration count', () => {
    it('has 67 migrations', () => {
      const migs = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
      expect(migs.length).toBe(67);
    });
  });
});
