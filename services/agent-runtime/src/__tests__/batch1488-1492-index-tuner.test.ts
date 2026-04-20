import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Index Tuner verticals', () => {
  const verticals = [
    {
      name: 'index_tuner', migration: '20260631250000_agent_index_tuner.sql',
      typeFile: 'agent-index-tuner.ts', skillDir: 'index-tuner',
      interfaces: ['IndexTunerEntry', 'IndexTunerConfig', 'IndexTunerResult'],
      bk: 'index_tuner', eks: ['it.entry_created', 'it.config_updated', 'it.export_emitted'],
      subjects: ['sven.it.entry_created', 'sven.it.config_updated', 'sven.it.export_emitted'],
      cases: ['it_analyzer', 'it_recommender', 'it_reporter'],
    },
    {
      name: 'index_tuner_monitor', migration: '20260631260000_agent_index_tuner_monitor.sql',
      typeFile: 'agent-index-tuner-monitor.ts', skillDir: 'index-tuner-monitor',
      interfaces: ['IndexTunerMonitorCheck', 'IndexTunerMonitorConfig', 'IndexTunerMonitorResult'],
      bk: 'index_tuner_monitor', eks: ['itm.check_passed', 'itm.alert_raised', 'itm.export_emitted'],
      subjects: ['sven.itm.check_passed', 'sven.itm.alert_raised', 'sven.itm.export_emitted'],
      cases: ['itm_watcher', 'itm_alerter', 'itm_reporter'],
    },
    {
      name: 'index_tuner_auditor', migration: '20260631270000_agent_index_tuner_auditor.sql',
      typeFile: 'agent-index-tuner-auditor.ts', skillDir: 'index-tuner-auditor',
      interfaces: ['IndexTunerAuditEntry', 'IndexTunerAuditConfig', 'IndexTunerAuditResult'],
      bk: 'index_tuner_auditor', eks: ['ita.entry_logged', 'ita.violation_found', 'ita.export_emitted'],
      subjects: ['sven.ita.entry_logged', 'sven.ita.violation_found', 'sven.ita.export_emitted'],
      cases: ['ita_scanner', 'ita_enforcer', 'ita_reporter'],
    },
    {
      name: 'index_tuner_reporter', migration: '20260631280000_agent_index_tuner_reporter.sql',
      typeFile: 'agent-index-tuner-reporter.ts', skillDir: 'index-tuner-reporter',
      interfaces: ['IndexTunerReport', 'IndexTunerReportConfig', 'IndexTunerReportResult'],
      bk: 'index_tuner_reporter', eks: ['itr.report_generated', 'itr.insight_found', 'itr.export_emitted'],
      subjects: ['sven.itr.report_generated', 'sven.itr.insight_found', 'sven.itr.export_emitted'],
      cases: ['itr_builder', 'itr_analyst', 'itr_reporter'],
    },
    {
      name: 'index_tuner_planner', migration: '20260631290000_agent_index_tuner_planner.sql',
      typeFile: 'agent-index-tuner-planner.ts', skillDir: 'index-tuner-planner',
      interfaces: ['IndexTunerPlan', 'IndexTunerPlanConfig', 'IndexTunerPlanResult'],
      bk: 'index_tuner_planner', eks: ['itp.plan_created', 'itp.strategy_applied', 'itp.export_emitted'],
      subjects: ['sven.itp.plan_created', 'sven.itp.strategy_applied', 'sven.itp.export_emitted'],
      cases: ['itp_designer', 'itp_scheduler', 'itp_reporter'],
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
