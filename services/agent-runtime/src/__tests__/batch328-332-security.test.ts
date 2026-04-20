import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

describe('Batch 328-332: Security & Intelligence', () => {

  const migrations = [
    { file: '20260619650000_agent_pentest_runner.sql', tables: ['agent_pentest_runner_configs', 'agent_pentest_findings', 'agent_pentest_reports'] },
    { file: '20260619660000_agent_intrusion_guard.sql', tables: ['agent_intrusion_guard_configs', 'agent_intrusion_events', 'agent_intrusion_rules'] },
    { file: '20260619670000_agent_rbac_enforcer.sql', tables: ['agent_rbac_enforcer_configs', 'agent_rbac_roles', 'agent_rbac_assignments'] },
    { file: '20260619680000_agent_siem_connector.sql', tables: ['agent_siem_connector_configs', 'agent_siem_events', 'agent_siem_dashboards'] },
    { file: '20260619690000_agent_forensic_analyzer.sql', tables: ['agent_forensic_analyzer_configs', 'agent_forensic_cases', 'agent_forensic_evidence'] },
  ];

  describe('Migration SQL files', () => {
    for (const m of migrations) {
      it(`${m.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'services/gateway-api/migrations', m.file))).toBe(true); });
      for (const t of m.tables) {
        it(`${m.file} creates table ${t}`, () => {
          const sql = fs.readFileSync(path.join(ROOT, 'services/gateway-api/migrations', m.file), 'utf-8');
          expect(sql).toContain(t);
        });
      }
    }
  });

  const typeFiles = [
    { file: 'agent-pentest-runner.ts', exports: ['ScanType', 'FindingSeverity', 'FindingStatus'] },
    { file: 'agent-intrusion-guard.ts', exports: ['DetectionMode', 'IntrusionSeverity', 'RuleAction'] },
    { file: 'agent-rbac-enforcer.ts', exports: ['EnforcementMode', 'DefaultPolicy', 'SubjectType'] },
    { file: 'agent-siem-connector.ts', exports: ['SiemType', 'EventCategory', 'DashboardType'] },
    { file: 'agent-forensic-analyzer.ts', exports: ['CaseType', 'CaseStatus', 'EvidenceType'] },
  ];

  describe('Shared type files', () => {
    for (const tf of typeFiles) {
      it(`${tf.file} exists`, () => { expect(fs.existsSync(path.join(ROOT, 'packages/shared/src', tf.file))).toBe(true); });
      for (const exp of tf.exports) {
        it(`${tf.file} exports ${exp}`, () => { expect(fs.readFileSync(path.join(ROOT, 'packages/shared/src', tf.file), 'utf-8')).toContain(exp); });
      }
    }
  });

  describe('Barrel exports in index.ts', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'packages/shared/src/index.ts'), 'utf-8');
    for (const b of ['agent-pentest-runner', 'agent-intrusion-guard', 'agent-rbac-enforcer', 'agent-siem-connector', 'agent-forensic-analyzer']) {
      it(`exports ${b}`, () => { expect(idx).toContain(b); });
    }
  });

  const skills = [
    { dir: 'pentest-runner', price: '24.99', archetype: 'engineer' },
    { dir: 'intrusion-guard', price: '19.99', archetype: 'engineer' },
    { dir: 'rbac-enforcer', price: '15.99', archetype: 'engineer' },
    { dir: 'siem-connector', price: '21.99', archetype: 'analyst' },
    { dir: 'forensic-analyzer', price: '29.99', archetype: 'analyst' },
  ];

  describe('SKILL.md files', () => {
    for (const s of skills) {
      const p = path.join(ROOT, 'skills/autonomous-economy', s.dir, 'SKILL.md');
      it(`${s.dir}/SKILL.md exists`, () => { expect(fs.existsSync(p)).toBe(true); });
      it(`${s.dir}/SKILL.md has correct price`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.price); });
      it(`${s.dir}/SKILL.md has correct archetype`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain(s.archetype); });
      it(`${s.dir}/SKILL.md has Actions section`, () => { expect(fs.readFileSync(p, 'utf-8')).toContain('## Actions'); });
    }
  });

  describe('Eidolon types.ts', () => {
    const tc = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/types.ts'), 'utf-8');
    for (const bk of ['pentest_runner', 'intrusion_guard', 'rbac_enforcer', 'siem_connector', 'forensic_analyzer']) {
      it(`has BK '${bk}'`, () => { expect(tc).toContain(`'${bk}'`); });
    }
    for (const ek of ['pntr.scan_completed', 'idgd.intrusion_detected', 'rbce.role_created', 'siem.events_ingested', 'fran.case_created']) {
      it(`has EK '${ek}'`, () => { expect(tc).toContain(`'${ek}'`); });
    }
    for (const bk of ['pentest_runner', 'intrusion_guard', 'rbac_enforcer', 'siem_connector', 'forensic_analyzer']) {
      it(`has districtFor case '${bk}'`, () => { expect(tc).toContain(`case '${bk}':`); });
    }
  });

  describe('Event bus SUBJECT_MAP', () => {
    const bus = fs.readFileSync(path.join(ROOT, 'services/sven-eidolon/src/event-bus.ts'), 'utf-8');
    const subjects = [
      'sven.pntr.scan_completed', 'sven.pntr.finding_verified', 'sven.pntr.report_generated', 'sven.pntr.retest_scheduled',
      'sven.idgd.intrusion_detected', 'sven.idgd.source_blocked', 'sven.idgd.rule_triggered', 'sven.idgd.event_analyzed',
      'sven.rbce.role_created', 'sven.rbce.role_assigned', 'sven.rbce.permission_checked', 'sven.rbce.assignment_revoked',
      'sven.siem.events_ingested', 'sven.siem.event_enriched', 'sven.siem.dashboard_created', 'sven.siem.report_exported',
      'sven.fran.case_created', 'sven.fran.evidence_collected', 'sven.fran.timeline_analyzed', 'sven.fran.case_closed',
    ];
    for (const s of subjects) {
      it(`has subject '${s}'`, () => { expect(bus).toContain(`'${s}'`); });
    }
  });

  describe('Task executor', () => {
    const exec = fs.readFileSync(path.join(ROOT, 'services/sven-marketplace/src/task-executor.ts'), 'utf-8');
    const cases = [
      'pntr_run_scan', 'pntr_verify_finding', 'pntr_generate_report', 'pntr_schedule_retest', 'pntr_export_findings', 'pntr_compare_scans',
      'idgd_create_rule', 'idgd_monitor_traffic', 'idgd_block_source', 'idgd_analyze_event', 'idgd_whitelist_source', 'idgd_export_events',
      'rbce_create_role', 'rbce_assign_role', 'rbce_check_permission', 'rbce_audit_access', 'rbce_revoke_assignment', 'rbce_export_policies',
      'siem_ingest_events', 'siem_enrich_event', 'siem_create_dashboard', 'siem_correlate_events', 'siem_export_report', 'siem_configure_source',
      'fran_create_case', 'fran_collect_evidence', 'fran_analyze_timeline', 'fran_generate_findings', 'fran_close_case', 'fran_export_case',
    ];
    for (const c of cases) {
      it(`has case '${c}'`, () => { expect(exec).toContain(`case '${c}'`); });
    }
    for (const h of ['handlePntrRunScan', 'handleIdgdCreateRule', 'handleRbceCreateRole', 'handleSiemIngestEvents', 'handleFranCreateCase']) {
      it(`has handler ${h}`, () => { expect(exec).toContain(h); });
    }
  });

  describe('.gitattributes', () => {
    const ga = fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf-8');
    for (const e of [
      'agent_pentest_runner.sql', 'agent_intrusion_guard.sql', 'agent_rbac_enforcer.sql', 'agent_siem_connector.sql', 'agent_forensic_analyzer.sql',
      'agent-pentest-runner.ts', 'agent-intrusion-guard.ts', 'agent-rbac-enforcer.ts', 'agent-siem-connector.ts', 'agent-forensic-analyzer.ts',
      'pentest-runner/SKILL.md', 'intrusion-guard/SKILL.md', 'rbac-enforcer/SKILL.md', 'siem-connector/SKILL.md', 'forensic-analyzer/SKILL.md',
    ]) {
      it(`has entry for ${e}`, () => { expect(ga).toContain(e); });
    }
  });
});
