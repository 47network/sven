import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Data Retention management verticals', () => {
  const verticals = [
    {
      name: 'data_retention', migration: '20260629550000_agent_data_retention.sql',
      typeFile: 'agent-data-retention.ts', skillDir: 'data-retention',
      interfaces: ['DataRetentionPolicy', 'DataRetentionConfig', 'DataRetentionResult'],
      bk: 'data_retention', eks: ['dr.policy_created', 'dr.config_updated', 'dr.export_emitted'],
      subjects: ['sven.dr.policy_created', 'sven.dr.config_updated', 'sven.dr.export_emitted'],
      cases: ['dr_planner', 'dr_enforcer', 'dr_reporter'],
    },
    {
      name: 'data_retention_monitor', migration: '20260629560000_agent_data_retention_monitor.sql',
      typeFile: 'agent-data-retention-monitor.ts', skillDir: 'data-retention-monitor',
      interfaces: ['DataRetentionMonitorCheck', 'DataRetentionMonitorConfig', 'DataRetentionMonitorResult'],
      bk: 'data_retention_monitor', eks: ['drm.check_passed', 'drm.alert_raised', 'drm.export_emitted'],
      subjects: ['sven.drm.check_passed', 'sven.drm.alert_raised', 'sven.drm.export_emitted'],
      cases: ['drm_watcher', 'drm_alerter', 'drm_reporter'],
    },
    {
      name: 'data_retention_auditor', migration: '20260629570000_agent_data_retention_auditor.sql',
      typeFile: 'agent-data-retention-auditor.ts', skillDir: 'data-retention-auditor',
      interfaces: ['DataRetentionAuditEntry', 'DataRetentionAuditConfig', 'DataRetentionAuditResult'],
      bk: 'data_retention_auditor', eks: ['dra.entry_logged', 'dra.violation_found', 'dra.export_emitted'],
      subjects: ['sven.dra.entry_logged', 'sven.dra.violation_found', 'sven.dra.export_emitted'],
      cases: ['dra_scanner', 'dra_enforcer', 'dra_reporter'],
    },
    {
      name: 'data_retention_reporter', migration: '20260629580000_agent_data_retention_reporter.sql',
      typeFile: 'agent-data-retention-reporter.ts', skillDir: 'data-retention-reporter',
      interfaces: ['DataRetentionReport', 'DataRetentionReportConfig', 'DataRetentionReportResult'],
      bk: 'data_retention_reporter', eks: ['drr.report_generated', 'drr.insight_found', 'drr.export_emitted'],
      subjects: ['sven.drr.report_generated', 'sven.drr.insight_found', 'sven.drr.export_emitted'],
      cases: ['drr_builder', 'drr_analyst', 'drr_reporter'],
    },
    {
      name: 'data_retention_optimizer', migration: '20260629590000_agent_data_retention_optimizer.sql',
      typeFile: 'agent-data-retention-optimizer.ts', skillDir: 'data-retention-optimizer',
      interfaces: ['DataRetentionOptPlan', 'DataRetentionOptConfig', 'DataRetentionOptResult'],
      bk: 'data_retention_optimizer', eks: ['dro2.plan_created', 'dro2.optimization_applied', 'dro2.export_emitted'],
      subjects: ['sven.dro2.plan_created', 'sven.dro2.optimization_applied', 'sven.dro2.export_emitted'],
      cases: ['dro2_planner', 'dro2_executor', 'dro2_reporter'],
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
