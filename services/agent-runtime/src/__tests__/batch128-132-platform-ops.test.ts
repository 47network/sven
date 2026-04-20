import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 128-132 — Platform Operations', () => {

  // ── Batch 128: Agent Feature Flags ──
  describe('Batch 128 — Agent Feature Flags', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260617650000_agent_feature_flags.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-feature-flags.ts');
    const skillPath = path.join(ROOT, 'skills/agent-feature-flags/SKILL.md');

    test('migration file exists', () => expect(fs.existsSync(migrationPath)).toBe(true));
    test('migration creates agent_feature_flags table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('CREATE TABLE');
      expect(sql).toContain('agent_feature_flags');
    });
    test('migration creates agent_flag_evaluations table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_flag_evaluations');
    });
    test('migration creates agent_flag_audit_log table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_flag_audit_log');
    });
    test('shared types file exists', () => expect(fs.existsSync(typesPath)).toBe(true));
    test('types export FeatureFlagType', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('FeatureFlagType');
    });
    test('types export ManagedFeatureFlag', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('ManagedFeatureFlag');
    });
    test('types export FeatureFlagStats', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('FeatureFlagStats');
    });
    test('skill file exists', () => expect(fs.existsSync(skillPath)).toBe(true));
    test('skill defines actions', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('create-flag');
      expect(md).toContain('evaluate-flag');
    });
  });

  // ── Batch 129: Agent Health Monitoring ──
  describe('Batch 129 — Agent Health Monitoring', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260617660000_agent_health_monitoring.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-health-monitoring.ts');
    const skillPath = path.join(ROOT, 'skills/agent-health-monitoring/SKILL.md');

    test('migration file exists', () => expect(fs.existsSync(migrationPath)).toBe(true));
    test('migration creates agent_health_checks table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_health_checks');
    });
    test('migration creates agent_health_events table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_health_events');
    });
    test('migration creates agent_uptime_records table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_uptime_records');
    });
    test('shared types file exists', () => expect(fs.existsSync(typesPath)).toBe(true));
    test('types export HealthCheckType', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('HealthCheckType');
    });
    test('types export ServiceHealthCheck', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('ServiceHealthCheck');
    });
    test('skill file exists', () => expect(fs.existsSync(skillPath)).toBe(true));
    test('skill defines health check actions', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('create-check');
      expect(md).toContain('run-check');
    });
  });

  // ── Batch 130: Agent Cost Optimization ──
  describe('Batch 130 — Agent Cost Optimization', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260617670000_agent_cost_optimization.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-cost-optimization.ts');
    const skillPath = path.join(ROOT, 'skills/agent-cost-optimization/SKILL.md');

    test('migration file exists', () => expect(fs.existsSync(migrationPath)).toBe(true));
    test('migration creates agent_cost_reports table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_cost_reports');
    });
    test('migration creates agent_cost_recommendations table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_cost_recommendations');
    });
    test('migration creates agent_budget_alerts table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_budget_alerts');
    });
    test('shared types file exists', () => expect(fs.existsSync(typesPath)).toBe(true));
    test('types export CostReportPeriod', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('CostReportPeriod');
    });
    test('types export CostOptimizationStats', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('CostOptimizationStats');
    });
    test('skill file exists', () => expect(fs.existsSync(skillPath)).toBe(true));
    test('skill defines cost actions', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('generate-report');
      expect(md).toContain('set-budget');
    });
  });

  // ── Batch 131: Agent Data Pipeline ──
  describe('Batch 131 — Agent Data Pipeline', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260617680000_agent_data_pipeline.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-data-pipeline.ts');
    const skillPath = path.join(ROOT, 'skills/agent-data-pipeline/SKILL.md');

    test('migration file exists', () => expect(fs.existsSync(migrationPath)).toBe(true));
    test('migration creates agent_data_pipelines table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_data_pipelines');
    });
    test('migration creates agent_pipeline_runs table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_pipeline_runs');
    });
    test('migration creates agent_pipeline_transforms table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_pipeline_transforms');
    });
    test('shared types file exists', () => expect(fs.existsSync(typesPath)).toBe(true));
    test('types export PipelineType', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('PipelineType');
    });
    test('types export DataPipelineStats', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('DataPipelineStats');
    });
    test('skill file exists', () => expect(fs.existsSync(skillPath)).toBe(true));
    test('skill defines pipeline actions', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('create-pipeline');
      expect(md).toContain('run-pipeline');
    });
  });

  // ── Batch 132: Agent Notification Router ──
  describe('Batch 132 — Agent Notification Router', () => {
    const migrationPath = path.join(ROOT, 'services/gateway-api/migrations/20260617690000_agent_notification_router.sql');
    const typesPath = path.join(ROOT, 'packages/shared/src/agent-notification-router.ts');
    const skillPath = path.join(ROOT, 'skills/agent-notification-router/SKILL.md');

    test('migration file exists', () => expect(fs.existsSync(migrationPath)).toBe(true));
    test('migration creates agent_notification_channels table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_notification_channels');
    });
    test('migration creates agent_notification_rules table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_notification_rules');
    });
    test('migration creates agent_notification_log table', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('agent_notification_log');
    });
    test('shared types file exists', () => expect(fs.existsSync(typesPath)).toBe(true));
    test('types export NotificationChannelType', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('NotificationChannelType');
    });
    test('types export NotificationRouterStats', () => {
      const src = fs.readFileSync(typesPath, 'utf-8');
      expect(src).toContain('NotificationRouterStats');
    });
    test('skill file exists', () => expect(fs.existsSync(skillPath)).toBe(true));
    test('skill defines notification actions', () => {
      const md = fs.readFileSync(skillPath, 'utf-8');
      expect(md).toContain('create-channel');
      expect(md).toContain('send-notification');
    });
  });

  // ── Cross-batch: Eidolon wiring ──
  describe('Eidolon wiring — Batches 128-132', () => {
    const typesPath = path.join(ROOT, 'services/sven-eidolon/src/types.ts');
    const eventBusPath = path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts');
    let types: string;
    let eventBus: string;

    beforeAll(() => {
      types = fs.readFileSync(typesPath, 'utf-8');
      eventBus = fs.readFileSync(eventBusPath, 'utf-8');
    });

    test('BK includes flag_tower', () => expect(types).toContain("'flag_tower'"));
    test('BK includes health_beacon', () => expect(types).toContain("'health_beacon'"));
    test('BK includes cost_bureau', () => expect(types).toContain("'cost_bureau'"));
    test('BK includes data_forge', () => expect(types).toContain("'data_forge'"));
    test('BK includes alert_hub', () => expect(types).toContain("'alert_hub'"));

    test('EK includes featureflag events', () => expect(types).toContain("'featureflag.flag_created'"));
    test('EK includes healthmon events', () => expect(types).toContain("'healthmon.check_created'"));
    test('EK includes costopt events', () => expect(types).toContain("'costopt.report_generated'"));
    test('EK includes datapipe events', () => expect(types).toContain("'datapipe.pipeline_created'"));
    test('EK includes notifrouter events', () => expect(types).toContain("'notifrouter.channel_created'"));

    test('districtFor handles flag_tower', () => expect(types).toContain("case 'flag_tower':"));
    test('districtFor handles health_beacon', () => expect(types).toContain("case 'health_beacon':"));
    test('districtFor handles cost_bureau', () => expect(types).toContain("case 'cost_bureau':"));
    test('districtFor handles data_forge', () => expect(types).toContain("case 'data_forge':"));
    test('districtFor handles alert_hub', () => expect(types).toContain("case 'alert_hub':"));

    test('SUBJECT_MAP has featureflag entries', () => expect(eventBus).toContain("'sven.featureflag.flag_created'"));
    test('SUBJECT_MAP has healthmon entries', () => expect(eventBus).toContain("'sven.healthmon.check_created'"));
    test('SUBJECT_MAP has costopt entries', () => expect(eventBus).toContain("'sven.costopt.report_generated'"));
    test('SUBJECT_MAP has datapipe entries', () => expect(eventBus).toContain("'sven.datapipe.pipeline_created'"));
    test('SUBJECT_MAP has notifrouter entries', () => expect(eventBus).toContain("'sven.notifrouter.channel_created'"));
  });

  // ── Cross-batch: Task executor ──
  describe('Task executor — Batches 128-132', () => {
    const taskExecPath = path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts');
    let src: string;

    beforeAll(() => { src = fs.readFileSync(taskExecPath, 'utf-8'); });

    test('has featureflag switch cases', () => expect(src).toContain("case 'featureflag_create':"));
    test('has healthmon switch cases', () => expect(src).toContain("case 'healthmon_create_check':"));
    test('has costopt switch cases', () => expect(src).toContain("case 'costopt_generate_report':"));
    test('has datapipe switch cases', () => expect(src).toContain("case 'datapipe_create_pipeline':"));
    test('has notifrouter switch cases', () => expect(src).toContain("case 'notifrouter_create_channel':"));

    test('has handleFeatureflagCreate handler', () => expect(src).toContain('handleFeatureflagCreate'));
    test('has handleHealthmonCreateCheck handler', () => expect(src).toContain('handleHealthmonCreateCheck'));
    test('has handleCostoptGenerateReport handler', () => expect(src).toContain('handleCostoptGenerateReport'));
    test('has handleDatapipeCreatePipeline handler', () => expect(src).toContain('handleDatapipeCreatePipeline'));
    test('has handleNotifrouterCreateChannel handler', () => expect(src).toContain('handleNotifrouterCreateChannel'));
  });

  // ── Shared index exports ──
  describe('Shared index exports', () => {
    const indexPath = path.join(ROOT, 'packages/shared/src/index.ts');
    let idx: string;

    beforeAll(() => { idx = fs.readFileSync(indexPath, 'utf-8'); });

    test('exports agent-feature-flags', () => expect(idx).toContain("from './agent-feature-flags.js'"));
    test('exports agent-health-monitoring', () => expect(idx).toContain("from './agent-health-monitoring.js'"));
    test('exports agent-cost-optimization', () => expect(idx).toContain("from './agent-cost-optimization.js'"));
    test('exports agent-data-pipeline', () => expect(idx).toContain("from './agent-data-pipeline.js'"));
    test('exports agent-notification-router', () => expect(idx).toContain("from './agent-notification-router.js'"));
  });

  // ── .gitattributes ──
  describe('.gitattributes — Batches 128-132', () => {
    const gaPath = path.join(ROOT, '.gitattributes');
    let ga: string;

    beforeAll(() => { ga = fs.readFileSync(gaPath, 'utf-8'); });

    test('guards feature-flags migration', () => expect(ga).toContain('20260617650000_agent_feature_flags.sql'));
    test('guards health-monitoring migration', () => expect(ga).toContain('20260617660000_agent_health_monitoring.sql'));
    test('guards cost-optimization migration', () => expect(ga).toContain('20260617670000_agent_cost_optimization.sql'));
    test('guards data-pipeline migration', () => expect(ga).toContain('20260617680000_agent_data_pipeline.sql'));
    test('guards notification-router migration', () => expect(ga).toContain('20260617690000_agent_notification_router.sql'));
  });
});
