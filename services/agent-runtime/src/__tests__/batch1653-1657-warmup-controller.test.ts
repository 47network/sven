import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Warmup Controller verticals', () => {
  const verticals = [
    {
      name: 'warmup_controller', migration: '20260632900000_agent_warmup_controller.sql',
      typeFile: 'agent-warmup-controller.ts', skillDir: 'warmup-controller',
      interfaces: ['WarmupControllerEntry', 'WarmupControllerConfig', 'WarmupControllerResult'],
      bk: 'warmup_controller', eks: ['wc.entry_created', 'wc.config_updated', 'wc.export_emitted'],
      subjects: ['sven.wc.entry_created', 'sven.wc.config_updated', 'sven.wc.export_emitted'],
      cases: ['wc_initializer', 'wc_preloader', 'wc_reporter'],
    },
    {
      name: 'warmup_controller_monitor', migration: '20260632910000_agent_warmup_controller_monitor.sql',
      typeFile: 'agent-warmup-controller-monitor.ts', skillDir: 'warmup-controller-monitor',
      interfaces: ['WarmupControllerMonitorCheck', 'WarmupControllerMonitorConfig', 'WarmupControllerMonitorResult'],
      bk: 'warmup_controller_monitor', eks: ['wcm.check_passed', 'wcm.alert_raised', 'wcm.export_emitted'],
      subjects: ['sven.wcm.check_passed', 'sven.wcm.alert_raised', 'sven.wcm.export_emitted'],
      cases: ['wcm_watcher', 'wcm_alerter', 'wcm_reporter'],
    },
    {
      name: 'warmup_controller_auditor', migration: '20260632920000_agent_warmup_controller_auditor.sql',
      typeFile: 'agent-warmup-controller-auditor.ts', skillDir: 'warmup-controller-auditor',
      interfaces: ['WarmupControllerAuditEntry', 'WarmupControllerAuditConfig', 'WarmupControllerAuditResult'],
      bk: 'warmup_controller_auditor', eks: ['wca.entry_logged', 'wca.violation_found', 'wca.export_emitted'],
      subjects: ['sven.wca.entry_logged', 'sven.wca.violation_found', 'sven.wca.export_emitted'],
      cases: ['wca_scanner', 'wca_enforcer', 'wca_reporter'],
    },
    {
      name: 'warmup_controller_reporter', migration: '20260632930000_agent_warmup_controller_reporter.sql',
      typeFile: 'agent-warmup-controller-reporter.ts', skillDir: 'warmup-controller-reporter',
      interfaces: ['WarmupControllerReport', 'WarmupControllerReportConfig', 'WarmupControllerReportResult'],
      bk: 'warmup_controller_reporter', eks: ['wcr.report_generated', 'wcr.insight_found', 'wcr.export_emitted'],
      subjects: ['sven.wcr.report_generated', 'sven.wcr.insight_found', 'sven.wcr.export_emitted'],
      cases: ['wcr_builder', 'wcr_analyst', 'wcr_reporter'],
    },
    {
      name: 'warmup_controller_optimizer', migration: '20260632940000_agent_warmup_controller_optimizer.sql',
      typeFile: 'agent-warmup-controller-optimizer.ts', skillDir: 'warmup-controller-optimizer',
      interfaces: ['WarmupControllerOptPlan', 'WarmupControllerOptConfig', 'WarmupControllerOptResult'],
      bk: 'warmup_controller_optimizer', eks: ['wco.plan_created', 'wco.optimization_applied', 'wco.export_emitted'],
      subjects: ['sven.wco.plan_created', 'sven.wco.optimization_applied', 'sven.wco.export_emitted'],
      cases: ['wco_planner', 'wco_executor', 'wco_reporter'],
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
