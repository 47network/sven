import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'services', 'gateway-api', 'migrations');
const SHARED = path.join(ROOT, 'packages', 'shared', 'src');
const SKILLS = path.join(ROOT, 'skills', 'autonomous-economy');
const TYPES = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'types.ts');
const EVBUS = path.join(ROOT, 'services', 'sven-eidolon', 'src', 'event-bus.ts');
const TASK_EXEC = path.join(ROOT, 'services', 'sven-marketplace', 'src', 'task-executor.ts');
const GITATTR = path.join(ROOT, '.gitattributes');

describe('Batches 288-292: Observability & Monitoring', () => {
  describe('Migrations', () => {
    const migs = [
      { file: '20260619250000_agent_metric_exporter.sql', tables: ['agent_metric_exp_configs', 'agent_metric_series', 'agent_metric_alerts'] },
      { file: '20260619260000_agent_log_shipper.sql', tables: ['agent_log_ship_configs', 'agent_log_pipelines', 'agent_log_destinations'] },
      { file: '20260619270000_agent_alert_manager.sql', tables: ['agent_alert_mgr_configs', 'agent_alert_rules', 'agent_alert_incidents'] },
      { file: '20260619280000_agent_incident_responder.sql', tables: ['agent_incident_resp_configs', 'agent_incidents', 'agent_incident_actions'] },
      { file: '20260619290000_agent_uptime_monitor.sql', tables: ['agent_uptime_configs', 'agent_uptime_endpoints', 'agent_uptime_checks'] },
    ];
    for (const m of migs) {
      it(`creates ${m.file}`, () => {
        const sql = fs.readFileSync(path.join(MIGRATIONS, m.file), 'utf-8');
        for (const t of m.tables) expect(sql).toContain(t);
      });
    }
  });

  describe('Shared types', () => {
    const types = [
      { file: 'agent-metric-exporter.ts', exports: ['MetricFormat', 'MetricType', 'AgentMetricExpConfig'] },
      { file: 'agent-log-shipper.ts', exports: ['LogDestination', 'LogLevel', 'AgentLogShipConfig'] },
      { file: 'agent-alert-manager.ts', exports: ['AlertSeverity', 'IncidentState', 'AgentAlertMgrConfig'] },
      { file: 'agent-incident-responder.ts', exports: ['IncidentSeverity', 'IncidentActionType', 'AgentIncidentRespConfig'] },
      { file: 'agent-uptime-monitor.ts', exports: ['UptimeState', 'CheckMethod', 'AgentUptimeConfig'] },
    ];
    for (const t of types) {
      it(`exports from ${t.file}`, () => {
        const src = fs.readFileSync(path.join(SHARED, t.file), 'utf-8');
        for (const e of t.exports) expect(src).toContain(e);
      });
    }
  });

  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(SHARED, 'index.ts'), 'utf-8');
    for (const m of ['agent-metric-exporter', 'agent-log-shipper', 'agent-alert-manager', 'agent-incident-responder', 'agent-uptime-monitor']) {
      it(`re-exports ${m}`, () => expect(idx).toContain(m));
    }
  });

  describe('SKILL.md files', () => {
    const skills = [
      { dir: 'metric-exporter', name: 'metric-exporter', price: '12.99' },
      { dir: 'log-shipper', name: 'log-shipper', price: '11.99' },
      { dir: 'alert-manager', name: 'alert-manager', price: '13.99' },
      { dir: 'incident-responder', name: 'incident-responder', price: '17.99' },
      { dir: 'uptime-monitor', name: 'uptime-monitor', price: '9.99' },
    ];
    for (const s of skills) {
      it(`has ${s.dir}/SKILL.md with correct metadata`, () => {
        const md = fs.readFileSync(path.join(SKILLS, s.dir, 'SKILL.md'), 'utf-8');
        expect(md).toContain(`name: ${s.name}`);
        expect(md).toContain(`price: ${s.price}`);
        expect(md).toContain('## Actions');
      });
    }
  });

  describe('EidolonBuildingKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const bk of ['metric_exporter', 'log_shipper', 'alert_manager', 'incident_responder', 'uptime_monitor']) {
      it(`has '${bk}'`, () => expect(types).toContain(`'${bk}'`));
    }
  });

  describe('EidolonEventKind', () => {
    const types = fs.readFileSync(TYPES, 'utf-8');
    for (const ek of ['mexp.metric_recorded', 'lship.pipeline_created', 'almgr.rule_created', 'incrs.incident_opened', 'uptm.endpoint_added']) {
      it(`has '${ek}'`, () => expect(types).toContain(`'${ek}'`));
    }
  });

  describe('SUBJECT_MAP', () => {
    const bus = fs.readFileSync(EVBUS, 'utf-8');
    for (const s of ['sven.mexp.metric_recorded', 'sven.lship.pipeline_created', 'sven.almgr.rule_created', 'sven.incrs.incident_opened', 'sven.uptm.endpoint_added']) {
      it(`maps '${s}'`, () => expect(bus).toContain(`'${s}'`));
    }
  });

  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const c of ['mexp_record_metric', 'lship_create_pipeline', 'almgr_create_rule', 'incrs_open_incident', 'uptm_add_endpoint', 'uptm_export_sla']) {
      it(`routes '${c}'`, () => expect(te).toContain(`case '${c}'`));
    }
  });

  describe('Task executor handlers', () => {
    const te = fs.readFileSync(TASK_EXEC, 'utf-8');
    for (const h of ['handleMexpRecordMetric', 'handleLshipCreatePipeline', 'handleAlmgrCreateRule', 'handleIncrsOpenIncident', 'handleUptmAddEndpoint']) {
      it(`has handler ${h}`, () => expect(te).toContain(`${h}(`));
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(GITATTR, 'utf-8');
    for (const f of ['agent-metric-exporter', 'agent-log-shipper', 'agent-alert-manager', 'agent-incident-responder', 'agent-uptime-monitor']) {
      it(`filters ${f}`, () => expect(ga).toContain(f));
    }
  });
});
