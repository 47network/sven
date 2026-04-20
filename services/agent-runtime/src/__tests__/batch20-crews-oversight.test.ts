// ---------------------------------------------------------------------------
// Batch 20 — Agent Crews + Accountant + Sven Oversight
// Validates migration, shared types, admin APIs, eidolon integration, messaging.
// ---------------------------------------------------------------------------

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ────────────────────────── helpers ──────────────────────────

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function readMaybe(relPath: string): string | null {
  try { return readFile(relPath); } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
//  1. Migration SQL structure
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Migration', () => {
  const sql = readFile('services/gateway-api/migrations/20260424120000_agent_crews_oversight.sql');

  it('creates agent_crews table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_crews');
  });

  it('creates agent_crew_members table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_crew_members');
  });

  it('creates agent_messages table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_messages');
  });

  it('creates agent_performance_reports table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_performance_reports');
  });

  it('creates agent_anomalies table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_anomalies');
  });

  it('has index on crews org_id', () => {
    expect(sql).toContain('idx_crews_org');
  });

  it('has index on crews crew_type', () => {
    expect(sql).toContain('idx_crews_type');
  });

  it('has index on crew_members agent_id', () => {
    expect(sql).toContain('idx_crew_members_agent');
  });

  it('has index on messages to_agent_id', () => {
    expect(sql).toContain('idx_messages_to');
  });

  it('has index on messages crew_id', () => {
    expect(sql).toContain('idx_messages_crew');
  });

  it('has index on performance reports agent_id', () => {
    expect(sql).toContain('idx_perf_reports_agent');
  });

  it('has index on anomalies status', () => {
    expect(sql).toContain('idx_anomalies_status');
  });

  it('has index on anomalies target_agent_id', () => {
    expect(sql).toContain('idx_anomalies_target');
  });

  it('has crew_type CHECK constraint', () => {
    expect(sql).toMatch(/publishing/);
    expect(sql).toMatch(/research/);
    expect(sql).toMatch(/operations/);
    expect(sql).toMatch(/marketing/);
    expect(sql).toMatch(/legal_compliance/);
  });

  it('has crew status CHECK constraint', () => {
    expect(sql).toContain("'active'");
    expect(sql).toContain("'suspended'");
    expect(sql).toContain("'disbanded'");
  });

  it('has member role CHECK constraint', () => {
    expect(sql).toContain("'lead'");
    expect(sql).toContain("'member'");
    expect(sql).toContain("'specialist'");
    expect(sql).toContain("'observer'");
  });

  it('has anomaly type CHECK constraint', () => {
    expect(sql).toContain('unusual_amount');
    expect(sql).toContain('frequency_spike');
    expect(sql).toContain('revenue_drop');
    expect(sql).toContain('cost_overrun');
    expect(sql).toContain('dormant_agent');
    expect(sql).toContain('threshold_breach');
    expect(sql).toContain('pattern_deviation');
  });

  it('has anomaly severity CHECK constraint', () => {
    expect(sql).toContain("'low'");
    expect(sql).toContain("'medium'");
    expect(sql).toContain("'high'");
    expect(sql).toContain("'critical'");
  });

  it('has anomaly status CHECK constraint', () => {
    expect(sql).toContain("'open'");
    expect(sql).toContain("'investigating'");
    expect(sql).toContain("'resolved'");
    expect(sql).toContain("'dismissed'");
  });

  it('has message type CHECK constraint', () => {
    expect(sql).toContain("'info'");
    expect(sql).toContain("'alert'");
    expect(sql).toContain("'anomaly'");
    expect(sql).toContain("'report'");
    expect(sql).toContain("'command'");
    expect(sql).toContain("'task_update'");
  });

  it('has message priority CHECK constraint', () => {
    expect(sql).toContain("'normal'");
  });
});

