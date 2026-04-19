import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Frame Inspector verticals', () => {
  const verticals = [
    {
      name: 'frame_inspector', migration: '20260630850000_agent_frame_inspector.sql',
      typeFile: 'agent-frame-inspector.ts', skillDir: 'frame-inspector',
      interfaces: ['FrameInspectorEntry', 'FrameInspectorConfig', 'FrameInspectorResult'],
      bk: 'frame_inspector', eks: ['fi.entry_created', 'fi.config_updated', 'fi.export_emitted'],
      subjects: ['sven.fi.entry_created', 'sven.fi.config_updated', 'sven.fi.export_emitted'],
      cases: ['fi_analyzer', 'fi_decoder', 'fi_reporter'],
    },
    {
      name: 'frame_inspector_monitor', migration: '20260630860000_agent_frame_inspector_monitor.sql',
      typeFile: 'agent-frame-inspector-monitor.ts', skillDir: 'frame-inspector-monitor',
      interfaces: ['FrameInspectorMonitorCheck', 'FrameInspectorMonitorConfig', 'FrameInspectorMonitorResult'],
      bk: 'frame_inspector_monitor', eks: ['fim.check_passed', 'fim.alert_raised', 'fim.export_emitted'],
      subjects: ['sven.fim.check_passed', 'sven.fim.alert_raised', 'sven.fim.export_emitted'],
      cases: ['fim_watcher', 'fim_alerter', 'fim_reporter'],
    },
    {
      name: 'frame_inspector_auditor', migration: '20260630870000_agent_frame_inspector_auditor.sql',
      typeFile: 'agent-frame-inspector-auditor.ts', skillDir: 'frame-inspector-auditor',
      interfaces: ['FrameInspectorAuditEntry', 'FrameInspectorAuditConfig', 'FrameInspectorAuditResult'],
      bk: 'frame_inspector_auditor', eks: ['fia.entry_logged', 'fia.violation_found', 'fia.export_emitted'],
      subjects: ['sven.fia.entry_logged', 'sven.fia.violation_found', 'sven.fia.export_emitted'],
      cases: ['fia_scanner', 'fia_enforcer', 'fia_reporter'],
    },
    {
      name: 'frame_inspector_reporter', migration: '20260630880000_agent_frame_inspector_reporter.sql',
      typeFile: 'agent-frame-inspector-reporter.ts', skillDir: 'frame-inspector-reporter',
      interfaces: ['FrameInspectorReport', 'FrameInspectorReportConfig', 'FrameInspectorReportResult'],
      bk: 'frame_inspector_reporter', eks: ['fir.report_generated', 'fir.insight_found', 'fir.export_emitted'],
      subjects: ['sven.fir.report_generated', 'sven.fir.insight_found', 'sven.fir.export_emitted'],
      cases: ['fir_builder', 'fir_analyst', 'fir_reporter'],
    },
    {
      name: 'frame_inspector_optimizer', migration: '20260630890000_agent_frame_inspector_optimizer.sql',
      typeFile: 'agent-frame-inspector-optimizer.ts', skillDir: 'frame-inspector-optimizer',
      interfaces: ['FrameInspectorOptPlan', 'FrameInspectorOptConfig', 'FrameInspectorOptResult'],
      bk: 'frame_inspector_optimizer', eks: ['fio.plan_created', 'fio.optimization_applied', 'fio.export_emitted'],
      subjects: ['sven.fio.plan_created', 'sven.fio.optimization_applied', 'sven.fio.export_emitted'],
      cases: ['fio_planner', 'fio_executor', 'fio_reporter'],
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
