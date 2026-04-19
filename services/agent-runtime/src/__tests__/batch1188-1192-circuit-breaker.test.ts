import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Circuit Breaker management verticals', () => {
  const verticals = [
    {
      name: 'circuit_breaker', migration: '20260628250000_agent_circuit_breaker.sql',
      typeFile: 'agent-circuit-breaker.ts', skillDir: 'circuit-breaker',
      interfaces: ['CircuitBreakerRule', 'CircuitBreakerConfig', 'CircuitBreakerResult'],
      bk: 'circuit_breaker', eks: ['cb.rule_created', 'cb.config_updated', 'cb.export_emitted'],
      subjects: ['sven.cb.rule_created', 'sven.cb.config_updated', 'sven.cb.export_emitted'],
      cases: ['cb_planner', 'cb_enforcer', 'cb_reporter'],
    },
    {
      name: 'circuit_breaker_monitor', migration: '20260628260000_agent_circuit_breaker_monitor.sql',
      typeFile: 'agent-circuit-breaker-monitor.ts', skillDir: 'circuit-breaker-monitor',
      interfaces: ['CircuitBreakerMonitorCheck', 'CircuitBreakerMonitorConfig', 'CircuitBreakerMonitorResult'],
      bk: 'circuit_breaker_monitor', eks: ['cbm.check_passed', 'cbm.alert_raised', 'cbm.export_emitted'],
      subjects: ['sven.cbm.check_passed', 'sven.cbm.alert_raised', 'sven.cbm.export_emitted'],
      cases: ['cbm_watcher', 'cbm_alerter', 'cbm_reporter'],
    },
    {
      name: 'circuit_breaker_auditor', migration: '20260628270000_agent_circuit_breaker_auditor.sql',
      typeFile: 'agent-circuit-breaker-auditor.ts', skillDir: 'circuit-breaker-auditor',
      interfaces: ['CircuitBreakerAuditEntry', 'CircuitBreakerAuditConfig', 'CircuitBreakerAuditResult'],
      bk: 'circuit_breaker_auditor', eks: ['cba.entry_logged', 'cba.violation_found', 'cba.export_emitted'],
      subjects: ['sven.cba.entry_logged', 'sven.cba.violation_found', 'sven.cba.export_emitted'],
      cases: ['cba_scanner', 'cba_enforcer', 'cba_reporter'],
    },
    {
      name: 'circuit_breaker_reporter', migration: '20260628280000_agent_circuit_breaker_reporter.sql',
      typeFile: 'agent-circuit-breaker-reporter.ts', skillDir: 'circuit-breaker-reporter',
      interfaces: ['CircuitBreakerReport', 'CircuitBreakerReportConfig', 'CircuitBreakerReportResult'],
      bk: 'circuit_breaker_reporter', eks: ['cbr.report_generated', 'cbr.insight_found', 'cbr.export_emitted'],
      subjects: ['sven.cbr.report_generated', 'sven.cbr.insight_found', 'sven.cbr.export_emitted'],
      cases: ['cbr_builder', 'cbr_analyst', 'cbr_reporter'],
    },
    {
      name: 'circuit_breaker_optimizer', migration: '20260628290000_agent_circuit_breaker_optimizer.sql',
      typeFile: 'agent-circuit-breaker-optimizer.ts', skillDir: 'circuit-breaker-optimizer',
      interfaces: ['CircuitBreakerOptPlan', 'CircuitBreakerOptConfig', 'CircuitBreakerOptResult'],
      bk: 'circuit_breaker_optimizer', eks: ['cbo.plan_created', 'cbo.optimization_applied', 'cbo.export_emitted'],
      subjects: ['sven.cbo.plan_created', 'sven.cbo.optimization_applied', 'sven.cbo.export_emitted'],
      cases: ['cbo_planner', 'cbo_executor', 'cbo_reporter'],
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
