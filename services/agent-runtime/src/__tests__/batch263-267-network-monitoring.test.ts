import * as fs from 'fs';
import * as path from 'path';
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 263-267: Network Monitoring', () => {
  // --- Batch 263: Network Tap ---
  describe('Batch 263 — Network Tap Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619000000_agent_network_tap.sql'), 'utf-8');
    test('creates agent_tap_configs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_tap_configs'); });
    test('creates agent_tap_sessions table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_tap_sessions'); });
    test('creates agent_tap_filters table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_tap_filters'); });
    test('has indexes', () => { expect(sql).toContain('idx_tap_configs_agent'); });
  });
  describe('Batch 263 — Network Tap Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-network-tap.ts'), 'utf-8');
    test('exports TapCaptureMode', () => { expect(types).toContain('TapCaptureMode'); });
    test('exports TapSessionStatus', () => { expect(types).toContain('TapSessionStatus'); });
    test('exports AgentTapConfig', () => { expect(types).toContain('AgentTapConfig'); });
    test('exports AgentTapSession', () => { expect(types).toContain('AgentTapSession'); });
    test('exports AgentTapFilter', () => { expect(types).toContain('AgentTapFilter'); });
  });
  describe('Batch 263 — Network Tap SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/network-tap/SKILL.md'), 'utf-8');
    test('has name', () => { expect(skill).toContain('name: Network Tap'); });
    test('has price', () => { expect(skill).toContain('price: 8.99'); });
    test('has actions', () => { expect(skill).toContain('## Actions'); });
  });

  // --- Batch 264: Flow Collector ---
  describe('Batch 264 — Flow Collector Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619010000_agent_flow_collector.sql'), 'utf-8');
    test('creates agent_flow_configs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_flow_configs'); });
    test('creates agent_flow_records table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_flow_records'); });
    test('creates agent_flow_reports table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_flow_reports'); });
    test('has indexes', () => { expect(sql).toContain('idx_flow_configs_agent'); });
  });
  describe('Batch 264 — Flow Collector Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-flow-collector.ts'), 'utf-8');
    test('exports FlowProtocol', () => { expect(types).toContain('FlowProtocol'); });
    test('exports FlowReportType', () => { expect(types).toContain('FlowReportType'); });
    test('exports AgentFlowConfig', () => { expect(types).toContain('AgentFlowConfig'); });
    test('exports AgentFlowRecord', () => { expect(types).toContain('AgentFlowRecord'); });
    test('exports AgentFlowReport', () => { expect(types).toContain('AgentFlowReport'); });
  });
  describe('Batch 264 — Flow Collector SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/flow-collector/SKILL.md'), 'utf-8');
    test('has name', () => { expect(skill).toContain('name: Flow Collector'); });
    test('has price', () => { expect(skill).toContain('price: 9.99'); });
    test('has actions', () => { expect(skill).toContain('## Actions'); });
  });

  // --- Batch 265: sFlow Agent ---
  describe('Batch 265 — sFlow Agent Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619020000_agent_sflow_agent.sql'), 'utf-8');
    test('creates agent_sflow_configs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_sflow_configs'); });
    test('creates agent_sflow_counters table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_sflow_counters'); });
    test('creates agent_sflow_samples table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_sflow_samples'); });
    test('has indexes', () => { expect(sql).toContain('idx_sflow_configs_agent'); });
  });
  describe('Batch 265 — sFlow Agent Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-sflow-agent.ts'), 'utf-8');
    test('exports SflowSampleType', () => { expect(types).toContain('SflowSampleType'); });
    test('exports AgentSflowConfig', () => { expect(types).toContain('AgentSflowConfig'); });
    test('exports AgentSflowCounter', () => { expect(types).toContain('AgentSflowCounter'); });
    test('exports AgentSflowSample', () => { expect(types).toContain('AgentSflowSample'); });
  });
  describe('Batch 265 — sFlow Agent SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/sflow-agent/SKILL.md'), 'utf-8');
    test('has name', () => { expect(skill).toContain('name: sFlow Agent'); });
    test('has price', () => { expect(skill).toContain('price: 7.99'); });
    test('has actions', () => { expect(skill).toContain('## Actions'); });
  });

  // --- Batch 266: NetFlow Exporter ---
  describe('Batch 266 — NetFlow Exporter Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619030000_agent_netflow_exporter.sql'), 'utf-8');
    test('creates agent_netflow_configs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_netflow_configs'); });
    test('creates agent_netflow_templates table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_netflow_templates'); });
    test('creates agent_netflow_stats table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_netflow_stats'); });
    test('has indexes', () => { expect(sql).toContain('idx_netflow_configs_agent'); });
  });
  describe('Batch 266 — NetFlow Exporter Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-netflow-exporter.ts'), 'utf-8');
    test('exports NetflowVersion', () => { expect(types).toContain('NetflowVersion'); });
    test('exports AgentNetflowConfig', () => { expect(types).toContain('AgentNetflowConfig'); });
    test('exports AgentNetflowTemplate', () => { expect(types).toContain('AgentNetflowTemplate'); });
    test('exports AgentNetflowStat', () => { expect(types).toContain('AgentNetflowStat'); });
  });
  describe('Batch 266 — NetFlow Exporter SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/netflow-exporter/SKILL.md'), 'utf-8');
    test('has name', () => { expect(skill).toContain('name: NetFlow Exporter'); });
    test('has price', () => { expect(skill).toContain('price: 6.99'); });
    test('has actions', () => { expect(skill).toContain('## Actions'); });
  });

  // --- Batch 267: ARP Inspector ---
  describe('Batch 267 — ARP Inspector Migration', () => {
    const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations/20260619040000_agent_arp_inspector.sql'), 'utf-8');
    test('creates agent_arp_configs table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_arp_configs'); });
    test('creates agent_arp_bindings table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_arp_bindings'); });
    test('creates agent_arp_violations table', () => { expect(sql).toContain('CREATE TABLE IF NOT EXISTS agent_arp_violations'); });
    test('has indexes', () => { expect(sql).toContain('idx_arp_configs_agent'); });
  });
  describe('Batch 267 — ARP Inspector Types', () => {
    const types = fs.readFileSync(path.join(ROOT, 'packages/shared/src/agent-arp-inspector.ts'), 'utf-8');
    test('exports ArpTrustMode', () => { expect(types).toContain('ArpTrustMode'); });
    test('exports ArpBindingType', () => { expect(types).toContain('ArpBindingType'); });
    test('exports ArpViolationType', () => { expect(types).toContain('ArpViolationType'); });
    test('exports AgentArpConfig', () => { expect(types).toContain('AgentArpConfig'); });
    test('exports AgentArpBinding', () => { expect(types).toContain('AgentArpBinding'); });
    test('exports AgentArpViolation', () => { expect(types).toContain('AgentArpViolation'); });
  });
  describe('Batch 267 — ARP Inspector SKILL.md', () => {
    const skill = fs.readFileSync(path.join(ROOT, 'skills/autonomous-economy/arp-inspector/SKILL.md'), 'utf-8');
    test('has name', () => { expect(skill).toContain('name: ARP Inspector'); });
    test('has price', () => { expect(skill).toContain('price: 10.99'); });
    test('has actions', () => { expect(skill).toContain('## Actions'); });
  });

  // --- Cross-batch wiring ---
  describe('Barrel exports', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    test('exports network-tap', () => { expect(idx).toContain('./agent-network-tap'); });
    test('exports flow-collector', () => { expect(idx).toContain('./agent-flow-collector'); });
    test('exports sflow-agent', () => { expect(idx).toContain('./agent-sflow-agent'); });
    test('exports netflow-exporter', () => { expect(idx).toContain('./agent-netflow-exporter'); });
    test('exports arp-inspector', () => { expect(idx).toContain('./agent-arp-inspector'); });
  });
  describe('Eidolon BK + EK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['network_tap','flow_collector','sflow_agent','netflow_exporter','arp_inspector']) {
      test(`BK has ${bk}`, () => { expect(types).toContain(`'${bk}'`); });
    }
    for (const ek of ['tap.session_started','fc.collection_started','sflow.sampling_started','nf.export_started','arp.violation_detected']) {
      test(`EK has ${ek}`, () => { expect(types).toContain(`'${ek}'`); });
    }
  });
  describe('SUBJECT_MAP entries', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    for (const subj of ['sven.tap.session_started','sven.fc.collection_started','sven.sflow.sampling_started','sven.nf.export_started','sven.arp.violation_detected']) {
      test(`has ${subj}`, () => { expect(eb).toContain(`'${subj}'`); });
    }
  });
  describe('Task executor switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    for (const c of ['tap_configure','fc_configure','sflow_configure','nf_configure','arp_configure','arp_export_data']) {
      test(`has case ${c}`, () => { expect(te).toContain(`case '${c}'`); });
    }
  });
  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    test('has network-tap migration', () => { expect(ga).toContain('20260619000000_agent_network_tap.sql'); });
    test('has arp-inspector skill', () => { expect(ga).toContain('arp-inspector/**'); });
  });
});
