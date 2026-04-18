import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 79 — Agent Queue Management', () => {
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617160000_agent_queue_management.sql'), 'utf-8');
    it('creates task_queues table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS task_queues'); });
    it('creates queue_messages table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS queue_messages'); });
    it('creates queue_consumers table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS queue_consumers'); });
    it('creates queue_schedules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS queue_schedules'); });
    it('creates queue_metrics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS queue_metrics'); });
    it('has at least 20 indexes', () => { expect((sql.match(/CREATE INDEX/gi) || []).length).toBeGreaterThanOrEqual(20); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-queue-management.ts'), 'utf-8');
    it('exports QueueType', () => { expect(src).toContain('export type QueueType'); });
    it('exports QueueStatus', () => { expect(src).toContain('export type QueueStatus'); });
    it('exports QueueMessageStatus', () => { expect(src).toContain('export type QueueMessageStatus'); });
    it('exports QueueConsumerStatus', () => { expect(src).toContain('export type QueueConsumerStatus'); });
    it('exports QueueScheduleStatus', () => { expect(src).toContain('export type QueueScheduleStatus'); });
    it('exports TaskQueue interface', () => { expect(src).toContain('export interface TaskQueue'); });
    it('exports QueueMessage interface', () => { expect(src).toContain('export interface QueueMessage'); });
    it('exports QueueConsumer interface', () => { expect(src).toContain('export interface QueueConsumer'); });
    it('exports QueueSchedule interface', () => { expect(src).toContain('export interface QueueSchedule'); });
    it('exports QueueMetrics interface', () => { expect(src).toContain('export interface QueueMetrics'); });
    it('exports isQueueFull helper', () => { expect(src).toContain('export function isQueueFull'); });
    it('exports shouldRetry helper', () => { expect(src).toContain('export function shouldRetry'); });
    it('exports queueThroughput helper', () => { expect(src).toContain('export function queueThroughput'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-queue-management module', () => { expect(idx).toContain("export * from './agent-queue-management.js'"); });
  });

  describe('SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-queue-management/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(md).toMatch(/skill:\s*agent-queue-management/); });
    it('has architect archetype', () => { expect(md).toMatch(/archetype:\s*architect/); });
    it('has 7 actions', () => { expect((md.match(/^### /gm) || []).length).toBe(7); });
  });

  describe('Eidolon Building Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes queue_exchange building kind', () => { expect(types).toContain("'queue_exchange'"); });
    it('has 62 building kind values', () => {
      const m = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(62);
    });
  });

  describe('Eidolon Event Kind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('includes queue event kinds', () => {
      expect(types).toContain("'queue.created'");
      expect(types).toContain("'queue.message_enqueued'");
      expect(types).toContain("'queue.message_completed'");
      expect(types).toContain("'queue.consumer_registered'");
    });
    it('has 264 event kind pipe values', () => {
      const m = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect((m![0].match(/\|/g) || []).length).toBe(264);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('maps queue_exchange to civic', () => { expect(types).toContain("case 'queue_exchange':"); });
    it('has 62 cases', () => {
      const m = types.match(/export function districtFor[\s\S]*?^}/m);
      expect((m![0].match(/case '/g) || []).length).toBe(62);
    });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 queue subject entries', () => {
      expect(bus).toContain("'sven.queue.created'");
      expect(bus).toContain("'sven.queue.message_enqueued'");
      expect(bus).toContain("'sven.queue.message_completed'");
      expect(bus).toContain("'sven.queue.consumer_registered'");
    });
    it('has 263 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(263);
    });
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 queue switch cases', () => {
      expect(te).toContain("case 'queue_create':");
      expect(te).toContain("case 'queue_enqueue':");
      expect(te).toContain("case 'queue_dequeue':");
      expect(te).toContain("case 'queue_complete':");
      expect(te).toContain("case 'queue_register_consumer':");
      expect(te).toContain("case 'queue_schedule':");
      expect(te).toContain("case 'queue_report':");
    });
    it('has 334 total switch cases', () => { expect((te.match(/case '/g) || []).length).toBe(334); });
  });

  describe('Task executor handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 7 queue handler methods', () => {
      expect(te).toMatch(/private (?:async )?handleQueueCreate/);
      expect(te).toMatch(/private (?:async )?handleQueueEnqueue/);
      expect(te).toMatch(/private (?:async )?handleQueueDequeue/);
      expect(te).toMatch(/private (?:async )?handleQueueComplete/);
      expect(te).toMatch(/private (?:async )?handleQueueRegisterConsumer/);
      expect(te).toMatch(/private (?:async )?handleQueueSchedule/);
      expect(te).toMatch(/private (?:async )?handleQueueReport/);
    });
    it('has 330 total handler methods', () => {
      expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(330);
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('marks queue migration as private', () => { expect(ga).toContain('20260617160000_agent_queue_management.sql'); });
    it('marks queue shared types as private', () => { expect(ga).toContain('agent-queue-management.ts'); });
    it('marks queue skill as private', () => { expect(ga).toContain('agent-queue-management/SKILL.md'); });
  });

  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('mentions Batch 79', () => { expect(cl).toContain('Batch 79'); });
    it('mentions Agent Queue Management', () => { expect(cl).toContain('Agent Queue Management'); });
  });

  describe('Migrations', () => {
    const files = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 65 migration files', () => { expect(files.length).toBe(65); });
  });
});
