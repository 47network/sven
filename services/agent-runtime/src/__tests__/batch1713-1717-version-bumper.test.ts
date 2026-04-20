import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Version Bumper verticals', () => {
  const verticals = [
    {
      name: 'version_bumper', migration: '20260633500000_agent_version_bumper.sql',
      typeFile: 'agent-version-bumper.ts', skillDir: 'version-bumper',
      interfaces: ['VersionBumperEntry', 'VersionBumperConfig', 'VersionBumperResult'],
      bk: 'version_bumper', eks: ['vb.entry_created', 'vb.config_updated', 'vb.export_emitted'],
      subjects: ['sven.vb.entry_created', 'sven.vb.config_updated', 'sven.vb.export_emitted'],
      cases: ['vb_parser', 'vb_incrementer', 'vb_reporter'],
    },
    {
      name: 'version_bumper_monitor', migration: '20260633510000_agent_version_bumper_monitor.sql',
      typeFile: 'agent-version-bumper-monitor.ts', skillDir: 'version-bumper-monitor',
      interfaces: ['VersionBumperMonitorCheck', 'VersionBumperMonitorConfig', 'VersionBumperMonitorResult'],
      bk: 'version_bumper_monitor', eks: ['vbm.check_passed', 'vbm.alert_raised', 'vbm.export_emitted'],
      subjects: ['sven.vbm.check_passed', 'sven.vbm.alert_raised', 'sven.vbm.export_emitted'],
      cases: ['vbm_watcher', 'vbm_alerter', 'vbm_reporter'],
    },
    {
      name: 'version_bumper_auditor', migration: '20260633520000_agent_version_bumper_auditor.sql',
      typeFile: 'agent-version-bumper-auditor.ts', skillDir: 'version-bumper-auditor',
      interfaces: ['VersionBumperAuditEntry', 'VersionBumperAuditConfig', 'VersionBumperAuditResult'],
      bk: 'version_bumper_auditor', eks: ['vba.entry_logged', 'vba.violation_found', 'vba.export_emitted'],
      subjects: ['sven.vba.entry_logged', 'sven.vba.violation_found', 'sven.vba.export_emitted'],
      cases: ['vba_scanner', 'vba_enforcer', 'vba_reporter'],
    },
    {
      name: 'version_bumper_reporter', migration: '20260633530000_agent_version_bumper_reporter.sql',
      typeFile: 'agent-version-bumper-reporter.ts', skillDir: 'version-bumper-reporter',
      interfaces: ['VersionBumperReport', 'VersionBumperReportConfig', 'VersionBumperReportResult'],
      bk: 'version_bumper_reporter', eks: ['vbr.report_generated', 'vbr.insight_found', 'vbr.export_emitted'],
      subjects: ['sven.vbr.report_generated', 'sven.vbr.insight_found', 'sven.vbr.export_emitted'],
      cases: ['vbr_builder', 'vbr_analyst', 'vbr_reporter'],
    },
    {
      name: 'version_bumper_optimizer', migration: '20260633540000_agent_version_bumper_optimizer.sql',
      typeFile: 'agent-version-bumper-optimizer.ts', skillDir: 'version-bumper-optimizer',
      interfaces: ['VersionBumperOptPlan', 'VersionBumperOptConfig', 'VersionBumperOptResult'],
      bk: 'version_bumper_optimizer', eks: ['vbo.plan_created', 'vbo.optimization_applied', 'vbo.export_emitted'],
      subjects: ['sven.vbo.plan_created', 'sven.vbo.optimization_applied', 'sven.vbo.export_emitted'],
      cases: ['vbo_planner', 'vbo_executor', 'vbo_reporter'],
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
