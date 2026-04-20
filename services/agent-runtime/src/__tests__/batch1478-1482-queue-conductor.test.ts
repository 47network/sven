import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Queue Conductor verticals', () => {
  const verticals = [
    {
      name: 'queue_conductor', migration: '20260631150000_agent_queue_conductor.sql',
      typeFile: 'agent-queue-conductor.ts', skillDir: 'queue-conductor',
      interfaces: ['QueueConductorEntry', 'QueueConductorConfig', 'QueueConductorResult'],
      bk: 'queue_conductor', eks: ['qc.entry_created', 'qc.config_updated', 'qc.export_emitted'],
      subjects: ['sven.qc.entry_created', 'sven.qc.config_updated', 'sven.qc.export_emitted'],
      cases: ['qc_router', 'qc_balancer', 'qc_reporter'],
    },
    {
      name: 'queue_conductor_monitor', migration: '20260631160000_agent_queue_conductor_monitor.sql',
      typeFile: 'agent-queue-conductor-monitor.ts', skillDir: 'queue-conductor-monitor',
      interfaces: ['QueueConductorMonitorCheck', 'QueueConductorMonitorConfig', 'QueueConductorMonitorResult'],
      bk: 'queue_conductor_monitor', eks: ['qcm.check_passed', 'qcm.alert_raised', 'qcm.export_emitted'],
      subjects: ['sven.qcm.check_passed', 'sven.qcm.alert_raised', 'sven.qcm.export_emitted'],
      cases: ['qcm_watcher', 'qcm_alerter', 'qcm_reporter'],
    },
    {
      name: 'queue_conductor_auditor', migration: '20260631170000_agent_queue_conductor_auditor.sql',
      typeFile: 'agent-queue-conductor-auditor.ts', skillDir: 'queue-conductor-auditor',
      interfaces: ['QueueConductorAuditEntry', 'QueueConductorAuditConfig', 'QueueConductorAuditResult'],
      bk: 'queue_conductor_auditor', eks: ['qca.entry_logged', 'qca.violation_found', 'qca.export_emitted'],
      subjects: ['sven.qca.entry_logged', 'sven.qca.violation_found', 'sven.qca.export_emitted'],
      cases: ['qca_scanner', 'qca_enforcer', 'qca_reporter'],
    },
    {
      name: 'queue_conductor_reporter', migration: '20260631180000_agent_queue_conductor_reporter.sql',
      typeFile: 'agent-queue-conductor-reporter.ts', skillDir: 'queue-conductor-reporter',
      interfaces: ['QueueConductorReport', 'QueueConductorReportConfig', 'QueueConductorReportResult'],
      bk: 'queue_conductor_reporter', eks: ['qcr.report_generated', 'qcr.insight_found', 'qcr.export_emitted'],
      subjects: ['sven.qcr.report_generated', 'sven.qcr.insight_found', 'sven.qcr.export_emitted'],
      cases: ['qcr_builder', 'qcr_analyst', 'qcr_reporter'],
    },
    {
      name: 'queue_conductor_optimizer', migration: '20260631190000_agent_queue_conductor_optimizer.sql',
      typeFile: 'agent-queue-conductor-optimizer.ts', skillDir: 'queue-conductor-optimizer',
      interfaces: ['QueueConductorOptPlan', 'QueueConductorOptConfig', 'QueueConductorOptResult'],
      bk: 'queue_conductor_optimizer', eks: ['qco.plan_created', 'qco.optimization_applied', 'qco.export_emitted'],
      subjects: ['sven.qco.plan_created', 'sven.qco.optimization_applied', 'sven.qco.export_emitted'],
      cases: ['qco_planner', 'qco_executor', 'qco_reporter'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      test('migration file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration))).toBe(true);
      });
      test('migration has correct table', () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        expect(sql).toContain(`agent_${v.name}_configs`);
      });
      test('type file exists', () => {
        expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', v.typeFile))).toBe(true);
      });
      test('shared barrel exports type', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        expect(idx).toContain(`./${v.typeFile.replace('.ts', '')}`);
      });
      test('SKILL.md exists with Actions', () => {
        const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md'), 'utf-8');
        expect(skill).toContain('## Actions');
        expect(skill).toContain(v.skillDir);
      });
      test('Eidolon BK includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('Eidolon EKs all present', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => expect(types).toContain(`'${ek}'`));
      });
      test('event-bus SUBJECT_MAP entries present', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((s) => expect(eb).toContain(`'${s}'`));
      });
      test('task-executor switch cases present', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => expect(te).toContain(`case '${c}'`));
      });
      test('.gitattributes filters set', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
      test('districtFor includes vertical', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
    });
  });
});
