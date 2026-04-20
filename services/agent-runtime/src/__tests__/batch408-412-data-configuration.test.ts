import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 408-412 — Data & Configuration', () => {

  const verticals = [
    { name: 'etl_processor', file: 'agent-etl-processor', migration: '20260620450000_agent_etl_processor.sql', skillDir: 'etl-processor', prefix: 'etlp', cases: ['etlp_create_pipeline','etlp_run_pipeline','etlp_get_run_status','etlp_list_pipelines','etlp_schedule_pipeline','etlp_cancel_run'], ek: ['etlp.pipeline_created','etlp.run_started','etlp.run_completed','etlp.run_failed'], subj: ['sven.etlp.pipeline_created','sven.etlp.run_started','sven.etlp.run_completed','sven.etlp.run_failed'] },
    { name: 'schema_validator', file: 'agent-schema-validator', migration: '20260620460000_agent_schema_validator.sql', skillDir: 'schema-validator', prefix: 'schv', cases: ['schv_register_schema','schv_validate_data','schv_check_compatibility','schv_list_schemas','schv_get_schema','schv_deprecate_schema'], ek: ['schv.schema_registered','schv.data_validated','schv.compatibility_checked','schv.schema_deprecated'], subj: ['sven.schv.schema_registered','sven.schv.data_validated','sven.schv.compatibility_checked','sven.schv.schema_deprecated'] },
    { name: 'config_registry', file: 'agent-config-registry', migration: '20260620470000_agent_config_registry.sql', skillDir: 'config-registry', prefix: 'cfgr', cases: ['cfgr_set_config','cfgr_get_config','cfgr_list_configs','cfgr_rollback_config','cfgr_compare_environments','cfgr_get_change_log'], ek: ['cfgr.config_set','cfgr.config_rolled_back','cfgr.environment_compared','cfgr.secret_rotated'], subj: ['sven.cfgr.config_set','sven.cfgr.config_rolled_back','sven.cfgr.environment_compared','sven.cfgr.secret_rotated'] },
    { name: 'feature_flag_engine', file: 'agent-feature-flag-engine', migration: '20260620480000_agent_feature_flag_engine.sql', skillDir: 'feature-flag-engine', prefix: 'ffeg', cases: ['ffeg_create_flag','ffeg_evaluate_flag','ffeg_update_flag','ffeg_toggle_flag','ffeg_set_rollout','ffeg_get_evaluations'], ek: ['ffeg.flag_created','ffeg.flag_toggled','ffeg.rollout_updated','ffeg.flag_evaluated'], subj: ['sven.ffeg.flag_created','sven.ffeg.flag_toggled','sven.ffeg.rollout_updated','sven.ffeg.flag_evaluated'] },
    { name: 'health_monitor', file: 'agent-health-monitor', migration: '20260620490000_agent_health_monitor.sql', skillDir: 'health-monitor', prefix: 'hlmn', cases: ['hlmn_create_check','hlmn_run_check','hlmn_get_status','hlmn_list_incidents','hlmn_acknowledge_incident','hlmn_resolve_incident'], ek: ['hlmn.check_created','hlmn.status_changed','hlmn.incident_opened','hlmn.incident_resolved'], subj: ['sven.hlmn.check_created','sven.hlmn.status_changed','sven.hlmn.incident_opened','sven.hlmn.incident_resolved'] },
  ];

  describe('Migration files', () => {
    verticals.forEach(v => {
      it(`migration exists: ${v.migration}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`migration has CREATE TABLE: ${v.name}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE TABLE');
      });
      it(`migration has agent_ prefix tables: ${v.name}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(`agent_${v.name}`);
      });
    });
  });

  describe('Shared type files', () => {
    verticals.forEach(v => {
      it(`type file exists: ${v.file}.ts`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`type file has export: ${v.file}`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('export');
      });
      it(`type file has interface: ${v.file}`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('interface');
      });
    });
  });

  describe('Barrel exports', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`index.ts exports ${v.file}`, () => {
        expect(indexContent).toContain(v.file);
      });
    });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      it(`SKILL.md exists: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`SKILL.md has Actions: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });
      it(`SKILL.md has frontmatter: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content.startsWith('---')).toBe(true);
      });
    });
  });

  describe('Eidolon types.ts — BK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`BK includes '${v.name}'`, () => {
        expect(types).toContain(`'${v.name}'`);
      });
    });
  });

  describe('Eidolon types.ts — EK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      v.ek.forEach(ek => {
        it(`EK includes '${ek}'`, () => {
          expect(types).toContain(`'${ek}'`);
        });
      });
    });
  });

  describe('Eidolon types.ts — districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`districtFor has case '${v.name}'`, () => {
        expect(types).toContain(`case '${v.name}'`);
      });
    });
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    verticals.forEach(v => {
      v.subj.forEach(s => {
        it(`SUBJECT_MAP has '${s}'`, () => {
          expect(eb).toContain(`'${s}'`);
        });
      });
    });
  });

  describe('Task executor — switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    verticals.forEach(v => {
      v.cases.forEach(cs => {
        it(`switch case '${cs}'`, () => {
          expect(te).toContain(`case '${cs}'`);
        });
      });
    });
  });

  describe('Task executor — handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleEtlpCreatePipeline','handleEtlpRunPipeline','handleEtlpGetRunStatus','handleEtlpListPipelines','handleEtlpSchedulePipeline','handleEtlpCancelRun',
      'handleSchvRegisterSchema','handleSchvValidateData','handleSchvCheckCompatibility','handleSchvListSchemas','handleSchvGetSchema','handleSchvDeprecateSchema',
      'handleCfgrSetConfig','handleCfgrGetConfig','handleCfgrListConfigs','handleCfgrRollbackConfig','handleCfgrCompareEnvironments','handleCfgrGetChangeLog',
      'handleFfegCreateFlag','handleFfegEvaluateFlag','handleFfegUpdateFlag','handleFfegToggleFlag','handleFfegSetRollout','handleFfegGetEvaluations',
      'handleHlmnCreateCheck','handleHlmnRunCheck','handleHlmnGetStatus','handleHlmnListIncidents','handleHlmnAcknowledgeIncident','handleHlmnResolveIncident',
    ];
    handlers.forEach(h => {
      it(`handler ${h} exists`, () => {
        expect(te).toContain(h);
      });
    });
  });

  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`gitattributes has migration: ${v.migration}`, () => {
        expect(ga).toContain(v.migration);
      });
      it(`gitattributes has type file: ${v.file}`, () => {
        expect(ga).toContain(`${v.file}.ts`);
      });
      it(`gitattributes has skill dir: ${v.skillDir}`, () => {
        expect(ga).toContain(v.skillDir);
      });
    });
  });
});
