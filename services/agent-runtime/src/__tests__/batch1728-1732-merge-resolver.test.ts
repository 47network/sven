import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Merge Resolver verticals', () => {
  const verticals = [
    {
      name: 'merge_resolver', migration: '20260633650000_agent_merge_resolver.sql',
      typeFile: 'agent-merge-resolver.ts', skillDir: 'merge-resolver',
      interfaces: ['MergeResolverEntry', 'MergeResolverConfig', 'MergeResolverResult'],
      bk: 'merge_resolver', eks: ['mr.entry_created', 'mr.config_updated', 'mr.export_emitted'],
      subjects: ['sven.mr.entry_created', 'sven.mr.config_updated', 'sven.mr.export_emitted'],
      cases: ['mr_detector', 'mr_resolver', 'mr_reporter'],
    },
    {
      name: 'merge_resolver_monitor', migration: '20260633660000_agent_merge_resolver_monitor.sql',
      typeFile: 'agent-merge-resolver-monitor.ts', skillDir: 'merge-resolver-monitor',
      interfaces: ['MergeResolverMonitorCheck', 'MergeResolverMonitorConfig', 'MergeResolverMonitorResult'],
      bk: 'merge_resolver_monitor', eks: ['mrm.check_passed', 'mrm.alert_raised', 'mrm.export_emitted'],
      subjects: ['sven.mrm.check_passed', 'sven.mrm.alert_raised', 'sven.mrm.export_emitted'],
      cases: ['mrm_watcher', 'mrm_alerter', 'mrm_reporter'],
    },
    {
      name: 'merge_resolver_auditor', migration: '20260633670000_agent_merge_resolver_auditor.sql',
      typeFile: 'agent-merge-resolver-auditor.ts', skillDir: 'merge-resolver-auditor',
      interfaces: ['MergeResolverAuditEntry', 'MergeResolverAuditConfig', 'MergeResolverAuditResult'],
      bk: 'merge_resolver_auditor', eks: ['mra.entry_logged', 'mra.violation_found', 'mra.export_emitted'],
      subjects: ['sven.mra.entry_logged', 'sven.mra.violation_found', 'sven.mra.export_emitted'],
      cases: ['mra_scanner', 'mra_enforcer', 'mra_reporter'],
    },
    {
      name: 'merge_resolver_reporter', migration: '20260633680000_agent_merge_resolver_reporter.sql',
      typeFile: 'agent-merge-resolver-reporter.ts', skillDir: 'merge-resolver-reporter',
      interfaces: ['MergeResolverReport', 'MergeResolverReportConfig', 'MergeResolverReportResult'],
      bk: 'merge_resolver_reporter', eks: ['mrr.report_generated', 'mrr.insight_found', 'mrr.export_emitted'],
      subjects: ['sven.mrr.report_generated', 'sven.mrr.insight_found', 'sven.mrr.export_emitted'],
      cases: ['mrr_builder', 'mrr_analyst', 'mrr_reporter'],
    },
    {
      name: 'merge_resolver_optimizer', migration: '20260633690000_agent_merge_resolver_optimizer.sql',
      typeFile: 'agent-merge-resolver-optimizer.ts', skillDir: 'merge-resolver-optimizer',
      interfaces: ['MergeResolverOptPlan', 'MergeResolverOptConfig', 'MergeResolverOptResult'],
      bk: 'merge_resolver_optimizer', eks: ['mro.plan_created', 'mro.optimization_applied', 'mro.export_emitted'],
      subjects: ['sven.mro.plan_created', 'sven.mro.optimization_applied', 'sven.mro.export_emitted'],
      cases: ['mro_planner', 'mro_executor', 'mro_reporter'],
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
