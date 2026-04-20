import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 278-282 — Cloud Infrastructure', () => {
  const verticals = [
    { name: 'cloud_provisioner', typefile: 'agent-cloud-provisioner', migration: '20260619150000_agent_cloud_provisioner.sql', skill: 'cloud-provisioner', tables: ['agent_cloud_prov_configs','agent_cloud_prov_resources','agent_cloud_prov_events'] },
    { name: 'vm_orchestrator', typefile: 'agent-vm-orchestrator', migration: '20260619160000_agent_vm_orchestrator.sql', skill: 'vm-orchestrator', tables: ['agent_vm_orch_configs','agent_vm_instances','agent_vm_snapshots'] },
    { name: 'registry_manager', typefile: 'agent-registry-manager', migration: '20260619170000_agent_registry_manager.sql', skill: 'registry-manager', tables: ['agent_reg_mgr_configs','agent_reg_repositories','agent_reg_tags'] },
    { name: 'image_builder', typefile: 'agent-image-builder', migration: '20260619180000_agent_image_builder.sql', skill: 'image-builder', tables: ['agent_img_builder_configs','agent_img_builds','agent_img_layers'] },
    { name: 'artifact_store', typefile: 'agent-artifact-store', migration: '20260619190000_agent_artifact_store.sql', skill: 'artifact-store', tables: ['agent_artifact_store_configs','agent_artifacts','agent_artifact_access_log'] },
  ];

  describe('Migration SQL files', () => {
    verticals.forEach(v => {
      it(`${v.migration} exists and creates tables`, () => {
        const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', v.migration), 'utf-8');
        v.tables.forEach(t => expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`));
      });
    });
  });

  describe('Shared TypeScript types', () => {
    verticals.forEach(v => {
      it(`${v.typefile}.ts exists with exports`, () => {
        const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src', `${v.typefile}.ts`), 'utf-8');
        expect(ts).toContain('export');
      });
    });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`index.ts exports ${v.typefile}`, () => { expect(idx).toContain(v.typefile); });
    });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      it(`${v.skill}/SKILL.md exists with Actions`, () => {
        const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy', v.skill, 'SKILL.md'), 'utf-8');
        expect(md).toContain('## Actions');
        expect(md).toContain('price');
      });
    });
  });

  describe('Eidolon types.ts', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const bks = ['cloud_provisioner','vm_orchestrator','registry_manager','image_builder','artifact_store'];
    bks.forEach(bk => {
      it(`BK contains '${bk}'`, () => { expect(types).toContain(`'${bk}'`); });
    });
    const eks = ['cprov.resource_provisioned','vmorch.vm_created','regmgr.repo_created','imgbld.build_started','artstore.artifact_uploaded'];
    eks.forEach(ek => {
      it(`EK contains '${ek}'`, () => { expect(types).toContain(`'${ek}'`); });
    });
    it('districtFor handles cloud_provisioner', () => { expect(types).toContain("case 'cloud_provisioner':"); });
  });

  describe('Event bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = ['sven.cprov.resource_provisioned','sven.vmorch.vm_created','sven.regmgr.repo_created','sven.imgbld.build_started','sven.artstore.artifact_uploaded'];
    subjects.forEach(s => {
      it(`SUBJECT_MAP has '${s}'`, () => { expect(eb).toContain(`'${s}'`); });
    });
  });

  describe('Task executor', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = ['cprov_configure','cprov_provision_resource','vmorch_configure','vmorch_create_vm','regmgr_configure','regmgr_create_repo','imgbld_configure','imgbld_build_image','artstore_configure','artstore_upload'];
    cases.forEach(c => {
      it(`routes '${c}'`, () => { expect(te).toContain(`case '${c}'`); });
    });
    const handlers = ['handleCprovConfigure','handleVmorchConfigure','handleRegmgrConfigure','handleImgbldConfigure','handleArtstoreConfigure'];
    handlers.forEach(h => {
      it(`has handler ${h}`, () => { expect(te).toContain(h); });
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`filters ${v.typefile}`, () => { expect(ga).toContain(v.typefile); });
    });
  });
});
