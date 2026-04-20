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
  { name: 'ssl_manager', migration: '20260618550000_agent_ssl_manager.sql', tables: ['agent_ssl_certificates', 'agent_ssl_renewals', 'agent_ssl_audits'], skill: 'ssl-manager', bk: 'ssl_manager', ek: ['ssl.certificate_issued', 'ssl.renewal_initiated', 'ssl.audit_completed', 'ssl.certificate_revoked'], district: 'civic', cases: ['ssl_issue_certificate', 'ssl_renew_certificate', 'ssl_audit', 'ssl_configure_protocols', 'ssl_monitor_expiry', 'ssl_revoke_certificate'] },
  { name: 'session_manager', migration: '20260618560000_agent_session_manager.sql', tables: ['agent_sessions', 'agent_session_events', 'agent_session_policies'], skill: 'session-manager', bk: 'session_manager', ek: ['session.created', 'session.refreshed', 'session.terminated', 'session.policy_applied'], district: 'civic', cases: ['session_create', 'session_refresh', 'session_terminate', 'session_apply_policy', 'session_audit', 'session_bulk_expire'] },
  { name: 'endpoint_resolver', migration: '20260618570000_agent_endpoint_resolver.sql', tables: ['agent_endpoint_registrations', 'agent_endpoint_health_checks', 'agent_endpoint_routing_rules'], skill: 'endpoint-resolver', bk: 'endpoint_resolver', ek: ['endpoint.registered', 'endpoint.health_checked', 'endpoint.routing_configured', 'endpoint.deregistered'], district: 'industrial', cases: ['endpoint_register', 'endpoint_resolve', 'endpoint_health_check', 'endpoint_configure_routing', 'endpoint_deregister', 'endpoint_list_services'] },
  { name: 'vulnerability_scanner', migration: '20260618580000_agent_vulnerability_scanner.sql', tables: ['agent_vulnerability_scans', 'agent_vulnerabilities', 'agent_vulnerability_remediations'], skill: 'vulnerability-scanner', bk: 'vulnerability_scanner', ek: ['vuln.scan_completed', 'vuln.cve_detected', 'vuln.remediation_applied', 'vuln.compliance_verified'], district: 'civic', cases: ['vuln_full_scan', 'vuln_quick_scan', 'vuln_dependency_scan', 'vuln_track_cve', 'vuln_remediate', 'vuln_compliance_check'] },
  { name: 'traffic_analyzer', migration: '20260618590000_agent_traffic_analyzer.sql', tables: ['agent_traffic_captures', 'agent_traffic_patterns', 'agent_traffic_reports'], skill: 'traffic-analyzer', bk: 'traffic_analyzer', ek: ['traffic.capture_started', 'traffic.pattern_detected', 'traffic.report_generated', 'traffic.threat_identified'], district: 'industrial', cases: ['traffic_start_capture', 'traffic_analyze_patterns', 'traffic_generate_report', 'traffic_detect_threats', 'traffic_forensic_analysis', 'traffic_baseline'] },
];

describe('Batches 218-222: Network Security Extended', () => {

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
      it(`${v.name} migration has indexes`, () => {
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
      it(`districtFor maps ${v.bk}`, () => {
        expect(types).toContain(`case '${v.bk}':`);
      });
    }
  });

  describe('Step 5: SUBJECT_MAP entries', () => {
    const eventBus = readFile('services/sven-eidolon/src/event-bus.ts');
    for (const v of VERTICALS) {
      for (const ek of v.ek) {
        const domain = ek.split('.')[0];
        const event = ek.split('.')[1];
        it(`SUBJECT_MAP has sven.${domain}.${event}`, () => {
          expect(eventBus).toContain(`'sven.${domain}.${event}'`);
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
      const allCases = VERTICALS.flatMap(v => v.cases);
      for (const c of allCases) {
        const methodName = 'handle' + c.split('_').map((w: string) => w[0].toUpperCase() + w.slice(1)).join('');
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
