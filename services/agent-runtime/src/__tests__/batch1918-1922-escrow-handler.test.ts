import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Escrow Handler verticals', () => {
  const verticals = [
    {
      name: 'escrow_handler', migration: '20260635550000_agent_escrow_handler.sql',
      typeFile: 'agent-escrow-handler.ts', skillDir: 'escrow-handler',
      interfaces: ['EscrowHandlerEntry', 'EscrowHandlerConfig', 'EscrowHandlerResult'],
      bk: 'escrow_handler', eks: ['eh.entry_created', 'eh.config_updated', 'eh.export_emitted'],
      subjects: ['sven.eh.entry_created', 'sven.eh.config_updated', 'sven.eh.export_emitted'],
      cases: ['eh_holder', 'eh_releaser', 'eh_reporter'],
    },
    {
      name: 'escrow_handler_monitor', migration: '20260635560000_agent_escrow_handler_monitor.sql',
      typeFile: 'agent-escrow-handler-monitor.ts', skillDir: 'escrow-handler-monitor',
      interfaces: ['EscrowHandlerMonitorCheck', 'EscrowHandlerMonitorConfig', 'EscrowHandlerMonitorResult'],
      bk: 'escrow_handler_monitor', eks: ['ehm.check_passed', 'ehm.alert_raised', 'ehm.export_emitted'],
      subjects: ['sven.ehm.check_passed', 'sven.ehm.alert_raised', 'sven.ehm.export_emitted'],
      cases: ['ehm_watcher', 'ehm_alerter', 'ehm_reporter'],
    },
    {
      name: 'escrow_handler_auditor', migration: '20260635570000_agent_escrow_handler_auditor.sql',
      typeFile: 'agent-escrow-handler-auditor.ts', skillDir: 'escrow-handler-auditor',
      interfaces: ['EscrowHandlerAuditEntry', 'EscrowHandlerAuditConfig', 'EscrowHandlerAuditResult'],
      bk: 'escrow_handler_auditor', eks: ['eha.entry_logged', 'eha.violation_found', 'eha.export_emitted'],
      subjects: ['sven.eha.entry_logged', 'sven.eha.violation_found', 'sven.eha.export_emitted'],
      cases: ['eha_scanner', 'eha_enforcer', 'eha_reporter'],
    },
    {
      name: 'escrow_handler_reporter', migration: '20260635580000_agent_escrow_handler_reporter.sql',
      typeFile: 'agent-escrow-handler-reporter.ts', skillDir: 'escrow-handler-reporter',
      interfaces: ['EscrowHandlerReport', 'EscrowHandlerReportConfig', 'EscrowHandlerReportResult'],
      bk: 'escrow_handler_reporter', eks: ['ehr.report_generated', 'ehr.insight_found', 'ehr.export_emitted'],
      subjects: ['sven.ehr.report_generated', 'sven.ehr.insight_found', 'sven.ehr.export_emitted'],
      cases: ['ehr_builder', 'ehr_analyst', 'ehr_reporter'],
    },
    {
      name: 'escrow_handler_optimizer', migration: '20260635590000_agent_escrow_handler_optimizer.sql',
      typeFile: 'agent-escrow-handler-optimizer.ts', skillDir: 'escrow-handler-optimizer',
      interfaces: ['EscrowHandlerOptPlan', 'EscrowHandlerOptConfig', 'EscrowHandlerOptResult'],
      bk: 'escrow_handler_optimizer', eks: ['eho.plan_created', 'eho.optimization_applied', 'eho.export_emitted'],
      subjects: ['sven.eho.plan_created', 'sven.eho.optimization_applied', 'sven.eho.export_emitted'],
      cases: ['eho_planner', 'eho_executor', 'eho_reporter'],
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
