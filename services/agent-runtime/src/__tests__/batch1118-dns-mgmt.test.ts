import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 1118-1122 · DNS Management', () => {
  const verticals = [
    {
      name: 'dns_zone_provisioner', migration: '20260627550000_agent_dns_zone_provisioner.sql',
      typeFile: 'agent-dns-zone-provisioner.ts', skillDir: 'dns-zone-provisioner',
      interfaces: ['DnsZoneProvisionerConfig', 'DnsZoneProvisionerEvent', 'DnsZoneProvisionerRule'],
      bk: 'dns_zone_provisioner', eks: ['dzp.analysis_completed', 'dzp.alert_triggered', 'dzp.export_emitted'],
      subjects: ['sven.dzp.analysis_completed', 'sven.dzp.alert_triggered', 'sven.dzp.export_emitted'],
      cases: ['dzp_monitor', 'dzp_analyzer', 'dzp_reporter'],
    },
    {
      name: 'dns_record_verifier', migration: '20260627560000_agent_dns_record_verifier.sql',
      typeFile: 'agent-dns-record-verifier.ts', skillDir: 'dns-record-verifier',
      interfaces: ['DnsRecordVerifierConfig', 'DnsRecordVerifierEvent', 'DnsRecordVerifierRule'],
      bk: 'dns_record_verifier', eks: ['drv.analysis_completed', 'drv.alert_triggered', 'drv.export_emitted'],
      subjects: ['sven.drv.analysis_completed', 'sven.drv.alert_triggered', 'sven.drv.export_emitted'],
      cases: ['drv_monitor', 'drv_analyzer', 'drv_reporter'],
    },
    {
      name: 'dns_propagation_prober', migration: '20260627570000_agent_dns_propagation_prober.sql',
      typeFile: 'agent-dns-propagation-prober.ts', skillDir: 'dns-propagation-prober',
      interfaces: ['DnsPropagationProberConfig', 'DnsPropagationProberEvent', 'DnsPropagationProberRule'],
      bk: 'dns_propagation_prober', eks: ['dpp.analysis_completed', 'dpp.alert_triggered', 'dpp.export_emitted'],
      subjects: ['sven.dpp.analysis_completed', 'sven.dpp.alert_triggered', 'sven.dpp.export_emitted'],
      cases: ['dpp_monitor', 'dpp_analyzer', 'dpp_reporter'],
    },
    {
      name: 'dns_health_monitor', migration: '20260627580000_agent_dns_health_monitor.sql',
      typeFile: 'agent-dns-health-monitor.ts', skillDir: 'dns-health-monitor',
      interfaces: ['DnsHealthMonitorConfig', 'DnsHealthMonitorEvent', 'DnsHealthMonitorRule'],
      bk: 'dns_health_monitor', eks: ['dhm.analysis_completed', 'dhm.alert_triggered', 'dhm.export_emitted'],
      subjects: ['sven.dhm.analysis_completed', 'sven.dhm.alert_triggered', 'sven.dhm.export_emitted'],
      cases: ['dhm_monitor', 'dhm_analyzer', 'dhm_reporter'],
    },
    {
      name: 'dns_failover_manager', migration: '20260627590000_agent_dns_failover_manager.sql',
      typeFile: 'agent-dns-failover-manager.ts', skillDir: 'dns-failover-manager',
      interfaces: ['DnsFailoverManagerConfig', 'DnsFailoverManagerEvent', 'DnsFailoverManagerRule'],
      bk: 'dns_failover_manager', eks: ['dfm.analysis_completed', 'dfm.alert_triggered', 'dfm.export_emitted'],
      subjects: ['sven.dfm.analysis_completed', 'sven.dfm.alert_triggered', 'sven.dfm.export_emitted'],
      cases: ['dfm_monitor', 'dfm_analyzer', 'dfm_reporter'],
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
