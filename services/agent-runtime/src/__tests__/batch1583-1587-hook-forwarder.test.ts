import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Hook Forwarder verticals', () => {
  const verticals = [
    {
      name: 'hook_forwarder', migration: '20260632200000_agent_hook_forwarder.sql',
      typeFile: 'agent-hook-forwarder.ts', skillDir: 'hook-forwarder',
      interfaces: ['HookForwarderEntry', 'HookForwarderConfig', 'HookForwarderResult'],
      bk: 'hook_forwarder', eks: ['hf.entry_created', 'hf.config_updated', 'hf.export_emitted'],
      subjects: ['sven.hf.entry_created', 'sven.hf.config_updated', 'sven.hf.export_emitted'],
      cases: ['hf_dispatcher', 'hf_validator', 'hf_reporter'],
    },
    {
      name: 'hook_forwarder_monitor', migration: '20260632210000_agent_hook_forwarder_monitor.sql',
      typeFile: 'agent-hook-forwarder-monitor.ts', skillDir: 'hook-forwarder-monitor',
      interfaces: ['HookForwarderMonitorCheck', 'HookForwarderMonitorConfig', 'HookForwarderMonitorResult'],
      bk: 'hook_forwarder_monitor', eks: ['hfm.check_passed', 'hfm.alert_raised', 'hfm.export_emitted'],
      subjects: ['sven.hfm.check_passed', 'sven.hfm.alert_raised', 'sven.hfm.export_emitted'],
      cases: ['hfm_watcher', 'hfm_alerter', 'hfm_reporter'],
    },
    {
      name: 'hook_forwarder_auditor', migration: '20260632220000_agent_hook_forwarder_auditor.sql',
      typeFile: 'agent-hook-forwarder-auditor.ts', skillDir: 'hook-forwarder-auditor',
      interfaces: ['HookForwarderAuditEntry', 'HookForwarderAuditConfig', 'HookForwarderAuditResult'],
      bk: 'hook_forwarder_auditor', eks: ['hfa.entry_logged', 'hfa.violation_found', 'hfa.export_emitted'],
      subjects: ['sven.hfa.entry_logged', 'sven.hfa.violation_found', 'sven.hfa.export_emitted'],
      cases: ['hfa_scanner', 'hfa_enforcer', 'hfa_reporter'],
    },
    {
      name: 'hook_forwarder_reporter', migration: '20260632230000_agent_hook_forwarder_reporter.sql',
      typeFile: 'agent-hook-forwarder-reporter.ts', skillDir: 'hook-forwarder-reporter',
      interfaces: ['HookForwarderReport', 'HookForwarderReportConfig', 'HookForwarderReportResult'],
      bk: 'hook_forwarder_reporter', eks: ['hfr.report_generated', 'hfr.insight_found', 'hfr.export_emitted'],
      subjects: ['sven.hfr.report_generated', 'sven.hfr.insight_found', 'sven.hfr.export_emitted'],
      cases: ['hfr_builder', 'hfr_analyst', 'hfr_reporter'],
    },
    {
      name: 'hook_forwarder_optimizer', migration: '20260632240000_agent_hook_forwarder_optimizer.sql',
      typeFile: 'agent-hook-forwarder-optimizer.ts', skillDir: 'hook-forwarder-optimizer',
      interfaces: ['HookForwarderOptPlan', 'HookForwarderOptConfig', 'HookForwarderOptResult'],
      bk: 'hook_forwarder_optimizer', eks: ['hfo.plan_created', 'hfo.optimization_applied', 'hfo.export_emitted'],
      subjects: ['sven.hfo.plan_created', 'sven.hfo.optimization_applied', 'sven.hfo.export_emitted'],
      cases: ['hfo_planner', 'hfo_executor', 'hfo_reporter'],
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
