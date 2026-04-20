import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batches 423-427 — Security & Compliance', () => {

  const verticals = [
    { name: 'cert_rotator', file: 'agent-cert-rotator', migration: '20260620600000_agent_cert_rotator.sql', skillDir: 'cert-rotator', prefix: 'crtr', cases: ['crtr_check_expiry','crtr_renew_cert','crtr_rotate_cert','crtr_revoke_cert','crtr_generate_csr','crtr_audit_certs'], ek: ['crtr.expiry_checked','crtr.cert_renewed','crtr.cert_rotated','crtr.cert_revoked'], subj: ['sven.crtr.expiry_checked','sven.crtr.cert_renewed','sven.crtr.cert_rotated','sven.crtr.cert_revoked'] },
    { name: 'key_escrow', file: 'agent-key-escrow', migration: '20260620610000_agent_key_escrow.sql', skillDir: 'key-escrow', prefix: 'kesc', cases: ['kesc_store_key','kesc_retrieve_key','kesc_rotate_key','kesc_revoke_key','kesc_backup_keys','kesc_audit_access'], ek: ['kesc.key_stored','kesc.key_retrieved','kesc.key_rotated','kesc.key_revoked'], subj: ['sven.kesc.key_stored','sven.kesc.key_retrieved','sven.kesc.key_rotated','sven.kesc.key_revoked'] },
    { name: 'config_auditor', file: 'agent-config-auditor', migration: '20260620620000_agent_config_auditor.sql', skillDir: 'config-auditor', prefix: 'cfga', cases: ['cfga_scan_configs','cfga_create_baseline','cfga_compare_baseline','cfga_list_violations','cfga_remediate_violation','cfga_generate_report'], ek: ['cfga.scan_completed','cfga.baseline_created','cfga.violation_found','cfga.violation_remediated'], subj: ['sven.cfga.scan_completed','sven.cfga.baseline_created','sven.cfga.violation_found','sven.cfga.violation_remediated'] },
    { name: 'uptime_sentinel', file: 'agent-uptime-sentinel', migration: '20260620630000_agent_uptime_sentinel.sql', skillDir: 'uptime-sentinel', prefix: 'upst', cases: ['upst_create_monitor','upst_check_status','upst_get_uptime','upst_list_incidents','upst_resolve_incident','upst_generate_sla_report'], ek: ['upst.monitor_created','upst.status_checked','upst.incident_detected','upst.incident_resolved'], subj: ['sven.upst.monitor_created','sven.upst.status_checked','sven.upst.incident_detected','sven.upst.incident_resolved'] },
    { name: 'drift_detector', file: 'agent-drift-detector', migration: '20260620640000_agent_drift_detector.sql', skillDir: 'drift-detector', prefix: 'drfd', cases: ['drfd_set_baseline','drfd_scan_drift','drfd_list_drift_events','drfd_remediate_drift','drfd_compare_states','drfd_schedule_scan'], ek: ['drfd.baseline_set','drfd.drift_detected','drfd.drift_remediated','drfd.scan_completed'], subj: ['sven.drfd.baseline_set','sven.drfd.drift_detected','sven.drfd.drift_remediated','sven.drfd.scan_completed'] },
  ];

  describe('Migration files', () => {
    verticals.forEach(v => {
      it(`migration exists: ${v.migration}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`migration has CREATE TABLE: ${v.name}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain('CREATE TABLE');
      });
      it(`migration has agent_ prefix tables: ${v.name}`, () => {
        const p = path.join(ROOT, 'services/gateway-api/migrations', v.migration);
        const sql = fs.readFileSync(p, 'utf-8');
        expect(sql).toContain(`agent_${v.name}`);
      });
    });
  });

  describe('Shared type files', () => {
    verticals.forEach(v => {
      it(`type file exists: ${v.file}.ts`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`type file has export: ${v.file}`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('export');
      });
      it(`type file has interface: ${v.file}`, () => {
        const p = path.join(ROOT, 'packages/shared/src', `${v.file}.ts`);
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('interface');
      });
    });
  });

  describe('Barrel exports', () => {
    const indexContent = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`index.ts exports ${v.file}`, () => {
        expect(indexContent).toContain(v.file);
      });
    });
  });

  describe('SKILL.md files', () => {
    verticals.forEach(v => {
      it(`SKILL.md exists: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        expect(fs.existsSync(p)).toBe(true);
      });
      it(`SKILL.md has Actions: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content).toContain('## Actions');
      });
      it(`SKILL.md has frontmatter: ${v.skillDir}`, () => {
        const p = path.join(ROOT, 'skills/autonomous-economy', v.skillDir, 'SKILL.md');
        const content = fs.readFileSync(p, 'utf-8');
        expect(content.startsWith('---')).toBe(true);
      });
    });
  });

  describe('Eidolon types.ts — BK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`BK includes '${v.name}'`, () => {
        expect(types).toContain(`'${v.name}'`);
      });
    });
  });

  describe('Eidolon types.ts — EK', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      v.ek.forEach(ek => {
        it(`EK includes '${ek}'`, () => {
          expect(types).toContain(`'${ek}'`);
        });
      });
    });
  });

  describe('Eidolon types.ts — districtFor', () => {
    const types = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    verticals.forEach(v => {
      it(`districtFor has case '${v.name}'`, () => {
        expect(types).toContain(`case '${v.name}'`);
      });
    });
  });

  describe('Event-bus SUBJECT_MAP', () => {
    const eb = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    verticals.forEach(v => {
      v.subj.forEach(s => {
        it(`SUBJECT_MAP has '${s}'`, () => {
          expect(eb).toContain(`'${s}'`);
        });
      });
    });
  });

  describe('Task executor — switch cases', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    verticals.forEach(v => {
      v.cases.forEach(cs => {
        it(`switch case '${cs}'`, () => {
          expect(te).toContain(`case '${cs}'`);
        });
      });
    });
  });

  describe('Task executor — handler methods', () => {
    const te = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const handlers = [
      'handleCrtrCheckExpiry','handleCrtrRenewCert','handleCrtrRotateCert','handleCrtrRevokeCert','handleCrtrGenerateCsr','handleCrtrAuditCerts',
      'handleKescStoreKey','handleKescRetrieveKey','handleKescRotateKey','handleKescRevokeKey','handleKescBackupKeys','handleKescAuditAccess',
      'handleCfgaScanConfigs','handleCfgaCreateBaseline','handleCfgaCompareBaseline','handleCfgaListViolations','handleCfgaRemediateViolation','handleCfgaGenerateReport',
      'handleUpstCreateMonitor','handleUpstCheckStatus','handleUpstGetUptime','handleUpstListIncidents','handleUpstResolveIncident','handleUpstGenerateSlaReport',
      'handleDrfdSetBaseline','handleDrfdScanDrift','handleDrfdListDriftEvents','handleDrfdRemediateDrift','handleDrfdCompareStates','handleDrfdScheduleScan',
    ];
    handlers.forEach(h => {
      it(`handler ${h} exists`, () => {
        expect(te).toContain(h);
      });
    });
  });

  describe('.gitattributes entries', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    verticals.forEach(v => {
      it(`gitattributes has migration: ${v.migration}`, () => {
        expect(ga).toContain(v.migration);
      });
      it(`gitattributes has type file: ${v.file}`, () => {
        expect(ga).toContain(`${v.file}.ts`);
      });
      it(`gitattributes has skill dir: ${v.skillDir}`, () => {
        expect(ga).toContain(v.skillDir);
      });
    });
  });
});
