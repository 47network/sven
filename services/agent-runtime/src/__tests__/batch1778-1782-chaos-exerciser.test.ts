import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Chaos Exerciser verticals', () => {
  const verticals = [
    {
      name: 'chaos_exerciser', migration: '20260634150000_agent_chaos_exerciser.sql',
      typeFile: 'agent-chaos-exerciser.ts', skillDir: 'chaos-exerciser',
      interfaces: ['ChaosExerciserEntry', 'ChaosExerciserConfig', 'ChaosExerciserResult'],
      bk: 'chaos_exerciser', eks: ['cex.entry_created', 'cex.config_updated', 'cex.export_emitted'],
      subjects: ['sven.cex.entry_created', 'sven.cex.config_updated', 'sven.cex.export_emitted'],
      cases: ['cex_injector', 'cex_observer', 'cex_reporter'],
    },
    {
      name: 'chaos_exerciser_monitor', migration: '20260634160000_agent_chaos_exerciser_monitor.sql',
      typeFile: 'agent-chaos-exerciser-monitor.ts', skillDir: 'chaos-exerciser-monitor',
      interfaces: ['ChaosExerciserMonitorCheck', 'ChaosExerciserMonitorConfig', 'ChaosExerciserMonitorResult'],
      bk: 'chaos_exerciser_monitor', eks: ['cexm.check_passed', 'cexm.alert_raised', 'cexm.export_emitted'],
      subjects: ['sven.cexm.check_passed', 'sven.cexm.alert_raised', 'sven.cexm.export_emitted'],
      cases: ['cexm_watcher', 'cexm_alerter', 'cexm_reporter'],
    },
    {
      name: 'chaos_exerciser_auditor', migration: '20260634170000_agent_chaos_exerciser_auditor.sql',
      typeFile: 'agent-chaos-exerciser-auditor.ts', skillDir: 'chaos-exerciser-auditor',
      interfaces: ['ChaosExerciserAuditEntry', 'ChaosExerciserAuditConfig', 'ChaosExerciserAuditResult'],
      bk: 'chaos_exerciser_auditor', eks: ['cexa.entry_logged', 'cexa.violation_found', 'cexa.export_emitted'],
      subjects: ['sven.cexa.entry_logged', 'sven.cexa.violation_found', 'sven.cexa.export_emitted'],
      cases: ['cexa_scanner', 'cexa_enforcer', 'cexa_reporter'],
    },
    {
      name: 'chaos_exerciser_reporter', migration: '20260634180000_agent_chaos_exerciser_reporter.sql',
      typeFile: 'agent-chaos-exerciser-reporter.ts', skillDir: 'chaos-exerciser-reporter',
      interfaces: ['ChaosExerciserReport', 'ChaosExerciserReportConfig', 'ChaosExerciserReportResult'],
      bk: 'chaos_exerciser_reporter', eks: ['cexr.report_generated', 'cexr.insight_found', 'cexr.export_emitted'],
      subjects: ['sven.cexr.report_generated', 'sven.cexr.insight_found', 'sven.cexr.export_emitted'],
      cases: ['cexr_builder', 'cexr_analyst', 'cexr_reporter'],
    },
    {
      name: 'chaos_exerciser_optimizer', migration: '20260634190000_agent_chaos_exerciser_optimizer.sql',
      typeFile: 'agent-chaos-exerciser-optimizer.ts', skillDir: 'chaos-exerciser-optimizer',
      interfaces: ['ChaosExerciserOptPlan', 'ChaosExerciserOptConfig', 'ChaosExerciserOptResult'],
      bk: 'chaos_exerciser_optimizer', eks: ['cexo.plan_created', 'cexo.optimization_applied', 'cexo.export_emitted'],
      subjects: ['sven.cexo.plan_created', 'sven.cexo.optimization_applied', 'sven.cexo.export_emitted'],
      cases: ['cexo_planner', 'cexo_executor', 'cexo_reporter'],
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
