/**
 * Batch 173-177 — Agent Ops & Security Verticals
 * Cost Anomaly · Drift Remediation · Log Correlation · Webhook Manager · Certificate Manager
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');

// ── helpers ────────────────────────────────────────────────────────
function readFile(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}
function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(ROOT, rel));
}

// ── 1. Migration SQL files ────────────────────────────────────────
describe('Batch 173-177 Migrations', () => {
  const migrations = [
    { batch: 173, file: '20260618100000_agent_cost_anomaly.sql', table: 'agent_cost_anomaly_budgets' },
    { batch: 174, file: '20260618110000_agent_drift_remediation.sql', table: 'agent_drift_baselines' },
    { batch: 175, file: '20260618120000_agent_log_correlation.sql', table: 'agent_log_correlation_rules' },
    { batch: 176, file: '20260618130000_agent_webhook_manager.sql', table: 'agent_webhook_endpoints' },
    { batch: 177, file: '20260618140000_agent_certificate_manager.sql', table: 'agent_certificate_inventory' },
  ];

  migrations.forEach(({ batch, file, table }) => {
    describe(`Batch ${batch}: ${file}`, () => {
      const rel = `services/gateway-api/migrations/${file}`;
      it('file exists', () => expect(fileExists(rel)).toBe(true));
      it('contains CREATE TABLE', () => expect(readFile(rel)).toContain('CREATE TABLE'));
      it(`creates ${table} table`, () => expect(readFile(rel)).toContain(table));
      it('has id column', () => expect(readFile(rel)).toMatch(/\bid\b/));
      it('has created_at', () => expect(readFile(rel)).toContain('created_at'));
      it('has updated_at', () => expect(readFile(rel)).toContain('updated_at'));
    });
  });
});

// ── 2. Shared type modules ────────────────────────────────────────
describe('Batch 173-177 Shared Types', () => {
  const types = [
    { batch: 173, mod: 'agent-cost-anomaly', iface: 'CostBudget' },
    { batch: 174, mod: 'agent-drift-remediation', iface: 'DriftResourceType' },
    { batch: 175, mod: 'agent-log-correlation', iface: 'LogPatternType' },
    { batch: 176, mod: 'agent-webhook-manager', iface: 'WebhookEndpoint' },
    { batch: 177, mod: 'agent-certificate-manager', iface: 'CertificateType' },
  ];

  types.forEach(({ batch, mod, iface }) => {
    describe(`Batch ${batch}: ${mod}`, () => {
      const rel = `packages/shared/src/${mod}.ts`;
      it('file exists', () => expect(fileExists(rel)).toBe(true));
      it(`exports ${iface}`, () => expect(readFile(rel)).toContain(iface));
      it('exports type definitions', () => expect(readFile(rel)).toMatch(/export (type|interface)/));
      it('has type union or interface', () => expect(readFile(rel)).toMatch(/= '|{/));
      it('has id field', () => expect(readFile(rel)).toContain('id:'));
    });
  });
});

// ── 3. Barrel exports ─────────────────────────────────────────────
describe('Barrel exports (index.ts)', () => {
  const indexContent = readFile('packages/shared/src/index.ts');
  const mods = [
    'agent-cost-anomaly', 'agent-drift-remediation', 'agent-log-correlation',
    'agent-webhook-manager', 'agent-certificate-manager',
  ];
  mods.forEach(m => {
    it(`exports ${m}`, () => expect(indexContent).toContain(`from './${m}.js'`));
  });
});

// ── 4. SKILL.md files ─────────────────────────────────────────────
describe('Batch 173-177 SKILL.md', () => {
  const skills = [
    { batch: 173, name: 'agent-cost-anomaly', category: 'operations' },
    { batch: 174, name: 'agent-drift-remediation', category: 'operations' },
    { batch: 175, name: 'agent-log-correlation', category: 'operations' },
    { batch: 176, name: 'agent-webhook-manager', category: 'infrastructure' },
    { batch: 177, name: 'agent-certificate-manager', category: 'security' },
  ];

  skills.forEach(({ batch, name, category }) => {
    describe(`Batch ${batch}: ${name}`, () => {
      const rel = `skills/${name}/SKILL.md`;
      it('file exists', () => expect(fileExists(rel)).toBe(true));
      it('has YAML frontmatter', () => expect(readFile(rel)).toMatch(/^---/));
      it(`has category ${category}`, () => expect(readFile(rel).toLowerCase()).toContain(category));
      it('has pricing in 47T', () => expect(readFile(rel)).toContain('47T'));
      it('has description', () => expect(readFile(rel).toLowerCase()).toContain('description'));
      it('has actions section', () => expect(readFile(rel).toLowerCase()).toContain('action'));
    });
  });
});

// ── 5. Eidolon BK values ─────────────────────────────────────────
describe('EidolonBuildingKind', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  const bks = ['cost_watchtower', 'remediation_forge', 'correlation_hub', 'webhook_station', 'certificate_vault'];
  bks.forEach(bk => {
    it(`has '${bk}'`, () => expect(types).toContain(`'${bk}'`));
  });
});

// ── 6. Eidolon EK values ─────────────────────────────────────────
describe('EidolonEventKind', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  const eks = [
    'budget_created', 'anomaly_detected', 'forecast_generated', 'budget_exceeded',
    'baseline_set', 'drift_detected', 'remediation_applied', 'escalated',
    'rule_triggered', 'incident_opened', 'root_cause_found', 'incident_resolved',
    'endpoint_registered', 'delivery_sent', 'delivery_failed', 'retry_exhausted',
    'certificate_imported', 'renewal_requested', 'renewal_completed', 'expiry_warning',
  ];
  eks.forEach(ek => {
    it(`has '${ek}' (pipe value)`, () => expect(types).toContain(ek));
  });
});

// ── 7. districtFor ────────────────────────────────────────────────
describe('districtFor()', () => {
  const types = readFile('services/sven-eidolon/src/types.ts');
  const cases = [
    'cost_watchtower', 'remediation_forge', 'correlation_hub',
    'webhook_station', 'certificate_vault',
  ];
  cases.forEach(c => {
    it(`has case '${c}'`, () => expect(types).toContain(`case '${c}':`));
  });
});

// ── 8. SUBJECT_MAP ────────────────────────────────────────────────
describe('Event-bus SUBJECT_MAP', () => {
  const bus = readFile('services/sven-eidolon/src/event-bus.ts');
  const subjects = [
    'sven.cost.budget_created', 'sven.cost.anomaly_detected',
    'sven.cost.forecast_generated', 'sven.cost.budget_exceeded',
    'sven.drift.baseline_set', 'sven.drift.drift_detected',
    'sven.drift.remediation_applied', 'sven.drift.escalated',
    'sven.logcorr.rule_triggered', 'sven.logcorr.incident_opened',
    'sven.logcorr.root_cause_found', 'sven.logcorr.incident_resolved',
    'sven.webhook.endpoint_registered', 'sven.webhook.delivery_sent',
    'sven.webhook.delivery_failed', 'sven.webhook.retry_exhausted',
    'sven.cert.certificate_imported', 'sven.cert.renewal_requested',
    'sven.cert.renewal_completed', 'sven.cert.expiry_warning',
  ];
  subjects.forEach(s => {
    it(`has '${s}'`, () => expect(bus).toContain(`'${s}'`));
  });
});

// ── 9. Task executor switch cases ─────────────────────────────────
describe('Task executor switch cases', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const cases = [
    'cost_create_budget', 'cost_detect_anomalies', 'cost_forecast_spending',
    'cost_generate_report', 'cost_optimize_costs', 'cost_acknowledge_anomaly',
    'drift_create_baseline', 'drift_scan_drift', 'drift_auto_remediate',
    'drift_approve_drift', 'drift_rollback_change', 'drift_escalate_drift',
    'logcorr_create_rule', 'logcorr_correlate_logs', 'logcorr_investigate_incident',
    'logcorr_build_timeline', 'logcorr_resolve_incident', 'logcorr_export_analysis',
    'webhook_register_endpoint', 'webhook_send_webhook', 'webhook_verify_signature',
    'webhook_retry_delivery', 'webhook_transform_payload', 'webhook_list_deliveries',
    'cert_import_certificate', 'cert_request_renewal', 'cert_monitor_expiry',
    'cert_verify_chain', 'cert_revoke_certificate', 'cert_audit_inventory',
  ];
  cases.forEach(c => {
    it(`routes '${c}'`, () => expect(te).toContain(`case '${c}':`));
  });
});

// ── 10. Task executor handler methods ─────────────────────────────
describe('Task executor handler methods', () => {
  const te = readFile('services/sven-marketplace/src/task-executor.ts');
  const handlers = [
    'handleCostCreateBudget', 'handleCostDetectAnomalies', 'handleCostForecastSpending',
    'handleCostGenerateReport', 'handleCostOptimizeCosts', 'handleCostAcknowledgeAnomaly',
    'handleDriftCreateBaseline', 'handleDriftScanDrift', 'handleDriftAutoRemediate',
    'handleDriftApproveDrift', 'handleDriftRollbackChange', 'handleDriftEscalateDrift',
    'handleLogcorrCreateRule', 'handleLogcorrCorrelateLogs', 'handleLogcorrInvestigateIncident',
    'handleLogcorrBuildTimeline', 'handleLogcorrResolveIncident', 'handleLogcorrExportAnalysis',
    'handleWebhookRegisterEndpoint', 'handleWebhookSendWebhook', 'handleWebhookVerifySignature',
    'handleWebhookRetryDelivery', 'handleWebhookTransformPayload', 'handleWebhookListDeliveries',
    'handleCertImportCertificate', 'handleCertRequestRenewal', 'handleCertMonitorExpiry',
    'handleCertVerifyChain', 'handleCertRevokeCertificate', 'handleCertAuditInventory',
  ];
  handlers.forEach(h => {
    it(`has ${h}()`, () => expect(te).toContain(`${h}(task`));
  });
});

// ── 11. .gitattributes privacy ────────────────────────────────────
describe('.gitattributes privacy filtering', () => {
  const ga = readFile('.gitattributes');
  const entries = [
    'agent_cost_anomaly.sql', 'agent-cost-anomaly.ts', 'agent-cost-anomaly/SKILL.md',
    'agent_drift_remediation.sql', 'agent-drift-remediation.ts', 'agent-drift-remediation/SKILL.md',
    'agent_log_correlation.sql', 'agent-log-correlation.ts', 'agent-log-correlation/SKILL.md',
    'agent_webhook_manager.sql', 'agent-webhook-manager.ts', 'agent-webhook-manager/SKILL.md',
    'agent_certificate_manager.sql', 'agent-certificate-manager.ts', 'agent-certificate-manager/SKILL.md',
  ];
  entries.forEach(e => {
    it(`filters ${e}`, () => expect(ga).toContain(e));
  });
});
