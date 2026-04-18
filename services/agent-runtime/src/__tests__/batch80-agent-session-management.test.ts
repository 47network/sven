import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 80 — Agent Session Management', () => {
  // --- Migration ---
  describe('Migration SQL', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260617170000_agent_session_management.sql'), 'utf-8');
    it('creates 5 tables', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_sessions');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS session_messages');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS session_contexts');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS session_handoffs');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS session_analytics');
    });
    it('has 20 indexes', () => {
      expect((sql.match(/CREATE INDEX/g) || []).length).toBe(20);
    });
    it('agent_sessions has status and channel CHECK', () => {
      expect(sql).toContain("status IN ('active','idle','suspended','expired','terminated')");
      expect(sql).toContain("channel IN ('api','web','discord','telegram','slack','email','sms','voice')");
    });
    it('session_messages has role CHECK', () => {
      expect(sql).toContain("role IN ('user','assistant','system','tool','function')");
    });
    it('session_contexts has context_type CHECK', () => {
      expect(sql).toContain("context_type IN ('memory','file','tool_result','summary','injection','rag_result')");
    });
    it('session_handoffs has status CHECK', () => {
      expect(sql).toContain("status IN ('pending','accepted','rejected','completed','failed')");
    });
    it('session_analytics has resolution_status CHECK', () => {
      expect(sql).toContain("resolution_status IN ('resolved','unresolved','escalated','abandoned')");
    });
    it('has foreign keys', () => {
      expect((sql.match(/REFERENCES agent_sessions/g) || []).length).toBe(5);
    });
  });

  // --- Shared Types ---
  describe('Shared types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-session-management.ts'), 'utf-8');
    it('exports SessionChannel with 8 values', () => {
      const m = src.match(/export type SessionChannel\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(8);
    });
    it('exports SessionStatus with 5 values', () => {
      const m = src.match(/export type SessionStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports SessionMessageRole with 5 values', () => {
      const m = src.match(/export type SessionMessageRole\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports SessionContextType with 6 values', () => {
      const m = src.match(/export type SessionContextType\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(6);
    });
    it('exports SessionHandoffStatus with 5 values', () => {
      const m = src.match(/export type SessionHandoffStatus\s*=\s*([^;]+);/);
      expect(m).toBeTruthy();
      expect((m![1].match(/'/g) || []).length / 2).toBe(5);
    });
    it('exports 5 interfaces', () => {
      expect(src).toContain('export interface AgentSession');
      expect(src).toContain('export interface SessionMessage');
      expect(src).toContain('export interface SessionContext');
      expect(src).toContain('export interface SessionHandoff');
      expect(src).toContain('export interface SessionAnalytics');
    });
    it('exports isSessionExpired helper', () => {
      expect(src).toContain('export function isSessionExpired');
    });
    it('exports sessionTokenUtilization helper', () => {
      expect(src).toContain('export function sessionTokenUtilization');
    });
    it('exports avgResponseLatency helper', () => {
      expect(src).toContain('export function avgResponseLatency');
    });
  });

  // --- Helper logic ---
  describe('isSessionExpired', () => {
    it('returns true when expiresAt is in the past', () => {
      const { isSessionExpired } = require('../../../../packages/shared/src/agent-session-management');
      expect(isSessionExpired({ expiresAt: '2020-01-01T00:00:00Z', lastActivityAt: new Date().toISOString(), idleTimeoutMs: 999999 })).toBe(true);
    });
    it('returns true when idle timeout exceeded', () => {
      const { isSessionExpired } = require('../../../../packages/shared/src/agent-session-management');
      const past = new Date(Date.now() - 500000).toISOString();
      expect(isSessionExpired({ lastActivityAt: past, idleTimeoutMs: 300000 })).toBe(true);
    });
    it('returns false when session is fresh', () => {
      const { isSessionExpired } = require('../../../../packages/shared/src/agent-session-management');
      expect(isSessionExpired({ lastActivityAt: new Date().toISOString(), idleTimeoutMs: 999999 })).toBe(false);
    });
  });

  describe('sessionTokenUtilization', () => {
    it('returns ratio', () => {
      const { sessionTokenUtilization } = require('../../../../packages/shared/src/agent-session-management');
      expect(sessionTokenUtilization({ contextWindowUsed: 500 }, 1000)).toBeCloseTo(0.5);
    });
    it('returns 0 for zero max', () => {
      const { sessionTokenUtilization } = require('../../../../packages/shared/src/agent-session-management');
      expect(sessionTokenUtilization({ contextWindowUsed: 500 }, 0)).toBe(0);
    });
  });

  describe('avgResponseLatency', () => {
    it('calculates average', () => {
      const { avgResponseLatency } = require('../../../../packages/shared/src/agent-session-management');
      const msgs = [
        { role: 'assistant', latencyMs: 100 },
        { role: 'assistant', latencyMs: 200 },
        { role: 'user', latencyMs: 50 },
      ];
      expect(avgResponseLatency(msgs)).toBe(150);
    });
    it('returns 0 for no assistant messages', () => {
      const { avgResponseLatency } = require('../../../../packages/shared/src/agent-session-management');
      expect(avgResponseLatency([{ role: 'user', latencyMs: 100 }])).toBe(0);
    });
  });

  // --- Barrel export ---
  describe('Barrel export', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-session-management', () => {
      expect(idx).toContain("./agent-session-management");
    });
    it('has at least 105 lines', () => {
      expect(idx.split('\n').length).toBeGreaterThanOrEqual(105);
    });
  });

  // --- SKILL.md ---
  describe('SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/agent-session-management/SKILL.md'), 'utf-8');
    it('has correct skill identifier', () => {
      expect(skill).toMatch(/skill:\s*agent-session-management/);
    });
    it('has architect archetype', () => {
      expect(skill).toMatch(/archetype:\s*architect/);
    });
    it('defines 7 actions', () => {
      expect(skill).toContain('session_create');
      expect(skill).toContain('session_message');
      expect(skill).toContain('session_manage_context');
      expect(skill).toContain('session_handoff');
      expect(skill).toContain('session_suspend');
      expect(skill).toContain('session_resume');
      expect(skill).toContain('session_report');
    });
  });

  // --- Eidolon types ---
  describe('Eidolon types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has session_hub building kind', () => {
      expect(types).toContain("'session_hub'");
    });
    it('has 63 building kinds', () => {
      const bk = types.match(/export type EidolonBuildingKind[\s\S]*?;/);
      expect(bk).toBeTruthy();
      expect((bk![0].match(/\|/g) || []).length).toBe(63);
    });
    it('has 4 session event kinds', () => {
      expect(types).toContain("'session.started'");
      expect(types).toContain("'session.handoff_initiated'");
      expect(types).toContain("'session.expired'");
      expect(types).toContain("'session.analytics_recorded'");
    });
    it('has 268 event kinds', () => {
      const ek = types.match(/export type EidolonEventKind[\s\S]*?;/);
      expect(ek).toBeTruthy();
      expect((ek![0].match(/\|/g) || []).length).toBe(268);
    });
    it('districtFor handles session_hub', () => {
      expect(types).toContain("case 'session_hub':");
    });
  });

  // --- Event bus ---
  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has 4 session subjects', () => {
      expect(bus).toContain("'sven.session.started'");
      expect(bus).toContain("'sven.session.handoff_initiated'");
      expect(bus).toContain("'sven.session.expired'");
      expect(bus).toContain("'sven.session.analytics_recorded'");
    });
    it('has 267 total entries', () => {
      const m = bus.match(/SUBJECT_MAP[^{]*\{([^}]+)\}/s);
      expect(m).toBeTruthy();
      expect((m![1].match(/^\s+'/gm) || []).length).toBe(267);
    });
  });

  // --- Task executor ---
  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    it('has 341 switch cases', () => {
      expect((te.match(/case '/g) || []).length).toBe(341);
    });
    it('has 337 handler methods', () => {
      expect((te.match(/private (?:async )?handle[A-Z]/g) || []).length).toBe(337);
    });
    it('has 7 session handlers', () => {
      expect(te).toContain('handleSessionCreate');
      expect(te).toContain('handleSessionMessage');
      expect(te).toContain('handleSessionManageContext');
      expect(te).toContain('handleSessionHandoff');
      expect(te).toContain('handleSessionSuspend');
      expect(te).toContain('handleSessionResume');
      expect(te).toContain('handleSessionReport');
    });
  });

  // --- .gitattributes ---
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has session management migration', () => {
      expect(ga).toContain('20260617170000_agent_session_management.sql');
    });
    it('has session management types', () => {
      expect(ga).toContain('agent-session-management.ts');
    });
    it('has session management skill', () => {
      expect(ga).toContain('agent-session-management/SKILL.md');
    });
  });

  // --- CHANGELOG ---
  describe('CHANGELOG', () => {
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
    it('has Batch 80 entry', () => {
      expect(cl).toContain('Batch 80');
      expect(cl).toContain('Agent Session Management');
    });
  });

  // --- Migration count ---
  describe('Migration count', () => {
    const migs = fs.readdirSync(path.join(ROOT, 'services/gateway-api/migrations')).filter(f => f.endsWith('.sql'));
    it('has 66 migrations', () => {
      expect(migs.length).toBe(66);
    });
  });
});
