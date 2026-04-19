import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Network Segmenter verticals', () => {
  const verticals = [
    {
      name: 'network_segmenter', migration: '20260630650000_agent_network_segmenter.sql',
      typeFile: 'agent-network-segmenter.ts', skillDir: 'network-segmenter',
      interfaces: ['NetworkSegmenterEntry', 'NetworkSegmenterConfig', 'NetworkSegmenterResult'],
      bk: 'network_segmenter', eks: ['ns.entry_created', 'ns.config_updated', 'ns.export_emitted'],
      subjects: ['sven.ns.entry_created', 'sven.ns.config_updated', 'sven.ns.export_emitted'],
      cases: ['ns_planner', 'ns_enforcer', 'ns_reporter'],
    },
    {
      name: 'network_segmenter_monitor', migration: '20260630660000_agent_network_segmenter_monitor.sql',
      typeFile: 'agent-network-segmenter-monitor.ts', skillDir: 'network-segmenter-monitor',
      interfaces: ['NetworkSegmenterMonitorCheck', 'NetworkSegmenterMonitorConfig', 'NetworkSegmenterMonitorResult'],
      bk: 'network_segmenter_monitor', eks: ['nsm.check_passed', 'nsm.alert_raised', 'nsm.export_emitted'],
      subjects: ['sven.nsm.check_passed', 'sven.nsm.alert_raised', 'sven.nsm.export_emitted'],
      cases: ['nsm_watcher', 'nsm_alerter', 'nsm_reporter'],
    },
    {
      name: 'network_segmenter_auditor', migration: '20260630670000_agent_network_segmenter_auditor.sql',
      typeFile: 'agent-network-segmenter-auditor.ts', skillDir: 'network-segmenter-auditor',
      interfaces: ['NetworkSegmenterAuditEntry', 'NetworkSegmenterAuditConfig', 'NetworkSegmenterAuditResult'],
      bk: 'network_segmenter_auditor', eks: ['nsa.entry_logged', 'nsa.violation_found', 'nsa.export_emitted'],
      subjects: ['sven.nsa.entry_logged', 'sven.nsa.violation_found', 'sven.nsa.export_emitted'],
      cases: ['nsa_scanner', 'nsa_enforcer', 'nsa_reporter'],
    },
    {
      name: 'network_segmenter_reporter', migration: '20260630680000_agent_network_segmenter_reporter.sql',
      typeFile: 'agent-network-segmenter-reporter.ts', skillDir: 'network-segmenter-reporter',
      interfaces: ['NetworkSegmenterReport', 'NetworkSegmenterReportConfig', 'NetworkSegmenterReportResult'],
      bk: 'network_segmenter_reporter', eks: ['nsr.report_generated', 'nsr.insight_found', 'nsr.export_emitted'],
      subjects: ['sven.nsr.report_generated', 'sven.nsr.insight_found', 'sven.nsr.export_emitted'],
      cases: ['nsr_builder', 'nsr_analyst', 'nsr_reporter'],
    },
    {
      name: 'network_segmenter_optimizer', migration: '20260630690000_agent_network_segmenter_optimizer.sql',
      typeFile: 'agent-network-segmenter-optimizer.ts', skillDir: 'network-segmenter-optimizer',
      interfaces: ['NetworkSegmenterOptPlan', 'NetworkSegmenterOptConfig', 'NetworkSegmenterOptResult'],
      bk: 'network_segmenter_optimizer', eks: ['nso.plan_created', 'nso.optimization_applied', 'nso.export_emitted'],
      subjects: ['sven.nso.plan_created', 'sven.nso.optimization_applied', 'sven.nso.export_emitted'],
      cases: ['nso_planner', 'nso_executor', 'nso_reporter'],
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
