import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 418-422 — Infrastructure Resilience', () => {

  const verticals = [
    { name: 'incident_commander', file: 'agent-incident-commander', migration: '20260620550000_agent_incident_commander.sql', skillDir: 'incident-commander', prefix: 'incd', cases: ['incd_declare_incident','incd_assign_responder','incd_escalate','incd_update_timeline','incd_resolve_incident','incd_generate_postmortem'], ek: ['incd.incident_declared','incd.responder_assigned','incd.incident_escalated','incd.incident_resolved'], subj: ['sven.incd.incident_declared','sven.incd.responder_assigned','sven.incd.incident_escalated','sven.incd.incident_resolved'] },
    { name: 'failure_injector', file: 'agent-failure-injector', migration: '20260620560000_agent_failure_injector.sql', skillDir: 'failure-injector', prefix: 'flij', cases: ['flij_create_experiment','flij_run_experiment','flij_abort_experiment','flij_analyze_results','flij_generate_report','flij_schedule_gameday'], ek: ['flij.experiment_created','flij.experiment_started','flij.experiment_completed','flij.experiment_aborted'], subj: ['sven.flij.experiment_created','sven.flij.experiment_started','sven.flij.experiment_completed','sven.flij.experiment_aborted'] },
    { name: 'service_mesh_router', file: 'agent-service-mesh-router', migration: '20260620570000_agent_service_mesh_router.sql', skillDir: 'service-mesh-router', prefix: 'smrt', cases: ['smrt_register_service','smrt_configure_routing','smrt_create_rule','smrt_health_check','smrt_toggle_circuit_breaker','smrt_export_topology'], ek: ['smrt.service_registered','smrt.routing_configured','smrt.rule_created','smrt.health_checked'], subj: ['sven.smrt.service_registered','sven.smrt.routing_configured','sven.smrt.rule_created','sven.smrt.health_checked'] },
    { name: 'cache_optimizer', file: 'agent-cache-optimizer', migration: '20260620580000_agent_cache_optimizer.sql', skillDir: 'cache-optimizer', prefix: 'copt', cases: ['copt_analyze_cache','copt_optimize_ttl','copt_warm_cache','copt_evict_stale','copt_resize_cache','copt_generate_report'], ek: ['copt.cache_analyzed','copt.ttl_optimized','copt.cache_warmed','copt.stale_evicted'], subj: ['sven.copt.cache_analyzed','sven.copt.ttl_optimized','sven.copt.cache_warmed','sven.copt.stale_evicted'] },
    { name: 'log_indexer', file: 'agent-log-indexer', migration: '20260620590000_agent_log_indexer.sql', skillDir: 'log-indexer', prefix: 'lgix', cases: ['lgix_create_index','lgix_ingest_logs','lgix_search_logs','lgix_save_query','lgix_configure_retention','lgix_export_results'], ek: ['lgix.index_created','lgix.logs_ingested','lgix.query_executed','lgix.retention_configured'], subj: ['sven.lgix.index_created','sven.lgix.logs_ingested','sven.lgix.query_executed','sven.lgix.retention_configured'] },
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
      'handleIncdDeclareIncident','handleIncdAssignResponder','handleIncdEscalate','handleIncdUpdateTimeline','handleIncdResolveIncident','handleIncdGeneratePostmortem',
      'handleFlijCreateExperiment','handleFlijRunExperiment','handleFlijAbortExperiment','handleFlijAnalyzeResults','handleFlijGenerateReport','handleFlijScheduleGameday',
      'handleSmrtRegisterService','handleSmrtConfigureRouting','handleSmrtCreateRule','handleSmrtHealthCheck','handleSmrtToggleCircuitBreaker','handleSmrtExportTopology',
      'handleCoptAnalyzeCache','handleCoptOptimizeTtl','handleCoptWarmCache','handleCoptEvictStale','handleCoptResizeCache','handleCoptGenerateReport',
      'handleLgixCreateIndex','handleLgixIngestLogs','handleLgixSearchLogs','handleLgixSaveQuery','handleLgixConfigureRetention','handleLgixExportResults',
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
