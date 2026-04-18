/**
 * Batch 45 — Agent Task Queue & Scheduling
 * Tests: migration SQL, shared types, skill, Eidolon wiring, event-bus, task-executor
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 45 — Agent Task Queue & Scheduling', () => {
  /* ── Migration SQL ───────────────────────────────────────────────── */
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260518120000_agent_task_queue.sql'),
      'utf-8',
    );

    it('creates task_queue_items table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_queue_items');
    });

    it('creates task_schedules table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_schedules');
    });

    it('creates task_assignments table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_assignments');
    });

    it('creates task_dependencies table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_dependencies');
    });

    it('creates task_execution_logs table', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_execution_logs');
    });

    it('has at least 15 indexes', () => {
      const idxCount = (sql.match(/CREATE INDEX/gi) || []).length;
      expect(idxCount).toBeGreaterThanOrEqual(15);
    });

    it('references priority column', () => {
      expect(sql).toContain('priority');
    });

    it('references deadline column', () => {
      expect(sql).toContain('deadline');
    });
  });

  /* ── Shared Types ────────────────────────────────────────────────── */
  describe('Shared types (agent-task-queue.ts)', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-task-queue.ts'),
      'utf-8',
    );

    it('exports QueueItemStatus with 8 values', () => {
      expect(src).toContain('export type QueueItemStatus');
      const block = src.split('export type QueueItemStatus')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(8);
    });

    it('QueueItemStatus includes all expected values', () => {
      for (const v of ['queued', 'assigned', 'in_progress', 'completed', 'failed', 'cancelled', 'deferred', 'expired']) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports ScheduleFrequency with 7 values', () => {
      expect(src).toContain('export type ScheduleFrequency');
      const block = src.split('export type ScheduleFrequency')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(7);
    });

    it('ScheduleFrequency includes all expected values', () => {
      for (const v of ['once', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'custom_cron']) {
        expect(src).toContain(`'${v}'`);
      }
    });

    it('exports DependencyType with 3 values', () => {
      expect(src).toContain('export type DependencyType');
      const block = src.split('export type DependencyType')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(3);
    });

    it('exports AssignmentStrategy with 6 values', () => {
      expect(src).toContain('export type AssignmentStrategy');
      const block = src.split('export type AssignmentStrategy')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(6);
    });

    it('exports ExecutionLogEvent with 12 values', () => {
      expect(src).toContain('export type ExecutionLogEvent');
      const block = src.split('export type ExecutionLogEvent')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(12);
    });

    it('exports 5 interfaces', () => {
      const ifaces = (src.match(/export interface /g) || []).length;
      expect(ifaces).toBe(5);
    });

    it('exports TaskQueueItem interface', () => {
      expect(src).toContain('export interface TaskQueueItem');
    });

    it('exports TaskSchedule interface', () => {
      expect(src).toContain('export interface TaskSchedule');
    });

    it('exports TaskAssignment interface', () => {
      expect(src).toContain('export interface TaskAssignment');
    });

    it('exports TaskDependency interface', () => {
      expect(src).toContain('export interface TaskDependency');
    });

    it('exports TaskExecutionLog interface', () => {
      expect(src).toContain('export interface TaskExecutionLog');
    });

    it('exports 6 constants', () => {
      for (const c of ['DEFAULT_PRIORITY', 'MAX_PRIORITY', 'MIN_PRIORITY', 'DEFAULT_MAX_RETRIES', 'QUEUE_POLL_INTERVAL_MS', 'ASSIGNMENT_TIMEOUT_MS']) {
        expect(src).toContain(c);
      }
    });

    it('exports PRIORITY_LABELS map', () => {
      expect(src).toContain('PRIORITY_LABELS');
    });

    it('exports STATUS_ORDER array', () => {
      expect(src).toContain('STATUS_ORDER');
    });

    it('exports canRetry helper', () => {
      expect(src).toContain('export function canRetry');
    });

    it('exports isTerminal helper', () => {
      expect(src).toContain('export function isTerminal');
    });

    it('exports calculateAssignmentScore helper', () => {
      expect(src).toContain('export function calculateAssignmentScore');
    });

    it('exports isPastDeadline helper', () => {
      expect(src).toContain('export function isPastDeadline');
    });
  });

  /* ── Shared index.ts barrel ──────────────────────────────────────── */
  describe('Shared index.ts', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-task-queue', () => {
      expect(idx).toContain("export * from './agent-task-queue.js'");
    });

    it('has 71 lines (split)', () => {
      expect(idx.split('\n').length).toBe(71);
    });
  });

  /* ── SKILL.md ────────────────────────────────────────────────────── */
  describe('SKILL.md (task-queue)', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/task-queue/SKILL.md'),
      'utf-8',
    );

    it('has YAML frontmatter with name', () => {
      expect(skill).toContain('name: task-queue');
    });

    it('defines 7 actions', () => {
      for (const a of ['queue_submit', 'queue_poll', 'queue_assign', 'schedule_create', 'schedule_toggle', 'dependency_add', 'execution_history']) {
        expect(skill).toContain(a);
      }
    });

    it('documents assignment strategies', () => {
      for (const s of ['best_fit', 'round_robin', 'least_loaded', 'reputation_weighted', 'random', 'manual']) {
        expect(skill).toContain(s);
      }
    });

    it('documents dependency types', () => {
      for (const d of ['blocks', 'suggests', 'triggers']) {
        expect(skill).toContain(d);
      }
    });
  });

  /* ── Eidolon types.ts ────────────────────────────────────────────── */
  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('EidolonBuildingKind includes dispatch_center', () => {
      expect(types).toContain("'dispatch_center'");
    });

    it('EidolonBuildingKind has 29 pipe values', () => {
      const block = types.split('export type EidolonBuildingKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(28);
    });

    it('EidolonEventKind includes task.queued', () => {
      expect(types).toContain("'task.queued'");
    });

    it('EidolonEventKind includes task.assigned', () => {
      expect(types).toContain("'task.assigned'");
    });

    it('EidolonEventKind includes task.completed', () => {
      expect(types).toContain("'task.completed'");
    });

    it('EidolonEventKind includes task.schedule_triggered', () => {
      expect(types).toContain("'task.schedule_triggered'");
    });

    it('EidolonEventKind has 128 pipe values', () => {
      const block = types.split('export type EidolonEventKind')[1].split(';')[0];
      const pipes = (block.match(/\|/g) || []).length;
      expect(pipes).toBe(128);
    });

    it('districtFor maps dispatch_center to industrial', () => {
      expect(types).toContain("case 'dispatch_center'");
      expect(types).toContain("return 'industrial'");
    });

    it('districtFor has 28 cases', () => {
      const fn = types.split('export function districtFor')[1] || '';
      const cases = (fn.match(/case '/g) || []).length;
      expect(cases).toBe(28);
    });
  });

  /* ── Event bus ───────────────────────────────────────────────────── */
  describe('Event bus (SUBJECT_MAP)', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('maps sven.task.queued', () => {
      expect(bus).toContain("'sven.task.queued': 'task.queued'");
    });

    it('maps sven.task.assigned', () => {
      expect(bus).toContain("'sven.task.assigned': 'task.assigned'");
    });

    it('maps sven.task.completed', () => {
      expect(bus).toContain("'sven.task.completed': 'task.completed'");
    });

    it('maps sven.task.schedule_triggered', () => {
      expect(bus).toContain("'sven.task.schedule_triggered': 'task.schedule_triggered'");
    });

    it('has 127 SUBJECT_MAP entries', () => {
      const entries = (bus.match(/'sven\./g) || []).length;
      expect(entries).toBe(127);
    });
  });

  /* ── Task executor ───────────────────────────────────────────────── */
  describe('Task executor', () => {
    const exec = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('has 96 switch cases', () => {
      const cases = (exec.match(/case '/g) || []).length;
      expect(cases).toBe(96);
    });

    it('has 92 handler methods', () => {
      const handlers = (exec.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(92);
    });

    it('routes queue_submit', () => {
      expect(exec).toContain("case 'queue_submit'");
    });

    it('routes queue_poll', () => {
      expect(exec).toContain("case 'queue_poll'");
    });

    it('routes queue_assign', () => {
      expect(exec).toContain("case 'queue_assign'");
    });

    it('routes schedule_create', () => {
      expect(exec).toContain("case 'schedule_create'");
    });

    it('routes schedule_toggle', () => {
      expect(exec).toContain("case 'schedule_toggle'");
    });

    it('routes dependency_add', () => {
      expect(exec).toContain("case 'dependency_add'");
    });

    it('routes execution_history_query', () => {
      expect(exec).toContain("case 'execution_history_query'");
    });

    it('has handleQueueSubmit method', () => {
      expect(exec).toMatch(/private (?:async )?handleQueueSubmit/);
    });

    it('has handleQueuePoll method', () => {
      expect(exec).toMatch(/private (?:async )?handleQueuePoll/);
    });

    it('has handleQueueAssign method', () => {
      expect(exec).toMatch(/private (?:async )?handleQueueAssign/);
    });

    it('has handleScheduleCreate method', () => {
      expect(exec).toMatch(/private (?:async )?handleScheduleCreate/);
    });

    it('has handleScheduleToggle method', () => {
      expect(exec).toMatch(/private (?:async )?handleScheduleToggle/);
    });

    it('has handleDependencyAdd method', () => {
      expect(exec).toMatch(/private (?:async )?handleDependencyAdd/);
    });

    it('has handleExecutionHistoryQuery method', () => {
      expect(exec).toMatch(/private (?:async )?handleExecutionHistoryQuery/);
    });
  });

  /* ── .gitattributes ──────────────────────────────────────────────── */
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('marks migration as export-ignore', () => {
      expect(ga).toContain('20260518120000_agent_task_queue.sql export-ignore');
    });

    it('marks shared types as export-ignore', () => {
      expect(ga).toContain('agent-task-queue.ts export-ignore');
    });

    it('marks skill dir as export-ignore', () => {
      expect(ga).toContain('skills/autonomous-economy/task-queue/**');
    });

    it('marks test as export-ignore', () => {
      expect(ga).toContain('batch45-agent-task-queue.test.ts export-ignore');
    });
  });

  /* ── CHANGELOG ───────────────────────────────────────────────────── */
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');

    it('has Batch 45 entry', () => {
      expect(cl).toContain('Batch 45');
    });

    it('mentions Agent Task Queue & Scheduling', () => {
      expect(cl).toContain('Agent Task Queue & Scheduling');
    });

    it('mentions dispatch_center building kind', () => {
      expect(cl).toContain('dispatch_center');
    });
  });

  /* ── Migration count ─────────────────────────────────────────────── */
  describe('Migration file count', () => {
    it('has 31 total migration files', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter(f => f.endsWith('.sql'));
      expect(files.length).toBe(31);
    });
  });

  /* ── Skill directory count ───────────────────────────────────────── */
  describe('Skill directory count', () => {
    it('has 38 autonomous-economy skill directories', () => {
      const skillDir = path.join(ROOT, 'skills/autonomous-economy');
      const dirs = fs.readdirSync(skillDir).filter(d =>
        fs.statSync(path.join(skillDir, d)).isDirectory()
      );
      expect(dirs.length).toBe(38);
    });
  });
});
