import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Storage Broker verticals', () => {
  const verticals = [
    {
      name: 'storage_broker', migration: '20260630950000_agent_storage_broker.sql',
      typeFile: 'agent-storage-broker.ts', skillDir: 'storage-broker',
      interfaces: ['StorageBrokerEntry', 'StorageBrokerConfig', 'StorageBrokerResult'],
      bk: 'storage_broker', eks: ['sb.entry_created', 'sb.config_updated', 'sb.export_emitted'],
      subjects: ['sven.sb.entry_created', 'sven.sb.config_updated', 'sven.sb.export_emitted'],
      cases: ['sb_provisioner', 'sb_allocator', 'sb_reporter'],
    },
    {
      name: 'storage_broker_monitor', migration: '20260630960000_agent_storage_broker_monitor.sql',
      typeFile: 'agent-storage-broker-monitor.ts', skillDir: 'storage-broker-monitor',
      interfaces: ['StorageBrokerMonitorCheck', 'StorageBrokerMonitorConfig', 'StorageBrokerMonitorResult'],
      bk: 'storage_broker_monitor', eks: ['sbm.check_passed', 'sbm.alert_raised', 'sbm.export_emitted'],
      subjects: ['sven.sbm.check_passed', 'sven.sbm.alert_raised', 'sven.sbm.export_emitted'],
      cases: ['sbm_watcher', 'sbm_alerter', 'sbm_reporter'],
    },
    {
      name: 'storage_broker_auditor', migration: '20260630970000_agent_storage_broker_auditor.sql',
      typeFile: 'agent-storage-broker-auditor.ts', skillDir: 'storage-broker-auditor',
      interfaces: ['StorageBrokerAuditEntry', 'StorageBrokerAuditConfig', 'StorageBrokerAuditResult'],
      bk: 'storage_broker_auditor', eks: ['sba.entry_logged', 'sba.violation_found', 'sba.export_emitted'],
      subjects: ['sven.sba.entry_logged', 'sven.sba.violation_found', 'sven.sba.export_emitted'],
      cases: ['sba_scanner', 'sba_enforcer', 'sba_reporter'],
    },
    {
      name: 'storage_broker_reporter', migration: '20260630980000_agent_storage_broker_reporter.sql',
      typeFile: 'agent-storage-broker-reporter.ts', skillDir: 'storage-broker-reporter',
      interfaces: ['StorageBrokerReport', 'StorageBrokerReportConfig', 'StorageBrokerReportResult'],
      bk: 'storage_broker_reporter', eks: ['sbr.report_generated', 'sbr.insight_found', 'sbr.export_emitted'],
      subjects: ['sven.sbr.report_generated', 'sven.sbr.insight_found', 'sven.sbr.export_emitted'],
      cases: ['sbr_builder', 'sbr_analyst', 'sbr_reporter'],
    },
    {
      name: 'storage_broker_optimizer', migration: '20260630990000_agent_storage_broker_optimizer.sql',
      typeFile: 'agent-storage-broker-optimizer.ts', skillDir: 'storage-broker-optimizer',
      interfaces: ['StorageBrokerOptPlan', 'StorageBrokerOptConfig', 'StorageBrokerOptResult'],
      bk: 'storage_broker_optimizer', eks: ['sbo.plan_created', 'sbo.optimization_applied', 'sbo.export_emitted'],
      subjects: ['sven.sbo.plan_created', 'sven.sbo.optimization_applied', 'sven.sbo.export_emitted'],
      cases: ['sbo_planner', 'sbo_executor', 'sbo_reporter'],
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
