import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 413-417 — Observability & Reliability', () => {

  const verticals = [
    { name: 'alert_router', file: 'agent-alert-router', migration: '20260620500000_agent_alert_router.sql', skillDir: 'alert-router', prefix: 'alrt', cases: ['alrt_create_rule','alrt_fire_alert','alrt_list_rules','alrt_get_history','alrt_update_rule','alrt_suppress_alert'], ek: ['alrt.rule_created','alrt.alert_fired','alrt.alert_delivered','alrt.rule_suppressed'], subj: ['sven.alrt.rule_created','sven.alrt.alert_fired','sven.alrt.alert_delivered','sven.alrt.rule_suppressed'] },
    { name: 'telemetry_collector', file: 'agent-telemetry-collector', migration: '20260620510000_agent_telemetry_collector.sql', skillDir: 'telemetry-collector', prefix: 'tlmc', cases: ['tlmc_record_metric','tlmc_query_metrics','tlmc_create_dashboard','tlmc_list_dashboards','tlmc_get_summary','tlmc_configure_retention'], ek: ['tlmc.metric_recorded','tlmc.dashboard_created','tlmc.retention_applied','tlmc.summary_generated'], subj: ['sven.tlmc.metric_recorded','sven.tlmc.dashboard_created','sven.tlmc.retention_applied','sven.tlmc.summary_generated'] },
    { name: 'runbook_executor', file: 'agent-runbook-executor', migration: '20260620520000_agent_runbook_executor.sql', skillDir: 'runbook-executor', prefix: 'rnbk', cases: ['rnbk_create_runbook','rnbk_execute_runbook','rnbk_get_execution','rnbk_list_runbooks','rnbk_cancel_execution','rnbk_clone_runbook'], ek: ['rnbk.runbook_created','rnbk.execution_started','rnbk.execution_completed','rnbk.execution_failed'], subj: ['sven.rnbk.runbook_created','sven.rnbk.execution_started','sven.rnbk.execution_completed','sven.rnbk.execution_failed'] },
    { name: 'dependency_resolver', file: 'agent-dependency-resolver', migration: '20260620530000_agent_dependency_resolver.sql', skillDir: 'dependency-resolver', prefix: 'depr', cases: ['depr_resolve_graph','depr_check_conflicts','depr_suggest_resolution','depr_list_graphs','depr_update_graph','depr_export_lockfile'], ek: ['depr.graph_resolved','depr.conflict_detected','depr.resolution_applied','depr.lockfile_exported'], subj: ['sven.depr.graph_resolved','sven.depr.conflict_detected','sven.depr.resolution_applied','sven.depr.lockfile_exported'] },
    { name: 'resource_quoter', file: 'agent-resource-quoter', migration: '20260620540000_agent_resource_quoter.sql', skillDir: 'resource-quoter', prefix: 'rsqt', cases: ['rsqt_create_quote','rsqt_approve_quote','rsqt_allocate_resources','rsqt_release_resources','rsqt_list_quotes','rsqt_get_spending'], ek: ['rsqt.quote_created','rsqt.quote_approved','rsqt.resources_allocated','rsqt.resources_released'], subj: ['sven.rsqt.quote_created','sven.rsqt.quote_approved','sven.rsqt.resources_allocated','sven.rsqt.resources_released'] },
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
      'handleAlrtCreateRule','handleAlrtFireAlert','handleAlrtListRules','handleAlrtGetHistory','handleAlrtUpdateRule','handleAlrtSuppressAlert',
      'handleTlmcRecordMetric','handleTlmcQueryMetrics','handleTlmcCreateDashboard','handleTlmcListDashboards','handleTlmcGetSummary','handleTlmcConfigureRetention',
      'handleRnbkCreateRunbook','handleRnbkExecuteRunbook','handleRnbkGetExecution','handleRnbkListRunbooks','handleRnbkCancelExecution','handleRnbkCloneRunbook',
      'handleDeprResolveGraph','handleDeprCheckConflicts','handleDeprSuggestResolution','handleDeprListGraphs','handleDeprUpdateGraph','handleDeprExportLockfile',
      'handleRsqtCreateQuote','handleRsqtApproveQuote','handleRsqtAllocateResources','handleRsqtReleaseResources','handleRsqtListQuotes','handleRsqtGetSpending',
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
