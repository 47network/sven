import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1083-1087: Vulnerability Management', () => {
  const verticals = [
    {
      name: 'vuln_scan_initiator', migration: '20260627200000_agent_vuln_scan_initiator.sql',
      typeFile: 'agent-vuln-scan-initiator.ts', skillDir: 'vuln-scan-initiator',
      interfaces: ['VulnScanInitiatorConfig', 'InitRequest', 'InitiatorEvent'],
      bk: 'vuln_scan_initiator', eks: ['vsin.request_received', 'vsin.scope_resolved', 'vsin.scan_initiated', 'vsin.audit_recorded'],
      subjects: ['sven.vsin.request_received', 'sven.vsin.scope_resolved', 'sven.vsin.scan_initiated', 'sven.vsin.audit_recorded'],
      cases: ['vsin_receive', 'vsin_resolve', 'vsin_initiate', 'vsin_audit', 'vsin_report', 'vsin_monitor'],
    },
    {
      name: 'vuln_finding_collector', migration: '20260627210000_agent_vuln_finding_collector.sql',
      typeFile: 'agent-vuln-finding-collector.ts', skillDir: 'vuln-finding-collector',
      interfaces: ['VulnFindingCollectorConfig', 'FindingItem', 'CollectorEvent'],
      bk: 'vuln_finding_collector', eks: ['vfco.item_received', 'vfco.fields_validated', 'vfco.finding_persisted', 'vfco.audit_recorded'],
      subjects: ['sven.vfco.item_received', 'sven.vfco.fields_validated', 'sven.vfco.finding_persisted', 'sven.vfco.audit_recorded'],
      cases: ['vfco_receive', 'vfco_validate', 'vfco_persist', 'vfco_audit', 'vfco_report', 'vfco_monitor'],
    },
    {
      name: 'vuln_severity_classifier', migration: '20260627220000_agent_vuln_severity_classifier.sql',
      typeFile: 'agent-vuln-severity-classifier.ts', skillDir: 'vuln-severity-classifier',
      interfaces: ['VulnSeverityClassifierConfig', 'ClassifyRequest', 'ClassifierEvent'],
      bk: 'vuln_severity_classifier', eks: ['vscl.request_received', 'vscl.cvss_evaluated', 'vscl.severity_emitted', 'vscl.audit_recorded'],
      subjects: ['sven.vscl.request_received', 'sven.vscl.cvss_evaluated', 'sven.vscl.severity_emitted', 'sven.vscl.audit_recorded'],
      cases: ['vscl_receive', 'vscl_evaluate', 'vscl_emit', 'vscl_audit', 'vscl_report', 'vscl_monitor'],
    },
    {
      name: 'vuln_remediation_dispatcher', migration: '20260627230000_agent_vuln_remediation_dispatcher.sql',
      typeFile: 'agent-vuln-remediation-dispatcher.ts', skillDir: 'vuln-remediation-dispatcher',
      interfaces: ['VulnRemediationDispatcherConfig', 'RemediationRequest', 'DispatcherEvent'],
      bk: 'vuln_remediation_dispatcher', eks: ['vrdi.request_received', 'vrdi.policy_evaluated', 'vrdi.action_dispatched', 'vrdi.audit_recorded'],
      subjects: ['sven.vrdi.request_received', 'sven.vrdi.policy_evaluated', 'sven.vrdi.action_dispatched', 'sven.vrdi.audit_recorded'],
      cases: ['vrdi_receive', 'vrdi_evaluate', 'vrdi_dispatch', 'vrdi_audit', 'vrdi_report', 'vrdi_monitor'],
    },
    {
      name: 'vuln_audit_logger', migration: '20260627240000_agent_vuln_audit_logger.sql',
      typeFile: 'agent-vuln-audit-logger.ts', skillDir: 'vuln-audit-logger',
      interfaces: ['VulnAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'vuln_audit_logger', eks: ['vlau.record_received', 'vlau.fields_validated', 'vlau.record_persisted', 'vlau.export_emitted'],
      subjects: ['sven.vlau.record_received', 'sven.vlau.fields_validated', 'sven.vlau.record_persisted', 'sven.vlau.export_emitted'],
      cases: ['vlau_receive', 'vlau_validate', 'vlau_persist', 'vlau_emit', 'vlau_report', 'vlau_monitor'],
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
