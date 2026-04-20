import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 383-387 — Automation & Workflow', () => {
  const verticals = [
    { batch: 383, name: 'workflow_automator', kebab: 'workflow-automator', prefix: 'wfau', ts: 20260620200000, price: '19.99',
      cases: ['wfau_create_workflow','wfau_execute_workflow','wfau_pause_workflow','wfau_resume_workflow','wfau_get_workflow_status','wfau_list_workflows'],
      ek: ['wfau.workflow_created','wfau.workflow_started','wfau.workflow_completed','wfau.step_completed'],
      subjects: ['sven.wfau.workflow_created','sven.wfau.workflow_started','sven.wfau.workflow_completed','sven.wfau.step_completed'],
      types: ['WorkflowStatus','TriggerType','StepStatus','ActionType','WorkflowAutomatorConfig','AgentWorkflow','WorkflowStep'] },
    { batch: 384, name: 'rule_engine', kebab: 'rule-engine', prefix: 'rlng', ts: 20260620210000, price: '16.99',
      cases: ['rlng_create_rule_set','rlng_add_rule','rlng_evaluate','rlng_test_rule','rlng_get_rule_stats','rlng_export_rules'],
      ek: ['rlng.rule_set_created','rlng.rule_evaluated','rlng.rule_matched','rlng.rule_set_exported'],
      subjects: ['sven.rlng.rule_set_created','sven.rlng.rule_evaluated','sven.rlng.rule_matched','sven.rlng.rule_set_exported'],
      types: ['EvaluationMode','ConflictResolution','RuleStatus','ConditionOperator','RuleEngineConfig','RuleSet','AgentRule'] },
    { batch: 385, name: 'event_reactor', kebab: 'event-reactor', prefix: 'evrc', ts: 20260620220000, price: '8.99',
      cases: ['evrc_create_subscription','evrc_process_event','evrc_list_subscriptions','evrc_replay_events','evrc_get_dead_letters','evrc_update_filters'],
      ek: ['evrc.subscription_created','evrc.event_processed','evrc.reaction_completed','evrc.dead_letter_added'],
      subjects: ['sven.evrc.subscription_created','sven.evrc.event_processed','sven.evrc.reaction_completed','sven.evrc.dead_letter_added'],
      types: ['ReactionType','ReactionStatus','EventPriority','FilterMode','EventReactorConfig','EventSubscription','EventReaction'] },
    { batch: 386, name: 'schedule_coordinator', kebab: 'schedule-coordinator', prefix: 'scco', ts: 20260620230000, price: '11.99',
      cases: ['scco_create_job','scco_update_schedule','scco_pause_job','scco_resume_job','scco_get_execution_history','scco_list_upcoming'],
      ek: ['scco.job_created','scco.job_executed','scco.job_paused','scco.execution_completed'],
      subjects: ['sven.scco.job_created','sven.scco.job_executed','sven.scco.job_paused','sven.scco.execution_completed'],
      types: ['OverlapPolicy','JobStatus','ExecutionStatus','JobType','ScheduleCoordinatorConfig','ScheduledJob','JobExecution'] },
    { batch: 387, name: 'process_monitor', kebab: 'process-monitor', prefix: 'prmo', ts: 20260620240000, price: '13.99',
      cases: ['prmo_register_process','prmo_check_health','prmo_get_metrics','prmo_list_alerts','prmo_acknowledge_alert','prmo_configure_thresholds'],
      ek: ['prmo.process_registered','prmo.health_checked','prmo.alert_triggered','prmo.process_restarted'],
      subjects: ['sven.prmo.process_registered','sven.prmo.health_checked','sven.prmo.alert_triggered','sven.prmo.process_restarted'],
      types: ['ProcessType','ProcessStatus','AlertType','MetricName','ProcessMonitorConfig','MonitoredProcess','ProcessAlert'] },
  ];

  describe('Migration SQL files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'services/gateway-api/migrations', `${v.ts}_agent_${v.name}.sql`);
      it(`${v.ts}_agent_${v.name}.sql exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`${v.ts}_agent_${v.name}.sql has CREATE TABLE`, () => expect(fs.readFileSync(file,'utf-8')).toContain('CREATE TABLE'));
      it(`${v.ts}_agent_${v.name}.sql has CREATE INDEX`, () => expect(fs.readFileSync(file,'utf-8')).toContain('CREATE INDEX'));
    });
  });

  describe('Shared type files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'packages/shared/src', `agent-${v.kebab}.ts`);
      it(`agent-${v.kebab}.ts exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`agent-${v.kebab}.ts exports types`, () => { const ts = fs.readFileSync(file,'utf-8'); v.types.forEach(t => expect(ts).toContain(t)); });
    });
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => { it(`exports agent-${v.kebab}`, () => expect(idx).toContain(`./agent-${v.kebab}`)); });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      const file = path.join(ROOT, 'skills/autonomous-economy', v.kebab, 'SKILL.md');
      it(`${v.kebab}/SKILL.md exists`, () => expect(fs.existsSync(file)).toBe(true));
      it(`${v.kebab}/SKILL.md has pricing`, () => expect(fs.readFileSync(file,'utf-8')).toContain(v.price));
      it(`${v.kebab}/SKILL.md has actions`, () => expect(fs.readFileSync(file,'utf-8')).toContain('## Actions'));
    });
  });

  describe('Eidolon BK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => { it(`has '${v.name}'`, () => expect(types).toContain(`'${v.name}'`)); });
  });

  describe('Eidolon EK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => { v.ek.forEach(ek => { it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`)); }); });
  });

  describe('districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => { it(`has case '${v.name}'`, () => expect(types).toContain(`case '${v.name}':`)); });
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    verticals.forEach(v => { v.subjects.forEach(s => { it(`has '${s}'`, () => expect(bus).toContain(`'${s}'`)); }); });
  });

  describe('Task executor switch cases', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    verticals.forEach(v => { v.cases.forEach(c => { it(`has case '${c}'`, () => expect(exec).toContain(`case '${c}'`)); }); });
  });

  describe('Task executor handlers', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleWfauCreateWorkflow','handleWfauExecuteWorkflow','handleWfauPauseWorkflow',
      'handleWfauResumeWorkflow','handleWfauGetWorkflowStatus','handleWfauListWorkflows',
      'handleRlngCreateRuleSet','handleRlngAddRule','handleRlngEvaluate',
      'handleRlngTestRule','handleRlngGetRuleStats','handleRlngExportRules',
      'handleEvrcCreateSubscription','handleEvrcProcessEvent','handleEvrcListSubscriptions',
      'handleEvrcReplayEvents','handleEvrcGetDeadLetters','handleEvrcUpdateFilters',
      'handleSccoCreateJob','handleSccoUpdateSchedule','handleSccoPauseJob',
      'handleSccoResumeJob','handleSccoGetExecutionHistory','handleSccoListUpcoming',
      'handlePrmoRegisterProcess','handlePrmoCheckHealth','handlePrmoGetMetrics',
      'handlePrmoListAlerts','handlePrmoAcknowledgeAlert','handlePrmoConfigureThresholds',
    ];
    handlers.forEach(h => { it(`has ${h}`, () => expect(exec).toContain(h)); });
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`has entry for ${v.ts}_agent_${v.name}.sql`, () => expect(ga).toContain(`${v.ts}_agent_${v.name}.sql`));
      it(`has entry for agent-${v.kebab}.ts`, () => expect(ga).toContain(`agent-${v.kebab}.ts`));
      it(`has entry for ${v.kebab}/SKILL.md`, () => expect(ga).toContain(`${v.kebab}/SKILL.md`));
    });
  });
});
