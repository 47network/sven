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
  { name: 'policy_engine', migration: '20260618650000_agent_policy_engine.sql', tables: ['agent_security_policies', 'agent_policy_evaluations', 'agent_policy_exceptions'], skill: 'policy-engine', bk: 'policy_engine', ek: ['policy.created', 'policy.evaluated', 'policy.exception_granted', 'policy.enforcement_changed'], cases: ['policy_create', 'policy_evaluate', 'policy_grant_exception', 'policy_list', 'policy_audit', 'policy_update_enforcement'] },
  { name: 'data_classifier', migration: '20260618660000_agent_data_classifier.sql', tables: ['agent_data_classifications', 'agent_classification_rules', 'agent_data_lineage'], skill: 'data-classifier', bk: 'data_classifier', ek: ['data.classified', 'data.rule_created', 'data.lineage_tracked', 'data.reclassified'], cases: ['data_classify', 'data_create_rule', 'data_track_lineage', 'data_query_classifications', 'data_reclassify', 'data_export_inventory'] },
  { name: 'encryption_gateway', migration: '20260618670000_agent_encryption_gateway.sql', tables: ['agent_encryption_channels', 'agent_encryption_operations', 'agent_certificate_store'], skill: 'encryption-gateway', bk: 'encryption_gateway', ek: ['encryption.channel_created', 'encryption.operation_performed', 'encryption.certificate_managed', 'encryption.keys_rotated'], cases: ['encrypt_create_channel', 'encrypt_perform_operation', 'encrypt_manage_certificate', 'encrypt_rotate_keys', 'encrypt_audit_operations', 'encrypt_check_expiry'] },
  { name: 'security_scanner', migration: '20260618680000_agent_security_scanner.sql', tables: ['agent_scan_profiles', 'agent_scan_results', 'agent_scan_remediations'], skill: 'security-scanner', bk: 'security_scanner', ek: ['scan.profile_created', 'scan.completed', 'scan.remediation_applied', 'scan.scheduled'], cases: ['scan_create_profile', 'scan_run', 'scan_review_findings', 'scan_apply_remediation', 'scan_schedule', 'scan_compare'] },
  { name: 'incident_manager', migration: '20260618690000_agent_incident_manager.sql', tables: ['agent_incidents', 'agent_incident_responses', 'agent_postmortems'], skill: 'incident-manager', bk: 'incident_manager', ek: ['incident.created', 'incident.responded', 'incident.resolved', 'incident.postmortem_created'], cases: ['incident_create', 'incident_respond', 'incident_escalate', 'incident_resolve', 'incident_postmortem', 'incident_query'] },
];

describe('Batches 228-232: Security Operations', () => {

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
