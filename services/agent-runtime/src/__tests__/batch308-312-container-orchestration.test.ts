import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 308-312 — Container & Orchestration', () => {
  const migrationFiles = [
    '20260619450000_agent_container_builder.sql',
    '20260619460000_agent_image_registry.sql',
    '20260619470000_agent_orchestrator.sql',
    '20260619480000_agent_svc_mesh.sql',
    '20260619490000_agent_config_manager.sql',
  ];
  describe('Migration files', () => {
    migrationFiles.forEach((file) => {
      it(`should have migration ${file}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', file);
        expect(fs.existsSync(p)).toBe(true);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE TABLE');
        expect(sql.length).toBeGreaterThan(200);
      });
    });
  });

  const typeFiles = [
    'agent-container-builder', 'agent-image-registry', 'agent-orchestrator',
    'agent-svc-mesh', 'agent-config-manager',
  ];
  describe('Shared type files', () => {
    typeFiles.forEach((file) => {
      it(`should have type file ${file}.ts`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${file}.ts`);
        expect(fs.existsSync(p)).toBe(true);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('export');
        expect(content).toContain('interface');
      });
    });
  });

  describe('Barrel exports', () => {
    it('should export all 5 type modules from index.ts', () => {
      const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
      typeFiles.forEach((file) => {
        expect(idx).toContain(file);
      });
    });
  });

  const skills = ['container-builder', 'image-registry', 'orchestrator', 'svc-mesh', 'config-manager'];
  describe('SKILL.md files', () => {
    skills.forEach((skill) => {
      it(`should have SKILL.md for ${skill}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', skill, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
        expect(content).toContain('price');
      });
    });
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    ['container_builder', 'image_registry', 'orchestrator', 'svc_mesh', 'config_manager'].forEach((bk) => {
      it(`should include BK '${bk}'`, () => {
        expect(types).toContain(`'${bk}'`);
      });
    });
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    const eks = [
      'cbld.image_built', 'cbld.layers_optimized', 'cbld.scan_completed', 'cbld.config_exported',
      'ireg.repo_created', 'ireg.image_pushed', 'ireg.gc_completed', 'ireg.tags_listed',
      'orch.deployed', 'orch.scaled', 'orch.rolled_back', 'orch.health_checked',
      'smsh.route_created', 'smsh.policy_applied', 'smsh.breaker_toggled', 'smsh.traffic_shifted',
      'cfmg.config_set', 'cfmg.config_retrieved', 'cfmg.config_rolled_back', 'cfmg.config_exported',
    ];
    eks.forEach((ek) => {
      it(`should include EK '${ek}'`, () => {
        expect(types).toContain(`'${ek}'`);
      });
    });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    ['container_builder', 'image_registry', 'orchestrator', 'svc_mesh', 'config_manager'].forEach((bk) => {
      it(`should have districtFor case for '${bk}'`, () => {
        expect(types).toContain(`case '${bk}':`);
      });
    });
  });

  describe('SUBJECT_MAP entries', () => {
    const eventBus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.cbld.image_built', 'sven.cbld.layers_optimized', 'sven.cbld.scan_completed', 'sven.cbld.config_exported',
      'sven.ireg.repo_created', 'sven.ireg.image_pushed', 'sven.ireg.gc_completed', 'sven.ireg.tags_listed',
      'sven.orch.deployed', 'sven.orch.scaled', 'sven.orch.rolled_back', 'sven.orch.health_checked',
      'sven.smsh.route_created', 'sven.smsh.policy_applied', 'sven.smsh.breaker_toggled', 'sven.smsh.traffic_shifted',
      'sven.cfmg.config_set', 'sven.cfmg.config_retrieved', 'sven.cfmg.config_rolled_back', 'sven.cfmg.config_exported',
    ];
    subjects.forEach((subj) => {
      it(`should have SUBJECT_MAP entry '${subj}'`, () => {
        expect(eventBus).toContain(`'${subj}'`);
      });
    });
  });

  describe('Task executor switch cases', () => {
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'cbld_build_image', 'cbld_optimize_layers', 'cbld_scan_image', 'cbld_multi_stage', 'cbld_list_builds', 'cbld_export_config',
      'ireg_create_repo', 'ireg_push_image', 'ireg_list_tags', 'ireg_garbage_collect', 'ireg_list_repos', 'ireg_export_config',
      'orch_deploy', 'orch_scale', 'orch_rollback', 'orch_health_check', 'orch_list_deployments', 'orch_export_config',
      'smsh_create_route', 'smsh_apply_policy', 'smsh_toggle_breaker', 'smsh_traffic_shift', 'smsh_list_routes', 'smsh_export_config',
      'cfmg_set_config', 'cfmg_get_config', 'cfmg_list_configs', 'cfmg_rollback_config', 'cfmg_list_history', 'cfmg_export_config',
    ];
    cases.forEach((c) => {
      it(`should have switch case '${c}'`, () => {
        expect(executor).toContain(`case '${c}'`);
      });
    });
  });

  describe('Task executor handler methods', () => {
    const executor = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleCbldBuildImage', 'handleCbldOptimizeLayers', 'handleCbldScanImage', 'handleCbldMultiStage', 'handleCbldListBuilds', 'handleCbldExportConfig',
      'handleIregCreateRepo', 'handleIregPushImage', 'handleIregListTags', 'handleIregGarbageCollect', 'handleIregListRepos', 'handleIregExportConfig',
      'handleOrchDeploy', 'handleOrchScale', 'handleOrchRollback', 'handleOrchHealthCheck', 'handleOrchListDeployments', 'handleOrchExportConfig',
      'handleSmshCreateRoute', 'handleSmshApplyPolicy', 'handleSmshToggleBreaker', 'handleSmshTrafficShift', 'handleSmshListRoutes', 'handleSmshExportConfig',
      'handleCfmgSetConfig', 'handleCfmgGetConfig', 'handleCfmgListConfigs', 'handleCfmgRollbackConfig', 'handleCfmgListHistory', 'handleCfmgExportConfig',
    ];
    handlers.forEach((h) => {
      it(`should have handler method ${h}`, () => {
        expect(executor).toContain(`${h}(task`);
      });
    });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    const entries = [
      'agent_container_builder.sql', 'agent_image_registry.sql', 'agent_orchestrator.sql',
      'agent_svc_mesh.sql', 'agent_config_manager.sql',
      'agent-container-builder.ts', 'agent-image-registry.ts', 'agent-orchestrator.ts',
      'agent-svc-mesh.ts', 'agent-config-manager.ts',
      'container-builder/**', 'image-registry/**', 'orchestrator/**',
      'svc-mesh/**', 'config-manager/**',
    ];
    entries.forEach((entry) => {
      it(`should have .gitattributes entry for ${entry}`, () => {
        expect(ga).toContain(entry);
      });
    });
  });
});
