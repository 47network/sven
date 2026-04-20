import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Dep Audit verticals', () => {
  const verticals = [
    {
      name: 'dep_audit', migration: '20260630450000_agent_dep_audit.sql',
      typeFile: 'agent-dep-audit.ts', skillDir: 'dep-audit',
      interfaces: ['DepAuditEntry', 'DepAuditConfig', 'DepAuditResult'],
      bk: 'dep_audit', eks: ['da.entry_created', 'da.config_updated', 'da.export_emitted'],
      subjects: ['sven.da.entry_created', 'sven.da.config_updated', 'sven.da.export_emitted'],
      cases: ['da_scanner', 'da_analyzer', 'da_reporter'],
    },
    {
      name: 'dep_audit_monitor', migration: '20260630460000_agent_dep_audit_monitor.sql',
      typeFile: 'agent-dep-audit-monitor.ts', skillDir: 'dep-audit-monitor',
      interfaces: ['DepAuditMonitorCheck', 'DepAuditMonitorConfig', 'DepAuditMonitorResult'],
      bk: 'dep_audit_monitor', eks: ['dam.check_passed', 'dam.alert_raised', 'dam.export_emitted'],
      subjects: ['sven.dam.check_passed', 'sven.dam.alert_raised', 'sven.dam.export_emitted'],
      cases: ['dam_watcher', 'dam_alerter', 'dam_reporter'],
    },
    {
      name: 'dep_audit_auditor', migration: '20260630470000_agent_dep_audit_auditor.sql',
      typeFile: 'agent-dep-audit-auditor.ts', skillDir: 'dep-audit-auditor',
      interfaces: ['DepAuditAuditEntry', 'DepAuditAuditConfig', 'DepAuditAuditResult'],
      bk: 'dep_audit_auditor', eks: ['daa.entry_logged', 'daa.violation_found', 'daa.export_emitted'],
      subjects: ['sven.daa.entry_logged', 'sven.daa.violation_found', 'sven.daa.export_emitted'],
      cases: ['daa_scanner', 'daa_enforcer', 'daa_reporter'],
    },
    {
      name: 'dep_audit_reporter', migration: '20260630480000_agent_dep_audit_reporter.sql',
      typeFile: 'agent-dep-audit-reporter.ts', skillDir: 'dep-audit-reporter',
      interfaces: ['DepAuditReport', 'DepAuditReportConfig', 'DepAuditReportResult'],
      bk: 'dep_audit_reporter', eks: ['dar.report_generated', 'dar.insight_found', 'dar.export_emitted'],
      subjects: ['sven.dar.report_generated', 'sven.dar.insight_found', 'sven.dar.export_emitted'],
      cases: ['dar_builder', 'dar_analyst', 'dar_reporter'],
    },
    {
      name: 'dep_audit_optimizer', migration: '20260630490000_agent_dep_audit_optimizer.sql',
      typeFile: 'agent-dep-audit-optimizer.ts', skillDir: 'dep-audit-optimizer',
      interfaces: ['DepAuditOptPlan', 'DepAuditOptConfig', 'DepAuditOptResult'],
      bk: 'dep_audit_optimizer', eks: ['dao.plan_created', 'dao.optimization_applied', 'dao.export_emitted'],
      subjects: ['sven.dao.plan_created', 'sven.dao.optimization_applied', 'sven.dao.export_emitted'],
      cases: ['dao_planner', 'dao_executor', 'dao_reporter'],
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
