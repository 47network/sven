import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Disaster Recovery management verticals', () => {
  const verticals = [
    {
      name: 'disaster_recovery', migration: '20260629650000_agent_disaster_recovery.sql',
      typeFile: 'agent-disaster-recovery.ts', skillDir: 'disaster-recovery',
      interfaces: ['DisasterRecoveryPlan', 'DisasterRecoveryConfig', 'DisasterRecoveryResult'],
      bk: 'disaster_recovery', eks: ['drc.plan_created', 'drc.config_updated', 'drc.export_emitted'],
      subjects: ['sven.drc.plan_created', 'sven.drc.config_updated', 'sven.drc.export_emitted'],
      cases: ['drc_planner', 'drc_executor', 'drc_reporter'],
    },
    {
      name: 'disaster_recovery_monitor', migration: '20260629660000_agent_disaster_recovery_monitor.sql',
      typeFile: 'agent-disaster-recovery-monitor.ts', skillDir: 'disaster-recovery-monitor',
      interfaces: ['DisasterRecoveryMonitorCheck', 'DisasterRecoveryMonitorConfig', 'DisasterRecoveryMonitorResult'],
      bk: 'disaster_recovery_monitor', eks: ['drcm.check_passed', 'drcm.alert_raised', 'drcm.export_emitted'],
      subjects: ['sven.drcm.check_passed', 'sven.drcm.alert_raised', 'sven.drcm.export_emitted'],
      cases: ['drcm_watcher', 'drcm_alerter', 'drcm_reporter'],
    },
    {
      name: 'disaster_recovery_auditor', migration: '20260629670000_agent_disaster_recovery_auditor.sql',
      typeFile: 'agent-disaster-recovery-auditor.ts', skillDir: 'disaster-recovery-auditor',
      interfaces: ['DisasterRecoveryAuditEntry', 'DisasterRecoveryAuditConfig', 'DisasterRecoveryAuditResult'],
      bk: 'disaster_recovery_auditor', eks: ['drca.entry_logged', 'drca.violation_found', 'drca.export_emitted'],
      subjects: ['sven.drca.entry_logged', 'sven.drca.violation_found', 'sven.drca.export_emitted'],
      cases: ['drca_scanner', 'drca_enforcer', 'drca_reporter'],
    },
    {
      name: 'disaster_recovery_reporter', migration: '20260629680000_agent_disaster_recovery_reporter.sql',
      typeFile: 'agent-disaster-recovery-reporter.ts', skillDir: 'disaster-recovery-reporter',
      interfaces: ['DisasterRecoveryReport', 'DisasterRecoveryReportConfig', 'DisasterRecoveryReportResult'],
      bk: 'disaster_recovery_reporter', eks: ['drcr.report_generated', 'drcr.insight_found', 'drcr.export_emitted'],
      subjects: ['sven.drcr.report_generated', 'sven.drcr.insight_found', 'sven.drcr.export_emitted'],
      cases: ['drcr_builder', 'drcr_analyst', 'drcr_reporter'],
    },
    {
      name: 'disaster_recovery_optimizer', migration: '20260629690000_agent_disaster_recovery_optimizer.sql',
      typeFile: 'agent-disaster-recovery-optimizer.ts', skillDir: 'disaster-recovery-optimizer',
      interfaces: ['DisasterRecoveryOptPlan', 'DisasterRecoveryOptConfig', 'DisasterRecoveryOptResult'],
      bk: 'disaster_recovery_optimizer', eks: ['drco.plan_created', 'drco.optimization_applied', 'drco.export_emitted'],
      subjects: ['sven.drco.plan_created', 'sven.drco.optimization_applied', 'sven.drco.export_emitted'],
      cases: ['drco_planner', 'drco_executor', 'drco_reporter'],
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
