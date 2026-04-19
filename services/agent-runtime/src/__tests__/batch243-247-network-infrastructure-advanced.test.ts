import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 243-247 — Network Infrastructure Advanced', () => {

  // ── Batch 243: Proxy Manager ────────────────────────
  describe('Batch 243 — proxy_manager migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618800000_agent_proxy_manager.sql'), 'utf-8');
    it('creates agent_proxy_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_configs'));
    it('creates agent_proxy_rules table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_rules'));
    it('creates agent_proxy_access_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_proxy_access_logs'));
    it('has proxy_type column', () => expect(sql).toContain('proxy_type'));
    it('has upstream_url column', () => expect(sql).toContain('upstream_url'));
    it('has ssl_enabled column', () => expect(sql).toContain('ssl_enabled'));
  });

  describe('Batch 243 — proxy_manager types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-proxy-manager.ts'), 'utf-8');
    it('exports ProxyType', () => expect(src).toContain('export type ProxyType'));
    it('exports ProxyStatus', () => expect(src).toContain('export type ProxyStatus'));
    it('exports ProxyRuleType', () => expect(src).toContain('export type ProxyRuleType'));
    it('exports AgentProxyConfig', () => expect(src).toContain('export interface AgentProxyConfig'));
    it('exports AgentProxyRule', () => expect(src).toContain('export interface AgentProxyRule'));
    it('exports AgentProxyAccessLog', () => expect(src).toContain('export interface AgentProxyAccessLog'));
    it('ProxyType includes reverse', () => expect(src).toContain("'reverse'"));
    it('ProxyType includes socks5', () => expect(src).toContain("'socks5'"));
  });

  describe('Batch 243 — proxy-manager SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/proxy-manager/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Proxy Manager'));
    it('has category', () => expect(md).toContain('category: network-infrastructure'));
    it('has price', () => expect(md).toContain('price: 4.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has create-proxy action', () => expect(md).toContain('create-proxy'));
    it('has health-check action', () => expect(md).toContain('health-check'));
  });

  // ── Batch 244: VPN Provisioner ──────────────────────
  describe('Batch 244 — vpn_provisioner migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618810000_agent_vpn_provisioner.sql'), 'utf-8');
    it('creates agent_vpn_configs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_configs'));
    it('creates agent_vpn_peers table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_peers'));
    it('creates agent_vpn_connection_logs table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_vpn_connection_logs'));
    it('has vpn_type column', () => expect(sql).toContain('vpn_type'));
    it('has private_key_ref column', () => expect(sql).toContain('private_key_ref'));
    it('has address_pool column', () => expect(sql).toContain('address_pool'));
  });

  describe('Batch 244 — vpn_provisioner types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-vpn-provisioner.ts'), 'utf-8');
    it('exports VpnType', () => expect(src).toContain('export type VpnType'));
    it('exports VpnStatus', () => expect(src).toContain('export type VpnStatus'));
    it('exports VpnEventType', () => expect(src).toContain('export type VpnEventType'));
    it('exports AgentVpnConfig', () => expect(src).toContain('export interface AgentVpnConfig'));
    it('exports AgentVpnPeer', () => expect(src).toContain('export interface AgentVpnPeer'));
    it('exports AgentVpnConnectionLog', () => expect(src).toContain('export interface AgentVpnConnectionLog'));
    it('VpnType includes wireguard', () => expect(src).toContain("'wireguard'"));
    it('VpnType includes ipsec', () => expect(src).toContain("'ipsec'"));
  });

  describe('Batch 244 — vpn-provisioner SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/vpn-provisioner/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: VPN Provisioner'));
    it('has price', () => expect(md).toContain('price: 7.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has provision-tunnel action', () => expect(md).toContain('provision-tunnel'));
    it('has rotate-keys action', () => expect(md).toContain('rotate-keys'));
  });

  // ── Batch 245: Bandwidth Optimizer ──────────────────
  describe('Batch 245 — bandwidth_optimizer migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618820000_agent_bandwidth_optimizer.sql'), 'utf-8');
    it('creates agent_bandwidth_profiles table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_bandwidth_profiles'));
    it('creates agent_bandwidth_allocations table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_bandwidth_allocations'));
    it('creates agent_bandwidth_metrics table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_bandwidth_metrics'));
    it('has max_bandwidth_mbps column', () => expect(sql).toContain('max_bandwidth_mbps'));
    it('has shaping_algorithm column', () => expect(sql).toContain('shaping_algorithm'));
  });

  describe('Batch 245 — bandwidth_optimizer types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-bandwidth-optimizer.ts'), 'utf-8');
    it('exports ShapingAlgorithm', () => expect(src).toContain('export type ShapingAlgorithm'));
    it('exports BandwidthTargetType', () => expect(src).toContain('export type BandwidthTargetType'));
    it('exports BandwidthAllocationStatus', () => expect(src).toContain('export type BandwidthAllocationStatus'));
    it('exports AgentBandwidthProfile', () => expect(src).toContain('export interface AgentBandwidthProfile'));
    it('exports AgentBandwidthAllocation', () => expect(src).toContain('export interface AgentBandwidthAllocation'));
    it('exports AgentBandwidthMetric', () => expect(src).toContain('export interface AgentBandwidthMetric'));
    it('ShapingAlgorithm includes token_bucket', () => expect(src).toContain("'token_bucket'"));
  });

  describe('Batch 245 — bandwidth-optimizer SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/bandwidth-optimizer/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Bandwidth Optimizer'));
    it('has price', () => expect(md).toContain('price: 5.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has optimize-shaping action', () => expect(md).toContain('optimize-shaping'));
  });

  // ── Batch 246: Latency Analyzer ─────────────────────
  describe('Batch 246 — latency_analyzer migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618830000_agent_latency_analyzer.sql'), 'utf-8');
    it('creates agent_latency_targets table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_latency_targets'));
    it('creates agent_latency_measurements table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_latency_measurements'));
    it('creates agent_latency_baselines table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_latency_baselines'));
    it('has target_host column', () => expect(sql).toContain('target_host'));
    it('has check_interval_seconds column', () => expect(sql).toContain('check_interval_seconds'));
  });

  describe('Batch 246 — latency_analyzer types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-latency-analyzer.ts'), 'utf-8');
    it('exports LatencyProtocol', () => expect(src).toContain('export type LatencyProtocol'));
    it('exports LatencyTargetStatus', () => expect(src).toContain('export type LatencyTargetStatus'));
    it('exports AgentLatencyTarget', () => expect(src).toContain('export interface AgentLatencyTarget'));
    it('exports AgentLatencyMeasurement', () => expect(src).toContain('export interface AgentLatencyMeasurement'));
    it('exports AgentLatencyBaseline', () => expect(src).toContain('export interface AgentLatencyBaseline'));
    it('LatencyProtocol includes icmp', () => expect(src).toContain("'icmp'"));
  });

  describe('Batch 246 — latency-analyzer SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/latency-analyzer/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Latency Analyzer'));
    it('has price', () => expect(md).toContain('price: 3.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has compute-baseline action', () => expect(md).toContain('compute-baseline'));
  });

  // ── Batch 247: Packet Inspector ─────────────────────
  describe('Batch 247 — packet_inspector migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260618840000_agent_packet_inspector.sql'), 'utf-8');
    it('creates agent_inspection_policies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_inspection_policies'));
    it('creates agent_packet_captures table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_packet_captures'));
    it('creates agent_packet_anomalies table', () => expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_packet_anomalies'));
    it('has inspection_depth column', () => expect(sql).toContain('inspection_depth'));
    it('has capture_payload column', () => expect(sql).toContain('capture_payload'));
  });

  describe('Batch 247 — packet_inspector types', () => {
    const src = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-packet-inspector.ts'), 'utf-8');
    it('exports InspectionDepth', () => expect(src).toContain('export type InspectionDepth'));
    it('exports PacketProtocol', () => expect(src).toContain('export type PacketProtocol'));
    it('exports AnomalySeverity', () => expect(src).toContain('export type AnomalySeverity'));
    it('exports CaptureStatus', () => expect(src).toContain('export type CaptureStatus'));
    it('exports AgentInspectionPolicy', () => expect(src).toContain('export interface AgentInspectionPolicy'));
    it('exports AgentPacketCapture', () => expect(src).toContain('export interface AgentPacketCapture'));
    it('exports AgentPacketAnomaly', () => expect(src).toContain('export interface AgentPacketAnomaly'));
    it('InspectionDepth includes deep', () => expect(src).toContain("'deep'"));
  });

  describe('Batch 247 — packet-inspector SKILL.md', () => {
    const md = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/packet-inspector/SKILL.md'), 'utf-8');
    it('has name', () => expect(md).toContain('name: Packet Inspector'));
    it('has price', () => expect(md).toContain('price: 9.99'));
    it('has Actions heading', () => expect(md).toContain('## Actions'));
    it('has start-capture action', () => expect(md).toContain('start-capture'));
    it('has analyze-anomalies action', () => expect(md).toContain('analyze-anomalies'));
  });

  // ── Barrel exports ──────────────────────────────────
  describe('Barrel exports — index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    it('exports proxy-manager', () => expect(idx).toContain("from './agent-proxy-manager.js'"));
    it('exports vpn-provisioner', () => expect(idx).toContain("from './agent-vpn-provisioner.js'"));
    it('exports bandwidth-optimizer', () => expect(idx).toContain("from './agent-bandwidth-optimizer.js'"));
    it('exports latency-analyzer', () => expect(idx).toContain("from './agent-latency-analyzer.js'"));
    it('exports packet-inspector', () => expect(idx).toContain("from './agent-packet-inspector.js'"));
  });

  // ── Eidolon types ───────────────────────────────────
  describe('Eidolon BK + EK + districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    it('has proxy_manager BK', () => expect(types).toContain("'proxy_manager'"));
    it('has vpn_provisioner BK', () => expect(types).toContain("'vpn_provisioner'"));
    it('has bandwidth_optimizer BK', () => expect(types).toContain("'bandwidth_optimizer'"));
    it('has latency_analyzer BK', () => expect(types).toContain("'latency_analyzer'"));
    it('has packet_inspector BK', () => expect(types).toContain("'packet_inspector'"));
    it('has proxy.configured EK', () => expect(types).toContain("'proxy.configured'"));
    it('has vpn.tunnel_created EK', () => expect(types).toContain("'vpn.tunnel_created'"));
    it('has bandwidth.allocated EK', () => expect(types).toContain("'bandwidth.allocated'"));
    it('has latency.measured EK', () => expect(types).toContain("'latency.measured'"));
    it('has packet.analysis_complete EK', () => expect(types).toContain("'packet.analysis_complete'"));
    it('districtFor has proxy_manager case', () => expect(types).toContain("case 'proxy_manager':"));
    it('districtFor has packet_inspector case', () => expect(types).toContain("case 'packet_inspector':"));
  });

  // ── SUBJECT_MAP ─────────────────────────────────────
  describe('SUBJECT_MAP entries', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    it('has sven.proxy.configured', () => expect(bus).toContain("'sven.proxy.configured'"));
    it('has sven.proxy.health_checked', () => expect(bus).toContain("'sven.proxy.health_checked'"));
    it('has sven.vpn.tunnel_created', () => expect(bus).toContain("'sven.vpn.tunnel_created'"));
    it('has sven.vpn.config_updated', () => expect(bus).toContain("'sven.vpn.config_updated'"));
    it('has sven.bandwidth.profile_created', () => expect(bus).toContain("'sven.bandwidth.profile_created'"));
    it('has sven.bandwidth.optimized', () => expect(bus).toContain("'sven.bandwidth.optimized'"));
    it('has sven.latency.target_added', () => expect(bus).toContain("'sven.latency.target_added'"));
    it('has sven.latency.anomaly_detected', () => expect(bus).toContain("'sven.latency.anomaly_detected'"));
    it('has sven.packet.policy_created', () => expect(bus).toContain("'sven.packet.policy_created'"));
    it('has sven.packet.analysis_complete', () => expect(bus).toContain("'sven.packet.analysis_complete'"));
  });

  // ── Task executor ───────────────────────────────────
  describe('Task executor — switch cases', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'proxy_configure', 'proxy_add_rule', 'proxy_view_logs', 'proxy_health_check', 'proxy_list_configs', 'proxy_update_config',
      'vpn_create_tunnel', 'vpn_add_peer', 'vpn_check_connection', 'vpn_update_config', 'vpn_list_peers', 'vpn_remove_peer',
      'bw_create_profile', 'bw_allocate', 'bw_collect_metrics', 'bw_optimize', 'bw_list_profiles', 'bw_update_profile',
      'latency_add_target', 'latency_measure', 'latency_compute_baseline', 'latency_detect_anomaly', 'latency_list_targets', 'latency_report',
      'pkt_create_policy', 'pkt_start_capture', 'pkt_analyze', 'pkt_list_anomalies', 'pkt_stop_capture', 'pkt_update_policy',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => expect(tex).toContain(`case '${c}'`));
    }
  });

  describe('Task executor — handler methods', () => {
    const tex = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleProxyConfigure', 'handleProxyAddRule', 'handleProxyViewLogs',
      'handleVpnCreateTunnel', 'handleVpnAddPeer', 'handleVpnRemovePeer',
      'handleBwCreateProfile', 'handleBwAllocate', 'handleBwOptimize',
      'handleLatencyAddTarget', 'handleLatencyMeasure', 'handleLatencyComputeBaseline',
      'handlePktCreatePolicy', 'handlePktStartCapture', 'handlePktAnalyze',
    ];
    for (const h of handlers) {
      it(`has ${h}()`, () => expect(tex).toContain(`${h}(task`));
    }
  });

  // ── .gitattributes ──────────────────────────────────
  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    it('has proxy-manager type', () => expect(ga).toContain('agent-proxy-manager.ts'));
    it('has vpn-provisioner type', () => expect(ga).toContain('agent-vpn-provisioner.ts'));
    it('has bandwidth-optimizer type', () => expect(ga).toContain('agent-bandwidth-optimizer.ts'));
    it('has latency-analyzer type', () => expect(ga).toContain('agent-latency-analyzer.ts'));
    it('has packet-inspector type', () => expect(ga).toContain('agent-packet-inspector.ts'));
  });
});
