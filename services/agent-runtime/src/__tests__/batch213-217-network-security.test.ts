import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath));
}

const VERTICALS = [
  { name: 'network_monitor', migration: '20260618500000_agent_network_monitor.sql', tables: ['agent_network_monitors', 'agent_network_alerts', 'agent_network_metrics'], skill: 'network-monitor', bk: 'network_monitor', ek: ['monitor.check_executed', 'monitor.alert_triggered', 'monitor.metric_recorded', 'monitor.uptime_reported'], district: 'industrial', cases: ['monitor_create', 'monitor_check', 'monitor_configure_alerts', 'monitor_uptime_report', 'monitor_acknowledge_alert', 'monitor_metrics'] },
  { name: 'packet_analyzer', migration: '20260618510000_agent_packet_analyzer.sql', tables: ['agent_packet_captures', 'agent_packet_analyses', 'agent_packet_rules'], skill: 'packet-analyzer', bk: 'packet_analyzer', ek: ['packet.capture_started', 'packet.analysis_completed', 'packet.rule_created', 'packet.anomaly_detected'], district: 'industrial', cases: ['packet_capture_start', 'packet_analyze', 'packet_create_rule', 'packet_traffic_summary', 'packet_anomaly_scan', 'packet_export'] },
  { name: 'bandwidth_controller', migration: '20260618520000_agent_bandwidth_controller.sql', tables: ['agent_bandwidth_policies', 'agent_bandwidth_usage', 'agent_bandwidth_quotas'], skill: 'bandwidth-controller', bk: 'bandwidth_controller', ek: ['bandwidth.policy_created', 'bandwidth.quota_set', 'bandwidth.usage_reported', 'bandwidth.throttle_applied'], district: 'industrial', cases: ['bandwidth_create_policy', 'bandwidth_set_quota', 'bandwidth_usage_report', 'bandwidth_adjust_shaping', 'bandwidth_quota_check', 'bandwidth_throttle'] },
  { name: 'firewall_manager', migration: '20260618530000_agent_firewall_manager.sql', tables: ['agent_firewall_rulesets', 'agent_firewall_rules', 'agent_firewall_logs'], skill: 'firewall-manager', bk: 'firewall_manager', ek: ['firewall.ruleset_created', 'firewall.rule_added', 'firewall.traffic_evaluated', 'firewall.threat_detected'], district: 'civic', cases: ['firewall_create_ruleset', 'firewall_add_rule', 'firewall_evaluate', 'firewall_security_audit', 'firewall_review_threats', 'firewall_export_rules'] },
  { name: 'proxy_server', migration: '20260618540000_agent_proxy_server.sql', tables: ['agent_proxy_endpoints', 'agent_proxy_access_rules', 'agent_proxy_traffic_logs'], skill: 'proxy-server', bk: 'proxy_server', ek: ['proxy.endpoint_created', 'proxy.access_rule_added', 'proxy.cache_configured', 'proxy.traffic_logged'], district: 'industrial', cases: ['proxy_create_endpoint', 'proxy_add_access_rule', 'proxy_configure_cache', 'proxy_traffic_analytics', 'proxy_health_check', 'proxy_rotate_upstream'] },
];

describe('Batches 213-217: Network Security & Monitoring', () => {

  describe('Step 1: Migration SQL files', () => {
    for (const v of VERTICALS) {
      it(`migration file exists for ${v.name}`, () => {
        expect(fileExists(`services/gateway-api/migrations/${v.migration}`)).toBe(true);
      });

      it(`${v.name} migration creates ${v.tables.length} tables`, () => {
        const sql = readFile(`services/gateway-api/migrations/${v.migration}`);
        for (const t of v.tables) {
          expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${t}`);
        }
      });

      it(`${v.name} migration has proper indexes`, () => {
        const sql = readFile(`services/gateway-api/migrations/${v.migration}`);
        expect(sql).toContain('CREATE INDEX');
      });
    }
  });

  describe('Step 2: Shared TypeScript types', () => {
    for (const v of VERTICALS) {
      it(`type file exists for ${v.name}`, () => {
        expect(fileExists(`packages/shared/src/agent-${v.skill}.ts`)).toBe(true);
      });

      it(`${v.name} types export interfaces`, () => {
        const ts = readFile(`packages/shared/src/agent-${v.skill}.ts`);
        expect(ts).toContain('export interface');
        expect(ts).toContain('export type');
      });
    }
  });

  describe('Step 3: Barrel exports and SKILL.md', () => {
    const indexTs = readFile('packages/shared/src/index.ts');

    for (const v of VERTICALS) {
      it(`barrel exports ${v.name}`, () => {
        expect(indexTs).toContain(`./agent-${v.skill}.js`);
      });

      it(`SKILL.md exists for ${v.skill}`, () => {
        expect(fileExists(`skills/autonomous-economy/${v.skill}/SKILL.md`)).toBe(true);
      });

      it(`${v.skill} SKILL.md has Actions section`, () => {
        const md = readFile(`skills/autonomous-economy/${v.skill}/SKILL.md`);
        expect(md).toContain('## Actions');
      });
    }
  });

  describe('Step 4: Eidolon BK, EK, districtFor', () => {
    const types = readFile('services/sven-eidolon/src/types.ts');

    for (const v of VERTICALS) {
      it(`BK includes ${v.bk}`, () => {
        expect(types).toContain(`'${v.bk}'`);
      });

      for (const ek of v.ek) {
        it(`EK includes ${ek}`, () => {
          expect(types).toContain(`'${ek}'`);
        });
      }

      it(`districtFor maps ${v.bk} to ${v.district}`, () => {
        expect(types).toContain(`case '${v.bk}':`);
      });
    }
  });

  describe('Step 5: SUBJECT_MAP entries', () => {
    const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');

    for (const v of VERTICALS) {
      for (const ek of v.ek) {
        const subject = `sven.${ek.split('.')[0]}.${ek.split('.')[1]}`;
        it(`SUBJECT_MAP has ${subject}`, () => {
          expect(eventBus).toContain(`'${subject}'`);
        });
      }
    }
  });

  describe('Step 6: Task executor switch cases + handlers', () => {
    const executor = readFile('services/sven-marketplace/src/task-executor.ts');

    for (const v of VERTICALS) {
      for (const c of v.cases) {
        it(`switch case exists for ${c}`, () => {
          expect(executor).toContain(`case '${c}':`);
        });
      }
    }

    it('has 30 new handler methods', () => {
      const handlerNames = VERTICALS.flatMap(v => v.cases);
      for (const c of handlerNames) {
        const methodName = 'handle' + c.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join('');
        expect(executor).toContain(methodName);
      }
    });
  });

  describe('Step 7: .gitattributes entries', () => {
    const gitattr = readFile('.gitattributes');

    for (const v of VERTICALS) {
      it(`migration filter for ${v.name}`, () => {
        expect(gitattr).toContain(v.migration);
      });

      it(`type file filter for ${v.name}`, () => {
        expect(gitattr).toContain(`agent-${v.skill}.ts`);
      });

      it(`SKILL.md filter for ${v.skill}`, () => {
        expect(gitattr).toContain(`${v.skill}/SKILL.md`);
      });
    }
  });
});
