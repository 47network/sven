import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Batches 253-257 — Network Services Core', () => {

  // --- Batch 253: Load Balancer ---
  describe('Batch 253 — Load Balancer migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618900000_agent_load_balancer.sql');
    test('creates agent_lb_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lb_configs'));
    test('creates agent_lb_backends table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lb_backends'));
    test('creates agent_lb_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_lb_metrics'));
    test('has algorithm column', () => expect(sql).toContain('algorithm'));
  });

  describe('Batch 253 — Load Balancer types', () => {
    const src = readFile('packages/shared/src/agent-load-balancer.ts');
    test('exports LbAlgorithm', () => expect(src).toContain('LbAlgorithm'));
    test('exports AgentLbConfig', () => expect(src).toContain('AgentLbConfig'));
    test('exports AgentLbBackend', () => expect(src).toContain('AgentLbBackend'));
    test('exports AgentLbMetric', () => expect(src).toContain('AgentLbMetric'));
  });

  describe('Batch 253 — Load Balancer SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/load-balancer/SKILL.md');
    test('has name', () => expect(skill).toContain('name: Load Balancer'));
    test('has price', () => expect(skill).toContain('price: 9.99'));
    test('has archetype', () => expect(skill).toContain('archetype: engineer'));
    test('has Actions heading', () => expect(skill).toContain('## Actions'));
    test('has create-balancer action', () => expect(skill).toContain('### create-balancer'));
  });

  // --- Batch 254: Health Checker ---
  describe('Batch 254 — Health Checker migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618910000_agent_health_checker.sql');
    test('creates agent_health_targets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_targets'));
    test('creates agent_health_results table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_results'));
    test('creates agent_health_incidents table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_health_incidents'));
  });

  describe('Batch 254 — Health Checker types', () => {
    const src = readFile('packages/shared/src/agent-health-checker.ts');
    test('exports HealthCheckType', () => expect(src).toContain('HealthCheckType'));
    test('exports AgentHealthTarget', () => expect(src).toContain('AgentHealthTarget'));
    test('exports AgentHealthResult', () => expect(src).toContain('AgentHealthResult'));
    test('exports AgentHealthIncident', () => expect(src).toContain('AgentHealthIncident'));
  });

  describe('Batch 254 — Health Checker SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/health-checker/SKILL.md');
    test('has name', () => expect(skill).toContain('name: Health Checker'));
    test('has price', () => expect(skill).toContain('price: 5.99'));
    test('has archetype', () => expect(skill).toContain('archetype: analyst'));
    test('has Actions heading', () => expect(skill).toContain('## Actions'));
  });

  // --- Batch 255: Reverse Proxy ---
  describe('Batch 255 — Reverse Proxy migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618920000_agent_reverse_proxy.sql');
    test('creates agent_proxy_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_configs'));
    test('creates agent_proxy_upstreams table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_upstreams'));
    test('creates agent_proxy_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_access_logs'));
  });

  describe('Batch 255 — Reverse Proxy types', () => {
    const src = readFile('packages/shared/src/agent-reverse-proxy.ts');
    test('exports ProxyStatus', () => expect(src).toContain('ProxyStatus'));
    test('exports AgentProxyConfig', () => expect(src).toContain('AgentProxyConfig'));
    test('exports AgentProxyUpstream', () => expect(src).toContain('AgentProxyUpstream'));
    test('exports AgentProxyAccessLog', () => expect(src).toContain('AgentProxyAccessLog'));
  });

  describe('Batch 255 — Reverse Proxy SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/reverse-proxy/SKILL.md');
    test('has name', () => expect(skill).toContain('name: Reverse Proxy'));
    test('has price', () => expect(skill).toContain('price: 8.99'));
    test('has archetype', () => expect(skill).toContain('archetype: engineer'));
    test('has Actions heading', () => expect(skill).toContain('## Actions'));
  });

  // --- Batch 256: NAT Gateway ---
  describe('Batch 256 — NAT Gateway migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618930000_agent_nat_gateway.sql');
    test('creates agent_nat_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_nat_configs'));
    test('creates agent_nat_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_nat_rules'));
    test('creates agent_nat_translations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_nat_translations'));
  });

  describe('Batch 256 — NAT Gateway types', () => {
    const src = readFile('packages/shared/src/agent-nat-gateway.ts');
    test('exports NatType', () => expect(src).toContain('NatType'));
    test('exports AgentNatConfig', () => expect(src).toContain('AgentNatConfig'));
    test('exports AgentNatRule', () => expect(src).toContain('AgentNatRule'));
    test('exports AgentNatTranslation', () => expect(src).toContain('AgentNatTranslation'));
  });

  describe('Batch 256 — NAT Gateway SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/nat-gateway/SKILL.md');
    test('has name', () => expect(skill).toContain('name: NAT Gateway'));
    test('has price', () => expect(skill).toContain('price: 7.99'));
    test('has archetype', () => expect(skill).toContain('archetype: engineer'));
    test('has Actions heading', () => expect(skill).toContain('## Actions'));
  });

  // --- Batch 257: Traffic Shaper ---
  describe('Batch 257 — Traffic Shaper migration', () => {
    const sql = readFile('services/gateway-api/migrations/20260618940000_agent_traffic_shaper.sql');
    test('creates agent_shaper_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_shaper_policies'));
    test('creates agent_shaper_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_shaper_rules'));
    test('creates agent_shaper_stats table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_shaper_stats'));
  });

  describe('Batch 257 — Traffic Shaper types', () => {
    const src = readFile('packages/shared/src/agent-traffic-shaper.ts');
    test('exports ShaperPriorityClass', () => expect(src).toContain('ShaperPriorityClass'));
    test('exports AgentShaperPolicy', () => expect(src).toContain('AgentShaperPolicy'));
    test('exports AgentShaperRule', () => expect(src).toContain('AgentShaperRule'));
    test('exports AgentShaperStat', () => expect(src).toContain('AgentShaperStat'));
  });

  describe('Batch 257 — Traffic Shaper SKILL.md', () => {
    const skill = readFile('skills/autonomous-economy/traffic-shaper/SKILL.md');
    test('has name', () => expect(skill).toContain('name: Traffic Shaper'));
    test('has price', () => expect(skill).toContain('price: 10.99'));
    test('has archetype', () => expect(skill).toContain('archetype: engineer'));
    test('has Actions heading', () => expect(skill).toContain('## Actions'));
  });

  // --- Cross-batch: Barrel exports ---
  describe('Barrel exports', () => {
    const idx = readFile('packages/shared/src/index.ts');
    test('exports agent-load-balancer', () => expect(idx).toContain("from './agent-load-balancer.js'"));
    test('exports agent-health-checker', () => expect(idx).toContain("from './agent-health-checker.js'"));
    test('exports agent-reverse-proxy', () => expect(idx).toContain("from './agent-reverse-proxy.js'"));
    test('exports agent-nat-gateway', () => expect(idx).toContain("from './agent-nat-gateway.js'"));
    test('exports agent-traffic-shaper', () => expect(idx).toContain("from './agent-traffic-shaper.js'"));
  });

  // --- Cross-batch: Eidolon BK/EK/districtFor ---
  describe('Eidolon types.ts wiring', () => {
    const types = readFile('services/sven-eidolon/src/types.ts');
    test('BK has load_balancer', () => expect(types).toContain("'load_balancer'"));
    test('BK has health_checker', () => expect(types).toContain("'health_checker'"));
    test('BK has reverse_proxy', () => expect(types).toContain("'reverse_proxy'"));
    test('BK has nat_gateway', () => expect(types).toContain("'nat_gateway'"));
    test('BK has traffic_shaper', () => expect(types).toContain("'traffic_shaper'"));
    test('EK has lb.config_created', () => expect(types).toContain("'lb.config_created'"));
    test('EK has healthcheck.target_added', () => expect(types).toContain("'healthcheck.target_added'"));
    test('EK has rproxy.config_created', () => expect(types).toContain("'rproxy.config_created'"));
    test('EK has nat.gateway_created', () => expect(types).toContain("'nat.gateway_created'"));
    test('EK has shaper.policy_created', () => expect(types).toContain("'shaper.policy_created'"));
    test('districtFor has load_balancer case', () => expect(types).toContain("case 'load_balancer':"));
    test('districtFor has traffic_shaper case', () => expect(types).toContain("case 'traffic_shaper':"));
  });

  // --- Cross-batch: SUBJECT_MAP ---
  describe('Event bus SUBJECT_MAP', () => {
    const bus = readFile('services/sven-eidolon/src/event-bus.ts');
    test('has sven.lb.config_created', () => expect(bus).toContain("'sven.lb.config_created'"));
    test('has sven.healthcheck.check_completed', () => expect(bus).toContain("'sven.healthcheck.check_completed'"));
    test('has sven.rproxy.upstream_added', () => expect(bus).toContain("'sven.rproxy.upstream_added'"));
    test('has sven.nat.rule_added', () => expect(bus).toContain("'sven.nat.rule_added'"));
    test('has sven.shaper.bandwidth_adjusted', () => expect(bus).toContain("'sven.shaper.bandwidth_adjusted'"));
  });

  // --- Cross-batch: Task executor ---
  describe('Task executor switch cases', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    test('has lb_create_config case', () => expect(te).toContain("case 'lb_create_config'"));
    test('has hc_add_target case', () => expect(te).toContain("case 'hc_add_target'"));
    test('has rp_create_proxy case', () => expect(te).toContain("case 'rp_create_proxy'"));
    test('has nat_create_gateway case', () => expect(te).toContain("case 'nat_create_gateway'"));
    test('has ts_create_policy case', () => expect(te).toContain("case 'ts_create_policy'"));
  });

  describe('Task executor handler methods', () => {
    const te = readFile('services/sven-marketplace/src/task-executor.ts');
    test('has handleLbCreateConfig', () => expect(te).toContain('handleLbCreateConfig'));
    test('has handleHcAddTarget', () => expect(te).toContain('handleHcAddTarget'));
    test('has handleRpCreateProxy', () => expect(te).toContain('handleRpCreateProxy'));
    test('has handleNatCreateGateway', () => expect(te).toContain('handleNatCreateGateway'));
    test('has handleTsCreatePolicy', () => expect(te).toContain('handleTsCreatePolicy'));
    test('has handleTsExportMetrics', () => expect(te).toContain('handleTsExportMetrics'));
  });

  // --- .gitattributes ---
  describe('.gitattributes entries', () => {
    const ga = readFile('.gitattributes');
    test('has load_balancer migration', () => expect(ga).toContain('20260618900000_agent_load_balancer.sql'));
    test('has health_checker types', () => expect(ga).toContain('agent-health-checker.ts'));
    test('has reverse-proxy skill', () => expect(ga).toContain('reverse-proxy/**'));
    test('has nat-gateway skill', () => expect(ga).toContain('nat-gateway/**'));
    test('has traffic-shaper skill', () => expect(ga).toContain('traffic-shaper/**'));
  });
});
