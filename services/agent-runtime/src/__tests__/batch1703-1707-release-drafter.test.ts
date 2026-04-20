import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Release Drafter verticals', () => {
  const verticals = [
    {
      name: 'release_drafter', migration: '20260633400000_agent_release_drafter.sql',
      typeFile: 'agent-release-drafter.ts', skillDir: 'release-drafter',
      interfaces: ['ReleaseDrafterEntry', 'ReleaseDrafterConfig', 'ReleaseDrafterResult'],
      bk: 'release_drafter', eks: ['rd.entry_created', 'rd.config_updated', 'rd.export_emitted'],
      subjects: ['sven.rd.entry_created', 'sven.rd.config_updated', 'sven.rd.export_emitted'],
      cases: ['rd_collector', 'rd_formatter', 'rd_reporter'],
    },
    {
      name: 'release_drafter_monitor', migration: '20260633410000_agent_release_drafter_monitor.sql',
      typeFile: 'agent-release-drafter-monitor.ts', skillDir: 'release-drafter-monitor',
      interfaces: ['ReleaseDrafterMonitorCheck', 'ReleaseDrafterMonitorConfig', 'ReleaseDrafterMonitorResult'],
      bk: 'release_drafter_monitor', eks: ['rdm.check_passed', 'rdm.alert_raised', 'rdm.export_emitted'],
      subjects: ['sven.rdm.check_passed', 'sven.rdm.alert_raised', 'sven.rdm.export_emitted'],
      cases: ['rdm_watcher', 'rdm_alerter', 'rdm_reporter'],
    },
    {
      name: 'release_drafter_auditor', migration: '20260633420000_agent_release_drafter_auditor.sql',
      typeFile: 'agent-release-drafter-auditor.ts', skillDir: 'release-drafter-auditor',
      interfaces: ['ReleaseDrafterAuditEntry', 'ReleaseDrafterAuditConfig', 'ReleaseDrafterAuditResult'],
      bk: 'release_drafter_auditor', eks: ['rda.entry_logged', 'rda.violation_found', 'rda.export_emitted'],
      subjects: ['sven.rda.entry_logged', 'sven.rda.violation_found', 'sven.rda.export_emitted'],
      cases: ['rda_scanner', 'rda_enforcer', 'rda_reporter'],
    },
    {
      name: 'release_drafter_reporter', migration: '20260633430000_agent_release_drafter_reporter.sql',
      typeFile: 'agent-release-drafter-reporter.ts', skillDir: 'release-drafter-reporter',
      interfaces: ['ReleaseDrafterReport', 'ReleaseDrafterReportConfig', 'ReleaseDrafterReportResult'],
      bk: 'release_drafter_reporter', eks: ['rdr.report_generated', 'rdr.insight_found', 'rdr.export_emitted'],
      subjects: ['sven.rdr.report_generated', 'sven.rdr.insight_found', 'sven.rdr.export_emitted'],
      cases: ['rdr_builder', 'rdr_analyst', 'rdr_reporter'],
    },
    {
      name: 'release_drafter_optimizer', migration: '20260633440000_agent_release_drafter_optimizer.sql',
      typeFile: 'agent-release-drafter-optimizer.ts', skillDir: 'release-drafter-optimizer',
      interfaces: ['ReleaseDrafterOptPlan', 'ReleaseDrafterOptConfig', 'ReleaseDrafterOptResult'],
      bk: 'release_drafter_optimizer', eks: ['rdo.plan_created', 'rdo.optimization_applied', 'rdo.export_emitted'],
      subjects: ['sven.rdo.plan_created', 'sven.rdo.optimization_applied', 'sven.rdo.export_emitted'],
      cases: ['rdo_planner', 'rdo_executor', 'rdo_reporter'],
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
