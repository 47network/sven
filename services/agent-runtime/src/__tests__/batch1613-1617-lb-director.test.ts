import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('LB Director verticals', () => {
  const verticals = [
    {
      name: 'lb_director', migration: '20260632500000_agent_lb_director.sql',
      typeFile: 'agent-lb-director.ts', skillDir: 'lb-director',
      interfaces: ['LbDirectorEntry', 'LbDirectorConfig', 'LbDirectorResult'],
      bk: 'lb_director', eks: ['lbd.entry_created', 'lbd.config_updated', 'lbd.export_emitted'],
      subjects: ['sven.lbd.entry_created', 'sven.lbd.config_updated', 'sven.lbd.export_emitted'],
      cases: ['lbd_router', 'lbd_balancer', 'lbd_reporter'],
    },
    {
      name: 'lb_director_monitor', migration: '20260632510000_agent_lb_director_monitor.sql',
      typeFile: 'agent-lb-director-monitor.ts', skillDir: 'lb-director-monitor',
      interfaces: ['LbDirectorMonitorCheck', 'LbDirectorMonitorConfig', 'LbDirectorMonitorResult'],
      bk: 'lb_director_monitor', eks: ['lbdm.check_passed', 'lbdm.alert_raised', 'lbdm.export_emitted'],
      subjects: ['sven.lbdm.check_passed', 'sven.lbdm.alert_raised', 'sven.lbdm.export_emitted'],
      cases: ['lbdm_watcher', 'lbdm_alerter', 'lbdm_reporter'],
    },
    {
      name: 'lb_director_auditor', migration: '20260632520000_agent_lb_director_auditor.sql',
      typeFile: 'agent-lb-director-auditor.ts', skillDir: 'lb-director-auditor',
      interfaces: ['LbDirectorAuditEntry', 'LbDirectorAuditConfig', 'LbDirectorAuditResult'],
      bk: 'lb_director_auditor', eks: ['lbda.entry_logged', 'lbda.violation_found', 'lbda.export_emitted'],
      subjects: ['sven.lbda.entry_logged', 'sven.lbda.violation_found', 'sven.lbda.export_emitted'],
      cases: ['lbda_scanner', 'lbda_enforcer', 'lbda_reporter'],
    },
    {
      name: 'lb_director_reporter', migration: '20260632530000_agent_lb_director_reporter.sql',
      typeFile: 'agent-lb-director-reporter.ts', skillDir: 'lb-director-reporter',
      interfaces: ['LbDirectorReport', 'LbDirectorReportConfig', 'LbDirectorReportResult'],
      bk: 'lb_director_reporter', eks: ['lbdr.report_generated', 'lbdr.insight_found', 'lbdr.export_emitted'],
      subjects: ['sven.lbdr.report_generated', 'sven.lbdr.insight_found', 'sven.lbdr.export_emitted'],
      cases: ['lbdr_builder', 'lbdr_analyst', 'lbdr_reporter'],
    },
    {
      name: 'lb_director_optimizer', migration: '20260632540000_agent_lb_director_optimizer.sql',
      typeFile: 'agent-lb-director-optimizer.ts', skillDir: 'lb-director-optimizer',
      interfaces: ['LbDirectorOptPlan', 'LbDirectorOptConfig', 'LbDirectorOptResult'],
      bk: 'lb_director_optimizer', eks: ['lbdo.plan_created', 'lbdo.optimization_applied', 'lbdo.export_emitted'],
      subjects: ['sven.lbdo.plan_created', 'sven.lbdo.optimization_applied', 'sven.lbdo.export_emitted'],
      cases: ['lbdo_planner', 'lbdo_executor', 'lbdo_reporter'],
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
