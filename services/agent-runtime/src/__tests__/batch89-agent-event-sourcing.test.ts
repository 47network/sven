import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 89 — Agent Event Sourcing', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617260000_agent_event_sourcing.sql'), 'utf-8');

    it('creates event_store table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_store'); });
    it('creates event_aggregates table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_aggregates'); });
    it('creates event_projections table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_projections'); });
    it('creates event_snapshots table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_snapshots'); });
    it('creates event_replay_logs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_replay_logs'); });
    it('has UNIQUE constraint on aggregate_id+sequence', () => { expect(sql).toContain('UNIQUE(aggregate_id, sequence_number)'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
    it('has foreign key references', () => { expect((sql.match(/REFERENCES/g) || []).length).toBeGreaterThanOrEqual(2); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-event-sourcing.ts'), 'utf-8');

    it('exports AggregateStatus', () => { expect(src).toContain("export type AggregateStatus"); });
    it('exports ProjectionType', () => { expect(src).toContain("export type ProjectionType"); });
    it('exports ProjectionStatus', () => { expect(src).toContain("export type ProjectionStatus"); });
    it('exports ReplayType', () => { expect(src).toContain("export type ReplayType"); });
    it('exports ReplayStatus', () => { expect(src).toContain("export type ReplayStatus"); });
    it('exports EventStoreEntry interface', () => { expect(src).toContain('export interface EventStoreEntry'); });
    it('exports EventAggregate interface', () => { expect(src).toContain('export interface EventAggregate'); });
    it('exports EventProjection interface', () => { expect(src).toContain('export interface EventProjection'); });
    it('exports EventSnapshot interface', () => { expect(src).toContain('export interface EventSnapshot'); });
    it('exports EventReplayLog interface', () => { expect(src).toContain('export interface EventReplayLog'); });
    it('exports isAggregateActive helper', () => { expect(src).toContain('export function isAggregateActive'); });
    it('exports projectionLag helper', () => { expect(src).toContain('export function projectionLag'); });
    it('exports snapshotSizeMB helper', () => { expect(src).toContain('export function snapshotSizeMB'); });
  });

  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-event-sourcing', () => { expect(idx).toContain("export * from './agent-event-sourcing.js'"); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-event-sourcing/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-event-sourcing/); });
    it('has 7 actions', () => { expect((skill.match(/  - es_/g) || []).length).toBe(7); });
    it('has architect archetype', () => { expect(skill).toContain('archetype: architect'); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has event_ledger building kind', () => { expect(types).toContain("'event_ledger'"); });
    it('has 72 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(72);
    });
    it('has 4 eventsource event kinds', () => {
      expect(types).toContain("'eventsource.event_appended'");
      expect(types).toContain("'eventsource.projection_created'");
      expect(types).toContain("'eventsource.snapshot_taken'");
      expect(types).toContain("'eventsource.replay_completed'");
    });
    it('has 304 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect(block).toBeTruthy();
      expect((block[0].match(/\|/g) || []).length).toBe(304);
    });
    it('districtFor handles event_ledger', () => { expect(types).toContain("case 'event_ledger':"); });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 eventsource subjects', () => {
      expect(bus).toContain("'sven.eventsource.event_appended': 'eventsource.event_appended'");
      expect(bus).toContain("'sven.eventsource.projection_created': 'eventsource.projection_created'");
      expect(bus).toContain("'sven.eventsource.snapshot_taken': 'eventsource.snapshot_taken'");
      expect(bus).toContain("'sven.eventsource.replay_completed': 'eventsource.replay_completed'");
    });
    it('has 303 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(303);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['es_append_event','es_read_stream','es_create_projection','es_take_snapshot','es_replay_projection','es_aggregate_status','es_report'];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
    }
    const handlers = ['handleEsAppendEvent','handleEsReadStream','handleEsCreateProjection','handleEsTakeSnapshot','handleEsReplayProjection','handleEsAggregateStatus','handleEsReport'];
    for (const h of handlers) {
      it(`has ${h} method`, () => { expect(te).toMatch(new RegExp(`private (?:async )?${h}`)); });
    }
    it('has 404 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(404); });
    it('has 400 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(400); });
  });
});
