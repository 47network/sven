import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 988-992: Model Registry', () => {
  const verticals = [
    {
      name: 'model_registry_publisher', migration: '20260626250000_agent_model_registry_publisher.sql',
      typeFile: 'agent-model-registry-publisher.ts', skillDir: 'model-registry-publisher',
      interfaces: ['ModelRegistryPublisherConfig', 'ModelArtifact', 'PublisherEvent'],
      bk: 'model_registry_publisher', eks: ['mrgp.artifact_received', 'mrgp.metadata_validated', 'mrgp.artifact_published', 'mrgp.audit_recorded'],
      subjects: ['sven.mrgp.artifact_received', 'sven.mrgp.metadata_validated', 'sven.mrgp.artifact_published', 'sven.mrgp.audit_recorded'],
      cases: ['mrgp_receive', 'mrgp_validate', 'mrgp_publish', 'mrgp_audit', 'mrgp_report', 'mrgp_monitor'],
    },
    {
      name: 'model_registry_signer', migration: '20260626260000_agent_model_registry_signer.sql',
      typeFile: 'agent-model-registry-signer.ts', skillDir: 'model-registry-signer',
      interfaces: ['ModelRegistrySignerConfig', 'SigningRequest', 'SignerEvent'],
      bk: 'model_registry_signer', eks: ['mrgs.request_received', 'mrgs.artifact_hashed', 'mrgs.signature_recorded', 'mrgs.audit_recorded'],
      subjects: ['sven.mrgs.request_received', 'sven.mrgs.artifact_hashed', 'sven.mrgs.signature_recorded', 'sven.mrgs.audit_recorded'],
      cases: ['mrgs_receive', 'mrgs_hash', 'mrgs_record', 'mrgs_audit', 'mrgs_report', 'mrgs_monitor'],
    },
    {
      name: 'model_registry_promoter', migration: '20260626270000_agent_model_registry_promoter.sql',
      typeFile: 'agent-model-registry-promoter.ts', skillDir: 'model-registry-promoter',
      interfaces: ['ModelRegistryPromoterConfig', 'PromotionRequest', 'PromoterEvent'],
      bk: 'model_registry_promoter', eks: ['mrgm.request_received', 'mrgm.gates_evaluated', 'mrgm.promotion_applied', 'mrgm.audit_recorded'],
      subjects: ['sven.mrgm.request_received', 'sven.mrgm.gates_evaluated', 'sven.mrgm.promotion_applied', 'sven.mrgm.audit_recorded'],
      cases: ['mrgm_receive', 'mrgm_evaluate', 'mrgm_apply', 'mrgm_audit', 'mrgm_report', 'mrgm_monitor'],
    },
    {
      name: 'model_registry_lineage_tracker', migration: '20260626280000_agent_model_registry_lineage_tracker.sql',
      typeFile: 'agent-model-registry-lineage-tracker.ts', skillDir: 'model-registry-lineage-tracker',
      interfaces: ['ModelRegistryLineageTrackerConfig', 'LineageEvent', 'TrackerEvent'],
      bk: 'model_registry_lineage_tracker', eks: ['mrgl.event_received', 'mrgl.lineage_recorded', 'mrgl.queries_served', 'mrgl.audit_recorded'],
      subjects: ['sven.mrgl.event_received', 'sven.mrgl.lineage_recorded', 'sven.mrgl.queries_served', 'sven.mrgl.audit_recorded'],
      cases: ['mrgl_receive', 'mrgl_record', 'mrgl_serve', 'mrgl_audit', 'mrgl_report', 'mrgl_monitor'],
    },
    {
      name: 'model_registry_deprecation_warden', migration: '20260626290000_agent_model_registry_deprecation_warden.sql',
      typeFile: 'agent-model-registry-deprecation-warden.ts', skillDir: 'model-registry-deprecation-warden',
      interfaces: ['ModelRegistryDeprecationWardenConfig', 'DeprecationPolicy', 'WardenEvent'],
      bk: 'model_registry_deprecation_warden', eks: ['mrgd.policy_received', 'mrgd.candidates_evaluated', 'mrgd.notices_emitted', 'mrgd.audit_recorded'],
      subjects: ['sven.mrgd.policy_received', 'sven.mrgd.candidates_evaluated', 'sven.mrgd.notices_emitted', 'sven.mrgd.audit_recorded'],
      cases: ['mrgd_receive', 'mrgd_evaluate', 'mrgd_emit', 'mrgd_audit', 'mrgd_report', 'mrgd_monitor'],
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
