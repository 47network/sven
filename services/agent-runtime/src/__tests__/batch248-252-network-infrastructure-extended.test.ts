import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 248-252 — Network Infrastructure Extended', () => {

  // ── Batch 248: Network Auditor ──────────────────────
  describe('Batch 248 — network_auditor migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618850000_agent_network_auditor.sql'), 'utf-8');
    it('creates agent_audit_scans table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_audit_scans'));
    it('creates agent_audit_findings table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_audit_findings'));
    it('creates agent_audit_reports table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_audit_reports'));
    it('has scan_type column', () => expect(sql).toContain('scan_type'));
    it('has severity column', () => expect(sql).toContain('severity'));
    it('has overall_score column', () => expect(sql).toContain('overall_score'));
  });

  describe('Batch 248 — network_auditor types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-network-auditor.ts'), 'utf-8');
    it('exports AuditScanType', () => expect(src).toContain('export type AuditScanType'));
    it('exports AuditScanStatus', () => expect(src).toContain('export type AuditScanStatus'));
    it('exports FindingSeverity', () => expect(src).toContain('export type FindingSeverity'));
    it('exports AgentAuditScan', () => expect(src).toContain('export interface AgentAuditScan'));
    it('exports AgentAuditFinding', () => expect(src).toContain('export interface AgentAuditFinding'));
    it('exports AgentAuditReport', () => expect(src).toContain('export interface AgentAuditReport'));
    it('AuditScanType includes compliance', () => expect(src).toContain("'compliance'"));
  });

  describe('Batch 248 — network-auditor SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/network-auditor/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Network Auditor'));
    it('has price', () => expect(md).toContain('price: 12.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has run-compliance-scan', () => expect(md).toContain('run-compliance-scan'));
  });

  // ── Batch 249: Connection Pooler ────────────────────
  describe('Batch 249 — connection_pooler migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618860000_agent_connection_pooler.sql'), 'utf-8');
    it('creates agent_connection_pools table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_connection_pools'));
    it('creates agent_pool_connections table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_pool_connections'));
    it('creates agent_pool_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_pool_metrics'));
    it('has backend_type column', () => expect(sql).toContain('backend_type'));
    it('has max_connections column', () => expect(sql).toContain('max_connections'));
    it('has pool_hit_rate column', () => expect(sql).toContain('pool_hit_rate'));
  });

  describe('Batch 249 — connection_pooler types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-connection-pooler.ts'), 'utf-8');
    it('exports PoolBackendType', () => expect(src).toContain('export type PoolBackendType'));
    it('exports PoolStatus', () => expect(src).toContain('export type PoolStatus'));
    it('exports ConnectionState', () => expect(src).toContain('export type ConnectionState'));
    it('exports AgentConnectionPool', () => expect(src).toContain('export interface AgentConnectionPool'));
    it('exports AgentPoolConnection', () => expect(src).toContain('export interface AgentPoolConnection'));
    it('exports AgentPoolMetric', () => expect(src).toContain('export interface AgentPoolMetric'));
    it('PoolBackendType includes postgresql', () => expect(src).toContain("'postgresql'"));
  });

  describe('Batch 249 — connection-pooler SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/connection-pooler/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Connection Pooler'));
    it('has price', () => expect(md).toContain('price: 6.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has drain-pool', () => expect(md).toContain('drain-pool'));
  });

  // ── Batch 250: IP Allocator ─────────────────────────
  describe('Batch 250 — ip_allocator migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618870000_agent_ip_allocator.sql'), 'utf-8');
    it('creates agent_ip_pools table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_pools'));
    it('creates agent_ip_allocations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_allocations'));
    it('creates agent_ip_audit_log table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_ip_audit_log'));
    it('has cidr_block column', () => expect(sql).toContain('cidr_block'));
    it('has ip_address INET column', () => expect(sql).toContain('ip_address INET'));
  });

  describe('Batch 250 — ip_allocator types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-ip-allocator.ts'), 'utf-8');
    it('exports IpPoolStatus', () => expect(src).toContain('export type IpPoolStatus'));
    it('exports IpAllocationType', () => expect(src).toContain('export type IpAllocationType'));
    it('exports AgentIpPool', () => expect(src).toContain('export interface AgentIpPool'));
    it('exports AgentIpAllocation', () => expect(src).toContain('export interface AgentIpAllocation'));
    it('exports AgentIpAuditEntry', () => expect(src).toContain('export interface AgentIpAuditEntry'));
    it('IpAllocationType includes floating', () => expect(src).toContain("'floating'"));
  });

  describe('Batch 250 — ip-allocator SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/ip-allocator/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: IP Allocator'));
    it('has price', () => expect(md).toContain('price: 4.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has detect-conflicts', () => expect(md).toContain('detect-conflicts'));
  });

  // ── Batch 251: Port Scanner ─────────────────────────
  describe('Batch 251 — port_scanner migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618880000_agent_port_scanner.sql'), 'utf-8');
    it('creates agent_scan_targets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_scan_targets'));
    it('creates agent_scan_results table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_scan_results'));
    it('creates agent_port_services table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_port_services'));
    it('has port_range column', () => expect(sql).toContain('port_range'));
    it('has service_name column', () => expect(sql).toContain('service_name'));
    it('has risk_level column', () => expect(sql).toContain('risk_level'));
  });

  describe('Batch 251 — port_scanner types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-port-scanner.ts'), 'utf-8');
    it('exports PortScanType', () => expect(src).toContain('export type PortScanType'));
    it('exports PortState', () => expect(src).toContain('export type PortState'));
    it('exports PortRiskLevel', () => expect(src).toContain('export type PortRiskLevel'));
    it('exports AgentScanTarget', () => expect(src).toContain('export interface AgentScanTarget'));
    it('exports AgentScanResult', () => expect(src).toContain('export interface AgentScanResult'));
    it('exports AgentPortService', () => expect(src).toContain('export interface AgentPortService'));
    it('PortScanType includes syn', () => expect(src).toContain("'syn'"));
  });

  describe('Batch 251 — port-scanner SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/port-scanner/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Port Scanner'));
    it('has price', () => expect(md).toContain('price: 8.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has risk-assessment', () => expect(md).toContain('risk-assessment'));
  });

  // ── Batch 252: Edge Router ──────────────────────────
  describe('Batch 252 — edge_router migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618890000_agent_edge_router.sql'), 'utf-8');
    it('creates agent_edge_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_edge_configs'));
    it('creates agent_edge_routes table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_edge_routes'));
    it('creates agent_edge_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_edge_access_logs'));
    it('has tls_mode column', () => expect(sql).toContain('tls_mode'));
    it('has cache_status column', () => expect(sql).toContain('cache_status'));
    it('has edge_location column', () => expect(sql).toContain('edge_location'));
  });

  describe('Batch 252 — edge_router types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-edge-router.ts'), 'utf-8');
    it('exports EdgeTlsMode', () => expect(src).toContain('export type EdgeTlsMode'));
    it('exports EdgeRouterStatus', () => expect(src).toContain('export type EdgeRouterStatus'));
    it('exports EdgeCacheStatus', () => expect(src).toContain('export type EdgeCacheStatus'));
    it('exports AgentEdgeConfig', () => expect(src).toContain('export interface AgentEdgeConfig'));
    it('exports AgentEdgeRoute', () => expect(src).toContain('export interface AgentEdgeRoute'));
    it('exports AgentEdgeAccessLog', () => expect(src).toContain('export interface AgentEdgeAccessLog'));
    it('EdgeTlsMode includes mutual', () => expect(src).toContain("'mutual'"));
  });

  describe('Batch 252 — edge-router SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/edge-router/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Edge Router'));
    it('has price', () => expect(md).toContain('price: 11.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has configure-tls', () => expect(md).toContain('configure-tls'));
  });

  // ── Barrel exports ──────────────────────────────────
  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports network-auditor', () => expect(idx).toContain("from './agent-network-auditor.js'"));
    it('exports connection-pooler', () => expect(idx).toContain("from './agent-connection-pooler.js'"));
    it('exports ip-allocator', () => expect(idx).toContain("from './agent-ip-allocator.js'"));
    it('exports port-scanner', () => expect(idx).toContain("from './agent-port-scanner.js'"));
    it('exports edge-router', () => expect(idx).toContain("from './agent-edge-router.js'"));
  });

  // ── Eidolon types ───────────────────────────────────
  describe('Eidolon BK + EK + districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has network_auditor BK', () => expect(types).toContain("'network_auditor'"));
    it('has connection_pooler BK', () => expect(types).toContain("'connection_pooler'"));
    it('has ip_allocator BK', () => expect(types).toContain("'ip_allocator'"));
    it('has port_scanner BK', () => expect(types).toContain("'port_scanner'"));
    it('has edge_router BK', () => expect(types).toContain("'edge_router'"));
    it('has audit.scan_started EK', () => expect(types).toContain("'audit.scan_started'"));
    it('has pool.created EK', () => expect(types).toContain("'pool.created'"));
    it('has ipam.ip_allocated EK', () => expect(types).toContain("'ipam.ip_allocated'"));
    it('has portscan.completed EK', () => expect(types).toContain("'portscan.completed'"));
    it('has edge.traffic_routed EK', () => expect(types).toContain("'edge.traffic_routed'"));
    it('districtFor has network_auditor case', () => expect(types).toContain("case 'network_auditor':"));
    it('districtFor has edge_router case', () => expect(types).toContain("case 'edge_router':"));
  });

  // ── SUBJECT_MAP ─────────────────────────────────────
  describe('SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.audit.scan_started', () => expect(bus).toContain("'sven.audit.scan_started'"));
    it('has sven.audit.scan_completed', () => expect(bus).toContain("'sven.audit.scan_completed'"));
    it('has sven.pool.created', () => expect(bus).toContain("'sven.pool.created'"));
    it('has sven.pool.drained', () => expect(bus).toContain("'sven.pool.drained'"));
    it('has sven.ipam.pool_created', () => expect(bus).toContain("'sven.ipam.pool_created'"));
    it('has sven.ipam.conflict_detected', () => expect(bus).toContain("'sven.ipam.conflict_detected'"));
    it('has sven.portscan.started', () => expect(bus).toContain("'sven.portscan.started'"));
    it('has sven.portscan.risk_assessed', () => expect(bus).toContain("'sven.portscan.risk_assessed'"));
    it('has sven.edge.config_created', () => expect(bus).toContain("'sven.edge.config_created'"));
    it('has sven.edge.traffic_routed', () => expect(bus).toContain("'sven.edge.traffic_routed'"));
  });

  // ── Task executor ───────────────────────────────────
  describe('Task executor — switch cases', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'audit_run_scan', 'audit_list_findings', 'audit_generate_report', 'audit_schedule_scan', 'audit_remediate', 'audit_view_report',
      'pool_create', 'pool_resize', 'pool_drain', 'pool_metrics', 'pool_list_connections', 'pool_health_check',
      'ipam_create_pool', 'ipam_allocate', 'ipam_release', 'ipam_detect_conflicts', 'ipam_utilization', 'ipam_audit_log',
      'scan_target', 'scan_detect_services', 'scan_schedule', 'scan_compare', 'scan_risk_assessment', 'scan_export',
      'edge_create_config', 'edge_add_route', 'edge_configure_tls', 'edge_enable_cache', 'edge_rate_limit', 'edge_view_logs',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(tex).toContain(`case '${c}'`));
    }
  });

  describe('Task executor — handler methods', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleAuditRunScan', 'handleAuditListFindings', 'handleAuditGenerateReport',
      'handlePoolCreate', 'handlePoolResize', 'handlePoolDrain',
      'handleIpamCreatePool', 'handleIpamAllocate', 'handleIpamDetectConflicts',
      'handleScanTarget', 'handleScanDetectServices', 'handleScanRiskAssessment',
      'handleEdgeCreateConfig', 'handleEdgeAddRoute', 'handleEdgeConfigureTls',
    ];
    for (const h of handlers) {
      it(`has ${h}()`, () => expect(tex).toContain(`${h}(task`));
    }
  });

  // ── .gitattributes ──────────────────────────────────
  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has network-auditor type', () => expect(ga).toContain('agent-network-auditor.ts'));
    it('has connection-pooler type', () => expect(ga).toContain('agent-connection-pooler.ts'));
    it('has ip-allocator type', () => expect(ga).toContain('agent-ip-allocator.ts'));
    it('has port-scanner type', () => expect(ga).toContain('agent-port-scanner.ts'));
    it('has edge-router type', () => expect(ga).toContain('agent-edge-router.ts'));
  });
});