// ═══════════════════════════════════════════════════════════════
//  2. Shared types — agent-crews.ts
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Shared crew types', () => {
  const src = readFile('packages/shared/src/agent-crews.ts');

  it('exports CrewType union with 6 values', () => {
    expect(src).toContain("export type CrewType =");
    for (const t of ['publishing', 'research', 'operations', 'marketing', 'legal_compliance', 'custom']) {
      expect(src).toContain(`'${t}'`);
    }
  });

  it('exports CrewStatus', () => {
    expect(src).toContain("export type CrewStatus = 'active' | 'suspended' | 'disbanded'");
  });

  it('exports CrewMemberRole', () => {
    expect(src).toContain("export type CrewMemberRole = 'lead' | 'member' | 'specialist' | 'observer'");
  });

  it('exports CREW_TEMPLATES map with 6 entries', () => {
    expect(src).toContain('export const CREW_TEMPLATES');
    for (const t of ['publishing', 'research', 'operations', 'marketing', 'legal_compliance', 'custom']) {
      expect(src).toContain(`${t}:`);
    }
  });

  it('exports ALL_CREW_TYPES array', () => {
    expect(src).toContain('export const ALL_CREW_TYPES');
  });

  it('CREW_TEMPLATES have required fields', () => {
    expect(src).toContain('suggestedArchetypes');
    expect(src).toContain('minMembers');
    expect(src).toContain('maxMembers');
    expect(src).toContain('icon');
  });

  it('exports MessageType', () => {
    expect(src).toContain("export type MessageType =");
    for (const v of ['info', 'alert', 'anomaly', 'report', 'command', 'task_update']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports MessagePriority', () => {
    expect(src).toContain("export type MessagePriority = 'low' | 'normal' | 'high' | 'critical'");
  });

  it('exports AgentMessage interface', () => {
    expect(src).toContain('export interface AgentMessage');
    expect(src).toContain('fromAgentId');
    expect(src).toContain('toAgentId');
    expect(src).toContain('messageType');
    expect(src).toContain('priority');
  });

  it('exports AnomalyType union with 7 values', () => {
    expect(src).toContain("export type AnomalyType =");
    for (const v of ['unusual_amount', 'frequency_spike', 'revenue_drop', 'cost_overrun',
                      'dormant_agent', 'threshold_breach', 'pattern_deviation']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports AnomalySeverity', () => {
    expect(src).toContain("export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical'");
  });

  it('exports AnomalyStatus', () => {
    expect(src).toContain("export type AnomalyStatus = 'open' | 'investigating' | 'resolved' | 'dismissed'");
  });

  it('exports AgentAnomaly interface', () => {
    expect(src).toContain('export interface AgentAnomaly');
  });

  it('exports OversightCommandType', () => {
    expect(src).toContain("export type OversightCommandType =");
    for (const v of ['suspend', 'resume', 'prioritize', 'deprioritize', 'reassign', 'review']) {
      expect(src).toContain(`'${v}'`);
    }
  });

  it('exports OversightCommand interface', () => {
    expect(src).toContain('export interface OversightCommand');
    expect(src).toContain('targetAgentId');
    expect(src).toContain('commandType');
    expect(src).toContain('reason');
  });

  it('exports CrewRow and CrewMemberRow DB interfaces', () => {
    expect(src).toContain('export interface CrewRow');
    expect(src).toContain('export interface CrewMemberRow');
  });

  it('exports crewDistrict helper function', () => {
    expect(src).toContain('export function crewDistrict');
  });

  it('crewDistrict maps publishing to market', () => {
    expect(src).toMatch(/publishing[\s\S]*?return\s+'market'/);
  });

  it('crewDistrict maps research to revenue', () => {
    expect(src).toMatch(/research[\s\S]*?return\s+'revenue'/);
  });

  it('crewDistrict maps operations to infra', () => {
    expect(src).toMatch(/operations[\s\S]*?return\s+'infra'/);
  });

  it('crewDistrict maps legal_compliance to treasury', () => {
    expect(src).toMatch(/legal_compliance[\s\S]*?return\s+'treasury'/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  3. Shared index re-exports agent-crews
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Shared index export', () => {
  const idx = readFile('packages/shared/src/index.ts');

  it('re-exports agent-crews module', () => {
    expect(idx).toContain("from './agent-crews.js'");
  });
});

// ═══════════════════════════════════════════════════════════════
//  4. Crew Management API
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Crew Management API', () => {
  const src = readFile('services/gateway-api/src/routes/admin/crew-management.ts');

  it('exports registerCrewManagementRoutes', () => {
    expect(src).toContain('export function registerCrewManagementRoutes');
  });

  it('accepts FastifyInstance, pg.Pool, NatsConnection params', () => {
    expect(src).toContain('FastifyInstance');
    expect(src).toContain('pg.Pool');
    expect(src).toContain('NatsConnection');
  });

  it('defines VALID_CREW_TYPES constant', () => {
    expect(src).toContain('VALID_CREW_TYPES');
  });

  it('defines CREW_MAX_MEMBERS limits', () => {
    expect(src).toContain('CREW_MAX_MEMBERS');
    expect(src).toContain('publishing: 10');
    expect(src).toContain('research: 8');
    expect(src).toContain('operations: 8');
    expect(src).toContain('marketing: 8');
    expect(src).toContain('legal_compliance: 6');
    expect(src).toContain('custom: 15');
  });

  it('has GET /crews route', () => {
    expect(src).toMatch(/app\.(get|route)[\s\S]*?\/crews/);
  });

  it('has POST /crews route for creation', () => {
    expect(src).toMatch(/app\.post[\s\S]*?\/crews/);
  });

  it('has POST /crews/:crewId/members route', () => {
    expect(src).toContain('/members');
  });

  it('has POST /crews/:crewId/disband route', () => {
    expect(src).toContain('/disband');
  });

  it('has GET /crews/templates route', () => {
    expect(src).toContain('/templates');
  });

  it('publishes sven.crew.created NATS event', () => {
    expect(src).toContain('sven.crew.created');
  });

  it('publishes sven.crew.member_added NATS event', () => {
    expect(src).toContain('sven.crew.member_added');
  });
});

// ═══════════════════════════════════════════════════════════════
//  5. Accountant Module
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Accountant Module', () => {
  const src = readFile('services/gateway-api/src/routes/admin/accountant.ts');

  it('exports registerAccountantRoutes', () => {
    expect(src).toContain('export function registerAccountantRoutes');
  });

  it('defines anomaly detection thresholds', () => {
    expect(src).toContain('THRESHOLDS');
    expect(src).toContain('unusualAmountMultiplier');
    expect(src).toContain('frequencySpikePerHour');
    expect(src).toContain('revenueDropPct');
  });

  it('has POST /oversight/scan endpoint', () => {
    expect(src).toContain('/scan');
  });

  it('implements unusual_amount anomaly detection', () => {
    expect(src).toContain('unusual_amount');
  });

  it('implements frequency_spike anomaly detection', () => {
    expect(src).toContain('frequency_spike');
  });

  it('implements dormant_agent anomaly detection', () => {
    expect(src).toContain('dormant_agent');
  });

  it('implements revenue_drop anomaly detection', () => {
    expect(src).toContain('revenue_drop');
  });

  it('has POST /oversight/reports/generate endpoint', () => {
    expect(src).toContain('/reports/generate');
  });

  it('has GET /oversight/reports endpoint', () => {
    expect(src).toMatch(/app\.get[\s\S]*?\/reports/);
  });

  it('has GET /oversight/anomalies endpoint', () => {
    expect(src).toContain('/anomalies');
  });

  it('has PATCH anomaly status update', () => {
    expect(src).toContain('VALID_ANOMALY_STATUSES');
  });

  it('has GET /oversight/anomalies/stats endpoint', () => {
    expect(src).toContain('/stats');
  });

  it('publishes sven.agent.anomaly_detected NATS event', () => {
    expect(src).toContain('sven.agent.anomaly_detected');
  });

  it('publishes sven.agent.report_generated NATS event', () => {
    expect(src).toContain('sven.agent.report_generated');
  });
});

