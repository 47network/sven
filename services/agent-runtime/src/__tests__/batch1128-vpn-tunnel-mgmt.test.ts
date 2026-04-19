import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 1128-1132 · VPN Tunnel Management', () => {
  const verticals = [
    {
      name: 'vpn_tunnel_provisioner', migration: '20260627650000_agent_vpn_tunnel_provisioner.sql',
      typeFile: 'agent-vpn-tunnel-provisioner.ts', skillDir: 'vpn-tunnel-provisioner',
      interfaces: ['VpnTunnelProvisionerConfig', 'VpnTunnelProvisionerEvent', 'VpnTunnelProvisionerRule'],
      bk: 'vpn_tunnel_provisioner', eks: ['vtp.analysis_completed', 'vtp.alert_triggered', 'vtp.export_emitted'],
      subjects: ['sven.vtp.analysis_completed', 'sven.vtp.alert_triggered', 'sven.vtp.export_emitted'],
      cases: ['vtp_monitor', 'vtp_analyzer', 'vtp_reporter'],
    },
    {
      name: 'vpn_tunnel_monitor', migration: '20260627660000_agent_vpn_tunnel_monitor.sql',
      typeFile: 'agent-vpn-tunnel-monitor.ts', skillDir: 'vpn-tunnel-monitor',
      interfaces: ['VpnTunnelMonitorConfig', 'VpnTunnelMonitorEvent', 'VpnTunnelMonitorRule'],
      bk: 'vpn_tunnel_monitor', eks: ['vtm.analysis_completed', 'vtm.alert_triggered', 'vtm.export_emitted'],
      subjects: ['sven.vtm.analysis_completed', 'sven.vtm.alert_triggered', 'sven.vtm.export_emitted'],
      cases: ['vtm_monitor', 'vtm_analyzer', 'vtm_reporter'],
    },
    {
      name: 'vpn_tunnel_key_rotator', migration: '20260627670000_agent_vpn_tunnel_key_rotator.sql',
      typeFile: 'agent-vpn-tunnel-key-rotator.ts', skillDir: 'vpn-tunnel-key-rotator',
      interfaces: ['VpnTunnelKeyRotatorConfig', 'VpnTunnelKeyRotatorEvent', 'VpnTunnelKeyRotatorRule'],
      bk: 'vpn_tunnel_key_rotator', eks: ['vtkr.analysis_completed', 'vtkr.alert_triggered', 'vtkr.export_emitted'],
      subjects: ['sven.vtkr.analysis_completed', 'sven.vtkr.alert_triggered', 'sven.vtkr.export_emitted'],
      cases: ['vtkr_monitor', 'vtkr_analyzer', 'vtkr_reporter'],
    },
    {
      name: 'vpn_tunnel_traffic_analyzer', migration: '20260627680000_agent_vpn_tunnel_traffic_analyzer.sql',
      typeFile: 'agent-vpn-tunnel-traffic-analyzer.ts', skillDir: 'vpn-tunnel-traffic-analyzer',
      interfaces: ['VpnTunnelTrafficAnalyzerConfig', 'VpnTunnelTrafficAnalyzerEvent', 'VpnTunnelTrafficAnalyzerRule'],
      bk: 'vpn_tunnel_traffic_analyzer', eks: ['vtta.analysis_completed', 'vtta.alert_triggered', 'vtta.export_emitted'],
      subjects: ['sven.vtta.analysis_completed', 'sven.vtta.alert_triggered', 'sven.vtta.export_emitted'],
      cases: ['vtta_monitor', 'vtta_analyzer', 'vtta_reporter'],
    },
    {
      name: 'vpn_tunnel_compliance_auditor', migration: '20260627690000_agent_vpn_tunnel_compliance_auditor.sql',
      typeFile: 'agent-vpn-tunnel-compliance-auditor.ts', skillDir: 'vpn-tunnel-compliance-auditor',
      interfaces: ['VpnTunnelComplianceAuditorConfig', 'VpnTunnelComplianceAuditorEvent', 'VpnTunnelComplianceAuditorRule'],
      bk: 'vpn_tunnel_compliance_auditor', eks: ['vtca.analysis_completed', 'vtca.alert_triggered', 'vtca.export_emitted'],
      subjects: ['sven.vtca.analysis_completed', 'sven.vtca.alert_triggered', 'sven.vtca.export_emitted'],
      cases: ['vtca_monitor', 'vtca_analyzer', 'vtca_reporter'],
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
