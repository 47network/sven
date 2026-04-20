import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Canary Release verticals', () => {
  const verticals = [
    {
      name: 'canary_release', migration: '20260630300000_agent_canary_release.sql',
      typeFile: 'agent-canary-release.ts', skillDir: 'canary-release',
      interfaces: ['CanaryReleaseEntry', 'CanaryReleaseConfig', 'CanaryReleaseResult'],
      bk: 'canary_release', eks: ['cnr.entry_created', 'cnr.config_updated', 'cnr.export_emitted'],
      subjects: ['sven.cnr.entry_created', 'sven.cnr.config_updated', 'sven.cnr.export_emitted'],
      cases: ['cnr_planner', 'cnr_executor', 'cnr_reporter'],
    },
    {
      name: 'canary_release_monitor', migration: '20260630310000_agent_canary_release_monitor.sql',
      typeFile: 'agent-canary-release-monitor.ts', skillDir: 'canary-release-monitor',
      interfaces: ['CanaryReleaseMonitorCheck', 'CanaryReleaseMonitorConfig', 'CanaryReleaseMonitorResult'],
      bk: 'canary_release_monitor', eks: ['cnrm.check_passed', 'cnrm.alert_raised', 'cnrm.export_emitted'],
      subjects: ['sven.cnrm.check_passed', 'sven.cnrm.alert_raised', 'sven.cnrm.export_emitted'],
      cases: ['cnrm_watcher', 'cnrm_alerter', 'cnrm_reporter'],
    },
    {
      name: 'canary_release_auditor', migration: '20260630320000_agent_canary_release_auditor.sql',
      typeFile: 'agent-canary-release-auditor.ts', skillDir: 'canary-release-auditor',
      interfaces: ['CanaryReleaseAuditEntry', 'CanaryReleaseAuditConfig', 'CanaryReleaseAuditResult'],
      bk: 'canary_release_auditor', eks: ['cnra.entry_logged', 'cnra.violation_found', 'cnra.export_emitted'],
      subjects: ['sven.cnra.entry_logged', 'sven.cnra.violation_found', 'sven.cnra.export_emitted'],
      cases: ['cnra_scanner', 'cnra_enforcer', 'cnra_reporter'],
    },
    {
      name: 'canary_release_reporter', migration: '20260630330000_agent_canary_release_reporter.sql',
      typeFile: 'agent-canary-release-reporter.ts', skillDir: 'canary-release-reporter',
      interfaces: ['CanaryReleaseReport', 'CanaryReleaseReportConfig', 'CanaryReleaseReportResult'],
      bk: 'canary_release_reporter', eks: ['cnrr.report_generated', 'cnrr.insight_found', 'cnrr.export_emitted'],
      subjects: ['sven.cnrr.report_generated', 'sven.cnrr.insight_found', 'sven.cnrr.export_emitted'],
      cases: ['cnrr_builder', 'cnrr_analyst', 'cnrr_reporter'],
    },
    {
      name: 'canary_release_optimizer', migration: '20260630340000_agent_canary_release_optimizer.sql',
      typeFile: 'agent-canary-release-optimizer.ts', skillDir: 'canary-release-optimizer',
      interfaces: ['CanaryReleaseOptPlan', 'CanaryReleaseOptConfig', 'CanaryReleaseOptResult'],
      bk: 'canary_release_optimizer', eks: ['cnro.plan_created', 'cnro.optimization_applied', 'cnro.export_emitted'],
      subjects: ['sven.cnro.plan_created', 'sven.cnro.optimization_applied', 'sven.cnro.export_emitted'],
      cases: ['cnro_planner', 'cnro_executor', 'cnro_reporter'],
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
