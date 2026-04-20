import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Resource Tagging management verticals', () => {
  const verticals = [
    {
      name: 'resource_tagging', migration: '20260629300000_agent_resource_tagging.sql',
      typeFile: 'agent-resource-tagging.ts', skillDir: 'resource-tagging',
      interfaces: ['ResourceTaggingRule', 'ResourceTaggingConfig', 'ResourceTaggingResult'],
      bk: 'resource_tagging', eks: ['rt.rule_created', 'rt.config_updated', 'rt.export_emitted'],
      subjects: ['sven.rt.rule_created', 'sven.rt.config_updated', 'sven.rt.export_emitted'],
      cases: ['rt_planner', 'rt_tagger', 'rt_reporter'],
    },
    {
      name: 'resource_tagging_monitor', migration: '20260629310000_agent_resource_tagging_monitor.sql',
      typeFile: 'agent-resource-tagging-monitor.ts', skillDir: 'resource-tagging-monitor',
      interfaces: ['ResourceTaggingMonitorCheck', 'ResourceTaggingMonitorConfig', 'ResourceTaggingMonitorResult'],
      bk: 'resource_tagging_monitor', eks: ['rtm.check_passed', 'rtm.alert_raised', 'rtm.export_emitted'],
      subjects: ['sven.rtm.check_passed', 'sven.rtm.alert_raised', 'sven.rtm.export_emitted'],
      cases: ['rtm_watcher', 'rtm_alerter', 'rtm_reporter'],
    },
    {
      name: 'resource_tagging_auditor', migration: '20260629320000_agent_resource_tagging_auditor.sql',
      typeFile: 'agent-resource-tagging-auditor.ts', skillDir: 'resource-tagging-auditor',
      interfaces: ['ResourceTaggingAuditEntry', 'ResourceTaggingAuditConfig', 'ResourceTaggingAuditResult'],
      bk: 'resource_tagging_auditor', eks: ['rta.entry_logged', 'rta.violation_found', 'rta.export_emitted'],
      subjects: ['sven.rta.entry_logged', 'sven.rta.violation_found', 'sven.rta.export_emitted'],
      cases: ['rta_scanner', 'rta_enforcer', 'rta_reporter'],
    },
    {
      name: 'resource_tagging_reporter', migration: '20260629330000_agent_resource_tagging_reporter.sql',
      typeFile: 'agent-resource-tagging-reporter.ts', skillDir: 'resource-tagging-reporter',
      interfaces: ['ResourceTaggingReport', 'ResourceTaggingReportConfig', 'ResourceTaggingReportResult'],
      bk: 'resource_tagging_reporter', eks: ['rtr.report_generated', 'rtr.insight_found', 'rtr.export_emitted'],
      subjects: ['sven.rtr.report_generated', 'sven.rtr.insight_found', 'sven.rtr.export_emitted'],
      cases: ['rtr_builder', 'rtr_analyst', 'rtr_reporter'],
    },
    {
      name: 'resource_tagging_optimizer', migration: '20260629340000_agent_resource_tagging_optimizer.sql',
      typeFile: 'agent-resource-tagging-optimizer.ts', skillDir: 'resource-tagging-optimizer',
      interfaces: ['ResourceTaggingOptPlan', 'ResourceTaggingOptConfig', 'ResourceTaggingOptResult'],
      bk: 'resource_tagging_optimizer', eks: ['rto.plan_created', 'rto.optimization_applied', 'rto.export_emitted'],
      subjects: ['sven.rto.plan_created', 'sven.rto.optimization_applied', 'sven.rto.export_emitted'],
      cases: ['rto_planner', 'rto_executor', 'rto_reporter'],
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