// ═══════════════════════════════════════════════════════════════
//  6. Oversight Dashboard
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Oversight Dashboard', () => {
  const src = readFile('services/gateway-api/src/routes/admin/oversight-dashboard.ts');

  it('exports registerOversightDashboardRoutes', () => {
    expect(src).toContain('export function registerOversightDashboardRoutes');
  });

  it('has GET /oversight/dashboard endpoint', () => {
    expect(src).toContain('/dashboard');
  });

  it('has GET /oversight/agents/:agentId/performance endpoint', () => {
    expect(src).toContain('/performance');
  });

  it('has POST /oversight/commands endpoint', () => {
    expect(src).toContain('/commands');
  });

  it('defines valid command types', () => {
    expect(src).toContain('VALID_COMMAND_TYPES');
    for (const c of ['suspend', 'resume', 'prioritize', 'deprioritize', 'reassign', 'review']) {
      expect(src).toContain(`'${c}'`);
    }
  });

  it('suspends agent on suspend command', () => {
    expect(src).toContain("'suspended'");
  });

  it('resumes agent on resume command', () => {
    expect(src).toMatch(/resume[\s\S]*?active/);
  });

  it('publishes sven.oversight.command_issued NATS event', () => {
    expect(src).toContain('sven.oversight.command_issued');
  });

  it('dashboard aggregates agents', () => {
    expect(src).toContain('agent_profiles');
  });

  it('dashboard aggregates crews', () => {
    expect(src).toContain('agent_crews');
  });

  it('dashboard includes top earners', () => {
    expect(src).toMatch(/top.*earn|ORDER BY/i);
  });
});

