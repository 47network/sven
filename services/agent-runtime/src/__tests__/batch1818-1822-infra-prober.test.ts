import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Infra Prober verticals', () => {
  const verticals = [
    {
      name: 'infra_prober', migration: '20260634550000_agent_infra_prober.sql',
      typeFile: 'agent-infra-prober.ts', skillDir: 'infra-prober',
      interfaces: ['InfraProberEntry', 'InfraProberConfig', 'InfraProberResult'],
      bk: 'infra_prober', eks: ['ip.entry_created', 'ip.config_updated', 'ip.export_emitted'],
      subjects: ['sven.ip.entry_created', 'sven.ip.config_updated', 'sven.ip.export_emitted'],
      cases: ['ip_scanner', 'ip_mapper', 'ip_reporter'],
    },
    {
      name: 'infra_prober_monitor', migration: '20260634560000_agent_infra_prober_monitor.sql',
      typeFile: 'agent-infra-prober-monitor.ts', skillDir: 'infra-prober-monitor',
      interfaces: ['InfraProberMonitorCheck', 'InfraProberMonitorConfig', 'InfraProberMonitorResult'],
      bk: 'infra_prober_monitor', eks: ['ipm.check_passed', 'ipm.alert_raised', 'ipm.export_emitted'],
      subjects: ['sven.ipm.check_passed', 'sven.ipm.alert_raised', 'sven.ipm.export_emitted'],
      cases: ['ipm_watcher', 'ipm_alerter', 'ipm_reporter'],
    },
    {
      name: 'infra_prober_auditor', migration: '20260634570000_agent_infra_prober_auditor.sql',
      typeFile: 'agent-infra-prober-auditor.ts', skillDir: 'infra-prober-auditor',
      interfaces: ['InfraProberAuditEntry', 'InfraProberAuditConfig', 'InfraProberAuditResult'],
      bk: 'infra_prober_auditor', eks: ['ipa.entry_logged', 'ipa.violation_found', 'ipa.export_emitted'],
      subjects: ['sven.ipa.entry_logged', 'sven.ipa.violation_found', 'sven.ipa.export_emitted'],
      cases: ['ipa_scanner', 'ipa_enforcer', 'ipa_reporter'],
    },
    {
      name: 'infra_prober_reporter', migration: '20260634580000_agent_infra_prober_reporter.sql',
      typeFile: 'agent-infra-prober-reporter.ts', skillDir: 'infra-prober-reporter',
      interfaces: ['InfraProberReport', 'InfraProberReportConfig', 'InfraProberReportResult'],
      bk: 'infra_prober_reporter', eks: ['ipr.report_generated', 'ipr.insight_found', 'ipr.export_emitted'],
      subjects: ['sven.ipr.report_generated', 'sven.ipr.insight_found', 'sven.ipr.export_emitted'],
      cases: ['ipr_builder', 'ipr_analyst', 'ipr_reporter'],
    },
    {
      name: 'infra_prober_optimizer', migration: '20260634590000_agent_infra_prober_optimizer.sql',
      typeFile: 'agent-infra-prober-optimizer.ts', skillDir: 'infra-prober-optimizer',
      interfaces: ['InfraProberOptPlan', 'InfraProberOptConfig', 'InfraProberOptResult'],
      bk: 'infra_prober_optimizer', eks: ['ipo.plan_created', 'ipo.optimization_applied', 'ipo.export_emitted'],
      subjects: ['sven.ipo.plan_created', 'sven.ipo.optimization_applied', 'sven.ipo.export_emitted'],
      cases: ['ipo_planner', 'ipo_executor', 'ipo_reporter'],
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
