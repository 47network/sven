/**
 * Batch 53 — Agent Scheduling & Calendar
 *
 * Tests: migration SQL, shared types, SKILL.md, Eidolon wiring,
 * event-bus subjects, task-executor handlers, barrel export, .gitattributes
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 53 — Agent Scheduling & Calendar', () => {
  // ---------- Migration ----------
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(
      path.join(ROOT, 'services/gateway-api/migrations/20260526120000_agent_scheduling.sql'),
      'utf-8',
    );

    it('creates 5 tables', () => {
      const tables = (sql.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
      expect(tables).toBe(5);
    });

    it('includes agent_schedules table', () => {
      expect(sql).toContain('agent_schedules');
    });

    it('includes calendar_events table', () => {
      expect(sql).toContain('calendar_events');
    });

    it('includes availability_windows table', () => {
      expect(sql).toContain('availability_windows');
    });

    it('includes booking_slots table', () => {
      expect(sql).toContain('booking_slots');
    });

    it('includes schedule_triggers table', () => {
      expect(sql).toContain('schedule_triggers');
    });

    it('creates 17 indexes', () => {
      const indexes = (sql.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
      expect(indexes).toBe(17);
    });

    it('schedule_triggers references agent_schedules', () => {
      expect(sql).toContain('REFERENCES agent_schedules(id)');
    });
  });

  // ---------- Shared types ----------
  describe('Shared types file', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-scheduling.ts'),
      'utf-8',
    );

    it('exports ScheduleType with 5 values', () => {
      const m = src.match(/export type ScheduleType\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(5);
    });

    it('exports ScheduleStatus with 6 values', () => {
      const m = src.match(/export type ScheduleStatus\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(6);
    });

    it('exports CalendarEventType with 7 values', () => {
      const m = src.match(/export type CalendarEventType\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(7);
    });

    it('exports CalendarEventStatus with 5 values', () => {
      const m = src.match(/export type CalendarEventStatus\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(5);
    });

    it('exports BookingSlotStatus with 6 values', () => {
      const m = src.match(/export type BookingSlotStatus\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(6);
    });

    it('exports TriggerType with 5 values', () => {
      const m = src.match(/export type TriggerType\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(5);
    });

    it('exports SchedulingAction with 7 values', () => {
      const m = src.match(/export type SchedulingAction\s*=[\s\S]*?;/);
      expect(m).toBeTruthy();
      const vals = (m![0].match(/'/g) || []).length / 2;
      expect(vals).toBe(7);
    });
  });

  describe('Shared interfaces', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-scheduling.ts'),
      'utf-8',
    );

    it('exports AgentSchedule interface', () => {
      expect(src).toContain('export interface AgentSchedule');
    });

    it('exports CalendarEvent interface', () => {
      expect(src).toContain('export interface CalendarEvent');
    });

    it('exports AvailabilityWindow interface', () => {
      expect(src).toContain('export interface AvailabilityWindow');
    });

    it('exports BookingSlot interface', () => {
      expect(src).toContain('export interface BookingSlot');
    });

    it('exports ScheduleTrigger interface', () => {
      expect(src).toContain('export interface ScheduleTrigger');
    });
  });

  describe('Shared constants and helpers', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/agent-scheduling.ts'),
      'utf-8',
    );

    it('exports 6 constant arrays', () => {
      const consts = [
        'SCHEDULE_TYPES', 'SCHEDULE_STATUSES', 'CALENDAR_EVENT_TYPES',
        'CALENDAR_EVENT_STATUSES', 'BOOKING_SLOT_STATUSES', 'SCHEDULING_ACTIONS',
      ];
      for (const c of consts) {
        expect(src).toContain(`export const ${c}`);
      }
    });

    it('exports isScheduleRunnable helper', () => {
      expect(src).toContain('export function isScheduleRunnable');
    });

    it('exports isSlotBookable helper', () => {
      expect(src).toContain('export function isSlotBookable');
    });

    it('exports hasConflict helper', () => {
      expect(src).toContain('export function hasConflict');
    });

    it('exports getNextOccurrence helper', () => {
      expect(src).toContain('export function getNextOccurrence');
    });
  });

  // ---------- Barrel export ----------
  describe('Barrel export', () => {
    const idx = fs.readFileSync(
      path.join(ROOT, 'packages/shared/src/index.ts'),
      'utf-8',
    );

    it('re-exports agent-scheduling', () => {
      expect(idx).toContain("from './agent-scheduling");
    });

    it('has at least 78 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(78);
    });
  });

  // ---------- SKILL.md ----------
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/autonomous-economy/scheduling/SKILL.md'),
      'utf-8',
    );

    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*scheduling/);
    });

    it('declares 7 actions', () => {
      const actions = (skill.match(/^###\s+/gm) || []).length;
      expect(actions).toBe(7);
    });

    it('includes schedule_create action', () => {
      expect(skill).toContain('### schedule_create');
    });

    it('includes slot_book action', () => {
      expect(skill).toContain('### slot_book');
    });

    it('includes trigger_configure action', () => {
      expect(skill).toContain('### trigger_configure');
    });
  });

  // ---------- Eidolon types ----------
  describe('Eidolon building kind', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes schedule_clocktower building kind', () => {
      expect(types).toContain("'schedule_clocktower'");
    });

    it('has 36 building kinds total', () => {
      const block = types.match(/type EidolonBuildingKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(36);
    });
  });

  describe('Eidolon event kinds', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('includes 4 scheduling event kinds', () => {
      expect(types).toContain("'scheduling.schedule_fired'");
      expect(types).toContain("'scheduling.event_created'");
      expect(types).toContain("'scheduling.slot_booked'");
      expect(types).toContain("'scheduling.trigger_executed'");
    });

    it('has 160 event kinds total', () => {
      const block = types.match(/type EidolonEventKind\s*=[\s\S]*?;/);
      expect(block).toBeTruthy();
      const pipes = (block![0].match(/\|/g) || []).length;
      expect(pipes).toBe(160);
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/types.ts'),
      'utf-8',
    );

    it('maps schedule_clocktower to civic', () => {
      expect(types).toContain("case 'schedule_clocktower':");
      expect(types).toContain("return 'civic'");
    });

    it('has 36 cases total', () => {
      const fn = types.match(/function districtFor[\s\S]*?^}/m);
      expect(fn).toBeTruthy();
      const cases = (fn![0].match(/case\s+'/g) || []).length;
      expect(cases).toBe(36);
    });
  });

  // ---------- Event bus ----------
  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(
      path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'),
      'utf-8',
    );

    it('includes 4 scheduling subjects', () => {
      expect(bus).toContain("'sven.scheduling.schedule_fired'");
      expect(bus).toContain("'sven.scheduling.event_created'");
      expect(bus).toContain("'sven.scheduling.slot_booked'");
      expect(bus).toContain("'sven.scheduling.trigger_executed'");
    });

    it('has 159 entries total', () => {
      const block = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(block).toBeTruthy();
      const entries = (block![1].match(/^\s+'/gm) || []).length;
      expect(entries).toBe(159);
    });
  });

  // ---------- Task executor ----------
  describe('Task executor switch cases', () => {
    const tex = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('includes 7 scheduling switch cases', () => {
      expect(tex).toContain("case 'schedule_create':");
      expect(tex).toContain("case 'schedule_pause':");
      expect(tex).toContain("case 'calendar_event_create':");
      expect(tex).toContain("case 'calendar_event_cancel':");
      expect(tex).toContain("case 'availability_set':");
      expect(tex).toContain("case 'slot_book':");
      expect(tex).toContain("case 'schedule_trigger_configure':");
    });

    it('has 152 switch cases total', () => {
      const cases = (tex.match(/case '/g) || []).length;
      expect(cases).toBe(152);
    });
  });

  describe('Task executor handler methods', () => {
    const tex = fs.readFileSync(
      path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'),
      'utf-8',
    );

    it('includes 7 scheduling handler methods', () => {
      expect(tex).toMatch(/private (?:async )?handleScheduleCreate/);
      expect(tex).toMatch(/private (?:async )?handleSchedulePause/);
      expect(tex).toMatch(/private (?:async )?handleCalendarEventCreate/);
      expect(tex).toMatch(/private (?:async )?handleCalendarEventCancel/);
      expect(tex).toMatch(/private (?:async )?handleAvailabilitySet/);
      expect(tex).toMatch(/private (?:async )?handleSlotBook/);
      expect(tex).toMatch(/private (?:async )?handleScheduleTriggerConfigure/);
    });

    it('has 148 handler methods total', () => {
      const handlers = (tex.match(/private (?:async )?handle[A-Z]/g) || []).length;
      expect(handlers).toBe(148);
    });
  });

  // ---------- .gitattributes ----------
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');

    it('includes scheduling migration filter', () => {
      expect(ga).toContain('20260526120000_agent_scheduling.sql export-ignore');
    });

    it('includes scheduling types filter', () => {
      expect(ga).toContain('agent-scheduling.ts export-ignore');
    });

    it('includes scheduling skill filter', () => {
      expect(ga).toContain('skills/autonomous-economy/scheduling/** export-ignore');
    });
  });

  // ---------- Migration count ----------
  describe('Migration file count', () => {
    it('has 39 migration files total', () => {
      const migDir = path.join(ROOT, 'services/gateway-api/migrations');
      const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql'));
      expect(files.length).toBe(39);
    });
  });
});