// ═══════════════════════════════════════════════════════════════
//  7. Agent Messaging
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Agent Messaging', () => {
  const src = readFile('services/gateway-api/src/routes/admin/agent-messaging.ts');

  it('exports registerAgentMessagingRoutes', () => {
    expect(src).toContain('export function registerAgentMessagingRoutes');
  });

  it('has POST /messages endpoint', () => {
    expect(src).toMatch(/app\.post[\s\S]*?\/messages/);
  });

  it('has GET /messages endpoint for listing', () => {
    expect(src).toMatch(/app\.get[\s\S]*?\/messages/);
  });

  it('has PATCH /messages/:messageId/read endpoint', () => {
    expect(src).toContain('/read');
  });

  it('has GET /messages/unread-count endpoint', () => {
    expect(src).toContain('unread-count');
  });

  it('has POST /messages/broadcast endpoint', () => {
    expect(src).toContain('/broadcast');
  });

  it('validates message types', () => {
    expect(src).toContain('VALID_MESSAGE_TYPES');
    for (const t of ['info', 'alert', 'anomaly', 'report', 'command', 'task_update']) {
      expect(src).toContain(`'${t}'`);
    }
  });

  it('validates message priorities', () => {
    expect(src).toContain('VALID_PRIORITIES');
    for (const p of ['low', 'normal', 'high', 'critical']) {
      expect(src).toContain(`'${p}'`);
    }
  });

  it('publishes sven.agent.message_sent NATS event', () => {
    expect(src).toContain('sven.agent.message_sent');
  });
});

