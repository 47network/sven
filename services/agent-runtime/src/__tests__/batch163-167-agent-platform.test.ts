/**
 * Batch 163-167 — Agent Platform: Runtime Sandbox, Secret Rotation,
 * Traffic Mirror, Compliance Report, Capacity Planning
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

const migSandbox    = read('services/gateway-api/migrations/20260618000000_agent_runtime_sandbox.sql');
const migRotation   = read('services/gateway-api/migrations/20260618010000_agent_secret_rotation.sql');
const migMirror     = read('services/gateway-api/migrations/20260618020000_agent_traffic_mirror.sql');
const migCompliance = read('services/gateway-api/migrations/20260618030000_agent_compliance_report.sql');
const migCapacity   = read('services/gateway-api/migrations/20260618040000_agent_capacity_planning.sql');

const typesTs    = read('services/sven-eidolon/src/types.ts');
const eventBusTs = read('services/sven-eidolon/src/event-bus.ts');
const indexTs    = read('packages/shared/src/index.ts');
const taskExec   = read('services/sven-marketplace/src/task-executor.ts');
const gitattr    = read('.gitattributes');

const sharedSandbox    = read('packages/shared/src/agent-runtime-sandbox.ts');
const sharedRotation   = read('packages/shared/src/agent-secret-rotation.ts');
const sharedMirror     = read('packages/shared/src/agent-traffic-mirror.ts');
const sharedCompliance = read('packages/shared/src/agent-compliance-report.ts');
const sharedCapacity   = read('packages/shared/src/agent-capacity-planning.ts');

const skillSandbox    = read('skills/agent-runtime-sandbox/SKILL.md');
const skillRotation   = read('skills/agent-secret-rotation/SKILL.md');
const skillMirror     = read('skills/agent-traffic-mirror/SKILL.md');
const skillCompliance = read('skills/agent-compliance-report/SKILL.md');
const skillCapacity   = read('skills/agent-capacity-planning/SKILL.md');

/* ═══ Batch 163 — Runtime Sandbox ═══ */
describe('Batch 163 — Agent Runtime Sandbox', () => {
  describe('Migration', () => {
    it('creates agent_runtime_sandboxes', () => expect(migSandbox).toContain('agent_runtime_sandboxes'));
    it('creates agent_sandbox_executions', () => expect(migSandbox).toContain('agent_sandbox_executions'));
    it('creates agent_sandbox_violations', () => expect(migSandbox).toContain('agent_sandbox_violations'));
    it('has sandbox_type CHECK', () => expect(migSandbox).toMatch(/container.*wasm.*vm.*process.*namespace/));
    it('has isolation_level CHECK', () => expect(migSandbox).toMatch(/minimal.*standard.*strict.*paranoid/));
    it('has violation_type CHECK', () => expect(migSandbox).toMatch(/syscall_blocked.*memory_exceeded.*cpu_exceeded/));
  });
  describe('Types', () => {
    it('exports AgentSandboxType', () => expect(sharedSandbox).toContain('AgentSandboxType'));
    it('exports AgentRuntimeSandbox', () => expect(sharedSandbox).toContain('AgentRuntimeSandbox'));
    it('exports AgentSandboxExecution', () => expect(sharedSandbox).toContain('AgentSandboxExecution'));
    it('exports AgentSandboxViolation', () => expect(sharedSandbox).toContain('AgentSandboxViolation'));
    it('barrel exports', () => expect(indexTs).toContain('agent-runtime-sandbox'));
  });
  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-runtime-sandbox/SKILL.md')).toBe(true));
    it('name', () => expect(skillSandbox).toContain('name: agent-runtime-sandbox'));
    it('archetype', () => expect(skillSandbox).toContain('archetype: infrastructure'));
    it('pricing', () => expect(skillSandbox).toContain('0.69 47T'));
    it('create-sandbox action', () => expect(skillSandbox).toContain('create-sandbox'));
  });
});

/* ═══ Batch 164 — Secret Rotation ═══ */
describe('Batch 164 — Agent Secret Rotation', () => {
  describe('Migration', () => {
    it('creates agent_rotation_policies', () => expect(migRotation).toContain('agent_rotation_policies'));
    it('creates agent_rotation_events', () => expect(migRotation).toContain('agent_rotation_events'));
    it('creates agent_rotation_schedule', () => expect(migRotation).toContain('agent_rotation_schedule'));
    it('has rotation_type CHECK', () => expect(migRotation).toMatch(/time_based.*usage_based.*event_based.*manual/));
    it('has event_type CHECK', () => expect(migRotation).toMatch(/rotated.*expired.*expiring_soon.*rotation_failed/));
  });
  describe('Types', () => {
    it('exports AgentSecretRotationType', () => expect(sharedRotation).toContain('AgentSecretRotationType'));
    it('exports AgentRotationPolicy', () => expect(sharedRotation).toContain('AgentRotationPolicy'));
    it('exports AgentRotationEvent', () => expect(sharedRotation).toContain('AgentRotationEvent'));
    it('exports AgentSecretRotationStats', () => expect(sharedRotation).toContain('AgentSecretRotationStats'));
    it('barrel exports', () => expect(indexTs).toContain('agent-secret-rotation'));
  });
  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-secret-rotation/SKILL.md')).toBe(true));
    it('name', () => expect(skillRotation).toContain('name: agent-secret-rotation'));
    it('archetype', () => expect(skillRotation).toContain('archetype: operations'));
    it('pricing', () => expect(skillRotation).toContain('0.39 47T'));
    it('rotate-now action', () => expect(skillRotation).toContain('rotate-now'));
  });
});

