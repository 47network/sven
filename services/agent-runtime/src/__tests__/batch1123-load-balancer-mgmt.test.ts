import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 1123-1127 · Load Balancer Management', () => {
  const verticals = [
    {
      name: 'load_balancer_pool_manager', migration: '20260627600000_agent_load_balancer_pool_manager.sql',
      typeFile: 'agent-load-balancer-pool-manager.ts', skillDir: 'load-balancer-pool-manager',
      interfaces: ['LoadBalancerPoolManagerConfig', 'LoadBalancerPoolManagerEvent', 'LoadBalancerPoolManagerRule'],
      bk: 'load_balancer_pool_manager', eks: ['lbpm.analysis_completed', 'lbpm.alert_triggered', 'lbpm.export_emitted'],
      subjects: ['sven.lbpm.analysis_completed', 'sven.lbpm.alert_triggered', 'sven.lbpm.export_emitted'],
      cases: ['lbpm_monitor', 'lbpm_analyzer', 'lbpm_reporter'],
    },
    {
      name: 'load_balancer_health_checker', migration: '20260627610000_agent_load_balancer_health_checker.sql',
      typeFile: 'agent-load-balancer-health-checker.ts', skillDir: 'load-balancer-health-checker',
      interfaces: ['LoadBalancerHealthCheckerConfig', 'LoadBalancerHealthCheckerEvent', 'LoadBalancerHealthCheckerRule'],
      bk: 'load_balancer_health_checker', eks: ['lbhc.analysis_completed', 'lbhc.alert_triggered', 'lbhc.export_emitted'],
      subjects: ['sven.lbhc.analysis_completed', 'sven.lbhc.alert_triggered', 'sven.lbhc.export_emitted'],
      cases: ['lbhc_monitor', 'lbhc_analyzer', 'lbhc_reporter'],
    },
    {
      name: 'load_balancer_traffic_router', migration: '20260627620000_agent_load_balancer_traffic_router.sql',
      typeFile: 'agent-load-balancer-traffic-router.ts', skillDir: 'load-balancer-traffic-router',
      interfaces: ['LoadBalancerTrafficRouterConfig', 'LoadBalancerTrafficRouterEvent', 'LoadBalancerTrafficRouterRule'],
      bk: 'load_balancer_traffic_router', eks: ['lbtr.analysis_completed', 'lbtr.alert_triggered', 'lbtr.export_emitted'],
      subjects: ['sven.lbtr.analysis_completed', 'sven.lbtr.alert_triggered', 'sven.lbtr.export_emitted'],
      cases: ['lbtr_monitor', 'lbtr_analyzer', 'lbtr_reporter'],
    },
    {
      name: 'load_balancer_ssl_terminator', migration: '20260627630000_agent_load_balancer_ssl_terminator.sql',
      typeFile: 'agent-load-balancer-ssl-terminator.ts', skillDir: 'load-balancer-ssl-terminator',
      interfaces: ['LoadBalancerSslTerminatorConfig', 'LoadBalancerSslTerminatorEvent', 'LoadBalancerSslTerminatorRule'],
      bk: 'load_balancer_ssl_terminator', eks: ['lbst.analysis_completed', 'lbst.alert_triggered', 'lbst.export_emitted'],
      subjects: ['sven.lbst.analysis_completed', 'sven.lbst.alert_triggered', 'sven.lbst.export_emitted'],
      cases: ['lbst_monitor', 'lbst_analyzer', 'lbst_reporter'],
    },
    {
      name: 'load_balancer_rate_limiter', migration: '20260627640000_agent_load_balancer_rate_limiter.sql',
      typeFile: 'agent-load-balancer-rate-limiter.ts', skillDir: 'load-balancer-rate-limiter',
      interfaces: ['LoadBalancerRateLimiterConfig', 'LoadBalancerRateLimiterEvent', 'LoadBalancerRateLimiterRule'],
      bk: 'load_balancer_rate_limiter', eks: ['lbrl.analysis_completed', 'lbrl.alert_triggered', 'lbrl.export_emitted'],
      subjects: ['sven.lbrl.analysis_completed', 'sven.lbrl.alert_triggered', 'sven.lbrl.export_emitted'],
      cases: ['lbrl_monitor', 'lbrl_analyzer', 'lbrl_reporter'],
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
