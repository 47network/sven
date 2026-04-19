import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Secret Rotation management verticals', () => {
  const verticals = [
    {
      name: 'secret_rotation', migration: '20260628650000_agent_secret_rotation.sql',
      typeFile: 'agent-secret-rotation.ts', skillDir: 'secret-rotation',
      interfaces: ['SecretRotationPlan', 'SecretRotationConfig', 'SecretRotationResult'],
      bk: 'secret_rotation', eks: ['sr.plan_created', 'sr.config_updated', 'sr.export_emitted'],
      subjects: ['sven.sr.plan_created', 'sven.sr.config_updated', 'sven.sr.export_emitted'],
      cases: ['sr_planner', 'sr_executor', 'sr_reporter'],
    },
    {
      name: 'secret_rotation_monitor', migration: '20260628660000_agent_secret_rotation_monitor.sql',
      typeFile: 'agent-secret-rotation-monitor.ts', skillDir: 'secret-rotation-monitor',
      interfaces: ['SecretRotationMonitorCheck', 'SecretRotationMonitorConfig', 'SecretRotationMonitorResult'],
      bk: 'secret_rotation_monitor', eks: ['srm.check_passed', 'srm.alert_raised', 'srm.export_emitted'],
      subjects: ['sven.srm.check_passed', 'sven.srm.alert_raised', 'sven.srm.export_emitted'],
      cases: ['srm_watcher', 'srm_alerter', 'srm_reporter'],
    },
    {
      name: 'secret_rotation_auditor', migration: '20260628670000_agent_secret_rotation_auditor.sql',
      typeFile: 'agent-secret-rotation-auditor.ts', skillDir: 'secret-rotation-auditor',
      interfaces: ['SecretRotationAuditEntry', 'SecretRotationAuditConfig', 'SecretRotationAuditResult'],
      bk: 'secret_rotation_auditor', eks: ['sra.entry_logged', 'sra.violation_found', 'sra.export_emitted'],
      subjects: ['sven.sra.entry_logged', 'sven.sra.violation_found', 'sven.sra.export_emitted'],
      cases: ['sra_scanner', 'sra_enforcer', 'sra_reporter'],
    },
    {
      name: 'secret_rotation_reporter', migration: '20260628680000_agent_secret_rotation_reporter.sql',
      typeFile: 'agent-secret-rotation-reporter.ts', skillDir: 'secret-rotation-reporter',
      interfaces: ['SecretRotationReport', 'SecretRotationReportConfig', 'SecretRotationReportResult'],
      bk: 'secret_rotation_reporter', eks: ['srr.report_generated', 'srr.insight_found', 'srr.export_emitted'],
      subjects: ['sven.srr.report_generated', 'sven.srr.insight_found', 'sven.srr.export_emitted'],
      cases: ['srr_builder', 'srr_analyst', 'srr_reporter'],
    },
    {
      name: 'secret_rotation_optimizer', migration: '20260628690000_agent_secret_rotation_optimizer.sql',
      typeFile: 'agent-secret-rotation-optimizer.ts', skillDir: 'secret-rotation-optimizer',
      interfaces: ['SecretRotationOptPlan', 'SecretRotationOptConfig', 'SecretRotationOptResult'],
      bk: 'secret_rotation_optimizer', eks: ['sro.plan_created', 'sro.optimization_applied', 'sro.export_emitted'],
      subjects: ['sven.sro.plan_created', 'sven.sro.optimization_applied', 'sven.sro.export_emitted'],
      cases: ['sro_planner', 'sro_executor', 'sro_reporter'],
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
