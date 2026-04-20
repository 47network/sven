import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Release Gating verticals', () => {
  const verticals = [
    {
      name: 'release_gating', migration: '20260630250000_agent_release_gating.sql',
      typeFile: 'agent-release-gating.ts', skillDir: 'release-gating',
      interfaces: ['ReleaseGatingEntry', 'ReleaseGatingConfig', 'ReleaseGatingResult'],
      bk: 'release_gating', eks: ['rg.entry_created', 'rg.config_updated', 'rg.export_emitted'],
      subjects: ['sven.rg.entry_created', 'sven.rg.config_updated', 'sven.rg.export_emitted'],
      cases: ['rg_evaluator', 'rg_enforcer', 'rg_reporter'],
    },
    {
      name: 'release_gating_monitor', migration: '20260630260000_agent_release_gating_monitor.sql',
      typeFile: 'agent-release-gating-monitor.ts', skillDir: 'release-gating-monitor',
      interfaces: ['ReleaseGatingMonitorCheck', 'ReleaseGatingMonitorConfig', 'ReleaseGatingMonitorResult'],
      bk: 'release_gating_monitor', eks: ['rgm.check_passed', 'rgm.alert_raised', 'rgm.export_emitted'],
      subjects: ['sven.rgm.check_passed', 'sven.rgm.alert_raised', 'sven.rgm.export_emitted'],
      cases: ['rgm_watcher', 'rgm_alerter', 'rgm_reporter'],
    },
    {
      name: 'release_gating_auditor', migration: '20260630270000_agent_release_gating_auditor.sql',
      typeFile: 'agent-release-gating-auditor.ts', skillDir: 'release-gating-auditor',
      interfaces: ['ReleaseGatingAuditEntry', 'ReleaseGatingAuditConfig', 'ReleaseGatingAuditResult'],
      bk: 'release_gating_auditor', eks: ['rga.entry_logged', 'rga.violation_found', 'rga.export_emitted'],
      subjects: ['sven.rga.entry_logged', 'sven.rga.violation_found', 'sven.rga.export_emitted'],
      cases: ['rga_scanner', 'rga_enforcer', 'rga_reporter'],
    },
    {
      name: 'release_gating_reporter', migration: '20260630280000_agent_release_gating_reporter.sql',
      typeFile: 'agent-release-gating-reporter.ts', skillDir: 'release-gating-reporter',
      interfaces: ['ReleaseGatingReport', 'ReleaseGatingReportConfig', 'ReleaseGatingReportResult'],
      bk: 'release_gating_reporter', eks: ['rgr.report_generated', 'rgr.insight_found', 'rgr.export_emitted'],
      subjects: ['sven.rgr.report_generated', 'sven.rgr.insight_found', 'sven.rgr.export_emitted'],
      cases: ['rgr_builder', 'rgr_analyst', 'rgr_reporter'],
    },
    {
      name: 'release_gating_optimizer', migration: '20260630290000_agent_release_gating_optimizer.sql',
      typeFile: 'agent-release-gating-optimizer.ts', skillDir: 'release-gating-optimizer',
      interfaces: ['ReleaseGatingOptPlan', 'ReleaseGatingOptConfig', 'ReleaseGatingOptResult'],
      bk: 'release_gating_optimizer', eks: ['rgo.plan_created', 'rgo.optimization_applied', 'rgo.export_emitted'],
      subjects: ['sven.rgo.plan_created', 'sven.rgo.optimization_applied', 'sven.rgo.export_emitted'],
      cases: ['rgo_planner', 'rgo_executor', 'rgo_reporter'],
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
