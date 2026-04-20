import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 1098-1102: Configuration Management', () => {
  const verticals = [
    {
      name: 'config_mgmt_loader', migration: '20260627350000_agent_config_mgmt_loader.sql',
      typeFile: 'agent-config-mgmt-loader.ts', skillDir: 'config-mgmt-loader',
      interfaces: ['ConfigMgmtLoaderConfig', 'LoadRequest', 'LoaderEvent'],
      bk: 'config_mgmt_loader', eks: ['cmlo.request_received', 'cmlo.config_loaded', 'cmlo.snapshot_emitted', 'cmlo.audit_recorded'],
      subjects: ['sven.cmlo.request_received', 'sven.cmlo.config_loaded', 'sven.cmlo.snapshot_emitted', 'sven.cmlo.audit_recorded'],
      cases: ['cmlo_receive', 'cmlo_load', 'cmlo_emit', 'cmlo_audit', 'cmlo_report', 'cmlo_monitor'],
    },
    {
      name: 'config_mgmt_validator', migration: '20260627360000_agent_config_mgmt_validator.sql',
      typeFile: 'agent-config-mgmt-validator.ts', skillDir: 'config-mgmt-validator',
      interfaces: ['ConfigMgmtValidatorConfig', 'ValidateRequest', 'ValidatorEvent'],
      bk: 'config_mgmt_validator', eks: ['cmva.request_received', 'cmva.schema_validated', 'cmva.results_emitted', 'cmva.audit_recorded'],
      subjects: ['sven.cmva.request_received', 'sven.cmva.schema_validated', 'sven.cmva.results_emitted', 'sven.cmva.audit_recorded'],
      cases: ['cmva_receive', 'cmva_validate', 'cmva_emit', 'cmva_audit', 'cmva_report', 'cmva_monitor'],
    },
    {
      name: 'config_mgmt_publisher', migration: '20260627370000_agent_config_mgmt_publisher.sql',
      typeFile: 'agent-config-mgmt-publisher.ts', skillDir: 'config-mgmt-publisher',
      interfaces: ['ConfigMgmtPublisherConfig', 'PublishRequest', 'PublisherEvent'],
      bk: 'config_mgmt_publisher', eks: ['cmpu.request_received', 'cmpu.policy_evaluated', 'cmpu.config_published', 'cmpu.audit_recorded'],
      subjects: ['sven.cmpu.request_received', 'sven.cmpu.policy_evaluated', 'sven.cmpu.config_published', 'sven.cmpu.audit_recorded'],
      cases: ['cmpu_receive', 'cmpu_evaluate', 'cmpu_publish', 'cmpu_audit', 'cmpu_report', 'cmpu_monitor'],
    },
    {
      name: 'config_mgmt_drift_detector', migration: '20260627380000_agent_config_mgmt_drift_detector.sql',
      typeFile: 'agent-config-mgmt-drift-detector.ts', skillDir: 'config-mgmt-drift-detector',
      interfaces: ['ConfigMgmtDriftDetectorConfig', 'DriftRequest', 'DetectorEvent'],
      bk: 'config_mgmt_drift_detector', eks: ['cmdd.request_received', 'cmdd.drift_evaluated', 'cmdd.findings_emitted', 'cmdd.audit_recorded'],
      subjects: ['sven.cmdd.request_received', 'sven.cmdd.drift_evaluated', 'sven.cmdd.findings_emitted', 'sven.cmdd.audit_recorded'],
      cases: ['cmdd_receive', 'cmdd_evaluate', 'cmdd_emit', 'cmdd_audit', 'cmdd_report', 'cmdd_monitor'],
    },
    {
      name: 'config_mgmt_audit_logger', migration: '20260627390000_agent_config_mgmt_audit_logger.sql',
      typeFile: 'agent-config-mgmt-audit-logger.ts', skillDir: 'config-mgmt-audit-logger',
      interfaces: ['ConfigMgmtAuditLoggerConfig', 'AuditRecord', 'LoggerEvent'],
      bk: 'config_mgmt_audit_logger', eks: ['cmau.record_received', 'cmau.fields_validated', 'cmau.record_persisted', 'cmau.export_emitted'],
      subjects: ['sven.cmau.record_received', 'sven.cmau.fields_validated', 'sven.cmau.record_persisted', 'sven.cmau.export_emitted'],
      cases: ['cmau_receive', 'cmau_validate', 'cmau_persist', 'cmau_emit', 'cmau_report', 'cmau_monitor'],
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
