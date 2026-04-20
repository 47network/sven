import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 458-462: Network Security & Routing', () => {
  const verticals = [
    {
      name: 'ssl_inspector',
      migration: '20260620950000_agent_ssl_inspector.sql',
      table: 'agent_ssl_inspector_configs',
      typeFile: 'agent-ssl-inspector.ts',
      interfaces: ['SslInspectorConfig', 'CertificateReport', 'SslComplianceResult'],
      skillDir: 'ssl-inspector',
      bk: 'ssl_inspector',
      ekPrefix: 'ssli',
      eks: ['ssli.scan_completed', 'ssli.expiry_warning', 'ssli.compliance_passed', 'ssli.vulnerability_found'],
      subjects: [
        'sven.ssli.scan_completed',
        'sven.ssli.expiry_warning',
        'sven.ssli.compliance_passed',
        'sven.ssli.vulnerability_found',
      ],
      cases: ['ssli_scan', 'ssli_expiry', 'ssli_compliance', 'ssli_vulnerability', 'ssli_protocol', 'ssli_report'],
      handlers: ['handleSsliScan', 'handleSsliExpiry', 'handleSsliCompliance', 'handleSsliVulnerability', 'handleSsliProtocol', 'handleSsliReport'],
    },
    {
      name: 'proxy_configurator',
      migration: '20260620960000_agent_proxy_configurator.sql',
      table: 'agent_proxy_configurator_configs',
      typeFile: 'agent-proxy-configurator.ts',
      interfaces: ['ProxyConfiguratorConfig', 'ProxyRoute', 'ProxyHealthStatus'],
      skillDir: 'proxy-configurator',
      bk: 'proxy_configurator',
      ekPrefix: 'pxcf',
      eks: ['pxcf.route_created', 'pxcf.upstream_added', 'pxcf.cache_configured', 'pxcf.health_checked'],
      subjects: [
        'sven.pxcf.route_created',
        'sven.pxcf.upstream_added',
        'sven.pxcf.cache_configured',
        'sven.pxcf.health_checked',
      ],
      cases: ['pxcf_configure', 'pxcf_route', 'pxcf_upstream', 'pxcf_cache', 'pxcf_health', 'pxcf_status'],
      handlers: ['handlePxcfConfigure', 'handlePxcfRoute', 'handlePxcfUpstream', 'handlePxcfCache', 'handlePxcfHealth', 'handlePxcfStatus'],
    },
    {
      name: 'webhook_router',
      migration: '20260620970000_agent_webhook_router.sql',
      table: 'agent_webhook_router_configs',
      typeFile: 'agent-webhook-router.ts',
      interfaces: ['WebhookRouterConfig', 'WebhookDelivery', 'WebhookEndpoint'],
      skillDir: 'webhook-router',
      bk: 'webhook_router',
      ekPrefix: 'wbrt',
      eks: ['wbrt.endpoint_registered', 'wbrt.event_routed', 'wbrt.delivery_failed', 'wbrt.signature_verified'],
      subjects: [
        'sven.wbrt.endpoint_registered',
        'sven.wbrt.event_routed',
        'sven.wbrt.delivery_failed',
        'sven.wbrt.signature_verified',
      ],
      cases: ['wbrt_register', 'wbrt_route', 'wbrt_replay', 'wbrt_verify', 'wbrt_log', 'wbrt_status'],
      handlers: ['handleWbrtRegister', 'handleWbrtRoute', 'handleWbrtReplay', 'handleWbrtVerify', 'handleWbrtLog', 'handleWbrtStatus'],
    },
    {
      name: 'egress_filter',
      migration: '20260620980000_agent_egress_filter.sql',
      table: 'agent_egress_filter_configs',
      typeFile: 'agent-egress-filter.ts',
      interfaces: ['EgressFilterConfig', 'EgressRule', 'EgressReport'],
      skillDir: 'egress-filter',
      bk: 'egress_filter',
      ekPrefix: 'egfl',
      eks: ['egfl.policy_applied', 'egfl.traffic_blocked', 'egfl.dlp_alert', 'egfl.report_generated'],
      subjects: [
        'sven.egfl.policy_applied',
        'sven.egfl.traffic_blocked',
        'sven.egfl.dlp_alert',
        'sven.egfl.report_generated',
      ],
      cases: ['egfl_apply', 'egfl_scan', 'egfl_dlp', 'egfl_block', 'egfl_report', 'egfl_audit'],
      handlers: ['handleEgflApply', 'handleEgflScan', 'handleEgflDlp', 'handleEgflBlock', 'handleEgflReport', 'handleEgflAudit'],
    },
    {
      name: 'request_validator',
      migration: '20260620990000_agent_request_validator.sql',
      table: 'agent_request_validator_configs',
      typeFile: 'agent-request-validator.ts',
      interfaces: ['RequestValidatorConfig', 'ValidationResult', 'ValidationReport'],
      skillDir: 'request-validator',
      bk: 'request_validator',
      ekPrefix: 'rqvl',
      eks: ['rqvl.schema_validated', 'rqvl.input_sanitized', 'rqvl.rate_limited', 'rqvl.audit_completed'],
      subjects: [
        'sven.rqvl.schema_validated',
        'sven.rqvl.input_sanitized',
        'sven.rqvl.rate_limited',
        'sven.rqvl.audit_completed',
      ],
      cases: ['rqvl_validate', 'rqvl_sanitize', 'rqvl_rate_limit', 'rqvl_audit', 'rqvl_schema', 'rqvl_report'],
      handlers: ['handleRqvlValidate', 'handleRqvlSanitize', 'handleRqvlRateLimit', 'handleRqvlAudit', 'handleRqvlSchema', 'handleRqvlReport'],
    },
  ];

  verticals.forEach((v) => {
    describe(v.name, () => {
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
      test('barrel export exists', () => {
        const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
        const modName = v.typeFile.replace('.ts', '');
        expect(idx).toContain(`export * from './${modName}'`);
      });
      test('SKILL.md exists', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });
      test('SKILL.md has actions', () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });
      test('BK registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`'${v.bk}'`);
      });
      test('EKs registered', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        v.eks.forEach((ek) => {
          expect(types).toContain(`'${ek}'`);
        });
      });
      test('districtFor case', () => {
        const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
        expect(types).toContain(`case '${v.bk}':`);
      });
      test('SUBJECT_MAP entries', () => {
        const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
        v.subjects.forEach((sub) => {
          expect(eb).toContain(`'${sub}'`);
        });
      });
      test('task executor cases', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.cases.forEach((c) => {
          expect(te).toContain(`case '${c}'`);
        });
      });
      test('task executor handlers', () => {
        const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
        v.handlers.forEach((h) => {
          expect(te).toContain(h);
        });
      });
      test('.gitattributes entries', () => {
        const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
        expect(ga).toContain(v.migration);
        expect(ga).toContain(v.typeFile);
        expect(ga).toContain(v.skillDir);
      });
    });
  });
});