// ═══════════════════════════════════════════════════════════════
//  8. Admin index.ts wiring
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Admin index.ts wiring', () => {
  const idx = readFile('services/gateway-api/src/routes/admin/index.ts');

  it('imports registerCrewManagementRoutes', () => {
    expect(idx).toContain("import { registerCrewManagementRoutes } from './crew-management.js'");
  });

  it('imports registerAccountantRoutes', () => {
    expect(idx).toContain("import { registerAccountantRoutes } from './accountant.js'");
  });

  it('imports registerOversightDashboardRoutes', () => {
    expect(idx).toContain("import { registerOversightDashboardRoutes } from './oversight-dashboard.js'");
  });

  it('imports registerAgentMessagingRoutes', () => {
    expect(idx).toContain("import { registerAgentMessagingRoutes } from './agent-messaging.js'");
  });

  it('calls mountAdminRoutes with registerCrewManagementRoutes', () => {
    expect(idx).toContain('registerCrewManagementRoutes');
  });

  it('calls mountAdminRoutes with registerAccountantRoutes', () => {
    expect(idx).toContain('registerAccountantRoutes');
  });

  it('calls mountAdminRoutes with registerOversightDashboardRoutes', () => {
    expect(idx).toContain('registerOversightDashboardRoutes');
  });

  it('calls mountAdminRoutes with registerAgentMessagingRoutes', () => {
    expect(idx).toContain('registerAgentMessagingRoutes');
  });
});

