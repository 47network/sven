import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Rollback Engine verticals', () => {
  const verticals = [
    {
      name: 'rollback_engine', migration: '20260634350000_agent_rollback_engine.sql',
      typeFile: 'agent-rollback-engine.ts', skillDir: 'rollback-engine',
      interfaces: ['RollbackEngineEntry', 'RollbackEngineConfig', 'RollbackEngineResult'],
      bk: 'rollback_engine', eks: ['re.entry_created', 're.config_updated', 're.export_emitted'],
      subjects: ['sven.re.entry_created', 'sven.re.config_updated', 'sven.re.export_emitted'],
      cases: ['re_detector', 're_executor', 're_reporter'],
    },
    {
      name: 'rollback_engine_monitor', migration: '20260634360000_agent_rollback_engine_monitor.sql',
      typeFile: 'agent-rollback-engine-monitor.ts', skillDir: 'rollback-engine-monitor',
      interfaces: ['RollbackEngineMonitorCheck', 'RollbackEngineMonitorConfig', 'RollbackEngineMonitorResult'],
      bk: 'rollback_engine_monitor', eks: ['rem.check_passed', 'rem.alert_raised', 'rem.export_emitted'],
      subjects: ['sven.rem.check_passed', 'sven.rem.alert_raised', 'sven.rem.export_emitted'],
      cases: ['rem_watcher', 'rem_alerter', 'rem_reporter'],
    },
    {
      name: 'rollback_engine_auditor', migration: '20260634370000_agent_rollback_engine_auditor.sql',
      typeFile: 'agent-rollback-engine-auditor.ts', skillDir: 'rollback-engine-auditor',
      interfaces: ['RollbackEngineAuditEntry', 'RollbackEngineAuditConfig', 'RollbackEngineAuditResult'],
      bk: 'rollback_engine_auditor', eks: ['rea.entry_logged', 'rea.violation_found', 'rea.export_emitted'],
      subjects: ['sven.rea.entry_logged', 'sven.rea.violation_found', 'sven.rea.export_emitted'],
      cases: ['rea_scanner', 'rea_enforcer', 'rea_reporter'],
    },
    {
      name: 'rollback_engine_reporter', migration: '20260634380000_agent_rollback_engine_reporter.sql',
      typeFile: 'agent-rollback-engine-reporter.ts', skillDir: 'rollback-engine-reporter',
      interfaces: ['RollbackEngineReport', 'RollbackEngineReportConfig', 'RollbackEngineReportResult'],
      bk: 'rollback_engine_reporter', eks: ['rer.report_generated', 'rer.insight_found', 'rer.export_emitted'],
      subjects: ['sven.rer.report_generated', 'sven.rer.insight_found', 'sven.rer.export_emitted'],
      cases: ['rer_builder', 'rer_analyst', 'rer_reporter'],
    },
    {
      name: 'rollback_engine_optimizer', migration: '20260634390000_agent_rollback_engine_optimizer.sql',
      typeFile: 'agent-rollback-engine-optimizer.ts', skillDir: 'rollback-engine-optimizer',
      interfaces: ['RollbackEngineOptPlan', 'RollbackEngineOptConfig', 'RollbackEngineOptResult'],
      bk: 'rollback_engine_optimizer', eks: ['reo.plan_created', 'reo.optimization_applied', 'reo.export_emitted'],
      subjects: ['sven.reo.plan_created', 'sven.reo.optimization_applied', 'sven.reo.export_emitted'],
      cases: ['reo_planner', 'reo_executor', 'reo_reporter'],
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
