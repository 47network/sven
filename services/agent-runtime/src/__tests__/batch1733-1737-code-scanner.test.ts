import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Code Scanner verticals', () => {
  const verticals = [
    {
      name: 'code_scanner', migration: '20260633700000_agent_code_scanner.sql',
      typeFile: 'agent-code-scanner.ts', skillDir: 'code-scanner',
      interfaces: ['CodeScannerEntry', 'CodeScannerConfig', 'CodeScannerResult'],
      bk: 'code_scanner', eks: ['cs.entry_created', 'cs.config_updated', 'cs.export_emitted'],
      subjects: ['sven.cs.entry_created', 'sven.cs.config_updated', 'sven.cs.export_emitted'],
      cases: ['cs_parser', 'cs_analyzer', 'cs_reporter'],
    },
    {
      name: 'code_scanner_monitor', migration: '20260633710000_agent_code_scanner_monitor.sql',
      typeFile: 'agent-code-scanner-monitor.ts', skillDir: 'code-scanner-monitor',
      interfaces: ['CodeScannerMonitorCheck', 'CodeScannerMonitorConfig', 'CodeScannerMonitorResult'],
      bk: 'code_scanner_monitor', eks: ['csm.check_passed', 'csm.alert_raised', 'csm.export_emitted'],
      subjects: ['sven.csm.check_passed', 'sven.csm.alert_raised', 'sven.csm.export_emitted'],
      cases: ['csm_watcher', 'csm_alerter', 'csm_reporter'],
    },
    {
      name: 'code_scanner_auditor', migration: '20260633720000_agent_code_scanner_auditor.sql',
      typeFile: 'agent-code-scanner-auditor.ts', skillDir: 'code-scanner-auditor',
      interfaces: ['CodeScannerAuditEntry', 'CodeScannerAuditConfig', 'CodeScannerAuditResult'],
      bk: 'code_scanner_auditor', eks: ['csa.entry_logged', 'csa.violation_found', 'csa.export_emitted'],
      subjects: ['sven.csa.entry_logged', 'sven.csa.violation_found', 'sven.csa.export_emitted'],
      cases: ['csa_scanner', 'csa_enforcer', 'csa_reporter'],
    },
    {
      name: 'code_scanner_reporter', migration: '20260633730000_agent_code_scanner_reporter.sql',
      typeFile: 'agent-code-scanner-reporter.ts', skillDir: 'code-scanner-reporter',
      interfaces: ['CodeScannerReport', 'CodeScannerReportConfig', 'CodeScannerReportResult'],
      bk: 'code_scanner_reporter', eks: ['csr.report_generated', 'csr.insight_found', 'csr.export_emitted'],
      subjects: ['sven.csr.report_generated', 'sven.csr.insight_found', 'sven.csr.export_emitted'],
      cases: ['csr_builder', 'csr_analyst', 'csr_reporter'],
    },
    {
      name: 'code_scanner_optimizer', migration: '20260633740000_agent_code_scanner_optimizer.sql',
      typeFile: 'agent-code-scanner-optimizer.ts', skillDir: 'code-scanner-optimizer',
      interfaces: ['CodeScannerOptPlan', 'CodeScannerOptConfig', 'CodeScannerOptResult'],
      bk: 'code_scanner_optimizer', eks: ['cso.plan_created', 'cso.optimization_applied', 'cso.export_emitted'],
      subjects: ['sven.cso.plan_created', 'sven.cso.optimization_applied', 'sven.cso.export_emitted'],
      cases: ['cso_planner', 'cso_executor', 'cso_reporter'],
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