/* ═══ Batch 165 — Traffic Mirror ═══ */
describe('Batch 165 — Agent Traffic Mirror', () => {
  describe('Migration', () => {
    it('creates agent_traffic_mirrors', () => expect(migMirror).toContain('agent_traffic_mirrors'));
    it('creates agent_traffic_captures', () => expect(migMirror).toContain('agent_traffic_captures'));
    it('creates agent_traffic_replays', () => expect(migMirror).toContain('agent_traffic_replays'));
    it('has status CHECK', () => expect(migMirror).toMatch(/active.*paused.*draining.*stopped/));
    it('has replay status CHECK', () => expect(migMirror).toMatch(/pending.*running.*completed.*aborted/));
  });
  describe('Types', () => {
    it('exports AgentTrafficMirror', () => expect(sharedMirror).toContain('AgentTrafficMirror'));
    it('exports AgentTrafficCapture', () => expect(sharedMirror).toContain('AgentTrafficCapture'));
    it('exports AgentTrafficReplay', () => expect(sharedMirror).toContain('AgentTrafficReplay'));
    it('exports AgentTrafficMirrorStats', () => expect(sharedMirror).toContain('AgentTrafficMirrorStats'));
    it('barrel exports', () => expect(indexTs).toContain('agent-traffic-mirror'));
  });
  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-traffic-mirror/SKILL.md')).toBe(true));
    it('name', () => expect(skillMirror).toContain('name: agent-traffic-mirror'));
    it('archetype', () => expect(skillMirror).toContain('archetype: infrastructure'));
    it('pricing', () => expect(skillMirror).toContain('0.89 47T'));
    it('start-replay action', () => expect(skillMirror).toContain('start-replay'));
  });
});

/* ═══ Batch 166 — Compliance Report ═══ */
describe('Batch 166 — Agent Compliance Report', () => {
  describe('Migration', () => {
    it('creates agent_compliance_frameworks', () => expect(migCompliance).toContain('agent_compliance_frameworks'));
    it('creates agent_compliance_assessments', () => expect(migCompliance).toContain('agent_compliance_assessments'));
    it('creates agent_compliance_findings', () => expect(migCompliance).toContain('agent_compliance_findings'));
    it('has framework_type CHECK', () => expect(migCompliance).toMatch(/gdpr.*soc2.*iso27001.*hipaa/));
    it('has finding_type CHECK', () => expect(migCompliance).toMatch(/pass.*fail.*warning.*not_applicable/));
  });
  describe('Types', () => {
    it('exports AgentComplianceFrameworkType', () => expect(sharedCompliance).toContain('AgentComplianceFrameworkType'));
    it('exports AgentComplianceAssessment', () => expect(sharedCompliance).toContain('AgentComplianceAssessment'));
    it('exports AgentComplianceFinding', () => expect(sharedCompliance).toContain('AgentComplianceFinding'));
    it('exports AgentComplianceReportStats', () => expect(sharedCompliance).toContain('AgentComplianceReportStats'));
    it('barrel exports', () => expect(indexTs).toContain('agent-compliance-report'));
  });
  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-compliance-report/SKILL.md')).toBe(true));
    it('name', () => expect(skillCompliance).toContain('name: agent-compliance-report'));
    it('archetype', () => expect(skillCompliance).toContain('archetype: analyst'));
    it('pricing', () => expect(skillCompliance).toContain('4.99 47T'));
    it('run-assessment action', () => expect(skillCompliance).toContain('run-assessment'));
  });
});

