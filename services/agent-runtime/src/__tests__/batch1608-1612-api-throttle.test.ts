import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('API Throttle verticals', () => {
  const verticals = [
    {
      name: 'api_throttle', migration: '20260632450000_agent_api_throttle.sql',
      typeFile: 'agent-api-throttle.ts', skillDir: 'api-throttle',
      interfaces: ['ApiThrottleEntry', 'ApiThrottleConfig', 'ApiThrottleResult'],
      bk: 'api_throttle', eks: ['at.entry_created', 'at.config_updated', 'at.export_emitted'],
      subjects: ['sven.at.entry_created', 'sven.at.config_updated', 'sven.at.export_emitted'],
      cases: ['at_limiter', 'at_counter', 'at_reporter'],
    },
    {
      name: 'api_throttle_monitor', migration: '20260632460000_agent_api_throttle_monitor.sql',
      typeFile: 'agent-api-throttle-monitor.ts', skillDir: 'api-throttle-monitor',
      interfaces: ['ApiThrottleMonitorCheck', 'ApiThrottleMonitorConfig', 'ApiThrottleMonitorResult'],
      bk: 'api_throttle_monitor', eks: ['atm.check_passed', 'atm.alert_raised', 'atm.export_emitted'],
      subjects: ['sven.atm.check_passed', 'sven.atm.alert_raised', 'sven.atm.export_emitted'],
      cases: ['atm_watcher', 'atm_alerter', 'atm_reporter'],
    },
    {
      name: 'api_throttle_auditor', migration: '20260632470000_agent_api_throttle_auditor.sql',
      typeFile: 'agent-api-throttle-auditor.ts', skillDir: 'api-throttle-auditor',
      interfaces: ['ApiThrottleAuditEntry', 'ApiThrottleAuditConfig', 'ApiThrottleAuditResult'],
      bk: 'api_throttle_auditor', eks: ['ata.entry_logged', 'ata.violation_found', 'ata.export_emitted'],
      subjects: ['sven.ata.entry_logged', 'sven.ata.violation_found', 'sven.ata.export_emitted'],
      cases: ['ata_scanner', 'ata_enforcer', 'ata_reporter'],
    },
    {
      name: 'api_throttle_reporter', migration: '20260632480000_agent_api_throttle_reporter.sql',
      typeFile: 'agent-api-throttle-reporter.ts', skillDir: 'api-throttle-reporter',
      interfaces: ['ApiThrottleReport', 'ApiThrottleReportConfig', 'ApiThrottleReportResult'],
      bk: 'api_throttle_reporter', eks: ['atr.report_generated', 'atr.insight_found', 'atr.export_emitted'],
      subjects: ['sven.atr.report_generated', 'sven.atr.insight_found', 'sven.atr.export_emitted'],
      cases: ['atr_builder', 'atr_analyst', 'atr_reporter'],
    },
    {
      name: 'api_throttle_optimizer', migration: '20260632490000_agent_api_throttle_optimizer.sql',
      typeFile: 'agent-api-throttle-optimizer.ts', skillDir: 'api-throttle-optimizer',
      interfaces: ['ApiThrottleOptPlan', 'ApiThrottleOptConfig', 'ApiThrottleOptResult'],
      bk: 'api_throttle_optimizer', eks: ['ato.plan_created', 'ato.optimization_applied', 'ato.export_emitted'],
      subjects: ['sven.ato.plan_created', 'sven.ato.optimization_applied', 'sven.ato.export_emitted'],
      cases: ['ato_planner', 'ato_executor', 'ato_reporter'],
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
