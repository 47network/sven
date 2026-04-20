import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 92 — Agent Distributed Tracing', () => {

  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617290000_agent_distributed_tracing.sql'), 'utf-8');
    it('creates trace_records table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS trace_records'); });
    it('creates trace_spans table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS trace_spans'); });
    it('creates trace_baggage table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS trace_baggage'); });
    it('creates trace_sampling_rules table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS trace_sampling_rules'); });
    it('creates trace_analytics table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS trace_analytics'); });
    it('has 20 indexes', () => { expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20); });
    it('has span_kind CHECK', () => { expect(sql).toContain("'internal','server','client','producer','consumer'"); });
  });

  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-distributed-tracing.ts'), 'utf-8');
    it('exports TraceStatus', () => { expect(src).toContain("export type TraceStatus"); });
    it('exports SpanKind', () => { expect(src).toContain("export type SpanKind"); });
    it('exports SamplingDecision', () => { expect(src).toContain("export type SamplingDecision"); });
    it('exports TracePropagation', () => { expect(src).toContain("export type TracePropagation"); });
    it('exports TraceExporter', () => { expect(src).toContain("export type TraceExporter"); });
    it('exports TraceRecord interface', () => { expect(src).toContain("export interface TraceRecord"); });
    it('exports TraceSpan interface', () => { expect(src).toContain("export interface TraceSpan"); });
    it('exports TraceBaggage interface', () => { expect(src).toContain("export interface TraceBaggage"); });
    it('exports TraceSamplingRule interface', () => { expect(src).toContain("export interface TraceSamplingRule"); });
    it('exports TraceAnalytics interface', () => { expect(src).toContain("export interface TraceAnalytics"); });
    it('exports isTraceError helper', () => { expect(src).toContain("export function isTraceError"); });
    it('exports traceErrorRate helper', () => { expect(src).toContain("export function traceErrorRate"); });
  });

  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has trace_nexus building kind', () => { expect(types).toContain("'trace_nexus'"); });
    it('has 75 building kinds', () => {
      const block = types.match(/type EidolonBuildingKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(75);
    });
    it('has 316 event kind pipes', () => {
      const block = types.match(/type EidolonEventKind[\s\S]*?;/);
      expect((block[0].match(/\|/g) || []).length).toBe(316);
    });
    it('has tracing events', () => {
      expect(types).toContain("'tracing.trace_started'");
      expect(types).toContain("'tracing.span_completed'");
    });
  });

  describe('Event bus', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has tracing subjects', () => {
      expect(bus).toContain("'sven.tracing.trace_started'");
      expect(bus).toContain("'sven.tracing.analysis_generated'");
    });
    it('has 315 SUBJECT_MAP entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect((m[1].match(/^\s+'/gm) || []).length).toBe(315);
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['trace_start','trace_add_span','trace_set_baggage','trace_configure_sampling','trace_query','trace_analyze','trace_report'];
    for (const c of cases) { it(`has case '${c}'`, () => { expect(te).toContain(`case '${c}'`); }); }
    it('has 425 switch cases total', () => { expect((te.match(/case '/g) || []).length).toBe(425); });
    it('has 421 handler methods total', () => { expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(421); });
  });

  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-distributed-tracing/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => { expect(skill).toMatch(/skill:\s*agent-distributed-tracing/); });
    it('has 7 actions', () => { expect((skill.match(/  - trace_/g) || []).length).toBe(7); });
  });
});
