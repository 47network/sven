import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Container Registry management verticals', () => {
  const verticals = [
    {
      name: 'container_registry_scanner', migration: '20260627700000_agent_container_registry_scanner.sql',
      typeFile: 'agent-container-registry-scanner.ts', skillDir: 'container-registry-scanner',
      interfaces: ['RegistryScanConfig', 'RegistryScanResult', 'RegistryVulnReport'],
      bk: 'container_registry_scanner', eks: ['crs.scan_initiated', 'crs.vuln_detected', 'crs.export_emitted'],
      subjects: ['sven.crs.scan_initiated', 'sven.crs.vuln_detected', 'sven.crs.export_emitted'],
      cases: ['crs_reporter'],
    },
    {
      name: 'container_registry_replicator', migration: '20260627710000_agent_container_registry_replicator.sql',
      typeFile: 'agent-container-registry-replicator.ts', skillDir: 'container-registry-replicator',
      interfaces: ['ReplicationConfig', 'ReplicationStatus', 'ReplicationPolicy'],
      bk: 'container_registry_replicator', eks: ['crr.replication_started', 'crr.sync_completed', 'crr.export_emitted'],
      subjects: ['sven.crr.replication_started', 'sven.crr.sync_completed', 'sven.crr.export_emitted'],
      cases: ['crr_reporter'],
    },
    {
      name: 'container_registry_cleaner', migration: '20260627720000_agent_container_registry_cleaner.sql',
      typeFile: 'agent-container-registry-cleaner.ts', skillDir: 'container-registry-cleaner',
      interfaces: ['CleanupConfig', 'CleanupResult', 'RetentionPolicy'],
      bk: 'container_registry_cleaner', eks: ['crc.cleanup_started', 'crc.images_removed', 'crc.export_emitted'],
      subjects: ['sven.crc.cleanup_started', 'sven.crc.images_removed', 'sven.crc.export_emitted'],
      cases: ['crc_reporter'],
    },
    {
      name: 'container_image_signer', migration: '20260627730000_agent_container_image_signer.sql',
      typeFile: 'agent-container-image-signer.ts', skillDir: 'container-image-signer',
      interfaces: ['SigningConfig', 'SignatureResult', 'TrustPolicy'],
      bk: 'container_image_signer', eks: ['cis.signing_initiated', 'cis.signature_applied', 'cis.export_emitted'],
      subjects: ['sven.cis.signing_initiated', 'sven.cis.signature_applied', 'sven.cis.export_emitted'],
      cases: ['cis_reporter'],
    },
    {
      name: 'container_registry_auditor', migration: '20260627740000_agent_container_registry_auditor.sql',
      typeFile: 'agent-container-registry-auditor.ts', skillDir: 'container-registry-auditor',
      interfaces: ['RegistryAuditConfig', 'RegistryAuditResult', 'RegistryAccessReport'],
      bk: 'container_registry_auditor', eks: ['cra.audit_started', 'cra.findings_reported', 'cra.export_emitted'],
      subjects: ['sven.cra.audit_started', 'sven.cra.findings_reported', 'sven.cra.export_emitted'],
      cases: ['cra_reporter'],
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
