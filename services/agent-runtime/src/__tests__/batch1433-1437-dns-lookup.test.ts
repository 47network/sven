import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('DNS Lookup verticals', () => {
  const verticals = [
    {
      name: 'dns_lookup', migration: '20260630700000_agent_dns_lookup.sql',
      typeFile: 'agent-dns-lookup.ts', skillDir: 'dns-lookup',
      interfaces: ['DnsLookupEntry', 'DnsLookupConfig', 'DnsLookupResult'],
      bk: 'dns_lookup', eks: ['dl.entry_created', 'dl.config_updated', 'dl.export_emitted'],
      subjects: ['sven.dl.entry_created', 'sven.dl.config_updated', 'sven.dl.export_emitted'],
      cases: ['dl_resolver', 'dl_validator', 'dl_reporter'],
    },
    {
      name: 'dns_lookup_monitor', migration: '20260630710000_agent_dns_lookup_monitor.sql',
      typeFile: 'agent-dns-lookup-monitor.ts', skillDir: 'dns-lookup-monitor',
      interfaces: ['DnsLookupMonitorCheck', 'DnsLookupMonitorConfig', 'DnsLookupMonitorResult'],
      bk: 'dns_lookup_monitor', eks: ['dlm.check_passed', 'dlm.alert_raised', 'dlm.export_emitted'],
      subjects: ['sven.dlm.check_passed', 'sven.dlm.alert_raised', 'sven.dlm.export_emitted'],
      cases: ['dlm_watcher', 'dlm_alerter', 'dlm_reporter'],
    },
    {
      name: 'dns_lookup_auditor', migration: '20260630720000_agent_dns_lookup_auditor.sql',
      typeFile: 'agent-dns-lookup-auditor.ts', skillDir: 'dns-lookup-auditor',
      interfaces: ['DnsLookupAuditEntry', 'DnsLookupAuditConfig', 'DnsLookupAuditResult'],
      bk: 'dns_lookup_auditor', eks: ['dla.entry_logged', 'dla.violation_found', 'dla.export_emitted'],
      subjects: ['sven.dla.entry_logged', 'sven.dla.violation_found', 'sven.dla.export_emitted'],
      cases: ['dla_scanner', 'dla_enforcer', 'dla_reporter'],
    },
    {
      name: 'dns_lookup_reporter', migration: '20260630730000_agent_dns_lookup_reporter.sql',
      typeFile: 'agent-dns-lookup-reporter.ts', skillDir: 'dns-lookup-reporter',
      interfaces: ['DnsLookupReport', 'DnsLookupReportConfig', 'DnsLookupReportResult'],
      bk: 'dns_lookup_reporter', eks: ['dlr.report_generated', 'dlr.insight_found', 'dlr.export_emitted'],
      subjects: ['sven.dlr.report_generated', 'sven.dlr.insight_found', 'sven.dlr.export_emitted'],
      cases: ['dlr_builder', 'dlr_analyst', 'dlr_reporter'],
    },
    {
      name: 'dns_lookup_optimizer', migration: '20260630740000_agent_dns_lookup_optimizer.sql',
      typeFile: 'agent-dns-lookup-optimizer.ts', skillDir: 'dns-lookup-optimizer',
      interfaces: ['DnsLookupOptPlan', 'DnsLookupOptConfig', 'DnsLookupOptResult'],
      bk: 'dns_lookup_optimizer', eks: ['dlo.plan_created', 'dlo.optimization_applied', 'dlo.export_emitted'],
      subjects: ['sven.dlo.plan_created', 'sven.dlo.optimization_applied', 'sven.dlo.export_emitted'],
      cases: ['dlo_planner', 'dlo_executor', 'dlo_reporter'],
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
