import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Connection Pool verticals', () => {
  const verticals = [
    {
      name: 'conn_pool', migration: '20260631300000_agent_conn_pool.sql',
      typeFile: 'agent-conn-pool.ts', skillDir: 'conn-pool',
      interfaces: ['ConnPoolEntry', 'ConnPoolConfig', 'ConnPoolResult'],
      bk: 'conn_pool', eks: ['cpl.entry_created', 'cpl.config_updated', 'cpl.export_emitted'],
      subjects: ['sven.cpl.entry_created', 'sven.cpl.config_updated', 'sven.cpl.export_emitted'],
      cases: ['cpl_manager', 'cpl_balancer', 'cpl_reporter'],
    },
    {
      name: 'conn_pool_monitor', migration: '20260631310000_agent_conn_pool_monitor.sql',
      typeFile: 'agent-conn-pool-monitor.ts', skillDir: 'conn-pool-monitor',
      interfaces: ['ConnPoolMonitorCheck', 'ConnPoolMonitorConfig', 'ConnPoolMonitorResult'],
      bk: 'conn_pool_monitor', eks: ['cplm.check_passed', 'cplm.alert_raised', 'cplm.export_emitted'],
      subjects: ['sven.cplm.check_passed', 'sven.cplm.alert_raised', 'sven.cplm.export_emitted'],
      cases: ['cplm_watcher', 'cplm_alerter', 'cplm_reporter'],
    },
    {
      name: 'conn_pool_auditor', migration: '20260631320000_agent_conn_pool_auditor.sql',
      typeFile: 'agent-conn-pool-auditor.ts', skillDir: 'conn-pool-auditor',
      interfaces: ['ConnPoolAuditEntry', 'ConnPoolAuditConfig', 'ConnPoolAuditResult'],
      bk: 'conn_pool_auditor', eks: ['cpla.entry_logged', 'cpla.violation_found', 'cpla.export_emitted'],
      subjects: ['sven.cpla.entry_logged', 'sven.cpla.violation_found', 'sven.cpla.export_emitted'],
      cases: ['cpla_scanner', 'cpla_enforcer', 'cpla_reporter'],
    },
    {
      name: 'conn_pool_reporter', migration: '20260631330000_agent_conn_pool_reporter.sql',
      typeFile: 'agent-conn-pool-reporter.ts', skillDir: 'conn-pool-reporter',
      interfaces: ['ConnPoolReport', 'ConnPoolReportConfig', 'ConnPoolReportResult'],
      bk: 'conn_pool_reporter', eks: ['cplr.report_generated', 'cplr.insight_found', 'cplr.export_emitted'],
      subjects: ['sven.cplr.report_generated', 'sven.cplr.insight_found', 'sven.cplr.export_emitted'],
      cases: ['cplr_builder', 'cplr_analyst', 'cplr_reporter'],
    },
    {
      name: 'conn_pool_optimizer', migration: '20260631340000_agent_conn_pool_optimizer.sql',
      typeFile: 'agent-conn-pool-optimizer.ts', skillDir: 'conn-pool-optimizer',
      interfaces: ['ConnPoolOptPlan', 'ConnPoolOptConfig', 'ConnPoolOptResult'],
      bk: 'conn_pool_optimizer', eks: ['cplo.plan_created', 'cplo.optimization_applied', 'cplo.export_emitted'],
      subjects: ['sven.cplo.plan_created', 'sven.cplo.optimization_applied', 'sven.cplo.export_emitted'],
      cases: ['cplo_planner', 'cplo_executor', 'cplo_reporter'],
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