/* ═══ Batch 167 — Capacity Planning ═══ */
describe('Batch 167 — Agent Capacity Planning', () => {
  describe('Migration', () => {
    it('creates agent_capacity_models', () => expect(migCapacity).toContain('agent_capacity_models'));
    it('creates agent_capacity_forecasts', () => expect(migCapacity).toContain('agent_capacity_forecasts'));
    it('creates agent_capacity_actions', () => expect(migCapacity).toContain('agent_capacity_actions'));
    it('has resource_type CHECK', () => expect(migCapacity).toMatch(/compute.*memory.*storage.*gpu.*network/));
    it('has forecast_method CHECK', () => expect(migCapacity).toMatch(/linear.*exponential.*seasonal.*ml_based/));
    it('has action_type CHECK', () => expect(migCapacity).toMatch(/scale_up.*scale_down.*provision.*decommission/));
  });
  describe('Types', () => {
    it('exports AgentCapacityResourceType', () => expect(sharedCapacity).toContain('AgentCapacityResourceType'));
    it('exports AgentCapacityForecast', () => expect(sharedCapacity).toContain('AgentCapacityForecast'));
    it('exports AgentCapacityAction', () => expect(sharedCapacity).toContain('AgentCapacityAction'));
    it('exports AgentCapacityPlanningStats', () => expect(sharedCapacity).toContain('AgentCapacityPlanningStats'));
    it('barrel exports', () => expect(indexTs).toContain('agent-capacity-planning'));
  });
  describe('SKILL.md', () => {
    it('exists', () => expect(exists('skills/agent-capacity-planning/SKILL.md')).toBe(true));
    it('name', () => expect(skillCapacity).toContain('name: agent-capacity-planning'));
    it('archetype', () => expect(skillCapacity).toContain('archetype: analyst'));
    it('pricing', () => expect(skillCapacity).toContain('1.49 47T'));
    it('run-forecast action', () => expect(skillCapacity).toContain('run-forecast'));
  });
});

/* ═══ Cross-cutting ═══ */
describe('Eidolon wiring (163-167)', () => {
  it('BK sandbox_pod', () => expect(typesTs).toContain("'sandbox_pod'"));
  it('BK secret_rotator', () => expect(typesTs).toContain("'secret_rotator'"));
  it('BK mirror_tap', () => expect(typesTs).toContain("'mirror_tap'"));
  it('BK compliance_desk', () => expect(typesTs).toContain("'compliance_desk'"));
  it('BK capacity_planner', () => expect(typesTs).toContain("'capacity_planner'"));
  it('EK sandbox.created', () => expect(typesTs).toContain("'sandbox.created'"));
  it('EK secretrot.secret_rotated', () => expect(typesTs).toContain("'secretrot.secret_rotated'"));
  it('EK trafficmirror.diff_detected', () => expect(typesTs).toContain("'trafficmirror.diff_detected'"));
  it('EK compliance.report_generated', () => expect(typesTs).toContain("'compliance.report_generated'"));
  it('EK capacity.breach_warning', () => expect(typesTs).toContain("'capacity.breach_warning'"));
  it('districtFor sandbox_pod → civic', () => expect(typesTs).toMatch(/case 'sandbox_pod'[\s\S]*?return 'civic'/));
  it('districtFor compliance_desk → market', () => expect(typesTs).toMatch(/case 'compliance_desk'[\s\S]*?return 'market'/));
});

describe('Event-bus (163-167)', () => {
  it('sven.sandbox.created', () => expect(eventBusTs).toContain("'sven.sandbox.created'"));
  it('sven.secretrot.policy_created', () => expect(eventBusTs).toContain("'sven.secretrot.policy_created'"));
  it('sven.trafficmirror.mirror_created', () => expect(eventBusTs).toContain("'sven.trafficmirror.mirror_created'"));
  it('sven.compliance.assessment_started', () => expect(eventBusTs).toContain("'sven.compliance.assessment_started'"));
  it('sven.capacity.forecast_generated', () => expect(eventBusTs).toContain("'sven.capacity.forecast_generated'"));
  it('has 610+ SUBJECT_MAP entries', () => {
    const count = (eventBusTs.match(/'sven\.\w+\.\w+'/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(610);
  });
});

describe('Task executor (163-167)', () => {
  it('sandbox_create', () => expect(taskExec).toContain("case 'sandbox_create'"));
  it('secretrot_rotate_now', () => expect(taskExec).toContain("case 'secretrot_rotate_now'"));
  it('trafficmirror_create', () => expect(taskExec).toContain("case 'trafficmirror_create'"));
  it('compliance_run_assessment', () => expect(taskExec).toContain("case 'compliance_run_assessment'"));
  it('capacity_run_forecast', () => expect(taskExec).toContain("case 'capacity_run_forecast'"));
  it('has 870+ switch cases', () => {
    const cases = (taskExec.match(/case '[a-z_]+'/g) || []).length;
    expect(cases).toBeGreaterThanOrEqual(870);
  });
  it('has 660+ handlers', () => {
    const handlers = (taskExec.match(/private async handle/g) || []).length;
    expect(handlers).toBeGreaterThanOrEqual(660);
  });
});

describe('.gitattributes (163-167)', () => {
  it('guards sandbox migration', () => expect(gitattr).toContain('20260618000000_agent_runtime_sandbox.sql'));
  it('guards rotation types', () => expect(gitattr).toContain('agent-secret-rotation.ts'));
  it('guards mirror SKILL.md', () => expect(gitattr).toContain('agent-traffic-mirror/SKILL.md'));
  it('guards compliance migration', () => expect(gitattr).toContain('20260618030000_agent_compliance_report.sql'));
  it('guards capacity types', () => expect(gitattr).toContain('agent-capacity-planning.ts'));
});
