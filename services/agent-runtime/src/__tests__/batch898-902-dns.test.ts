import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 898-902: DNS Operations', () => {
  const verticals = [
    {
      name: 'dns_zone_synchronizer', migration: '20260625350000_agent_dns_zone_synchronizer.sql',
      typeFile: 'agent-dns-zone-synchronizer.ts', skillDir: 'dns-zone-synchronizer',
      interfaces: ['DnsZoneSynchronizerConfig', 'ZoneSync', 'SynchronizerEvent'],
      bk: 'dns_zone_synchronizer', eks: ['dzns.sync_received', 'dzns.diff_computed', 'dzns.changes_applied', 'dzns.serial_advanced'],
      subjects: ['sven.dzns.sync_received', 'sven.dzns.diff_computed', 'sven.dzns.changes_applied', 'sven.dzns.serial_advanced'],
      cases: ['dzns_receive', 'dzns_diff', 'dzns_apply', 'dzns_advance', 'dzns_report', 'dzns_monitor'],
    },
    {
      name: 'dns_record_validator', migration: '20260625360000_agent_dns_record_validator.sql',
      typeFile: 'agent-dns-record-validator.ts', skillDir: 'dns-record-validator',
      interfaces: ['DnsRecordValidatorConfig', 'RecordSet', 'ValidatorEvent'],
      bk: 'dns_record_validator', eks: ['drcv.set_received', 'drcv.syntax_checked', 'drcv.semantics_validated', 'drcv.report_emitted'],
      subjects: ['sven.drcv.set_received', 'sven.drcv.syntax_checked', 'sven.drcv.semantics_validated', 'sven.drcv.report_emitted'],
      cases: ['drcv_receive', 'drcv_check', 'drcv_validate', 'drcv_emit', 'drcv_report', 'drcv_monitor'],
    },
    {
      name: 'dns_health_probe', migration: '20260625370000_agent_dns_health_probe.sql',
      typeFile: 'agent-dns-health-probe.ts', skillDir: 'dns-health-probe',
      interfaces: ['DnsHealthProbeConfig', 'ProbeTarget', 'ProbeEvent'],
      bk: 'dns_health_probe', eks: ['dnhp.target_scheduled', 'dnhp.probe_executed', 'dnhp.result_evaluated', 'dnhp.status_recorded'],
      subjects: ['sven.dnhp.target_scheduled', 'sven.dnhp.probe_executed', 'sven.dnhp.result_evaluated', 'sven.dnhp.status_recorded'],
      cases: ['dnhp_schedule', 'dnhp_execute', 'dnhp_evaluate', 'dnhp_record', 'dnhp_report', 'dnhp_monitor'],
    },
    {
      name: 'dns_propagation_checker', migration: '20260625380000_agent_dns_propagation_checker.sql',
      typeFile: 'agent-dns-propagation-checker.ts', skillDir: 'dns-propagation-checker',
      interfaces: ['DnsPropagationCheckerConfig', 'PropagationJob', 'CheckerEvent'],
      bk: 'dns_propagation_checker', eks: ['dpck.job_received', 'dpck.resolvers_queried', 'dpck.consensus_evaluated', 'dpck.report_returned'],
      subjects: ['sven.dpck.job_received', 'sven.dpck.resolvers_queried', 'sven.dpck.consensus_evaluated', 'sven.dpck.report_returned'],
      cases: ['dpck_receive', 'dpck_query', 'dpck_evaluate', 'dpck_return', 'dpck_report', 'dpck_monitor'],
    },
    {
      name: 'dns_failover_router', migration: '20260625390000_agent_dns_failover_router.sql',
      typeFile: 'agent-dns-failover-router.ts', skillDir: 'dns-failover-router',
      interfaces: ['DnsFailoverRouterConfig', 'FailoverDecision', 'RouterEvent'],
      bk: 'dns_failover_router', eks: ['dfor.signal_received', 'dfor.policy_evaluated', 'dfor.records_swapped', 'dfor.notification_dispatched'],
      subjects: ['sven.dfor.signal_received', 'sven.dfor.policy_evaluated', 'sven.dfor.records_swapped', 'sven.dfor.notification_dispatched'],
      cases: ['dfor_receive', 'dfor_evaluate', 'dfor_swap', 'dfor_notify', 'dfor_report', 'dfor_monitor'],
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
