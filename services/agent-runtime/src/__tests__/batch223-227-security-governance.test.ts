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
  { name: 'identity_provider', migration: '20260618600000_agent_identity_provider.sql', tables: ['agent_identity_providers', 'agent_identity_sessions', 'agent_identity_mappings'], skill: 'identity-provider', bk: 'identity_provider', ek: ['identity.provider_configured', 'identity.session_created', 'identity.mapping_updated', 'identity.authentication_completed'], district: 'civic', cases: ['idp_configure_provider', 'idp_create_session', 'idp_map_identity', 'idp_authenticate', 'idp_revoke_session', 'idp_list_providers'] },
  { name: 'key_manager', migration: '20260618610000_agent_key_manager.sql', tables: ['agent_encryption_keys', 'agent_key_rotations', 'agent_key_usage_logs'], skill: 'key-manager', bk: 'key_manager', ek: ['key.generated', 'key.rotated', 'key.revoked', 'key.usage_logged'], district: 'civic', cases: ['key_generate', 'key_rotate', 'key_revoke', 'key_encrypt', 'key_decrypt', 'key_audit_usage'] },
  { name: 'audit_logger', migration: '20260618620000_agent_audit_logger.sql', tables: ['agent_audit_logs', 'agent_audit_policies', 'agent_audit_alerts'], skill: 'audit-logger', bk: 'audit_logger', ek: ['audit.log_created', 'audit.policy_updated', 'audit.alert_triggered', 'audit.retention_applied'], district: 'civic', cases: ['audit_create_log', 'audit_create_policy', 'audit_query_logs', 'audit_trigger_alert', 'audit_apply_retention', 'audit_export_logs'] },
  { name: 'compliance_checker', migration: '20260618630000_agent_compliance_checker.sql', tables: ['agent_compliance_frameworks', 'agent_compliance_checks', 'agent_compliance_reports'], skill: 'compliance-checker', bk: 'compliance_checker', ek: ['compliance.framework_added', 'compliance.check_completed', 'compliance.report_generated', 'compliance.violation_detected'], district: 'civic', cases: ['compliance_add_framework', 'compliance_run_check', 'compliance_generate_report', 'compliance_track_violation', 'compliance_remediate', 'compliance_certify'] },
  { name: 'threat_detector', migration: '20260618640000_agent_threat_detector.sql', tables: ['agent_threat_rules', 'agent_threat_detections', 'agent_threat_responses'], skill: 'threat-detector', bk: 'threat_detector', ek: ['threat.rule_created', 'threat.detected', 'threat.response_executed', 'threat.mitigated'], district: 'industrial', cases: ['threat_create_rule', 'threat_detect', 'threat_respond', 'threat_investigate', 'threat_mitigate', 'threat_report'] },
];

describe('Batches 223-227: Security Governance', () => {

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
        const parts = ek.split('.');
        it(`SUBJECT_MAP has sven.${ek}`, () => {
          expect(eventBus).toContain(`'sven.${parts[0]}.${parts[1]}'`);
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
