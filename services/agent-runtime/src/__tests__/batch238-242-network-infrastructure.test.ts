import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 238-242 — Network Infrastructure', () => {

  // ── Batch 238: Certificate Authority ──────────────────────────
  describe('Batch 238: Certificate Authority Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618750000_agent_certificate_authority.sql'), 'utf-8');
    it('creates agent_certificate_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_certificate_configs'));
    it('creates agent_issued_certificates table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_issued_certificates'));
    it('creates agent_certificate_audits table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_certificate_audits'));
    it('has agent_id columns', () => expect(sql).toContain('agent_id'));
    it('has created_at timestamps', () => expect(sql).toContain('created_at'));
  });

  describe('Batch 238: Certificate Authority Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-certificate-authority.ts'), 'utf-8');
    it('exports AgentCertificateConfig type', () => expect(ts).toContain('AgentCertificateConfig'));
    it('exports union or interface types', () => expect(ts).toMatch(/export (type|interface)/));
    it('has status field', () => expect(ts).toContain('status'));
  });

  describe('Batch 238: Certificate Authority SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/certificate-authority/SKILL.md'), 'utf-8');
    it('has title', () => expect(md).toContain('Certificate Authority'));
    it('has actions section', () => expect(md).toContain('## Actions'));
    it('has pricing', () => expect(md).toMatch(/pric/i));
  });

  // ── Batch 239: Geo Locator ────────────────────────────────────
  describe('Batch 239: Geo Locator Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618760000_agent_geo_locator.sql'), 'utf-8');
    it('creates agent_geo_profiles table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_geo_profiles'));
    it('creates agent_geo_lookups table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_geo_lookups'));
    it('creates agent_geo_restrictions table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_geo_restrictions'));
    it('has agent_id columns', () => expect(sql).toContain('agent_id'));
    it('has created_at timestamps', () => expect(sql).toContain('created_at'));
  });

  describe('Batch 239: Geo Locator Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-geo-locator.ts'), 'utf-8');
    it('exports GeoProfile or GeoLocator type', () => expect(ts).toMatch(/Geo(Profile|Locator)/));
    it('exports union or interface types', () => expect(ts).toMatch(/export (type|interface)/));
  });

  describe('Batch 239: Geo Locator SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/geo-locator/SKILL.md'), 'utf-8');
    it('has title', () => expect(md).toContain('Geo Locator'));
    it('has actions section', () => expect(md).toContain('## Actions'));
  });

  // ── Batch 240: DDoS Protector ─────────────────────────────────
  describe('Batch 240: DDoS Protector Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618770000_agent_ddos_protector.sql'), 'utf-8');
    it('creates agent_ddos_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ddos_policies'));
    it('creates agent_ddos_incidents table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ddos_incidents'));
    it('creates agent_ddos_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ddos_metrics'));
    it('has agent_id columns', () => expect(sql).toContain('agent_id'));
  });

  describe('Batch 240: DDoS Protector Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-ddos-protector.ts'), 'utf-8');
    it('exports DdosPolicy or DdosProtector type', () => expect(ts).toMatch(/Ddos(Policy|Protector)/));
    it('exports union or interface types', () => expect(ts).toMatch(/export (type|interface)/));
  });

  describe('Batch 240: DDoS Protector SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/ddos-protector/SKILL.md'), 'utf-8');
    it('has title', () => expect(md).toContain('DDoS Protector'));
    it('has actions section', () => expect(md).toContain('## Actions'));
  });

  // ── Batch 241: API Gateway Manager ────────────────────────────
  describe('Batch 241: API Gateway Manager Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618780000_agent_api_gateway_manager.sql'), 'utf-8');
    it('creates agent_api_routes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_api_routes'));
    it('creates agent_api_consumers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_api_consumers'));
    it('creates agent_api_analytics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_api_analytics'));
    it('has agent_id columns', () => expect(sql).toContain('agent_id'));
  });

  describe('Batch 241: API Gateway Manager Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-api-gateway-manager.ts'), 'utf-8');
    it('exports ApiRoute or ApiGateway type', () => expect(ts).toMatch(/Api(Route|Gateway)/));
    it('exports union or interface types', () => expect(ts).toMatch(/export (type|interface)/));
  });

  describe('Batch 241: API Gateway Manager SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/api-gateway-manager/SKILL.md'), 'utf-8');
    it('has title', () => expect(md).toContain('API Gateway'));
    it('has actions section', () => expect(md).toContain('## Actions'));
  });

  // ── Batch 242: Endpoint Monitor ───────────────────────────────
  describe('Batch 242: Endpoint Monitor Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618790000_agent_endpoint_monitor.sql'), 'utf-8');
    it('creates agent_monitored_endpoints table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_monitored_endpoints'));
    it('creates agent_endpoint_checks table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_endpoint_checks'));
    it('creates agent_endpoint_alerts table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_endpoint_alerts'));
    it('has agent_id columns', () => expect(sql).toContain('agent_id'));
  });

  describe('Batch 242: Endpoint Monitor Types', () => {
    const ts = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-endpoint-monitor.ts'), 'utf-8');
    it('exports EndpointMonitor or MonitoredEndpoint type', () => expect(ts).toMatch(/(EndpointMonitor|MonitoredEndpoint)/));
    it('exports union or interface types', () => expect(ts).toMatch(/export (type|interface)/));
  });

  describe('Batch 242: Endpoint Monitor SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/endpoint-monitor/SKILL.md'), 'utf-8');
    it('has title', () => expect(md).toContain('Endpoint Monitor'));
    it('has actions section', () => expect(md).toContain('## Actions'));
  });

  // ── Barrel Exports ────────────────────────────────────────────
  describe('Barrel Exports (index.ts)', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports agent-certificate-authority', () => expect(idx).toContain("from './agent-certificate-authority"));
    it('exports agent-geo-locator', () => expect(idx).toContain("from './agent-geo-locator"));
    it('exports agent-ddos-protector', () => expect(idx).toContain("from './agent-ddos-protector"));
    it('exports agent-api-gateway-manager', () => expect(idx).toContain("from './agent-api-gateway-manager"));
    it('exports agent-endpoint-monitor', () => expect(idx).toContain("from './agent-endpoint-monitor"));
  });

  // ── Eidolon BK/EK/districtFor ─────────────────────────────────
  describe('Eidolon Types (BK + EK + districtFor)', () => {
    const eidolon = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');

    it('has certificate_authority BK', () => expect(eidolon).toContain("'certificate_authority'"));
    it('has geo_locator BK', () => expect(eidolon).toContain("'geo_locator'"));
    it('has ddos_protector BK', () => expect(eidolon).toContain("'ddos_protector'"));
    it('has api_gateway_manager BK', () => expect(eidolon).toContain("'api_gateway_manager'"));
    it('has endpoint_monitor BK', () => expect(eidolon).toContain("'endpoint_monitor'"));

    // Use unique EK values to avoid older batch collisions
    it('has certificate.audited EK (unique to batch 238)', () => {
      const matches = eidolon.match(/certificate\.audited/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
    it('has geo.report_generated EK', () => {
      const matches = eidolon.match(/geo\.report_generated/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
    it('has ddos.metrics_reviewed EK', () => {
      const matches = eidolon.match(/ddos\.metrics_reviewed/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
    it('has api_route.versioned EK', () => {
      const matches = eidolon.match(/api_route\.versioned/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });
    it('has endpoint.uptime_reported EK', () => {
      const matches = eidolon.match(/endpoint\.uptime_reported/g);
      expect(matches).not.toBeNull();
      expect(matches!.length).toBe(3);
    });

    it('districtFor maps certificate_authority to industrial', () => {
      expect(eidolon).toMatch(/case 'certificate_authority'/);
    });
    it('districtFor maps endpoint_monitor to industrial', () => {
      expect(eidolon).toMatch(/case 'endpoint_monitor'/);
    });
  });

  // ── SUBJECT_MAP ───────────────────────────────────────────────
  describe('SUBJECT_MAP (event-bus.ts)', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');

    it('has sven.certificate.audited subject', () => expect(bus).toContain("'sven.certificate.audited'"));
    it('has sven.geo.report_generated subject', () => expect(bus).toContain("'sven.geo.report_generated'"));
    it('has sven.ddos.policy_created subject', () => expect(bus).toContain("'sven.ddos.policy_created'"));
    it('has sven.api_route.created subject', () => expect(bus).toContain("'sven.api_route.created'"));
    it('has sven.endpoint.uptime_reported subject', () => expect(bus).toContain("'sven.endpoint.uptime_reported'"));

    it('has at least 20 new entries for batches 238-242', () => {
      const newSubjects = [
        'sven.certificate.issued', 'sven.certificate.renewed', 'sven.certificate.revoked', 'sven.certificate.audited',
        'sven.geo.lookup_completed', 'sven.geo.compliance_checked', 'sven.geo.restriction_updated', 'sven.geo.report_generated',
        'sven.ddos.policy_created', 'sven.ddos.attack_detected', 'sven.ddos.incident_mitigated', 'sven.ddos.metrics_reviewed',
        'sven.api_route.created', 'sven.api_route.consumer_managed', 'sven.api_route.traffic_analyzed', 'sven.api_route.versioned',
        'sven.endpoint.added', 'sven.endpoint.health_checked_monitor', 'sven.endpoint.alert_raised_monitor', 'sven.endpoint.uptime_reported',
      ];
      const count = newSubjects.filter(s => bus.includes(`'${s}'`)).length;
      expect(count).toBe(20);
    });
  });

  // ── Task Executor ─────────────────────────────────────────────
  describe('Task Executor (switch cases + handlers)', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');

    // Certificate Authority
    it('has cert_issue case', () => expect(te).toContain("case 'cert_issue'"));
    it('has cert_renew case', () => expect(te).toContain("case 'cert_renew'"));
    it('has cert_revoke case', () => expect(te).toContain("case 'cert_revoke'"));
    it('has cert_audit case', () => expect(te).toContain("case 'cert_audit'"));
    it('has cert_list_expiring case', () => expect(te).toContain("case 'cert_list_expiring'"));
    it('has cert_configure_authority case', () => expect(te).toContain("case 'cert_configure_authority'"));

    // Geo Locator
    it('has geo_lookup case', () => expect(te).toContain("case 'geo_lookup'"));
    it('has geo_check_compliance case', () => expect(te).toContain("case 'geo_check_compliance'"));
    it('has geo_manage_restrictions case', () => expect(te).toContain("case 'geo_manage_restrictions'"));
    it('has geo_generate_report case', () => expect(te).toContain("case 'geo_generate_report'"));
    it('has geo_list_profiles case', () => expect(te).toContain("case 'geo_list_profiles'"));
    it('has geo_update_profile case', () => expect(te).toContain("case 'geo_update_profile'"));

    // DDoS Protector
    it('has ddos_create_policy case', () => expect(te).toContain("case 'ddos_create_policy'"));
    it('has ddos_detect_attack case', () => expect(te).toContain("case 'ddos_detect_attack'"));
    it('has ddos_mitigate case', () => expect(te).toContain("case 'ddos_mitigate'"));
    it('has ddos_review_metrics case', () => expect(te).toContain("case 'ddos_review_metrics'"));
    it('has ddos_list_incidents case', () => expect(te).toContain("case 'ddos_list_incidents'"));
    it('has ddos_update_policy case', () => expect(te).toContain("case 'ddos_update_policy'"));

    // API Gateway Manager
    it('has apigw_create_route case', () => expect(te).toContain("case 'apigw_create_route'"));
    it('has apigw_manage_consumer case', () => expect(te).toContain("case 'apigw_manage_consumer'"));
    it('has apigw_analyze_traffic case', () => expect(te).toContain("case 'apigw_analyze_traffic'"));
    it('has apigw_version_route case', () => expect(te).toContain("case 'apigw_version_route'"));
    it('has apigw_list_routes case', () => expect(te).toContain("case 'apigw_list_routes'"));
    it('has apigw_update_consumer case', () => expect(te).toContain("case 'apigw_update_consumer'"));

    // Endpoint Monitor
    it('has monitor_add_endpoint case', () => expect(te).toContain("case 'monitor_add_endpoint'"));
    it('has monitor_check_health case', () => expect(te).toContain("case 'monitor_check_health'"));
    it('has monitor_review_alerts case', () => expect(te).toContain("case 'monitor_review_alerts'"));
    it('has monitor_uptime_report case', () => expect(te).toContain("case 'monitor_uptime_report'"));
    it('has monitor_list_endpoints case', () => expect(te).toContain("case 'monitor_list_endpoints'"));
    it('has monitor_update_endpoint case', () => expect(te).toContain("case 'monitor_update_endpoint'"));

    // Handler methods
    it('has handleCertIssue handler', () => expect(te).toContain('handleCertIssue'));
    it('has handleGeoLookup handler', () => expect(te).toContain('handleGeoLookup'));
    it('has handleDdosCreatePolicy handler', () => expect(te).toContain('handleDdosCreatePolicy'));
    it('has handleApigwCreateRoute handler', () => expect(te).toContain('handleApigwCreateRoute'));
    it('has handleMonitorAddEndpoint handler', () => expect(te).toContain('handleMonitorAddEndpoint'));
  });

  // ── .gitattributes ────────────────────────────────────────────
  describe('.gitattributes privacy filtering', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('filters certificate-authority migration', () => expect(ga).toContain('20260618750000_agent_certificate_authority.sql'));
    it('filters geo-locator migration', () => expect(ga).toContain('20260618760000_agent_geo_locator.sql'));
    it('filters ddos-protector migration', () => expect(ga).toContain('20260618770000_agent_ddos_protector.sql'));
    it('filters api-gateway-manager migration', () => expect(ga).toContain('20260618780000_agent_api_gateway_manager.sql'));
    it('filters endpoint-monitor migration', () => expect(ga).toContain('20260618790000_agent_endpoint_monitor.sql'));
    it('filters certificate-authority types', () => expect(ga).toContain('agent-certificate-authority.ts'));
    it('filters geo-locator types', () => expect(ga).toContain('agent-geo-locator.ts'));
    it('filters ddos-protector types', () => expect(ga).toContain('agent-ddos-protector.ts'));
    it('filters api-gateway-manager types', () => expect(ga).toContain('agent-api-gateway-manager.ts'));
    it('filters endpoint-monitor types', () => expect(ga).toContain('agent-endpoint-monitor.ts'));
    it('filters certificate-authority skill', () => expect(ga).toContain('certificate-authority/**'));
    it('filters geo-locator skill', () => expect(ga).toContain('geo-locator/**'));
    it('filters ddos-protector skill', () => expect(ga).toContain('ddos-protector/**'));
    it('filters api-gateway-manager skill', () => expect(ga).toContain('api-gateway-manager/**'));
    it('filters endpoint-monitor skill', () => expect(ga).toContain('endpoint-monitor/**'));
  });
});