// ═══════════════════════════════════════════════════════════════
//  9. Eidolon types — crew_headquarters + event kinds
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Eidolon types integration', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');

  it('includes crew_headquarters building kind', () => {
    expect(types).toContain("'crew_headquarters'");
  });

  it('includes crew.created event kind', () => {
    expect(types).toContain("'crew.created'");
  });

  it('includes crew.member_added event kind', () => {
    expect(types).toContain("'crew.member_added'");
  });

  it('includes agent.anomaly_detected event kind', () => {
    expect(types).toContain("'agent.anomaly_detected'");
  });

  it('includes agent.report_generated event kind', () => {
    expect(types).toContain("'agent.report_generated'");
  });

  it('includes oversight.command_issued event kind', () => {
    expect(types).toContain("'oversight.command_issued'");
  });

  it('includes agent.message_sent event kind', () => {
    expect(types).toContain("'agent.message_sent'");
  });

  it('districtFor handles crew_headquarters', () => {
    expect(types).toMatch(/case\s+'crew_headquarters'/);
  });

  it('districtFor handles agent_business', () => {
    expect(types).toMatch(/case\s+'agent_business'/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  10. Eidolon event-bus — 6 new SUBJECT_MAP entries
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Eidolon event-bus SUBJECT_MAP', () => {
  const bus = readFile('services/sven-eidolon/src/event-bus.ts');

  const newSubjects = [
    ['sven.crew.created', 'crew.created'],
    ['sven.crew.member_added', 'crew.member_added'],
    ['sven.agent.anomaly_detected', 'agent.anomaly_detected'],
    ['sven.agent.report_generated', 'agent.report_generated'],
    ['sven.oversight.command_issued', 'oversight.command_issued'],
    ['sven.agent.message_sent', 'agent.message_sent'],
  ] as const;

  for (const [natsSubject, eidolonEvent] of newSubjects) {
    it(`maps ${natsSubject} → ${eidolonEvent}`, () => {
      expect(bus).toContain(`'${natsSubject}': '${eidolonEvent}'`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════
//  11. Eidolon repo — fetchCrewBuildings + getSnapshot wiring
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Eidolon repo crew buildings', () => {
  const repo = readFile('services/sven-eidolon/src/repo.ts');

  it('defines fetchCrewBuildings method', () => {
    expect(repo).toContain('fetchCrewBuildings');
  });

  it('checks for agent_crews table existence', () => {
    expect(repo).toContain("table_name = 'agent_crews'");
  });

  it('queries agent_crews joined with agent_crew_members', () => {
    expect(repo).toContain('agent_crew_members');
  });

  it('uses crew_headquarters building kind', () => {
    expect(repo).toContain("'crew_headquarters'");
  });

  it('computes building height from member count', () => {
    expect(repo).toMatch(/20\s*\+\s*members\s*\*\s*8/);
  });

  it('uses crewTypeToDistrict mapping', () => {
    expect(repo).toContain('crewTypeToDistrict');
  });

  it('crewTypeToDistrict maps publishing to market', () => {
    expect(repo).toContain("publishing: 'market'");
  });

  it('crewTypeToDistrict maps research to revenue', () => {
    expect(repo).toContain("research: 'revenue'");
  });

  it('crewTypeToDistrict maps operations to infra', () => {
    expect(repo).toContain("operations: 'infra'");
  });

  it('crewTypeToDistrict maps legal_compliance to treasury', () => {
    expect(repo).toContain("legal_compliance: 'treasury'");
  });

  it('crewTypeToDistrict maps marketing to market', () => {
    expect(repo).toContain("marketing: 'market'");
  });

  it('crewTypeToDistrict maps custom to revenue', () => {
    expect(repo).toContain("custom: 'revenue'");
  });

  it('getSnapshot includes crewHQs in destructuring', () => {
    expect(repo).toContain('crewHQs');
  });

  it('getSnapshot spreads crewHQs into buildings array', () => {
    expect(repo).toContain('...crewHQs');
  });
});

// ═══════════════════════════════════════════════════════════════
//  12. Crew template correctness
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Crew template details', () => {
  const src = readFile('packages/shared/src/agent-crews.ts');

  it('publishing crew has icon 📚', () => {
    expect(src).toContain("icon: '📚'");
  });

  it('research crew has icon 🔬', () => {
    expect(src).toContain("icon: '🔬'");
  });

  it('operations crew has icon ⚙️', () => {
    expect(src).toContain("icon: '⚙️'");
  });

  it('marketing crew has icon 📣', () => {
    expect(src).toContain("icon: '📣'");
  });

  it('legal_compliance crew has icon ⚖️', () => {
    expect(src).toContain("icon: '⚖️'");
  });

  it('custom crew has icon 🔧', () => {
    expect(src).toContain("icon: '🔧'");
  });

  it('publishing crew maxMembers is 10', () => {
    expect(src).toMatch(/publishing[\s\S]*?maxMembers:\s*10/);
  });

  it('research crew maxMembers is 8', () => {
    expect(src).toMatch(/research[\s\S]*?maxMembers:\s*8/);
  });

  it('custom crew maxMembers is 15', () => {
    expect(src).toMatch(/custom[\s\S]*?maxMembers:\s*15/);
  });

  it('legal_compliance crew maxMembers is 6', () => {
    expect(src).toMatch(/legal_compliance[\s\S]*?maxMembers:\s*6/);
  });
});

// ═══════════════════════════════════════════════════════════════
//  13. Accountant detection thresholds
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Accountant thresholds', () => {
  const src = readFile('services/gateway-api/src/routes/admin/accountant.ts');

  it('unusual amount multiplier is 3', () => {
    expect(src).toContain('unusualAmountMultiplier: 3');
  });

  it('frequency spike threshold is 10 per hour', () => {
    expect(src).toContain('frequencySpikePerHour: 10');
  });

  it('revenue drop threshold is 50 percent', () => {
    expect(src).toContain('revenueDropPct: 50');
  });

  it('wraps each anomaly rule in try/catch', () => {
    const catches = (src.match(/catch\s*\(/g) || []).length;
    expect(catches).toBeGreaterThanOrEqual(3);
  });
});

// ═══════════════════════════════════════════════════════════════
//  14. Oversight command types
// ═══════════════════════════════════════════════════════════════
describe('Batch 20 — Oversight commands', () => {
  const src = readFile('services/gateway-api/src/routes/admin/oversight-dashboard.ts');

  it('suspend command updates agent status to suspended', () => {
    expect(src).toContain("status = 'suspended'");
  });

  it('resume command updates agent status to active', () => {
    expect(src).toContain("status = 'active'");
  });

  it('creates command message in agent_messages', () => {
    expect(src).toContain('agent_messages');
  });

  it('command message type is command', () => {
    expect(src).toContain("'command'");
  });
});
