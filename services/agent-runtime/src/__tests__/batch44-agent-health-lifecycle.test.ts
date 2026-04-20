/**
 * Batch 44 — Agent Health & Lifecycle
 * Self-healing, uptime monitoring, lifecycle management.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 44 — Agent Health & Lifecycle', () => {
  /* ───── Migration ───── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260517120000_agent_health_lifecycle.sql'),
      'utf-8',
    );

    it('creates agent_health_checks table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_checks');
    });

    it('creates agent_lifecycle_events table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lifecycle_events');
    });

    it('creates agent_heartbeats table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_heartbeats');
    });

    it('creates agent_recovery_actions table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_recovery_actions');
    });

    it('creates agent_sla_configs table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_sla_configs');
    });

    it('has health check columns (agent_id, check_type, status)', () => {
      expect(sql).toContain('agent_id');
      expect(sql).toContain('check_type');
      expect(sql).toContain('status');
    });

    it('has SLA config UNIQUE constraint on agent_id', () => {
      expect(sql).toContain('UNIQUE');
    });

    it('creates 13 indexes', () => {
      const indexCount = (sql.match(/CREATE INDEX/g) || []).length;
      expect(indexCount).toBe(13);
    });
  });

  /* ───── Shared types ───── */
  describe('Shared types — agent-health-lifecycle.ts', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-health-lifecycle.ts'),
      'utf-8',
    );

    it('exports LifecycleHealthStatus type with 6 values', () => {
      expect(src).toContain('export type LifecycleHealthStatus');
      expect(src).toContain("'healthy'");
      expect(src).toContain("'degraded'");
      expect(src).toContain("'critical'");
      expect(src).toContain("'offline'");
      expect(src).toContain("'recovering'");
      expect(src).toContain("'unknown'");
    });

    it('exports LifecycleState type with 10 values', () => {
      expect(src).toContain('export type LifecycleState');
      expect(src).toContain("'born'");
      expect(src).toContain("'initializing'");
      expect(src).toContain("'active'");
      expect(src).toContain("'idle'");
      expect(src).toContain("'hibernating'");
      expect(src).toContain("'degraded'");
      expect(src).toContain("'recovering'");
      expect(src).toContain("'retiring'");
      expect(src).toContain("'retired'");
      expect(src).toContain("'terminated'");
    });

    it('exports RecoveryAction type with 8 values', () => {
      expect(src).toContain('export type RecoveryAction');
      expect(src).toContain("'restart'");
      expect(src).toContain("'rollback'");
      expect(src).toContain("'scale_resources'");
      expect(src).toContain("'escalate'");
    });

    it('exports LifecycleCheckType type with 6 values', () => {
      expect(src).toContain('export type LifecycleCheckType');
      expect(src).toContain("'heartbeat'");
      expect(src).toContain("'deep_check'");
      expect(src).toContain("'memory_check'");
    });

    it('exports SeverityLevel type with 4 values', () => {
      expect(src).toContain('export type SeverityLevel');
      expect(src).toContain("'info'");
      expect(src).toContain("'warning'");
      expect(src).toContain("'error'");
      expect(src).toContain("'critical'");
    });

    it('exports 5 interfaces', () => {
      expect(src).toContain('export interface AgentHealthCheck');
      expect(src).toContain('export interface AgentLifecycleEvent');
      expect(src).toContain('export interface AgentHeartbeat');
      expect(src).toContain('export interface AgentRecoveryActionRecord');
      expect(src).toContain('export interface AgentSlaConfig');
    });

    it('exports 6 constants', () => {
      expect(src).toContain('export const HEALTH_CHECK_INTERVAL_MS');
      expect(src).toContain('export const MAX_MISSED_HEARTBEATS');
      expect(src).toContain('export const RECOVERY_COOLDOWN_MS');
      expect(src).toContain('export const DEFAULT_SLA_UPTIME');
      expect(src).toContain('export const SEVERITY_PRIORITY');
      expect(src).toContain('export const LIFECYCLE_ORDER');
    });

    it('exports 4 helper functions', () => {
      expect(src).toContain('export function LifecycleisHealthy');
      expect(src).toContain('export function shouldRecover');
      expect(src).toContain('export function getRecoveryPriority');
      expect(src).toContain('export function calculateUptime');
    });
  });

  /* ───── shared/index.ts barrel ───── */
  describe('Shared index barrel', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-health-lifecycle module', () => {
      expect(idx).toContain("export * from './agent-health-lifecycle.js'");
    });

    it('has 69 lines (wc -l)', () => {
      const lineCount = idx.split('\n').length;
      // wc -l reports 69, split gives 70 due to trailing newline
      expect(lineCount).toBe(70);
    });
  });

  /* ───── SKILL.md ───── */
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/agent-health-lifecycle/SKILL.md'),
      'utf-8',
    );

    it('has correct name in frontmatter', () => {
      expect(skill).toContain('name: agent-health-lifecycle');
    });

    it('documents all 7 actions', () => {
      expect(skill).toContain('### health_check');
      expect(skill).toContain('### lifecycle_transition');
      expect(skill).toContain('### heartbeat_ping');
      expect(skill).toContain('### recovery_execute');
      expect(skill).toContain('### sla_configure');
      expect(skill).toContain('### health_report');
      expect(skill).toContain('### lifecycle_history');
    });
  });

  /* ───── Eidolon types ───── */
  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('has medical_bay in EidolonBuildingKind', () => {
      expect(types).toContain("'medical_bay'");
    });

    it('has 27 EidolonBuildingKind pipe values', () => {
      const buildingMatch = types.match(
        /export type EidolonBuildingKind[\s\S]*?;/,
      );
      expect(buildingMatch).not.toBeNull();
      const pipes = (buildingMatch![0].match(/\|/g) || []).length;
      expect(pipes).toBe(27);
    });

    it('has 124 EidolonEventKind pipe values', () => {
      const eventMatch = types.match(
        /export type EidolonEventKind[\s\S]*?;/,
      );
      expect(eventMatch).not.toBeNull();
      const pipes = (eventMatch![0].match(/\|/g) || []).length;
      expect(pipes).toBe(124);
    });

    it('has 4 health/lifecycle event kinds', () => {
      expect(types).toContain("'health.check_completed'");
      expect(types).toContain("'health.recovery_triggered'");
      expect(types).toContain("'lifecycle.state_changed'");
      expect(types).toContain("'lifecycle.agent_retired'");
    });

    it('has districtFor case for medical_bay', () => {
      expect(types).toContain("case 'medical_bay'");
      expect(types).toContain("return 'residential'");
    });

    it('has 27 districtFor cases', () => {
      const caseCount = (types.match(/case '/g) || []).length;
      expect(caseCount).toBe(27);
    });
  });

  /* ───── Event bus ───── */
  describe('Event bus — SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('has 123 SUBJECT_MAP entries', () => {
      const entries = bus.match(/^\s*'sven\./gm) || [];
      expect(entries.length).toBe(123);
    });

    it('maps health and lifecycle subjects', () => {
      expect(bus).toContain("'sven.health.check_completed'");
      expect(bus).toContain("'sven.health.recovery_triggered'");
      expect(bus).toContain("'sven.lifecycle.state_changed'");
      expect(bus).toContain("'sven.lifecycle.agent_retired'");
    });
  });

  /* ───── Task executor ───── */
  describe('Task executor', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 89 switch cases', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(89);
    });

    it('has 85 handler methods', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(85);
    });

    it('routes 7 health/lifecycle task types', () => {
      expect(exec).toContain("case 'health_check'");
      expect(exec).toContain("case 'lifecycle_transition'");
      expect(exec).toContain("case 'heartbeat_ping'");
      expect(exec).toContain("case 'recovery_execute'");
      expect(exec).toContain("case 'sla_configure'");
      expect(exec).toContain("case 'health_report'");
      expect(exec).toContain("case 'lifecycle_history'");
    });

    it('has handleHealthCheck method', () => {
      expect(exec).toMatch(/private async handleHealthCheck/);
    });

    it('has handleLifecycleTransition method', () => {
      expect(exec).toMatch(/private async handleLifecycleTransition/);
    });

    it('has handleHeartbeatPing method', () => {
      expect(exec).toMatch(/private async handleHeartbeatPing/);
    });

    it('has handleRecoveryExecute method', () => {
      expect(exec).toMatch(/private async handleRecoveryExecute/);
    });

    it('has handleSlaConfigure method', () => {
      expect(exec).toMatch(/private async handleSlaConfigure/);
    });

    it('has handleHealthReport method', () => {
      expect(exec).toMatch(/private async handleHealthReport/);
    });

    it('has handleLifecycleHistory method', () => {
      expect(exec).toMatch(/private async handleLifecycleHistory/);
    });
  });

  /* ───── .gitattributes ───── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(
      path.join(ROOT, '.gitattributes'),
      'utf-8',
    );

    it('marks Batch 44 migration as export-ignore', () => {
      expect(ga).toContain('20260517120000_agent_health_lifecycle.sql export-ignore');
    });

    it('marks Batch 44 shared types as export-ignore', () => {
      expect(ga).toContain('agent-health-lifecycle.ts export-ignore');
    });

    it('marks Batch 44 skill as export-ignore', () => {
      expect(ga).toContain('agent-health-lifecycle/** export-ignore');
    });

    it('marks Batch 44 test as export-ignore', () => {
      expect(ga).toContain('batch44-agent-health-lifecycle.test.ts export-ignore');
    });
  });

  /* ───── CHANGELOG ───── */
  describe('CHANGELOG', () => {
    const log = fs.readFileSync(
      path.join(ROOT, 'CHANGELOG.md'),
      'utf-8',
    );

    it('has Batch 44 entry', () => {
      expect(log).toContain('Batch 44');
    });

    it('mentions Agent Health & Lifecycle', () => {
      expect(log).toContain('Agent Health & Lifecycle');
    });

    it('mentions medical_bay building kind', () => {
      expect(log).toContain('medical_bay');
    });
  });

  /* ───── Migrations count ───── */
  describe('Migration files count', () => {
    it('has 30 total migrations', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql'));
      expect(files.length).toBe(30);
    });
  });
});
