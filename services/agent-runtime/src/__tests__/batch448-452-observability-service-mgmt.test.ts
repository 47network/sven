import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 448-452: Observability & Service Management', () => {
  const verticals = [
    {
      name: 'change_manager',
      migration: '20260620850000_agent_change_manager.sql',
      table: 'agent_change_manager_configs',
      typeFile: 'agent-change-manager.ts',
      interfaces: ['ChangeManagerConfig', 'ChangeRequest', 'ChangeAuditEntry'],
      skillDir: 'change-manager',
      bk: 'change_manager',
      ekPrefix: 'chmg',
      eks: ['chmg.change_created', 'chmg.change_approved', 'chmg.change_implemented', 'chmg.change_rolled_back'],
      subjects: [
        'sven.chmg.change_created',
        'sven.chmg.change_approved',
        'sven.chmg.change_implemented',
        'sven.chmg.change_rolled_back',
      ],
      cases: ['chmg_create', 'chmg_approve', 'chmg_implement', 'chmg_rollback', 'chmg_audit', 'chmg_schedule'],
      handlers: ['handleChmgCreate', 'handleChmgApprove', 'handleChmgImplement', 'handleChmgRollback', 'handleChmgAudit', 'handleChmgSchedule'],
    },
    {
      name: 'service_catalog',
      migration: '20260620860000_agent_service_catalog.sql',
      table: 'agent_service_catalog_configs',
      typeFile: 'agent-service-catalog.ts',
      interfaces: ['ServiceCatalogConfig', 'ServiceEntry', 'ServiceDependencyGraph'],
      skillDir: 'service-catalog',
      bk: 'service_catalog',
      ekPrefix: 'svct',
      eks: ['svct.service_registered', 'svct.service_updated', 'svct.service_deprecated', 'svct.dependency_mapped'],
      subjects: [
        'sven.svct.service_registered',
        'sven.svct.service_updated',
        'sven.svct.service_deprecated',
        'sven.svct.dependency_mapped',
      ],
      cases: ['svct_register', 'svct_update', 'svct_dependencies', 'svct_owners', 'svct_deprecate', 'svct_search'],
      handlers: ['handleSvctRegister', 'handleSvctUpdate', 'handleSvctDependencies', 'handleSvctOwners', 'handleSvctDeprecate', 'handleSvctSearch'],
    },
    {
      name: 'uptime_reporter',
      migration: '20260620870000_agent_uptime_reporter.sql',
      table: 'agent_uptime_reporter_configs',
      typeFile: 'agent-uptime-reporter.ts',
      interfaces: ['UptimeReporterConfig', 'UptimeReport', 'DowntimeIncident'],
      skillDir: 'uptime-reporter',
      bk: 'uptime_reporter',
      ekPrefix: 'uptr',
      eks: ['uptr.report_generated', 'uptr.incident_recorded', 'uptr.sla_breached', 'uptr.sla_recovered'],
      subjects: [
        'sven.uptr.report_generated',
        'sven.uptr.incident_recorded',
        'sven.uptr.sla_breached',
        'sven.uptr.sla_recovered',
      ],
      cases: ['uptr_report', 'uptr_incident', 'uptr_sla', 'uptr_compare', 'uptr_incidents', 'uptr_forecast'],
      handlers: ['handleUptrReport', 'handleUptrIncident', 'handleUptrSla', 'handleUptrCompare', 'handleUptrIncidents', 'handleUptrForecast'],
    },
    {
      name: 'latency_profiler',
      migration: '20260620880000_agent_latency_profiler.sql',
      table: 'agent_latency_profiler_configs',
      typeFile: 'agent-latency-profiler.ts',
      interfaces: ['LatencyProfilerConfig', 'LatencyProfile', 'LatencyAnomaly'],
      skillDir: 'latency-profiler',
      bk: 'latency_profiler',
      ekPrefix: 'ltpf',
      eks: ['ltpf.profile_completed', 'ltpf.anomaly_detected', 'ltpf.baseline_set', 'ltpf.alert_triggered'],
      subjects: [
        'sven.ltpf.profile_completed',
        'sven.ltpf.anomaly_detected',
        'sven.ltpf.baseline_set',
        'sven.ltpf.alert_triggered',
      ],
      cases: ['ltpf_profile', 'ltpf_baseline', 'ltpf_anomalies', 'ltpf_compare', 'ltpf_trend', 'ltpf_alert'],
      handlers: ['handleLtpfProfile', 'handleLtpfBaseline', 'handleLtpfAnomalies', 'handleLtpfCompare', 'handleLtpfTrend', 'handleLtpfAlert'],
    },
    {
      name: 'throughput_analyzer',
      migration: '20260620890000_agent_throughput_analyzer.sql',
      table: 'agent_throughput_analyzer_configs',
      typeFile: 'agent-throughput-analyzer.ts',
      interfaces: ['ThroughputAnalyzerConfig', 'ThroughputSnapshot', 'ThroughputTrend'],
      skillDir: 'throughput-analyzer',
      bk: 'throughput_analyzer',
      ekPrefix: 'thpt',
      eks: ['thpt.analysis_completed', 'thpt.drop_detected', 'thpt.baseline_set', 'thpt.forecast_generated'],
      subjects: [
        'sven.thpt.analysis_completed',
        'sven.thpt.drop_detected',
        'sven.thpt.baseline_set',
        'sven.thpt.forecast_generated',
      ],
      cases: ['thpt_analyze', 'thpt_baseline', 'thpt_drops', 'thpt_trend', 'thpt_compare', 'thpt_forecast'],
      handlers: ['handleThptAnalyze', 'handleThptBaseline', 'handleThptDrops', 'handleThptTrend', 'handleThptCompare', 'handleThptForecast'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
      // Migration
      test('migration file exists', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });
      test('migration creates table', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(v.table);
        expect(sql).toContain('CREATE TABLE');
        expect(sql).toContain('agent_id UUID NOT NULL');
      });
      test('migration has indexes', () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(`idx_${v.table}_agent`);
        expect(sql).toContain(`idx_${v.table}_enabled`);
      });

      // Types
      test('type file exists', () => {
        const p = path.join(ROOT, 'packages/shared/src', v.typeFile);
        expect(fs.existsSync(p)).toBe(true);
      });
      test('type file exports interfaces', () => {
        const p = path.join(ROOT, 'packages/shared/src', v.typeFile);
        const content = fs.readFileSync(p, 'utf-8');
        v.interfaces.forEach((iface) => {
          expect(content).toContain(`export interface ${iface}`);
        });
      });

      // Barrel export
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`export * from './${modName}'`);
      });

      // SKILL.md
      test('SKILL.md exists', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });

      // Eidolon BK
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });

      // Eidolon EK
      test('EKs registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });

      // districtFor
      test('districtFor case', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });

      // SUBJECT_MAP
      test('SUBJECT_MAP entries', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });

      // Task executor cases
      test('task executor cases', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });

      // Task executor handlers
      test('task executor handlers', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.handlers.forEach((h) => {
          expect(te).toContain(h);
        });
      });

      // .gitattributes
      test('.gitattributes entries', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
    });
  });
});
