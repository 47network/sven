import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Cache Primer verticals', () => {
  const verticals = [
    {
      name: 'cache_primer', migration: '20260631100000_agent_cache_primer.sql',
      typeFile: 'agent-cache-primer.ts', skillDir: 'cache-primer',
      interfaces: ['CachePrimerEntry', 'CachePrimerConfig', 'CachePrimerResult'],
      bk: 'cache_primer', eks: ['cp.entry_created', 'cp.config_updated', 'cp.export_emitted'],
      subjects: ['sven.cp.entry_created', 'sven.cp.config_updated', 'sven.cp.export_emitted'],
      cases: ['cp_warmer', 'cp_validator', 'cp_reporter'],
    },
    {
      name: 'cache_primer_monitor', migration: '20260631110000_agent_cache_primer_monitor.sql',
      typeFile: 'agent-cache-primer-monitor.ts', skillDir: 'cache-primer-monitor',
      interfaces: ['CachePrimerMonitorCheck', 'CachePrimerMonitorConfig', 'CachePrimerMonitorResult'],
      bk: 'cache_primer_monitor', eks: ['cpm.check_passed', 'cpm.alert_raised', 'cpm.export_emitted'],
      subjects: ['sven.cpm.check_passed', 'sven.cpm.alert_raised', 'sven.cpm.export_emitted'],
      cases: ['cpm_watcher', 'cpm_alerter', 'cpm_reporter'],
    },
    {
      name: 'cache_primer_auditor', migration: '20260631120000_agent_cache_primer_auditor.sql',
      typeFile: 'agent-cache-primer-auditor.ts', skillDir: 'cache-primer-auditor',
      interfaces: ['CachePrimerAuditEntry', 'CachePrimerAuditConfig', 'CachePrimerAuditResult'],
      bk: 'cache_primer_auditor', eks: ['cpa.entry_logged', 'cpa.violation_found', 'cpa.export_emitted'],
      subjects: ['sven.cpa.entry_logged', 'sven.cpa.violation_found', 'sven.cpa.export_emitted'],
      cases: ['cpa_scanner', 'cpa_enforcer', 'cpa_reporter'],
    },
    {
      name: 'cache_primer_reporter', migration: '20260631130000_agent_cache_primer_reporter.sql',
      typeFile: 'agent-cache-primer-reporter.ts', skillDir: 'cache-primer-reporter',
      interfaces: ['CachePrimerReport', 'CachePrimerReportConfig', 'CachePrimerReportResult'],
      bk: 'cache_primer_reporter', eks: ['cpr.report_generated', 'cpr.insight_found', 'cpr.export_emitted'],
      subjects: ['sven.cpr.report_generated', 'sven.cpr.insight_found', 'sven.cpr.export_emitted'],
      cases: ['cpr_builder', 'cpr_analyst', 'cpr_reporter'],
    },
    {
      name: 'cache_primer_optimizer', migration: '20260631140000_agent_cache_primer_optimizer.sql',
      typeFile: 'agent-cache-primer-optimizer.ts', skillDir: 'cache-primer-optimizer',
      interfaces: ['CachePrimerOptPlan', 'CachePrimerOptConfig', 'CachePrimerOptResult'],
      bk: 'cache_primer_optimizer', eks: ['cpo.plan_created', 'cpo.optimization_applied', 'cpo.export_emitted'],
      subjects: ['sven.cpo.plan_created', 'sven.cpo.optimization_applied', 'sven.cpo.export_emitted'],
      cases: ['cpo_planner', 'cpo_executor', 'cpo_reporter'],
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
