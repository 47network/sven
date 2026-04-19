import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 783-787: Gateway & Messaging Infrastructure', () => {
  const verticals = [
    {
      name: 'ingress_gateway_router', migration: '20260624200000_agent_ingress_gateway_router.sql',
      typeFile: 'agent-ingress-gateway-router.ts', skillDir: 'ingress-gateway-router',
      interfaces: ['IngressGatewayRouterConfig', 'RouteRule', 'RouterEvent'],
      bk: 'ingress_gateway_router', eks: ['igwr.route_matched', 'igwr.upstream_selected', 'igwr.request_proxied', 'igwr.failure_handled'],
      subjects: ['sven.igwr.route_matched', 'sven.igwr.upstream_selected', 'sven.igwr.request_proxied', 'sven.igwr.failure_handled'],
      cases: ['igwr_match', 'igwr_select', 'igwr_proxy', 'igwr_handle', 'igwr_report', 'igwr_monitor'],
    },
    {
      name: 'request_throttler', migration: '20260624210000_agent_request_throttler.sql',
      typeFile: 'agent-request-throttler.ts', skillDir: 'request-throttler',
      interfaces: ['RequestThrottlerConfig', 'ThrottleBudget', 'ThrottlerEvent'],
      bk: 'request_throttler', eks: ['rqth.budget_evaluated', 'rqth.token_consumed', 'rqth.request_throttled', 'rqth.window_rolled'],
      subjects: ['sven.rqth.budget_evaluated', 'sven.rqth.token_consumed', 'sven.rqth.request_throttled', 'sven.rqth.window_rolled'],
      cases: ['rqth_evaluate', 'rqth_consume', 'rqth_throttle', 'rqth_roll', 'rqth_report', 'rqth_monitor'],
    },
    {
      name: 'tenant_quota_enforcer', migration: '20260624220000_agent_tenant_quota_enforcer.sql',
      typeFile: 'agent-tenant-quota-enforcer.ts', skillDir: 'tenant-quota-enforcer',
      interfaces: ['TenantQuotaEnforcerConfig', 'TenantQuota', 'EnforcerEvent'],
      bk: 'tenant_quota_enforcer', eks: ['tqen.quota_loaded', 'tqen.usage_measured', 'tqen.limit_exceeded', 'tqen.notification_dispatched'],
      subjects: ['sven.tqen.quota_loaded', 'sven.tqen.usage_measured', 'sven.tqen.limit_exceeded', 'sven.tqen.notification_dispatched'],
      cases: ['tqen_load', 'tqen_measure', 'tqen_exceed', 'tqen_dispatch', 'tqen_report', 'tqen_monitor'],
    },
    {
      name: 'schema_registry_publisher', migration: '20260624230000_agent_schema_registry_publisher.sql',
      typeFile: 'agent-schema-registry-publisher.ts', skillDir: 'schema-registry-publisher',
      interfaces: ['SchemaRegistryPublisherConfig', 'SchemaVersion', 'PublisherEvent'],
      bk: 'schema_registry_publisher', eks: ['srpu.schema_registered', 'srpu.compatibility_checked', 'srpu.version_promoted', 'srpu.consumers_notified'],
      subjects: ['sven.srpu.schema_registered', 'sven.srpu.compatibility_checked', 'sven.srpu.version_promoted', 'sven.srpu.consumers_notified'],
      cases: ['srpu_register', 'srpu_check', 'srpu_promote', 'srpu_notify', 'srpu_report', 'srpu_monitor'],
    },
    {
      name: 'contract_validator', migration: '20260624240000_agent_contract_validator.sql',
      typeFile: 'agent-contract-validator.ts', skillDir: 'contract-validator',
      interfaces: ['ContractValidatorConfig', 'ContractCheck', 'ValidatorEvent'],
      bk: 'contract_validator', eks: ['ctvl.contract_loaded', 'ctvl.payload_validated', 'ctvl.violation_recorded', 'ctvl.fix_suggested'],
      subjects: ['sven.ctvl.contract_loaded', 'sven.ctvl.payload_validated', 'sven.ctvl.violation_recorded', 'sven.ctvl.fix_suggested'],
      cases: ['ctvl_load', 'ctvl_validate', 'ctvl_record', 'ctvl_suggest', 'ctvl_report', 'ctvl_monitor'],
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
